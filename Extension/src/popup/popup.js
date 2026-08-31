// src/popup/popup.js — High-Performance Event-Driven Popup Controller (Universal)

document.addEventListener('DOMContentLoaded', async () => {
    const videoList = document.getElementById('videoList');
    const emptyState = document.getElementById('emptyState');
    const statusLabel = document.getElementById('statusLabel');
    const completedSection = document.getElementById('completedSection');
    const completedList = document.getElementById('completedList');
    const btnRefresh = document.getElementById('btnRefresh');
    const btnSettingsToggle = document.getElementById('btnSettingsToggle');
    const btnCloseSettings = document.getElementById('btnCloseSettings');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const settingsPanel = document.getElementById('settingsPanel');
    const settingQuality = document.getElementById('settingQuality');
    const settingThreads = document.getElementById('settingThreads');
    const settingRemember = document.getElementById('settingRemember');
    const settingAutoEpisode = document.getElementById('settingAutoEpisode');

    let livePageMetadata = null;
    let liveThumbnail = '';
    let userSettings = { defaultQuality: 'best', threads: '32', rememberQuality: true, autoDetectEpisode: true };

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
        statusLabel.textContent = 'No active tab found';
        emptyState.classList.remove('hidden');
        return;
    }

    const currentTabUrl = tab.url || '';
    const currentTabTitle = tab.title || '';
    const currentTabDomain = (currentTabUrl ? new URL(currentTabUrl).hostname : '').toLowerCase();

    const isYT = currentTabDomain.includes('youtube.com') || currentTabDomain.includes('youtu.be');
    const isInsta = currentTabDomain.includes('instagram.com');
    const isPixelFlix = currentTabDomain.includes('pixelflix.cc') || currentTabDomain.includes('pvrplay') || currentTabDomain.includes('reelsdownload');
    
    function resolveSiteName() {
        if (isPixelFlix) return 'PixelFlix';
        if (isInsta) return 'Instagram';
        if (isYT) return 'YouTube';
        const clean = currentTabDomain.replace(/^www\./, '').split('.')[0];
        return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Stream';
    }

    const currentSiteName = resolveSiteName();
    const stableDeterministicId = `vid_${tab.id}_${currentSiteName.toLowerCase()}`;

    function getFallbackTitle() {
        if (!currentTabTitle) return 'Video';
        return currentTabTitle
            .replace(/^Watch\s+/i, '')
            .replace(/\s*[-|–—]\s*(PixelFlix|YouTube|Instagram|PvrPlay).*$/i, '')
            .replace(/[\\/:*?"<>|\r\n\t]+/g, ' ')
            .trim() || 'Video';
    }

    // Settings Handlers
    btnSettingsToggle.addEventListener('click', () => settingsPanel.classList.toggle('hidden'));
    btnCloseSettings.addEventListener('click', () => settingsPanel.classList.add('hidden'));

    btnSaveSettings.addEventListener('click', async () => {
        userSettings = {
            defaultQuality: settingQuality.value,
            threads: settingThreads.value || '64',
            rememberQuality: settingRemember.checked,
            autoDetectEpisode: settingAutoEpisode.checked
        };
        await window.Storage.set('user_settings', userSettings);
        settingsPanel.classList.add('hidden');
        loadData();
    });

    // Reactive State Loading
    async function loadData() {
        // 1. Await live page scan before reading storage
        try {
            const res = await new Promise(resolve => {
                try {
                    chrome.tabs.sendMessage(tab.id, { action: 'scanPage' }, (r) => {
                        if (chrome.runtime.lastError) resolve(null);
                        else resolve(r);
                    });
                } catch { resolve(null); }
            });

            if (res && res.metadata) {
                livePageMetadata = res.metadata;
                liveThumbnail = res.thumbnail || res.metadata.thumbnail;
                if (res.streams && res.streams.length > 0) {
                    for (const st of res.streams) {
                        await window.Storage.addVideo(tab.id, {
                            ...st,
                            title: res.metadata.title,
                            showName: res.metadata.showName,
                            subtitle: res.metadata.subtitle,
                            thumbnail: res.thumbnail || res.metadata.thumbnail,
                            platform: res.site
                        });
                    }
                }
            }
        } catch { }

        const tabData = await window.Storage.getTabVideos(tab.id);
        if (tabData && tabData.settings) {
            userSettings = { ...userSettings, ...tabData.settings };
            settingQuality.value = userSettings.defaultQuality || 'best';
            if (settingThreads) settingThreads.value = userSettings.threads || '64';
            settingRemember.checked = userSettings.rememberQuality !== false;
            settingAutoEpisode.checked = userSettings.autoDetectEpisode !== false;
        }

        let rawVideos = (tabData && tabData.videos) ? tabData.videos : [];
        const completed = (tabData && tabData.completed) ? tabData.completed : [];
        const activeDl = (tabData && tabData.activeDownload) ? tabData.activeDownload : null;

        // Strict Site Isolation & Filtering
        let videos = rawVideos.filter(v => {
            if (v.url && window.isInvalidStreamUrl && window.isInvalidStreamUrl(v.url)) return false;

            if (isPixelFlix) {
                return !v.isYouTube && v.platform !== 'YouTube' && v.platform !== 'Instagram' && !v.domain?.includes('instagram') && !v.domain?.includes('youtube');
            }
            if (isInsta) return v.platform === 'Instagram' || v.domain?.includes('instagram');
            if (isYT) return v.platform === 'YouTube' || v.domain?.includes('youtube');
            return v.platform !== 'Instagram' && v.platform !== 'YouTube';
        });

        // Prioritize confirmed media stream URLs (Main feature streams first)
        if (videos.length > 1) {
            videos.sort((a, b) => {
                const isVideosA = (a.url || '').includes('/videos/');
                const isVideosB = (b.url || '').includes('/videos/');
                if (isVideosA && !isVideosB) return -1;
                if (!isVideosA && isVideosB) return 1;

                const isM3u8A = (a.url || '').includes('.m3u8') || (a.url || '').includes('/hls/');
                const isM3u8B = (b.url || '').includes('.m3u8') || (b.url || '').includes('/hls/');
                if (isM3u8A && !isM3u8B) return -1;
                if (!isM3u8A && isM3u8B) return 1;

                const isMp4A = (a.url || '').includes('.mp4');
                const isMp4B = (b.url || '').includes('.mp4');
                if (isMp4A && !isMp4B) return -1;
                if (!isMp4A && isMp4B) return 1;
                return 0;
            });
            const withValidUrl = videos.find(v => v.url && ((v.url.includes('/videos/') && v.url.includes('.m3u8')) || v.url.includes('.m3u8') || v.url.includes('/hls/') || v.url.includes('.mp4'))) || videos.find(v => v.url && v.url.startsWith('http'));
            videos = withValidUrl ? [withValidUrl] : [videos[0]];
        }

        const fallbackTitle = (tab.title || 'Video').replace(/\s*-\s*YouTube$/i, '').trim();

        // Synthesize live detection if no captured streams yet
        if (videos.length === 0) {
            const initialTitle = (livePageMetadata?.title && livePageMetadata.title.length > 3) ? livePageMetadata.title : fallbackTitle;
            videos = [{
                id: stableDeterministicId,
                url: '',
                title: initialTitle,
                showName: livePageMetadata?.showName || initialTitle,
                subtitle: livePageMetadata?.subtitle || (isYT ? 'YouTube' : ''),
                season: livePageMetadata?.season,
                episode: livePageMetadata?.episode,
                episodeTitle: livePageMetadata?.episodeTitle || '',
                shortId: livePageMetadata?.shortId || '',
                domain: currentTabDomain.replace(/^www\./, ''),
                pageUrl: currentTabUrl,
                thumbnail: liveThumbnail || livePageMetadata?.thumbnail || (isYT ? `https://i.ytimg.com/vi/${new URLSearchParams(new URL(currentTabUrl).search).get('v') || ''}/hqdefault.jpg` : ''),
                duration: livePageMetadata?.duration || '',
                format: 'MP4',
                platform: currentSiteName,
                isYouTube: isYT,
                isDirectMp4: isInsta || isYT,
                isDownloadable: true,
                isRestricted: false,
                downloadNotice: ''
            }];
        }

        const effectiveTitle = (livePageMetadata && livePageMetadata.title && livePageMetadata.title !== 'Video' && livePageMetadata.title !== 'PvrPlay' && livePageMetadata.title.length > 3)
            ? livePageMetadata.title
            : (videos[0]?.title && videos[0]?.title !== 'Video' && videos[0]?.title !== 'PvrPlay' && videos[0].title.length > 3 ? videos[0].title : fallbackTitle);

        const effectiveShow = (livePageMetadata && livePageMetadata.showName && livePageMetadata.showName !== 'Video' && livePageMetadata.showName !== 'PvrPlay' && livePageMetadata.showName.length > 3)
            ? livePageMetadata.showName
            : (videos[0]?.showName && videos[0]?.showName !== 'Video' && videos[0]?.showName !== 'PvrPlay' && videos[0].showName.length > 3 ? videos[0].showName : fallbackTitle);

        const effectiveSubtitle = livePageMetadata?.subtitle || videos[0]?.subtitle || '';
        const effectiveSeason = livePageMetadata?.season !== undefined ? livePageMetadata.season : videos[0]?.season;
        const effectiveEpisode = livePageMetadata?.episode !== undefined ? livePageMetadata.episode : videos[0]?.episode;
        const effectiveEpTitle = livePageMetadata?.episodeTitle || videos[0]?.episodeTitle || '';

        videos.forEach(v => {
            v.platform = currentSiteName;
            if (!v.id) v.id = stableDeterministicId;
            v.title = effectiveTitle;
            v.showName = effectiveShow;
            v.subtitle = effectiveSubtitle;
            v.season = effectiveSeason;
            v.episode = effectiveEpisode;
            v.episodeTitle = effectiveEpTitle;
            if (!v.thumbnail && liveThumbnail) {
                v.thumbnail = liveThumbnail;
            }
        });

        if (videos.length > 0) {
            emptyState.classList.add('hidden');
            videoList.classList.remove('hidden');
            statusLabel.textContent = `${currentSiteName} Stream Detected`;
            renderVideoCards(videos, completed, activeDl);
        } else {
            emptyState.classList.remove('hidden');
            videoList.classList.add('hidden');
            statusLabel.textContent = 'Scanning for media streams...';
        }

        if (completed && completed.length > 0) {
            completedSection.classList.remove('hidden');
            renderCompletedList(completed);
        } else {
            completedSection.classList.add('hidden');
        }
    }

    // Initial Load & Storage Change Listener (Event-Driven Performance)
    await loadData();
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes[`tab_media_${tab.id}`] || changes['completed_downloads'])) {
            loadData();
        }
    });

    btnRefresh.addEventListener('click', async () => {
        statusLabel.textContent = 'Rescanning media...';
        try {
            chrome.tabs.sendMessage(tab.id, { action: 'scanPage' }, (res) => {
                if (res && res.metadata) {
                    livePageMetadata = res.metadata;
                    liveThumbnail = res.thumbnail || res.metadata.thumbnail;
                }
            });
        } catch { }
        await loadData();
    });

    // Render Video Cards
    function renderVideoCards(videos, completedListItems, activeDl) {
        const activeCardIds = new Set(Array.from(document.querySelectorAll('.video-card')).map(c => c.id));
        const newCardIds = new Set(videos.map(v => `card_${v.id}`));

        if (activeCardIds.size !== newCardIds.size || [...newCardIds].some(id => !activeCardIds.has(id))) {
            videoList.innerHTML = '';
        }

        videos.forEach((video) => {
            let card = document.getElementById(`card_${video.id}`);

            const currentTitle = video.title || 'Video';
            const currentShow = video.showName || 'Video';
            const currentSub = video.subtitle || '';
            const safeFileName = window.FilenameGenerator.generate({ ...video, title: currentTitle, platform: currentSiteName });
            const thumbUrl = video.thumbnail || liveThumbnail;

            const isDownloadPossible = true;

            let qualityLabel = 'Best Quality (Auto)';
            if (currentSiteName === 'Instagram') {
                qualityLabel = video.resolution ? `Original MP4 (${video.resolution})` : 'Original Quality (MP4)';
            } else if (currentSiteName === 'YouTube') {
                qualityLabel = video.qualityLabel || (video.resolution ? `${video.resolution} HD (MP4)` : '1080p Full HD (MP4)');
            } else if (video.qualityLabel) {
                qualityLabel = video.qualityLabel;
            }

            let buttonLabel = (currentSiteName === 'YouTube' || video.isYouTube)
                ? 'Download YouTube Video'
                : (currentSiteName === 'Instagram' ? 'Download Reel' : 'Download Video');
            if (isAlreadyDownloaded) {
                buttonLabel = 'Downloaded (Download Again)';
            }

            if (!card) {
                card = document.createElement('div');
                card.className = 'video-card';
                card.id = `card_${video.id}`;

                const thumbHtml = (thumbUrl && !thumbUrl.includes('data:image/svg+xml'))
                    ? `<img class="thumb-image" src="${thumbUrl}" alt="Thumbnail">`
                    : `<div class="thumb-placeholder">${currentSiteName}</div>`;

                const durationHtml = video.duration
                    ? `<span class="duration-chip">${video.duration}</span>`
                    : '';

                card.innerHTML = `
                    <div class="card-main-row">
                        <div class="card-thumb-box" id="thumb_box_${video.id}">
                            ${thumbHtml}
                            ${durationHtml}
                        </div>
                        <div class="card-details">
                            <div class="show-title-text" id="title_${video.id}">${currentShow}</div>
                            <div class="show-subtitle-text" id="sub_${video.id}">${currentSub}</div>
                            <div class="meta-badges-row">
                                <span class="badge-tag" id="res_tag_${video.id}">${isAlreadyDownloaded ? 'Downloaded' : (isDownloadPossible ? 'Ready' : 'Stream')}</span>
                                <span class="badge-tag">${currentSiteName}</span>
                            </div>
                        </div>
                    </div>

                    <div class="card-control-row">
                        <div class="control-field">
                            <span class="control-label">Quality</span>
                            <select class="quality-dropdown" id="qual_${video.id}">
                                <option value="">${qualityLabel}</option>
                            </select>
                        </div>
                        <div class="filename-preview-row">
                            File: <span id="file_prev_${video.id}">${safeFileName}</span>
                        </div>
                    </div>

                    <button class="btn-primary-download" id="btn_dl_${video.id}">
                        <span>${buttonLabel}</span>
                    </button>
                    <div class="error-banner ${isDownloadPossible ? 'hidden' : ''}" id="err_${video.id}">
                        ${video.downloadNotice || `${currentSiteName} stream detected.`}
                    </div>
                `;

                videoList.appendChild(card);
                bindCardActions(video, card, currentSiteName);
            } else {
                const titleEl = card.querySelector(`#title_${video.id}`);
                const subEl = card.querySelector(`#sub_${video.id}`);
                const filePrevEl = card.querySelector(`#file_prev_${video.id}`);
                const thumbBox = card.querySelector(`#thumb_box_${video.id}`);
                const resTag = card.querySelector(`#res_tag_${video.id}`);

                if (titleEl && titleEl.textContent !== currentShow) titleEl.textContent = currentShow;
                if (subEl && subEl.textContent !== currentSub) subEl.textContent = currentSub;
                if (filePrevEl && filePrevEl.textContent !== safeFileName) filePrevEl.textContent = safeFileName;

                if (isAlreadyDownloaded && resTag && resTag.textContent !== 'Downloaded') {
                    resTag.textContent = 'Downloaded';
                }

                if (thumbBox && thumbUrl && !thumbUrl.includes('data:image/svg+xml') && !thumbBox.querySelector('.thumb-image')) {
                    thumbBox.innerHTML = `
                        <img class="thumb-image" src="${thumbUrl}" alt="Thumbnail">
                        ${video.duration ? `<span class="duration-chip">${video.duration}</span>` : ''}
                    `;
                }
            }
        });
    }

    // Bind Card Actions
    function bindCardActions(video, card, siteName) {
        const dlBtn = card.querySelector(`#btn_dl_${video.id}`);
        const qualSelect = card.querySelector(`#qual_${video.id}`);
        const resTag = card.querySelector(`#res_tag_${video.id}`);
        const errBanner = card.querySelector(`#err_${video.id}`);

        if (video.isYouTube || siteName === 'YouTube') {
            const qOpt = video.qualityLabel || (video.resolution ? `${video.resolution} HD (MP4)` : '1080p Full HD (MP4)');
            qualSelect.innerHTML = `<option value="${video.url || ''}">${qOpt}</option>`;
            dlBtn.innerHTML = `<span>Download YouTube Video</span>`;
            dlBtn.disabled = false;
            resTag.textContent = 'Ready';
            errBanner.classList.add('hidden');
        }

        if (video.platform === 'Instagram' && video.isRestricted && !video.isDownloadable) {
            qualSelect.innerHTML = '<option value="">Protected Instagram Reel</option>';
            dlBtn.innerHTML = '<span>Download Unavailable</span>';
            dlBtn.disabled = true;
            resTag.textContent = 'Instagram Reel';
            errBanner.textContent = video.downloadNotice || 'Instagram Reel detected — direct media stream is protected.';
            errBanner.classList.remove('hidden');
            return;
        }

        if (video.isDirectMp4 && video.url && video.url.startsWith('http') && !video.url.includes('.m3u8')) {
            const qOpt = video.qualityLabel || (video.resolution ? `Original MP4 (${video.resolution})` : 'Original Quality (MP4)');
            qualSelect.innerHTML = `<option value="">${qOpt}</option>`;
            dlBtn.innerHTML = `<span>Download ${siteName === 'Instagram' ? 'Reel' : 'Video'}</span>`;
            dlBtn.disabled = false;
            resTag.textContent = 'Ready';
            errBanner.classList.add('hidden');
        }

        if (video.url && video.url.startsWith('http') && !card.dataset.inspected) {
            card.dataset.inspected = 'true';
            window.StreamDetector.parseHls(video.url, tab.id).then(parsed => {
                if (parsed.isDrmProtected) {
                    dlBtn.disabled = true;
                    errBanner.textContent = `${siteName} stream is DRM-protected and cannot be downloaded.`;
                    errBanner.classList.remove('hidden');
                    resTag.textContent = 'DRM Protected';
                    qualSelect.innerHTML = '<option value="">DRM Protected Stream</option>';
                    dlBtn.innerHTML = '<span>Download Unavailable</span>';
                } else if (parsed.isMaster && parsed.variants?.length > 0) {
                    window.QualitySelector.populate(qualSelect, parsed.variants);
                    const best = parsed.bestVariant || parsed.variants[0];
                    const cleanLabel = best.label.split(' • ')[0];
                    resTag.textContent = `${cleanLabel}`;
                    dlBtn.innerHTML = `<span>Download ${cleanLabel}</span>`;
                    dlBtn.disabled = false;
                    errBanner.classList.add('hidden');
                } else if (!parsed.isInvalid) {
                    resTag.textContent = 'Ready';
                    qualSelect.innerHTML = '<option value="">Highest Available (Auto)</option>';
                    dlBtn.innerHTML = `<span>Download Video</span>`;
                    dlBtn.disabled = false;
                    errBanner.classList.add('hidden');
                }
            }).catch(() => {
                resTag.textContent = 'Ready';
                dlBtn.disabled = false;
            });
        }

        qualSelect.addEventListener('change', () => {
            const selectedText = qualSelect.options[qualSelect.selectedIndex]?.text || '';
            const cleanTier = selectedText.replace('⭐ Best Quality — ', '').split(' • ')[0];
            if (!dlBtn.disabled) {
                dlBtn.innerHTML = `<span>Download ${cleanTier}</span>`;
            }
        });

        // Launch Downloader Tab
        dlBtn.addEventListener('click', async () => {
            if (dlBtn.disabled) return;

            let targetUrl = qualSelect.value || video.url;
            if (!targetUrl || !targetUrl.startsWith('http')) {
                const key = `tab_media_${tab.id}`;
                const stored = await chrome.storage.local.get(key);
                const list = stored[key] || [];
                const found = list.find(item => item.url && item.url.startsWith('http'));
                if (found) {
                    targetUrl = found.url;
                }
            }

            if (!targetUrl || !targetUrl.startsWith('http')) {
                errBanner.textContent = 'Waiting for media stream to buffer in player. Please play the video for 2 seconds and retry.';
                errBanner.classList.remove('hidden');
                return;
            }

            const currentTitle = video.title || getFallbackTitle();
            const currentShow = video.showName || currentTitle;
            const currentSub = video.subtitle || '';
            const selectedQualityLabel = qualSelect.options[qualSelect.selectedIndex]?.text || '1080p Full HD';
            const thumbUrl = video.thumbnail || liveThumbnail || (livePageMetadata ? livePageMetadata.thumbnail : '') || '';
            const durationStr = video.duration || (livePageMetadata ? livePageMetadata.duration : '') || '';

            const params = new URLSearchParams({
                url: targetUrl,
                title: currentTitle,
                showName: currentShow,
                subtitle: currentSub,
                quality: selectedQualityLabel,
                platform: siteName,
                thumbnail: thumbUrl,
                duration: durationStr,
                tabId: String(tab.id),
                threads: userSettings.threads || '64'
            });

            if (video.season !== undefined && video.season !== null && !isNaN(Number(video.season))) {
                params.set('season', String(video.season));
            }
            if (video.episode !== undefined && video.episode !== null && !isNaN(Number(video.episode))) {
                params.set('episode', String(video.episode));
            }
            if (video.episodeTitle && typeof video.episodeTitle === 'string' && !video.episodeTitle.toLowerCase().includes('nan')) {
                params.set('episodeTitle', video.episodeTitle);
            }

            const downloaderUrl = chrome.runtime.getURL(`src/downloader/downloader.html?${params.toString()}`);
            chrome.tabs.create({ url: downloaderUrl });
            window.close();
        });
    }

    // Render Download History
    function renderCompletedList(items) {
        completedList.innerHTML = '';
        items.slice(0, 10).forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-title-col">
                    <span class="history-filename" title="${item.filename || item.title}">${item.filename || item.title}</span>
                    <span class="history-meta">${item.quality || ''} • ${item.size || ''} • ${item.site || ''}</span>
                </div>
                <div class="history-actions">
                    ${item.downloadId ? `<button class="history-btn btn-open-folder" data-dlid="${item.downloadId}" title="Open Folder">Open</button>` : ''}
                    <button class="history-btn btn-remove-hist" data-id="${item.id}" title="Remove">✕</button>
                </div>
            `;

            const openBtn = div.querySelector('.btn-open-folder');
            if (openBtn) {
                openBtn.addEventListener('click', () => {
                    const dlId = parseInt(openBtn.dataset.dlid, 10);
                    if (dlId) chrome.downloads.show(dlId);
                });
            }

            div.querySelector('.btn-remove-hist').addEventListener('click', async () => {
                await window.Storage.removeCompletedDownload(item.id);
                loadData();
            });

            completedList.appendChild(div);
        });
    }
});
