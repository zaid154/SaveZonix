// src/background/service-worker.js — Pure Native Stealth Stream Sniffer (Manifest V3)

// Smart Dynamic Header Spoofing for Downloader Tab (Bypasses Hotlink Protection on phncdn, xnxx, pixelflix)
if (chrome.declarativeNetRequest) {
    chrome.declarativeNetRequest.getDynamicRules().then(rules => {
        const ids = rules.map(r => r.id);
        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ids,
            addRules: [
                // 1. Pornhub CDN Rule
                {
                    id: 2001,
                    priority: 2,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [
                            { header: 'Origin', operation: 'set', value: 'https://www.pornhub.org' },
                            { header: 'Referer', operation: 'set', value: 'https://www.pornhub.org/' }
                        ]
                    },
                    condition: {
                        initiatorDomains: [chrome.runtime.id],
                        urlFilter: 'phncdn.com',
                        resourceTypes: ['xmlhttprequest', 'media', 'other']
                    }
                },
                // 2. XNXX / XVideos CDN Rule
                {
                    id: 2002,
                    priority: 2,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [
                            { header: 'Origin', operation: 'set', value: 'https://www.xnxx.com' },
                            { header: 'Referer', operation: 'set', value: 'https://www.xnxx.com/' }
                        ]
                    },
                    condition: {
                        initiatorDomains: [chrome.runtime.id],
                        urlFilter: 'xnxx-cdn.com',
                        resourceTypes: ['xmlhttprequest', 'media', 'other']
                    }
                },
                // 3. PixelFlix / PvrPlay Rule
                {
                    id: 2003,
                    priority: 2,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [
                            { header: 'Origin', operation: 'set', value: 'https://pixelflix.cc' },
                            { header: 'Referer', operation: 'set', value: 'https://pixelflix.cc/' }
                        ]
                    },
                    condition: {
                        initiatorDomains: [chrome.runtime.id],
                        urlFilter: 'pixelflix.cc',
                        resourceTypes: ['xmlhttprequest', 'media', 'other']
                    }
                },
                // 4. Generic Rule (Strip extension origin for all other CDNs)
                {
                    id: 2004,
                    priority: 1,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [
                            { header: 'Origin', operation: 'remove' },
                            { header: 'Referer', operation: 'remove' }
                        ]
                    },
                    condition: {
                        initiatorDomains: [chrome.runtime.id],
                        resourceTypes: ['xmlhttprequest', 'media', 'other']
                    }
                }
            ]
        }).catch(() => { });
    }).catch(() => { });
}

// Strictly match genuine video master manifests and direct video containers
const MEDIA_URL_REGEX = /(\.m3u8|\.mp4|\.webm|\.m4v|\/hls\/|videoplayback|serve_m3u8|proxy\.php\?url=)/i;

function getStreamPriorityScore(url) {
    if (!url || typeof url !== 'string') return 0;
    const clean = url.split('?')[0].toLowerCase();
    
    // Higher priority for full main movie / episode HLS playlists
    if (url.includes('/videos/') && (clean.endsWith('.m3u8') || url.includes('/hls/'))) return 120;
    if (clean.endsWith('.m3u8') || url.includes('.m3u8') || url.includes('/hls/') || url.includes('serve_m3u8')) return 100;
    if (url.includes('/videos/') && (clean.endsWith('.mp4') || clean.endsWith('.webm'))) return 95;
    if (clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.m4v')) return 90;
    if (url.includes('googlevideo.com/videoplayback')) return 80;
    if (clean.endsWith('.mpd') || url.includes('.mpd')) return 70;
    return 10;
}

function isSegmentOrInvalid(url) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return true;
    
    const lower = url.toLowerCase();
    const clean = lower.split('?')[0];
    
    // 1. Strict rejection of individual transport stream segments & chunk slices
    if (clean.endsWith('.ts') || 
        clean.endsWith('.m4s') || 
        clean.endsWith('.mp4s') || 
        lower.includes('seg-') || 
        lower.includes('seg_') || 
        lower.includes('/segment') || 
        lower.includes('/fragment') || 
        lower.includes('/chunk_') || 
        lower.includes('range=')) {
        return true;
    }

    // 2. Strict non-media file & webpage rejection
    if (clean.endsWith('.html') || 
        clean.endsWith('.htm') || 
        clean.endsWith('.php') || 
        clean.endsWith('.js') || 
        clean.endsWith('.css') || 
        clean.endsWith('.xml') || 
        clean.endsWith('.json') || 
        clean.endsWith('.txt') || 
        clean.endsWith('.png') || 
        clean.endsWith('.jpg') || 
        clean.endsWith('.jpeg') || 
        clean.endsWith('.gif') || 
        clean.endsWith('.svg') || 
        clean.endsWith('.webp') || 
        clean.endsWith('.ico') || 
        clean.endsWith('.vtt') || 
        clean.endsWith('.srt') || 
        clean.endsWith('.key') || 
        clean.endsWith('.wasm') || 
        clean.endsWith('.woff') || 
        clean.endsWith('.woff2') || 
        clean.endsWith('.ttf') || 
        clean.endsWith('.eot') || 
        clean.endsWith('.map')) {
        return true;
    }

    // 3. Reject Ad Networks, Preroll Video Ads & Sponsored Clips
    if (lower.includes('trafficjunky') || 
        lower.includes('doubleclick.net') || 
        lower.includes('googlesyndication') || 
        lower.includes('exoclick') || 
        lower.includes('juicyads') || 
        lower.includes('tsyndicate') || 
        lower.includes('ero-advertising') || 
        lower.includes('adxpansion') || 
        lower.includes('etahub') || 
        lower.includes('/preroll') || 
        lower.includes('/midroll') || 
        lower.includes('/postroll') || 
        lower.includes('/vast/') || 
        lower.includes('/vpaid/') || 
        lower.includes('ad_system') || 
        lower.includes('delivery.trafficjunky') || 
        lower.includes('creative.trafficjunky') || 
        lower.includes('/ads/') || 
        lower.includes('ad_type=preroll')) {
        return true;
    }

    // 4. Rejection of tiny animated hover previews and trailers
    if (clean.includes('_preview') || clean.includes('/preview/') || clean.includes('trailer.mp4') || 
        clean.includes('sample.mp4') || clean.includes('thumbnail.mp4') || clean.includes('preview.mp4')) {
        return true;
    }

    if (lower.includes('/subtitles/') || lower.includes('/captions/') || lower.includes('format=xml') || lower.includes('type=xml')) {
        return true;
    }

    return false;
}

