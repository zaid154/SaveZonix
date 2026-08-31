// src/sites/generic.js — Universal Streaming Site Adapter (Non-DRM HLS/MP4 Stream Sniffer)

(function (root) {
    function isValidMediaStreamUrl(url) {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
        if (root.isInvalidStreamUrl && root.isInvalidStreamUrl(url)) return false;
        
        const clean = url.split('?')[0].toLowerCase();
        return clean.endsWith('.m3u8') || 
               clean.endsWith('.mp4') || 
               clean.endsWith('.webm') || 
               clean.endsWith('.m4v') || 
               clean.endsWith('.mpd') || 
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
                    platform: 'PixelFlix',
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
                platform: 'PixelFlix',
                showName: title || 'Video',
                subtitle: '',
                title: title || 'Video',
                thumbnail: ''
            };
        },

        findStreams(meta) {
            const streams = [];
            const seen = new Set();

            // 1. Check DOM Video Elements for direct media sources & Hls.js instances
            document.querySelectorAll('video').forEach((video) => {
                const src = video.currentSrc || video.src || video.querySelector('source')?.src;
                let durationStr = '';
                if (video.duration && !isNaN(video.duration) && video.duration !== Infinity) {
                    const mins = Math.floor(video.duration / 60);
                    const secs = Math.floor(video.duration % 60);
                    durationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                }

                // Check attached player properties
                const attachedUrls = [
                    video.__hls__?.url,
                    video.hls?.url,
                    video._hls?.url,
                    video.player?.currentSrc && typeof video.player.currentSrc === 'function' ? video.player.currentSrc() : null
                ];

                attachedUrls.forEach(u => {
                    if (u && typeof u === 'string' && isValidMediaStreamUrl(u) && !seen.has(u)) {
                        seen.add(u);
                        streams.push({
                            url: u,
                            duration: durationStr,
                            thumbnail: meta.thumbnail,
                            format: u.includes('.m3u8') ? 'HLS' : 'MP4',
                            platform: 'PixelFlix',
                            isDownloadable: true
                        });
                    }
                });

                if (src && !src.startsWith('blob:') && isValidMediaStreamUrl(src)) {
                    if (!seen.has(src)) {
                        seen.add(src);
                        const isHls = src.includes('.m3u8') || src.includes('/hls/');
                        streams.push({
                            url: src,
                            duration: durationStr,
                            thumbnail: meta.thumbnail,
                            format: isHls ? 'HLS' : (src.includes('.mpd') ? 'DASH' : 'MP4'),
                            platform: 'PixelFlix',
                            isDownloadable: true
                        });
                    }
                }
            });

            // 2. Check Performance Resource Timeline for real playback requests
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
                            platform: 'PixelFlix',
                            isDownloadable: true
                        });
                    }
                });
            }

            // 3. Inspect In-Page Player Configurations (Hls.js, JWPlayer, Video.js, etc.)
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

                playerCandidates.forEach(cand => {
                    if (cand && typeof cand === 'string' && isValidMediaStreamUrl(cand) && !seen.has(cand)) {
                        seen.add(cand);
                        const isHls = cand.includes('.m3u8') || cand.includes('/hls/');
                        streams.push({
                            url: cand,
                            duration: '',
                            thumbnail: meta.thumbnail,
                            format: isHls ? 'HLS' : (cand.includes('.mpd') ? 'DASH' : 'MP4'),
                            platform: 'PixelFlix',
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
