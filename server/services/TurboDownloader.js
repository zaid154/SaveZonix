const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// Optimized connection pool agents for high-throughput micro-burst slicing
const agentConfig = {
    keepAlive: true,
    maxSockets: 32,
    maxFreeSockets: 16,
    timeout: 30000,
    freeSocketTimeout: 15000
};
const httpsAgent = new https.Agent(agentConfig);
const httpAgent = new http.Agent(agentConfig);

class TurboDownloader {
    constructor() {
        this.activeDownloads = new Map();
    }

    /**
     * Download a file using parallel range micro-burst slicing
     */
    async downloadFile(url, finalOutputPath, options = {}) {
        const {
            taskId = crypto.randomUUID(),
            totalSize = 0,
            concurrency = 16,
            sliceSizeBytes = null,
            onProgress = null,
            abortSignal = null
        } = options;

        const downloadDir = path.dirname(finalOutputPath);
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        const tempDir = path.join(downloadDir, `.sz_parts_${taskId}`);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const downloadState = {
            taskId,
            url,
            outputPath: finalOutputPath,
            tempDir,
            cancelled: false,
            bytesDownloaded: 0,
            totalSize: totalSize,
            speedMBps: 0,
            status: 'Initializing'
        };
        this.activeDownloads.set(taskId, downloadState);

        try {
            // Determine slice size
            const effectiveTotalSize = totalSize > 0 ? totalSize : await this._probeContentLength(url);
            downloadState.totalSize = effectiveTotalSize;

            if (effectiveTotalSize <= 0) {
                // Cannot slice without known size; fallback to direct single stream
                return await this._downloadSingleStream(url, finalOutputPath, downloadState, onProgress, abortSignal);
            }

            // Dynamic micro-burst slicing: 512KB for small/audio, 1-2MB for video
            let chunkSize = sliceSizeBytes;
            if (!chunkSize) {
                if (effectiveTotalSize <= 10 * 1024 * 1024) {
                    chunkSize = 512 * 1024; // 512 KB
                } else if (effectiveTotalSize <= 50 * 1024 * 1024) {
                    chunkSize = 1024 * 1024; // 1 MB
                } else {
                    chunkSize = 2 * 1024 * 1024; // 2 MB
                }
            }

            const totalChunks = Math.ceil(effectiveTotalSize / chunkSize);
            const effectiveConcurrency = Math.min(concurrency, totalChunks, 32);

            downloadState.status = `⚡ Turbo Downloading (${totalChunks} Slices @ ${effectiveConcurrency} Sockets)...`;

            let downloadedBytes = 0;
            let lastProgressTime = Date.now();
            let lastBytes = 0;

            const updateProgress = (chunkBytes) => {
                downloadedBytes += chunkBytes;
                downloadState.bytesDownloaded = downloadedBytes;

                const now = Date.now();
                const deltaSec = (now - lastProgressTime) / 1000;
                if (deltaSec >= 0.25 || downloadedBytes >= effectiveTotalSize) {
                    const deltaMB = (downloadedBytes - lastBytes) / (1024 * 1024);
                    downloadState.speedMBps = deltaSec > 0 ? Math.max(0.1, Number((deltaMB / deltaSec).toFixed(2))) : 0;
                    lastProgressTime = now;
                    lastBytes = downloadedBytes;

                    if (typeof onProgress === 'function') {
                        const percentage = effectiveTotalSize > 0 
                            ? Math.min(100, Number(((downloadedBytes / effectiveTotalSize) * 100).toFixed(1)))
                            : 0;
                        const remainingSec = downloadState.speedMBps > 0 
                            ? Math.round((effectiveTotalSize - downloadedBytes) / (downloadState.speedMBps * 1024 * 1024))
                            : 0;

                        onProgress({
                            taskId,
                            bytesDownloaded: downloadedBytes,
                            totalBytes: effectiveTotalSize,
                            percentage,
                            speedMBps: downloadState.speedMBps,
                            activeThreads: effectiveConcurrency,
                            etaSeconds: Math.max(0, remainingSec),
                            status: downloadState.status
                        });
                    }
                }
            };

            // Queue chunks with worker pool
            const chunks = [];
            for (let i = 0; i < totalChunks; i++) {
                const start = i * chunkSize;
                const end = Math.min((i + 1) * chunkSize - 1, effectiveTotalSize - 1);
                const partPath = path.join(tempDir, `part_${String(i).padStart(5, '0')}.tmp`);
                chunks.push({ index: i, start, end, partPath, size: end - start + 1 });
            }

            let nextChunkIdx = 0;
            const worker = async () => {
                while (nextChunkIdx < chunks.length) {
                    if (downloadState.cancelled || (abortSignal && abortSignal.aborted)) {
                        throw new Error('Download was cancelled');
                    }
                    const chunk = chunks[nextChunkIdx++];
                    await this._downloadSliceWithRetry(url, chunk.start, chunk.end, chunk.partPath, updateProgress, abortSignal);
                }
            };

            const workers = [];
            for (let w = 0; w < effectiveConcurrency; w++) {
                workers.push(worker());
            }

            await Promise.all(workers);

            // Merge chunks
            downloadState.status = 'Merging Segments...';
            if (typeof onProgress === 'function') {
                onProgress({ taskId, percentage: 98, status: downloadState.status, speedMBps: downloadState.speedMBps });
            }

            await this._mergeSegments(chunks, finalOutputPath);

            // Cleanup temp directory
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (e) {
                console.warn(`[TurboDownloader] Notice cleaning tempDir: ${e.message}`);
            }

            downloadState.status = 'Download Complete';
            if (typeof onProgress === 'function') {
                onProgress({ taskId, percentage: 100, status: downloadState.status, speedMBps: downloadState.speedMBps });
            }

            return {
                success: true,
                taskId,
                filePath: finalOutputPath,
                fileSize: effectiveTotalSize,
                speedMBps: downloadState.speedMBps
            };

        } catch (error) {
            downloadState.status = 'Failed: ' + error.message;
            try {
                if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
            } catch {}
            throw error;
        } finally {
            this.activeDownloads.delete(taskId);
        }
    }

