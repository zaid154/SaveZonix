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
    const ytChoiceModal = document.getElementById('ytChoiceModal');
    const btnCloseYtModal = document.getElementById('btnCloseYtModal');
    const btnYtModalSingle = document.getElementById('btnYtModalSingle');
    const btnYtModalPlaylist = document.getElementById('btnYtModalPlaylist');
    const engineStatusPill = document.getElementById('engineStatusPill');
    const enginePulseDot = document.getElementById('enginePulseDot');
    const engineStatusText = document.getElementById('engineStatusText');
    const shieldCard = document.getElementById('shieldCard');
    const toggleShieldSwitch = document.getElementById('toggleShieldSwitch');
    const shieldActiveBadge = document.getElementById('shieldActiveBadge');
    const shieldBlockCountNum = document.getElementById('shieldBlockCountNum');
    const shieldWhitelistBtn = document.getElementById('shieldWhitelistBtn');

    // ─────────────────────────────────────────────────────────────
    // SaveZonix Universal Ad & Pop-up Shield Controller
    // ─────────────────────────────────────────────────────────────
    let currentTabHostname = '';

    function initShieldUI() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs && tabs[0];
            const activeTabId = activeTab ? activeTab.id : -1;

            if (activeTab && activeTab.url) {
                try {
                    currentTabHostname = new URL(activeTab.url).hostname.toLowerCase();
                } catch { }
            }

            chrome.runtime.sendMessage({ action: 'getShieldStats', tabId: activeTabId }, (res) => {
                if (res) {
                    const isSiteWhitelisted = Array.isArray(res.whitelist) && currentTabHostname && res.whitelist.includes(currentTabHostname);
                    updateShieldUIState(res.enabled, res.blockedCount || 0, isSiteWhitelisted);
                }
            });

            if (toggleShieldSwitch) {
                toggleShieldSwitch.addEventListener('change', (e) => {
                    const isEnabled = e.target.checked;
                    chrome.runtime.sendMessage({ action: 'toggleShield', enabled: isEnabled }, (res) => {
                        updateShieldUIState(isEnabled, res?.blockedCount || 0);
                    });
                });
            }

            if (shieldWhitelistBtn) {
                shieldWhitelistBtn.addEventListener('click', () => {
                    if (!currentTabHostname) return;
                    chrome.runtime.sendMessage({ action: 'toggleWhitelistSite', hostname: currentTabHostname }, (res) => {
                        const isWhitelisted = Boolean(res?.isWhitelisted);
                        updateShieldUIState(toggleShieldSwitch ? toggleShieldSwitch.checked : true, 0, isWhitelisted);
                        // Reload tab to immediately apply or disable shield
                        if (activeTabId > 0) {
                            try { chrome.tabs.reload(activeTabId); } catch { }
                        }
                    });
                });
            }
        });
    }

    function updateShieldUIState(isEnabled, count = 0, isSiteWhitelisted = false) {
        if (toggleShieldSwitch) toggleShieldSwitch.checked = isEnabled && !isSiteWhitelisted;
        if (shieldBlockCountNum) shieldBlockCountNum.textContent = String(count);

        if (shieldWhitelistBtn && currentTabHostname) {
            if (isSiteWhitelisted) {
                shieldWhitelistBtn.textContent = 'Site Exempted (Click to Protect)';
                shieldWhitelistBtn.style.color = '#38bdf8';
            } else {
                shieldWhitelistBtn.textContent = 'Pause on this site';
                shieldWhitelistBtn.style.color = '#94a3b8';
            }
        }

        if (isEnabled && !isSiteWhitelisted) {
            shieldCard?.classList.remove('paused');
            if (shieldActiveBadge) {
                shieldActiveBadge.textContent = 'ON';
                shieldActiveBadge.style.background = '#10b981';
                shieldActiveBadge.style.color = '#022c22';
            }
            if (shieldCard) {
                shieldCard.style.borderColor = 'rgba(16, 185, 129, 0.25)';
                shieldCard.style.background = 'rgba(16, 185, 129, 0.08)';
            }
        } else {
            shieldCard?.classList.add('paused');
            if (shieldActiveBadge) {
                shieldActiveBadge.textContent = isSiteWhitelisted ? 'OFF (SITE)' : 'PAUSED';
                shieldActiveBadge.style.background = '#64748b';
                shieldActiveBadge.style.color = '#f8fafc';
            }
            if (shieldCard) {
                shieldCard.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                shieldCard.style.background = 'rgba(148, 163, 184, 0.06)';
            }
        }
    }

    initShieldUI();

    let backendBaseUrl = 'http://localhost:50550';
    let isLaunchingBackend = false;

    // Load cached port/url if available
    try {
        chrome.storage.local.get(['savezonix_backend_url', 'savezonix_backend_port'], (res) => {
            if (res && res.savezonix_backend_url) {
                backendBaseUrl = res.savezonix_backend_url;
            }
        });
    } catch { }

    function updateEngineUI(isActive, port = 50550, version = '2.5.4', isStarting = false) {
        if (!engineStatusPill) return;
        if (isStarting) {
            engineStatusPill.style.background = 'rgba(56, 189, 248, 0.15)';
            engineStatusPill.style.borderColor = 'rgba(56, 189, 248, 0.35)';
            engineStatusPill.style.color = '#38bdf8';
            if (enginePulseDot) enginePulseDot.style.background = '#38bdf8';
            if (engineStatusText) engineStatusText.textContent = 'Starting Engine...';
            engineStatusPill.title = 'SaveZonix Desktop Engine is starting up...';
            return;
        }

        if (isActive) {
            engineStatusPill.style.background = 'rgba(16, 185, 129, 0.15)';
            engineStatusPill.style.borderColor = 'rgba(16, 185, 129, 0.35)';
            engineStatusPill.style.color = '#34d399';
            if (enginePulseDot) enginePulseDot.style.background = '#10b981';
            if (engineStatusText) engineStatusText.textContent = `Engine Active (v${version})`;
            engineStatusPill.title = `SaveZonix Desktop Turbo Engine is connected & ready (Port ${port})`;
            engineStatusPill.onclick = () => {
                chrome.tabs.create({ url: backendBaseUrl });
            };
        } else {
            engineStatusPill.style.background = 'rgba(245, 158, 11, 0.15)';
            engineStatusPill.style.borderColor = 'rgba(245, 158, 11, 0.35)';
            engineStatusPill.style.color = '#fbbf24';
            if (enginePulseDot) enginePulseDot.style.background = '#f59e0b';
            if (engineStatusText) engineStatusText.textContent = 'App Sleeping (Launch)';
            engineStatusPill.title = 'SaveZonix Desktop App is not running. Click to launch automatically.';
            engineStatusPill.onclick = async () => {
                try {
                    await ensureDesktopBackendRunning((msg) => {
                        if (engineStatusText) engineStatusText.textContent = msg;
                    });
                    chrome.tabs.create({ url: backendBaseUrl });
                } catch (err) {
                    alert(err.message || 'Could not start SaveZonix desktop application.');
                }
            };
        }
    }

    async function pingBackend(port) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 250);
            const res = await fetch(`http://localhost:${port}/api/system/health`, { signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok) {
                const data = await res.json();
                return { ok: true, port, data };
            }
        } catch { }
        return { ok: false };
    }

    // Live Engine Handshake & Smart Auto-Port Discovery
    async function checkEngineHealth() {
        const candidatePorts = [50550, 50551, 50552, 50553, 50554, 50555, 5000];
        for (const p of candidatePorts) {
            const res = await pingBackend(p);
            if (res.ok) {
                backendBaseUrl = `http://localhost:${p}`;
                chrome.storage.local.set({ savezonix_backend_url: backendBaseUrl, savezonix_backend_port: p });
                updateEngineUI(true, p, res.data?.version || '2.5.4');
                return backendBaseUrl;
            }
        }
        updateEngineUI(false);
        return null;
    }

    async function triggerNativeLaunch() {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendNativeMessage('com.savezonix.launcher', { action: 'start' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[SaveZonix] Native messaging host not available:', chrome.runtime.lastError.message);
                        triggerProtocolLaunch();
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        console.log('[SaveZonix] Native messaging launch response:', response);
                        resolve({ success: true, response });
                    }
                });
            } catch (ex) {
                console.warn('[SaveZonix] sendNativeMessage error:', ex);
                triggerProtocolLaunch();
                resolve({ success: false, error: ex.message });
            }
        });
    }

    function triggerProtocolLaunch(customUrl = '') {
        try {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = customUrl ? `savezonix://download?url=${encodeURIComponent(customUrl)}` : 'savezonix://launch';
            document.body.appendChild(iframe);
            setTimeout(() => {
                try { iframe.remove(); } catch { }
            }, 2000);
        } catch { }
    }

    async function ensureDesktopBackendRunning(onProgress) {
        if (onProgress) onProgress('Checking desktop app...');

        // 1. Fast check if already running
        const activeUrl = await checkEngineHealth();
        if (activeUrl) {
            return activeUrl;
        }

        // Prevent parallel launch races
        if (isLaunchingBackend) {
            if (onProgress) onProgress('Starting SaveZonix...');
        } else {
            isLaunchingBackend = true;
            updateEngineUI(false, 50550, '2.5.4', true);
            if (onProgress) onProgress('Starting SaveZonix...');
            await triggerNativeLaunch();
        }

        if (onProgress) onProgress('Connecting to download engine...');

        // 2. Bounded polling for backend readiness (up to 15 seconds)
        const startTime = Date.now();
        const timeoutMs = 15000;
        while (Date.now() - startTime < timeoutMs) {
            await new Promise(r => setTimeout(r, 300));
            const candidatePorts = [50550, 50551, 50552, 50553, 50554, 50555, 5000];
            for (const p of candidatePorts) {
                const res = await pingBackend(p);
                if (res.ok) {
                    isLaunchingBackend = false;
                    backendBaseUrl = `http://localhost:${p}`;
                    chrome.storage.local.set({ savezonix_backend_url: backendBaseUrl, savezonix_backend_port: p });
                    updateEngineUI(true, p, res.data?.version || '2.5.4');
                    if (onProgress) onProgress('Connected.');
                    return backendBaseUrl;
                }
            }
        }

        isLaunchingBackend = false;
        updateEngineUI(false);
        throw new Error('SaveZonix desktop application is not installed or could not be started. Please run SaveZonix Setup.');
    }

    checkEngineHealth();

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
    let currentTabDomain = '';
    try {
        currentTabDomain = (currentTabUrl ? new URL(currentTabUrl).hostname : '').toLowerCase();
    } catch {
        currentTabDomain = '';
    }

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
    function generateUniqueTaskId(prefix = 'dl') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    function parseDurationSeconds(durStr) {
        if (!durStr) return 0;
        if (typeof durStr === 'number') return Math.round(durStr);
        const parts = String(durStr).trim().split(':').map(p => parseInt(p, 10));
        if (parts.some(isNaN)) return 0;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 1) return parts[0];
        return 0;
    }

    function formatBytes(bytes) {
        if (!bytes || isNaN(bytes) || bytes <= 0) return '';
        if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
        return `${Math.max(1, Math.round(bytes / 1048576))} MB`;
    }

    function estimateQualitySize(label, durSeconds) {
        const sec = (durSeconds && durSeconds > 0) ? durSeconds : 210; // default ~3.5 min
        const l = (label || '').toLowerCase();
        let bytesPerSec = 185000; // 1080p ~1.5 Mbps average (video + audio)
        if (l.includes('2160') || l.includes('4k')) bytesPerSec = 1100000; // ~9 Mbps
        else if (l.includes('1440') || l.includes('2k')) bytesPerSec = 550000; // ~4.4 Mbps
        else if (l.includes('1080')) bytesPerSec = 185000; // ~1.5 Mbps
        else if (l.includes('720')) bytesPerSec = 105000; // ~840 Kbps
        else if (l.includes('480')) bytesPerSec = 55000; // ~440 Kbps
        else if (l.includes('360')) bytesPerSec = 35000; // ~280 Kbps
        else if (l.includes('mp3') || l.includes('audio')) bytesPerSec = 16000; // 128 kbps audio ~16 KB/s

        return formatBytes(bytesPerSec * sec);
    }

    function getYouTubeDetails(url) {
        try {
            if (!url) return null;
            const u = new URL(url);
            const isYtHost = u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be');
            if (!isYtHost) return null;

            const v = u.searchParams.get('v');
            const list = u.searchParams.get('list');
            const isPlaylistPage = u.pathname.includes('/playlist');
            const hasPlaylist = Boolean(list || isPlaylistPage);
            const singleVideoUrl = v ? `https://www.youtube.com/watch?v=${v}` : url;
            const playlistUrl = url;

            return {
                isYt: true,
                hasPlaylist,
                isPlaylistPage,
                videoId: v,
                listId: list,
                singleVideoUrl,
                playlistUrl
            };
        } catch {
            return null;
        }
    }

    const ytDetails = getYouTubeDetails(currentTabUrl);

    if (btnCloseYtModal) {
        btnCloseYtModal.addEventListener('click', () => {
            if (ytChoiceModal) ytChoiceModal.classList.add('hidden');
        });
    }
    if (btnYtModalSingle) {
        btnYtModalSingle.addEventListener('click', async () => {
            const singleUrl = (ytDetails && ytDetails.singleVideoUrl) || currentTabUrl;
            const btnSpan = btnYtModalSingle.querySelector('.modal-btn-text strong') || btnYtModalSingle;
            const originalText = btnSpan.textContent;
            btnYtModalSingle.disabled = true;

            try {
                const readyBase = await ensureDesktopBackendRunning((msg) => {
                    btnSpan.textContent = msg;
                });
                btnSpan.textContent = 'Download started.';
                chrome.tabs.create({
                    url: `${readyBase}/?url=${encodeURIComponent(singleUrl)}&autoDownload=1`
                });
                window.close();
            } catch (err) {
                alert(err.message || 'Failed to start SaveZonix.');
                btnSpan.textContent = originalText;
                btnYtModalSingle.disabled = false;
            }
        });
    }
    async function handlePlaylistDownload(plUrl) {
        try {
            await ensureDesktopBackendRunning();
        } catch (err) {
            alert(err.message || 'Failed to start SaveZonix.');
            return;
        }

        // 1. Try to extract exact live queue from active YouTube tab
        try {
            const queueRes = await new Promise(resolve => {
                try {
                    chrome.tabs.sendMessage(tab.id, { action: 'getYoutubeQueue' }, (r) => {
                        if (chrome.runtime.lastError) resolve(null);
                        else resolve(r);
                    });
                } catch { resolve(null); }
            });

            if (queueRes && queueRes.success && Array.isArray(queueRes.queue) && queueRes.queue.length > 0) {
                // Post exact active tab queue to SaveZonix backend
                try {
                    const postResp = await fetch(`${backendBaseUrl}/api/playlist/import-tab-queue`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: currentTabTitle || 'YouTube Mix',
                            url: plUrl,
                            author: 'YouTube',
                            items: queueRes.queue
                        })
                    });

                    if (postResp.ok) {
                        const postData = await postResp.json();
                        if (postData.queueKey) {
                            chrome.tabs.create({
                                url: `${backendBaseUrl}/playlist?queueKey=${postData.queueKey}&url=${encodeURIComponent(plUrl)}`
                            });
                            window.close();
                            return;
                        }
                    }
                } catch (e) {
                    console.warn('[SaveZonix] Failed to post tab queue to localhost:', e);
                }
            }
        } catch { }

        // Fallback: regular URL load
        chrome.tabs.create({
            url: `${backendBaseUrl}/playlist?url=${encodeURIComponent(plUrl)}`
        });
        window.close();
    }

    if (btnYtModalPlaylist) {
        btnYtModalPlaylist.addEventListener('click', () => {
            const plUrl = (ytDetails && ytDetails.playlistUrl) || currentTabUrl;
            handlePlaylistDownload(plUrl);
        });
    }

    function isGenericTitle(t) {
        if (!t) return true;
        const s = String(t).trim().toLowerCase();
        return s === 'video' || s === 'youtube video' || s === 'youtube' || s === 'instagram reel' || s === 'instagram' || s === 'stream' || s === 'pvrplay';
    }

    function getFallbackTitle() {
        if (!currentTabTitle) return 'Video';
        return currentTabTitle
            .replace(/^\(\d+\)\s*/, '')
            .replace(/^Watch\s+/i, '')
            .replace(/\s*[-–—|•]\s*(PixelFlix|YouTube|Instagram|PvrPlay).*$/i, '')
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
        let scanRes = null;
        // 1. Await live page scan before reading storage (Strict 250ms race timeout prevents freezing)
        try {
            const scanPromise = new Promise(resolve => {
                try {
                    chrome.tabs.sendMessage(tab.id, { action: 'scanPage' }, (r) => {
                        if (chrome.runtime.lastError) resolve(null);
                        else resolve(r);
                    });
                } catch { resolve(null); }
            });

            scanRes = await Promise.race([
                scanPromise,
                new Promise(r => setTimeout(() => r(null), 250))
            ]);

            if (scanRes && scanRes.metadata) {
                livePageMetadata = scanRes.metadata;
                liveThumbnail = scanRes.thumbnail || scanRes.metadata.thumbnail;
                if (scanRes.streams && scanRes.streams.length > 0) {
                    if (isInsta && window.Storage?.clearTabVideos) {
                        await window.Storage.clearTabVideos(tab.id);
                    }
                    for (const st of scanRes.streams) {
                        await window.Storage.addVideo(tab.id, {
                            ...st,
                            title: scanRes.metadata.title,
                            showName: scanRes.metadata.showName,
                            subtitle: scanRes.metadata.subtitle,
                            thumbnail: scanRes.thumbnail || scanRes.metadata.thumbnail,
                            platform: scanRes.site || 'Instagram'
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
        let completed = (tabData && tabData.completed) ? tabData.completed : [];

        // Sync recent downloads asynchronously in background without blocking video cards
        fetch(`${backendBaseUrl}/api/extension/recent-downloads`, {
            signal: AbortSignal.timeout(1200)
        }).then(async syncResp => {
            if (syncResp.ok) {
                const syncData = await syncResp.json();
                if (syncData && syncData.success && Array.isArray(syncData.items)) {
                    const freshCompleted = syncData.items.filter(i => {
                        if (!i) return false;
                        const fn = (i.filename || '').toLowerCase();
                        const t = (i.title || '').toLowerCase();
                        return (fn !== 'video.mp4' || (t && t !== 'video.mp4' && t !== 'video')) && (t !== 'video.mp4');
                    });
                    if (freshCompleted.length > 0) {
                        await chrome.storage.local.set({ completed_downloads: freshCompleted });
                        completedSection.classList.remove('hidden');
                        renderCompletedList(freshCompleted);
                    }
                }
            }
        }).catch(() => { });

        const activeDl = (tabData && tabData.activeDownload) ? tabData.activeDownload : null;

        // Strict Site Isolation & Filtering
        let videos = [];
        if (isInsta && scanRes && scanRes.streams && scanRes.streams.length > 0) {
            // For Instagram: Strictly prioritize the active visible reel from live scan!
            videos = scanRes.streams.map(st => ({
                ...st,
                title: scanRes.metadata?.title || 'Instagram Reel',
                showName: scanRes.metadata?.showName || 'Instagram Reel',
                subtitle: scanRes.metadata?.subtitle || '',
                thumbnail: scanRes.thumbnail || scanRes.metadata?.thumbnail || st.thumbnail || '',
                platform: 'Instagram',
                isDirectMp4: true,
                isDownloadable: st.isDownloadable !== false
            }));
        } else if (isInsta && rawVideos.length > 0) {
            videos = rawVideos.filter(v => (v.platform === 'Instagram' || v.domain?.includes('instagram')) && (!v.url || !window.isInvalidStreamUrl || !window.isInvalidStreamUrl(v.url)));
            if (videos.length > 1) {
                videos = [videos[videos.length - 1]]; // latest detected
            }
        } else {
            videos = rawVideos.filter(v => {
                if (v.url && window.isInvalidStreamUrl && window.isInvalidStreamUrl(v.url)) return false;

                if (isPixelFlix) {
                    return !v.isYouTube && v.platform !== 'YouTube' && v.platform !== 'Instagram' && !v.domain?.includes('instagram') && !v.domain?.includes('youtube');
                }
                if (isInsta) return v.platform === 'Instagram' || v.domain?.includes('instagram');
                if (isYT) {
                    const isYtVideoActive = Boolean(ytDetails && (ytDetails.videoId || ytDetails.hasPlaylist || ytDetails.isPlaylistPage)) || currentTabUrl.includes('/shorts/') || currentTabUrl.includes('/live/');
                    if (!isYtVideoActive) return false; // Do not show media on YouTube home/search/channel feed
                    return v.platform === 'YouTube' || v.domain?.includes('youtube');
                }
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
        }

        const fallbackTitle = (tab.title || 'Video')
            .replace(/^\(\d+\)\s*/, '')
            .replace(/\s*[-–—|•]\s*YouTube.*$/i, '')
            .replace(/[\\/:*?"<>|\r\n\t]+/g, ' ')
            .trim() || 'Video';

        // Only synthesize a live card if the user is actually on a dedicated video/watch page
        const isWatchPage = (isYT && (Boolean(ytDetails && (ytDetails.videoId || ytDetails.hasPlaylist || ytDetails.isPlaylistPage)) || currentTabUrl.includes('/shorts/') || currentTabUrl.includes('/live/')))
            || (isInsta && (currentTabUrl.includes('/reel/') || currentTabUrl.includes('/p/') || currentTabUrl.includes('/stories/')))
            || (isPixelFlix && (currentTabUrl.includes('/watch') || currentTabUrl.includes('/movie') || currentTabUrl.includes('/episode') || currentTabUrl.includes('/title')))
            || (!isYT && !isInsta && !isPixelFlix && livePageMetadata && livePageMetadata.title && livePageMetadata.title !== 'Video' && livePageMetadata.title.length > 3);

        if (videos.length === 0 && isWatchPage) {
            const initialTitle = (livePageMetadata?.title && livePageMetadata.title.length > 3) ? livePageMetadata.title : fallbackTitle;
            videos = [{
                id: generateUniqueTaskId(`vid_${tab.id}`),
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

        const effectiveTitle = (livePageMetadata && livePageMetadata.title && !isGenericTitle(livePageMetadata.title) && livePageMetadata.title.length > 3)
            ? livePageMetadata.title
            : (videos[0]?.title && !isGenericTitle(videos[0].title) && videos[0].title.length > 3 ? videos[0].title : fallbackTitle);

        const effectiveShow = (livePageMetadata && livePageMetadata.showName && !isGenericTitle(livePageMetadata.showName) && livePageMetadata.showName.length > 3)
            ? livePageMetadata.showName
            : (videos[0]?.showName && !isGenericTitle(videos[0].showName) && videos[0].showName.length > 3 ? videos[0].showName : fallbackTitle);

        const effectiveSubtitle = livePageMetadata?.subtitle || videos[0]?.subtitle || '';
        const effectiveSeason = livePageMetadata?.season !== undefined ? livePageMetadata.season : videos[0]?.season;
        const effectiveEpisode = livePageMetadata?.episode !== undefined ? livePageMetadata.episode : videos[0]?.episode;
        const effectiveEpTitle = livePageMetadata?.episodeTitle || videos[0]?.episodeTitle || '';

        videos.forEach(v => {
            v.platform = currentSiteName;
            if (!v.id) v.id = generateUniqueTaskId(`vid_${tab.id}`);
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
            statusLabel.textContent = 'Ready to Capture';
            const dot = document.querySelector('.status-line .dot');
            if (dot) dot.style.background = '#64748b';
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
        btnRefresh.classList.add('spinning');
        statusLabel.textContent = 'Rescanning media streams...';
        try {
            const scanPromise = new Promise(resolve => {
                try {
                    chrome.tabs.sendMessage(tab.id, { action: 'scanPage' }, (res) => {
                        if (chrome.runtime.lastError) resolve(null);
                        else resolve(res);
                    });
                } catch { resolve(null); }
            });

            const res = await Promise.race([
                scanPromise,
                new Promise(r => setTimeout(() => r(null), 1500))
            ]);

            if (res && res.metadata) {
                livePageMetadata = res.metadata;
                liveThumbnail = res.thumbnail || res.metadata.thumbnail;
                if (res.streams && res.streams.length > 0 && isInsta && window.Storage?.clearTabVideos) {
                    await window.Storage.clearTabVideos(tab.id);
                }
            }
        } catch { }

        await loadData();

        setTimeout(() => {
            btnRefresh.classList.remove('spinning');
            statusLabel.textContent = `${currentSiteName} Stream Detected`;
        }, 350);
    });

    // Render Video Cards
    function renderVideoCards(videos, completedListItems, activeDl) {
        const activeCardIds = new Set(Array.from(document.querySelectorAll('.video-card')).map(c => c.id));
        const newCardIds = new Set(videos.map(v => `card_${v.id}`));

        if (activeCardIds.size !== newCardIds.size || [...newCardIds].some(id => !activeCardIds.has(id))) {
            videoList.innerHTML = '';
        }

        const fbTitle = getFallbackTitle();
        videos.forEach((video) => {
            let card = document.getElementById(`card_${video.id}`);

            const currentTitle = (!isGenericTitle(video.title) ? video.title : (!isGenericTitle(video.showName) ? video.showName : fbTitle));
            const currentShow = (!isGenericTitle(video.showName) ? video.showName : (!isGenericTitle(video.title) ? video.title : fbTitle));
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

            const isAlreadyDownloaded = Array.isArray(completedListItems) && completedListItems.some(c => (c.url && c.url === video.url) || c.id === video.id);

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

                let actionRowHtml = '';
                if ((currentSiteName === 'YouTube' || video.isYouTube || isYT) && ytDetails && ytDetails.hasPlaylist && ytDetails.videoId) {
                    actionRowHtml = `
                        <div class="card-action-row" style="margin-top: 10px;">
                            <div class="yt-choice-group">
                                <button class="btn-yt-choice btn-yt-single" id="btn_yt_single_${video.id}">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                    <span>Download Video (Best Quality)</span>
                                </button>
                                <button class="btn-yt-choice btn-yt-playlist" id="btn_yt_playlist_${video.id}">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                                    <span>Open in Playlist Studio</span>
                                </button>
                            </div>
                        </div>
                    `;
                } else if ((currentSiteName === 'YouTube' || video.isYouTube || isYT) && ytDetails && ytDetails.isPlaylistPage) {
                    actionRowHtml = `
                        <div class="card-action-row" style="margin-top: 10px;">
                            <button class="btn-yt-choice btn-yt-playlist" id="btn_yt_playlist_${video.id}" style="width: 100%;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                                <span>Open Entire Playlist in Zonix Studio</span>
                            </button>
                        </div>
                    `;
                } else {
                    const cinemaBtn = (!isYT && !video.isYouTube && video.url && video.url.startsWith('http'))
                        ? `<button class="btn-cinema-watch" id="btn_cinema_${video.id}" style="width:100%; margin-top:6px; display:flex; align-items:center; justify-content:center; gap:6px; padding:9px 16px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25); color:#10b981; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s ease;" onmouseover="this.style.background='rgba(16,185,129,0.2)'" onmouseout="this.style.background='rgba(16,185,129,0.1)'">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                <span>Watch Ad-Free in Zonix Cinema</span>
                            </button>`
                        : '';
                    actionRowHtml = `
                        <div class="card-action-row" style="margin-top: 10px;">
                            <button class="btn-primary-download" id="btn_dl_${video.id}" style="width: 100%;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                <span>${(currentSiteName === 'YouTube' || video.isYouTube || isYT) ? 'Download Video (Best Quality)' : buttonLabel}</span>
                            </button>
                            ${cinemaBtn}
                        </div>
                    `;
                }

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
                                <span class="badge-tag badge-size" id="size_tag_${video.id}"></span>
                                <span class="badge-tag">${(ytDetails && ytDetails.hasPlaylist) ? 'YouTube Mix' : currentSiteName}</span>
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

                    ${actionRowHtml}
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

        if (video.isYouTube || siteName === 'YouTube' || isYT) {
            const durSeconds = video.durationSeconds || livePageMetadata?.durationSeconds || parseDurationSeconds(video.duration || livePageMetadata?.duration);
            const sizeTag = card.querySelector(`#size_tag_${video.id}`);
            const targetQuality = userSettings.defaultQuality || 'best';

            // Option 1: Live extracted qualities from page manifest / HTML5 player
            const liveQualities = (livePageMetadata?.availableQualities && livePageMetadata.availableQualities.length > 0)
                ? livePageMetadata.availableQualities
                : (video.availableQualities || []);

            let qualityOptions = [];
            if (liveQualities.length > 0) {
                const has4k = liveQualities.some(q => q.quality && (q.quality.includes('2160') || q.quality.includes('4k')));
                const has2k = liveQualities.some(q => q.quality && (q.quality.includes('1440') || q.quality.includes('2k')));
                const has1080 = liveQualities.some(q => q.quality && q.quality.includes('1080'));

                const topQualityTag = has4k ? '4K Ultra HD' : (has2k ? '2K Quad HD' : (has1080 ? '1080p Full HD' : (liveQualities[0]?.quality || 'HD')));
                const topVal = has4k ? '2160p' : (has2k ? '1440p' : (has1080 ? '1080p' : (liveQualities[0]?.quality || '720p')));
                const bestSize = estimateQualitySize(topVal, durSeconds);

                // 1. Highest / Best Available option matches the highest quality available for this video
                qualityOptions.push({
                    value: 'best',
                    label: `⭐  Best Available (${topQualityTag}) • ~${bestSize}`,
                    tag: topQualityTag,
                    size: `~${bestSize}`,
                    selected: (targetQuality === 'best')
                });

                liveQualities.forEach(q => {
                    const qLabel = q.quality || '';
                    const sizeStr = q.contentLength > 0 ? formatBytes(q.contentLength) : estimateQualitySize(qLabel, durSeconds);
                    let displayLabel = qLabel;
                    let normVal = qLabel;
                    if (qLabel.includes('2160') || qLabel.includes('4k')) { displayLabel = '4K Ultra HD (2160p)'; normVal = '2160p'; }
                    else if (qLabel.includes('1440') || qLabel.includes('2k')) { displayLabel = '2K Quad HD (1440p)'; normVal = '1440p'; }
                    else if (qLabel.includes('1080')) { displayLabel = '1080p Full HD (MP4)'; normVal = '1080p'; }
                    else if (qLabel.includes('720')) { displayLabel = '720p HD (Fast)'; normVal = '720p'; }
                    else if (qLabel.includes('480')) { displayLabel = '480p Standard'; normVal = '480p'; }
                    else if (qLabel.includes('360')) { displayLabel = '360p Data Saver'; normVal = '360p'; }

                    qualityOptions.push({
                        value: normVal,
                        label: `${displayLabel} • ~${sizeStr}`,
                        tag: displayLabel.split(' (')[0],
                        size: `~${sizeStr}`,
                        selected: (targetQuality === normVal)
                    });
                });

                const mp3Size = estimateQualitySize('mp3', durSeconds);
                qualityOptions.push({
                    value: 'mp3',
                    label: `🎵 MP3 Audio (320 kbps) • ~${mp3Size}`,
                    tag: 'MP3 320k',
                    size: `~${mp3Size}`,
                    selected: (targetQuality === 'mp3')
                });
            } else {
                // Default comprehensive list with live calculated file sizes
                const s4k = estimateQualitySize('2160p', durSeconds);
                const s2k = estimateQualitySize('1440p', durSeconds);
                const s1080 = estimateQualitySize('1080p', durSeconds);
                const s720 = estimateQualitySize('720p', durSeconds);
                const s480 = estimateQualitySize('480p', durSeconds);
                const sMp3 = estimateQualitySize('mp3', durSeconds);

                qualityOptions = [
                    { value: 'best', label: `⭐ Best Available (Auto 4K/1080p) • ~${s1080}`, tag: 'Best Quality', size: `~${s1080}`, selected: (targetQuality === 'best') },
                    { value: '2160p', label: `4K Ultra HD (2160p) • ~${s4k}`, tag: '4K Ultra HD', size: `~${s4k}`, selected: (targetQuality === '2160p') },
                    { value: '1440p', label: `2K Quad HD (1440p) • ~${s2k}`, tag: '2K Quad HD', size: `~${s2k}`, selected: (targetQuality === '1440p') },
                    { value: '1080p', label: `1080p Full HD (MP4) • ~${s1080}`, tag: '1080p Full HD', size: `~${s1080}`, selected: (targetQuality === '1080p') },
                    { value: '720p', label: `720p HD (Fast) • ~${s720}`, tag: '720p HD', size: `~${s720}`, selected: (targetQuality === '720p') },
                    { value: '480p', label: `480p Standard • ~${s480}`, tag: '480p', size: `~${s480}`, selected: (targetQuality === '480p') },
                    { value: 'mp3', label: `🎵 MP3 Audio (320 kbps) • ~${sMp3}`, tag: 'MP3 320k', size: `~${sMp3}`, selected: (targetQuality === 'mp3') }
                ];
            }

            if (!qualityOptions.some(o => o.selected)) {
                qualityOptions[0].selected = true;
            }

            qualSelect.innerHTML = qualityOptions.map(opt => `<option value="${opt.value}" ${opt.selected ? 'selected' : ''} data-tag="${opt.tag}" data-size="${opt.size}">${opt.label}</option>`).join('');

            const currentOpt = qualityOptions.find(o => o.selected) || qualityOptions[0];
            resTag.textContent = (ytDetails && ytDetails.hasPlaylist) ? 'Playlist' : (currentOpt.tag || '1080p');
            if (sizeTag) {
                sizeTag.textContent = currentOpt.size || '';
                sizeTag.style.display = currentOpt.size ? 'inline-flex' : 'none';
            }
            errBanner.classList.add('hidden');

            // Sync button label immediately on render
            const initialSingleSpan = card.querySelector(`#btn_yt_single_${video.id} span`);
            if (initialSingleSpan) initialSingleSpan.textContent = `Download Video (${currentOpt.tag || 'Best Quality'})`;
            const initialDlSpan = dlBtn ? dlBtn.querySelector('span') : null;
            if (initialDlSpan) initialDlSpan.textContent = `Download Video (${currentOpt.tag || 'Best Quality'})`;

            // Option 2: Probe server-side analyze in background to confirm exact streams & exact file sizes
            const singleVideoUrl = (ytDetails && ytDetails.singleVideoUrl) || currentTabUrl;
            if (singleVideoUrl && !card.dataset.backendProbed) {
                card.dataset.backendProbed = 'true';
                fetch(`${backendBaseUrl}/api/analyze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: singleVideoUrl })
                }).then(async r => {
                    if (r.ok) {
                        const data = await r.json();
                        if (data && data.success && Array.isArray(data.qualities) && data.qualities.length > 0) {
                            const backendOptions = [];
                            const top = data.qualities[0];
                            const topTag = top.resolution || 'Best Quality';

                            backendOptions.push({
                                value: 'best',
                                label: `⭐  Best Available (${topTag}) • ${top.formattedEstimatedSize || ''}`,
                                tag: topTag,
                                size: top.formattedEstimatedSize || ''
                            });
                            data.qualities.forEach(q => {
                                backendOptions.push({
                                    value: q.resolution,
                                    label: `${q.resolution} • ${q.formattedEstimatedSize || ''}`,
                                    tag: q.resolution,
                                    size: q.formattedEstimatedSize || ''
                                });
                            });
                            const serverMp3 = estimateQualitySize('mp3', data.durationSeconds || durSeconds);
                            backendOptions.push({
                                value: 'mp3',
                                label: `🎵 MP3 Audio (320 kbps) • ~${serverMp3}`,
                                tag: 'MP3 320k',
                                size: `~${serverMp3}`
                            });

                            let activeVal = qualSelect.value;
                            if (!activeVal || activeVal === 'best' || targetQuality === 'best') {
                                activeVal = 'best';
                            } else if (!backendOptions.some(o => o.value === activeVal)) {
                                activeVal = 'best';
                            }

                            qualSelect.innerHTML = backendOptions.map(opt => `<option value="${opt.value}" ${opt.value === activeVal ? 'selected' : ''} data-tag="${opt.tag}" data-size="${opt.size}">${opt.label}</option>`).join('');

                            const activeOpt = backendOptions.find(o => o.value === qualSelect.value) || backendOptions[0];
                            if (activeOpt) {
                                resTag.textContent = (ytDetails && ytDetails.hasPlaylist) ? 'Playlist' : (activeOpt.tag || 'Ready');
                                if (sizeTag) {
                                    sizeTag.textContent = activeOpt.size || '';
                                    sizeTag.style.display = activeOpt.size ? 'inline-flex' : 'none';
                                }
                                const bSpan = card.querySelector(`#btn_yt_single_${video.id} span`);
                                if (bSpan) bSpan.textContent = `Download Video (${activeOpt.tag})`;
                                const dSpan = dlBtn ? dlBtn.querySelector('span') : null;
                                if (dSpan) dSpan.textContent = `Download Video (${activeOpt.tag})`;
                            }
                        }
                    }
                }).catch(() => {});
            }

            qualSelect.addEventListener('change', () => {
                const sel = qualSelect.options[qualSelect.selectedIndex];
                const optTag = sel?.dataset.tag || 'Ready';
                const optSize = sel?.dataset.size || '';
                resTag.textContent = (ytDetails && ytDetails.hasPlaylist) ? 'Playlist' : optTag;
                if (sizeTag) {
                    sizeTag.textContent = optSize;
                    sizeTag.style.display = optSize ? 'inline-flex' : 'none';
                }

                const dlSpan = dlBtn ? dlBtn.querySelector('span') : null;
                if (dlSpan) {
                    dlSpan.textContent = `Download Video (${optTag})`;
                }
                const btnSingleSpan = card.querySelector(`#btn_yt_single_${video.id} span`);
                if (btnSingleSpan) {
                    btnSingleSpan.textContent = `Download Video (${optTag})`;
                }
            });

            const getSelectedQuality = () => qualSelect.value || '1080p';

            const btnYtSingle = card.querySelector(`#btn_yt_single_${video.id}`);
            const btnYtPlaylist = card.querySelector(`#btn_yt_playlist_${video.id}`);

            if (btnYtSingle) {
                btnYtSingle.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const singleUrl = (ytDetails && ytDetails.singleVideoUrl) || currentTabUrl;
                    const chosenQuality = getSelectedQuality();
                    const bSpan = btnYtSingle.querySelector('span') || btnYtSingle;
                    const originalText = bSpan.textContent;
                    btnYtSingle.disabled = true;

                    try {
                        const readyBase = await ensureDesktopBackendRunning((msg) => {
                            bSpan.textContent = msg;
                        });
                        bSpan.textContent = 'Download started.';
                        chrome.tabs.create({
                            url: `${readyBase}/?url=${encodeURIComponent(singleUrl)}&quality=${encodeURIComponent(chosenQuality)}&autoDownload=1`
                        });
                        window.close();
                    } catch (err) {
                        alert(err.message || 'Failed to start SaveZonix.');
                        bSpan.textContent = originalText;
                        btnYtSingle.disabled = false;
                    }
                });
            }

            if (btnYtPlaylist) {
                btnYtPlaylist.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const plUrl = (ytDetails && ytDetails.playlistUrl) || currentTabUrl;
                    handlePlaylistDownload(plUrl);
                });
            }

            if (dlBtn) {
                dlBtn.disabled = false;
                dlBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (ytDetails && ytDetails.hasPlaylist && ytDetails.videoId) {
                        if (ytChoiceModal) ytChoiceModal.classList.remove('hidden');
                        return;
                    }
                    if (ytDetails && ytDetails.isPlaylistPage) {
                        handlePlaylistDownload(currentTabUrl);
                        return;
                    }
                    const target = (ytDetails && ytDetails.singleVideoUrl) || currentTabUrl;
                    const chosenQuality = getSelectedQuality();
                    const dlSpan = dlBtn.querySelector('span') || dlBtn;
                    const originalText = dlSpan.textContent;
                    dlBtn.disabled = true;

                    try {
                        const readyBase = await ensureDesktopBackendRunning((msg) => {
                            dlSpan.textContent = msg;
                        });
                        dlSpan.textContent = 'Download started.';
                        chrome.tabs.create({
                            url: `${readyBase}/?url=${encodeURIComponent(target)}&quality=${encodeURIComponent(chosenQuality)}&autoDownload=1`
                        });
                        window.close();
                    } catch (err) {
                        alert(err.message || 'Failed to start SaveZonix.');
                        dlSpan.textContent = originalText;
                        dlBtn.disabled = false;
                    }
                });
            }
            return;
        }

        // Cinema (Ad-Free Watch) button handler
        const cinemaBtn = card.querySelector(`#btn_cinema_${video.id}`);
        if (cinemaBtn) {
            cinemaBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const watchUrl = video.url || currentTabUrl;
                const watchTitle = video.title || video.showName || currentTabTitle || 'Stream';
                const originalText = cinemaBtn.textContent;
                cinemaBtn.disabled = true;

                try {
                    const readyBase = await ensureDesktopBackendRunning((msg) => {
                        cinemaBtn.textContent = msg;
                    });
                    const cinemaLink = `${readyBase}/cinema?url=${encodeURIComponent(watchUrl)}&title=${encodeURIComponent(watchTitle)}&site=${encodeURIComponent(currentSiteName)}&quality=1080p`;
                    chrome.tabs.create({ url: cinemaLink });
                    window.close();
                } catch (err) {
                    alert(err.message || 'Failed to start SaveZonix.');
                    cinemaBtn.textContent = originalText;
                    cinemaBtn.disabled = false;
                }
            });
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
            dlBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right: 6px; vertical-align: middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>Download ${siteName === 'Instagram' ? 'Reel' : 'Video'}</span>`;
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
            const cleanTier = selectedText.replace('⭐  Best Quality — ', '').split(' • ')[0];
            if (!dlBtn.disabled) {
                dlBtn.innerHTML = `<span>Download ${cleanTier}</span>`;
            }
        });

        // Use the captured media URL.  Sending the Instagram webpage URL to
        // localhost loses the signed CDN URL (and the user's logged-in browser
        // session), so the desktop analyser can only see Instagram's login
        // page.  The extension downloader retains the freshly captured URL.
        // Unified Localhost Downloader: Always redirect to http://localhost:5000 for ALL sites
        dlBtn.addEventListener('click', async () => {
            if (dlBtn.disabled) return;

            const targetUrl = qualSelect.value || video.url;

            // 1. YouTube & YouTube Mix
            if (isYT || video.isYouTube || (targetUrl && (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be') || targetUrl.includes('googlevideo.com')))) {
                if (ytDetails && ytDetails.hasPlaylist && ytDetails.videoId) {
                    if (ytChoiceModal) ytChoiceModal.classList.remove('hidden');
                    return;
                }
                if (ytDetails && ytDetails.isPlaylistPage) {
                    handlePlaylistDownload(currentTabUrl);
                    return;
                }
                const singleUrl = (ytDetails && ytDetails.singleVideoUrl) || currentTabUrl;
                const chosenQuality = getSelectedQuality();

                const dlSpan = dlBtn.querySelector('span') || dlBtn;
                const originalText = dlSpan.textContent;
                dlBtn.disabled = true;

                try {
                    const readyBase = await ensureDesktopBackendRunning((msg) => {
                        dlSpan.textContent = msg;
                    });
                    dlSpan.textContent = 'Download started.';
                    chrome.tabs.create({
                        url: `${readyBase}/?url=${encodeURIComponent(singleUrl)}&quality=${encodeURIComponent(chosenQuality)}&autoDownload=1`
                    });
                    window.close();
                } catch (err) {
                    alert(err.message || 'Failed to start SaveZonix.');
                    dlSpan.textContent = originalText;
                    dlBtn.disabled = false;
                }
                return;
            }

            // 2. All Other Sites (pron.click, PixelFlix, Instagram, Web Streams):
            // ALWAYS redirect to SaveZonix Localhost
            const epTag = (function(textOrUrl) {
                if (!textOrUrl) return '';
                const m = textOrUrl.match(/(?:[?&]|\b)(?:season|s)=(\d+)[^&]*&(?:episode|ep|e)=(\d+)/i) 
                       || textOrUrl.match(/(?:\b|[/-])(?:season|s)[_-]?(\d+)[/-](?:episode|e|ep)[_-]?(\d+)\b/i)
                       || textOrUrl.match(/\b[sS](\d+)[eE](\d+)\b/i);
                if (m) return `S${String(m[1]).padStart(2, '0')}E${String(m[2]).padStart(2, '0')}`;
                const single = textOrUrl.match(/[?&](?:episode|ep|e)=(\d+)/i) || textOrUrl.match(/(?:\b|[/-])(?:episode|ep)[_-]?(\d+)\b/i);
                if (single) return `E${String(single[1]).padStart(2, '0')}`;
                return '';
            })(currentTabUrl || video.url || '');

            let effectiveTitle = video.title || video.showName || currentTabTitle || 'Video';
            if (epTag && !effectiveTitle.toLowerCase().includes(epTag.toLowerCase())) {
                effectiveTitle = `${effectiveTitle} - ${epTag}`;
            }

            const finalDownloadUrl = (targetUrl && targetUrl.startsWith('http')) ? targetUrl : currentTabUrl;
            const dlSpan = dlBtn.querySelector('span') || dlBtn;
            const originalText = dlSpan.textContent;
            dlBtn.disabled = true;

            try {
                const readyBase = await ensureDesktopBackendRunning((msg) => {
                    dlSpan.textContent = msg;
                });
                dlSpan.textContent = 'Download started.';

                if (finalDownloadUrl && finalDownloadUrl.startsWith('http')) {
                    chrome.tabs.create({
                        url: `${readyBase}/?url=${encodeURIComponent(finalDownloadUrl)}&title=${encodeURIComponent(effectiveTitle)}&originalUrl=${encodeURIComponent(currentTabUrl)}&autoDownload=1`
                    });
                    window.close();
                    return;
                }

                if (currentTabUrl && currentTabUrl.startsWith('http') && !currentTabUrl.startsWith('chrome')) {
                    chrome.tabs.create({ url: `${readyBase}/?url=${encodeURIComponent(currentTabUrl)}&title=${encodeURIComponent(effectiveTitle)}&autoDownload=1` });
                    window.close();
                }
            } catch (err) {
                alert(err.message || 'Failed to start SaveZonix.');
                dlSpan.textContent = originalText;
                dlBtn.disabled = false;
            }
        });
    }

    // Render Download History
    // Render Download History
    function renderCompletedList(items) {
        completedList.innerHTML = '';

        const validItems = (items || []).filter(item => {
            if (!item) return false;
            const fn = (item.filename || '').toLowerCase();
            const t = (item.title || '').toLowerCase();
            if (fn === 'video.mp4' && (!t || t === 'video.mp4' || t === 'video')) return false;
            if (t === 'video.mp4' && (!fn || fn === 'video.mp4' || fn === 'video')) return false;
            return true;
        });

        if (validItems.length === 0) {
            completedSection.classList.add('hidden');
            return;
        }

        completedSection.classList.remove('hidden');

        const btnClearAllHistory = document.getElementById('btnClearAllHistory');
        if (btnClearAllHistory && !btnClearAllHistory.dataset.bound) {
            btnClearAllHistory.dataset.bound = 'true';
            btnClearAllHistory.addEventListener('click', async (e) => {
                e.stopPropagation();
                // Instant tactile UI feedback
                completedList.innerHTML = '';
                completedSection.classList.add('hidden');

                try {
                    await window.Storage.clearAllCompletedDownloads();
                } catch { }

                try {
                    await fetch(`${backendBaseUrl}/api/extension/clear-history`, { method: 'POST' });
                } catch { }
            });
        }

        const hasActive = videoList && videoList.children.length > 0;
        validItems.slice(0, hasActive ? 2 : 4).forEach(item => {
            const rawTitle = (item.title && item.title.toLowerCase() !== 'video.mp4' && item.title.toLowerCase() !== 'video')
                ? item.title
                : ((item.filename && item.filename.toLowerCase() !== 'video.mp4') ? item.filename.replace(/\.[^/.]+$/, "") : 'Media Download');

            const thumbUrl = item.thumbnail || item.thumbnailUrl || '';
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-item-left">
                    <div class="history-thumb-wrap">
                        ${thumbUrl ? `<img class="history-thumb-img" src="${thumbUrl}" alt="Cover" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">` : ''}
                        <div class="history-icon-badge" style="${thumbUrl ? 'display:none;' : ''}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        </div>
                    </div>
                    <div class="history-title-col">
                        <span class="history-filename" title="${rawTitle}">${rawTitle}</span>
                        <div class="history-meta-row">
                            <span class="hist-pill hist-quality">${item.quality || '1080p'}</span>
                            <span class="hist-pill hist-size">${item.size || 'Saved'}</span>
                            <span class="hist-site">${item.site || 'YouTube'}</span>
                        </div>
                    </div>
                </div>
                <div class="history-actions">
                    ${item.downloadId ? `
                        <button class="history-btn btn-open-folder" data-dlid="${item.downloadId}" title="Show in folder">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        </button>
                    ` : ''}
                    <button class="history-btn btn-remove-hist" data-id="${item.id || item.filename}" title="Remove from history">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            `;

            const openBtn = div.querySelector('.btn-open-folder');
            if (openBtn) {
                openBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const dlId = parseInt(openBtn.dataset.dlid, 10);
                    if (dlId) chrome.downloads.show(dlId);
                });
            }

            const removeBtn = div.querySelector('.btn-remove-hist');
            if (removeBtn) {
                removeBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const targetId = item.id || item.filename || item.title;
                    div.classList.add('row-exit');
                    setTimeout(() => {
                        div.remove();
                        if (completedList.children.length === 0) {
                            completedSection.classList.add('hidden');
                        }
                    }, 220);

                    try {
                        await window.Storage.removeCompletedDownload(targetId);
                    } catch { }

                    try {
                        await fetch(`${backendBaseUrl}/api/extension/history/${encodeURIComponent(targetId)}`, { method: 'DELETE' });
                    } catch { }
                });
            }

            completedList.appendChild(div);
        });
    }
});
