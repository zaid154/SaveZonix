// src/content/content.js — Stealth Content Script (Zero DOM Tampering & Completely Undetectable)

(function () {
    const isTopFrame = (window.top === window.self);
    let currentUrl = window.location.href;
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

    function scanAndBroadcast() {
        const adapter = getActiveAdapter();
        if (!adapter) return;

        const siteName = getSiteName();
        const metadata = adapter.extractMetadata();
        const domain = window.location.hostname.replace(/^www\./, '');
        const streams = adapter.findStreams(metadata);

        // Broadcast metadata only from top frame without modifying page objects
        if (isTopFrame && metadata && metadata.title && metadata.title !== 'Video') {
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

        // Report active streams
        streams.forEach(stream => {
            if (stream.url && stream.url.startsWith('http')) {
                try {
                    chrome.runtime.sendMessage({
                        action: 'videoDetected',
                        video: {
                            url: stream.url,
                            audioUrl: stream.audioUrl || '',
                            title: isTopFrame ? metadata.title : 'Video',
                            showName: isTopFrame ? metadata.showName : 'Video',
                            subtitle: isTopFrame ? metadata.subtitle : '',
                            season: isTopFrame ? metadata.season : undefined,
                            episode: isTopFrame ? metadata.episode : undefined,
                            episodeTitle: isTopFrame ? (metadata.episodeTitle || '') : '',
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

    function triggerDebouncedScan(delay = 400) {
        if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
        scanDebounceTimer = setTimeout(scanAndBroadcast, delay);
    }

    // Passive Standard Event Listeners (Zero prototype monkey-patching)
    window.addEventListener('popstate', () => triggerDebouncedScan(300), { passive: true });
    window.addEventListener('hashchange', () => triggerDebouncedScan(300), { passive: true });

    // Initial passive scan once DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => triggerDebouncedScan(500));
    } else {
        triggerDebouncedScan(300);
    }

    // Instagram SPA Scroll & Active Reel Change Detector
    if (isTopFrame && window.location.hostname.toLowerCase().includes('instagram.com')) {
        const scheduleInstagramScan = () => triggerDebouncedScan(200);
        const observer = new MutationObserver(scheduleInstagramScan);

        const observePage = () => {
            if (!document.documentElement) return;
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src', 'poster', 'href']
            });
        };

        if (document.documentElement) observePage();
        else document.addEventListener('DOMContentLoaded', observePage, { once: true });

        // Listen for scroll & wheel events
        window.addEventListener('scroll', scheduleInstagramScan, { passive: true });
        window.addEventListener('wheel', scheduleInstagramScan, { passive: true });
        window.addEventListener('touchmove', scheduleInstagramScan, { passive: true });
        window.addEventListener('playing', scheduleInstagramScan, { capture: true, passive: true });
        window.addEventListener('loadedmetadata', scheduleInstagramScan, { capture: true, passive: true });

        // IntersectionObserver on all videos to instantly detect active in-view reel
        let videoIo = null;
        try {
            videoIo = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                        triggerDebouncedScan(100);
                    }
                }
            }, { threshold: [0.5, 0.8] });

            const registerVideos = () => {
                document.querySelectorAll('video').forEach(v => {
                    try { videoIo.observe(v); } catch { }
                });
            };
            registerVideos();
            setInterval(registerVideos, 1000);
        } catch { }

        // Fast URL Pathname Poller (Detects Instagram Next Reel transitions in 300ms)
        let lastKnownPath = window.location.pathname;
        setInterval(() => {
            if (window.location.pathname !== lastKnownPath) {
                lastKnownPath = window.location.pathname;
                triggerDebouncedScan(150);
            }
        }, 300);

        // Check video signature
        let lastVideoSignature = '';
        setInterval(() => {
            const adapter = getActiveAdapter();
            const video = adapter?.getActiveVideo ? adapter.getActiveVideo() : document.querySelector('video');
            const signature = video ? `${video.currentSrc || video.src || ''}|${video.poster || ''}` : '';
            if (signature && signature !== lastVideoSignature) {
                lastVideoSignature = signature;
                triggerDebouncedScan(100);
            }
        }, 600);
    }

    // Respond on-demand to popup or background queries
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        if (req.action === 'scanPage' || req.action === 'getPageMetadata') {
            const adapter = getActiveAdapter();
            if (adapter) {
                const siteName = getSiteName();
                const meta = adapter.extractMetadata();
                const streams = adapter.findStreams(meta);
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
        } else if (req.action === 'getYoutubeQueue') {
            const adapter = getActiveAdapter();
            if (adapter && adapter.name === 'YouTube' && typeof adapter.extractQueue === 'function') {
                const queue = adapter.extractQueue();
                sendResponse({ success: true, queue: queue, count: queue.length });
            } else {
                sendResponse({ success: false, queue: [], count: 0 });
            }
            return true;
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

    // Bridge the SaveZonix dashboard to the extension. A server (local or
    // Render) cannot read the user's Instagram cookies or network resources,
    // but the extension can obtain the fresh signed stream from the
    // already-open reel tab. Keep this restricted to the dashboard origins so
    // arbitrary web pages cannot request the user's captured media URLs.
    const dashboardHosts = new Set(['localhost', '127.0.0.1', 'zonix-downloader.onrender.com']);
    const isSaveZonixDashboard = dashboardHosts.has(window.location.hostname);
    if (isTopFrame && isSaveZonixDashboard) {
        window.addEventListener('message', (event) => {
            if (event.source !== window || event.origin !== window.location.origin) return;
            const data = event.data;
            if (!data || data.source !== 'SaveZonixDashboard' || !data.url ||
                (data.type !== 'resolveInstagram' && data.type !== 'resolvePage')) return;

            const action = data.type === 'resolveInstagram' ? 'resolveInstagramForDashboard' : 'resolvePageForDashboard';
            chrome.runtime.sendMessage({ action, url: data.url }, (response) => {
                window.postMessage({
                    source: 'SaveZonixExtension',
                    type: data.type === 'resolveInstagram' ? 'instagramResolved' : 'pageResolved',
                    requestId: data.requestId,
                    response: response || { success: false, message: chrome.runtime.lastError?.message || 'Extension did not return a stream.' }
                }, window.location.origin);
            });
        });
    }
})();
