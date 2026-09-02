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
            // Instagram first loads a small preview using bytestart/byteend.
            // Those values describe a slice, not a standalone video.  Keep the
            // signed CDN URL but remove only the slice parameters before it is
            // passed to the downloader.
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

    // Instagram keeps the previous and next reels mounted in the DOM. Using
    // document.querySelector('video') therefore often returns the reel that
    // was visible before the user scrolled. Choose the video that is actually
    // in view (and prefer the one currently playing) instead.
    function getActiveInstagramVideo() {
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        const viewportCenterY = viewportHeight / 2;
        let bestVideo = null;
        let bestScore = -Infinity;

        for (const video of document.querySelectorAll('video')) {
            const rect = video.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;

            const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
            const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
            const visibleArea = visibleWidth * visibleHeight;
            if (visibleArea <= 0) continue;

            const visibleRatio = visibleArea / Math.max(1, rect.width * rect.height);
            const centerDistance = Math.abs((rect.top + rect.height / 2) - viewportCenterY);
            let score = (visibleRatio * 10000) - Math.min(centerDistance, viewportHeight) * 2;

            if (!video.paused && !video.ended) score += 2500;
            if (video.currentTime > 0) score += 700;
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) score += 250;
            if (video.currentSrc || video.src || video.querySelector('source')?.src) score += 150;

            if (score > bestScore) {
                bestScore = score;
                bestVideo = video;
            }
        }

        return bestVideo || document.querySelector('video');
    }

    function getVideoSource(video) {
        return video?.currentSrc || video?.src || video?.querySelector('source')?.src || '';
    }

    const InstagramAdapter = {
        name: 'Instagram',

        matches(hostname) {
            return hostname.includes('instagram.com');
        },

        getActiveVideo() {
            return getActiveInstagramVideo();
        },

        extractMetadata() {
            let author = '';
            let caption = '';
            let thumbnail = '';
            const shortId = getInstagramShortId();
            const activeVideo = getActiveInstagramVideo();
            const container = activeVideo ? (activeVideo.closest('article') || activeVideo.closest('div[role="main"]') || activeVideo.parentElement?.parentElement?.parentElement || document) : document;

            // 1. Extract Author Username directly from the active Reel DOM container
            const authorLinks = Array.from(container.querySelectorAll('a[role="link"][href^="/"], a[href^="/"]')).filter(a => {
                const href = a.getAttribute('href') || '';
                return href && !href.startsWith('/reel') && !href.startsWith('/p/') && !href.startsWith('/explore') && !href.startsWith('/stories') && !href.includes('/direct/');
            });

            for (const a of authorLinks) {
                const txt = a.innerText?.trim();
                if (txt && txt.length >= 2 && !txt.toLowerCase().includes('follow') && !txt.toLowerCase().includes('instagram') && !txt.includes('•')) {
                    author = txt;
                    break;
                }
            }

            // 2. Extract Caption from the active Reel DOM container
            const captionEls = Array.from(container.querySelectorAll('h1, span[dir="auto"], div[dir="auto"]'));
            for (const el of captionEls) {
                const txt = el.innerText?.trim();
                if (txt && txt.length > 3 && !txt.includes(author) && !txt.toLowerCase().startsWith('follow') && !txt.toLowerCase().startsWith('view more')) {
                    caption = txt;
                    break;
                }
            }

            // 3. Fallback to Document Title if DOM text is not yet rendered
            if (!caption || !author) {
                const docTitle = document.title || '';
                const docMatch = docTitle.match(/^(.+?)\s+on Instagram:\s*["“]?([^"”]*)/i);
                if (docMatch) {
                    if (!author) author = docMatch[1].trim();
                    if (!caption) caption = docMatch[2].trim();
                }
            }

            // 4. Sanitize Author & Caption
            author = cleanText(author);
            if (!author || author.toLowerCase() === 'instagram' || author.toLowerCase() === '@reels' || author.toLowerCase() === '@reel') {
                author = shortId ? `@user_${shortId}` : 'Instagram Reel';
            } else if (!author.startsWith('@') && !author.toLowerCase().includes('reel')) {
                author = `@${author}`;
            }

            caption = cleanText(caption).slice(0, 65);

            // 5. Extract Active Reel Thumbnail
            if (activeVideo?.poster && activeVideo.poster.startsWith('http')) {
                thumbnail = activeVideo.poster;
            }

            if (!thumbnail) {
                const containerImgs = Array.from(container.querySelectorAll('img'))
                    .map(i => i.currentSrc || i.src)
                    .filter(src => src && (src.includes('cdninstagram.com') || src.includes('fbcdn.net')) && !src.includes('150x150') && !src.includes('44x44'));
                if (containerImgs.length > 0) thumbnail = containerImgs[0];
            }

            if (!thumbnail) {
                const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
                if (ogImage && ogImage.startsWith('http')) thumbnail = ogImage;
            }

            let displayTitle = '';
            const authorLabel = (author && !author.includes('Instagram Reel')) ? author : '';

            if (caption && caption.length > 2) {
                displayTitle = authorLabel ? `Instagram - ${authorLabel} - ${caption}` : `Instagram - ${caption}`;
            } else if (shortId) {
                displayTitle = authorLabel ? `Instagram - ${authorLabel} - Reel_${shortId}` : `Instagram Reel - ${shortId}`;
            } else {
                displayTitle = authorLabel ? `Instagram - ${authorLabel}` : `Instagram Reel`;
            }

            return {
                platform: 'Instagram',
                showName: authorLabel || (shortId ? `Instagram Reel (${shortId})` : 'Instagram Reel'),
                subtitle: caption || authorLabel || 'Instagram Reel',
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
            const activeVideo = getActiveInstagramVideo();
            const shortId = meta.shortId || getInstagramShortId();
            let streamCameFromActiveVideo = false;

            // 1. Active Visible / Playing <video> element (Always authoritative for CURRENT reel on screen!)
            if (activeVideo) {
                const src = getVideoSource(activeVideo);
                if (src && src.startsWith('http') && !src.startsWith('blob:') && !isAudioOnlyUrl(src)) {
                    confirmedVideoUrl = sanitizeMediaUrl(src);
                    streamCameFromActiveVideo = true;
                }
            }

            // 2. Check inlined JSON scripts matching this specific shortId
            if (shortId) {
                const scripts = document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"], script:not([src])');
                for (const s of scripts) {
                    try {
                        const text = s.textContent || '';
                        if (!text || !text.includes(shortId)) continue;

                        const matches = text.matchAll(/(?:"playable_url_quality_hd"|"playable_url"|"video_url"|"url")\s*:\s*"((?:https?:\\\/\\\/|https?:\/\/)[^"]+)"/gi);
                        for (const m of matches) {
                            let raw = m[1];
                            try { raw = JSON.parse(`"${raw}"`); }
                            catch { raw = raw.replace(/\\u0025/g, '%').replace(/\\\//g, '/').replace(/\\u0026/g, '&').replace(/\\/g, ''); }

                            if (raw.startsWith('http') && (raw.includes('cdninstagram.com') || raw.includes('fbcdn.net')) && !raw.includes('.htm')) {
                                if (isAudioOnlyUrl(raw)) {
                                    if (!confirmedAudioUrl) confirmedAudioUrl = sanitizeMediaUrl(raw);
                                } else {
                                    confirmedVideoUrl = sanitizeMediaUrl(raw);
                                    break;
                                }
                            }
                        }
                        if (confirmedVideoUrl) break;
                    } catch { }
                }
            }

            // 3. Fallback to all video elements in DOM
            if (!confirmedVideoUrl) {
                const videos = Array.from(document.querySelectorAll('video'));
                for (const video of videos) {
                    const src = getVideoSource(video);
                    if (src && src.startsWith('http') && !src.startsWith('blob:') && !isAudioOnlyUrl(src)) {
                        confirmedVideoUrl = sanitizeMediaUrl(src);
                        break;
                    }
                }
            }

            // 4. Fallback to preload link
            if (!confirmedVideoUrl) {
                const preloadVideo = document.querySelector('link[rel="preload"][as="video"]')?.getAttribute('href');
                if (preloadVideo && preloadVideo.startsWith('http') && !isAudioOnlyUrl(preloadVideo)) {
                    confirmedVideoUrl = sanitizeMediaUrl(preloadVideo);
                }
            }

            // 5. Inspect Performance Resource Timeline for Video and Audio streams
            try {
                const entries = performance.getEntriesByType('resource');
                for (let i = entries.length - 1; i >= 0; i--) {
                    const url = entries[i].name;
                    if (!url || !url.startsWith('http') || url.includes('.htm')) continue;

                    if (url.includes('cdninstagram.com') || url.includes('fbcdn.net')) {
                        if (isAudioOnlyUrl(url)) {
                            if (!confirmedAudioUrl) confirmedAudioUrl = sanitizeMediaUrl(url);
                        } else if (url.includes('.mp4') || url.includes('/v/t') || url.includes('/o1/v/')) {
                            if (!confirmedVideoUrl) {
                                confirmedVideoUrl = sanitizeMediaUrl(url);
                            }
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

            // Mark downloadable if a confirmed VIDEO stream is present
            if (confirmedVideoUrl && !isAudioOnlyUrl(confirmedVideoUrl)) {
                streams.push({
                    url: confirmedVideoUrl,
                    audioUrl: confirmedAudioUrl || '',
                    duration: durationStr,
                    thumbnail: thumb,
                    format: 'MP4',
                    resolution: resolutionStr || '1080x1920 (HD)',
                    platform: 'Instagram',
                    isDirectMp4: true,
                    isDownloadable: true,
                    isActivePageStream: streamCameFromActiveVideo
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
                    downloadNotice: 'Video detected — play the reel once to unlock direct stream.'
                });
            }

            return streams;
        }
    };

    root.InstagramAdapter = InstagramAdapter;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
