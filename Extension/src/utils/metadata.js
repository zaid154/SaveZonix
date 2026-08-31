// src/utils/metadata.js — Dynamic 6-Tier Metadata Extractor (Universal)

(function (root) {
    function extractPageMetadata() {
        let showName = '';
        let seasonNum = null;
        let episodeNum = null;
        let episodeTitle = '';

        // ─── TIER 1: JSON-LD Schema.org ─────────────────────────────────────────
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of jsonLdScripts) {
            try {
                const data = JSON.parse(script.innerText);
                const items = Array.isArray(data) ? data : [data];
                for (const item of items) {
                    if (item['@type'] === 'TVEpisode' || item['@type'] === 'Episode') {
                        if (item.partOfSeries?.name) showName = item.partOfSeries.name;
                        if (item.partOfSeason?.seasonNumber) seasonNum = parseInt(item.partOfSeason.seasonNumber, 10);
                        if (item.episodeNumber) episodeNum = parseInt(item.episodeNumber, 10);
                        if (item.name && item.name.toLowerCase() !== `episode ${episodeNum}`) episodeTitle = item.name;
                    } else if (item['@type'] === 'TVSeries' || item['@type'] === 'Movie') {
                        if (item.name && !showName) showName = item.name;
                    }
                }
            } catch { }
        }

        // ─── TIER 2: Page Visible Headings & Show Title ────────────────────────
        if (!showName) {
            const heading = document.querySelector('h1, h2, .watch-title, .anime-title, .film-name, .show-title, .title');
            if (heading) {
                const text = heading.innerText.trim();
                if (text && text.length < 80) {
                    showName = text.replace(/^Watch\s+/i, '')
                                   .replace(/[-|–—].*$/, '')
                                   .replace(/Season\s*\d+.*/i, '')
                                   .replace(/Episode\s*\d+.*/i, '')
                                   .trim();
                }
            }
        }

        // ─── TIER 3: Visible Season Selector / Dropdown ────────────────────────
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

        // ─── TIER 4: Visible Episode Selector / Dropdown ───────────────────────
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

        // ─── TIER 5: HTML Meta & OpenGraph ─────────────────────────────────────
        if (!showName) {
            const ogTitle = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]')?.getAttribute('content');
            if (ogTitle) {
                showName = ogTitle.replace(/^Watch\s+/i, '')
                                  .replace(/[-|–—].*$/, '')
                                  .replace(/Season\s*\d+.*/i, '')
                                  .replace(/Episode\s*\d+.*/i, '')
                                  .trim();
            }
        }

        const metaSeason = document.querySelector('meta[property="video:season"]')?.getAttribute('content');
        if (metaSeason && seasonNum === null) seasonNum = parseInt(metaSeason, 10);

        const metaEpisode = document.querySelector('meta[property="video:episode"]')?.getAttribute('content');
        if (metaEpisode && episodeNum === null) episodeNum = parseInt(metaEpisode, 10);

        // ─── TIER 6: URL Search Parameters / Path ─────────────────────────────
        const currentUrl = window.location.href;
        if (seasonNum === null) {
            const sMatch = currentUrl.match(/[?&]season=(\d+)/i) || currentUrl.match(/\/season[_\-]?(\d+)/i);
            if (sMatch) seasonNum = parseInt(sMatch[1], 10);
        }

        if (episodeNum === null) {
            const eMatch = currentUrl.match(/[?&]episode=(\d+)/i) || currentUrl.match(/\/episode[_\-]?(\d+)/i) || currentUrl.match(/[\/_\-]e(\d+)[\/_\-?]/i);
            if (eMatch) episodeNum = parseInt(eMatch[1], 10);
        }

        if (!showName) {
            showName = document.title.replace(/^Watch\s+/i, '')
                                     .replace(/[-|–—].*$/, '')
                                     .replace(/Season\s*\d+.*/i, '')
                                     .replace(/Episode\s*\d+.*/i, '')
                                     .trim();
        }

        showName = (showName || '').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').trim().replace(/[:\-–—\s]+$/, '');
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

        return {
            showName: showName,
            season: seasonNum,
            episode: episodeNum,
            episodeTitle: episodeTitle,
            subtitle: subtitle,
            title: finalTitle
        };
    }

    root.extractPageMetadata = extractPageMetadata;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