const tabTitles = {};
const tabThumbnails = {};
const activeDownloads = {};

async function addDetectedVideo(tabId, videoData) {
    if (!videoData || !videoData.url) return;
    if (isSegmentOrInvalid(videoData.url)) return;

    if (!tabId || tabId < 0) {
        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab?.id) tabId = activeTab.id;
            else return;
        } catch {
            return;
        }
    }

    const key = `tab_media_${tabId}`;
    let list = [];
    try {
        const stored = await chrome.storage.local.get([key]);
        if (stored[key] && Array.isArray(stored[key])) {
            list = stored[key];
        }
    } catch { }

    const exists = list.some(item => item.url === videoData.url);
    if (!exists) {
        if (!videoData.title && tabTitles[tabId]) {
            videoData.title = tabTitles[tabId];
        }
        if (!videoData.thumbnail && tabThumbnails[tabId]) {
            videoData.thumbnail = tabThumbnails[tabId];
        }

        list.push(videoData);

        // Sort strictly so full main video stream is ALWAYS candidate 0
        list.sort((a, b) => getStreamPriorityScore(b.url) - getStreamPriorityScore(a.url));

        const obj = {};
        obj[key] = list;
        await chrome.storage.local.set(obj);

        // Keep clean badge count: "1" for detected video on active tab
        chrome.action.setBadgeText({ tabId, text: list.length > 0 ? '1' : '' });
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#3fb950' });

        try {
            chrome.runtime.sendMessage({ action: 'videosUpdated', tabId, videos: list }).catch(() => { });
        } catch { }
    }
}

// ─── TAB LIFECYCLE MANAGEMENT ─────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading') {
        const key = `tab_media_${tabId}`;
        chrome.storage.local.remove([key]);
        delete tabTitles[tabId];
        delete tabThumbnails[tabId];
        chrome.action.setBadgeText({ tabId, text: '' });
    }

    if (tab.title) {
        let clean = tab.title
            .replace(/^Watch\s+/i, '')
            .replace(/\s*[-|–—]\s*(Pornhub\.com|Pornhub|XNXX\.COM|XNXX|XVideos\.com|XVideos|PixelFlix|YouTube|Instagram|PvrPlay).*$/i, '')
            .replace(/[\\/:*?"<>|\r\n\t]+/g, ' ')
            .trim();
        if (clean && clean.length > 2) {
            tabTitles[tabId] = clean;
        }
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    const key = `tab_media_${tabId}`;
    chrome.storage.local.remove([key]);
    delete tabTitles[tabId];
    delete tabThumbnails[tabId];
});

// ─── PURE NETWORK SNIFFING (Zero Performance Impact) ─────────────────────
// 1. Passive Background Request Sniffing
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.type === 'main_frame' || details.type === 'sub_frame') return;
        if (isSegmentOrInvalid(details.url)) return;

        if (details.url && MEDIA_URL_REGEX.test(details.url) && !isSegmentOrInvalid(details.url)) {
            let domain = 'pixelflix.cc';
            try { domain = new URL(details.url).hostname.replace(/^www\./, ''); } catch { }

            const isInstaCdn = details.url.includes('cdninstagram.com') || details.url.includes('fbcdn.net');
            const isYtCdn = details.url.includes('googlevideo.com');
            const isPhCdn = details.url.includes('phncdn.com') || details.url.includes('pornhub.com');
            const isXnxxCdn = details.url.includes('xnxx-cdn.com') || details.url.includes('xnxx.com') || details.url.includes('xvideos');

            let platformName = 'PixelFlix';
            if (isInstaCdn) platformName = 'Instagram';
            else if (isYtCdn) platformName = 'YouTube';
            else if (isPhCdn) platformName = 'Pornhub';
            else if (isXnxxCdn) platformName = 'XNXX';

            addDetectedVideo(details.tabId, {
                url: details.url,
                domain: domain,
                format: (details.url.includes('.m3u8') || details.url.includes('/hls/') || details.url.includes('serve_m3u8')) ? 'HLS' : (details.url.includes('.mpd') ? 'DASH' : 'MP4'),
                platform: platformName,
                isYouTube: isYtCdn,
                isDirectMp4: isInstaCdn || details.url.includes('.mp4'),
                isDownloadable: !isYtCdn
            });
        }
    },
    { urls: ["<all_urls>"] }
);

