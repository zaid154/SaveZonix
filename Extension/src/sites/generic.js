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
            if (typeof root.extractPageMetadata === 'function') {
                const meta = root.extractPageMetadata();
                const thumb = typeof root.extractBestThumbnail === 'function' ? root.extractBestThumbnail(document.querySelector('video')) : '';
                return {
                    platform: meta.platform || 'Stream',
                    showName: meta.showName,
                    subtitle: meta.subtitle,
                    title: meta.title,
                    season: meta.season,
                    episode: meta.episode,
                    episodeTitle: meta.episodeTitle,
                    thumbnail: thumb
                };
            }

            const title = (document.title || 'Video').replace(/^Watch\s+/i, '').replace(/[-|–—].*$/, '').trim();
            return {
                platform: 'Stream',
                showName: title || 'Video',
                subtitle: '',
                title: title || 'Video',
                thumbnail: ''
            };
        },

        findStreams(meta) {
            const streams = [];
            const seen = new Set();

            // 1. Inspect In-Page Script variables (e.g. okxxx, tube engines, flashvars)
            try {
                const scripts = document.querySelectorAll('script:not([src])');
                for (const s of scripts) {
                    const text = s.textContent || '';
                    if (text.includes('video_url') || text.includes('video_alt_url') || text.includes('/get_file/')) {
                        const m720 = text.match(/video_url\s*=\s*['"]([^'"]+)['"]/i);
                        const mAlt = text.match(/video_alt_url\s*=\s*['"]([^'"]+)['"]/i);
                        const mAny = text.match(/['"](https?:\\?\/\\?\/[^'"]+?\/get_file\/[^'"]+?\.mp4\/?['"])/i);

                        const candidates = [m720?.[1], mAlt?.[1], mAny?.[1]].filter(Boolean);
                        for (const raw of candidates) {
                            const cleanUrl = raw.replace(/\\\//g, '/').replace(/['"]/g, '');
                            if (cleanUrl.startsWith('http') && isValidMediaStreamUrl(cleanUrl) && !seen.has(cleanUrl)) {
                                seen.add(cleanUrl);
                                streams.push({
                                    url: cleanUrl,
                                    duration: meta.duration || '',
                                    thumbnail: meta.thumbnail,
                                    format: (cleanUrl.includes('/get_file/') || cleanUrl.includes('.m3u8')) ? 'HLS' : 'MP4',
                                    platform: meta.platform || 'Stream',
                                    isDirectMp4: !cleanUrl.includes('/get_file/'),
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
