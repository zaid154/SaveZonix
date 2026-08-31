// src/sites/youtube.js — Dedicated YouTube Video & Shorts Site Adapter (Legitimate Non-DRM Media)

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
            const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, #title h1, h1.title, ytd-reel-player-header-renderer h2, .ytp-title-link');
            if (titleEl && titleEl.innerText.trim()) {
                title = titleEl.innerText.trim();
            } else {
                title = document.title.replace(/\s*-\s*YouTube$/i, '').trim();
            }

            // 2. Channel Name
            const channelEl = document.querySelector('#channel-name #text, ytd-channel-name a, #owner-name a');
            if (channelEl && channelEl.innerText.trim()) {
                channel = channelEl.innerText.trim();
            }

            // 3. Extract Video ID for High-Res Thumbnail
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('v')) {
                videoId = urlParams.get('v');
            } else if (window.location.pathname.includes('/shorts/')) {
                const parts = window.location.pathname.split('/shorts/');
                if (parts[1]) videoId = parts[1].split('/')[0].split('?')[0];
            }

            let thumbnail = '';
            if (videoId) {
                thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            }

            const cleanTitle = (title || 'YouTube Video').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').trim();
            const finalTitle = `${cleanTitle} - ${channel}`;

            return {
                platform: 'YouTube',
                showName: cleanTitle,
                subtitle: channel,
                title: finalTitle,
                thumbnail: thumbnail,
                videoId: videoId
            };
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

                    // Live videoplayback stream — clean byte-range chunk parameters to get full stream
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
