// src/sites/youtube.js â Dedicated YouTube Video & Shorts Site Adapter (Legitimate Non-DRM Media)

(function (root) {
    function parseItagInfo(url) {
        if (!url) return { resolution: '720p', container: 'MP4', mediaType: 'video/mp4', label: '720p HD' };
        
        let itag = '';
        const match = url.match(/[?&]itag=(\d+)/);
        if (match) itag = match[1];

        switch (itag) {
            case '37':
            case '137':
            case '248':
            case '399':
                return { resolution: '1080p', container: 'MP4', mediaType: 'video/mp4', label: '1080p Full HD' };
            case '22':
            case '136':
            case '247':
            case '398':
                return { resolution: '720p', container: 'MP4', mediaType: 'video/mp4', label: '720p HD' };
            case '135':
            case '244':
            case '397':
                return { resolution: '480p', container: 'MP4', mediaType: 'video/mp4', label: '480p' };
            case '18':
            case '134':
            case '243':
            case '396':
                return { resolution: '360p', container: 'MP4', mediaType: 'video/mp4', label: '360p' };
            default:
                return { resolution: '720p', container: 'MP4', mediaType: 'video/mp4', label: 'Original Quality' };
        }
    }

    const YouTubeAdapter = {
        name: 'YouTube',

        matches(hostname) {
            return hostname.includes('youtube.com') || hostname.includes('youtu.be');
        },

        extractMetadata() {
            let title = '';
            let channel = 'YouTube';
            let videoId = '';

            // 1. Live Video Title
            const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, ytd-watch-metadata #title yt-formatted-string, #above-the-fold #title h1, #title h1, h1.title, ytd-reel-player-header-renderer h2, .ytp-title-link');
            if (titleEl && (titleEl.innerText || titleEl.textContent)?.trim()) {
                title = (titleEl.innerText || titleEl.textContent).trim();
            } else {
                const cleanDocTitle = document.title
                    .replace(/^\(\d+\)\s*/, '') // Remove "(12) " notification badge
                    .replace(/\s*-\s*YouTube$/i, '')
                    .trim();
                if (cleanDocTitle && cleanDocTitle !== 'YouTube') {
                    title = cleanDocTitle;
                } else {
                    const metaTitle = document.querySelector('meta[name="title"]')?.content || document.querySelector('meta[property="og:title"]')?.content;
                    if (metaTitle) title = metaTitle.trim();
                }
            }

            // 2. Channel Name
            const channelEl = document.querySelector('#channel-name #text, ytd-channel-name a, #owner-name a, ytd-channel-name yt-formatted-string');
            if (channelEl && (channelEl.innerText || channelEl.textContent)?.trim()) {
                channel = (channelEl.innerText || channelEl.textContent).trim();
            } else {
                const metaAuthor = document.querySelector('meta[name="author"]')?.content || document.querySelector('link[itemprop="name"]')?.getAttribute('content');
                if (metaAuthor) channel = metaAuthor.trim();
            }

            // 3. Extract Video ID for High-Res Thumbnail
            const urlParams = new URLSearchParams(window.location.search);
            const listId = urlParams.get('list') || '';
            const isPlaylist = Boolean(listId || window.location.pathname.includes('/playlist'));

            if (urlParams.has('v')) {
                videoId = urlParams.get('v');
            } else if (window.location.pathname.includes('/shorts/')) {
                const parts = window.location.pathname.split('/shorts/');
                if (parts[1]) videoId = parts[1].split('/')[0].split('?')[0];
            }

            let durationSeconds = 0;
            let durationFormatted = '';
            let availableQualities = [];

            const videoEl = document.querySelector('video.html5-main-video') || document.querySelector('video');
            if (videoEl && !isNaN(videoEl.duration) && videoEl.duration > 0 && videoEl.duration !== Infinity) {
                durationSeconds = Math.round(videoEl.duration);
                const m = Math.floor(durationSeconds / 60);
                const s = durationSeconds % 60;
                durationFormatted = `${m}:${String(s).padStart(2, '0')}`;
            }

            try {
                const scripts = Array.from(document.querySelectorAll('script'));
                for (const s of scripts) {
                    const txt = s.textContent || '';
                    if (txt.includes('streamingData')) {
                        const match = txt.match(/ytInitialPlayerResponse\s*=\s*({.+?});/) || txt.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/);
                        if (match) {
                            const data = JSON.parse(match[1]);
                            if (data.videoDetails?.lengthSeconds) {
                                const sec = parseInt(data.videoDetails.lengthSeconds, 10);
                                if (!isNaN(sec) && sec > 0) {
                                    durationSeconds = sec;
                                    const m = Math.floor(sec / 60);
                                    const s = sec % 60;
                                    durationFormatted = `${m}:${String(s).padStart(2, '0')}`;
                                }
                            }
                            if (data.streamingData?.adaptiveFormats) {
                                const seen = new Set();
                                for (const af of data.streamingData.adaptiveFormats) {
                                    if (af.qualityLabel && !seen.has(af.qualityLabel)) {
                                        seen.add(af.qualityLabel);
                                        availableQualities.push({
                                            quality: af.qualityLabel,
                                            bitrate: af.bitrate || 0,
                                            contentLength: af.contentLength ? parseInt(af.contentLength, 10) : 0,
                                            container: (af.mimeType && af.mimeType.includes('mp4')) ? 'MP4' : 'WebM'
                                        });
                                    }
                                }
                            }
                            break;
                        }
                    }
                }
            } catch { }

            // Also probe YouTube HTML5 player API for live active quality levels
            try {
                const player = document.getElementById('movie_player');
                if (player && typeof player.getAvailableQualityLevels === 'function') {
                    const levels = player.getAvailableQualityLevels();
                    if (Array.isArray(levels) && levels.length > 0) {
                        const levelMap = {
                            'highres': '4320p (8K)',
                            'hd2880': '2880p (5K)',
                            'hd2160': '2160p (4K)',
                            'hd1440': '1440p (2K)',
                            'hd1080': '1080p',
                            'hd720': '720p',
                            'large': '480p',
                            'medium': '360p',
                            'small': '240p',
                            'tiny': '144p'
                        };
                        levels.forEach(lvl => {
                            const mapped = levelMap[lvl];
                            if (mapped && !availableQualities.some(q => q.quality === mapped || q.quality.startsWith(mapped.split(' ')[0]))) {
                                availableQualities.push({
                                    quality: mapped,
                                    bitrate: 0,
                                    contentLength: 0,
                                    container: 'MP4'
                                });
                            }
                        });
                    }
                }
            } catch { }

            const cleanTitle = title || 'YouTube Video';
            const finalTitle = title || 'YouTube Video';
            const thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';

            return {
                platform: 'YouTube',
                showName: cleanTitle,
                subtitle: channel,
                title: finalTitle,
                thumbnail: thumbnail,
                videoId: videoId,
                listId: listId,
                isPlaylist: isPlaylist,
                durationSeconds: durationSeconds,
                duration: durationFormatted,
                availableQualities: availableQualities
            };
        },

        extractQueue() {
            const queue = [];
            try {
                // 1. Extract from live DOM playlist panel
                const items = document.querySelectorAll('ytd-playlist-panel-video-renderer');
                if (items && items.length > 0) {
                    items.forEach((item, idx) => {
                        const titleEl = item.querySelector('#video-title');
                        const bylineEl = item.querySelector('#byline');
                        const linkEl = item.querySelector('a#wc-endpoint') || item.querySelector('a');
                        const lengthEl = item.querySelector('#length') || item.querySelector('.ytd-thumbnail-overlay-time-status-renderer');
                        const thumbImg = item.querySelector('img');

                        let videoId = '';
                        let url = '';
                        if (linkEl && linkEl.href) {
                            try {
                                const u = new URL(linkEl.href);
                                videoId = u.searchParams.get('v') || '';
                                url = `https://www.youtube.com/watch?v=${videoId}`;
                            } catch { }
                        }

                        const title = titleEl ? (titleEl.textContent || titleEl.innerText || '').trim() : '';
                        const author = bylineEl ? (bylineEl.textContent || bylineEl.innerText || '').trim() : '';
                        const duration = lengthEl ? (lengthEl.textContent || lengthEl.innerText || '').trim() : '';
                        let thumbnail = thumbImg ? (thumbImg.src || thumbImg.currentSrc) : '';
                        if (!thumbnail || thumbnail.startsWith('data:')) {
                            thumbnail = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
                        }

                        if (title && (videoId || url)) {
                            queue.push({
                                index: idx + 1,
                                id: videoId,
                                title: title,
                                author: author || 'YouTube Creator',
                                duration: duration || '00:00',
                                thumbnailUrl: thumbnail,
                                url: url
                            });
                        }
                    });
                }

                // 2. Fallback: Parse ytInitialData from page scripts if DOM items aren't rendered yet
                if (queue.length === 0) {
                    const scripts = Array.from(document.querySelectorAll('script'));
                    for (const s of scripts) {
                        const t = s.textContent || '';
                        if (t.includes('playlistPanelVideoRenderer')) {
                            const m = t.match(/ytInitialData\s*=\s*({.+?});/) || t.match(/var ytInitialData\s*=\s*({.+?});/);
                            if (m) {
                                const data = JSON.parse(m[1]);
                                const plContents = data?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.contents;
                                if (Array.isArray(plContents)) {
                                    plContents.forEach((entry, idx) => {
                                        const ren = entry?.playlistPanelVideoRenderer;
                                        if (ren && ren.videoId) {
                                            const vidTitle = ren.title?.simpleText || (ren.title?.runs && ren.title.runs[0]?.text) || 'Video';
                                            const vidAuthor = ren.shortBylineText?.simpleText || (ren.shortBylineText?.runs && ren.shortBylineText.runs[0]?.text) || 'YouTube';
                                            const vidDur = ren.lengthText?.simpleText || (ren.lengthText?.runs && ren.lengthText.runs[0]?.text) || '00:00';
                                            const vidThumb = (ren.thumbnail?.thumbnails && ren.thumbnail.thumbnails.length > 0) 
                                                ? ren.thumbnail.thumbnails[ren.thumbnail.thumbnails.length - 1].url 
                                                : `https://i.ytimg.com/vi/${ren.videoId}/hqdefault.jpg`;

                                            queue.push({
                                                index: idx + 1,
                                                id: ren.videoId,
                                                title: vidTitle,
                                                author: vidAuthor,
                                                duration: vidDur,
                                                thumbnailUrl: vidThumb,
                                                url: `https://www.youtube.com/watch?v=${ren.videoId}`
                                            });
                                        }
                                    });
                                }
                            }
                            if (queue.length > 0) break;
                        }
                    }
                }

                // 3. Ensure currently playing video is at Index 0 (Video #01)
                const meta = this.extractMetadata();
                if (meta && meta.videoId) {
                    const existingIdx = queue.findIndex(item => item.id === meta.videoId);
                    if (existingIdx > 0) {
                        const [curr] = queue.splice(existingIdx, 1);
                        queue.unshift(curr);
                    } else if (existingIdx === -1) {
                        queue.unshift({
                            index: 1,
                            id: meta.videoId,
                            title: meta.showName || meta.title,
                            author: meta.subtitle || 'YouTube Creator',
                            duration: '00:00',
                            thumbnailUrl: meta.thumbnail,
                            url: `https://www.youtube.com/watch?v=${meta.videoId}`
                        });
                    }
                }

                // Re-index sequentially 1..N
                queue.forEach((it, i) => it.index = i + 1);
            } catch (err) {
                console.warn('[SaveZonix] YouTube queue extraction error:', err);
            }
            return queue;
        },

        findStreams(meta) {
            const streams = [];
            const activeVideo = document.querySelector('video');

            let durationStr = '';
            if (activeVideo && activeVideo.duration && !isNaN(activeVideo.duration) && activeVideo.duration !== Infinity) {
                const mins = Math.floor(activeVideo.duration / 60);
                const secs = Math.floor(activeVideo.duration % 60);
                durationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            }

            let videoStreamUrl = '';
            let audioStreamUrl = '';
            let isHls = false;

            // 1. Inspect DOM & Player scripts for streamingData
            try {
                const scripts = Array.from(document.querySelectorAll('script'));
                for (const s of scripts) {
                    const text = s.textContent || '';
                    if (text.includes('streamingData')) {
                        const m = text.match(/ytInitialPlayerResponse\s*=\s*({.+?});/) || text.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/);
                        if (m) {
                            const data = JSON.parse(m[1]);
                            if (data.streamingData?.hlsManifestUrl) {
                                videoStreamUrl = data.streamingData.hlsManifestUrl;
                                isHls = true;
                                break;
                            }
                            if (data.streamingData?.formats?.length > 0) {
                                for (const f of data.streamingData.formats) {
                                    if (f.url) {
                                        videoStreamUrl = f.url;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            } catch { }

            // 2. Inspect Performance Resource Timeline for live video/audio playback streams
            try {
                const entries = performance.getEntriesByType('resource');
                for (let i = entries.length - 1; i >= 0; i--) {
                    const name = entries[i].name;
                    if (!name || name.includes('.htm') || name.includes('.xml')) continue;

                    // HLS Live/Manifest stream
                    if (name.includes('.m3u8') || name.includes('manifest.googlevideo.com')) {
                        videoStreamUrl = name;
                        isHls = true;
                        break;
                    }

                    // Live videoplayback stream â clean byte-range chunk parameters to get full stream
                    if (name.includes('googlevideo.com/videoplayback')) {
                        const cleanUrl = name.replace(/[?&]range=[^&]+/g, '').replace(/[?&]sq=[^&]+/g, '');
                        if (name.includes('mime=audio') || name.includes('itag=140') || name.includes('itag=251')) {
                            if (!audioStreamUrl) audioStreamUrl = cleanUrl;
                        } else {
                            if (!videoStreamUrl) videoStreamUrl = cleanUrl;
                        }
                    }
                }
            } catch { }

            // 3. Check DOM video tag for direct progressive source
            if (!videoStreamUrl && activeVideo) {
                const src = activeVideo.currentSrc || activeVideo.src;
                if (src && src.startsWith('http') && !src.startsWith('blob:')) {
                    videoStreamUrl = src.replace(/[?&]range=[^&]+/g, '').replace(/[?&]sq=[^&]+/g, '');
                    isHls = src.includes('.m3u8');
                }
            }

            // Real Media Inspection
            const targetStream = videoStreamUrl || audioStreamUrl;
            const itagInfo = parseItagInfo(targetStream);
            let resolution = (activeVideo && activeVideo.videoWidth > 0 && activeVideo.videoHeight > 0)
                ? `${activeVideo.videoWidth}x${activeVideo.videoHeight}`
                : itagInfo.resolution;
            let container = itagInfo.container;
            let mediaType = itagInfo.mediaType;
            let isDownloadable = Boolean(targetStream && !targetStream.includes('.htm') && !targetStream.includes('.xml'));

            if (isDownloadable) {
                streams.push({
                    url: videoStreamUrl || audioStreamUrl,
                    audioUrl: audioStreamUrl || '',
                    duration: durationStr,
                    thumbnail: meta.thumbnail,
                    format: isHls ? 'HLS' : 'MP4',
                    container: 'MP4',
                    mediaType: mediaType,
                    resolution: resolution,
                    qualityLabel: `${itagInfo.label} (Direct MP4)`,
                    platform: 'YouTube',
                    isYouTube: true,
                    isDownloadable: true,
                    isDirectMp4: !isHls
                });
            } else if (activeVideo) {
                streams.push({
                    url: '',
                    audioUrl: '',
                    duration: durationStr,
                    thumbnail: meta.thumbnail,
                    format: 'MP4',
                    container: container,
                    mediaType: mediaType,
                    resolution: resolution,
                    platform: 'YouTube',
                    isYouTube: true,
                    isDownloadable: false,
                    isRestricted: true,
                    downloadNotice: 'Buffering stream... Please play the video for 2 seconds and open popup.'
                });
            }

            return streams;
        }
    };

    root.YouTubeAdapter = YouTubeAdapter;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
