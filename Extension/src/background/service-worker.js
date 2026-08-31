// src/background/service-worker.js — Stream Sniffer, Dynamic Referer Injection & Multi-Candidate Coordinator

// Strictly match genuine video streams only (.m3u8, .mp4, .webm, .m4v, /hls/, videoplayback, proxy.php, serve_m3u8)
const MEDIA_URL_REGEX = /(\.m3u8|\.mp4|\.webm|\.m4v|\/hls\/|videoplayback|serve_m3u8|proxy\.php)/i;

function getStreamPriorityScore(url) {
    if (!url || typeof url !== 'string') return 0;
    const clean = url.split('?')[0].toLowerCase();
    if (clean.endsWith('.m3u8') || url.includes('.m3u8') || url.includes('/hls/') || url.includes('serve_m3u8')) return 100;
    if (clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.m4v')) return 90;
    if (url.includes('googlevideo.com/videoplayback')) return 80;
    if (clean.endsWith('.mpd') || url.includes('.mpd')) return 70;
    return 10;
}

function isSegmentOrInvalid(url) {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return true;
    const clean = url.split('?')[0].toLowerCase();
    
    // Strict non-media file & webpage rejection
    if (clean.endsWith('.xml') || 
        clean.endsWith('.json') || 
        clean.endsWith('.txt') || 
        clean.endsWith('.html') || 
        clean.endsWith('.htm') || 
        clean.endsWith('.asp') || 
        clean.endsWith('.aspx') || 
        clean.endsWith('.jsp') || 
        clean.endsWith('.js') || 
        clean.endsWith('.css') || 
        clean.endsWith('.svg') || 
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

    const lower = url.toLowerCase();
    if (lower.includes('format=xml') || 
        lower.includes('type=xml') || 
        lower.includes('output=xml') || 
        lower.includes('format=json') || 
        lower.includes('type=json') || 
        lower.includes('/subtitles/') ||
        lower.includes('/captions/') ||
        lower.includes('/embed/') ||
        lower.includes('/player/') ||
        lower.includes('/api/player') ||
        lower.includes('/api/source') ||
        lower.includes('/api/stream') ||
        lower.includes('getsource')) {
        return true;
    }

    return false;
}

// Dynamically set Referer / Origin header rules for CDN requests
async function updateRefererRules(refererUrl) {
    if (!chrome.declarativeNetRequest || !refererUrl) return;
    try {
        let origin = '';
        try {
            const parsed = new URL(refererUrl);
            origin = parsed.origin;
        } catch {
            origin = refererUrl;
        }

        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [1001],
            addRules: [{
                id: 1001,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'Referer', operation: 'set', value: 'https://embed.reelsdownload.online/' },
                        { header: 'Origin', operation: 'set', value: 'https://embed.reelsdownload.online' }
                    ]
                },
                condition: {
                    resourceTypes: ['xmlhttprequest', 'media', 'other']
                }
            }]
        });
    } catch (e) {
        console.warn('[StreamHelper] DeclarativeNetRequest notice:', e.message);
    }
}

const tabTitles = {};
const tabThumbnails = {};
const activeDownloads = {};

