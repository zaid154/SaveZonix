// src/utils/thumbnail.js — Strict 5-Tier Thumbnail Priority Resolver (Universal)

(function (root) {
    function extractBestThumbnail(videoElement) {
        try {
            // 1. Active Video Tag Poster
            if (videoElement && videoElement.poster && videoElement.poster.startsWith('http')) {
                return videoElement.poster;
            }

            // 2. OpenGraph / Twitter Meta Images
            const ogImage = document.querySelector('meta[property="og:image"], meta[name="twitter:image"], link[rel="image_src"]')?.getAttribute('content') ||
                            document.querySelector('link[rel="image_src"]')?.getAttribute('href');
            if (ogImage && ogImage.startsWith('http')) {
                return ogImage;
            }

            // 3. Site-Specific Known Poster CDNs (TMDB, YouTube, Instagram, etc.)
            const allImgs = Array.from(document.querySelectorAll('img'));
            for (const img of allImgs) {
                const src = img.currentSrc || img.src;
                if (src && (src.includes('image.tmdb.org') || src.includes('ytimg.com') || src.includes('posters') || src.includes('backdrop') || src.includes('cdninstagram') || src.includes('fbcdn'))) {
                    return src;
                }
            }

            // 4. Large Backdrop / Poster Image Elements
            for (const img of allImgs) {
                const src = img.currentSrc || img.src;
                if (src && src.startsWith('http') && (img.naturalWidth > 120 || img.width > 120)) {
                    return src;
                }
            }

            // 5. Safe Offscreen Video Canvas Capture (if available)
            if (videoElement && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 160;
                    canvas.height = 90;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                    return canvas.toDataURL('image/jpeg', 0.7);
                } catch { }
            }
        } catch { }

        return '';
    }

    root.extractBestThumbnail = extractBestThumbnail;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
