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
    let currentJobState = null;
    let pendingLeaveCallback = null;
    const STORAGE_KEY_ACTIVE_JOB = 'sz_active_playlist_job';

    // DOM Elements
    const playlistUrlInput = document.getElementById('playlistUrlInput');
    const btnPasteUrl = document.getElementById('btnPasteUrl');
    const btnClearUrl = document.getElementById('btnClearUrl');
    const btnLoadPlaylist = document.getElementById('btnLoadPlaylist');
    const studioAlertBox = document.getElementById('studioAlertBox');
    const alertTitle = document.getElementById('alertTitle');
    const alertMessage = document.getElementById('alertMessage');

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

    // Queue Dock Elements
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

    // Init
    initEvents();

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

    function initEvents() {
        // Input events
        playlistUrlInput.addEventListener('input', () => {
            btnClearUrl.style.display = playlistUrlInput.value.trim() ? 'inline-flex' : 'none';
        });

        playlistUrlInput.addEventListener('paste', () => {
            setTimeout(() => {
                const text = playlistUrlInput.value.trim();
                if (isSingleVideoUrl(text)) {
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
                    if (isSingleVideoUrl(clean)) {
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

        // Download actions
        btnDownloadSelected.addEventListener('click', downloadSelectedVideos);
        btnDownloadAll.addEventListener('click', downloadAllVideos);

        // Queue dock actions
        btnOpenFolder.addEventListener('click', openDownloadsFolder);
        btnOpenGlobalFolder.addEventListener('click', openDownloadsFolder);
        btnCancelBatch.addEventListener('click', cancelCurrentBatch);
        btnRetryAllFailed.addEventListener('click', retryAllFailedVideos);
        btnToggleQueueMinimize.addEventListener('click', () => {
            downloadQueuePanel.classList.toggle('queue-dock-minimized');
        });

        // Close row overflow dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.row-overflow-wrapper')) {
                document.querySelectorAll('.row-overflow-menu.show').forEach(m => m.classList.remove('show'));
            }
        });

        // Confirm Modal actions
        if (btnCloseConfirmModal) btnCloseConfirmModal.addEventListener('click', hideLeaveConfirmModal);
        if (btnConfirmStay) btnConfirmStay.addEventListener('click', hideLeaveConfirmModal);
        if (btnConfirmLeave) {
            btnConfirmLeave.addEventListener('click', async () => {
                const cb = pendingLeaveCallback;
                hideLeaveConfirmModal();
                await cancelCurrentBatch();
                clearActiveJobSession();
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

        // Browser Tab Close / Page Reload Guard
        window.addEventListener('beforeunload', (e) => {
            if (isDownloadActive()) {
                e.preventDefault();
                e.returnValue = 'Downloads are currently active. Leaving will interrupt your download progress.';
                return e.returnValue;
            }
        });

        // Intercept clicks on links leaving the studio
        document.addEventListener('click', (e) => {
            const anchor = e.target.closest('a[href]');
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

            if (isDownloadActive()) {
                e.preventDefault();
                showLeaveConfirmModal(() => {
                    window.location.href = href;
                });
            }
        });

        // Restore active job from previous session or page reload
        checkAndRestoreActiveJob();

        // Auto load if ?url= is passed in query string
        const urlParams = new URLSearchParams(window.location.search);
        const autoUrl = urlParams.get('url');
        if (autoUrl) {
            playlistUrlInput.value = autoUrl;
            btnClearUrl.style.display = 'inline-flex';
            setTimeout(() => loadPlaylist(), 150);
        }
    }

    async function checkAndRestoreActiveJob() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_JOB);
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (!saved || !saved.jobId) return;

            const resp = await fetch(`/api/playlist/status/${saved.jobId}`);
            if (!resp.ok) {
                clearActiveJobSession();
                return;
            }

            const job = await resp.json();
            const isAlive = job && (job.status === 'Running' || job.status === 'Queued' || (job.activeCount > 0) || (job.queuedCount > 0));
            if (isAlive) {
                activeJobId = saved.jobId;
                currentJobState = job;

                if (saved.playlistUrl && !playlistUrlInput.value) {
                    playlistUrlInput.value = saved.playlistUrl;
                    btnClearUrl.style.display = 'inline-flex';
                }

                downloadQueuePanel.style.display = 'block';
                downloadQueuePanel.classList.remove('queue-dock-minimized');
                if (queueRunningNotice) queueRunningNotice.style.display = 'flex';
                pushDownloadProtectionHistory();

                renderQueueState(job);
                startPolling(activeJobId);

                showAlert('⚡ Session Restored', 'Reconnected to your active playlist download session.');
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

    async function loadPlaylist() {
        const url = playlistUrlInput.value.trim();
        if (!url) {
            showAlert('Input Required', 'Please enter or paste a valid YouTube Playlist URL.');
            playlistUrlInput.focus();
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

        try {
            const resp = await fetch('/api/playlist/load', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const data = await resp.json();
            if (!resp.ok || !data.success) {
                showAlert('Playlist Loading Failed', data.message || 'Unable to fetch YouTube playlist.');
                if (playlistWelcomeState) playlistWelcomeState.style.display = 'block';
                return;
            }

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

            currentPage = 1;
            renderPlaylistBanner(data);
            renderVideosTable();
            updateSelectionMetrics();

            playlistInfoSection.style.display = 'block';
            playlistControlsSection.style.display = 'block';
            videoListSection.style.display = 'block';

        } catch (err) {
            showAlert('Network Error', err.message || 'An unexpected error occurred while loading playlist.');
            if (playlistWelcomeState) playlistWelcomeState.style.display = 'block';
        } finally {
            if (playlistLoadingBox) playlistLoadingBox.style.display = 'none';
            setLoading(false);
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

        return loadedVideos.filter(v => {
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
    }

    function getTotalPages() {
        const filtered = getFilteredVideos();
        if (!filtered.length || pageSize === 'all') return 1;
        return Math.max(1, Math.ceil(filtered.length / pageSize));
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

        pageVideos.forEach((v) => {
            const isSelected = selectedVideoIds.has(v.videoId);
            const isRemoved = removedVideoIds.has(v.videoId);

            const tr = document.createElement('tr');
            tr.id = `vRow_${v.videoId}`;
            tr.className = `${isSelected ? 'row-selected' : ''} ${!v.isAvailable ? 'row-unavailable' : ''} ${isRemoved ? 'row-removed' : ''}`;
            tr.dataset.videoid = v.videoId;
            tr.dataset.title = (v.title || '').toLowerCase();
            tr.dataset.index = v.originalIndex;
            tr.dataset.available = v.isAvailable ? 'true' : 'false';

            const idxStr = v.originalIndex < 10 ? `#0${v.originalIndex}` : `#${v.originalIndex}`;

            const defaultQualities = ['1080p', '720p', '480p', 'MP3'];
            const chipsHtml = `<div class="quality-chips-row">` + defaultQualities.map(q => {
                const isBest = q === '1080p';
                return `<span class="q-chip ${isBest ? 'q-chip-best' : ''}">${q}</span>`;
            }).join('') + `</div>`;

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
                    <div class="video-thumb-preview">
                        <img src="${v.thumbnailUrl || '/icons/icon48.png'}" alt="Thumb" loading="lazy" onerror="this.src='/icons/icon48.png';" />
                        <span class="thumb-duration-pill">${v.formattedDuration || '00:00'}</span>
                    </div>
                </td>
                <td class="col-meta video-meta-cell">
                    <h4 title="${escapeHtml(v.title)}">${escapeHtml(v.title)}</h4>
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

        selectionCountBadge.textContent = `${selectedCount} selected`;
        txtDownloadSelected.textContent = `Download Selected (${selectedCount})`;
        btnDownloadSelected.disabled = selectedCount === 0;

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

    async function startBatchJob(videoList) {
        hideAlert();

        const quality = qualitySelect.value;
        const format = formatSelect.value;
        const concurrency = parseInt(concurrencySelect.value, 10) || 4;
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
            const resp = await fetch('/api/playlist/download-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            if (!resp.ok || !data.success) {
                showAlert('Batch Start Failed', data.message || 'Could not queue playlist download.');
                return;
            }

            activeJobId = data.jobId;
            currentJobState = { status: 'Running', activeCount: videoList.length, queuedCount: 0 };
            saveActiveJobSession(activeJobId, playlistUrlInput.value.trim(), playlistTitle);
            pushDownloadProtectionHistory();

            queueItemsList.innerHTML = ''; // Fresh clean list for new job
            downloadQueuePanel.style.display = 'block';
            downloadQueuePanel.classList.remove('queue-dock-minimized');
            if (queueRunningNotice) queueRunningNotice.style.display = 'flex';
            const dockBody = downloadQueuePanel.querySelector('.queue-dock-body');
            if (dockBody) dockBody.scrollTop = 0;

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

                if (job.status === 'Completed') {
                    document.title = `✓ (${job.totalVideos}/${job.totalVideos}) Complete — SaveZonix`;
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
        queueItemCountBadge.textContent = `${job.totalVideos} Videos`;
        overallCompletedText.textContent = `${job.completedCount} / ${job.totalVideos} Completed`;
        overallSpeedText.textContent = `${job.overallSpeedMBps || 0} MB/s`;
        overallPercentText.textContent = `${job.overallPercentage || 0}%`;
        overallProgressBar.style.width = `${job.overallPercentage || 0}%`;

        btnRetryAllFailed.style.display = job.failedCount > 0 ? 'inline-block' : 'none';

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

                queueItemsList.appendChild(card);
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