async function addDetectedVideo(tabId, videoData) {
    if (!videoData) return;
    if (videoData.url && isSegmentOrInvalid(videoData.url)) return;

    if (!tabId || tabId < 0) {
        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab?.id) tabId = activeTab.id;
            else return;
        } catch {
            return;
        }
    }

    // Automatically configure Referer header rule for embed player origin
    const refererTarget = videoData.pageUrl || 'https://embed.reelsdownload.online/';
    updateRefererRules(refererTarget);

    const key = `tab_media_${tabId}`;
    let list = [];
    try {
        const stored = await chrome.storage.local.get(key);
        list = stored[key] || [];
    } catch {
        list = [];
    }

    const bestTitle = (videoData.title && videoData.title !== 'Video' && videoData.title !== 'PvrPlay') 
        ? videoData.title 
        : (tabTitles[tabId] || 'Video');
    const bestThumb = videoData.thumbnail || tabThumbnails[tabId] || '';

    // Merge rich metadata (title/thumbnail) with real stream URL
    let targetIndex = -1;

    if (videoData.url) {
        targetIndex = list.findIndex(item => item.url === videoData.url);
        if (targetIndex < 0) {
            const newScore = getStreamPriorityScore(videoData.url);
            targetIndex = list.findIndex(item => !item.url || getStreamPriorityScore(item.url) < newScore);
        }
    } else {
        targetIndex = list.findIndex(item => item.platform === (videoData.platform || 'Stream'));
    }

    const newEntry = {
        id: (targetIndex >= 0 && list[targetIndex].id) ? list[targetIndex].id : ('vid_' + Math.random().toString(36).substr(2, 9)),
        url: videoData.url || (targetIndex >= 0 ? list[targetIndex].url : '') || '',
        audioUrl: videoData.audioUrl || (targetIndex >= 0 ? list[targetIndex].audioUrl : '') || '',
        title: (bestTitle && bestTitle !== 'Video' && bestTitle !== 'Detected Video') ? bestTitle : (targetIndex >= 0 ? list[targetIndex].title : 'Video'),
        showName: videoData.showName || (targetIndex >= 0 ? list[targetIndex].showName : 'Video') || 'Video',
        subtitle: videoData.subtitle || (targetIndex >= 0 ? list[targetIndex].subtitle : '') || '',
        season: videoData.season !== undefined ? videoData.season : (targetIndex >= 0 ? list[targetIndex].season : undefined),
        episode: videoData.episode !== undefined ? videoData.episode : (targetIndex >= 0 ? list[targetIndex].episode : undefined),
        episodeTitle: videoData.episodeTitle || (targetIndex >= 0 ? list[targetIndex].episodeTitle : ''),
        domain: videoData.domain || (targetIndex >= 0 ? list[targetIndex].domain : 'pixelflix.cc') || 'pixelflix.cc',
        sourceSite: videoData.sourceSite || videoData.platform || 'PixelFlix',
        pageUrl: videoData.pageUrl || '',
        thumbnail: bestThumb || (targetIndex >= 0 ? list[targetIndex].thumbnail : '') || '',
        duration: videoData.duration || (targetIndex >= 0 ? list[targetIndex].duration : '') || '',
        format: videoData.format || (videoData.url?.includes('.m3u8') ? 'HLS' : (targetIndex >= 0 ? list[targetIndex].format : 'HLS')),
        container: videoData.container || 'MP4',
        mediaType: videoData.mediaType || 'video/mp4',
        resolution: videoData.resolution || (targetIndex >= 0 ? list[targetIndex].resolution : '') || '',
        qualityLabel: videoData.qualityLabel || '',
        platform: videoData.platform || (targetIndex >= 0 ? list[targetIndex].platform : 'PixelFlix') || 'PixelFlix',
        isDirectMp4: videoData.isDirectMp4 || false,
        isYouTube: videoData.isYouTube || false,
        isDownloadable: true,
        isRestricted: videoData.isRestricted || false,
        downloadNotice: videoData.downloadNotice || '',
        score: getStreamPriorityScore(videoData.url || (targetIndex >= 0 ? list[targetIndex].url : '')),
        timestamp: Date.now()
    };

    if (targetIndex >= 0) {
        list[targetIndex] = newEntry;
    } else {
        list.push(newEntry);
    }

    // Rank list strictly by stream priority score (HLS .m3u8 > MP4 > others)
    list.sort((a, b) => {
        const scoreA = getStreamPriorityScore(a.url);
        const scoreB = getStreamPriorityScore(b.url);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return 0;
    });

    if (list.length > 4) {
        list = list.slice(0, 4);
    }

    try {
        await chrome.storage.local.set({ [key]: list });
        if (tabId > 0) {
            const hasValidUrl = list.some(item => item.url && item.url.startsWith('http') && getStreamPriorityScore(item.url) >= 70);
            const countStr = hasValidUrl ? '1' : (list.length > 0 ? '1' : '');
            chrome.action.setBadgeText({ tabId: tabId, text: countStr }, () => {
                if (chrome.runtime.lastError) { }
            });
            if (countStr) {
                chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#2563eb' }, () => {
                    if (chrome.runtime.lastError) { }
                });
            }
        }
    } catch { }
}

