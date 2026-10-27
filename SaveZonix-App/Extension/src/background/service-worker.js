// src/background/service-worker.js — Pure Native Stealth Stream Sniffer (Manifest V3)

// Automatically open feedback survey on live Vercel site when extension is uninstalled
try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.setUninstallURL) {
        chrome.runtime.setUninstallURL('https://savezonix-pro.vercel.app/feedback?source=extension');
    }
} catch (e) {
    console.warn('[SaveZonix] Failed to configure uninstall feedback URL:', e);
}

// Smart Dynamic Header Spoofing for Downloader Tab (Bypasses Hotlink Protection on phncdn, xnxx, pixelflix)
if (chrome.declarativeNetRequest) {
    chrome.declarativeNetRequest.getDynamicRules().then(rules => {
        const ids = rules.map(r => r.id);
        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ids,
            addRules: [
                // 1. Pornhub CDN Rule (only for non-pornhub initiators like extension downloader)
                {
                    id: 2001,
                    priority: 5,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [
                            { header: 'Origin', operation: 'set', value: 'https://www.pornhub.com' },
                            { header: 'Referer', operation: 'set', value: 'https://www.pornhub.com/' }
                        ]
                    },
                    condition: {
                        urlFilter: 'phncdn.com',
                        excludedInitiatorDomains: ['pornhub.com', 'pornhub.org', 'phncdn.com', 'pornhubpremium.com'],
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
                        urlFilter: 'xnxx-cdn.com',
                        excludedInitiatorDomains: ['xnxx.com', 'xnxx-cdn.com', 'xvideos.com', 'xvideos-cdn.com'],
                        resourceTypes: ['xmlhttprequest', 'media', 'other']
                    }
                },
                // 3. xHamster xhcdn CDN Rule
                {
                    id: 2003,
                    priority: 2,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [
                            { header: 'Origin', operation: 'set', value: 'https://xhamster.com' },
                            { header: 'Referer', operation: 'set', value: 'https://xhamster.com/' }
                        ]
                    },
                    condition: {
                        urlFilter: 'xhcdn.com',
                        excludedInitiatorDomains: ['xhamster.com', 'xhamster.desi', 'xhamster1.desi', 'xhamster2.com', 'xhamster3.com', 'xhcdn.com', 'xhpingcdn.com'],
                        resourceTypes: ['xmlhttprequest', 'media', 'other']
                    }
                },
                // 4. Instagram CDN Rule
                {
                    id: 2004,
                    priority: 2,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [
                            { header: 'Origin', operation: 'set', value: 'https://www.instagram.com' },
                            { header: 'Referer', operation: 'set', value: 'https://www.instagram.com/' }
                        ]
                    },
                    condition: {
                        urlFilter: 'cdninstagram.com',
                        excludedInitiatorDomains: ['instagram.com', 'cdninstagram.com', 'facebook.com'],
                        resourceTypes: ['xmlhttprequest', 'media', 'other']
                    }
                },
                // 5. SpankBang CDN Rule
                {
                    id: 2005,
                    priority: 2,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [
                            { header: 'Origin', operation: 'set', value: 'https://spankbang.party' },
                            { header: 'Referer', operation: 'set', value: 'https://spankbang.party/' }
                        ]
                    },
                    condition: {
                        urlFilter: 'sb-cd.com',
                        excludedInitiatorDomains: ['spankbang.com', 'spankbang.party', 'sb-cd.com'],
                        resourceTypes: ['xmlhttprequest', 'media', 'other']
                    }
                },
                // 6. Mat6tube / PvvStream Rule
                {
                    id: 2006,
                    priority: 2,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [
                            { header: 'Origin', operation: 'set', value: 'https://mat6tube.com' },
                            { header: 'Referer', operation: 'set', value: 'https://mat6tube.com/' }
                        ]
                    },
                    condition: {
                        urlFilter: 'pvvstream.pro',
                        excludedInitiatorDomains: ['mat6tube.com', 'pvvstream.pro'],
                        resourceTypes: ['xmlhttprequest', 'media', 'other']
                    }
                },
                // 7. OKXXX Rule
                {
                    id: 2007,
                    priority: 2,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [
                            { header: 'Origin', operation: 'set', value: 'https://okxxx1.com' },
                            { header: 'Referer', operation: 'set', value: 'https://okxxx1.com/' }
                        ]
                    },
                    condition: {
                        urlFilter: 'okxxx1.com',
                        excludedInitiatorDomains: ['okxxx1.com', 'ok.xxx', 'okxxx.com'],
                        resourceTypes: ['xmlhttprequest', 'media', 'other']
                    }
                },
                // 8. OKXXX PhCdn Segment Rule
                {
                    id: 2008,
                    priority: 1,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [
                            { header: 'Origin', operation: 'set', value: 'https://okxxx1.com' },
                            { header: 'Referer', operation: 'set', value: 'https://okxxx1.com/' }
                        ]
                    },
                    condition: {
                        urlFilter: 'phcdn',
                        excludedRequestDomains: ['phncdn.com'],
                        excludedInitiatorDomains: ['okxxx1.com', 'ok.xxx', 'pornhub.com', 'pornhub.org', 'phncdn.com'],
                        resourceTypes: ['xmlhttprequest', 'media', 'other']
                    }
                },
                // 9. xHamster xhpingcdn CDN Rule
                {
                    id: 2009,
                    priority: 3,
                    action: {
                        type: 'modifyHeaders',
                        requestHeaders: [
                            { header: 'Origin', operation: 'set', value: 'https://xhamster1.desi' },
                            { header: 'Referer', operation: 'set', value: 'https://xhamster1.desi/' }
                        ]
                    },
                    condition: {
                        urlFilter: 'xhpingcdn.com',
                        excludedInitiatorDomains: ['xhamster.com', 'xhamster.desi', 'xhamster1.desi', 'xhamster2.com', 'xhamster3.com', 'xhcdn.com', 'xhpingcdn.com'],
                        resourceTypes: ['xmlhttprequest', 'media', 'other']
                    }
                }
            ]
        }).catch(() => { });
    }).catch(() => { });
}

