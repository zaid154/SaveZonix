// src/detectors/stream-detector.js â HLS & DASH Stream Analyzer with Token-Preserving Resolution (Universal)

(function (root) {
    const manifestCache = new Map();

    const StreamDetector = {
        resolveSegmentUrl(relativeOrAbsoluteUrl, parentPlaylistUrl) {
            try {
                if (!relativeOrAbsoluteUrl) return '';
                
                const parentUrlObj = parentPlaylistUrl ? new URL(parentPlaylistUrl) : null;
                let resolved = (relativeOrAbsoluteUrl.startsWith('http://') || relativeOrAbsoluteUrl.startsWith('https://'))
                    ? new URL(relativeOrAbsoluteUrl)
                    : new URL(relativeOrAbsoluteUrl, parentPlaylistUrl);

                // Strictly inherit and merge parent security tokens & signature query params for CDN authorization
                if (parentUrlObj && parentUrlObj.search) {
                    const parentParams = new URLSearchParams(parentUrlObj.search);
                    const resolvedParams = new URLSearchParams(resolved.search);
                    for (const [k, v] of parentParams.entries()) {
                        if (!resolvedParams.has(k)) {
                            resolvedParams.set(k, v);
                        }
                    }
                    const qStr = resolvedParams.toString();
                    if (qStr) {
                        resolved.search = '?' + qStr;
                    }
                }

                return resolved.href;
            } catch {
                return relativeOrAbsoluteUrl;
            }
        },

        getResolutionHeight(resolutionStr) {
            if (!resolutionStr || !resolutionStr.includes('x')) return 0;
            const parts = resolutionStr.split('x');
            return parseInt(parts[1], 10) || 0;
        },

        formatQualityLabel(resolution, bandwidth) {
            const height = this.getResolutionHeight(resolution);
            let tier = '';

            if (height >= 2160) tier = '2160p 4K';
            else if (height >= 1440) tier = '1440p 2K';
            else if (height >= 1080) tier = '1080p Full HD';
            else if (height >= 720) tier = '720p HD';
            else if (height >= 480) tier = '480p';
            else if (height >= 360) tier = '360p';
            else if (height > 0) tier = `${height}p`;
            else tier = 'Original Quality';

            let bwText = '';
            if (bandwidth > 0) {
                bwText = bandwidth >= 1000000 
                    ? `${(bandwidth / 1000000).toFixed(1)} Mbps` 
                    : `${Math.round(bandwidth / 1000)} kbps`;
            }

            return bwText ? `${tier} â¢ ${bwText}` : tier;
        },

        async parseHls(url, tabId) {
            const cached = manifestCache.get(url);
            if (cached && (Date.now() - cached.time < 120000)) {
                return cached.data;
            }

            let text = '';
            let isOk = false;

            // 1. First attempt direct fetch
            try {
                const res = await fetch(url, { credentials: 'omit' });
                if (res.ok) {
                    text = await res.text();
                    isOk = true;
                }
            } catch { }

            // 2. If direct fetch returned XML AccessDenied or failed, fallback to in-tab context fetch
            const trimmedInitial = text.slice(0, 100).trim().toLowerCase();
            if (!isOk || trimmedInitial.startsWith('<?xml') || trimmedInitial.startsWith('<!doc') || trimmedInitial.startsWith('<html')) {
                if (tabId && chrome.tabs && chrome.tabs.sendMessage) {
                    try {
                        const tabRes = await new Promise((resolve) => {
                            chrome.tabs.sendMessage(tabId, { action: 'fetchInTabContext', url: url }, (r) => {
                                if (chrome.runtime.lastError || !r) resolve(null);
                                else resolve(r);
                            });
                        });

                        if (tabRes && tabRes.success && tabRes.text) {
                            text = tabRes.text;
                            isOk = true;
                        }
                    } catch { }
                }
            }

            if (!text) {
                throw new Error('Failed to reach stream manifest');
            }

            const trimmedHead = text.slice(0, 100).trim().toLowerCase();

            // 3. Detect and Validate DASH XML Manifests (<MPD)
            if (text.includes('<MPD') || text.includes('urn:mpeg:dash')) {
                const hasDrm = text.includes('<ContentProtection') || 
                               text.includes('urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed') || 
                               text.includes('urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95');
                if (hasDrm) {
                    const drmResult = { isDrmProtected: true, isInvalid: false, error: 'DRM-protected DASH stream (download unavailable).' };
                    manifestCache.set(url, { data: drmResult, time: Date.now() });
                    return drmResult;
                }
            }

            // 4. Reject Non-Media XML / HTML / JSON Responses
            if (trimmedHead.startsWith('<!doc') || 
                trimmedHead.startsWith('<html') || 
                (trimmedHead.startsWith('<?xml') && !text.includes('<MPD')) || 
                trimmedHead.startsWith('{"') ||
                trimmedHead.startsWith('<error')) {
                const invalidResult = { isInvalid: true, isDrmProtected: false, error: 'Endpoint returned a non-media document (XML/HTML/JSON).' };
                return invalidResult;
            }

            // 5. Precise DRM Check in HLS: Widevine, FairPlay, PlayReady, Sample-AES
            const hasDrmKeys = text.includes('KEYFORMAT="com.widevine') || 
                               text.includes('KEYFORMAT="com.apple.fps') || 
                               text.includes('KEYFORMAT="com.microsoft.playready') ||
                               text.includes('urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed') ||
                               text.includes('urn:uuid:9a04f079-9840-4286-ab92-e65be0885f95') ||
                               text.includes('#EXT-X-KEY:METHOD=SAMPLE-AES');

            if (hasDrmKeys) {
                const drmResult = { isDrmProtected: true, isInvalid: false, error: 'DRM-protected stream (download unavailable).' };
                manifestCache.set(url, { data: drmResult, time: Date.now() });
                return drmResult;
            }

            let result = null;

            // 6. HLS MASTER PLAYLIST
            if (text.includes('#EXT-X-STREAM-INF')) {
                const variants = [];
                const audioTracks = [];
                const lines = text.split(/\r?\n/);

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
                        const groupMatch = trimmed.match(/GROUP-ID="([^"]+)"/);
                        const nameMatch = trimmed.match(/NAME="([^"]+)"/);
                        const uriMatch = trimmed.match(/URI="([^"]+)"/);
                        if (groupMatch && uriMatch) {
                            audioTracks.push({
                                groupId: groupMatch[1],
                                name: nameMatch ? nameMatch[1] : 'Audio',
                                url: this.resolveSegmentUrl(uriMatch[1], url)
                            });
                        }
                    }
                }

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.startsWith('#EXT-X-STREAM-INF')) {
                        let resolution = '';
                        let bandwidth = 0;
                        let audioGroup = '';

                        const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
                        if (resMatch) resolution = resMatch[1];

                        const bwMatch = line.match(/BANDWIDTH=(\d+)/);
                        if (bwMatch) bandwidth = parseInt(bwMatch[1], 10);

                        const audioMatch = line.match(/AUDIO="([^"]+)"/);
                        if (audioMatch) audioGroup = audioMatch[1];

                        for (let j = i + 1; j < lines.length; j++) {
                            const next = lines[j].trim();
                            if (next && !next.startsWith('#')) {
                                const variantUrl = this.resolveSegmentUrl(next, url);
                                variants.push({
                                    url: variantUrl,
                                    resolution: resolution,
                                    bandwidth: bandwidth,
                                    audioGroup: audioGroup,
                                    label: this.formatQualityLabel(resolution, bandwidth),
                                    height: this.getResolutionHeight(resolution)
                                });
                                i = j;
                                break;
                            }
                        }
                    }
                }

                variants.sort((a, b) => {
                    if (b.height !== a.height) return b.height - a.height;
                    return b.bandwidth - a.bandwidth;
                });

                result = {
                    isMaster: true,
                    isDrmProtected: false,
                    isInvalid: false,
                    variants,
                    bestVariant: variants[0] || null,
                    audioTracks
                };
            } 
            // 7. HLS MEDIA PLAYLIST (With AES-128 & fMP4 Init Segment Support)
            else if (text.includes('#EXTM3U') || text.includes('#EXTINF')) {
                const segments = [];
                let initSegmentUrl = '';
                let keyInfo = null;
                let totalDurationSeconds = 0;
                const lines = text.split(/\r?\n/);

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();

                    // Parse Standard AES-128 Encryption Key
                    if (line.startsWith('#EXT-X-KEY:')) {
                        const methodMatch = line.match(/METHOD=([^,]+)/);
                        const uriMatch = line.match(/URI="([^"]+)"/);
                        const ivMatch = line.match(/IV=0x([0-9a-fA-F]+)/i);

                        if (methodMatch && methodMatch[1] === 'AES-128' && uriMatch) {
                            keyInfo = {
                                method: 'AES-128',
                                uri: this.resolveSegmentUrl(uriMatch[1], url),
                                ivHex: ivMatch ? ivMatch[1] : null
                            };
                        }
                    }
                    // Parse fMP4 Initialization Segment (ftyp + moov atoms)
                    else if (line.startsWith('#EXT-X-MAP:')) {
                        const uriMatch = line.match(/URI="([^"]+)"/);
                        if (uriMatch) {
                            initSegmentUrl = this.resolveSegmentUrl(uriMatch[1], url);
                        }
                    } else if (line.startsWith('#EXTINF')) {
                        const durMatch = line.match(/#EXTINF:([\d.]+)/);
                        if (durMatch) {
                            totalDurationSeconds += parseFloat(durMatch[1]);
                        }
                        for (let j = i + 1; j < lines.length; j++) {
                            const next = lines[j].trim();
                            if (next && !next.startsWith('#')) {
                                segments.push(this.resolveSegmentUrl(next, url));
                                i = j;
                                break;
                            }
                        }
                    } else if (!line.startsWith('#') && (line.includes('.ts') || line.includes('.m4s') || line.includes('.mp4') || line.includes('.image') || line.includes('/segment') || line.includes('/chunk'))) {
                        segments.push(this.resolveSegmentUrl(line, url));
                    }
                }

                result = {
                    isMaster: false,
                    isDrmProtected: false,
                    isInvalid: false,
                    initSegmentUrl: initSegmentUrl,
                    keyInfo: keyInfo,
                    segments: [...new Set(segments)],
                    durationSeconds: Math.round(totalDurationSeconds),
                    variants: []
                };
            } else {
                result = {
                    isMaster: false,
                    isDrmProtected: false,
                    isInvalid: true,
                    error: 'Document is not a valid HLS playlist or media stream.'
                };
            }

            manifestCache.set(url, { data: result, time: Date.now() });
            return result;
        }
    };

    root.StreamDetector = StreamDetector;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