// 1. Network Request URL Sniffing (EXCLUDE IFRAME / SUBFRAME NAVIGATION)
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.type === 'main_frame' || 
            details.type === 'sub_frame' || 
            details.type === 'script' || 
            details.type === 'stylesheet' || 
            details.type === 'font') {
            return;
        }

        if (details.url && MEDIA_URL_REGEX.test(details.url) && !isSegmentOrInvalid(details.url)) {
            let domain = 'pixelflix.cc';
            try { domain = new URL(details.url).hostname.replace(/^www\./, ''); } catch { }

            const isInstaCdn = details.url.includes('cdninstagram.com') || details.url.includes('fbcdn.net');
            const isYtCdn = details.url.includes('googlevideo.com');

            addDetectedVideo(details.tabId, {
                url: details.url,
                domain: isInstaCdn ? 'instagram.com' : (isYtCdn ? 'youtube.com' : domain),
                format: (details.url.includes('.m3u8') || details.url.includes('/hls/') || details.url.includes('serve_m3u8')) ? 'HLS' : (details.url.includes('.mpd') ? 'DASH' : 'MP4'),
                platform: isInstaCdn ? 'Instagram' : (isYtCdn ? 'YouTube' : 'PixelFlix'),
                isYouTube: isYtCdn,
                isDirectMp4: isInstaCdn,
                isDownloadable: !isYtCdn
            });
        }
    },
    { urls: ["<all_urls>"] }
);

