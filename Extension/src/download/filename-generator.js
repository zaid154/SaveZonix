// src/download/filename-generator.js — Production-Grade Filename & Metadata Formatter (Universal)

(function (root) {
    function sanitizeFilenameString(name) {
        if (!name || typeof name !== 'string') return 'Video';
        return name
            .replace(/[\\/:*?"<>|\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 90);
    }

    const CDN_NAMES_REGEX = /^(pvrplay|vidcloud|streamwish|vidsrc|filemoon|2embed|multiembed|autoembed|stream|video|player|emb-page)$/i;

    function extractNumeric(val) {
        if (val === null || val === undefined) return null;
        if (typeof val === 'number' && !isNaN(val) && val > 0) return Math.floor(val);
        const str = String(val).trim();
        const num = parseInt(str, 10);
        return (!isNaN(num) && num > 0) ? num : null;
    }

    const FilenameGenerator = {
        sanitize: sanitizeFilenameString,

        generate(video, selectedQualityLabel) {
            if (!video) return 'Video.mp4';

            let title = (video.title || '').trim();
            let showName = (video.showName || '').trim();
            const platform = (video.platform || '').toLowerCase();
            const ext = (video.extension || 'mp4').toLowerCase();

            // Extract verified numeric season & episode
            let seasonNum = extractNumeric(video.season);
            let episodeNum = extractNumeric(video.episode);

            // If not found in properties, parse from title/URL (e.g. "S01E01", "Season 1 Episode 1")
            if (!seasonNum || !episodeNum) {
                const combined = `${title} ${showName} ${video.subtitle || ''}`;
                const sMatch = combined.match(/S(?:eason\s*)?0*(\d+)/i);
                const eMatch = combined.match(/E(?:pisode\s*)?0*(\d+)/i);
                if (sMatch && !seasonNum) seasonNum = extractNumeric(sMatch[1]);
                if (eMatch && !episodeNum) episodeNum = extractNumeric(eMatch[1]);
            }

            let baseName = '';

            // 1. YOUTUBE
            if (platform === 'youtube' || video.isYouTube) {
                let clean = showName || title;
                clean = clean.replace(/\s*-\s*YouTube$/i, '').replace(/^YouTube\s*-\s*/i, '').trim();
                if (!clean || CDN_NAMES_REGEX.test(clean)) {
                    clean = video.videoId ? `Video_${video.videoId}` : 'Video';
                }
                baseName = `YouTube - ${clean}`;
            }
            // 2. INSTAGRAM
            else if (platform === 'instagram' || video.isDirectMp4) {
                let clean = title.replace(/^Instagram\s*[-–—]\s*/i, '').replace(/^Instagram\s*/i, '').trim();
                if (clean.toLowerCase() === 'instagram') clean = '';

                if (clean && clean.length > 2 && !CDN_NAMES_REGEX.test(clean) && clean.toLowerCase() !== 'video') {
                    baseName = `Instagram - ${clean}`;
                } else if (showName && showName.toLowerCase() !== 'instagram' && showName.length > 2) {
                    baseName = `Instagram - ${showName.replace(/^Instagram\s*[-–—]\s*/i, '')}`;
                } else if (video.subtitle && video.subtitle.length > 2 && video.subtitle !== 'Instagram Reel') {
                    baseName = `Instagram - ${video.subtitle}`;
                } else if (video.shortId) {
                    baseName = `Instagram Reel - ${video.shortId}`;
                } else {
                    baseName = `Instagram Reel`;
                }
            }
            // 3. EPISODIC SERIES (With strict NaN prevention)
            else if (seasonNum !== null && episodeNum !== null) {
                let show = showName || title;
                if (!show || CDN_NAMES_REGEX.test(show)) {
                    show = 'Show';
                }
                show = show.replace(/[-|–—].*$/, '').trim();

                const sStr = String(seasonNum).padStart(2, '0');
                const eStr = String(episodeNum).padStart(2, '0');
                
                let epTitle = '';
                if (video.episodeTitle && typeof video.episodeTitle === 'string') {
                    const cleanEpTitle = video.episodeTitle.trim();
                    if (cleanEpTitle && !cleanEpTitle.toLowerCase().includes('nan') && cleanEpTitle.toLowerCase() !== `episode ${episodeNum}`) {
                        epTitle = ` - ${cleanEpTitle}`;
                    } else {
                        epTitle = ` - Episode ${episodeNum}`;
                    }
                } else {
                    epTitle = ` - Episode ${episodeNum}`;
                }

                baseName = `${show} - S${sStr}E${eStr}${epTitle}`;
            }
            // 4. MOVIES & STANDALONE CONTENT
            else {
                let candidate = title;
                if (!candidate || CDN_NAMES_REGEX.test(candidate) || candidate.toLowerCase() === 'video') {
                    candidate = showName;
                }
                if (!candidate || CDN_NAMES_REGEX.test(candidate) || candidate.toLowerCase() === 'video') {
                    candidate = video.subtitle || 'Video';
                }
                baseName = candidate.replace(/^Watch\s+/i, '').replace(/[-|–—]\s*(PixelFlix|PvrPlay|YouTube|Instagram).*$/i, '').trim();
            }

            // Fallback safety check (NEVER allow NaN or undefined in final string)
            baseName = sanitizeFilenameString(baseName);
            baseName = baseName.replace(/\bNaN\b/gi, '01').replace(/\bundefined\b/gi, '').replace(/\s+/g, ' ').trim();
            if (!baseName || baseName === '.' || baseName === '-') baseName = 'Video';

            return `${baseName}.${ext}`;
        }
    };

    root.FilenameGenerator = FilenameGenerator;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
