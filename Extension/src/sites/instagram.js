// src/sites/instagram.js — Dedicated Instagram Reels & Videos Site Adapter (Video + Audio Track Support)

(function (root) {
    function getInstagramShortId() {
        try {
            const parts = window.location.pathname.split('/').filter(Boolean);
            const idx = parts.findIndex(p => p === 'reel' || p === 'reels' || p === 'p');
            if (idx >= 0 && parts[idx + 1]) {
                return parts[idx + 1].split('?')[0];
            }
        } catch { }
        return '';
    }

    function cleanText(str) {
        if (!str || typeof str !== 'string') return '';
        return str
            .replace(/\b(facebook|meta|log in|sign up|watch|reels)\b/gi, '')
            .replace(/[\\/:*?"<>|\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function sanitizeMediaUrl(url) {
        if (!url || typeof url !== 'string') return '';
        try {
            const u = new URL(url);
            // Remove byte-range restrictions to request full-length media file
            u.searchParams.delete('bytestart');
            u.searchParams.delete('byteend');
            u.searchParams.delete('range');
            return u.href;
        } catch {
            return url;
        }
    }

    function isAudioOnlyUrl(url) {
        if (!url) return false;
        const lower = url.toLowerCase();
        return lower.includes('mime=audio') || 
               lower.includes('audio_only') || 
               lower.includes('audio.mp4') || 
               lower.includes('audio/mp4');
    }

    const InstagramAdapter = {
        name: 'Instagram',

        matches(hostname) {
            return hostname.includes('instagram.com');
        },

        extractMetadata() {
            let author = '';
            let caption = '';
            let thumbnail = '';
            const shortId = getInstagramShortId();

            // 1. Extract from Document Title
            const docTitle = document.title || '';
            const docMatch = docTitle.match(/^(.+?)\s+on Instagram:\s*["“]?([^"”]*)/i);
            if (docMatch) {
                author = docMatch[1].trim();
                caption = docMatch[2].trim();
            }

            // 2. Extract from OpenGraph Title
            const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
            if (ogTitle) {
                const ogMatch = ogTitle.match(/^(.*?)(?:\s*\(@([\w._]+)\))?\s+on Instagram:\s*["“]?([^"”]*)/i);
                if (ogMatch) {
                    if (ogMatch[2]) author = `@${ogMatch[2]}`;
                    else if (!author && ogMatch[1]) author = ogMatch[1].trim();
                    if (!caption && ogMatch[3]) caption = ogMatch[3].trim();
                }
            }

            // 3. Extract from Article Scope in DOM
            if (!caption) {
                const article = document.querySelector('article, div[role="main"]');
                if (article) {
                    const span = article.querySelector('h1, span[dir="auto"], div[dir="auto"]');
                    if (span && span.innerText.trim()) {
                        caption = span.innerText.trim();
                    }
                }
            }

            // 4. Extract from OG Description
            if (!caption) {
                const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
                if (ogDesc) {
                    const descMatch = ogDesc.match(/:\s*["“](.+?)["”]/) || ogDesc.match(/-\s*(.+)/);
                    if (descMatch && descMatch[1]) {
                        caption = descMatch[1].trim();
                    }
                }
            }

            // Sanitize Author & Caption
            author = cleanText(author);
            if (!author || author.toLowerCase() === 'instagram') {
                const parts = window.location.pathname.split('/').filter(Boolean);
                if (parts.length > 0 && !['reel', 'reels', 'p', 'stories', 'explore'].includes(parts[0])) {
                    author = `@${parts[0]}`;
                } else {
                    author = shortId ? `Instagram Reel (${shortId})` : 'Instagram Reel';
                }
            } else if (!author.startsWith('@') && !author.toLowerCase().includes('reel')) {
                author = `@${author}`;
            }

            caption = cleanText(caption).slice(0, 55);

            // 5. Extract Real High-Res Thumbnail
            const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
            if (ogImage && ogImage.startsWith('http')) {
                thumbnail = ogImage;
            }

            if (!thumbnail) {
                const activeVideo = document.querySelector('video');
                if (activeVideo?.poster && activeVideo.poster.startsWith('http')) {
                    thumbnail = activeVideo.poster;
                }
            }

            if (!thumbnail) {
                const articleImgs = Array.from(document.querySelectorAll('article img, div[role="main"] img'))
                    .map(i => i.currentSrc || i.src)
                    .filter(src => src && (src.includes('cdninstagram.com') || src.includes('fbcdn.net')) && !src.includes('150x150'));
                if (articleImgs.length > 0) thumbnail = articleImgs[0];
            }

            let displayTitle = '';
            let subtitle = '';

            if (caption && caption.length > 2) {
                displayTitle = `Instagram - ${caption}`;
                subtitle = author;
            } else if (shortId) {
                displayTitle = `Instagram Reel - ${shortId}`;
                subtitle = author;
            } else {
                displayTitle = `Instagram - ${author}`;
                subtitle = 'Instagram Reel';
            }

            return {
                platform: 'Instagram',
                showName: author,
                subtitle: caption || 'Instagram Reel',
                title: displayTitle,
                thumbnail: thumbnail,
                shortId: shortId
            };
        },

        findStreams(meta) {
            const streams = [];
            let confirmedVideoUrl = '';
            let confirmedAudioUrl = '';
            let resolutionStr = '';

            const activeVideo = document.querySelector('video');

            // 1. Inspect DOM Video Elements for direct progressive MP4 source
            const videos = document.querySelectorAll('video');
            for (const video of videos) {
                const src = video.currentSrc || video.src || video.querySelector('source')?.src;
                if (src && src.startsWith('http') && !src.startsWith('blob:')) {
                    if (src.includes('.mp4') || src.includes('cdninstagram') || src.includes('fbcdn')) {
                        if (!isAudioOnlyUrl(src)) {
                            confirmedVideoUrl = sanitizeMediaUrl(src);
                            break;
                        }
                    }
                }
            }

            // 2. Inspect Performance Resource Timeline for accessible video and audio tracks
            try {
                const entries = performance.getEntriesByType('resource');
                for (let i = entries.length - 1; i >= 0; i--) {
                    const url = entries[i].name;
                    if (!url || !url.startsWith('http') || url.includes('.htm')) continue;

                    if (url.includes('cdninstagram.com') || url.includes('fbcdn.net')) {
                        if (isAudioOnlyUrl(url)) {
                            if (!confirmedAudioUrl) confirmedAudioUrl = sanitizeMediaUrl(url);
                        } else if (url.includes('.mp4') || url.includes('/v/t')) {
                            if (!confirmedVideoUrl) confirmedVideoUrl = sanitizeMediaUrl(url);
                        }
                    }
                }
            } catch { }

            let durationStr = '';
            if (activeVideo && activeVideo.duration && !isNaN(activeVideo.duration) && activeVideo.duration !== Infinity) {
                const mins = Math.floor(activeVideo.duration / 60);
                const secs = Math.floor(activeVideo.duration % 60);
                durationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            }

            if (activeVideo && activeVideo.videoWidth > 0 && activeVideo.videoHeight > 0) {
                resolutionStr = `${activeVideo.videoWidth}x${activeVideo.videoHeight}`;
            }

            const thumb = meta.thumbnail || (activeVideo?.poster) || '';

            // ONLY mark downloadable if a confirmed VIDEO stream is present (never audio-only)
            if (confirmedVideoUrl && !isAudioOnlyUrl(confirmedVideoUrl)) {
                streams.push({
                    url: confirmedVideoUrl,
                    audioUrl: confirmedAudioUrl || '',
                    duration: durationStr,
                    thumbnail: thumb,
                    format: 'MP4',
                    resolution: resolutionStr,
                    platform: 'Instagram',
                    isDirectMp4: true,
                    isDownloadable: true
                });
            } else if (activeVideo) {
                streams.push({
                    url: '',
                    audioUrl: '',
                    duration: durationStr,
                    thumbnail: thumb,
                    format: 'MP4',
                    resolution: resolutionStr,
                    platform: 'Instagram',
                    isDirectMp4: false,
                    isDownloadable: false,
                    downloadNotice: 'Video detected — direct stream is protected by Instagram.'
                });
            }

            return streams;
        }
    };

    root.InstagramAdapter = InstagramAdapter;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
