// src/sites/generic.js — Universal Streaming Site Adapter (Non-DRM HLS/MP4 Stream Sniffer)

(function (root) {
    function isValidMediaStreamUrl(url) {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
        if (root.isInvalidStreamUrl && root.isInvalidStreamUrl(url)) return false;
        
        const clean = url.split('?')[0].replace(/\/+$/, '').toLowerCase();
        return clean.endsWith('.m3u8') || 
               clean.endsWith('.mp4') || 
               clean.endsWith('.webm') || 
               clean.endsWith('.m4v') || 
               clean.endsWith('.mpd') || 
               clean.includes('/get_file/') ||
               url.includes('.m3u8') || 
               url.includes('/hls/') || 
               url.includes('.mpd');
    }

    const GenericAdapter = {
        name: 'Stream',

        matches() {
            return true;
        },

        extractMetadata() {
            let playerTitle = '';
            let playerThumb = '';
            try {
                const scripts = document.querySelectorAll('script:not([src])');
                for (const s of scripts) {
                    const txt = s.textContent || '';
                    if (!playerTitle) {
                        const tm = txt.match(/html5player\.setVideoTitle\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
                        if (tm) playerTitle = tm[1].trim();
                    }
                    if (!playerThumb) {
                        const thm = txt.match(/html5player\.setThumbUrl(?:169)?\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
                        if (thm) playerThumb = thm[1].trim();
                    }
                    if (playerTitle && playerThumb) break;
                }
            } catch { }

            if (typeof root.extractPageMetadata === 'function') {
                const meta = root.extractPageMetadata();
                const thumb = playerThumb || (typeof root.extractBestThumbnail === 'function' ? root.extractBestThumbnail(document.querySelector('video')) : '');
                return {
                    platform: meta.platform || 'Stream',
                    showName: meta.showName,
                    subtitle: meta.subtitle,
                    title: playerTitle || meta.title,
                    season: meta.season,
                    episode: meta.episode,
                    episodeTitle: meta.episodeTitle,
                    thumbnail: thumb
                };
            }

            const title = playerTitle || (document.title || 'Video').replace(/^Watch\s+/i, '').replace(/[-|–—].*$/, '').trim();
            return {
                platform: 'Stream',
                showName: title || 'Video',
                subtitle: '',
                title: title || 'Video',
                thumbnail: playerThumb || ''
            };
        },

        findStreams(meta) {
            const streams = [];
            const seen = new Set();

            // 0. Inspect XNXX / XVideos player API scripts (HLS 1080p Master & High MP4)
            try {
                const scripts = document.querySelectorAll('script:not([src])');
                for (const s of scripts) {
                    const text = s.textContent || '';
                    if (text.includes('html5player.setVideoHLS') || text.includes('html5player.setVideoUrlHigh')) {
                        const mHls = text.match(/html5player\.setVideoHLS\s*\(\s*['"]([^'"]+)['"]/i);
                        const mHigh = text.match(/html5player\.setVideoUrlHigh\s*\(\s*['"]([^'"]+)['"]/i);
                        const mLow = text.match(/html5player\.setVideoUrlLow\s*\(\s*['"]([^'"]+)['"]/i);

                        if (mHls && mHls[1]) {
                            const clean = mHls[1].replace(/\\\//g, '/').replace(/['"]/g, '');
                            if (clean.startsWith('http') && !seen.has(clean)) {
                                seen.add(clean);
                                streams.push({
                                    url: clean,
                                    quality: '1080p Full HD',
                                    format: 'HLS',
                                    duration: meta.duration || '',
                                    thumbnail: meta.thumbnail,
                                    platform: meta.platform || 'Stream',
                                    isDownloadable: true
                                });
                            }
                        }
                        if (mHigh && mHigh[1]) {
                            const clean = mHigh[1].replace(/\\\//g, '/').replace(/['"]/g, '');
                            if (clean.startsWith('http') && !seen.has(clean)) {
                                seen.add(clean);
                                streams.push({
                                    url: clean,
                                    quality: '1080p Full HD',
                                    format: 'MP4',
                                    duration: meta.duration || '',
                                    thumbnail: meta.thumbnail,
                                    platform: meta.platform || 'Stream',
                                    isDirectMp4: true,
                                    isDownloadable: true
                                });
                            }
                        }
                        if (mLow && mLow[1]) {
                            const clean = mLow[1].replace(/\\\//g, '/').replace(/['"]/g, '');
                            if (clean.startsWith('http') && !seen.has(clean)) {
                                seen.add(clean);
                                streams.push({
                                    url: clean,
                                    quality: '360p SD',
                                    format: 'MP4',
                                    duration: meta.duration || '',
                                    thumbnail: meta.thumbnail,
                                    platform: meta.platform || 'Stream',
                                    isDirectMp4: true,
                                    isDownloadable: true
                                });
                            }
                        }
                    }
                }
            } catch { }

            // 1. Inspect In-Page Script variables (e.g. okxxx, tube engines, flashvars)
            try {
                const scripts = document.querySelectorAll('script:not([src])');
                for (const s of scripts) {
                    const text = s.textContent || '';
                    if (text.includes('video_url') || text.includes('video_alt_url') || text.includes('/get_file/')) {
                        // KVS/tube players expose these as object properties
                        // (video_url: '...'), not only assignment expressions.
                        const m720 = text.match(/video_url\s*[:=]\s*['"]([^'"]+)['"]/i);
                        const mAlt = text.match(/video_alt_url\s*[:=]\s*['"]([^'"]+)['"]/i);
                        const mAny = text.match(/['"](https?:\\?\/\\?\/[^'"\s]+?\/get_file\/[^'"\s]+?\.mp4\/?(?:\?[^'"\s]*)?)['"]/i);

                        const candidates = [m720?.[1], mAlt?.[1], mAny?.[1]].filter(Boolean);
                        for (const raw of candidates) {
                            const cleanUrl = raw.replace(/\\\//g, '/').replace(/['"]/g, '');
                            if (cleanUrl.startsWith('http') && isValidMediaStreamUrl(cleanUrl) && !seen.has(cleanUrl)) {
                                seen.add(cleanUrl);
                                // KVS serves signed MP4 files through `/get_file/`; however, okxxx1.com serves HLS from these URLs.
                                const isOkxxx = (typeof window !== 'undefined' && window.location && (window.location.hostname.includes('okxxx') || window.location.hostname.includes('ok.xxx'))) || cleanUrl.includes('okxxx') || cleanUrl.includes('ok.xxx');
                                const isHls = cleanUrl.includes('.m3u8') || cleanUrl.includes('/hls/') || isOkxxx;
                                const isDash = cleanUrl.includes('.mpd');
                                streams.push({
                                    url: cleanUrl,
                                    duration: meta.duration || '',
                                    thumbnail: meta.thumbnail,
                                    format: isHls ? 'HLS' : (isDash ? 'DASH' : 'MP4'),
                                    platform: meta.platform || 'Stream',
                                    isDirectMp4: !isHls && !isDash,
                                    isDownloadable: true
                                });
                            }
                        }
                    }
                }
            } catch { }

            // 2. Check DOM Video Elements for direct media sources & Hls.js instances
            document.querySelectorAll('video').forEach((video) => {
                const src = video.currentSrc || video.src || video.querySelector('source')?.src;
                let durationStr = '';
                if (video.duration && !isNaN(video.duration) && video.duration !== Infinity) {
                    const mins = Math.floor(video.duration / 60);
                    const secs = Math.floor(video.duration % 60);
                    durationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                }

                // Check attached player properties safely
                try {
                    const attachedUrls = [
                        video.__hls__?.url,
                        video.hls?.url,
                        video._hls?.url
                    ];

                    attachedUrls.forEach(u => {
                        if (u && typeof u === 'string' && isValidMediaStreamUrl(u) && !seen.has(u)) {
                            seen.add(u);
                            streams.push({
                                url: u,
                                duration: durationStr,
                                thumbnail: meta.thumbnail,
                                format: u.includes('.m3u8') ? 'HLS' : 'MP4',
                                platform: meta.platform || 'Stream',
                                isDownloadable: true
                            });
                        }
                    });
                } catch { }

                if (src && !src.startsWith('blob:') && isValidMediaStreamUrl(src)) {
                    if (!seen.has(src)) {
                        seen.add(src);
                        const isHls = src.includes('.m3u8') || src.includes('/hls/');
                        streams.push({
                            url: src,
                            duration: durationStr,
                            thumbnail: meta.thumbnail,
                            format: isHls ? 'HLS' : (src.includes('.mpd') ? 'DASH' : 'MP4'),
                            platform: meta.platform || 'Stream',
                            isDownloadable: true
                        });
                    }
                }
            });

            // 3. Check Performance Resource Timeline for real playback requests
            if (root.MediaDetector) {
                const perfUrls = root.MediaDetector.findPerformanceStreams();
                perfUrls.forEach(url => {
                    if (isValidMediaStreamUrl(url) && !seen.has(url)) {
                        seen.add(url);
                        const isHls = url.includes('.m3u8') || url.includes('/hls/');
                        streams.push({
                            url: url,
                            duration: '',
                            thumbnail: meta.thumbnail,
                            format: isHls ? 'HLS' : (url.includes('.mpd') ? 'DASH' : 'MP4'),
                            platform: meta.platform || 'Stream',
                            isDownloadable: true
                        });
                    }
                });
            }

            // 3. Inspect In-Page Player Configurations (Hls.js, JWPlayer, Video.js, Playlist Sources, etc.)
            try {
                const playerCandidates = [
                    window.hls?.url,
                    window._hls?.url,
                    window.player?.src && typeof window.player.src === 'function' ? window.player.src() : null,
                    window.jwplayer && typeof window.jwplayer === 'function' ? window.jwplayer().getPlaylistItem?.()?.file : null,
                    window.streamUrl,
                    window.file,
                    window.opts?.file,
                    window.playerConfig?.file
                ];

                // Check playlist sources array (e.g. window.playlist = { sources: [...] })
                if (window.playlist?.sources && Array.isArray(window.playlist.sources)) {
                    window.playlist.sources.forEach(s => {
                        if (s?.file) playerCandidates.push(s.file);
                    });
                }
                if (window.playerConfig?.sources && Array.isArray(window.playerConfig.sources)) {
                    window.playerConfig.sources.forEach(s => {
                        if (s?.file) playerCandidates.push(s.file);
                    });
                }

                playerCandidates.forEach(cand => {
                    if (cand && typeof cand === 'string' && isValidMediaStreamUrl(cand) && !seen.has(cand)) {
                        seen.add(cand);
                        const isHls = cand.includes('.m3u8') || cand.includes('/hls/');
                        streams.push({
                            url: cand,
                            duration: '',
                            thumbnail: meta.thumbnail,
                            format: isHls ? 'HLS' : (cand.includes('.mpd') ? 'DASH' : 'MP4'),
                            platform: meta.platform || 'Stream',
                            isDownloadable: true
                        });
                    }
                });
            } catch { }

            return streams;
        }
    };

    root.GenericAdapter = GenericAdapter;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