    async _probeContentLength(url) {
        return new Promise((resolve) => {
            const u = new URL(url);
            const client = u.protocol === 'https:' ? https : http;
            const agent = u.protocol === 'https:' ? httpsAgent : httpAgent;

            const req = client.request({
                hostname: u.hostname,
                path: u.pathname + u.search,
                method: 'HEAD',
                agent: agent,
                headers: { 'User-Agent': 'SaveZonix-TurboDownloader/2.0' }
            }, (res) => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                    return resolve(this._probeContentLength(res.headers.location));
                }
                const len = parseInt(res.headers['content-length'] || '0', 10);
                resolve(len > 0 ? len : 0);
            });
            req.on('error', () => resolve(0));
            req.setTimeout(5000, () => { req.destroy(); resolve(0); });
            req.end();
        });
    }

    async _downloadSliceWithRetry(url, start, end, partPath, onChunkBytes, abortSignal, maxRetries = 3) {
        let attempts = 0;
        while (attempts < maxRetries) {
            try {
                await this._downloadSlice(url, start, end, partPath, onChunkBytes, abortSignal);
                return;
            } catch (err) {
                attempts++;
                if (attempts >= maxRetries || (abortSignal && abortSignal.aborted)) {
                    throw err;
                }
                await new Promise(r => setTimeout(r, 200 * attempts));
            }
        }
    }

    _downloadSlice(url, start, end, partPath, onChunkBytes, abortSignal) {
        return new Promise((resolve, reject) => {
            if (abortSignal && abortSignal.aborted) {
                return reject(new Error('Download cancelled'));
            }

            const u = new URL(url);
            const client = u.protocol === 'https:' ? https : http;
            const agent = u.protocol === 'https:' ? httpsAgent : httpAgent;

            const options = {
                hostname: u.hostname,
                path: u.pathname + u.search,
                method: 'GET',
                agent: agent,
                headers: {
                    'Range': `bytes=${start}-${end}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Connection': 'keep-alive'
                }
            };

            const writeStream = fs.createWriteStream(partPath);
            const req = client.request(options, (res) => {
                // Follow HTTP 301, 302, 303, 307, 308 redirects from YouTube/CDN edges
                if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                    writeStream.close();
                    if (fs.existsSync(partPath)) {
                        try { fs.unlinkSync(partPath); } catch {}
                    }
                    return resolve(this._downloadSlice(res.headers.location, start, end, partPath, onChunkBytes, abortSignal));
                }

                if (res.statusCode !== 206 && res.statusCode !== 200) {
                    writeStream.close();
                    return reject(new Error(`Server returned HTTP ${res.statusCode} for range ${start}-${end}`));
                }

                res.on('data', (chunk) => {
                    if (typeof onChunkBytes === 'function') {
                        onChunkBytes(chunk.length);
                    }
                });

                res.pipe(writeStream);

                writeStream.on('finish', () => resolve());
                writeStream.on('error', (err) => {
                    writeStream.close();
                    reject(err);
                });
            });

            if (abortSignal) {
                abortSignal.addEventListener('abort', () => {
                    req.destroy();
                    writeStream.close();
                    reject(new Error('Download cancelled'));
                }, { once: true });
            }

            req.on('error', (err) => {
                writeStream.close();
                reject(err);
            });

            req.end();
        });
    }

    async _mergeSegments(chunks, finalOutputPath) {
        const outStream = fs.createWriteStream(finalOutputPath);
        for (const chunk of chunks) {
            await new Promise((resolve, reject) => {
                const readStream = fs.createReadStream(chunk.partPath);
                readStream.pipe(outStream, { end: false });
                readStream.on('end', resolve);
                readStream.on('error', reject);
            });
        }
        outStream.end();
        await new Promise((resolve, reject) => {
            outStream.on('finish', resolve);
            outStream.on('error', reject);
        });
    }

    async _downloadSingleStream(url, finalOutputPath, downloadState, onProgress, abortSignal) {
        return new Promise((resolve, reject) => {
            const u = new URL(url);
            const client = u.protocol === 'https:' ? https : http;
            const agent = u.protocol === 'https:' ? httpsAgent : httpAgent;

            const writeStream = fs.createWriteStream(finalOutputPath);
            const req = client.request({
                hostname: u.hostname,
                path: u.pathname + u.search,
                method: 'GET',
                agent: agent,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            }, (res) => {
                const totalLen = parseInt(res.headers['content-length'] || '0', 10);
                downloadState.totalSize = totalLen;
                let downloaded = 0;
                let lastTime = Date.now();
                let lastBytes = 0;

                res.on('data', (c) => {
                    downloaded += c.length;
                    downloadState.bytesDownloaded = downloaded;
                    const now = Date.now();
                    if ((now - lastTime) >= 300) {
                        const deltaMB = (downloaded - lastBytes) / (1024 * 1024);
                        downloadState.speedMBps = Number((deltaMB / ((now - lastTime) / 1000)).toFixed(2));
                        lastTime = now;
                        lastBytes = downloaded;
                        if (typeof onProgress === 'function') {
                            onProgress({
                                taskId: downloadState.taskId,
                                bytesDownloaded: downloaded,
                                totalBytes: totalLen,
                                percentage: totalLen > 0 ? Math.min(100, Math.round((downloaded / totalLen) * 100)) : 0,
                                speedMBps: downloadState.speedMBps,
                                activeThreads: 1,
                                status: 'Downloading (Single Stream)...'
                            });
                        }
                    }
                });

                res.pipe(writeStream);
                writeStream.on('finish', () => {
                    resolve({
                        success: true,
                        taskId: downloadState.taskId,
                        filePath: finalOutputPath,
                        fileSize: downloaded,
                        speedMBps: downloadState.speedMBps
                    });
                });
                writeStream.on('error', reject);
            });

            req.on('error', reject);
            req.end();
        });
    }

    cancelDownload(taskId) {
        const item = this.activeDownloads.get(taskId);
        if (item) {
            item.cancelled = true;
            this.activeDownloads.delete(taskId);
            return true;
        }
        return false;
    }
}

module.exports = new TurboDownloader();
