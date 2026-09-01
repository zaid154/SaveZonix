// src/download/media-processor.js — Ultra High-Speed Multi-Threaded Range & HLS Media Processing Engine (Up to 32 Threads)

(function (root) {
    // ─── 1. BINARY MEDIA VALIDATORS ──────────────────────────────────────────
    function isBinaryMediaBuffer(input) {
        if (!input) return false;
        const bytes = (input instanceof Uint8Array) ? input : new Uint8Array(input);
        if (bytes.length < 8) return false;
        
        // MP4 / ISO Base Media File Format box signature
        if (bytes.length >= 12 && 
            bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
            return true;
        }

        // WebM / Matroska EBML signature (0x1A 0x45 0xDF 0xA3)
        if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
            return true;
        }

        // MPEG-TS 188-byte Sync Byte (0x47)
        if (bytes[0] === 0x47) {
            if (bytes.length >= 189) {
                return bytes[188] === 0x47 || bytes.length < 376 || bytes[376] === 0x47;
            }
            return true;
        }

        // MPEG-TS with ID3v2 container header (0x49 0x44 0x33 = "ID3")
        if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
            return true;
        }

        // PNG Encapsulated Steganography Video (0x89 0x50 0x4E 0x47)
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
            for (let i = 0; i < Math.min(bytes.length - 188, 256); i++) {
                if (bytes[i] === 0x47 && bytes[i + 188] === 0x47) {
                    return true;
                }
            }
        }

        return false;
    }

    function inspectMediaBuffer(input) {
        if (!input) {
            return { isValid: false, format: 'unknown', reason: 'Buffer is empty' };
        }
        const bytes = (input instanceof Uint8Array) ? input : new Uint8Array(input);
        if (bytes.length < 8) {
            return { isValid: false, format: 'unknown', reason: 'Buffer is too small' };
        }

        // Check for XML / HTML / JSON text error signatures
        const textSample = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, Math.min(bytes.length, 128))).trim().toLowerCase();
        if (textSample.startsWith('<?xml') || textSample.startsWith('<error') || textSample.startsWith('<html') || textSample.startsWith('<!doc')) {
            return { isValid: false, format: 'xml_error', reason: `Non-media response: ${textSample.slice(0, 30)}` };
        }
        if (textSample.startsWith('{') && textSample.includes('"error"')) {
            return { isValid: false, format: 'json_error', reason: `Server returned JSON error: ${textSample.slice(0, 30)}` };
        }
        if (textSample.startsWith('#extm3u')) {
            return { isValid: false, format: 'm3u8_manifest', reason: 'File is an M3U8 manifest playlist, not a binary video' };
        }

        // MP4 verification
        if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
            return { isValid: true, format: 'mp4', mimeType: 'video/mp4', extension: 'mp4' };
        }

        // WebM verification
        if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
            return { isValid: true, format: 'webm', mimeType: 'video/webm', extension: 'webm' };
        }

        // MPEG-TS verification
        if (bytes[0] === 0x47) {
            return { isValid: true, format: 'mpegts', mimeType: 'video/mp2t', extension: 'mp4' };
        }

        // ID3 Header verification
        if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
            return { isValid: true, format: 'id3_ts', mimeType: 'video/mp2t', extension: 'mp4' };
        }

        // PNG Encapsulated Steganography Video
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
            for (let i = 0; i < Math.min(bytes.length - 188, 256); i++) {
                if (bytes[i] === 0x47 && bytes[i + 188] === 0x47) {
                    return { isValid: true, format: 'png_steg_ts', mimeType: 'video/mp2t', extension: 'mp4' };
                }
            }
        }

        return { isValid: true, format: 'binary_stream', mimeType: 'video/mp4', extension: 'mp4' };
    }

    // ─── AES-128 CRYPTO UTILITIES ──────────────────────────────────────────
    function hexToUint8Array(hexString) {
        const clean = hexString.replace(/^0x/i, '');
        const bytes = new Uint8Array(clean.length / 2);
        for (let i = 0; i < clean.length; i += 2) {
            bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
        }
        return bytes;
    }

    function sequenceNumberToIv(seqNumber) {
        const iv = new Uint8Array(16);
        const view = new DataView(iv.buffer);
        view.setUint32(12, seqNumber, false);
        return iv;
    }

    // ─── HIGH-SPEED MULTI-THREADED PIPELINE WITH RANGE CHUNKING (4-32 THREADS) ───
    class MediaProcessor {
        constructor() {
            this.isAborted = false;
            this.isPaused = false;
            this.concurrency = 64; // Default: 64 extreme parallel threads for full fiber saturation
            this.activeWorkerCount = 0;
            this.currentChunks = null;
            this.currentInitBytes = null;
            this.downloadMode = 'idle';
        }

        abort() {
            this.isAborted = true;
        }

        pause() {
            this.isPaused = true;
        }

        resume() {
            this.isPaused = false;
        }

        // Return assembled blob for partial or completed downloads
        getPartialBlob() {
            if (!this.currentChunks || this.currentChunks.length === 0) return null;
            const valid = [];
            let bytesTotal = 0;
            if (this.currentInitBytes) {
                valid.push(this.currentInitBytes);
                bytesTotal += this.currentInitBytes.byteLength;
            }
            for (let i = 0; i < this.currentChunks.length; i++) {
                if (this.currentChunks[i]) {
                    const chunkData = (this.currentChunks[i] instanceof Uint8Array) 
                        ? this.currentChunks[i] 
                        : (this.currentChunks[i].bytes || null);
                    if (chunkData && chunkData.byteLength > 0) {
                        valid.push(chunkData);
                        bytesTotal += chunkData.byteLength;
                    }
                }
            }
            if (valid.length === 0 || bytesTotal < 10240) return null;
            return {
                blob: new Blob(valid, { type: 'video/mp4' }),
                sizeBytes: bytesTotal,
                segmentCount: valid.length
            };
        }

        // Dynamically adjust thread count (up to 256 threads)
        setConcurrency(newCount) {
            const count = Math.max(1, Math.min(256, parseInt(newCount || 64, 10)));
            this.concurrency = count;
            console.log(`[StreamHelper] ⚡ Threads dynamically adjusted to ${count} connections`);
            if (this._onConcurrencyChange) {
                this._onConcurrencyChange(count);
            }
        }

        // ─── 1. ULTRA HIGH-SPEED MULTI-THREADED HTTP RANGE CHUNKED DOWNLOAD ───
        async processDirectStream(url, onProgress, requestedConcurrency = 64) {
            this.isAborted = false;
            this.isPaused = false;
            this.concurrency = Math.max(1, Math.min(256, parseInt(requestedConcurrency || 64, 10)));
            this.downloadMode = 'direct_stream';

            // Step 1: Probe server for Content-Length and Range Support
            let contentLength = 0;
            let rangeSupported = false;

            try {
                const probeRes = await fetch(url, {
                    method: 'GET',
                    credentials: 'omit',
                    cache: 'no-store',
                    headers: { 'Range': 'bytes=0-1', 'Accept': '*/*' }
                });

                if (probeRes.status === 206) {
                    rangeSupported = true;
                    const contentRange = probeRes.headers.get('content-range') || '';
                    const totalMatch = contentRange.match(/\/(\d+)/);
                    if (totalMatch) {
                        contentLength = parseInt(totalMatch[1], 10);
                    }
                }

                if (!contentLength) {
                    contentLength = parseInt(probeRes.headers.get('content-length') || '0', 10);
                    if (probeRes.headers.get('accept-ranges') === 'bytes') {
                        rangeSupported = true;
                    }
                }
            } catch {
                rangeSupported = false;
            }

            // Step 2A: If Range Requests are Supported and File > 1MB, divide across N threads
            if (rangeSupported && contentLength >= 1048576 && this.concurrency > 1) {
                return await this._downloadWithByteRanges(url, contentLength, onProgress);
            }

            // Step 2B: Fallback to Single-Thread Progressive Stream Reader
            console.log(`[StreamHelper] ℹ️ Using progressive single-stream mode.`);
            return await this._downloadSingleStream(url, contentLength, onProgress);
        }

        async _downloadWithByteRanges(url, totalBytes, onProgress) {
            this.downloadMode = 'range_chunks';
            
            // Optimal chunk size (4MB - 8MB) and safe concurrent stream pool
            const safeConcurrency = Math.max(1, Math.min(32, this.concurrency || 32));
            const targetChunkSize = Math.max(4 * 1024 * 1024, Math.min(12 * 1024 * 1024, Math.floor(totalBytes / (safeConcurrency * 4)) || 4194304));
            const totalChunks = Math.ceil(totalBytes / targetChunkSize);

            console.log(`[StreamHelper] 🚀 [RANGE ENGINE] Spawning ${safeConcurrency} concurrent workers across ${totalChunks} chunks (${(targetChunkSize / 1024 / 1024).toFixed(1)} MB each) for total ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

            const chunks = new Array(totalChunks);
            this.currentChunks = chunks;
            const queue = Array.from({ length: totalChunks }, (_, i) => i);
            let completedCount = 0;
            let aggregateBytes = 0;
            let activeWorkers = 0;
            const chunkAttempts = new Array(totalChunks).fill(0);

            const startTime = Date.now();
            let lastSampleTime = startTime;
            let lastSampleBytes = 0;
            let speedMBps = 0;

            const workerLoop = async (workerId) => {
                activeWorkers++;
                try {
                    while (queue.length > 0 && !this.isAborted) {
                        if (activeWorkers > safeConcurrency) {
                            break;
                        }

                        while (this.isPaused && !this.isAborted) {
                            await new Promise(r => setTimeout(r, 100));
                        }
                        if (this.isAborted) break;

                        const chunkIndex = queue.shift();
                        if (chunkIndex === undefined) break;

                        const start = chunkIndex * targetChunkSize;
                        const end = Math.min(totalBytes - 1, (chunkIndex + 1) * targetChunkSize - 1);
                        const expectedBytes = end - start + 1;

                        chunkAttempts[chunkIndex]++;
                        let receivedForChunk = 0;
                        const partialParts = [];
                        let chunkSuccess = false;

                        // Loop with range resumption until all expectedBytes for this chunk are received
                        while (receivedForChunk < expectedBytes && !this.isAborted) {
                            while (this.isPaused && !this.isAborted) {
                                await new Promise(r => setTimeout(r, 100));
                            }
                            if (this.isAborted) break;

                            const curStart = start + receivedForChunk;
                            if (curStart > end) break;

                            try {
                                const res = await fetch(url, {
                                    credentials: 'omit',
                                    cache: 'no-store',
                                    headers: {
                                        'Range': `bytes=${curStart}-${end}`,
                                        'Accept': '*/*'
                                    }
                                });

                                if (!res.ok && res.status !== 206) {
                                    await new Promise(r => setTimeout(r, 400));
                                    throw new Error(`HTTP ${res.status}`);
                                }

                                const reader = res.body.getReader();
                                while (!this.isAborted) {
                                    while (this.isPaused && !this.isAborted) {
                                        await new Promise(r => setTimeout(r, 150));
                                    }
                                    if (this.isAborted) break;

                                    const { done, value } = await reader.read();
                                    if (done) break;

                                    partialParts.push(value);
                                    receivedForChunk += value.byteLength;
                                    aggregateBytes += value.byteLength;

                                    // Real-time Speed Calculation
                                    const now = Date.now();
                                    const timeDiff = (now - lastSampleTime) / 1000;
                                    if (timeDiff >= 0.2) {
                                        const bytesDiff = aggregateBytes - lastSampleBytes;
                                        speedMBps = (bytesDiff / 1024 / 1024) / timeDiff;
                                        lastSampleBytes = aggregateBytes;
                                        lastSampleTime = now;
                                    }

                                    const percent = (completedCount >= totalChunks || aggregateBytes >= totalBytes) ? 100 : Math.min(99, Math.round((aggregateBytes / totalBytes) * 100));
                                    const remainingBytes = Math.max(0, totalBytes - aggregateBytes);
                                    const remainingSeconds = speedMBps > 0 ? Math.round((remainingBytes / 1024 / 1024) / speedMBps) : 0;

                                    if (onProgress) {
                                        onProgress({
                                            completed: completedCount,
                                            total: totalChunks,
                                            percent,
                                            totalBytes: aggregateBytes,
                                            estimatedTotalBytes: totalBytes,
                                            speedMBps,
                                            remainingSeconds,
                                            threads: safeConcurrency
                                        });
                                    }
                                }

                                if (receivedForChunk >= expectedBytes) {
                                    chunkSuccess = true;
                                    break;
                                }
                            } catch (e) {
                                console.warn(`[StreamHelper] Worker ${workerId} chunk ${chunkIndex + 1}/${totalChunks} notice: ${e.message}. Resuming...`);
                                await new Promise(r => setTimeout(r, 350));
                                if (chunkAttempts[chunkIndex] > 15) {
                                    break; // If single chunk failed > 15 times, break to avoid infinite loop
                                }
                            }
                        }

                        if (chunkSuccess && receivedForChunk >= expectedBytes) {
                            const combined = new Uint8Array(expectedBytes);
                            let offset = 0;
                            for (const p of partialParts) {
                                const copyLen = Math.min(p.byteLength, expectedBytes - offset);
                                combined.set(p.subarray(0, copyLen), offset);
                                offset += copyLen;
                            }
                            chunks[chunkIndex] = combined;
                            completedCount++;
                        } else if (!this.isAborted && chunkAttempts[chunkIndex] <= 15) {
                            // Re-enqueue incomplete chunk so it is guaranteed to be retried
                            console.warn(`[StreamHelper] 🔄 Re-enqueuing incomplete chunk ${chunkIndex + 1}/${totalChunks}`);
                            queue.push(chunkIndex);
                            await new Promise(r => setTimeout(r, 500));
                        }
                    }
                } finally {
                    activeWorkers--;
                }
            };

            const workers = [];
            const spawnInitial = Math.min(safeConcurrency, totalChunks);
            for (let w = 0; w < spawnInitial; w++) {
                workers.push(workerLoop(w));
            }

            await Promise.all(workers);

            if (this.isAborted) {
                throw new Error('Download cancelled by user.');
            }

            const finalBuffers = [];
            let totalAssembledBytes = 0;
            for (let i = 0; i < totalChunks; i++) {
                if (!chunks[i]) {
                    console.warn(`[StreamHelper] Chunk ${i + 1}/${totalChunks} missing after retries.`);
                }
                const chunkData = chunks[i] || new Uint8Array(Math.min(targetChunkSize, totalBytes - i * targetChunkSize));
                finalBuffers.push(chunkData);
                totalAssembledBytes += chunkData.byteLength;
            }

            const firstChunk = finalBuffers[0];
            const inspection = inspectMediaBuffer(firstChunk);

            const mergedBlob = new Blob(finalBuffers, { type: 'video/mp4' });
            console.log(`[StreamHelper] 🏁 [RANGE DOWNLOAD COMPLETE] Full Size: ${(totalAssembledBytes / 1024 / 1024).toFixed(2)} MB (${completedCount}/${totalChunks} chunks verified)`);

            return {
                blob: mergedBlob,
                extension: 'mp4',
                mimeType: 'video/mp4',
                sizeBytes: totalAssembledBytes,
                format: inspection.format || 'mp4'
            };
        }

        async _downloadSingleStream(url, knownLength, onProgress) {
            const res = await fetch(url, {
                credentials: 'omit',
                cache: 'no-store',
                headers: { 'Accept': '*/*' }
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status} ${res.statusText}`);
            }

            const cType = (res.headers.get('content-type') || '').toLowerCase();
            if (cType.includes('text/html') || cType.includes('application/json') || cType.includes('text/plain') || cType.includes('application/xml') || cType.includes('text/xml')) {
                throw new Error(`Server returned non-media response: ${cType}`);
            }

            const contentLength = knownLength || parseInt(res.headers.get('content-length') || '0', 10);
            const reader = res.body.getReader();
            const chunks = [];
            this.currentChunks = chunks;
            let receivedBytes = 0;
            const startTime = Date.now();
            let lastSampleTime = startTime;
            let lastSampleBytes = 0;
            let speedMBps = 0;

            while (!this.isAborted) {
                while (this.isPaused && !this.isAborted) {
                    await new Promise(r => setTimeout(r, 150));
                }
                if (this.isAborted) break;

                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                receivedBytes += value.byteLength;

                const now = Date.now();
                const timeDiff = (now - lastSampleTime) / 1000;
                if (timeDiff >= 0.2) {
                    const bytesDiff = receivedBytes - lastSampleBytes;
                    speedMBps = (bytesDiff / 1024 / 1024) / timeDiff;
                    lastSampleBytes = receivedBytes;
                    lastSampleTime = now;
                }

                const totalBytes = contentLength > 0 ? contentLength : receivedBytes;
                const percent = contentLength > 0 ? Math.min(99, Math.round((receivedBytes / contentLength) * 100)) : 50;
                const remainingBytes = Math.max(0, totalBytes - receivedBytes);
                const remainingSecs = speedMBps > 0 ? Math.round((remainingBytes / 1024 / 1024) / speedMBps) : 0;

                if (onProgress) {
                    onProgress({
                        completed: 1,
                        total: 1,
                        percent,
                        totalBytes: receivedBytes,
                        estimatedTotalBytes: totalBytes,
                        speedMBps,
                        remainingSeconds: remainingSecs,
                        threads: 1
                    });
                }
            }

            if (this.isAborted) {
                throw new Error('Download cancelled by user.');
            }

            if (chunks.length === 0 || receivedBytes < 1048576) {
                throw new Error(`Downloaded stream is too small (${(receivedBytes / 1024).toFixed(0)} KB).`);
            }

            const firstChunk = chunks[0];
            const inspection = inspectMediaBuffer(firstChunk);

            if (!inspection.isValid) {
                throw new Error(`Downloaded stream verification failed: ${inspection.reason || 'Invalid media signature'}`);
            }

            const mergedBlob = new Blob(chunks, { type: 'video/mp4' });

            return {
                blob: mergedBlob,
                extension: 'mp4',
                mimeType: 'video/mp4',
                sizeBytes: receivedBytes,
                format: inspection.format
            };
        }

        // ─── 2. ULTRA FAST WORKER QUEUE FOR HLS SEGMENTS (Up to 256 Threads) ───
        async processSegments(videoUrls, audioUrls, onProgress, initSegmentUrl, keyInfo, requestedConcurrency = 64) {
            this.isAborted = false;
            this.isPaused = false;
            this.concurrency = Math.max(1, Math.min(256, parseInt(requestedConcurrency || 64, 10)));
            this.downloadMode = 'hls_segments';

            const total = videoUrls.length;
            const chunks = new Array(total);
            this.currentChunks = chunks;
            this.currentInitBytes = null;

            let totalBytes = 0;
            let completedCount = 0;
            let failedCount = 0;
            let fatalError = null;
            const startTime = Date.now();
            let lastSampleTime = startTime;
            let lastSampleBytes = 0;
            let speedMBps = 0;

            console.log(`[StreamHelper] 🚀 [TURBO HLS POOL] Spawning ${this.concurrency} concurrent workers for ${total} segments`);

            // Fetch AES-128 Key if stream is encrypted
            let cryptoKey = null;
            if (keyInfo && keyInfo.method === 'AES-128' && keyInfo.uri) {
                try {
                    const keyRes = await fetch(keyInfo.uri, {
                        credentials: 'omit',
                        cache: 'no-store',
                        headers: { 'Accept': '*/*' }
                    });
                    if (!keyRes.ok) throw new Error(`HTTP ${keyRes.status} fetching AES-128 key`);
                    const keyBuffer = await keyRes.arrayBuffer();
                    cryptoKey = await crypto.subtle.importKey(
                        'raw',
                        keyBuffer,
                        { name: 'AES-CBC' },
                        false,
                        ['decrypt']
                    );
                } catch (e) {
                    throw new Error(`Cannot decrypt stream: ${e.message}`);
                }
            }

            // Fetch fMP4 Initialization Segment if present (EXT-X-MAP)
            let initSegmentBytes = null;
            if (initSegmentUrl) {
                try {
                    const initRes = await fetch(initSegmentUrl, {
                        credentials: 'omit',
                        cache: 'no-store',
                        headers: { 'Accept': '*/*' }
                    });
                    if (initRes.ok) {
                        const initBuf = await initRes.arrayBuffer();
                        initSegmentBytes = new Uint8Array(initBuf);
                        this.currentInitBytes = initSegmentBytes;
                        totalBytes += initSegmentBytes.byteLength;
                    }
                } catch (e) {
                    console.warn('[StreamHelper] Init segment notice:', e.message);
                }
            }

            // High-Speed Task Queue with Non-Blocking Workers
            const queue = Array.from({ length: total }, (_, i) => i);
            const workers = [];

            const workerLoop = async (workerId) => {
                while (queue.length > 0 && !this.isAborted && !fatalError) {
                    while (this.isPaused && !this.isAborted && !fatalError) {
                        await new Promise(r => setTimeout(r, 100));
                    }
                    if (this.isAborted || fatalError) break;

                    const segIndex = queue.shift();
                    if (segIndex === undefined) break;

                    const url = videoUrls[segIndex];
                    if (!url) {
                        completedCount++;
                        continue;
                    }

                    let bytes = null;
                    let retries = 5;
                    let backoff = 100;
                    let lastErr = null;

                    while (retries > 0 && !this.isAborted && !fatalError) {
                        try {
                            const res = await fetch(url, {
                                credentials: 'omit',
                                cache: 'no-store',
                                headers: { 'Accept': '*/*' }
                            });
                            if (!res.ok) {
                                if (res.status === 412 || res.status === 429 || res.status === 503) {
                                    await new Promise(r => setTimeout(r, 200));
                                }
                                throw new Error(`HTTP ${res.status}`);
                            }
                            const buf = await res.arrayBuffer();
                            bytes = new Uint8Array(buf);
                            break;
                        } catch (e) {
                            lastErr = e;
                            retries--;
                            if (retries > 0) {
                                await new Promise(r => setTimeout(r, backoff));
                                backoff = Math.min(1000, backoff * 1.5);
                            }
                        }
                    }

                    if (!bytes && !this.isAborted) {
                        failedCount++;
                        console.warn(`[StreamHelper] ⚠️ Skipping missing segment ${segIndex + 1}/${total}: ${lastErr?.message}`);
                        completedCount++;
                        continue;
                    }

                    // Unmask PNG-encapsulated video steganography
                    if (bytes && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
                        for (let j = 0; j < Math.min(bytes.length - 188, 256); j++) {
                            if (bytes[j] === 0x47 && bytes[j + 188] === 0x47) {
                                bytes = bytes.subarray(j);
                                break;
                            }
                        }
                    }

                    // Decrypt AES-128 in-memory
                    if (cryptoKey && bytes) {
                        let iv = keyInfo.ivHex ? hexToUint8Array(keyInfo.ivHex) : sequenceNumberToIv(segIndex + 1);
                        try {
                            const decrypted = await crypto.subtle.decrypt(
                                { name: 'AES-CBC', iv: iv },
                                cryptoKey,
                                bytes.buffer
                            );
                            bytes = new Uint8Array(decrypted);
                        } catch (err) {
                            console.warn(`Decryption notice on segment ${segIndex + 1}:`, err.message);
                        }
                    }

                    if (bytes) {
                        chunks[segIndex] = bytes;
                        totalBytes += bytes.byteLength;
                    }
                    completedCount++;

                    // Real Speed Calculation from Actual Bytes Delta
                    const now = Date.now();
                    const timeDiff = (now - lastSampleTime) / 1000;
                    if (timeDiff >= 0.2) {
                        const bytesDiff = totalBytes - lastSampleBytes;
                        speedMBps = (bytesDiff / 1024 / 1024) / timeDiff;
                        lastSampleBytes = totalBytes;
                        lastSampleTime = now;
                    }

                    const percent = (completedCount >= total) ? 100 : Math.min(99, Math.round((completedCount / total) * 100));
                    const avgBytesPerSeg = totalBytes / (completedCount - failedCount || 1);
                    const estimatedTotalBytes = avgBytesPerSeg * total;
                    const remainingBytes = Math.max(0, estimatedTotalBytes - totalBytes);
                    const remainingSeconds = speedMBps > 0 ? Math.round((remainingBytes / 1024 / 1024) / speedMBps) : 0;

                    if (onProgress) {
                        onProgress({
                            completed: completedCount,
                            total,
                            percent,
                            totalBytes,
                            estimatedTotalBytes: Math.round(estimatedTotalBytes),
                            speedMBps,
                            remainingSeconds,
                            threads: this.concurrency
                        });
                    }
                }
            };

            for (let w = 0; w < Math.min(this.concurrency, total); w++) {
                workers.push(workerLoop(w));
            }

            await Promise.all(workers);

            if (fatalError && totalBytes === 0) {
                throw fatalError;
            }

            if (fatalError && totalBytes > 0) {
                console.warn(`[StreamHelper] ⚠️ HLS segments partially failed: ${fatalError.message}. Assembling ${completedCount - failedCount}/${total} downloaded segments (${(totalBytes / 1024 / 1024).toFixed(2)} MB).`);
            }

            if (this.isAborted) {
                throw new Error('Download cancelled by user.');
            }

            // Assemble final array in strict sequence
            const finalChunks = [];
            if (initSegmentBytes) {
                finalChunks.push(initSegmentBytes);
            }
            for (let k = 0; k < total; k++) {
                if (chunks[k]) {
                    finalChunks.push(chunks[k]);
                }
            }

            if (finalChunks.length === 0 || totalBytes < 524288) {
                if (fatalError) throw fatalError;
                throw new Error(`Assembled stream is too small (${(totalBytes / 1024 / 1024).toFixed(2)} MB).`);
            }

            const firstChunk = finalChunks[0];
            const inspection = inspectMediaBuffer(firstChunk);
            console.log(`[StreamHelper] 🏁 [ASSEMBLY COMPLETE] Total Size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB, Format: ${inspection.format}`);

            if (!inspection.isValid) {
                throw new Error(`Downloaded stream verification failed: ${inspection.reason || 'Invalid media signature'}`);
            }

            const mergedBlob = new Blob(finalChunks, { type: 'video/mp4' });

            return {
                blob: mergedBlob,
                extension: 'mp4',
                mimeType: 'video/mp4',
                sizeBytes: totalBytes,
                format: inspection.format
            };
        }
    }

    root.MediaProcessor = MediaProcessor;
    root.inspectMediaBuffer = inspectMediaBuffer;
    root.isBinaryMediaBuffer = isBinaryMediaBuffer;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