// 2. Response Headers Content-Type Sniffing (Guaranteed Media Confirmation)
chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (details.type === 'main_frame' || details.type === 'sub_frame' || details.type === 'script' || details.type === 'stylesheet') return;
        if (!details.responseHeaders || !details.url || !details.url.startsWith('http')) return;
        if (isSegmentOrInvalid(details.url)) return;

        const ctHeader = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
        if (!ctHeader || !ctHeader.value) return;

        const cType = ctHeader.value.toLowerCase();

        // Strictly reject non-media response types
        if (cType.includes('text/xml') || 
            cType.includes('application/xml') || 
            cType.includes('text/html') || 
            cType.includes('application/json')) {
            return;
        }

        // Accept confirmed media content types
        const isHls = cType.includes('application/vnd.apple.mpegurl') || 
                      cType.includes('application/x-mpegurl') || 
                      cType.includes('audio/mpegurl') ||
                      details.url.includes('.m3u8') ||
                      details.url.includes('serve_m3u8');
        const isMp4 = cType.includes('video/mp4') || cType.includes('video/webm') || cType.includes('video/mp2t');

        if (isHls || isMp4) {
            let domain = 'pixelflix.cc';
            try { domain = new URL(details.url).hostname.replace(/^www\./, ''); } catch { }

            const isInstaCdn = details.url.includes('cdninstagram.com') || details.url.includes('fbcdn.net');
            const isYtCdn = details.url.includes('googlevideo.com');

            addDetectedVideo(details.tabId, {
                url: details.url,
                domain: isInstaCdn ? 'instagram.com' : (isYtCdn ? 'youtube.com' : domain),
                format: isHls ? 'HLS' : 'MP4',
                platform: isInstaCdn ? 'Instagram' : (isYtCdn ? 'YouTube' : 'PixelFlix'),
                isYouTube: isYtCdn,
                isDirectMp4: isInstaCdn,
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
            tabTitles[tabId] = req.title;
            if (req.thumbnail) tabThumbnails[tabId] = req.thumbnail;

            const key = `tab_media_${tabId}`;
            chrome.storage.local.get(key).then(data => {
                const list = data[key] || [];
                let modified = false;
                list.forEach(item => {
                    if (item.title !== req.title) {
                        item.title = req.title;
                        item.showName = req.metadata?.showName || item.showName;
                        item.subtitle = req.metadata?.subtitle || item.subtitle;
                        item.season = req.metadata?.season !== undefined ? req.metadata.season : item.season;
                        item.episode = req.metadata?.episode !== undefined ? req.metadata.episode : item.episode;
                        item.episodeTitle = req.metadata?.episodeTitle || item.episodeTitle;
                        item.platform = req.metadata?.platform || item.platform;
                        modified = true;
                    }
                    if (req.thumbnail && !item.thumbnail) {
                        item.thumbnail = req.thumbnail;
                        modified = true;
                    }
                });
                if (modified) {
                    chrome.storage.local.set({ [key]: list });
                }
            }).catch(() => { });
        }
        sendResponse({ success: true });
    } else if (req.action === 'getTabVideos') {
        const key = `tab_media_${req.tabId}`;
        chrome.storage.local.get([key, 'completed_downloads', 'user_settings']).then(data => {
            sendResponse({
                videos: data[key] || [],
                completed: data.completed_downloads || [],
                settings: data.user_settings || { defaultQuality: 'best', autoDetectEpisode: true },
                activeDownloads: activeDownloads
            });
        }).catch(() => {
            sendResponse({ videos: [], completed: [], settings: {}, activeDownloads: {} });
        });
        return true;
    } else if (req.action === 'updateDownloadState') {
        if (req.downloadId) {
            if (req.state.isDone) {
                delete activeDownloads[req.downloadId];
            } else {
                activeDownloads[req.downloadId] = req.state;
            }
        }
        sendResponse({ success: true });
    } else if (req.action === 'saveCompletedDownload') {
        chrome.storage.local.get('completed_downloads').then(data => {
            let list = (data.completed_downloads || []).filter(item => item && item.filename && item.filename !== 'Video.mp4');
            list = list.filter(item => item.filename !== req.item.filename && item.title !== req.item.title);
            list.unshift(req.item);
            chrome.storage.local.set({ completed_downloads: list.slice(0, 30) });
            sendResponse({ success: true });
        }).catch(() => { });
        return true;
    } else if (req.action === 'removeCompletedDownload') {
        chrome.storage.local.get('completed_downloads').then(data => {
            const list = (data.completed_downloads || []).filter(item => item.id !== req.id);
            chrome.storage.local.set({ completed_downloads: list });
            sendResponse({ success: true });
        }).catch(() => { });
        return true;
    } else if (req.action === 'saveSettings') {
        chrome.storage.local.set({ user_settings: req.settings }).then(() => {
            sendResponse({ success: true });
        }).catch(() => { });
        return true;
    } else if (req.action === 'clearTabMedia') {
        const targetTab = req.tabId || tabId;
        if (targetTab > 0) {
            chrome.storage.local.remove(`tab_media_${targetTab}`).catch(() => { });
            delete tabTitles[targetTab];
            delete tabThumbnails[targetTab];
            try {
                chrome.action.setBadgeText({ tabId: targetTab, text: '' }, () => {
                    if (chrome.runtime.lastError) { }
                });
            } catch { }
        }
        sendResponse({ success: true });
        return true;
    }
    return true;
});

// Clear tab storage on page reload or URL navigation (NEVER clears completed_downloads history)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (tabId > 0 && (changeInfo.status === 'loading' || changeInfo.url)) {
        chrome.storage.local.remove(`tab_media_${tabId}`).catch(() => { });
        delete tabTitles[tabId];
        delete tabThumbnails[tabId];
        try {
            chrome.action.setBadgeText({ tabId: tabId, text: '' }, () => {
                if (chrome.runtime.lastError) { }
            });
        } catch { }
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId > 0) {
        chrome.storage.local.remove(`tab_media_${tabId}`).catch(() => { });
        delete tabTitles[tabId];
        delete tabThumbnails[tabId];
    }
});
