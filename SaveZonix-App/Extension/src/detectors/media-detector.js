// src/detectors/media-detector.js â Comprehensive HTML5 & Streaming Media Sniffer (Universal)

(function (root) {
    // Strictly match genuine media stream extensions and patterns (NEVER bare 'index' or 'master' without .m3u8)
    const MEDIA_STREAM_REGEX = /(\.m3u8|\.mp4|\.webm|\.m4v|\/hls\/|\.mpd|\/get_file\/|videoplayback|serve_m3u8|proxy\.php\?url=|cdninstagram\.com\/v\/|fbcdn\.net\/o1\/v\/|fbcdn\.net\/v\/)/i;

    function isInvalidStreamUrl(url) {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) return true;
        
        const lower = url.toLowerCase();
        const clean = lower.split('?')[0].replace(/\/+$/, '');
        
        // 1. Strict rejection of individual transport stream segments & chunk slices
        if (clean.endsWith('.ts') || 
            clean.endsWith('.m4s') || 
            clean.endsWith('.mp4s') || 
            lower.includes('seg-') || 
            lower.includes('seg_') || 
            lower.includes('/segment') || 
            lower.includes('/fragment') || 
            lower.includes('/chunk_') || 
            lower.includes('bytestart=') ||
            lower.includes('byteend=') ||
            lower.includes('range=')) {
            return true;
        }

        // 2. Strict non-media static asset & webpage rejection
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

        // 2. Reject Ad Networks, Preroll Video Ads & Sponsored Clips
        if (lower.includes('trafficjunky') || 
            lower.includes('goadserver') ||
            lower.includes('adserver') ||
            lower.includes('doubleclick.net') || 
            lower.includes('googlesyndication') || 
            lower.includes('exoclick') || 
            lower.includes('juicyads') || 
            lower.includes('tsyndicate') || 
            lower.includes('ero-advertising') || 
            lower.includes('adxpansion') || 
            lower.includes('etahub') || 
            lower.includes('propellerads') ||
            lower.includes('adsterra') ||
            lower.includes('clickadu') ||
            lower.includes('popads') ||
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

        // 3. Rejection of image thumbnails and sprite previews (only if not a video format)
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

    const MediaDetector = {
        MEDIA_REGEX: MEDIA_STREAM_REGEX,

        // 1. Sniff HTML5 <video> elements in DOM
        detectFromDOM() {
            const detected = [];
            const seen = new Set();

            const videos = document.querySelectorAll('video');
            videos.forEach((video) => {
                const src = video.currentSrc || video.src;
                if (src && !src.startsWith('blob:') && !isInvalidStreamUrl(src) && !seen.has(src)) {
                    seen.add(src);
                    detected.push({
                        url: src,
                        type: src.includes('.m3u8') ? 'HLS' : (src.includes('.mpd') ? 'DASH' : 'MP4'),
                        source: 'DOM_VIDEO_TAG'
                    });
                }

                // Check embedded <source> elements
                const sources = video.querySelectorAll('source');
                sources.forEach((source) => {
                    const sourceSrc = source.src;
                    if (sourceSrc && !sourceSrc.startsWith('blob:') && !isInvalidStreamUrl(sourceSrc) && !seen.has(sourceSrc)) {
                        seen.add(sourceSrc);
                        detected.push({
                            url: sourceSrc,
                            type: sourceSrc.includes('.m3u8') ? 'HLS' : (sourceSrc.includes('.mpd') ? 'DASH' : 'MP4'),
                            source: 'DOM_SOURCE_TAG'
                        });
                    }
                });
            });

            return detected;
        },

        // 2. Sniff Network Resource Performance Timeline for real stream segments
        findPerformanceStreams() {
            const urls = [];
            const seen = new Set();

            if (typeof performance === 'undefined' || !performance.getEntriesByType) {
                return urls;
            }

            const entries = performance.getEntriesByType('resource');
            for (let i = entries.length - 1; i >= 0; i--) {
                const name = entries[i].name;
                if (name && !isInvalidStreamUrl(name) && MEDIA_STREAM_REGEX.test(name) && !seen.has(name)) {
                    seen.add(name);
                    urls.push(name);
                }
            }

            return urls;
        }
    };

    root.MediaDetector = MediaDetector;
    root.isInvalidStreamUrl = isInvalidStreamUrl;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
