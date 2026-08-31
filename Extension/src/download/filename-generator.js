// src/download/filename-generator.js — Standardized, Sanitized Filename Generator (Universal)

(function (root) {
    function sanitizeFilenameString(name) {
        if (!name || typeof name !== 'string') return 'Video';
        return name
            .replace(/[\\/:*?"<>|\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 90);
    }

    const CDN_NAMES_REGEX = /^(pvrplay|vidcloud|streamwish|vidsrc|filemoon|2embed|multiembed|autoembed|stream|video)$/i;

    const FilenameGenerator = {
        generate(video, selectedQualityLabel) {
            let title = (video.title || '').trim();
            const platform = (video.platform || '').toLowerCase();
            const ext = (video.extension || 'mp4').toLowerCase();

            let baseName = '';

            // 1. YOUTUBE FILENAMES
            if (platform === 'youtube' || video.isYouTube) {
                let clean = video.showName || title;
                clean = clean.replace(/\s*-\s*YouTube$/i, '').replace(/^YouTube\s*-\s*/i, '').trim();
                if (!clean || clean.toLowerCase() === 'video') {
                    clean = video.videoId ? `Video_${video.videoId}` : 'Video';
                }
                baseName = `YouTube - ${clean}`;
            }
            // 2. INSTAGRAM FILENAMES
            else if (platform === 'instagram' || video.isDirectMp4) {
                let clean = title.replace(/^Instagram\s*-\s*/i, '').trim();
                if (clean.toLowerCase().startsWith('reel -') || clean.toLowerCase().startsWith('@')) {
                    baseName = `Instagram - ${clean}`;
                } else if (clean && clean.toLowerCase() !== 'video') {
                    baseName = `Instagram - ${clean}`;
                } else if (video.subtitle && video.subtitle.length > 2 && video.subtitle !== 'Instagram Reel') {
                    baseName = `Instagram - ${video.subtitle}`;
                } else if (video.shortId) {
                    baseName = `Instagram Reel - ${video.shortId}`;
                } else {
                    baseName = `Instagram - Reel`;
                }
            }
            // 3. SERIES / EPISODES (PixelFlix, Anime, Shows)
            else if (video.season !== undefined && video.episode !== undefined && video.season !== null && video.episode !== null) {
                let show = (video.showName || '').trim();
                if (!show || CDN_NAMES_REGEX.test(show)) {
                    show = 'Show';
                }
                const sStr = String(video.season).padStart(2, '0');
                const eStr = String(video.episode).padStart(2, '0');
                const epTitle = video.episodeTitle && video.episodeTitle.toLowerCase() !== `episode ${video.episode}` ? ` - ${video.episodeTitle}` : ` - Episode ${video.episode}`;
                
                if (title && !CDN_NAMES_REGEX.test(title) && title.includes(`S${sStr}E${eStr}`)) {
                    baseName = title;
                } else {
                    baseName = `${show} - S${sStr}E${eStr}${epTitle}`;
                }
            }
            // 4. GENERIC MEDIA
            else {
                if (title && !CDN_NAMES_REGEX.test(title)) {
                    baseName = title;
                } else if (video.showName && !CDN_NAMES_REGEX.test(video.showName)) {
                    baseName = video.showName;
                } else {
                    baseName = 'Video';
                }
            }

            const clean = sanitizeFilenameString(baseName);
            return clean.toLowerCase().endsWith(`.${ext}`) ? clean : `${clean}.${ext}`;
        }
    };

    root.FilenameGenerator = FilenameGenerator;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
