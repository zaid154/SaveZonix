/**
 * SaveZonix YouTube Playlist Studio - Client-Side Controller
 * High-Speed Multi-Threaded Batch Downloader Engine
 */

(function () {
    'use strict';

    // State
    let currentPlaylist = null;
    let activeJobId = null;
    let pollInterval = null;
    let loadedVideos = [];
    const selectedVideoIds = new Set();
    const removedVideoIds = new Set();
    let currentPage = 1;
    let pageSize = 25;
    let activeSortOrder = 'original';
    let currentJobState = null;
    let pendingLeaveCallback = null;
    let pendingHybridUrl = null;
    let jobStartTime = null;
    let activeQueueKey = null;
    const STORAGE_KEY_ACTIVE_JOB = 'sz_active_playlist_job';
    const STORAGE_KEY_RECENT_URLS = 'sz_recent_playlist_urls';

    // DOM Elements
    const playlistUrlInput = document.getElementById('playlistUrlInput');
    const btnPasteUrl = document.getElementById('btnPasteUrl');
    const btnClearUrl = document.getElementById('btnClearUrl');
    const btnLoadPlaylist = document.getElementById('btnLoadPlaylist');
    const studioAlertBox = document.getElementById('studioAlertBox');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');

    // URL Choice Modal Elements
    const urlChoiceModal = document.getElementById('urlChoiceModal');
    const btnCloseUrlChoice = document.getElementById('btnCloseUrlChoice');
    const btnChoiceSingleVideo = document.getElementById('btnChoiceSingleVideo');
    const btnChoiceFullPlaylist = document.getElementById('btnChoiceFullPlaylist');
    const urlChoiceDescription = document.getElementById('urlChoiceDescription');

    const playlistWelcomeState = document.getElementById('playlistWelcomeState');
    const playlistLoadingBox = document.getElementById('playlistLoadingBox');
    const playlistLoadingText = document.getElementById('playlistLoadingText');

    const playlistInfoSection = document.getElementById('playlistInfoSection');
    const bannerThumb = document.getElementById('bannerThumb');
    const bannerTitle = document.getElementById('bannerTitle');
    const bannerAuthor = document.getElementById('bannerAuthor');
    const bannerCountBadge = document.getElementById('bannerCountBadge');
    const bannerDuration = document.getElementById('bannerDuration');
    const bannerDesc = document.getElementById('bannerDesc');

    const playlistControlsSection = document.getElementById('playlistControlsSection');
    const chkMasterSelect = document.getElementById('chkMasterSelect');
    const chkHeaderSelect = document.getElementById('chkHeaderSelect');
    const btnSelectNone = document.getElementById('btnSelectNone');
    const btnInvertSelect = document.getElementById('btnInvertSelect');
    const btnRemoveSelected = document.getElementById('btnRemoveSelected');
    const btnRestoreAll = document.getElementById('btnRestoreAll');
    const selectionCountBadge = document.getElementById('selectionCountBadge');

    const videoSearchInput = document.getElementById('videoSearchInput');
    const btnClearSearch = document.getElementById('btnClearSearch');
    const statusFilterSelect = document.getElementById('statusFilterSelect');
    const sortOrderSelect = document.getElementById('sortOrderSelect');

    const qualitySelect = document.getElementById('qualitySelect');
    const formatSelect = document.getElementById('formatSelect');
    const concurrencySelect = document.getElementById('concurrencySelect');
    const chkNumberPrefix = document.getElementById('chkNumberPrefix');
    const btnDownloadSelected = document.getElementById('btnDownloadSelected');
    const txtDownloadSelected = document.getElementById('txtDownloadSelected');
    const btnDownloadAll = document.getElementById('btnDownloadAll');

    const videoListSection = document.getElementById('videoListSection');
    const videoTableBody = document.getElementById('videoTableBody');
    const emptySearchState = document.getElementById('emptySearchState');

    // Pagination Elements
    const playlistPagination = document.getElementById('playlistPagination');
    const paginationRangeText = document.getElementById('paginationRangeText');
    const paginationTotalText = document.getElementById('paginationTotalText');
    const btnPagePrev = document.getElementById('btnPagePrev');
    const btnPageNext = document.getElementById('btnPageNext');
    const pageIndicatorText = document.getElementById('pageIndicatorText');
    const pageSizeSelect = document.getElementById('pageSizeSelect');

    // Queue Dock Elements (Optional now that dock is removed)
    const downloadQueuePanel = document.getElementById('downloadQueuePanel');
    const queueItemCountBadge = document.getElementById('queueItemCountBadge');
    const overallCompletedText = document.getElementById('overallCompletedText');
    const overallSpeedText = document.getElementById('overallSpeedText');
    const overallPercentText = document.getElementById('overallPercentText');
    const overallProgressBar = document.getElementById('overallProgressBar');
    const queueItemsList = document.getElementById('queueItemsList');
    const btnRetryAllFailed = document.getElementById('btnRetryAllFailed');
    const btnOpenFolder = document.getElementById('btnOpenFolder');
    const btnOpenGlobalFolder = document.getElementById('btnOpenGlobalFolder');
    const btnCancelBatch = document.getElementById('btnCancelBatch');
    const btnToggleQueueMinimize = document.getElementById('btnToggleQueueMinimize');
    const queueRunningNotice = document.getElementById('queueRunningNotice');
    const leaveConfirmModal = document.getElementById('leaveConfirmModal');
    const btnCloseConfirmModal = document.getElementById('btnCloseConfirmModal');
    const btnConfirmStay = document.getElementById('btnConfirmStay');
    const btnConfirmLeave = document.getElementById('btnConfirmLeave');

    // Floating Queued Toast Elements
    const playlistQueuedToast = document.getElementById('playlistQueuedToast');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    const btnDismissToast = document.getElementById('btnDismissToast');

    // Stepper & Shortcuts Elements
    const studioStepper = document.getElementById('studioStepper');
    const btnToggleShortcuts = document.getElementById('btnToggleShortcuts');
    const shortcutsPopup = document.getElementById('shortcutsPopup');

    // Welcome State Elements
    const btnWelcomePaste = document.getElementById('btnWelcomePaste');
    const recentUrlsSection = document.getElementById('recentUrlsSection');
    const recentUrlsList = document.getElementById('recentUrlsList');

    // Completion Summary Card Elements
    const completionSummaryCard = document.getElementById('completionSummaryCard');
    const completionSubtitle = document.getElementById('completionSubtitle');
    const completionStatVideos = document.getElementById('completionStatVideos');
    const completionStatSize = document.getElementById('completionStatSize');
    const completionStatTime = document.getElementById('completionStatTime');
    const completionStatSpeed = document.getElementById('completionStatSpeed');
    const btnCompletionOpenFolder = document.getElementById('btnCompletionOpenFolder');

    // Progressive Loading & Terminal Logger Elements
    let currentPlaylistUrl = '';
    let logStartTime = 0;
    const playlistTerminalLogs = document.getElementById('playlistTerminalLogs');
    const progressiveLoadSection = document.getElementById('progressiveLoadSection');
    const progressiveTitleText = document.getElementById('progressiveTitleText');
    const progressiveSubText = document.getElementById('progressiveSubText');
    const btnLoadNextBatch = document.getElementById('btnLoadNextBatch') || document.getElementById('btn-load-next');
    const btnLoadAllVideos = document.getElementById('btnLoadAllVideos') || document.getElementById('btn-load-all');
    const progressiveLoadingBar = document.getElementById('progressiveLoadingBar');
    const progressiveLoadingMsg = document.getElementById('progressiveLoadingMsg');

    function resetTerminalLogs() {
        setLoaderStatus('Connecting to YouTube...', 'Retrieving playlist metadata and available quality streams...');
    }

    function setLoaderStatus(statusText, subText = null) {
        const statusEl = document.getElementById('proLoaderStatusText');
        if (statusEl && statusText) statusEl.textContent = statusText;
        if (subText) {
            const subEl = document.getElementById('playlistLoadingText');
            if (subEl) subEl.textContent = subText;
        }
    }

    function addTerminalLog(icon, msg, isHighlight = false) {
        setLoaderStatus(msg);
    }

    function isDownloadActive() {
        if (!activeJobId) return false;
        if (!currentJobState) return true;
        const status = currentJobState.status;
        const isFinished = status === 'Completed' || status === 'Cancelled' || status === 'Failed';
        if (isFinished && (currentJobState.activeCount || 0) === 0 && (currentJobState.queuedCount || 0) === 0) {
            return false;
        }
        return true;
    }

    function saveActiveJobSession(jobId, playlistUrl, playlistTitle) {
        try {
            localStorage.setItem(STORAGE_KEY_ACTIVE_JOB, JSON.stringify({
                jobId: jobId,
                playlistUrl: playlistUrl,
                playlistTitle: playlistTitle,
                savedAt: Date.now()
            }));
        } catch { }
    }

    function clearActiveJobSession() {
        try {
            localStorage.removeItem(STORAGE_KEY_ACTIVE_JOB);
        } catch { }
    }

    function pushDownloadProtectionHistory() {
        try {
            if (!history.state || history.state.zonixBatchActive !== true) {
                history.pushState({ zonixBatchActive: true }, '', window.location.href);
            }
        } catch { }
    }

    function showLeaveConfirmModal(onConfirmLeave) {
        pendingLeaveCallback = onConfirmLeave;
        if (leaveConfirmModal) {
            leaveConfirmModal.style.display = 'flex';
        }
    }

    function hideLeaveConfirmModal() {
        pendingLeaveCallback = null;
        if (leaveConfirmModal) {
            leaveConfirmModal.style.display = 'none';
        }
    }

    function updateStepper(stepNumber) {
        if (!studioStepper) return;
        const steps = studioStepper.querySelectorAll('.stepper-step');
        steps.forEach((stepEl) => {
            const step = parseInt(stepEl.dataset.step, 10);
            const numEl = stepEl.querySelector('.stepper-number');
            const connector = stepEl.querySelector('.stepper-connector');

            stepEl.classList.remove('step-active', 'step-completed');
            if (step < stepNumber) {
                stepEl.classList.add('step-completed');
                if (numEl) numEl.textContent = '✓';
            } else if (step === stepNumber) {
                stepEl.classList.add('step-active');
                if (numEl) numEl.textContent = `${step}`;
            } else {
                if (numEl) numEl.textContent = `${step}`;
            }

            if (connector) {
                if (step < stepNumber) {
                    connector.classList.add('connector-filled');
                } else {
                    connector.classList.remove('connector-filled');
                }
            }
        });
    }

    function playCompletionSound() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        } catch { }
    }

    function showBrowserNotification(title, body) {
        try {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, {
                    body: body,
                    icon: '/icons/icon48.png'
                });
            }
        } catch { }
    }

    function saveRecentUrl(url, title) {
        if (!url) return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY_RECENT_URLS);
            let list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) list = [];
            list = list.filter(item => item.url !== url);
            list.unshift({ url, title: title || 'YouTube Playlist', date: Date.now() });
            if (list.length > 4) list = list.slice(0, 4);
            localStorage.setItem(STORAGE_KEY_RECENT_URLS, JSON.stringify(list));
            renderRecentUrls();
        } catch { }
    }

    function renderRecentUrls() {
        if (!recentUrlsSection || !recentUrlsList) return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY_RECENT_URLS);
            const list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list) || list.length === 0) {
                recentUrlsSection.style.display = 'none';
                return;
            }
            recentUrlsList.innerHTML = '';
            list.forEach(item => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'recent-url-chip';
                btn.title = item.url;
                btn.innerHTML = `<span>▶</span> <span>${escapeHtml(item.title || item.url)}</span>`;
                btn.addEventListener('click', () => {
                    playlistUrlInput.value = item.url;
                    btnClearUrl.style.display = 'inline-flex';
                    loadPlaylist();
                });
                recentUrlsList.appendChild(btn);
            });
            recentUrlsSection.style.display = 'block';
        } catch {
            recentUrlsSection.style.display = 'none';
        }
    }

    function showCompletionSummary(job) {
        if (!completionSummaryCard) return;
        const elapsedSeconds = Math.max(1, Math.round((Date.now() - (jobStartTime || Date.now())) / 1000));
        const mins = Math.floor(elapsedSeconds / 60);
        const secs = elapsedSeconds % 60;
        const timeStr = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;

        let totalBytes = 0;
        (job.items || []).forEach(item => {
            totalBytes += (item.bytesDownloaded || 0);
        });
        const sizeStr = totalBytes > 0
            ? (totalBytes > 1024 * 1024 * 1024 ? `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`)
            : 'Done';

        if (completionStatVideos) completionStatVideos.textContent = `${job.completedCount}/${job.totalVideos}`;
        if (completionSubtitle) completionSubtitle.textContent = `${job.completedCount}/${job.totalVideos} Videos Downloaded Successfully`;
        if (completionStatSize) completionStatSize.textContent = sizeStr;
        if (completionStatTime) completionStatTime.textContent = timeStr;
        if (completionStatSpeed) completionStatSpeed.textContent = `${job.overallSpeedMBps || 0} MB/s`;

        completionSummaryCard.style.display = 'block';
    }

    // Init
    initEvents();

    function isHybridUrl(url) {
        if (!url) return false;
        const clean = url.trim();
        const hasList = /[?&]list=([a-zA-Z0-9_-]+)/i.test(clean);
        const hasVideo = /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/i.test(clean) ||
                         /youtu\.be\/([a-zA-Z0-9_-]+)/i.test(clean);
        return hasList && hasVideo;
    }

    function extractSingleVideoUrl(url) {
        if (!url) return url;
        try {
            const u = new URL(url.trim());
            if (u.searchParams.has('v')) {
                return 'https://www.youtube.com/watch?v=' + u.searchParams.get('v');
            }
            if (u.hostname.includes('youtu.be')) {
                const videoId = u.pathname.replace(/^\//, '');
                return 'https://www.youtube.com/watch?v=' + videoId;
            }
        } catch {
            const vMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/i);
            if (vMatch) return 'https://www.youtube.com/watch?v=' + vMatch[1];
        }
        return url;
    }

    function isSingleVideoUrl(url) {
        if (!url) return false;
        const clean = url.trim();
        if (/[?&]list=([a-zA-Z0-9_-]+)/i.test(clean) || /youtube\.com\/playlist/i.test(clean)) {
            return false;
        }
        return /youtube\.com\/watch\?v=/i.test(clean) ||
               /youtu\.be\//i.test(clean) ||
               /youtube\.com\/shorts\//i.test(clean) ||
               /instagram\.com/i.test(clean) ||
               /tiktok\.com/i.test(clean) ||
               /facebook\.com/i.test(clean) ||
               /vimeo\.com/i.test(clean) ||
               /\.(m3u8|mp4|webm)($|\?)/i.test(clean);
    }

    function showUrlChoiceModal(url) {
        pendingHybridUrl = url;
        if (urlChoiceModal) {
            urlChoiceModal.style.display = 'flex';
        }
    }

    function hideUrlChoiceModal() {
        pendingHybridUrl = null;
        if (urlChoiceModal) {
            urlChoiceModal.style.display = 'none';
        }
    }

    function initEvents() {
        // Input events
        const btnChangePlaylistUrl = document.getElementById('btnChangePlaylistUrl');
        if (btnChangePlaylistUrl) {
            btnChangePlaylistUrl.addEventListener('click', () => {
                const studioContainer = document.querySelector('.playlist-studio-container');
                if (studioContainer) {
                    const isVisible = studioContainer.classList.toggle('show-url-input');
                    if (isVisible) {
                        playlistUrlInput.focus();
                        playlistUrlInput.select();
                    }
                }
            });
        }

        btnClearUrl.addEventListener('click', () => {
            playlistUrlInput.value = '';
            btnClearUrl.style.display = 'none';
            playlistUrlInput.focus();
        });

        playlistUrlInput.addEventListener('input', () => {
            btnClearUrl.style.display = playlistUrlInput.value.trim() ? 'inline-flex' : 'none';
        });

        playlistUrlInput.addEventListener('paste', () => {
            setTimeout(() => {
                const text = playlistUrlInput.value.trim();
                if (isHybridUrl(text)) {
                    showUrlChoiceModal(text);
                } else if (isSingleVideoUrl(text)) {
                    showAlert('🎬 Single Video Detected', 'Opening Single Video Downloader for this video...');
                    setTimeout(() => {
                        window.location.href = '/?url=' + encodeURIComponent(text);
                    }, 400);
                }
            }, 50);
        });

        playlistUrlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                loadPlaylist();
            }
        });

        btnPasteUrl.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    const clean = text.trim();
                    playlistUrlInput.value = clean;
                    btnClearUrl.style.display = 'inline-flex';
                    if (isHybridUrl(clean)) {
                        showUrlChoiceModal(clean);
                    } else if (isSingleVideoUrl(clean)) {
                        showAlert('🎬 Single Video Detected', 'Opening Single Video Downloader for this video...');
                        setTimeout(() => {
                            window.location.href = '/?url=' + encodeURIComponent(clean);
                        }, 400);
                    } else {
                        loadPlaylist();
                    }
                }
            } catch {
                playlistUrlInput.focus();
            }
        });

        // URL Choice Modal events
        if (btnChoiceSingleVideo) {
            btnChoiceSingleVideo.addEventListener('click', () => {
                const targetUrl = pendingHybridUrl || playlistUrlInput.value.trim();
                hideUrlChoiceModal();
                const cleanSingleUrl = extractSingleVideoUrl(targetUrl);
                showAlert('🎬 Single Video Selected', 'Opening Single Video Downloader for this video...');
                setTimeout(() => {
                    window.location.href = '/?url=' + encodeURIComponent(cleanSingleUrl);
                }, 350);
            });
        }

        if (btnChoiceFullPlaylist) {
            btnChoiceFullPlaylist.addEventListener('click', () => {
                const targetUrl = pendingHybridUrl || playlistUrlInput.value.trim();
                hideUrlChoiceModal();
                loadPlaylist(targetUrl, true);
            });
        }

        if (btnCloseUrlChoice) {
            btnCloseUrlChoice.addEventListener('click', hideUrlChoiceModal);
        }

        if (urlChoiceModal) {
            urlChoiceModal.addEventListener('click', (e) => {
                if (e.target === urlChoiceModal) {
                    hideUrlChoiceModal();
                }
            });
        }

        btnClearUrl.addEventListener('click', () => {
            playlistUrlInput.value = '';
            btnClearUrl.style.display = 'none';
            playlistUrlInput.focus();
        });

        btnLoadPlaylist.addEventListener('click', loadPlaylist);

        // Selection & Removal events
        chkMasterSelect.addEventListener('change', (e) => toggleSelectAll(e.target.checked));
        chkHeaderSelect.addEventListener('change', (e) => toggleSelectAll(e.target.checked));
        if (btnSelectNone) btnSelectNone.addEventListener('click', () => toggleSelectAll(false));
        if (btnInvertSelect) btnInvertSelect.addEventListener('click', invertSelection);
        if (btnRemoveSelected) btnRemoveSelected.addEventListener('click', removeSelectedVideos);
        if (btnRestoreAll) btnRestoreAll.addEventListener('click', restoreAllRemovedVideos);

        // Search & Filter
        videoSearchInput.addEventListener('input', filterVideos);
        btnClearSearch.addEventListener('click', () => {
            videoSearchInput.value = '';
            btnClearSearch.style.display = 'none';
            filterVideos();
        });
        statusFilterSelect.addEventListener('change', filterVideos);
        if (sortOrderSelect) sortOrderSelect.addEventListener('change', filterVideos);

        // Pagination events
        if (btnPagePrev) {
            btnPagePrev.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderVideosTable();
                }
            });
        }
        if (btnPageNext) {
            btnPageNext.addEventListener('click', () => {
                const totalPages = getTotalPages();
                if (currentPage < totalPages) {
                    currentPage++;
                    renderVideosTable();
                }
            });
        }
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', () => {
                const val = pageSizeSelect.value;
                pageSize = val === 'all' ? 'all' : parseInt(val, 10);
                currentPage = 1;
                renderVideosTable();
            });
        }

        // Progressive Load More Events
        if (btnLoadNextBatch) {
            btnLoadNextBatch.addEventListener('click', () => loadMoreVideos(25, false));
        }
        if (btnLoadAllVideos) {
            btnLoadAllVideos.addEventListener('click', () => loadMoreVideos(0, true));
        }

        // Smart Quality & Format Synchronization
        let lastSelectedVideoQuality = 'Best';
        function syncQualityAndFormat(source) {
            const currentFmt = formatSelect ? formatSelect.value : 'MP4';
            const currentQ = qualitySelect ? qualitySelect.value : 'Best';
            const isAudioFmt = currentFmt === 'MP3' || currentFmt === 'M4A';
            const isAudioQuality = currentQ === 'AudioOnly';

            if (source === 'format') {
                if (isAudioFmt) {
                    if (!isAudioQuality) {
                        lastSelectedVideoQuality = currentQ;
                    }
                    if (qualitySelect) qualitySelect.value = 'AudioOnly';
                } else {
                    if (isAudioQuality) {
                        if (qualitySelect) {
                            qualitySelect.value = (lastSelectedVideoQuality && lastSelectedVideoQuality !== 'AudioOnly') 
                                ? lastSelectedVideoQuality 
                                : 'Best';
                        }
                    }
                }
            } else if (source === 'quality') {
                if (isAudioQuality) {
                    if (!isAudioFmt) {
                        if (formatSelect) formatSelect.value = 'MP3';
                    }
                } else {
                    lastSelectedVideoQuality = currentQ;
                    if (isAudioFmt) {
                        if (formatSelect) formatSelect.value = 'MP4';
                    }
                }
            }

            updateSelectionMetrics();
        }

        if (formatSelect) {
            formatSelect.addEventListener('change', () => syncQualityAndFormat('format'));
        }
        if (qualitySelect) {
            qualitySelect.addEventListener('change', () => syncQualityAndFormat('quality'));
        }

        // Download actions
        btnDownloadSelected.addEventListener('click', downloadSelectedVideos);
        btnDownloadAll.addEventListener('click', downloadAllVideos);

        // Queue dock actions (safe if elements are absent)
        if (btnOpenFolder) btnOpenFolder.addEventListener('click', openDownloadsFolder);
        if (btnOpenGlobalFolder) btnOpenGlobalFolder.addEventListener('click', openDownloadsFolder);
        if (btnCancelBatch) btnCancelBatch.addEventListener('click', cancelCurrentBatch);
        if (btnRetryAllFailed) btnRetryAllFailed.addEventListener('click', retryAllFailedVideos);
        if (btnToggleQueueMinimize && downloadQueuePanel) {
            btnToggleQueueMinimize.addEventListener('click', () => {
                downloadQueuePanel.classList.toggle('queue-dock-minimized');
            });
        }

        // Toast dismiss action
        if (btnDismissToast && playlistQueuedToast) {
            btnDismissToast.addEventListener('click', () => {
                playlistQueuedToast.style.display = 'none';
            });
        }

        // Close row overflow dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.row-overflow-wrapper')) {
                document.querySelectorAll('.row-overflow-menu.show').forEach(m => m.classList.remove('show'));
            }
        });

        // Confirm Modal actions
        if (btnCloseConfirmModal) btnCloseConfirmModal.addEventListener('click', hideLeaveConfirmModal);
        if (btnConfirmStay) btnConfirmStay.addEventListener('click', hideLeaveConfirmModal);
        
        const btnGoToDownloads = document.getElementById('btnGoToDownloads');
        if (btnGoToDownloads) {
            btnGoToDownloads.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.href = '/Account/Downloads';
            });
        }

        if (btnConfirmLeave) {
            btnConfirmLeave.addEventListener('click', () => {
                const cb = pendingLeaveCallback;
                hideLeaveConfirmModal();
                // Do NOT cancel the download: it runs safely in the background on the server!
                if (cb && typeof cb === 'function') {
                    cb();
                }
            });
        }

        // Browser Back Button Interception
        window.addEventListener('popstate', () => {
            if (isDownloadActive()) {
                // Keep current page in history so user doesn't accidentally leave
                history.pushState({ zonixBatchActive: true }, '', window.location.href);
                showLeaveConfirmModal(() => {
                    history.go(-2);
                });
            }
        });

        // Note: Downloads run safely in the background on the server (PlaylistQueueManager)
        // and survive reloads and page navigation, so no intrusive beforeunload warning is needed.

        // Intercept clicks on links leaving the studio
        document.addEventListener('click', (e) => {
            const anchor = e.target.closest('a[href]');
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

            // Allow direct navigation to Downloads page without re-triggering the leave confirm modal
            if (href.includes('/Account/Downloads')) {
                return;
            }

            if (isDownloadActive()) {
                e.preventDefault();
                showLeaveConfirmModal(() => {
                    window.location.href = href;
                });
            }
        });

        // Welcome State Paste Button
        if (btnWelcomePaste) {
            btnWelcomePaste.addEventListener('click', async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    if (text) {
                        const clean = text.trim();
                        playlistUrlInput.value = clean;
                        btnClearUrl.style.display = 'inline-flex';
                        if (isHybridUrl(clean)) {
                            showUrlChoiceModal(clean);
                        } else if (isSingleVideoUrl(clean)) {
                            showAlert('🎬 Single Video Detected', 'Opening Single Video Downloader for this video...');
                            setTimeout(() => {
                                window.location.href = '/?url=' + encodeURIComponent(clean);
                            }, 400);
                        } else {
                            loadPlaylist();
                        }
                    }
                } catch {
                    playlistUrlInput.focus();
                }
            });
        }

        // Shortcuts Popup Toggle
        if (btnToggleShortcuts && shortcutsPopup) {
            btnToggleShortcuts.addEventListener('click', (e) => {
                e.stopPropagation();
                shortcutsPopup.classList.toggle('show');
            });
        }

        // Completion Card Action
        if (btnCompletionOpenFolder) {
            btnCompletionOpenFolder.addEventListener('click', openDownloadsFolder);
        }

        // Global Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            const activeEl = document.activeElement;
            const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

            if (e.key === 'Escape') {
                hideLeaveConfirmModal();
                hideUrlChoiceModal();
                if (shortcutsPopup) shortcutsPopup.classList.remove('show');
                document.querySelectorAll('.row-overflow-menu.show').forEach(m => m.classList.remove('show'));
                return;
            }

            if (isInputFocused) return;

            const isCtrl = e.ctrlKey || e.metaKey;
            if (isCtrl && e.key.toLowerCase() === 'a') {
                if (loadedVideos && loadedVideos.length > 0) {
                    e.preventDefault();
                    toggleSelectAll(!e.shiftKey);
                }
            } else if (isCtrl && e.key === 'Enter') {
                if (loadedVideos && loadedVideos.length > 0 && selectedVideoIds.size > 0) {
                    e.preventDefault();
                    downloadSelectedVideos();
                }
            }
        });

        // Close dropdowns and popups on outside click
        document.addEventListener('click', (e) => {
            if (shortcutsPopup && !e.target.closest('#btnToggleShortcuts') && !e.target.closest('#shortcutsPopup')) {
                shortcutsPopup.classList.remove('show');
            }
        });

        // Initial setup for UX enhancements
        updateStepper(1);
        renderRecentUrls();

        // Restore active job from previous session or page reload
        checkAndRestoreActiveJob();

        // Auto load if ?url= or ?queueKey= is passed in query string
        const urlParams = new URLSearchParams(window.location.search);
        const autoQueueKey = urlParams.get('queueKey');
        const autoUrl = urlParams.get('url');

        if (autoQueueKey) {
            activeQueueKey = autoQueueKey;
        }
        if (autoUrl) {
            playlistUrlInput.value = autoUrl;
            btnClearUrl.style.display = 'inline-flex';
            setTimeout(() => loadPlaylist(autoUrl, true), 150);
        } else if (autoQueueKey) {
            setTimeout(() => loadPlaylist('', true), 150);
        }
    }

    async function checkAndRestoreActiveJob() {
        try {
            let jobId = null;
            let saved = null;
            const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_JOB);
            if (raw) {
                try {
                    saved = JSON.parse(raw);
                    if (saved && saved.jobId) jobId = saved.jobId;
                } catch { }
            }

            // If not in localStorage, check server active jobs directly
            if (!jobId) {
                try {
                    const activeResp = await fetch('/api/playlist/active-jobs');
                    if (activeResp.ok) {
                        const activeList = await activeResp.json();
                        if (Array.isArray(activeList) && activeList.length > 0) {
                            const first = activeList[0];
                            jobId = first.jobId;
                            saved = {
                                jobId: first.jobId,
                                playlistTitle: first.playlistTitle,
                                playlistUrl: first.playlistUrl
                            };
                            saveActiveJobSession(first.jobId, first.playlistUrl || '', first.playlistTitle || '');
                        }
                    }
                } catch { }
            }

            if (!jobId) return;

            const resp = await fetch(`/api/playlist/status/${jobId}`);
            if (!resp.ok) {
                clearActiveJobSession();
                return;
            }

            const job = await resp.json();
            const isAlive = job && (job.status === 'Running' || job.status === 'Downloading' || job.status === 'Queued' || (job.activeCount > 0) || (job.queuedCount > 0));
            if (isAlive) {
                activeJobId = jobId;
                currentJobState = job;

                if (saved && saved.playlistUrl && !playlistUrlInput.value) {
                    playlistUrlInput.value = saved.playlistUrl;
                    btnClearUrl.style.display = 'inline-flex';
                }

                updateStepper(3);
                pushDownloadProtectionHistory();

                if (playlistQueuedToast) {
                    if (toastTitle) toastTitle.textContent = 'Download in Progress';
                    if (toastMessage) toastMessage.textContent = `${(job.activeCount || 0) + (job.queuedCount || 0)} item(s) downloading in background.`;
                    playlistQueuedToast.style.display = 'flex';
                }

                startPolling(activeJobId);
            } else {
                clearActiveJobSession();
            }
        } catch {
            clearActiveJobSession();
        }
    }

    function showAlert(title, message) {
        alertTitle.textContent = title;
        alertMessage.textContent = message;
        studioAlertBox.style.display = 'flex';
    }

    function hideAlert() {
        studioAlertBox.style.display = 'none';
    }

    async function loadPlaylist(overrideUrl, bypassHybridCheck = false) {
        const url = (typeof overrideUrl === 'string' && overrideUrl ? overrideUrl : playlistUrlInput.value || '').trim();
        if (!url) {
            showAlert('Input Required', 'Please enter or paste a valid YouTube Playlist URL.');
            playlistUrlInput.focus();
            return;
        }

        currentPlaylistUrl = url;
        playlistUrlInput.value = url;
        btnClearUrl.style.display = 'inline-flex';

        if (!bypassHybridCheck && isHybridUrl(url)) {
            showUrlChoiceModal(url);
            return;
        }

        if (isSingleVideoUrl(url)) {
            showAlert('🎬 Single Video Detected', 'Redirecting to Single Video Downloader...');
            setTimeout(() => {
                window.location.href = '/?url=' + encodeURIComponent(url);
            }, 400);
            return;
        }

        hideAlert();
        setLoading(true);

        if (playlistWelcomeState) playlistWelcomeState.style.display = 'none';
        if (playlistLoadingBox) playlistLoadingBox.style.display = 'block';
        playlistInfoSection.style.display = 'none';
        playlistControlsSection.style.display = 'none';
        videoListSection.style.display = 'none';
        if (progressiveLoadSection) progressiveLoadSection.style.display = 'none';

        resetTerminalLogs();
        const isMixUrl = url.includes('list=RD') || url.includes('start_radio=1');
        if (isMixUrl) {
            setLoaderStatus('Loading YouTube Mix Queue...', 'Fetching first 25 mix tracks and streaming manifests...');
        } else {
            setLoaderStatus('Querying YouTube Playlist...', 'Fetching video metadata, audio streams, and available qualities...');
        }

        try {
            if (activeQueueKey) {
                setLoaderStatus('Synchronizing Active Tab Queue...', 'Importing exact tracklist from your browser tab...');
            }
            const resp = await fetch('/api/playlist/load', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url, queueKey: activeQueueKey, limit: isMixUrl ? 25 : 100 })
            });

            const data = await resp.json();
            if (!resp.ok || !data.success) {
                setLoaderStatus('Playlist Loading Failed', data.message || 'Unable to fetch YouTube playlist.');
                showAlert('Playlist Loading Failed', data.message || 'Unable to fetch YouTube playlist.');
                if (playlistWelcomeState) playlistWelcomeState.style.display = 'block';
                return;
            }

            setLoaderStatus('Ready! Opening Workspace...', 'Rendering table...');

            currentPlaylist = data;
            selectedVideoIds.clear();
            removedVideoIds.clear();

            // Store immutable original index for each video
            loadedVideos = (data.videos || []).map((v, i) => {
                const originalIndex = (v.index && v.index > 0) ? v.index : (i + 1);
                if (v.isAvailable) {
                    selectedVideoIds.add(v.videoId);
                }
                return {
                    ...v,
                    originalIndex: originalIndex,
                    index: originalIndex
                };
            });

            // Smart auto-detection: If YouTube playlist starts with "Last Episode" and ends with "Episode 1",
            // automatically default to Reverse order so Episode 1 is #01!
            if (loadedVideos.length > 1) {
                const firstTitle = (loadedVideos[0].title || '').toLowerCase();
                const lastTitle = (loadedVideos[loadedVideos.length - 1].title || '').toLowerCase();
                const isReverseSeries = (firstTitle.includes('last episode') || firstTitle.includes('final episode') || firstTitle.includes('2nd last')) &&
                                        (lastTitle.includes('episode 1') || lastTitle.includes('ep 1') || lastTitle.includes('episode 01'));
                if (isReverseSeries) {
                    activeSortOrder = 'reverse';
                    if (sortOrderSelect) sortOrderSelect.value = 'reverse';
                } else {
                    activeSortOrder = sortOrderSelect ? sortOrderSelect.value : 'original';
                }
            }

            currentPage = 1;
            renderPlaylistBanner(data);
            renderVideosTable();
            updateSelectionMetrics();
            updateProgressiveSection(data);

            playlistInfoSection.style.display = 'block';
            playlistControlsSection.style.display = 'block';
            videoListSection.style.display = 'block';

            // Auto-Compact Mode: collapse top bars so video table is immediately at the top
            const studioContainer = document.querySelector('.playlist-studio-container');
            if (studioContainer) {
                studioContainer.classList.add('studio-compact-mode');
                studioContainer.classList.remove('show-url-input');
            }

            updateStepper(2);
            saveRecentUrl(url, data.title || 'YouTube Playlist');

        } catch (err) {
            addTerminalLog('❌', err.message || 'Network communication error', true);
            showAlert('Network Error', err.message || 'An unexpected error occurred while loading playlist.');
            if (playlistWelcomeState) playlistWelcomeState.style.display = 'block';
        } finally {
            if (playlistLoadingBox) playlistLoadingBox.style.display = 'none';
            setLoading(false);
        }
    }

    function updateProgressiveSection(data) {
        if (!progressiveLoadSection) return;
        const isMix = data?.isMix || (currentPlaylistUrl && (currentPlaylistUrl.includes('list=RD') || currentPlaylistUrl.includes('start_radio=1')));
        const hasMore = data ? data.hasMore : (loadedVideos.length < 300);

        if (hasMore || (isMix && loadedVideos.length < 350)) {
            progressiveLoadSection.style.display = 'block';
            if (progressiveTitleText) {
                progressiveTitleText.textContent = isMix
                    ? `YouTube Mix Queue: Showing first ${loadedVideos.length} videos`
                    : `Playlist Preview: Showing ${loadedVideos.length} of ${data?.totalKnownVideos || 'more'} videos`;
            }
            if (progressiveSubText) {
                progressiveSubText.textContent = `Instant preview ready. You can start downloading now or load additional items below.`;
            }
            if (btnLoadNextBatch) {
                btnLoadNextBatch.style.display = 'inline-flex';
                btnLoadNextBatch.disabled = false;
                const span = btnLoadNextBatch.querySelector('span');
                if (span) span.textContent = `Load Next 25 Videos (From #${loadedVideos.length + 1})`;
            }
            if (btnLoadAllVideos) {
                btnLoadAllVideos.style.display = 'inline-flex';
                btnLoadAllVideos.disabled = false;
            }
        } else {
            // End-of-queue: show completion state instead of hiding
            progressiveLoadSection.style.display = 'block';
            if (progressiveTitleText) {
                progressiveTitleText.textContent = `✓ All ${loadedVideos.length} Videos Loaded`;
            }
            if (progressiveSubText) {
                progressiveSubText.textContent = `Complete playlist loaded successfully. Select videos and start downloading.`;
            }
            if (btnLoadNextBatch) btnLoadNextBatch.style.display = 'none';
            if (btnLoadAllVideos) btnLoadAllVideos.style.display = 'none';
        }
    }

    async function loadMoreVideos(batchSize = 25, loadAll = false) {
        if (!currentPlaylistUrl) return;

        // UI: Show loading spinner on button
        if (btnLoadNextBatch) {
            btnLoadNextBatch.disabled = true;
        }
        if (btnLoadAllVideos) {
            btnLoadAllVideos.disabled = true;
            const spanAll = btnLoadAllVideos.querySelector('span');
            if (spanAll) spanAll.textContent = 'Loading All...';
        }
        if (progressiveLoadingBar) {
            progressiveLoadingBar.style.display = 'flex';
        }

        try {
            if (loadAll) {
                let keepFetching = true;
                const maxCap = 400;

                while (keepFetching && loadedVideos.length < maxCap) {
                    const startIndex = loadedVideos.length + 1;
                    const lastVid = loadedVideos.length > 0 ? loadedVideos[loadedVideos.length - 1] : null;
                    const lastVideoId = lastVid ? lastVid.videoId : '';

                    if (progressiveLoadingMsg) {
                        progressiveLoadingMsg.textContent = `Fetching all videos... (${loadedVideos.length} loaded so far)`;
                    }

                    let data = null;
                    try {
                        let fetchUrl = `/api/playlist/fetch?url=${encodeURIComponent(currentPlaylistUrl)}&startIndex=${startIndex}&limit=25`;
                        if (lastVideoId) fetchUrl += `&lastVideoId=${encodeURIComponent(lastVideoId)}`;
                        const fetchResp = await fetch(fetchUrl);
                        if (fetchResp.ok) {
                            data = await fetchResp.json();
                        }
                    } catch { }

                    if (!data || !data.success) {
                        try {
                            const resp = await fetch('/api/playlist/load', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    url: currentPlaylistUrl,
                                    limit: 25,
                                    offset: loadedVideos.length,
                                    lastVideoId: lastVideoId
                                })
                            });
                            data = await resp.json();
                        } catch { }
                    }

                    if (!data || !data.success || !data.videos || data.videos.length === 0) {
                        keepFetching = false;
                        break;
                    }

                    const newVideos = data.videos || [];
                    const existingIds = new Set(loadedVideos.map(v => v.videoId));
                    const uniqueNewVideos = newVideos.filter(v => !existingIds.has(v.videoId));

                    if (uniqueNewVideos.length === 0) {
                        keepFetching = false;
                        break;
                    }

                    const startIdx = loadedVideos.length;
                    uniqueNewVideos.forEach((v, i) => {
                        const globalIdx = startIdx + i + 1;
                        v.originalIndex = globalIdx;
                        v.index = globalIdx;
                        if (v.isAvailable && !removedVideoIds.has(v.videoId)) {
                            selectedVideoIds.add(v.videoId);
                        }
                        loadedVideos.push(v);
                    });

                    if (bannerCountBadge) bannerCountBadge.textContent = `${loadedVideos.length} Videos`;
                    if (data.formattedTotalDuration && bannerDuration) {
                        bannerDuration.textContent = data.formattedTotalDuration;
                    }

                    renderVideosTable();
                    updateSelectionMetrics();

                    if (!data.hasMore || loadedVideos.length >= maxCap) {
                        keepFetching = false;
                        break;
                    }

                    // Brief breathing space for UI refresh and socket throttle
                    await new Promise(res => setTimeout(res, 120));
                }

                updateProgressiveSection({ hasMore: false, isMix: currentPlaylist?.isMix, totalKnownVideos: loadedVideos.length });
                return;
            }

            // Normal single batch loading (25 items)
            if (btnLoadNextBatch) {
                const span = btnLoadNextBatch.querySelector('span');
                if (span) span.textContent = 'Loading...';
            }
            if (progressiveLoadingMsg) {
                progressiveLoadingMsg.textContent = `Fetching next ${batchSize} videos (#${loadedVideos.length + 1} to #${loadedVideos.length + batchSize}) from YouTube...`;
            }

            const startIndex = loadedVideos.length + 1;
            const lastVid = loadedVideos.length > 0 ? loadedVideos[loadedVideos.length - 1] : null;
            const lastVideoId = lastVid ? lastVid.videoId : '';

            let data = null;
            try {
                let fetchUrl = `/api/playlist/fetch?url=${encodeURIComponent(currentPlaylistUrl)}&startIndex=${startIndex}&limit=${batchSize}`;
                if (lastVideoId) fetchUrl += `&lastVideoId=${encodeURIComponent(lastVideoId)}`;
                const fetchResp = await fetch(fetchUrl);
                if (fetchResp.ok) {
                    data = await fetchResp.json();
                }
            } catch { }

            if (!data || !data.success) {
                const resp = await fetch('/api/playlist/load', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: currentPlaylistUrl,
                        limit: batchSize,
                        offset: loadedVideos.length,
                        lastVideoId: lastVideoId
                    })
                });
                data = await resp.json();
            }

            if (!data || !data.success) {
                showAlert('Load More Failed', data?.message || 'Could not fetch additional videos.');
                return;
            }

            const newVideos = data.videos || [];
            if (newVideos.length === 0) {
                updateProgressiveSection({ hasMore: false, isMix: data.isMix, totalKnownVideos: loadedVideos.length });
                return;
            }

            const existingIds = new Set(loadedVideos.map(v => v.videoId));
            const uniqueNewVideos = newVideos.filter(v => !existingIds.has(v.videoId));

            if (uniqueNewVideos.length === 0) {
                updateProgressiveSection({ hasMore: false, isMix: data.isMix, totalKnownVideos: loadedVideos.length });
                return;
            }

            const startIdx = loadedVideos.length;
            uniqueNewVideos.forEach((v, i) => {
                const globalIdx = startIdx + i + 1;
                v.originalIndex = globalIdx;
                v.index = globalIdx;
                if (v.isAvailable && !removedVideoIds.has(v.videoId)) {
                    selectedVideoIds.add(v.videoId);
                }
                loadedVideos.push(v);
            });

            if (bannerCountBadge) bannerCountBadge.textContent = `${loadedVideos.length} Videos`;
            if (data.formattedTotalDuration && bannerDuration) {
                bannerDuration.textContent = data.formattedTotalDuration;
            }

            if (pageSize !== 'all') {
                const prevTotalPages = Math.ceil(startIdx / pageSize);
                if (currentPage === prevTotalPages) {
                    currentPage++;
                }
            }

            renderVideosTable();
            updateSelectionMetrics();
            updateProgressiveSection(data);

        } catch (err) {
            showAlert('Network Error', err.message || 'Error fetching additional videos.');
        } finally {
            if (btnLoadNextBatch) {
                btnLoadNextBatch.disabled = false;
                const span = btnLoadNextBatch.querySelector('span');
                if (span) span.textContent = `Load Next 25 Videos (From #${loadedVideos.length + 1})`;
            }
            if (btnLoadAllVideos) {
                btnLoadAllVideos.disabled = false;
                const spanAll = btnLoadAllVideos.querySelector('span');
                if (spanAll) spanAll.textContent = 'Load All (~400+)';
            }
            if (progressiveLoadingBar) progressiveLoadingBar.style.display = 'none';
        }
    }

    function setLoading(isLoading) {
        btnLoadPlaylist.disabled = isLoading;
        const btnText = btnLoadPlaylist.querySelector('.btn-text');
        const btnLoader = btnLoadPlaylist.querySelector('.btn-loader');
        if (btnText) btnText.style.display = isLoading ? 'none' : 'inline';
        if (btnLoader) btnLoader.style.display = isLoading ? 'inline-block' : 'none';
    }

    function renderPlaylistBanner(data) {
        bannerThumb.src = data.thumbnailUrl || '/icons/icon128.png';
        bannerTitle.textContent = data.title || 'Untitled Playlist';
        bannerAuthor.textContent = data.author || 'YouTube Channel';
        bannerCountBadge.textContent = `${data.videoCount} Videos`;
        bannerDuration.textContent = data.formattedTotalDuration || '0m';
        bannerDesc.textContent = data.description || 'No description provided.';
        bannerDesc.style.display = data.description ? 'block' : 'none';
    }

    function getFilteredVideos() {
        const q = (videoSearchInput.value || '').trim().toLowerCase();
        const statusFilter = statusFilterSelect ? statusFilterSelect.value : 'active';
        const sortOrder = sortOrderSelect ? sortOrderSelect.value : activeSortOrder;

        let list = loadedVideos.filter(v => {
            const isRemoved = removedVideoIds.has(v.videoId);

            if (statusFilter === 'removed') {
                if (!isRemoved) return false;
            } else if (statusFilter === 'available') {
                if (isRemoved || !v.isAvailable) return false;
            } else if (statusFilter === 'active') {
                if (isRemoved) return false;
            } else if (statusFilter === 'all') {
                // Return all loaded videos
            } else {
                if (isRemoved) return false;
            }

            if (q) {
                const title = (v.title || '').toLowerCase();
                const author = (v.author || '').toLowerCase();
                const idxStr = String(v.originalIndex);
                const idxPad = v.originalIndex < 10 ? `0${v.originalIndex}` : String(v.originalIndex);
                const matchesQ = title.includes(q) || author.includes(q) || idxStr === q || idxPad === q;
                if (!matchesQ) return false;
            }

            return true;
        });

        if (sortOrder === 'reverse') {
            list = [...list].reverse();
        } else if (sortOrder === 'titleAsc') {
            list = [...list].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        }

        return list;
    }

    function getTotalPages() {
        const filtered = getFilteredVideos();
        if (!filtered.length || pageSize === 'all') return 1;
        return Math.max(1, Math.ceil(filtered.length / pageSize));
    }

    const probedVideoQualityCache = new Map();
    const videoProbeQueue = [];
    let activeQualityProbes = 0;
    const MAX_CONCURRENT_QUALITY_PROBES = 2;

    function renderQualityChips(qualities) {
        const list = (qualities && qualities.length > 0)
            ? qualities
            : ['4K', '2K', '1080p', '720p', 'MP3'];

        const has4k = list.some(q => {
            const s = String(q).toLowerCase();
            return s.includes('2160') || s.includes('4k');
        });
        const has2k = list.some(q => {
            const s = String(q).toLowerCase();
            return s.includes('1440') || s.includes('2k');
        });
        const has1080 = list.some(q => {
            const s = String(q).toLowerCase();
            return s.includes('1080');
        });
        const has720 = list.some(q => {
            const s = String(q).toLowerCase();
            return s.includes('720');
        });
        const hasMp3 = list.some(q => {
            const s = String(q).toLowerCase();
            return s.includes('mp3') || s.includes('audio') || s.includes('m4a');
        });

        let chips = [];
        if (has4k) chips.push(`<span class="q-chip q-chip-4k" title="4K Ultra HD (2160p)">4K</span>`);
        if (has2k) chips.push(`<span class="q-chip q-chip-2k" title="2K Quad HD (1440p)">2K</span>`);
        if (has1080) chips.push(`<span class="q-chip q-chip-1080p" title="1080p Full HD">1080p</span>`);
        if (has720) chips.push(`<span class="q-chip" title="720p HD">720p</span>`);
        if (hasMp3 || chips.length === 0) chips.push(`<span class="q-chip" title="HQ Audio (MP3)">MP3</span>`);

        return chips.join('');
    }

    function queueVideoProbe(video) {
        if (!video || !video.videoId || video.hasProbedQuality || probedVideoQualityCache.has(video.videoId)) {
            if (probedVideoQualityCache.has(video.videoId)) {
                const container = document.getElementById(`qualityChips_${video.videoId}`);
                if (container) container.innerHTML = renderQualityChips(probedVideoQualityCache.get(video.videoId));
            }
            return;
        }
        videoProbeQueue.push(video);
        processVideoProbeQueue();
    }

    function processVideoProbeQueue() {
        while (activeQualityProbes < MAX_CONCURRENT_QUALITY_PROBES && videoProbeQueue.length > 0) {
            const video = videoProbeQueue.shift();
            activeQualityProbes++;
            fetch('/api/playlist/probe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId: video.videoId })
            })
            .then(res => res.json())
            .then(data => {
                if (data && data.success && Array.isArray(data.resolutions) && data.resolutions.length > 0) {
                    video.hasProbedQuality = true;
                    video.availableQualities = data.resolutions;
                    probedVideoQualityCache.set(video.videoId, data.resolutions);
                    const container = document.getElementById(`qualityChips_${video.videoId}`);
                    if (container) {
                        container.innerHTML = renderQualityChips(data.resolutions);
                    }
                }
            })
            .catch(() => {})
            .finally(() => {
                activeQualityProbes--;
                processVideoProbeQueue();
            });
        }
    }

    function renderVideosTable() {
        videoTableBody.innerHTML = '';
        const filtered = getFilteredVideos();

        if (!filtered.length) {
            emptySearchState.style.display = 'block';
            if (playlistPagination) playlistPagination.style.display = 'none';
            return;
        }

        emptySearchState.style.display = 'none';
        if (playlistPagination) playlistPagination.style.display = 'flex';

        const totalPages = getTotalPages();
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        let startIdx = 0;
        let endIdx = filtered.length;
        if (pageSize !== 'all') {
            startIdx = (currentPage - 1) * pageSize;
            endIdx = Math.min(startIdx + pageSize, filtered.length);
        }

        const pageVideos = filtered.slice(startIdx, endIdx);

        pageVideos.forEach((v, pageOrderIdx) => {
            const isSelected = selectedVideoIds.has(v.videoId);
            const isRemoved = removedVideoIds.has(v.videoId);

            // Compute sequential display index for current sort/filter view
            const globalIndex = startIdx + pageOrderIdx + 1;
            v.index = globalIndex; // update current sequential order for downloading
            const idxStr = globalIndex < 10 ? `#0${globalIndex}` : `#${globalIndex}`;

            const tr = document.createElement('tr');
            tr.id = `vRow_${v.videoId}`;
            tr.className = `${isSelected ? 'row-selected' : ''} ${!v.isAvailable ? 'row-unavailable' : ''} ${isRemoved ? 'row-removed' : ''}`;
            tr.dataset.videoid = v.videoId;
            tr.dataset.title = (v.title || '').toLowerCase();
            tr.dataset.index = globalIndex;
            tr.dataset.available = v.isAvailable ? 'true' : 'false';

            const chipsHtml = `<div class="quality-chips-row" id="qualityChips_${v.videoId}">` + renderQualityChips(v.availableQualities) + `</div>`;

            let statusHtml = isRemoved
                ? `<span class="status-indicator status-removed"><span class="status-dot"></span>REMOVED</span>`
                : (!v.isAvailable
                    ? `<span class="status-indicator status-unavailable" title="${escapeHtml(v.statusReason || 'Unavailable')}"><span class="status-dot"></span>UNAVAILABLE</span>`
                    : `<span class="status-indicator status-ready" id="statusBadge_${v.videoId}"><span class="status-dot"></span>READY</span>`);

            let actionHtml = '';
            if (isRemoved) {
                actionHtml = `
                    <button type="button" class="btn-row-action btn-row-restore" data-videoid="${v.videoId}" title="Restore video">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                        <span>Restore</span>
                    </button>
                `;
            } else {
                actionHtml = `
                    <div class="row-actions-group">
                        <a href="https://www.youtube.com/watch?v=${v.videoId}" target="_blank" rel="noopener noreferrer" class="btn-row-action btn-row-play" title="Play on YouTube (New Tab)" aria-label="Play on YouTube in new tab">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        </a>
                        ${v.isAvailable ? `
                            <button type="button" class="btn-row-action btn-row-dl" data-videoid="${v.videoId}" title="Download this video">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            </button>
                        ` : `<span class="btn-row-disabled" title="Video unavailable">—</span>`}
                        <div class="row-overflow-wrapper">
                            <button type="button" class="btn-row-action btn-row-overflow" data-videoid="${v.videoId}" title="More options" aria-label="More options">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.75"></circle><circle cx="12" cy="12" r="1.75"></circle><circle cx="12" cy="19" r="1.75"></circle></svg>
                            </button>
                            <div class="row-overflow-menu" id="rowMenu_${v.videoId}">
                                <button type="button" class="row-menu-item item-danger btn-action-remove" data-videoid="${v.videoId}">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    <span>Remove from list</span>
                                </button>
                                <a href="https://www.youtube.com/watch?v=${v.videoId}" target="_blank" rel="noopener noreferrer" class="row-menu-item">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                    <span>Watch on YouTube</span>
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            }

            tr.innerHTML = `
                <td class="col-chk text-center">
                    <label class="custom-checkbox table-row-chk">
                        <input type="checkbox" class="video-chk" data-videoid="${v.videoId}" ${isSelected ? 'checked' : ''} ${(!v.isAvailable || isRemoved) ? 'disabled' : ''} />
                        <span class="checkmark"></span>
                    </label>
                </td>
                <td class="col-index video-index-badge text-center">${idxStr}</td>
                <td class="col-preview">
                    <a href="https://www.youtube.com/watch?v=${v.videoId}" target="_blank" rel="noopener noreferrer" class="video-thumb-preview" title="Play on YouTube (New Tab)">
                        <img src="${v.thumbnailUrl || '/icons/icon48.png'}" alt="Thumb" loading="lazy" onerror="this.src='/icons/icon48.png';" />
                        <span class="thumb-duration-pill">${v.formattedDuration || '00:00'}</span>
                        <div class="thumb-play-hover-overlay">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                    </a>
                </td>
                <td class="col-meta video-meta-cell">
                    <h4 title="${escapeHtml(v.title)}"><a href="https://www.youtube.com/watch?v=${v.videoId}" target="_blank" rel="noopener noreferrer" class="video-title-link">${escapeHtml(v.title)}</a></h4>
                    <div class="video-sub">${escapeHtml(v.author || '')}</div>
                </td>
                <td class="col-duration text-center"><span class="duration-text">${v.formattedDuration}</span></td>
                <td class="col-qualities">
                    ${chipsHtml}
                </td>
                <td class="col-status text-center">${statusHtml}</td>
                <td class="col-action text-center">
                    ${actionHtml}
                </td>
            `;

            videoTableBody.appendChild(tr);
        });

        // Trigger lazy background resolution probing for visible page items
        pageVideos.forEach(v => {
            if (v && v.videoId && v.isAvailable && !removedVideoIds.has(v.videoId)) {
                queueVideoProbe(v);
            }
        });

        // Bind table checkbox change events
        videoTableBody.querySelectorAll('.video-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const vid = e.target.dataset.videoid;
                if (e.target.checked) {
                    selectedVideoIds.add(vid);
                } else {
                    selectedVideoIds.delete(vid);
                }
                const row = document.getElementById(`vRow_${vid}`);
                if (row) row.classList.toggle('row-selected', e.target.checked);
                updateSelectionMetrics();
            });
        });

        // Single download click events
        videoTableBody.querySelectorAll('.btn-row-dl').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const vid = e.currentTarget.dataset.videoid;
                downloadSingleVideo(vid);
            });
        });

        // Row overflow menu toggle
        videoTableBody.querySelectorAll('.btn-row-overflow').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const vid = e.currentTarget.dataset.videoid;
                const menu = document.getElementById(`rowMenu_${vid}`);
                const wasShown = menu && menu.classList.contains('show');
                document.querySelectorAll('.row-overflow-menu.show').forEach(m => m.classList.remove('show'));
                if (!wasShown && menu) {
                    menu.classList.add('show');
                }
            });
        });

        // Remove row click from menu
        videoTableBody.querySelectorAll('.btn-action-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const vid = e.currentTarget.dataset.videoid;
                document.querySelectorAll('.row-overflow-menu.show').forEach(m => m.classList.remove('show'));
                removeVideo(vid);
            });
        });

        // Restore row click events
        videoTableBody.querySelectorAll('.btn-row-restore').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const vid = e.currentTarget.dataset.videoid;
                restoreVideo(vid);
            });
        });

        // Update pagination UI
        if (paginationRangeText) {
            paginationRangeText.textContent = filtered.length === 0 ? '0' : `${startIdx + 1}–${endIdx}`;
        }
        if (paginationTotalText) {
            paginationTotalText.textContent = filtered.length;
        }
        if (pageIndicatorText) {
            pageIndicatorText.textContent = `Page ${currentPage} of ${totalPages}`;
        }
        if (btnPagePrev) {
            btnPagePrev.disabled = currentPage <= 1;
        }
        if (btnPageNext) {
            btnPageNext.disabled = currentPage >= totalPages;
        }
    }

    function removeVideo(videoId) {
        removedVideoIds.add(videoId);
        selectedVideoIds.delete(videoId);
        renderVideosTable();
        updateSelectionMetrics();
    }

    function restoreVideo(videoId) {
        removedVideoIds.delete(videoId);
        const v = loadedVideos.find(x => x.videoId === videoId);
        if (v && v.isAvailable) {
            selectedVideoIds.add(videoId);
        }
        renderVideosTable();
        updateSelectionMetrics();
    }

    function removeSelectedVideos() {
        const visible = getFilteredVideos();
        let removedCount = 0;
        visible.forEach(v => {
            if (selectedVideoIds.has(v.videoId)) {
                removedVideoIds.add(v.videoId);
                selectedVideoIds.delete(v.videoId);
                removedCount++;
            }
        });

        if (removedCount === 0) {
            showAlert('No Selection', 'Please check at least one video to remove.');
            return;
        }

        renderVideosTable();
        updateSelectionMetrics();
    }

    function restoreAllRemovedVideos() {
        removedVideoIds.forEach(vid => {
            const v = loadedVideos.find(x => x.videoId === vid);
            if (v && v.isAvailable) {
                selectedVideoIds.add(vid);
            }
        });
        removedVideoIds.clear();
        renderVideosTable();
        updateSelectionMetrics();
    }

    function toggleSelectAll(isSelected) {
        const filtered = getFilteredVideos();
        filtered.forEach(v => {
            if (!removedVideoIds.has(v.videoId) && v.isAvailable) {
                if (isSelected) {
                    selectedVideoIds.add(v.videoId);
                } else {
                    selectedVideoIds.delete(v.videoId);
                }
            }
        });

        renderVideosTable();
        updateSelectionMetrics();
    }

    function invertSelection() {
        const filtered = getFilteredVideos();
        filtered.forEach(v => {
            if (!removedVideoIds.has(v.videoId) && v.isAvailable) {
                if (selectedVideoIds.has(v.videoId)) {
                    selectedVideoIds.delete(v.videoId);
                } else {
                    selectedVideoIds.add(v.videoId);
                }
            }
        });

        renderVideosTable();
        updateSelectionMetrics();
    }

    function updateSelectionMetrics() {
        const activeVideos = loadedVideos.filter(v => !removedVideoIds.has(v.videoId));
        const activeAvailable = activeVideos.filter(v => v.isAvailable);
        const selectedCount = activeVideos.filter(v => selectedVideoIds.has(v.videoId)).length;

        const currentFmt = formatSelect ? formatSelect.value : 'MP4';
        const currentQ = qualitySelect ? qualitySelect.value : 'Best';
        const isAudioMode = currentFmt === 'MP3' || currentFmt === 'M4A' || currentQ === 'AudioOnly';
        const formatTag = isAudioMode ? (currentFmt === 'M4A' ? ' • M4A' : ' • MP3') : '';

        selectionCountBadge.textContent = `${selectedCount} selected`;
        txtDownloadSelected.textContent = `Download Selected (${selectedCount}${formatTag})`;
        btnDownloadSelected.disabled = selectedCount === 0;

        if (btnDownloadAll) {
            const spanAll = btnDownloadAll.querySelector('span');
            if (spanAll) {
                spanAll.textContent = `Download All (${activeAvailable.length}${formatTag})`;
            }
        }

        const allSelected = activeAvailable.length > 0 && activeAvailable.every(v => selectedVideoIds.has(v.videoId));
        const anySelected = activeAvailable.some(v => selectedVideoIds.has(v.videoId));

        chkMasterSelect.checked = allSelected;
        chkMasterSelect.indeterminate = !allSelected && anySelected;
        chkHeaderSelect.checked = allSelected;
        chkHeaderSelect.indeterminate = !allSelected && anySelected;

        if (btnRemoveSelected) {
            btnRemoveSelected.style.display = selectedCount > 0 ? 'inline-flex' : 'none';
        }

        if (btnRestoreAll) {
            btnRestoreAll.style.display = removedVideoIds.size > 0 ? 'inline-flex' : 'none';
            btnRestoreAll.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
                <span>Restore All (${removedVideoIds.size})</span>
            `;
        }

        if (videoTableBody) {
            videoTableBody.classList.toggle('has-selection', selectedCount > 0);
        }
    }

    function filterVideos() {
        const q = (videoSearchInput.value || '').trim().toLowerCase();
        btnClearSearch.style.display = q ? 'inline-block' : 'none';
        currentPage = 1;
        renderVideosTable();
    }

    async function downloadSelectedVideos() {
        // STRICT PLAYLIST ORDER: sort strictly by originalIndex
        const selected = loadedVideos
            .filter(v => !removedVideoIds.has(v.videoId) && selectedVideoIds.has(v.videoId) && v.isAvailable)
            .sort((a, b) => a.originalIndex - b.originalIndex);

        if (!selected.length) {
            showAlert('No Videos Selected', 'Please check at least one video to download.');
            return;
        }

        await startBatchJob(selected);
    }

    async function downloadAllVideos() {
        // STRICT PLAYLIST ORDER: sort strictly by originalIndex
        const allAvailable = loadedVideos
            .filter(v => !removedVideoIds.has(v.videoId) && v.isAvailable)
            .sort((a, b) => a.originalIndex - b.originalIndex);

        if (!allAvailable.length) {
            showAlert('No Available Videos', 'There are no downloadable videos in this playlist.');
            return;
        }

        await startBatchJob(allAvailable);
    }

    async function downloadSingleVideo(videoId) {
        const v = loadedVideos.find(x => x.videoId === videoId);
        if (v) {
            await startBatchJob([v]);
        } else {
            await startBatchJob([{ videoId, index: 1, originalIndex: 1, title: '', thumbnailUrl: '' }]);
        }
    }

    function showVipUpgradeModal(message) {
        let modal = document.getElementById('playlistVipModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'playlistVipModal';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:999999; padding:20px;';
            modal.innerHTML = `
                <div style="background:linear-gradient(135deg, #111827 0%, #0f172a 100%); border:1px solid rgba(234,179,8,0.3); border-radius:16px; padding:32px; max-width:480px; width:100%; text-align:center; box-shadow:0 25px 50px -12px rgba(0,0,0,0.7); position:relative;">
                    <div style="font-size:44px; margin-bottom:12px;">👑</div>
                    <h3 style="color:#facc15; font-size:22px; font-weight:800; margin-bottom:8px;">VIP PRO Feature</h3>
                    <p id="playlistVipModalDesc" style="color:#94a3b8; font-size:14px; line-height:1.6; margin-bottom:24px;">
                        ${message || 'Batch Playlist Studio is an exclusive VIP PRO feature. Please upgrade to unlock unlimited 4K batch playlist downloads.'}
                    </p>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <a href="https://save-zonix.vercel.app/#pricing" target="_blank" style="display:inline-block; padding:12px 24px; background:linear-gradient(135deg, #eab308 0%, #ca8a04 100%); color:#000; font-weight:700; border-radius:10px; text-decoration:none; font-size:14px; transition:transform 0.2s;">
                            Upgrade to VIP PRO
                        </a>
                        <button type="button" id="btnClosePlaylistVipModal" style="padding:10px; background:transparent; border:1px solid rgba(255,255,255,0.15); color:#94a3b8; border-radius:10px; cursor:pointer; font-size:13px;">
                            Maybe Later
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('#btnClosePlaylistVipModal').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        } else {
            const desc = modal.querySelector('#playlistVipModalDesc');
            if (desc && message) desc.textContent = message;
            modal.style.display = 'flex';
        }
    }

    async function startBatchJob(videoList) {
        // Option A: Strict VIP PRO Enforcement for Batch Playlist Studio
        if (videoList.length > 1) {
            let isUserVip = false;

            // 1. Session check from ASP.NET _Layout
            if (window.__SAVEZONIX_SESSION__ && (window.__SAVEZONIX_SESSION__.isAdmin || window.__SAVEZONIX_SESSION__.isVip)) {
                isUserVip = true;
            }

            // 2. Storage check (cloud user, local user, admin user)
            if (!isUserVip) {
                const storageKeys = ['savezonix_cloud_user', 'savezonix_user', 'savezonix_admin_user'];
                for (const k of storageKeys) {
                    try {
                        const saved = localStorage.getItem(k);
                        if (saved) {
                            const u = JSON.parse(saved);
                            if (u.isVip || u.role === 'Admin' || u.Role === 'Admin' || (u.email && u.email.toLowerCase() === 'zaidm1323@gmail.com') || u.isAdmin) {
                                isUserVip = true;
                                break;
                            }
                        }
                    } catch { }
                }
            }

            // 3. Admin Key check
            if (!isUserVip) {
                try {
                    const k = localStorage.getItem('savezonix_admin_key');
                    if (k === 'savezonix_admin_2026') isUserVip = true;
                } catch { }
            }

            // 4. Fleet engine settings
            if (!isUserVip && window.getFleetEngineSettings) {
                try {
                    const fleet = window.getFleetEngineSettings();
                    if (fleet && (fleet.isVip || fleet.role === 'Admin' || fleet.isAdmin)) isUserVip = true;
                } catch { }
            }

            if (!isUserVip) {
                showVipUpgradeModal('Batch Playlist Studio is an exclusive VIP PRO feature. Please upgrade to unlock unlimited 4K batch playlist downloads.');
                return;
            }
        }

        let quality = qualitySelect ? qualitySelect.value : 'Best';
        let format = formatSelect ? formatSelect.value : 'MP4';

        // Defensive normalization before dispatching
        if (quality === 'AudioOnly' && format !== 'MP3' && format !== 'M4A') {
            format = 'MP3';
        }
        if ((format === 'MP3' || format === 'M4A') && quality !== 'AudioOnly') {
            quality = 'AudioOnly';
        }

        const concurrency = parseInt(concurrencySelect.value, 10) || 6;
        const numberPrefix = chkNumberPrefix.checked;
        const playlistTitle = currentPlaylist ? currentPlaylist.title : 'YouTube Playlist';

        const videoObjects = videoList.map(v => ({
            videoId: v.videoId,
            index: v.originalIndex || v.index || 1,
            title: v.title || '',
            thumbnailUrl: v.thumbnailUrl || '',
            formattedDuration: v.formattedDuration || ''
        }));
        const idList = videoList.map(v => v.videoId);

        try {
            const batchHeaders = { 'Content-Type': 'application/json' };
            const adminKey = localStorage.getItem('savezonix_admin_key');
            if (adminKey) batchHeaders['x-admin-key'] = adminKey;
            const token = localStorage.getItem('savezonix_token') || localStorage.getItem('savezonix_cloud_token');
            if (token) batchHeaders['Authorization'] = `Bearer ${token}`;

            const resp = await fetch('/api/playlist/download-batch', {
                method: 'POST',
                headers: batchHeaders,
                body: JSON.stringify({
                    playlistUrl: playlistUrlInput.value.trim(),
                    playlistTitle: playlistTitle,
                    videoIds: idList,
                    videos: videoObjects,
                    quality: quality,
                    format: format,
                    numberPrefix: numberPrefix,
                    concurrency: concurrency
                })
            });

            const data = await resp.json();
            if (resp.status === 403 || data.isVipRequired) {
                showVipUpgradeModal(data.message || 'Batch Playlist Studio is an exclusive VIP PRO feature. Please upgrade to unlock unlimited 4K batch playlist downloads.');
                return;
            }

            if (!resp.ok || !data.success) {
                alert(data.message || 'Could not queue playlist download.');
                return;
            }

            activeJobId = data.jobId;
            currentJobState = { status: 'Running', activeCount: videoList.length, queuedCount: 0 };
            jobStartTime = Date.now();
            saveActiveJobSession(activeJobId, playlistUrlInput.value.trim(), playlistTitle);
            pushDownloadProtectionHistory();

            updateStepper(3);
            if (completionSummaryCard) completionSummaryCard.style.display = 'none';

            if ('Notification' in window && Notification.permission === 'default') {
                try { Notification.requestPermission(); } catch { }
            }

            // Show floating toast notification linking to Downloads
            if (playlistQueuedToast) {
                if (toastTitle) toastTitle.textContent = 'Batch Download Queued';
                if (toastMessage) toastMessage.textContent = `${videoList.length} item${videoList.length !== 1 ? 's' : ''} queued in background.`;
                playlistQueuedToast.style.display = 'flex';
            }

            if (queueItemsList) queueItemsList.innerHTML = '';
            if (downloadQueuePanel) {
                downloadQueuePanel.style.display = 'block';
                downloadQueuePanel.classList.remove('queue-dock-minimized');
            }
            if (queueRunningNotice) queueRunningNotice.style.display = 'flex';

            startPolling(activeJobId);

        } catch (err) {
            showAlert('Queue Error', err.message || 'Failed to start batch download.');
        }
    }

    function startPolling(jobId) {
        if (pollInterval) clearInterval(pollInterval);

        pollJobStatus(jobId);
        pollInterval = setInterval(() => pollJobStatus(jobId), 1000);
    }

    async function pollJobStatus(jobId) {
        try {
            const resp = await fetch(`/api/playlist/status/${jobId}`);
            if (!resp.ok) return;

            const job = await resp.json();
            currentJobState = job;
            renderQueueState(job);

            const isFinished = (job.status === 'Completed' || job.status === 'Cancelled' || job.status === 'Completed with Errors') &&
                               (job.activeCount === 0 && job.queuedCount === 0);

            if (isFinished) {
                if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
                clearActiveJobSession();
                if (queueRunningNotice) queueRunningNotice.style.display = 'none';

                if (job.status === 'Completed' || (job.completedCount > 0 && job.completedCount === job.totalVideos)) {
                    document.title = `✓ (${job.totalVideos}/${job.totalVideos}) Complete — SaveZonix`;
                    updateStepper(4);
                    playCompletionSound();
                    showBrowserNotification('SaveZonix — Download Complete', `${job.totalVideos}/${job.totalVideos} videos downloaded successfully!`);
                    showCompletionSummary(job);
                } else {
                    document.title = `YouTube Playlist Studio — SaveZonix`;
                }
            } else {
                const pct = Math.round(job.overallPercentage || 0);
                document.title = `(${pct}%) Downloading ${job.completedCount}/${job.totalVideos} — SaveZonix`;
                if (queueRunningNotice) queueRunningNotice.style.display = 'flex';
            }
        } catch { }
    }

    function renderQueueState(job) {
        if (queueItemCountBadge) queueItemCountBadge.textContent = `${job.totalVideos} Videos`;
        if (overallCompletedText) overallCompletedText.textContent = `${job.completedCount} / ${job.totalVideos} Completed`;
        if (overallSpeedText) overallSpeedText.textContent = `${job.overallSpeedMBps || 0} MB/s`;
        if (overallPercentText) overallPercentText.textContent = `${job.overallPercentage || 0}%`;
        if (overallProgressBar) overallProgressBar.style.width = `${job.overallPercentage || 0}%`;

        if (btnRetryAllFailed) btnRetryAllFailed.style.display = job.failedCount > 0 ? 'inline-block' : 'none';

        // Sort items strictly by original playlist index ascending so Video 1 is always first
        const sortedItems = [...(job.items || [])].sort((a, b) => a.index - b.index);

        sortedItems.forEach(item => {
            const local = loadedVideos.find(x => x.videoId === item.videoId);
            const title = (item.title && item.title !== item.videoId)
                ? item.title
                : (local?.title || item.title || item.videoId);
            const thumb = item.thumbnailUrl || local?.thumbnailUrl || '/icons/icon48.png';
            const realIndex = item.index || local?.originalIndex || local?.index || 1;
            const indexStr = realIndex < 10 ? `0${realIndex}` : `${realIndex}`;

            const isDone = item.status === 'Completed';
            const isFailed = item.status === 'Failed' || item.status === 'Cancelled';
            const isBusy = !isDone && !isFailed && item.status !== 'Pending';

            let speedTag = item.speedMBps > 0 ? `${item.speedMBps} MB/s` : '';
            let sizeTag = '';
            if (item.bytesDownloaded > 0) {
                const mb = (item.bytesDownloaded / (1024 * 1024)).toFixed(1);
                sizeTag = `${mb} MB`;
            }

            let fillCls = '';
            if (isDone) fillCls = 'status-completed-bar';
            else if (isFailed) fillCls = 'status-failed-bar';

            const errorReason = (item.errorMessage || item.error || item.statusReason || '').trim();
            const displayError = errorReason || 'Download failed — click Retry';

            const cardId = `qCard_${item.videoId}`;
            let card = document.getElementById(cardId);

            if (!card) {
                card = document.createElement('div');
                card.id = cardId;
                card.className = 'queue-item-card';

                card.innerHTML = `
                    <span class="queue-item-index-badge">#${indexStr}</span>
                    <div class="queue-item-thumb">
                        <img src="${thumb}" alt="Thumb" loading="lazy" onerror="this.src='/icons/icon48.png';" />
                    </div>
                    <div class="queue-item-info">
                        <div class="queue-item-header">
                            <span class="queue-item-title" id="qTitle_${item.videoId}" title="${escapeHtml(title)}">
                                ${escapeHtml(title)}
                            </span>
                            <span class="queue-item-stage" id="qStage_${item.videoId}" style="${isFailed ? 'color:var(--pl-rose);' : isDone ? 'color:var(--pl-emerald);' : ''}">
                                ${escapeHtml(item.status)}
                            </span>
                        </div>
                        <div class="queue-item-progress-track">
                            <div class="queue-item-progress-fill ${fillCls}" id="qFill_${item.videoId}" style="width: ${item.percentage}%;"></div>
                        </div>
                        <div class="queue-item-meta-row">
                            <span id="qMetaLeft_${item.videoId}">${Math.round(item.percentage)}% ${sizeTag ? `• ${sizeTag}` : ''}</span>
                            <span id="qMetaRight_${item.videoId}">${speedTag}</span>
                        </div>
                        ${isFailed ? `<div class="queue-item-error-reason" id="qErr_${item.videoId}" title="${escapeHtml(displayError)}">⚠️ ${escapeHtml(displayError)}</div>` : ''}
                    </div>
                    <div class="queue-item-actions" id="qActions_${item.videoId}">
                        ${isFailed ? `
                            <button type="button" class="btn-item-ctrl btn-item-retry" data-videoid="${item.videoId}" title="Retry download">
                                🔄 Retry
                            </button>
                        ` : ''}
                        ${isBusy || item.status === 'Pending' ? `
                            <button type="button" class="btn-item-ctrl btn-item-cancel" data-videoid="${item.videoId}" title="Cancel item">
                                ✕
                            </button>
                        ` : ''}
                        ${isDone ? `
                            <span style="color:var(--pl-emerald); font-size:16px; font-weight:bold;">✓</span>
                        ` : ''}
                    </div>
                `;

                // Event listener for action buttons inside the card
                const retryBtn = card.querySelector('.btn-item-retry');
                if (retryBtn) {
                    retryBtn.addEventListener('click', async (e) => {
                        const vid = e.currentTarget.dataset.videoid;
                        await retrySinglePlaylistItem(job.jobId, vid);
                    });
                }
                const cancelBtn = card.querySelector('.btn-item-cancel');
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', async (e) => {
                        const vid = e.currentTarget.dataset.videoid;
                        await cancelSinglePlaylistItem(job.jobId, vid);
                    });
                }

                if (queueItemsList) {
                    queueItemsList.appendChild(card);
                }
            } else {
                // In-place dynamic update
                const titleEl = document.getElementById(`qTitle_${item.videoId}`);
                if (titleEl && titleEl.textContent.trim() !== title) {
                    titleEl.textContent = title;
                    titleEl.title = title;
                }

                const stageEl = document.getElementById(`qStage_${item.videoId}`);
                if (stageEl) {
                    stageEl.textContent = item.status;
                    stageEl.style.color = isFailed ? 'var(--pl-rose)' : isDone ? 'var(--pl-emerald)' : '';
                }

                const fillEl = document.getElementById(`qFill_${item.videoId}`);
                if (fillEl) {
                    fillEl.className = `queue-item-progress-fill ${fillCls}`;
                    fillEl.style.width = `${item.percentage}%`;
                }

                const metaLeft = document.getElementById(`qMetaLeft_${item.videoId}`);
                if (metaLeft) {
                    metaLeft.textContent = `${Math.round(item.percentage)}% ${sizeTag ? `• ${sizeTag}` : ''}`;
                }

                const metaRight = document.getElementById(`qMetaRight_${item.videoId}`);
                if (metaRight) {
                    metaRight.textContent = speedTag;
                }

                let errEl = document.getElementById(`qErr_${item.videoId}`);
                if (isFailed) {
                    if (!errEl) {
                        errEl = document.createElement('div');
                        errEl.id = `qErr_${item.videoId}`;
                        errEl.className = 'queue-item-error-reason';
                        const infoDiv = card.querySelector('.queue-item-info');
                        if (infoDiv) infoDiv.appendChild(errEl);
                    }
                    errEl.textContent = `⚠️ ${displayError}`;
                    errEl.title = displayError;
                    errEl.style.display = 'block';
                } else if (errEl) {
                    errEl.style.display = 'none';
                }

                const actionsEl = document.getElementById(`qActions_${item.videoId}`);
                if (actionsEl) {
                    if (isFailed && !actionsEl.querySelector('.btn-item-retry')) {
                        actionsEl.innerHTML = `
                            <button type="button" class="btn-item-ctrl btn-item-retry" data-videoid="${item.videoId}" title="Retry download">
                                🔄 Retry
                            </button>
                        `;
                        actionsEl.querySelector('.btn-item-retry')?.addEventListener('click', async (e) => {
                            const vid = e.currentTarget.dataset.videoid;
                            await retrySinglePlaylistItem(job.jobId, vid);
                        });
                    } else if (isDone && !actionsEl.querySelector('span')) {
                        actionsEl.innerHTML = `<span style="color:var(--pl-emerald); font-size:16px; font-weight:bold;">✓</span>`;
                    }
                }
            }

            // Update row status badge in the main table if visible
            const tableBadge = document.getElementById(`statusBadge_${item.videoId}`);
            if (tableBadge) {
                if (isDone) {
                    tableBadge.className = 'status-indicator status-completed';
                    tableBadge.innerHTML = '<span class="status-dot"></span>COMPLETED';
                } else if (isFailed) {
                    tableBadge.className = 'status-indicator status-failed';
                    tableBadge.innerHTML = '<span class="status-dot"></span>FAILED';
                } else if (isBusy) {
                    tableBadge.className = 'status-indicator status-downloading';
                    tableBadge.innerHTML = `<span class="status-dot"></span>${Math.round(item.percentage)}%`;
                } else {
                    tableBadge.className = 'status-indicator status-queued';
                    tableBadge.innerHTML = '<span class="status-dot"></span>QUEUED';
                }
            }
        });
    }

    async function retrySinglePlaylistItem(jobId, videoId) {
        try {
            await fetch('/api/playlist/retry-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId, videoId })
            });
            startPolling(jobId);
        } catch { }
    }

    async function cancelSinglePlaylistItem(jobId, videoId) {
        try {
            await fetch('/api/playlist/cancel-item', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId, videoId })
            });
        } catch { }
    }

    async function cancelCurrentBatch() {
        if (!activeJobId) return;
        try {
            await fetch(`/api/playlist/cancel/${activeJobId}`, { method: 'POST' });
        } catch { }
        currentJobState = null;
        clearActiveJobSession();
        if (queueRunningNotice) queueRunningNotice.style.display = 'none';
        document.title = 'YouTube Playlist Studio — SaveZonix';
    }

    async function retryAllFailedVideos() {
        if (!activeJobId) return;
        try {
            await fetch(`/api/playlist/retry-all-failed/${activeJobId}`, { method: 'POST' });
            startPolling(activeJobId);
        } catch { }
    }

    async function openDownloadsFolder() {
        try {
            await fetch('/api/open-folder', { method: 'POST' });
        } catch { }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})();
