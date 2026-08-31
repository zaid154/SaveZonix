// src/content/content.js — Real-Time Content Script Coordinator & In-Tab Session Fetcher (Universal)

(function () {
    const isTopFrame = (window.top === window.self);
    let currentUrl = window.location.href;
    let activeVideoSource = '';
    const detectedUrls = new Set();
    let scanDebounceTimer = null;

    function getSiteName() {
        const host = (window.location.hostname || '').toLowerCase();
        if (host.includes('pixelflix.cc')) return 'PixelFlix';
        if (host.includes('pvrplay')) return 'PixelFlix';
        if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';
        if (host.includes('instagram.com')) return 'Instagram';
        const parts = host.replace(/^www\./, '').split('.')[0];
        return parts ? parts.charAt(0).toUpperCase() + parts.slice(1) : 'Stream';
    }

    function getActiveAdapter() {
        const host = (window.location.hostname || '').toLowerCase();
        if (typeof window.InstagramAdapter !== 'undefined' && window.InstagramAdapter.matches(host)) return window.InstagramAdapter;
        if (typeof window.YouTubeAdapter !== 'undefined' && window.YouTubeAdapter.matches(host)) return window.YouTubeAdapter;
        if (typeof window.GenericAdapter !== 'undefined') return window.GenericAdapter;
        return null;
    }

    function checkStateChange() {
        const urlChanged = window.location.href !== currentUrl;
        const videoEl = window.MediaDetector ? window.MediaDetector.findActiveVideoElement() : document.querySelector('video');
        const currentSrc = videoEl ? (videoEl.currentSrc || videoEl.src || '') : '';
        const videoChanged = currentSrc && currentSrc !== activeVideoSource;

        if (urlChanged || videoChanged) {
            currentUrl = window.location.href;
            activeVideoSource = currentSrc;
            detectedUrls.clear();
            
            // Only top frame clears tab media on page navigation
            if (isTopFrame && urlChanged) {
                try {
                    chrome.runtime.sendMessage({ 
                        action: 'clearTabMedia', 
                        hostname: window.location.hostname,
                        pageUrl: window.location.href 
                    });
                } catch { }
            }
            triggerDebouncedScan(200);
        }
    }

    function triggerDebouncedScan(delay = 300) {
        if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
        scanDebounceTimer = setTimeout(scanAndBroadcast, delay);
    }

    function scanAndBroadcast() {
        const adapter = getActiveAdapter();
        if (!adapter) return;

        const siteName = getSiteName();
        const videoEl = window.MediaDetector ? window.MediaDetector.findActiveVideoElement() : document.querySelector('video');
        const metadata = adapter.extractMetadata();
        const domain = window.location.hostname.replace(/^www\./, '');
        const streams = adapter.findStreams(metadata);

        // Only top frame broadcasts tab title updates
        if (isTopFrame) {
            try {
                chrome.runtime.sendMessage({
                    action: 'updateTabTitle',
                    title: metadata.title,
                    metadata: { ...metadata, platform: siteName },
                    thumbnail: metadata.thumbnail,
                    pageUrl: window.location.href,
                    hostname: window.location.hostname,
                    site: siteName
                });
            } catch { }
        }

        // If video element exists but no stream was found yet (top frame only)
        if (isTopFrame && streams.length === 0 && (videoEl || adapter.name === 'YouTube' || adapter.name === 'Instagram')) {
            let durationStr = '';
            if (videoEl && videoEl.duration && !isNaN(videoEl.duration) && videoEl.duration !== Infinity) {
                const mins = Math.floor(videoEl.duration / 60);
                const secs = Math.floor(videoEl.duration % 60);
                durationStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            }

            let notice = '';
            if (adapter.name === 'YouTube') {
                notice = 'YouTube video detected — direct stream uses protected adaptive chunking (download unavailable).';
            } else if (adapter.name === 'Instagram') {
                notice = 'Instagram Reel detected — direct media stream is protected.';
            } else {
                notice = `${siteName} stream detected — waiting for media stream to buffer in player.`;
            }

            streams.push({
                url: '',
                duration: durationStr,
                thumbnail: metadata.thumbnail,
                format: 'MP4',
                platform: siteName,
                sourceSite: siteName,
                hostname: window.location.hostname,
                isYouTube: adapter.name === 'YouTube',
                isDirectMp4: adapter.name === 'Instagram',
                isDownloadable: false,
                isRestricted: (adapter.name === 'YouTube' || adapter.name === 'Instagram'),
                downloadNotice: notice
            });
        }

        // Report active streams to background with strict site tagging
        streams.forEach(stream => {
            const streamKey = stream.url || `${siteName}_active_video`;
            if (!detectedUrls.has(streamKey)) {
                detectedUrls.add(streamKey);
                try {
                    chrome.runtime.sendMessage({
                        action: 'videoDetected',
                        video: {
                            url: stream.url || '',
                            audioUrl: stream.audioUrl || '',
                            title: isTopFrame ? metadata.title : 'Video',
                            showName: isTopFrame ? metadata.showName : 'Video',
                            subtitle: isTopFrame ? metadata.subtitle : '',
                            season: isTopFrame ? metadata.season : undefined,
                            episode: isTopFrame ? metadata.episode : undefined,
                            episodeTitle: isTopFrame ? (metadata.episodeTitle || '') : '',
                            shortId: metadata.shortId || '',
                            domain: domain,
                            hostname: window.location.hostname,
                            sourceSite: siteName,
                            pageUrl: window.location.href,
                            thumbnail: stream.thumbnail || metadata.thumbnail || '',
                            duration: stream.duration || '',
                            format: stream.format || (stream.url?.includes('.m3u8') ? 'HLS' : 'MP4'),
                            resolution: stream.resolution || '',
                            platform: siteName,
                            isDirectMp4: stream.isDirectMp4 || false,
                            isYouTube: adapter.name === 'YouTube',
                            isDownloadable: stream.isDownloadable || false,
                            isRestricted: stream.isRestricted || false,
                            downloadNotice: stream.downloadNotice || ''
                        }
                    });
                } catch { }
            }
        });
    }

    // ─── SPA HISTORY MONKEY-PATCHING ──────────────────────────────────────────
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
        originalPushState.apply(this, args);
        checkStateChange();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);
        checkStateChange();
    };

    // ─── EVENT LISTENERS (SCROLL, SPA, DOM) ───────────────────────────────────
    window.addEventListener('popstate', checkStateChange);
    window.addEventListener('hashchange', checkStateChange);
    window.addEventListener('yt-navigate-finish', checkStateChange);
    window.addEventListener('scroll', () => triggerDebouncedScan(350), { passive: true });

    // MutationObserver on DOM
    const observer = new MutationObserver(() => {
        checkStateChange();
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    // Lightweight interval for active video check
    setInterval(checkStateChange, 1200);

    scanAndBroadcast();

    // ─── IN-TAB SESSION FETCHER (Natively attaches page Referer & Origin) ──────
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        if (req.action === 'scanPage' || req.action === 'getPageMetadata') {
            checkStateChange();
            const adapter = getActiveAdapter();
            if (adapter) {
                const siteName = getSiteName();
                const meta = adapter.extractMetadata();
                const streams = adapter.findStreams(meta);
                scanAndBroadcast();
                sendResponse({
                    scanned: true,
                    metadata: { ...meta, platform: siteName },
                    streams: streams,
                    thumbnail: meta.thumbnail,
                    pageUrl: window.location.href,
                    hostname: window.location.hostname,
                    site: siteName
                });
            } else {
                sendResponse({ scanned: false });
            }
        } else if (req.action === 'fetchInTabContext') {
            fetch(req.url, { credentials: 'omit' })
                .then(async (res) => {
                    const cType = (res.headers.get('content-type') || '').toLowerCase();
                    const text = await res.text();
                    sendResponse({
                        success: res.ok,
                        status: res.status,
                        contentType: cType,
                        text: text
                    });
                })
                .catch(err => {
                    sendResponse({ success: false, error: err.message });
                });
            return true;
        }
        return true;
    });
})();
