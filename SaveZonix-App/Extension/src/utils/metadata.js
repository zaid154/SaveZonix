// src/utils/metadata.js — Dynamic 6-Tier Metadata & Duration Extractor (Universal)

(function (root) {
    function cleanTitleString(title) {
        if (!title || typeof title !== 'string') return '';
        return title
            .replace(/^Watch\s+/i, '')
            .replace(/\s*[-|–—]\s*(Pornhub\.com|Pornhub|XNXX\.COM|XNXX|XVideos\.com|XVideos|OK\.XXX|OKXXX|SpankBang|PixelFlix|YouTube|Instagram|PvrPlay).*$/i, '')
            .replace(/[\\/:*?"<>|\r\n\t]+/g, ' ')
            .trim()
            .replace(/[:\-–—\s]+$/, '');
    }

    function parseIsoDuration(durationStr) {
        if (!durationStr || typeof durationStr !== 'string') return 0;
        // Check if plain seconds integer
        if (/^\d+$/.test(durationStr.trim())) {
            return parseInt(durationStr.trim(), 10);
        }
        // Match ISO 8601 duration: PT1H13M15S or PT13M15S or PT795S
        const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
        if (match) {
            const hrs = parseInt(match[1] || '0', 10);
            const mins = parseInt(match[2] || '0', 10);
            const secs = parseInt(match[3] || '0', 10);
            return (hrs * 3600) + (mins * 60) + secs;
        }
        // Match time format MM:SS or HH:MM:SS
        const timeMatch = durationStr.match(/(?:(\d+):)?(\d+):(\d+)/);
        if (timeMatch) {
            const hrs = parseInt(timeMatch[1] || '0', 10);
            const mins = parseInt(timeMatch[2] || '0', 10);
            const secs = parseInt(timeMatch[3] || '0', 10);
            return (hrs * 3600) + (mins * 60) + secs;
        }
        return 0;
    }

    function extractPageMetadata() {
        let showName = '';
        let seasonNum = null;
        let episodeNum = null;
        let episodeTitle = '';
        let durationSeconds = 0;

        // âââ TIER 1: JSON-LD Schema.org âââââââââââââââââââââââââââââââââââââââââ
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of jsonLdScripts) {
            try {
                const data = JSON.parse(script.innerText);
                const items = Array.isArray(data) ? data : [data];
                for (const item of items) {
                    if (item.duration) {
                        const d = parseIsoDuration(item.duration);
                        if (d > 0 && !durationSeconds) durationSeconds = d;
                    }
                    if (item['@type'] === 'TVEpisode' || item['@type'] === 'Episode') {
                        if (item.partOfSeries?.name) showName = item.partOfSeries.name;
                        if (item.partOfSeason?.seasonNumber) seasonNum = parseInt(item.partOfSeason.seasonNumber, 10);
                        if (item.episodeNumber) episodeNum = parseInt(item.episodeNumber, 10);
                        if (item.name && item.name.toLowerCase() !== `episode ${episodeNum}`) episodeTitle = item.name;
                    } else if (item['@type'] === 'TVSeries' || item['@type'] === 'Movie' || item['@type'] === 'VideoObject') {
                        if (item.name && !showName) showName = item.name;
                    }
                }
            } catch { }
        }

        // âââ TIER 2: Page Main Video Heading (H1 first, never bare H2) âââââââââ
        if (!showName) {
            const h1 = document.querySelector('.video-info h1, h1.video-title, h1.title, h1, .main-title, .watch-title');
            if (h1 && h1.innerText.trim().length >= 2) {
                showName = cleanTitleString(h1.innerText.trim());
            }
        }

        // ─── TIER 2B: In-Page Script Title ($history_title, html5player.setVideoTitle, etc.) ───
        if (!showName) {
            if (root.$history_title) {
                showName = cleanTitleString(root.$history_title);
            } else {
                try {
                    const scripts = document.querySelectorAll('script:not([src])');
                    for (const s of scripts) {
                        const txt = s.textContent || '';
                        const tm = txt.match(/html5player\.setVideoTitle\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
                        if (tm && tm[1]) {
                            showName = cleanTitleString(tm[1]);
                            break;
                        }
                        const vm = txt.match(/html5player\.setVideoURL\s*\(\s*['"]\/[^\/]+\/([^'"]+)['"]\s*\)/i);
                        if (vm && vm[1]) {
                            const unslug = vm[1].replace(/^_+|_+$/g, '').replace(/_/g, ' ');
                            showName = cleanTitleString(unslug);
                            break;
                        }
                    }
                } catch { }
            }
        }

        // â”€â”€â”€ TIER 3: Visible Season Selector / Dropdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (seasonNum === null) {
            const seasonElements = document.querySelectorAll('select, button, .dropdown, .season-select, .season-btn, span, div');
            for (const el of seasonElements) {
                const text = el.innerText || (el.value ? el.value : '');
                const match = text.match(/Season\s*(\d+)/i) || text.match(/\bS(\d+)\b/i);
                if (match) {
                    seasonNum = parseInt(match[1], 10);
                    break;
                }
            }
        }

        // âââ TIER 4: Visible Episode Selector / Dropdown âââââââââââââââââââââââ
        if (episodeNum === null) {
            const epElements = document.querySelectorAll('.episode-btn.active, .ep-item.active, button.active, select, .episode-select, h1, h2, h3, .episode-title');
            for (const el of epElements) {
                const text = el.innerText || (el.value ? el.value : '');
                const match = text.match(/Episode\s*(\d+)/i) || text.match(/\bE(\d+)\b/i) || text.match(/S\d+\s*E(\d+)/i);
                if (match) {
                    episodeNum = parseInt(match[1], 10);
                    const titleMatch = text.match(/Episode\s*\d+\s*[-:]\s*(.+)/i);
                    if (titleMatch && !episodeTitle) {
                        episodeTitle = titleMatch[1].trim();
                    }
                    break;
                }
            }
        }

        // âââ TIER 5: HTML Meta & OpenGraph âââââââââââââââââââââââââââââââââââââ
        if (!showName) {
            const ogTitle = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]')?.getAttribute('content');
            if (ogTitle) {
                showName = cleanTitleString(ogTitle);
            }
        }

        const metaDuration = document.querySelector('meta[property="video:duration"], meta[itemprop="duration"]')?.getAttribute('content');
        if (metaDuration && !durationSeconds) {
            durationSeconds = parseIsoDuration(metaDuration);
        }

        const metaSeason = document.querySelector('meta[property="video:season"]')?.getAttribute('content');
        if (metaSeason && seasonNum === null) seasonNum = parseInt(metaSeason, 10);

        const metaEpisode = document.querySelector('meta[property="video:episode"]')?.getAttribute('content');
        if (metaEpisode && episodeNum === null) episodeNum = parseInt(metaEpisode, 10);

        // âââ TIER 6: HTML5 Video Tag Duration & URL Search Parameters âââââââââ
        if (!durationSeconds) {
            const videoTag = document.querySelector('video');
            if (videoTag && !isNaN(videoTag.duration) && videoTag.duration > 0 && videoTag.duration !== Infinity) {
                durationSeconds = Math.round(videoTag.duration);
            }
        }

        const currentUrl = window.location.href;
        if (seasonNum === null) {
            const sMatch = currentUrl.match(/[?&]season=(\d+)/i) || currentUrl.match(/\/season[_\-]?(\d+)/i);
            if (sMatch) seasonNum = parseInt(sMatch[1], 10);
        }

        if (episodeNum === null) {
            const eMatch = currentUrl.match(/[?&]episode=(\d+)/i) || currentUrl.match(/\/episode[_\-]?(\d+)/i) || currentUrl.match(/[\/_\-]e(\d+)[\/_\-?]/i);
            if (eMatch) episodeNum = parseInt(eMatch[1], 10);
        }

        if (!showName || showName.length < 2) {
            showName = cleanTitleString(document.title);
        }

        if (!showName || showName.toLowerCase() === 'watch' || showName.toLowerCase() === 'home') {
            const host = window.location.hostname.replace(/^www\./, '').split('.')[0];
            showName = host ? host.charAt(0).toUpperCase() + host.slice(1) : 'Video';
        }

        let finalTitle = showName;
        let subtitle = '';

        if (seasonNum !== null && episodeNum !== null) {
            const sStr = String(seasonNum).padStart(2, '0');
            const eStr = String(episodeNum).padStart(2, '0');
            subtitle = `S${sStr}E${eStr} • Episode ${episodeNum}`;

            if (episodeTitle && episodeTitle.toLowerCase() !== `episode ${episodeNum}`) {
                finalTitle = `${showName} - S${sStr}E${eStr} - ${episodeTitle}`;
                subtitle = `S${sStr}E${eStr} • ${episodeTitle}`;
            } else {
                finalTitle = `${showName} - S${sStr}E${eStr} - Episode ${episodeNum}`;
            }
        } else if (episodeNum !== null) {
            const eStr = String(episodeNum).padStart(2, '0');
            finalTitle = `${showName} - E${eStr}`;
            subtitle = `Episode ${episodeNum}`;
        }

        const formattedDuration = durationSeconds > 0 ? root.Helpers.formatDuration(durationSeconds) : '';

        return {
            showName: showName,
            season: seasonNum,
            episode: episodeNum,
            episodeTitle: episodeTitle,
            title: finalTitle,
            subtitle: subtitle,
            duration: formattedDuration,
            durationSeconds: durationSeconds,
            thumbnail: root.ThumbnailGenerator ? root.ThumbnailGenerator.extractThumbnail() : ''
        };
    }

    root.MetadataExtractor = {
        extract: extractPageMetadata,
        cleanTitle: cleanTitleString,
        parseIsoDuration: parseIsoDuration
    };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