// 2. Passive Background Response Header Sniffing
chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (!details.responseHeaders) return;
        if (details.type === 'main_frame' || details.type === 'sub_frame') return;
        if (isSegmentOrInvalid(details.url)) return;

        const ctHeader = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
        if (!ctHeader || !ctHeader.value) return;

        const cType = ctHeader.value.toLowerCase();

        // Strictly reject non-media response types and segment chunks
        if (cType.includes('text/xml') || 
            cType.includes('application/xml') || 
            cType.includes('text/html') || 
            cType.includes('application/json') ||
            cType.includes('video/mp2t')) { // video/mp2t is an internal .ts segment, not a master manifest
            return;
        }

        // Accept confirmed media content types
        const isHls = cType.includes('application/vnd.apple.mpegurl') || 
                      cType.includes('application/x-mpegurl') || 
                      cType.includes('audio/mpegurl') ||
                      details.url.includes('.m3u8') ||
                      details.url.includes('serve_m3u8');
        const isMp4 = cType.includes('video/mp4') || cType.includes('video/webm');

        if (isHls || isMp4) {
            let domain = 'pixelflix.cc';
            try { domain = new URL(details.url).hostname.replace(/^www\./, ''); } catch { }

            const isInstaCdn = details.url.includes('cdninstagram.com') || details.url.includes('fbcdn.net');
            const isYtCdn = details.url.includes('googlevideo.com');
            const isPhCdn = details.url.includes('phncdn.com') || details.url.includes('pornhub.com');
            const isXnxxCdn = details.url.includes('xnxx-cdn.com') || details.url.includes('xnxx.com') || details.url.includes('xvideos');

            let platformName = 'PixelFlix';
            if (isInstaCdn) platformName = 'Instagram';
            else if (isYtCdn) platformName = 'YouTube';
            else if (isPhCdn) platformName = 'Pornhub';
            else if (isXnxxCdn) platformName = 'XNXX';

            addDetectedVideo(details.tabId, {
                url: details.url,
                domain: domain,
                format: isHls ? 'HLS' : 'MP4',
                platform: platformName,
                isYouTube: isYtCdn,
                isDirectMp4: isInstaCdn || isMp4,
                isDownloadable: !isYtCdn
            });
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);

// Message Broker
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    const tabId = sender.tab ? sender.tab.id : -1;

    if (req.action === 'videoDetected') {
        addDetectedVideo(tabId, req.video);
        sendResponse({ success: true });
    } else if (req.action === 'updateTabTitle') {
        if (tabId > 0 && req.title) {
            let clean = req.title
                .replace(/^Watch\s+/i, '')
                .replace(/\s*[-|–—]\s*(Pornhub\.com|Pornhub|XNXX\.COM|XNXX|XVideos\.com|XVideos|PixelFlix|YouTube|Instagram|PvrPlay).*$/i, '')
                .replace(/[\\/:*?"<>|\r\n\t]+/g, ' ')
                .trim();
            if (clean && clean.length > 2) {
                tabTitles[tabId] = clean;
            }
        }
        sendResponse({ success: true });
    } else if (req.action === 'updateTabThumbnail') {
        if (tabId > 0 && req.thumbnail) {
            tabThumbnails[tabId] = req.thumbnail;
        }
        sendResponse({ success: true });
    } else if (req.action === 'openDownloaderTab') {
        const p = new URLSearchParams();
        p.set('url', req.url || '');
        p.set('title', req.title || 'Video');
        p.set('showName', req.showName || req.title || 'Video');
        p.set('quality', req.quality || '1080p Full HD');
        p.set('platform', req.platform || 'PixelFlix');
        p.set('thumbnail', req.thumbnail || '');
        p.set('threads', req.threads || '4');
        if (req.season) p.set('season', String(req.season));
        if (req.episode) p.set('episode', String(req.episode));
        if (req.episodeTitle) p.set('episodeTitle', req.episodeTitle);
        if (req.tabId) p.set('tabId', String(req.tabId));

        const hubUrl = chrome.runtime.getURL(`src/downloader/downloader.html?${p.toString()}`);
        chrome.tabs.create({ url: hubUrl });
        sendResponse({ success: true });
    }
    return true;
});
