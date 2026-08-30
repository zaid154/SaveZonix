// hls-fetcher.js — Modular HLS/M3U8 Parser, DRM Detector & Segment Assembler

export class HlsFetcher {
    constructor() {
        this.isAborted = false;
    }

    abort() {
        this.isAborted = true;
    }

    async parseManifest(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch manifest (HTTP ${response.status})`);
        }

        const text = await response.text();
        const baseUri = new URL(url);

        // Check for DRM encryption tags
        if (text.includes('#EXT-X-KEY:METHOD=SAMPLE-AES') || 
            text.includes('KEYFORMAT="com.widevine') || 
            text.includes('KEYFORMAT="com.apple.fps') ||
            text.includes('urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed')) {
            return {
                isDrmProtected: true,
                error: 'Download unavailable: Stream is DRM encrypted.'
            };
        }

        if (text.includes('#EXT-X-STREAM-INF')) {
            const variants = this.parseMasterPlaylist(text, baseUri);
            return {
                isMaster: true,
                isDrmProtected: false,
                variants: variants
            };
        } else {
            const segments = this.parseMediaPlaylist(text, baseUri);
            return {
                isMaster: false,
                isDrmProtected: false,
                segments: segments
            };
        }
    }

    parseMasterPlaylist(content, baseUri) {
        const variants = [];
        const lines = content.split(/\r?\n/);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#EXT-X-STREAM-INF')) {
                let resolution = 'Auto';
                let bandwidth = 0;

                const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
                if (resMatch) resolution = resMatch[1];

                const bwMatch = line.match(/BANDWIDTH=(\d+)/);
                if (bwMatch) bandwidth = parseInt(bwMatch[1], 10);

                for (let j = i + 1; j < lines.length; j++) {
                    const next = lines[j].trim();
                    if (next && !next.startsWith('#')) {
                        const variantUrl = new URL(next, baseUri).href;
                        variants.push({
                            resolution: resolution,
                            bandwidth: bandwidth,
                            label: resolution !== 'Auto' ? `${resolution} (${Math.round(bandwidth / 1000)} kbps)` : `${Math.round(bandwidth / 1000)} kbps`,
                            url: variantUrl
                        });
                        i = j;
                        break;
                    }
                }
            }
        }

        return variants.sort((a, b) => b.bandwidth - a.bandwidth);
    }

    parseMediaPlaylist(content, baseUri) {
        const segments = [];
        const lines = content.split(/\r?\n/);

        // Check for init segment (#EXT-X-MAP)
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#EXT-X-MAP')) {
                const uriMatch = trimmed.match(/URI="([^"]+)"/);
                if (uriMatch) {
                    segments.push(new URL(uriMatch[1], baseUri).href);
                }
            }
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#EXTINF')) {
                for (let j = i + 1; j < lines.length; j++) {
                    const next = lines[j].trim();
                    if (next && !next.startsWith('#')) {
                        segments.push(new URL(next, baseUri).href);
                        i = j;
                        break;
                    }
                }
            } else if (!line.startsWith('#') && (line.includes('.ts') || line.includes('.m4s') || line.includes('.mp4'))) {
                segments.push(new URL(line, baseUri).href);
            }
        }

        return [...new Set(segments)];
    }

    async downloadAndAssemble(segmentUrls, onProgress) {
        this.isAborted = false;
        const total = segmentUrls.length;
        const downloadedBuffers = new Array(total);
        let completed = 0;
        let totalBytes = 0;

        const concurrency = 6;
        let currentIndex = 0;

        const worker = async () => {
            while (currentIndex < total && !this.isAborted) {
                const index = currentIndex++;
                const url = segmentUrls[index];

                let attempts = 0;
                let success = false;

                while (attempts < 3 && !success && !this.isAborted) {
                    try {
                        attempts++;
                        const res = await fetch(url);
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);

                        const buffer = await res.arrayBuffer();
                        downloadedBuffers[index] = buffer;
                        totalBytes += buffer.byteLength;
                        completed++;
                        success = true;

                        if (onProgress) {
                            onProgress({
                                completed: completed,
                                total: total,
                                percent: Math.round((completed / total) * 100),
                                totalBytes: totalBytes
                            });
                        }
                    } catch (err) {
                        if (attempts < 3 && !this.isAborted) {
                            await new Promise(r => setTimeout(r, 400 * attempts));
                        }
                    }
                }

                if (!success && !this.isAborted) {
                    throw new Error(`Failed to download segment ${index + 1} of ${total}.`);
                }
            }
        };

        const workers = [];
        for (let i = 0; i < Math.min(concurrency, total); i++) {
            workers.push(worker());
        }

        await Promise.all(workers);

        if (this.isAborted) {
            throw new Error('Download aborted by user.');
        }

        // Detect container type based on first segment signature
        const isFmp4 = downloadedBuffers[0] && this.isFmp4Segment(downloadedBuffers[0]);
        const mimeType = isFmp4 ? 'video/mp4' : 'video/MP2T';
        const extension = isFmp4 ? 'mp4' : 'ts';

        const mergedBlob = new Blob(downloadedBuffers, { type: mimeType });
        return {
            blob: mergedBlob,
            extension: extension,
            sizeBytes: totalBytes
        };
    }

    isFmp4Segment(buffer) {
        if (buffer.byteLength < 8) return false;
        const view = new DataView(buffer);
        // Look for 'ftyp' or 'moof' box header
        const tag = String.fromCharCode(view.getUint8(4), view.getUint8(5), view.getUint8(6), view.getUint8(7));
        return tag === 'ftyp' || tag === 'moof' || tag === 'styp';
    }
}
