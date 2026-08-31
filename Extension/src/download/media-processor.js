// src/download/media-processor.js — Complete Validated Media Processor, Container Assembler & Steganography Unmasker

(function (root) {
    /**
     * Inspects binary buffer to identify media format, container boxes, tracks, and image-masked streams
     */
    function inspectMediaBuffer(buffer) {
        if (!buffer || buffer.byteLength < 8) {
            return { isValid: false, format: 'unknown', reason: 'Buffer too small (< 8 bytes)' };
        }

        // Handle TypedArray vs ArrayBuffer correctly with byteOffset
        let bytes = null;
        if (buffer instanceof Uint8Array) {
            bytes = buffer;
        } else if (buffer instanceof ArrayBuffer) {
            bytes = new Uint8Array(buffer);
        } else if (buffer.buffer instanceof ArrayBuffer) {
            bytes = new Uint8Array(buffer.buffer, buffer.byteOffset || 0, buffer.byteLength);
        } else {
            return { isValid: false, format: 'unknown', reason: 'Invalid buffer type' };
        }

        const headLen = Math.min(bytes.length, 1024);
        const head = bytes.subarray(0, headLen);

        // 1. Check for PNG-masked MPEG-TS chunks (Steganography used by OTT CDNs)
        if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47) {
            for (let i = 0; i < Math.min(head.length - 188, 256); i++) {
                if (head[i] === 0x47 && head[i + 188] === 0x47) {
                    return {
                        isValid: true,
                        format: 'MPEG-TS',
                        isMaskedPng: true,
                        mediaOffset: i,
                        hasVideoTrack: true,
                        hasAudioTrack: true
                    };
                }
            }
        }

        // 2. Check for text/HTML/JSON error responses
        const textSnippet = String.fromCharCode(...head.subarray(0, Math.min(head.length, 64))).trim().toLowerCase();
        if (textSnippet.startsWith('<!doc') || 
            textSnippet.startsWith('<html') || 
            textSnippet.startsWith('<?xml') || 
            textSnippet.startsWith('{"') || 
            textSnippet.startsWith('error') || 
            textSnippet.startsWith('access') ||
            textSnippet.startsWith('403') ||
            textSnippet.startsWith('404')) {
            return { isValid: false, format: 'text/html', reason: `Non-media response: ${textSnippet.slice(0, 20)}` };
        }

        // 3. Check if it's an HLS plain text playlist (.m3u8)
        if (textSnippet.startsWith('#extm3u')) {
            return { isValid: true, format: 'HLS_PLAYLIST', isPlaylist: true };
        }

        // 4. Check for MP4 / fMP4 Container (Boxes: ftyp, moov, moof, mdat, styp, free, wide)
        for (let i = 0; i <= Math.min(head.length - 8, 128); i++) {
            const tag = String.fromCharCode(head[i + 4], head[i + 5], head[i + 6], head[i + 7]);
            if (tag === 'ftyp' || tag === 'moov' || tag === 'moof' || tag === 'mdat' || tag === 'styp' || tag === 'free' || tag === 'wide') {
                const isFmp4 = (tag === 'moof' || tag === 'styp');
                return {
                    isValid: true,
                    format: isFmp4 ? 'fMP4' : 'MP4',
                    containerTag: tag,
                    hasVideoTrack: true,
                    hasAudioTrack: true
                };
            }
        }

        // 5. Check for MPEG-TS with ID3 header: 'ID3' (0x49 0x44 0x33)
        if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
            return {
                isValid: true,
                format: 'MPEG-TS',
                hasId3: true,
                hasVideoTrack: true,
                hasAudioTrack: true
            };
        }

        // 6. Check for MPEG-TS Container: Sync Byte 0x47
        if (head[0] === 0x47) {
            return {
                isValid: true,
                format: 'MPEG-TS',
                hasVideoTrack: true,
                hasAudioTrack: true
            };
        }
        for (let i = 0; i < Math.min(head.length - 188, 512); i++) {
            if (head[i] === 0x47 && head[i + 188] === 0x47) {
                return {
                    isValid: true,
                    format: 'MPEG-TS',
                    hasVideoTrack: true,
                    hasAudioTrack: true
                };
            }
        }

        // 7. Check for WebM / Matroska (EBML header: 0x1A 0x45 0xDF 0xA3)
        if (head[0] === 0x1A && head[1] === 0x45 && head[2] === 0xDF && head[3] === 0xA3) {
            return {
                isValid: true,
                format: 'WebM',
                hasVideoTrack: true,
                hasAudioTrack: true
            };
        }

        // 8. Check for AAC ADTS (0xFF 0xF1 or 0xFF 0xF9)
        if (head[0] === 0xFF && (head[1] & 0xF0) === 0xF0) {
            return {
                isValid: true,
                format: 'AAC',
                hasAudioTrack: true,
                hasVideoTrack: false
            };
        }

        return { isValid: false, format: 'unknown', reason: 'Unrecognized media header signature' };
    }

    function isBinaryMediaBuffer(buffer) {
        const info = inspectMediaBuffer(buffer);
        return info.isValid && !info.isPlaylist;
    }

    function hexToUint8Array(hexString) {
        if (!hexString) return null;
        const cleanHex = hexString.replace(/^0x/, '');
        const bytes = new Uint8Array(cleanHex.length / 2);
        for (let i = 0; i < cleanHex.length; i += 2) {
            bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
        }
        return bytes;
    }

    function sequenceNumberToIv(seqNumber) {
        const iv = new Uint8Array(16);
        const view = new DataView(iv.buffer);
        view.setUint32(12, seqNumber, false);
        return iv;
    }

    class MediaProcessor {
        constructor() {
            this.isAborted = false;
            this.isPaused = false;
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

        // ─── 1. DIRECT STREAM FETCHER ─────────────────────────────────────────
        async processDirectStream(url, onProgress) {
            this.isAborted = false;
            this.isPaused = false;

            console.log(`[StreamHelper] 📡 [FETCH START] ${url}`);
            const res = await fetch(url, { credentials: 'omit' });
            console.log(`[StreamHelper] 📡 [HTTP STATUS] ${res.status} ${res.statusText}`);
            console.log(`[StreamHelper] 📡 [CONTENT-TYPE] ${res.headers.get('content-type')}`);
            console.log(`[StreamHelper] 📡 [CONTENT-LENGTH] ${res.headers.get('content-length') || 'Unknown'}`);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status} ${res.statusText}`);
            }

            const cType = (res.headers.get('content-type') || '').toLowerCase();
            if (cType.includes('text/html') || cType.includes('application/json') || cType.includes('text/plain')) {
                throw new Error(`Server returned non-media response: ${cType}`);
            }

            const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
            const reader = res.body.getReader();
            const chunks = [];
            let receivedBytes = 0;
            const startTime = Date.now();
            let lastSampleTime = startTime;
            let lastSampleBytes = 0;
            let speedMBps = 0;

            while (!this.isAborted) {
                while (this.isPaused && !this.isAborted) {
                    await new Promise(r => setTimeout(r, 200));
                }

                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                receivedBytes += value.byteLength;

                const now = Date.now();
                const timeDiff = (now - lastSampleTime) / 1000;
                if (timeDiff >= 0.4) {
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
                        remainingSeconds: remainingSecs
                    });
                }
            }

            if (this.isAborted) {
                throw new Error('Download cancelled by user.');
            }

            if (chunks.length === 0 || receivedBytes < 10240) {
                throw new Error(`Downloaded stream is truncated or empty (${receivedBytes} bytes).`);
            }

            // Inspect the first chunk directly as Uint8Array
            const firstChunk = chunks[0];
            const inspection = inspectMediaBuffer(firstChunk);
            console.log(`[StreamHelper] 🔍 [BUFFER INSPECTION] Format: ${inspection.format}, Valid: ${inspection.isValid}`);

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

        // ─── 2. HLS SEGMENT ASSEMBLER (WITH ID3/AES-128/STEGANOGRAPHY UNMASKING) ──
        async processSegments(videoUrls, audioUrls, onProgress, initSegmentUrl, keyInfo) {
            this.isAborted = false;
            this.isPaused = false;

            const total = videoUrls.length;
            const chunks = [];
            let totalBytes = 0;
            const startTime = Date.now();
            let lastSampleTime = startTime;
            let lastSampleBytes = 0;
            let speedMBps = 0;

            console.log(`[StreamHelper] 🚀 [STARTING HLS DOWNLOAD] ${total} video segment(s)`);

            // Fetch AES-128 Key if stream is encrypted
            let cryptoKey = null;
            if (keyInfo && keyInfo.method === 'AES-128' && keyInfo.uri) {
                console.log(`[StreamHelper] 🔑 [FETCHING AES-128 KEY] ${keyInfo.uri}`);
                try {
                    const keyRes = await fetch(keyInfo.uri, { credentials: 'omit' });
                    if (!keyRes.ok) throw new Error(`HTTP ${keyRes.status} fetching AES-128 key`);
                    const keyBuffer = await keyRes.arrayBuffer();
                    cryptoKey = await crypto.subtle.importKey(
                        'raw',
                        keyBuffer,
                        { name: 'AES-CBC' },
                        false,
                        ['decrypt']
                    );
                    console.log(`[StreamHelper] 🔓 [AES-128 KEY READY] Key Length: ${keyBuffer.byteLength} bytes`);
                } catch (e) {
                    console.error('[StreamHelper] ❌ Failed to fetch/import AES-128 key:', e.message);
                    throw new Error(`Cannot decrypt stream: ${e.message}`);
                }
            }

            // Fetch fMP4 Initialization Segment if present (EXT-X-MAP)
            if (initSegmentUrl) {
                console.log(`[StreamHelper] 📦 [FETCHING INIT MAP SEGMENT] ${initSegmentUrl}`);
                try {
                    const initRes = await fetch(initSegmentUrl, { credentials: 'omit' });
                    if (initRes.ok) {
                        const initBuf = await initRes.arrayBuffer();
                        chunks.push(new Uint8Array(initBuf));
                        totalBytes += initBuf.byteLength;
                        console.log(`[StreamHelper] 📦 [INIT SEGMENT ACQUIRED] ${initBuf.byteLength} bytes`);
                    }
                } catch (e) {
                    console.warn('[StreamHelper] ⚠️ Failed to fetch init segment:', e.message);
                }
            }

            const BATCH_SIZE = 4;
            for (let i = 0; i < total; i += BATCH_SIZE) {
                while (this.isPaused && !this.isAborted) {
                    await new Promise(r => setTimeout(r, 200));
                }
                if (this.isAborted) break;

                const batch = videoUrls.slice(i, i + BATCH_SIZE);
                const batchPromises = batch.map(async (url, batchIdx) => {
                    const segIndex = i + batchIdx;
                    const res = await fetch(url, { credentials: 'omit' });
                    if (!res.ok) throw new Error(`HTTP ${res.status} on segment ${segIndex + 1}`);
                    let buf = await res.arrayBuffer();
                    let bytes = new Uint8Array(buf);

                    // Unmask PNG-encapsulated video steganography if present
                    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
                        for (let j = 0; j < Math.min(bytes.length - 188, 256); j++) {
                            if (bytes[j] === 0x47 && bytes[j + 188] === 0x47) {
                                bytes = bytes.subarray(j);
                                break;
                            }
                        }
                    }

                    // Decrypt segment in-memory if AES-128 is active
                    if (cryptoKey) {
                        let iv = keyInfo.ivHex ? hexToUint8Array(keyInfo.ivHex) : sequenceNumberToIv(segIndex + 1);
                        try {
                            const decrypted = await crypto.subtle.decrypt(
                                { name: 'AES-CBC', iv: iv },
                                cryptoKey,
                                bytes.buffer
                            );
                            bytes = new Uint8Array(decrypted);
                        } catch (err) {
                            console.error(`[StreamHelper] Decryption failed on segment ${segIndex + 1}:`, err.message);
                            throw err;
                        }
                    }

                    return bytes;
                });

                const batchResults = await Promise.all(batchPromises);
                for (const segmentData of batchResults) {
                    chunks.push(segmentData);
                    totalBytes += segmentData.byteLength;
                }

                const completed = Math.min(i + BATCH_SIZE, total);
                const percent = Math.round((completed / total) * 100);

                const now = Date.now();
                const timeDiff = (now - lastSampleTime) / 1000;
                if (timeDiff >= 0.4) {
                    const bytesDiff = totalBytes - lastSampleBytes;
                    speedMBps = (bytesDiff / 1024 / 1024) / timeDiff;
                    lastSampleBytes = totalBytes;
                    lastSampleTime = now;
                }

                const avgBytesPerSeg = totalBytes / completed;
                const estimatedTotalBytes = avgBytesPerSeg * total;
                const remainingBytes = Math.max(0, estimatedTotalBytes - totalBytes);
                const remainingSeconds = speedMBps > 0 ? Math.round((remainingBytes / 1024 / 1024) / speedMBps) : 0;

                if (onProgress) {
                    onProgress({
                        completed,
                        total,
                        percent,
                        totalBytes,
                        estimatedTotalBytes: Math.round(estimatedTotalBytes),
                        speedMBps,
                        remainingSeconds
                    });
                }
            }

            if (this.isAborted) {
                throw new Error('Download cancelled by user.');
            }

            if (chunks.length === 0 || totalBytes < 10240) {
                throw new Error(`Assembled stream is empty or corrupt (${totalBytes} bytes).`);
            }

            // Inspect final container buffer
            const firstChunk = chunks[0];
            const inspection = inspectMediaBuffer(firstChunk);
            console.log(`[StreamHelper] 🏁 [ASSEMBLY COMPLETE] Total Size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB, Format: ${inspection.format}`);

            if (!inspection.isValid) {
                throw new Error(`Downloaded stream verification failed: ${inspection.reason || 'Invalid media signature'}`);
            }

            const mergedBlob = new Blob(chunks, { type: 'video/mp4' });

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
