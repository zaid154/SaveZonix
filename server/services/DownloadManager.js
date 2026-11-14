const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const turboDownloader = require('./TurboDownloader');
const mediaResolver = require('./MediaResolver');
const ffmpegService = require('./FFmpegService');
const DownloadHistory = require('../models/DownloadHistory');

class DownloadManager {
    constructor() {
        this.io = null;
        this.downloadsFolder = path.resolve(__dirname, '../../downloads');
        if (!fs.existsSync(this.downloadsFolder)) {
            fs.mkdirSync(this.downloadsFolder, { recursive: true });
        }
    }

    setSocketIO(io) {
        this.io = io;
    }

    emitProgress(report) {
        if (this.io) {
            this.io.emit('download:progress', report);
        }
    }

    sanitizeFileName(name) {
        if (!name) return 'media_' + Date.now();
        return name
            .replace(/[\\/:*?"<>|]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 150);
    }

    /**
     * Start a high-speed parallel download task for Audio or Video
     */
    async startDownload(url, quality = '1080p', user = null) {
        const taskId = crypto.randomUUID();
        const startTime = Date.now();

        try {
            this.emitProgress({
                taskId,
                percentage: 2,
                status: 'Resolving media stream manifests...',
                speedMBps: 0
            });

            const streamData = await mediaResolver.resolveSpecificStream(url, quality);
            const safeTitle = this.sanitizeFileName(streamData.title);

            let finalFilePath = '';
            let finalFileSize = streamData.sizeBytes;
            let peakSpeed = 0;

            if (streamData.type === 'audio') {
                // Audio Only Pipeline
                const rawAudioPath = path.join(this.downloadsFolder, `${safeTitle}_raw_${taskId}.tmp`);
                finalFilePath = path.join(this.downloadsFolder, `${safeTitle}.mp3`);

                const result = await turboDownloader.downloadFile(streamData.stream.url, rawAudioPath, {
                    taskId,
                    totalSize: streamData.sizeBytes,
                    concurrency: 8,
                    sliceSizeBytes: 512 * 1024,
                    onProgress: (p) => {
                        if (p.speedMBps > peakSpeed) peakSpeed = p.speedMBps;
                        this.emitProgress(p);
                    }
                });

                this.emitProgress({
                    taskId,
                    percentage: 95,
                    status: 'Converting to MP3 with FFmpeg...',
                    speedMBps: peakSpeed
                });

                // Convert/encode cleanly to MP3
                await ffmpegService.convertToMp3(rawAudioPath, finalFilePath);
                try { fs.unlinkSync(rawAudioPath); } catch {}

            } else {
                // Video + Audio Muxing Pipeline
                const rawVideoPath = path.join(this.downloadsFolder, `${safeTitle}_vraw_${taskId}.mp4`);
                const rawAudioPath = path.join(this.downloadsFolder, `${safeTitle}_araw_${taskId}.tmp`);
                finalFilePath = path.join(this.downloadsFolder, `${safeTitle}.mp4`);

                const videoSize = parseInt(streamData.videoStream.contentLength || '0', 10);
                const audioSize = parseInt(streamData.audioStream.contentLength || '0', 10);
                const combinedTotal = videoSize + audioSize;

                let videoDownloaded = 0;
                let audioDownloaded = 0;

                const updateCombined = () => {
                    const totalNow = videoDownloaded + audioDownloaded;
                    const pct = combinedTotal > 0 ? Math.min(92, Math.round((totalNow / combinedTotal) * 90)) : 0;
                    this.emitProgress({
                        taskId,
                        percentage: pct,
                        bytesDownloaded: totalNow,
                        totalBytes: combinedTotal,
                        speedMBps: peakSpeed,
                        status: `⚡ Turbo Downloading Video + Audio (${(totalNow / 1024 / 1024).toFixed(1)} MB)...`
                    });
                };

                const videoTask = turboDownloader.downloadFile(streamData.videoStream.url, rawVideoPath, {
                    taskId: taskId + '_v',
                    totalSize: videoSize,
                    concurrency: 16,
                    sliceSizeBytes: 2 * 1024 * 1024,
                    onProgress: (p) => {
                        videoDownloaded = p.bytesDownloaded;
                        if (p.speedMBps > peakSpeed) peakSpeed = p.speedMBps;
                        updateCombined();
                    }
                });

                const audioTask = turboDownloader.downloadFile(streamData.audioStream.url, rawAudioPath, {
                    taskId: taskId + '_a',
                    totalSize: audioSize,
                    concurrency: 4,
                    sliceSizeBytes: 512 * 1024,
                    onProgress: (p) => {
                        audioDownloaded = p.bytesDownloaded;
                        if (p.speedMBps > peakSpeed) peakSpeed = p.speedMBps;
                        updateCombined();
                    }
                });

                await Promise.all([videoTask, audioTask]);

                this.emitProgress({
                    taskId,
                    percentage: 94,
                    status: 'Muxing Video + Audio with FFmpeg...',
                    speedMBps: peakSpeed
                });

                await ffmpegService.muxVideoAndAudio(rawVideoPath, rawAudioPath, finalFilePath);
                try {
                    fs.unlinkSync(rawVideoPath);
                    fs.unlinkSync(rawAudioPath);
                } catch {}
            }

            const elapsedSec = (Date.now() - startTime) / 1000;
            const actualSize = fs.existsSync(finalFilePath) ? fs.statSync(finalFilePath).size : finalFileSize;
            const avgSpeed = (actualSize / 1024 / 1024) / Math.max(0.01, elapsedSec);

            // Persist into MongoDB
            try {
                const historyRecord = new DownloadHistory({
                    taskId,
                    title: streamData.title,
                    fileName: path.basename(finalFilePath),
                    originalUrl: url,
                    quality: quality,
                    format: path.extname(finalFilePath).replace('.', ''),
                    fileSize: actualSize,
                    downloadSpeedMBps: Number(avgSpeed.toFixed(2)),
                    peakSpeedMBps: Number(peakSpeed.toFixed(2)),
                    status: 'Completed',
                    downloadSource: 'web',
                    userEmail: user?.email || 'Guest'
                });
                await historyRecord.save();
            } catch (dbErr) {
                console.warn(`[DownloadManager] MongoDB save warning: ${dbErr.message}`);
            }

            const finalPayload = {
                taskId,
                success: true,
                title: streamData.title,
                fileName: path.basename(finalFilePath),
                filePath: finalFilePath,
                fileSize: actualSize,
                timeSeconds: Number(elapsedSec.toFixed(2)),
                averageSpeedMBps: Number(avgSpeed.toFixed(2)),
                percentage: 100,
                status: 'Download Complete'
            };

            if (this.io) {
                this.io.emit('download:complete', finalPayload);
            }

            return finalPayload;

        } catch (error) {
            console.error(`[DownloadManager] Download failed for ${url}:`, error);
            if (this.io) {
                this.io.emit('download:error', { taskId, error: error.message });
            }
            throw error;
        }
    }
}

module.exports = new DownloadManager();
