// src/detectors/media-detector.js — Comprehensive HTML5 & Streaming Media Sniffer (Universal)

(function (root) {
    // Only match genuine media stream extensions and patterns
    const MEDIA_STREAM_REGEX = /(\.m3u8|\.mp4|\.webm|\.m4v|playlist\.m3u8|master\.m3u8|index\.m3u8|\/hls\/|\.mpd)/i;

    function isInvalidStreamUrl(url) {
        if (!url || typeof url !== 'string' || !url.startsWith('http')) return true;
        const clean = url.split('?')[0].toLowerCase();
        
        // Strict non-media extensions & webpage rejection
        if (clean.endsWith('.xml') || 
            clean.endsWith('.json') || 
            clean.endsWith('.txt') || 
            clean.endsWith('.html') || 
            clean.endsWith('.htm') || 
            clean.endsWith('.php') || 
            clean.endsWith('.asp') || 
            clean.endsWith('.aspx') || 
            clean.endsWith('.jsp') || 
            clean.endsWith('.js') || 
            clean.endsWith('.css') || 
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

        // Check path & query params for XML/JSON/API/Iframe formats
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
            lower.includes('/api/v') ||
            lower.includes('getsource') ||
            lower.includes('load-source')) {
            return true;
        }

        return false;
    }

    const MediaDetector = {
        MEDIA_REGEX: MEDIA_STREAM_REGEX,

        isSegment(url) {
            if (!url) return true;
            const clean = url.split('?')[0].toLowerCase();
            return (clean.endsWith('.ts') && !clean.includes('playlist') && !clean.includes('master') && !clean.includes('index')) || 
                   (clean.endsWith('.m4s') && !clean.includes('init'));
        },

        findActiveVideoElement() {
            const videos = Array.from(document.querySelectorAll('video'));
            if (videos.length === 0) return null;

            // 1. Prioritize currently playing video
            const playing = videos.find(v => !v.paused && v.currentTime > 0);
            if (playing) return playing;

            // 2. Prioritize video centered in the viewport
            const centerY = window.innerHeight / 2;
            const inViewport = videos.find(v => {
                const rect = v.getBoundingClientRect();
                return rect.top <= centerY && rect.bottom >= centerY && rect.height > 100;
            });
            if (inViewport) return inViewport;

            // 3. Prioritize video with dimensions
            const withDims = videos.find(v => v.videoWidth > 0 && v.videoHeight > 0);
            if (withDims) return withDims;

            // 4. Prioritize video with source
            const withSrc = videos.find(v => v.currentSrc || v.src || v.querySelector('source'));
            if (withSrc) return withSrc;

            return videos[0];
        },

        findPerformanceStreams() {
            const found = [];
            const candidatePlaylists = new Set();

            try {
                const entries = performance.getEntriesByType('resource');
                for (let i = entries.length - 1; i >= 0; i--) {
                    const url = entries[i].name;
                    if (!url || !url.startsWith('http') || isInvalidStreamUrl(url)) continue;

                    // Direct match for .m3u8, /hls/, or .mp4
                    if (MEDIA_STREAM_REGEX.test(url) && !this.isSegment(url)) {
                        if (!found.includes(url)) {
                            found.push(url);
                        }
                    } 
                    // Active .ts or .m4s media chunk detected -> derive parent playlist
                    else if (url.includes('.ts') || url.includes('.m4s')) {
                        try {
                            const parsedUrl = new URL(url);
                            const pathParts = parsedUrl.pathname.split('/');
                            pathParts.pop(); // remove segment name
                            const basePath = pathParts.join('/');
                            
                            const p1 = `${parsedUrl.origin}${basePath}/index.m3u8${parsedUrl.search}`;
                            const p2 = `${parsedUrl.origin}${basePath}/playlist.m3u8${parsedUrl.search}`;
                            const p3 = `${parsedUrl.origin}${basePath}/master.m3u8${parsedUrl.search}`;

                            if (!candidatePlaylists.has(p1)) { candidatePlaylists.add(p1); found.push(p1); }
                            if (!candidatePlaylists.has(p2)) { candidatePlaylists.add(p2); found.push(p2); }
                            if (!candidatePlaylists.has(p3)) { candidatePlaylists.add(p3); found.push(p3); }
                        } catch { }
                    }
                }
            } catch { }
            return found;
        }
    };

    root.MediaDetector = MediaDetector;
    root.isInvalidStreamUrl = isInvalidStreamUrl;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
