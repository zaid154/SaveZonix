// src/utils/thumbnail.js — Strict 6-Tier Thumbnail Priority Resolver (Universal)

(function (root) {
    function extractBestThumbnail(videoElement) {
        try {
            const video = videoElement || document.querySelector('video');

            // 1. Active HTML5 Video Poster Attribute
            if (video && video.poster && video.poster.startsWith('http')) {
                return video.poster;
            }

            // 2. OpenGraph / Twitter / Microdata Meta Images
            const ogImage = document.querySelector('meta[property="og:image"], meta[name="twitter:image"], link[rel="image_src"]')?.getAttribute('content') ||
                            document.querySelector('link[rel="image_src"]')?.getAttribute('href');
            if (ogImage && ogImage.startsWith('http')) {
                return ogImage;
            }

            // 3. Schema.org JSON-LD Thumbnail
            const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of jsonLdScripts) {
                try {
                    const data = JSON.parse(script.innerText);
                    const items = Array.isArray(data) ? data : [data];
                    for (const item of items) {
                        const thumb = item.thumbnailUrl || item.thumbnail || item.image;
                        if (thumb) {
                            const url = Array.isArray(thumb) ? thumb[0] : (typeof thumb === 'object' ? thumb.url : thumb);
                            if (url && typeof url === 'string' && url.startsWith('http')) {
                                return url;
                            }
                        }
                    }
                } catch { }
            }

            // 4. Site-Specific Known Video Poster / Backdrop CDNs (Pornhub, XNXX, TMDB, YouTube, etc.)
            const allImgs = Array.from(document.querySelectorAll('img'));
            for (const img of allImgs) {
                const src = img.currentSrc || img.src;
                if (src && (
                    src.includes('phncdn.com') ||
                    src.includes('xnxx-cdn.com') ||
                    src.includes('image.tmdb.org') ||
                    src.includes('ytimg.com') ||
                    src.includes('posters') ||
                    src.includes('backdrop') ||
                    src.includes('cdninstagram') ||
                    src.includes('fbcdn')
                )) {
                    if (!src.includes('icon') && !src.includes('logo') && !src.includes('avatar')) {
                        return src;
                    }
                }
            }

            // 5. Large Backdrop / Poster Image Elements (> 120px)
            for (const img of allImgs) {
                const src = img.currentSrc || img.src;
                if (src && src.startsWith('http') && (img.naturalWidth > 120 || img.width > 120)) {
                    if (!src.includes('icon') && !src.includes('logo') && !src.includes('avatar') && !src.includes('badge')) {
                        return src;
                    }
                }
            }

            // 6. Safe Offscreen Video Canvas Capture
            if (video && video.videoWidth > 0 && video.videoHeight > 0) {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 160;
                    canvas.height = 90;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    return canvas.toDataURL('image/jpeg', 0.7);
                } catch { }
            }
        } catch { }

        return '';
    }

    const ThumbnailGenerator = {
        extractThumbnail: extractBestThumbnail,
        extractBestThumbnail: extractBestThumbnail
    };

    root.ThumbnailGenerator = ThumbnailGenerator;
    root.extractBestThumbnail = extractBestThumbnail;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
