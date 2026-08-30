// background.js — Service Worker: Network Sniffer & Download Coordinator

const MEDIA_URL_REGEX = /(\.m3u8|\.mp4|\.webm|\.mpd|playlist\.m3u8|master\.m3u8)/i;
const MEDIA_MIME_TYPES = [
    'application/vnd.apple.mpegurl',
    'application/x-mpegurl',
    'application/dash+xml',
    'video/mp4',
    'video/webm',
    'video/ogg'
];

async function addDetectedVideo(tabId, videoData) {
    if (!videoData || !videoData.url) return;
    if (videoData.url.includes('.ts?') || videoData.url.endsWith('.ts') || videoData.url.includes('.m4s')) return;

    if (tabId < 0) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id) tabId = activeTab.id;
        else return;
    }

    const key = `tab_media_${tabId}`;
    const stored = await chrome.storage.local.get(key);
    const list = stored[key] || [];

    // Deduplicate by URL
    const existingIndex = list.findIndex(item => item.url === videoData.url);
    if (existingIndex >= 0) {
        // Update metadata if richer
        list[existingIndex] = { ...list[existingIndex], ...videoData };
    } else {
        list.push({
            id: 'vid_' + Math.random().toString(36).substr(2, 9),
            url: videoData.url,
            title: videoData.title || 'Detected Video',
            domain: videoData.domain || 'stream',
            thumbnail: videoData.thumbnail || '',
            duration: videoData.duration || '',
            format: videoData.format || detectFormat(videoData.url),
            timestamp: Date.now()
        });
    }

    await chrome.storage.local.set({ [key]: list });

    try {
        chrome.action.setBadgeText({ tabId: tabId, text: list.length.toString() });
        chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#00e676' });
    } catch { }
}

function detectFormat(url) {
    if (url.includes('.m3u8')) return 'HLS';
    if (url.includes('.mpd')) return 'DASH';
    if (url.includes('.mp4')) return 'MP4';
    if (url.includes('.webm')) return 'WebM';
    return 'Video';
}

// 1. Network Request Sniffing
chrome.webRequest.onBeforeRequest.addListener(
    async (details) => {
        if (details.url && MEDIA_URL_REGEX.test(details.url)) {
            let domain = 'stream';
            try { domain = new URL(details.url).hostname; } catch { }

            addDetectedVideo(details.tabId, {
                url: details.url,
                domain: domain,
                format: detectFormat(details.url)
            });
        }
    },
    { urls: ["<all_urls>"] }
);

// 2. MIME Response Sniffing
chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (!details.responseHeaders) return;

        const typeHeader = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
        if (typeHeader?.value) {
            const val = typeHeader.value.toLowerCase();
            const isMedia = MEDIA_MIME_TYPES.some(mime => val.includes(mime));

            if (isMedia) {
                let domain = 'stream';
                try { domain = new URL(details.url).hostname; } catch { }

                addDetectedVideo(details.tabId, {
                    url: details.url,
                    domain: domain,
                    format: val.includes('mpegurl') ? 'HLS' : (val.includes('dash') ? 'DASH' : 'MP4')
                });
            }
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);

// 3. Message Broker
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'videoDetected') {
        const tabId = sender.tab ? sender.tab.id : -1;
        addDetectedVideo(tabId, req.video);
        sendResponse({ success: true });
    } else if (req.action === 'getTabVideos') {
        const key = `tab_media_${req.tabId}`;
        chrome.storage.local.get([key, 'completed_downloads']).then(data => {
            sendResponse({
                videos: data[key] || [],
                completed: data.completed_downloads || []
            });
        });
        return true;
    } else if (req.action === 'saveCompletedDownload') {
        chrome.storage.local.get('completed_downloads').then(data => {
            const list = data.completed_downloads || [];
            list.unshift(req.item);
            chrome.storage.local.set({ completed_downloads: list.slice(0, 20) });
            sendResponse({ success: true });
        });
        return true;
    } else if (req.action === 'clearTabMedia') {
        chrome.storage.local.remove(`tab_media_${req.tabId}`);
        try { chrome.action.setBadgeText({ tabId: req.tabId, text: '' }); } catch { }
        sendResponse({ success: true });
        return true;
    }
    return true;
});

// Clear tab storage on page reload
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        chrome.storage.local.remove(`tab_media_${tabId}`);
        try { chrome.action.setBadgeText({ tabId: tabId, text: '' }); } catch { }
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.remove(`tab_media_${tabId}`);
});