// Strictly match genuine video master manifests and direct video containers
const MEDIA_URL_REGEX = /(\.m3u8|\.mp4|\.webm|\.m4v|\/hls\/|\/get_file\/|videoplayback|serve_m3u8|proxy\.php\?url=|cdninstagram\.com\/(?:o1\/)?v\/|fbcdn\.net\/o1\/v\/|fbcdn\.net\/v\/)/i;

function normalizeInstagramMediaUrl(url) {
    if (!url || (!url.includes('cdninstagram.com') && !url.includes('fbcdn.net'))) return url;
    try {
        const parsed = new URL(url);
        parsed.searchParams.delete('bytestart');
        parsed.searchParams.delete('byteend');
        parsed.searchParams.delete('range');
        return parsed.href;
    } catch {
        return url;
    }
}

function isInstagramAudioUrl(url) {
    if (!url) return false;
    let value = url.toLowerCase();
    try { value = decodeURIComponent(value); } catch { }
    return value.includes('mime=audio') ||
        value.includes('mime%3daudio') ||
        value.includes('audio_only') ||
        value.includes('audio.mp4') ||
        value.includes('audio/mp4');
}

function getStreamPriorityScore(url) {
    if (!url || typeof url !== 'string') return 0;
    const clean = url.split('?')[0].replace(/\/+$/, '').toLowerCase();
    
    // Higher priority for full main movie / episode HLS playlists
    if (url.includes('/videos/') && (clean.endsWith('.m3u8') || url.includes('/hls/'))) return 120;
    if (clean.endsWith('.m3u8') || url.includes('.m3u8') || url.includes('/hls/') || url.includes('serve_m3u8')) return 100;
    if ((url.includes('/videos/') || url.includes('/get_file/')) && (clean.endsWith('.mp4') || clean.endsWith('.webm'))) return 95;
    if (clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.m4v')) return 90;
    if (url.includes('googlevideo.com/videoplayback')) return 80;
    if (clean.endsWith('.mpd') || url.includes('.mpd')) return 70;
    return 10;
}

function isSegmentOrInvalid(url) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return true;
    
    const lower = url.toLowerCase();
    const clean = lower.split('?')[0].replace(/\/+$/, '');
    
    const isInstagramMedia = lower.includes('cdninstagram.com') || lower.includes('fbcdn.net');

    // 1. Strict rejection of individual transport stream segments & chunk slices.
    // Instagram's progressive MP4 URLs legitimately use bytestart/byteend for
    // its initial player request, so they must be normalized rather than dropped.
    if (clean.endsWith('.ts') || 
        clean.endsWith('.m4s') || 
        clean.endsWith('.mp4s') || 
        lower.includes('seg-') || 
        lower.includes('seg_') || 
        lower.includes('/segment') || 
        lower.includes('/fragment') || 
        lower.includes('/chunk_') || 
        (!isInstagramMedia && lower.includes('bytestart=')) ||
        (!isInstagramMedia && lower.includes('byteend=')) ||
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

    // 4. Rejection of image thumbnails and sprite previews (only if not a video format)
    if (!clean.endsWith('.m3u8') && !clean.endsWith('.mp4') && !clean.endsWith('.webm')) {
        if (clean.includes('_preview') || clean.includes('/preview/') || clean.includes('trailer.mp4') || 
            clean.includes('sample.mp4') || clean.includes('thumbnail.mp4') || clean.includes('preview.mp4')) {
            return true;
        }
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

    const isInstagramStream = videoData.platform === 'Instagram' ||
        videoData.url.includes('cdninstagram.com') || videoData.url.includes('fbcdn.net');

    // Instagram may request a separate audio rendition after the visible MP4.
    // It is not a standalone reel and must never replace the video card.
    const isInstagramAudioOnly = isInstagramStream && isInstagramAudioUrl(videoData.url);
    if (isInstagramAudioOnly) return;

    const isExistingInstagram = item => {
        const url = item?.url || '';
        return item?.platform === 'Instagram' || url.includes('cdninstagram.com') || url.includes('fbcdn.net');
    };

    // A DOM scan of the visible reel is more reliable than a delayed network
    // request from the previous/next preloaded reel. Do not let such a request
    // overwrite the stream that the active Instagram player already reported.
    if (isInstagramStream && !videoData.isActivePageStream && list.some(item => isExistingInstagram(item) && item.isActivePageStream)) {
        return;
    }

    // Reels pages retain adjacent videos in the DOM while scrolling. Keep the
    // current Instagram stream as the single candidate instead of showing a
    // stale reel from the previous viewport in the popup.
    if (isInstagramStream) {
        list = list.filter(item => {
            return !isExistingInstagram(item);
        });
    }

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

async function resolveInstagramForDashboard(pageUrl) {
    let shortcode = '';
    try {
        const parts = new URL(pageUrl).pathname.split('/').filter(Boolean);
        const idx = parts.findIndex(p => p === 'reel' || p === 'reels' || p === 'p');
        shortcode = idx >= 0 ? (parts[idx + 1] || '') : '';
    } catch { }

    if (!shortcode) return { success: false, message: 'Invalid Instagram reel URL.' };

    const tabs = await chrome.tabs.query({ url: ['*://instagram.com/*', '*://*.instagram.com/*'] });
    const reelTab = tabs.find(tab => {
        try {
            const parts = new URL(tab.url || '').pathname.split('/').filter(Boolean);
            const idx = parts.findIndex(p => p === 'reel' || p === 'reels' || p === 'p');
            return idx >= 0 && parts[idx + 1] === shortcode;
        } catch {
            return false;
        }
    });
    if (!reelTab?.id) {
        return { success: false, message: 'Open this reel in Instagram, play it briefly, then retry here.' };
    }

    const scanPage = () => new Promise(resolve => {
        chrome.tabs.sendMessage(reelTab.id, { action: 'scanPage' }, response => {
            resolve(chrome.runtime.lastError ? null : response);
        });
    });
    const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const getStoredStream = async () => {
        try {
            const key = `tab_media_${reelTab.id}`;
            const stored = await chrome.storage.local.get([key]);
            return (stored[key] || []).find(item => item.url && item.url.startsWith('http') && item.isDownloadable !== false) || null;
        } catch {
            return null;
        }
    };

    // A direct scan can happen before Instagram has attached its signed CDN
    // source. Retry briefly: this covers Reels whose public embed reports
    // copyright_blocked or omits video_url, while using only the user's open
    // and playable Instagram tab.
    let scan = null;
    let stream = null;
    for (let attempt = 0; attempt < 12 && !stream; attempt++) {
        scan = await scanPage();
        stream = scan?.streams?.find(item => item.url && item.url.startsWith('http') && item.isDownloadable !== false) || null;
        if (!stream) stream = await getStoredStream();
        if (!stream && attempt < 11) await delay(500);
    }

    if (!stream) {
        return { success: false, message: "Instagram has not exposed this Reel's media stream yet. Keep the Reel tab open, start playback, and retry." };
    }

    return {
        success: true,
        url: normalizeInstagramMediaUrl(stream.url),
        audioUrl: stream.audioUrl ? normalizeInstagramMediaUrl(stream.audioUrl) : '',
        title: scan?.metadata?.title || 'Instagram Reel',
        thumbnail: stream.thumbnail || scan?.thumbnail || scan?.metadata?.thumbnail || '',
        duration: stream.duration || '',
        resolution: stream.resolution || '',
        platform: 'Instagram'
    };
}

async function resolvePageForDashboard(pageUrl) {
    let requested;
    try { requested = new URL(pageUrl); } catch { return { success: false, message: 'Invalid page URL.' }; }

    const tabs = await chrome.tabs.query({ url: ['<all_urls>'] });
    const sourceTab = tabs.find(tab => {
        try {
            const candidate = new URL(tab.url || '');
            return candidate.hostname === requested.hostname && candidate.pathname === requested.pathname;
        } catch {
            return false;
        }
    });
    if (!sourceTab?.id) return { success: false, message: 'Open this video page in Chrome and start playback, then retry.' };

    const scanPage = () => new Promise(resolve => {
        chrome.tabs.sendMessage(sourceTab.id, { action: 'scanPage' }, response => resolve(chrome.runtime.lastError ? null : response));
    });
    const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    let scan = null;
    let stream = null;
    for (let attempt = 0; attempt < 8 && !stream; attempt++) {
        scan = await scanPage();
        stream = scan?.streams?.find(item => item.url && item.url.startsWith('http') && item.isDownloadable !== false) || null;
        if (!stream && attempt < 7) await delay(500);
    }
    if (!stream) return { success: false, message: 'The browser has not exposed a playable stream yet. Start the video and retry.' };

    return {
        success: true,
        url: stream.url,
        audioUrl: stream.audioUrl || '',
        title: scan?.metadata?.title || 'Video',
        thumbnail: stream.thumbnail || scan?.thumbnail || scan?.metadata?.thumbnail || '',
        duration: stream.duration || '',
        resolution: stream.resolution || '',
        platform: scan?.site || requested.hostname
    };
}

// âââ TAB LIFECYCLE MANAGEMENT âââââââââââââââââââââââââââââââââââââââââââââ
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

// âââ PURE NETWORK SNIFFING (Zero Performance Impact) âââââââââââââââââââââ
// 1. Passive Background Request Sniffing
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.type === 'main_frame' || details.type === 'sub_frame') return;
        if (isSegmentOrInvalid(details.url)) return;

        if (details.url && MEDIA_URL_REGEX.test(details.url) && !isSegmentOrInvalid(details.url)) {
            let domain = 'pixelflix.cc';
            try { domain = new URL(details.url).hostname.replace(/^www\./, ''); } catch { }

            const isInstaCdn = details.url.includes('cdninstagram.com') || details.url.includes('fbcdn.net');
            // Instagram frequently fetches its audio rendition after the video
            // request. Wait for the response header below so only a confirmed
            // video/mp4 stream can become the primary Reel download.
            if (isInstaCdn) return;
            const isYtCdn = details.url.includes('googlevideo.com');
            const isPhCdn = details.url.includes('phncdn.com') || details.url.includes('pornhub.com');
            const isXnxxCdn = details.url.includes('xnxx-cdn.com') || details.url.includes('xnxx.com') || details.url.includes('xvideos');

            let platformName = 'PixelFlix';
            if (isInstaCdn) platformName = 'Instagram';
            else if (isYtCdn) platformName = 'YouTube';
            else if (isPhCdn) platformName = 'Pornhub';
            else if (isXnxxCdn) platformName = 'XNXX';

            addDetectedVideo(details.tabId, {
                url: normalizeInstagramMediaUrl(details.url),
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
                url: normalizeInstagramMediaUrl(details.url),
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
        p.set('subtitle', req.subtitle || '');
        p.set('quality', req.quality || '1080p Full HD');
        p.set('platform', req.platform || 'PixelFlix');
        p.set('thumbnail', req.thumbnail || '');
        p.set('duration', req.duration || '');
        p.set('threads', req.threads || '4');
        if (req.audioUrl) p.set('audioUrl', req.audioUrl);
        if (req.season) p.set('season', String(req.season));
        if (req.episode) p.set('episode', String(req.episode));
        if (req.episodeTitle) p.set('episodeTitle', req.episodeTitle);
        if (req.tabId) p.set('tabId', String(req.tabId));

        const target = req.url || '';
        chrome.storage.local.get(['savezonix_backend_url', 'savezonix_backend_port'], (res) => {
            const baseUrl = res?.savezonix_backend_url || (res?.savezonix_backend_port ? `http://localhost:${res.savezonix_backend_port}` : 'http://localhost:50550');
            const localUrl = target ? `${baseUrl}/?url=${encodeURIComponent(target)}&autoDownload=1` : baseUrl;
            chrome.tabs.create({ url: localUrl });
            sendResponse({ success: true });
        });
    } else if (req.action === 'resolveInstagramForDashboard') {
        resolveInstagramForDashboard(req.url)
            .then(sendResponse)
            .catch(() => sendResponse({ success: false, message: 'Unable to read the Instagram tab.' }));
    } else if (req.action === 'resolvePageForDashboard') {
        resolvePageForDashboard(req.url)
            .then(sendResponse)
            .catch(() => sendResponse({ success: false, message: 'Unable to read the open video tab.' }));
    }
    return true;
});
