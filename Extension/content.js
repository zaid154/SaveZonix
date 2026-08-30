// content.js — Page Inspector & Metadata Scraper

(function () {
    const reportedMedia = new Set();

    function formatDuration(seconds) {
        if (!seconds || isNaN(seconds) || seconds === Infinity) return '';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function getPageVideoTitle() {
        const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
        if (ogTitle) return ogTitle.trim();

        const h1 = document.querySelector('h1')?.innerText?.trim();
        if (h1 && h1.length < 80) return h1;

        return document.title.replace(/[-|–].*$/, '').trim() || 'Detected Video';
    }

    function captureVideoThumbnail(video) {
        try {
            if (video.poster) return video.poster;

            if (video.videoWidth > 0 && video.videoHeight > 0) {
                const canvas = document.createElement('canvas');
                canvas.width = 160;
                canvas.height = 90;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                return canvas.toDataURL('image/jpeg', 0.6);
            }
        } catch {
            // Cross-origin tainted canvas fallback
        }
        return '';
    }

    function scanPageVideos() {
        const pageTitle = getPageVideoTitle();
        const domain = window.location.hostname;

        document.querySelectorAll('video').forEach((video, index) => {
            const src = video.currentSrc || video.src || video.querySelector('source')?.src;
            if (!src || src.startsWith('blob:') || reportedMedia.has(src)) return;

            reportedMedia.add(src);

            const thumbnail = captureVideoThumbnail(video);
            const duration = formatDuration(video.duration);

            chrome.runtime.sendMessage({
                action: 'videoDetected',
                video: {
                    url: src,
                    title: pageTitle,
                    domain: domain,
                    thumbnail: thumbnail,
                    duration: duration,
                    format: src.includes('.m3u8') ? 'HLS' : (src.includes('.mpd') ? 'DASH' : 'MP4')
                }
            });
        });
    }

    // Scan periodically and on mutations
    setInterval(scanPageVideos, 1500);
    scanPageVideos();

    // Listen for manual scan request from popup
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
        if (req.action === 'scanPage') {
            scanPageVideos();
            sendResponse({ scanned: true });
        }
    });
})();
