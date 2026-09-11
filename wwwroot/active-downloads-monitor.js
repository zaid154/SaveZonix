/**
 * active-downloads-monitor.js
 * Multi-Playlist Accordion Active Downloads Monitor for Unified Downloads & History page (/Account/Downloads).
 * Integrates with SaveZonix Multi-Batch API & Task Engine.
 */
(function() {
    'use strict';

    const STORAGE_KEY_ACTIVE_JOB = 'sz_active_playlist_job';
    let pollInterval = null;
    const collapsedJobIds = new Set();
    const renderedJobIds = new Set();
    let isReloadPending = false;

    // DOM Elements
    const activeDownloadsContainer = document.getElementById('activeDownloadsContainer');
    const activeJobsCountBadge = document.getElementById('activeJobsCountBadge');
    const activeGlobalSpeedBadge = document.getElementById('activeGlobalSpeedBadge');
    const btnActiveOpenFolder = document.getElementById('btnActiveOpenFolder');
    const btnActiveCancelAll = document.getElementById('btnActiveCancelAll');
    const activePlaylistsAccordionList = document.getElementById('activePlaylistsAccordionList');

    if (!activeDownloadsContainer || !activePlaylistsAccordionList) return;

    // Initialize Global Header Actions
    if (btnActiveOpenFolder) {
        btnActiveOpenFolder.addEventListener('click', async () => {
            try {
                await fetch('/api/playlist/open-folder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
            } catch { }
        });
    }

    if (btnActiveCancelAll) {
        btnActiveCancelAll.addEventListener('click', async () => {
            if (!confirm('Cancel all running playlist downloads?')) return;
            try {
                btnActiveCancelAll.disabled = true;
                btnActiveCancelAll.textContent = 'Cancelling...';
                const resp = await fetch('/api/playlist/active-jobs');
                if (resp.ok) {
                    const jobs = await resp.json();
                    if (Array.isArray(jobs)) {
                        await Promise.all(jobs.map(j => fetch(`/api/playlist/cancel/${j.jobId}`, { method: 'POST' })));
                    }
                }
                setTimeout(() => {
                    pollActiveJobs();
                    btnActiveCancelAll.disabled = false;
                    btnActiveCancelAll.textContent = '⏹ Cancel All';
                }, 350);
            } catch { 
                btnActiveCancelAll.disabled = false;
                btnActiveCancelAll.textContent = '⏹ Cancel All';
            }
        });
    }

    function startMonitoring() {
        if (pollInterval) clearInterval(pollInterval);
        pollActiveJobs();
        pollInterval = setInterval(pollActiveJobs, 1000);
    }

    async function pollActiveJobs() {
        try {
            const resp = await fetch('/api/playlist/active-jobs');
            if (!resp.ok) return;

            let activeJobs = await resp.json();
            if (!Array.isArray(activeJobs)) activeJobs = [];

            // If active-jobs list is empty, check localStorage fallback for single job
            if (activeJobs.length === 0) {
                const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_JOB);
                if (raw) {
                    try {
                        const session = JSON.parse(raw);
                        if (session && session.jobId) {
                            const singleResp = await fetch(`/api/playlist/status/${session.jobId}`);
                            if (singleResp.ok) {
                                const singleJob = await singleResp.json();
                                if (singleJob && singleJob.status !== 'Completed' && singleJob.status !== 'Cancelled') {
                                    activeJobs = [singleJob];
                                }
                            }
                        }
                    } catch { }
                }
            }

            // Filter truly active or failed jobs that need attention
            const currentActiveJobs = activeJobs.filter(j => {
                const isOngoing = j.status === 'Running' || j.status === 'Downloading' || j.status === 'Queued' ||
                                  (j.activeCount > 0 || j.queuedCount > 0) || (j.failedCount > 0);
                return isOngoing;
            });

            if (currentActiveJobs.length === 0) {
                if (renderedJobIds.size > 0 && !isReloadPending) {
                    isReloadPending = true;
                    setTimeout(() => {
                        window.location.reload();
                    }, 2200);
                } else if (!isReloadPending) {
                    hideActivePanel();
                }
                return;
            }

            renderMultiJobs(currentActiveJobs);

        } catch (err) {
            console.error('[ActiveMonitor] Poll error:', err);
        }
    }

    function renderMultiJobs(jobs) {
        activeDownloadsContainer.style.display = 'block';

        // Calculate global summary across all active playlists
        let globalSpeedSum = 0;
        let totalActiveStreams = 0;
        let totalPendingVideos = 0;

        jobs.forEach(job => {
            totalPendingVideos += ((job.activeCount || 0) + (job.queuedCount || 0));
            if (Array.isArray(job.items)) {
                job.items.forEach(it => {
                    if (it.speedMBps && it.speedMBps > 0) {
                        globalSpeedSum += it.speedMBps;
                        totalActiveStreams++;
                    }
                });
            }
        });

        globalSpeedSum = Math.round(globalSpeedSum * 10) / 10;

        // Update Top Global Header
        if (activeJobsCountBadge) {
            activeJobsCountBadge.textContent = `${jobs.length} Playlist${jobs.length > 1 ? 's' : ''} (${totalPendingVideos} in queue)`;
        }

        if (activeGlobalSpeedBadge) {
            if (globalSpeedSum > 0) {
                activeGlobalSpeedBadge.className = 'active-speed-badge';
                activeGlobalSpeedBadge.innerHTML = `<span class="speed-pulse-icon">⚡</span> Total: ${formatSpeed(globalSpeedSum)} ${totalActiveStreams > 0 ? `<span class="active-streams-label">(${totalActiveStreams} turbo streams)</span>` : ''}`;
            } else {
                activeGlobalSpeedBadge.className = 'active-speed-badge zero-speed';
                activeGlobalSpeedBadge.textContent = '⚡ 0.0 MB/s';
            }
        }

        // Set of job IDs currently active
        const liveJobIds = new Set(jobs.map(j => j.jobId));

        // Remove cards for jobs that are no longer in the list
        renderedJobIds.forEach(id => {
            if (!liveJobIds.has(id)) {
                const el = document.getElementById(`jobCard_${id}`);
                if (el) el.remove();
                renderedJobIds.delete(id);
            }
        });

        // Render or Update each job card
        jobs.forEach((job, index) => {
            renderSingleJobCard(job, index);
        });
    }

    function renderSingleJobCard(job, index) {
        renderedJobIds.add(job.jobId);

        let card = document.getElementById(`jobCard_${job.jobId}`);
        const isCollapsed = collapsedJobIds.has(job.jobId);
        const isDone = job.status === 'Completed';

        // Calculate job-specific live speed and aggregate percentage
        let jobSpeedSum = 0;
        let totalPercentSum = 0;
        let jobActiveStreams = 0;

        if (Array.isArray(job.items) && job.items.length > 0) {
            job.items.forEach(it => {
                if (it.speedMBps && it.speedMBps > 0) {
                    jobSpeedSum += it.speedMBps;
                    jobActiveStreams++;
                }
                totalPercentSum += (it.percentage || 0);
            });
        }

        const effectiveSpeed = (job.overallSpeedMBps && job.overallSpeedMBps > 0)
            ? job.overallSpeedMBps
            : Math.round(jobSpeedSum * 10) / 10;

        const totalVideos = (job.totalVideos || (job.items ? job.items.length : 0)) || 1;
        const aggregatePct = Math.min(100, Math.round(totalPercentSum / totalVideos));
        const effectivePct = Math.max(aggregatePct, Math.round(job.overallPercentage || 0));

        if (!card) {
            // Create New Job Card
            card = document.createElement('div');
            card.id = `jobCard_${job.jobId}`;
            card.className = `playlist-job-card ${isCollapsed ? 'collapsed' : ''} ${isDone ? 'job-completed' : ''}`;
            card.innerHTML = `
                <div class="playlist-job-header" data-jobid="${job.jobId}">
                    <div class="job-header-left">
                        <span class="job-icon">${isDone ? '✅' : '📁'}</span>
                        <div class="job-info-wrap">
                            <h3 class="job-title" title="${escapeHtml(job.playlistTitle || 'YouTube Playlist')}">
                                ${job.playlistCode ? `<span class="pl-code-pill" style="margin-right: 6px;">${escapeHtml(job.playlistCode)}</span>` : ''}${escapeHtml(job.playlistTitle || 'YouTube Playlist')}
                            </h3>
                            <div class="job-meta-line">
                                <span id="jobStatusText_${job.jobId}">
                                    ${job.completedCount || 0} / ${job.totalVideos || 0} Completed
                                </span>
                                ${job.failedCount > 0 ? `<span style="color:#f43f5e;" id="jobFailedText_${job.jobId}">• ${job.failedCount} Failed</span>` : `<span id="jobFailedText_${job.jobId}" style="display:none;"></span>`}
                            </div>
                        </div>
                    </div>
                    <div class="job-header-center">
                        <span class="active-speed-badge ${effectiveSpeed > 0 ? '' : 'zero-speed'}" id="jobSpeedBadge_${job.jobId}">
                            ${effectiveSpeed > 0 ? `<span class="speed-pulse-icon">⚡</span> ${formatSpeed(effectiveSpeed)}` : '0.0 MB/s'}
                        </span>
                        <span class="job-percent-badge" id="jobPercentBadge_${job.jobId}">
                            ${effectivePct}%
                        </span>
                    </div>
                    <div class="job-header-right">
                        <span id="jobRetryAllWrap_${job.jobId}">
                            ${job.failedCount > 0 ? `
                                <button type="button" class="btn-active-ctrl btn-job-retry-all" data-jobid="${job.jobId}" title="Retry all failed videos">
                                    🔄 Retry Failed (${job.failedCount})
                                </button>
                            ` : ''}
                        </span>
                        <button type="button" class="btn-active-ctrl btn-job-folder" data-folder="${escapeHtml(job.outputFolder || '')}" title="Open Folder">
                            📁
                        </button>
                        ${!isDone ? `
                            <button type="button" class="btn-active-ctrl btn-active-cancel btn-job-cancel" data-jobid="${job.jobId}" title="Cancel this playlist">
                                ⏹
                            </button>
                        ` : ''}
                        <button type="button" class="btn-job-toggle" data-jobid="${job.jobId}" title="Toggle items view">
                            <span class="job-toggle-icon">▼</span>
                        </button>
                    </div>
                </div>
                <div class="playlist-job-body" id="jobBody_${job.jobId}">
                    <div class="active-overall-summary">
                        <div class="active-overall-track">
                            <div class="active-overall-fill" id="jobOverallFill_${job.jobId}" style="width: ${effectivePct}%;"></div>
                        </div>
                    </div>
                    <div class="active-items-list" id="jobItemsList_${job.jobId}">
                        <!-- Individual Video Items -->
                    </div>
                </div>
            `;

            // Setup Card Header Toggle Listener
            const headerEl = card.querySelector('.playlist-job-header');
            headerEl.addEventListener('click', (e) => {
                // If user clicked an action button, don't toggle collapse
                if (e.target.closest('.btn-job-folder') || e.target.closest('.btn-job-cancel') || e.target.closest('.btn-job-retry-all')) {
                    return;
                }
                toggleCardCollapse(job.jobId);
            });

            // Setup Retry All Failed Button
            bindRetryAllBtn(card, job.jobId);

            // Setup Folder Button
            const folderBtn = card.querySelector('.btn-job-folder');
            if (folderBtn) {
                folderBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const folder = e.currentTarget.dataset.folder;
                    try {
                        await fetch('/api/playlist/open-folder', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ outputFolder: folder })
                        });
                    } catch { }
                });
            }

            // Setup Cancel Button
            const cancelBtn = card.querySelector('.btn-job-cancel');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Cancel playlist "${job.playlistTitle}"?`)) return;
                    try {
                        cancelBtn.disabled = true;
                        cancelBtn.textContent = '...';
                        await fetch(`/api/playlist/cancel/${job.jobId}`, { method: 'POST' });
                        setTimeout(pollActiveJobs, 300);
                    } catch { }
                });
            }

            activePlaylistsAccordionList.appendChild(card);

        } else {
            // In-place Update Job Card Header
            const retryAllWrap = document.getElementById(`jobRetryAllWrap_${job.jobId}`);
            if (retryAllWrap) {
                if (job.failedCount > 0) {
                    if (!retryAllWrap.querySelector('.btn-job-retry-all')) {
                        retryAllWrap.innerHTML = `
                            <button type="button" class="btn-active-ctrl btn-job-retry-all" data-jobid="${job.jobId}" title="Retry all failed videos">
                                🔄 Retry Failed (${job.failedCount})
                            </button>
                        `;
                        bindRetryAllBtn(retryAllWrap, job.jobId);
                    } else {
                        const existingBtn = retryAllWrap.querySelector('.btn-job-retry-all');
                        if (existingBtn && !existingBtn.disabled) {
                            existingBtn.textContent = `🔄 Retry Failed (${job.failedCount})`;
                        }
                    }
                } else {
                    retryAllWrap.innerHTML = '';
                }
            }

            const statusTextEl = document.getElementById(`jobStatusText_${job.jobId}`);
            if (statusTextEl) {
                statusTextEl.textContent = `${job.completedCount || 0} / ${job.totalVideos || 0} Completed`;
            }

            const failedTextEl = document.getElementById(`jobFailedText_${job.jobId}`);
            if (failedTextEl) {
                if (job.failedCount > 0) {
                    failedTextEl.textContent = `• ${job.failedCount} Failed`;
                    failedTextEl.style.display = 'inline';
                } else {
                    failedTextEl.style.display = 'none';
                }
            }

            const speedBadgeEl = document.getElementById(`jobSpeedBadge_${job.jobId}`);
            if (speedBadgeEl) {
                if (effectiveSpeed > 0) {
                    speedBadgeEl.className = 'active-speed-badge';
                    speedBadgeEl.innerHTML = `<span class="speed-pulse-icon">⚡</span> ${formatSpeed(effectiveSpeed)}`;
                } else {
                    speedBadgeEl.className = 'active-speed-badge zero-speed';
                    speedBadgeEl.textContent = '0.0 MB/s';
                }
            }

            const percentBadgeEl = document.getElementById(`jobPercentBadge_${job.jobId}`);
            if (percentBadgeEl) {
                percentBadgeEl.textContent = `${effectivePct}%`;
            }

            const fillEl = document.getElementById(`jobOverallFill_${job.jobId}`);
            if (fillEl) {
                fillEl.style.width = `${effectivePct}%`;
            }

            if (isDone) {
                card.classList.add('job-completed');
                const cancelBtn = card.querySelector('.btn-job-cancel');
                if (cancelBtn) cancelBtn.remove();
            }
        }

        // Render & Update Video Rows for this Job Card
        renderJobVideoItems(job);
    }

    function toggleCardCollapse(jobId) {
        const card = document.getElementById(`jobCard_${jobId}`);
        if (!card) return;

        if (collapsedJobIds.has(jobId)) {
            collapsedJobIds.delete(jobId);
            card.classList.remove('collapsed');
        } else {
            collapsedJobIds.add(jobId);
            card.classList.add('collapsed');
        }
    }

    function renderJobVideoItems(job) {
        const listContainer = document.getElementById(`jobItemsList_${job.jobId}`);
        if (!listContainer) return;

        const sortedItems = [...(job.items || [])].sort((a, b) => a.index - b.index);

        sortedItems.forEach(item => {
            const rowId = `activeRow_${job.jobId}_${item.videoId}`;
            let row = document.getElementById(rowId);

            const isDone = item.status === 'Completed';
            const isFailed = item.status === 'Failed' || item.status === 'Cancelled';
            const isBusy = !isDone && !isFailed && item.status !== 'Pending';

            let speedText = item.speedMBps > 0 ? formatSpeed(item.speedMBps) : '';
            let sizeText = '';
            if (item.bytesDownloaded > 0) {
                const mb = (item.bytesDownloaded / (1024 * 1024)).toFixed(1);
                sizeText = `${mb} MB`;
            }

            let fillCls = '';
            if (isDone) fillCls = 'fill-done';
            else if (isFailed) fillCls = 'fill-failed';

            const itemPct = Math.round(item.percentage || 0);
            const indexStr = item.index < 10 ? `0${item.index}` : `${item.index}`;
            const displaySubId = item.subId || (job.playlistCode ? `${job.playlistCode} #${indexStr}` : `#${indexStr}`);
            const thumb = item.thumbnailUrl || '/icons/icon48.png';
            const title = item.title || `Video #${indexStr}`;

            if (!row) {
                row = document.createElement('div');
                row.id = rowId;
                row.className = 'active-item-row';
                row.innerHTML = `
                    <span class="active-item-index pl-sub-id-badge" title="${escapeHtml(displaySubId)}">${escapeHtml(displaySubId)}</span>
                    <img src="${thumb}" alt="Thumb" class="active-item-thumb" onerror="this.src='/icons/icon48.png';" />
                    <div class="active-item-details">
                        <div class="active-item-title-wrap">
                            <span class="active-item-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
                            <span class="active-item-status-tag ${isBusy ? 'status-turbo' : ''}" id="status_${job.jobId}_${item.videoId}">${isBusy && item.status.includes('Turbo') ? '⚡ ' : ''}${escapeHtml(item.status)}</span>
                        </div>
                        ${isFailed && item.errorMessage ? `<div class="active-item-error-callout" id="err_${job.jobId}_${item.videoId}" style="color: #f43f5e; font-size: 11px; margin-top: 2px;">⚠️ ${escapeHtml(item.errorMessage)}</div>` : `<div class="active-item-error-callout" id="err_${job.jobId}_${item.videoId}" style="display:none; color: #f43f5e; font-size: 11px; margin-top: 2px;"></div>`}
                        <div class="active-item-track">
                            <div class="active-item-fill ${fillCls}" id="fill_${job.jobId}_${item.videoId}" style="width:${itemPct}%;"></div>
                        </div>
                        <div class="active-item-meta">
                            <span id="meta_${job.jobId}_${item.videoId}">${itemPct}% ${sizeText ? `• ${sizeText}` : ''}</span>
                            <span id="speed_${job.jobId}_${item.videoId}" class="active-speed-text ${speedText ? 'speed-active' : ''}">${speedText}</span>
                        </div>
                    </div>
                    <div class="active-item-controls" id="controls_${job.jobId}_${item.videoId}">
                        ${isFailed ? `
                            <button type="button" class="btn-item-action-sm btn-item-retry" data-videoid="${item.videoId}" title="Retry">🔄 Retry</button>
                        ` : ''}
                        ${isBusy || item.status === 'Pending' ? `
                            <button type="button" class="btn-item-action-sm btn-item-cancel" data-videoid="${item.videoId}" title="Cancel">✕</button>
                        ` : ''}
                        ${isDone ? `<span style="color:#10b981; font-weight:800; font-size:15px; margin-right:4px;">✓</span>` : ''}
                    </div>
                `;

                // Control Event Listeners
                const retryBtn = row.querySelector('.btn-item-retry');
                if (retryBtn) {
                    retryBtn.addEventListener('click', async (e) => {
                        const vid = e.currentTarget.dataset.videoid;
                        await fetch('/api/playlist/retry-item', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ jobId: job.jobId, videoId: vid })
                        });
                        pollActiveJobs();
                    });
                }

                const cancelBtn = row.querySelector('.btn-item-cancel');
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const vid = e.currentTarget.dataset.videoid;
                        cancelBtn.disabled = true;
                        cancelBtn.textContent = '...';
                        const statusTag = document.getElementById(`status_${job.jobId}_${vid}`);
                        if (statusTag) {
                            statusTag.textContent = 'Cancelled';
                            statusTag.style.color = '#94a3b8';
                        }
                        await fetch('/api/playlist/cancel-item', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ jobId: job.jobId, videoId: vid })
                        });
                        setTimeout(pollActiveJobs, 300);
                    });
                }

                listContainer.appendChild(row);
            } else {
                // In-place Update Existing Row
                const statusEl = document.getElementById(`status_${job.jobId}_${item.videoId}`);
                if (statusEl) {
                    const isTurbo = isBusy && item.status && item.status.includes('Turbo');
                    statusEl.textContent = (isTurbo ? '⚡ ' : '') + item.status;
                    statusEl.className = `active-item-status-tag ${isTurbo ? 'status-turbo' : ''}`;
                    statusEl.style.color = isDone ? '#10b981' : isFailed ? '#f43f5e' : isTurbo ? '#38bdf8' : '#94a3b8';
                }

                const errEl = document.getElementById(`err_${job.jobId}_${item.videoId}`);
                if (errEl) {
                    if (isFailed && item.errorMessage) {
                        errEl.textContent = `⚠️ ${item.errorMessage}`;
                        errEl.style.display = 'block';
                    } else {
                        errEl.style.display = 'none';
                    }
                }

                const fillEl = document.getElementById(`fill_${job.jobId}_${item.videoId}`);
                if (fillEl) {
                    fillEl.className = `active-item-fill ${fillCls}`;
                    fillEl.style.width = `${itemPct}%`;
                }

                const metaEl = document.getElementById(`meta_${job.jobId}_${item.videoId}`);
                if (metaEl) {
                    metaEl.textContent = `${itemPct}% ${sizeText ? `• ${sizeText}` : ''}`;
                }

                const speedEl = document.getElementById(`speed_${job.jobId}_${item.videoId}`);
                if (speedEl) {
                    speedEl.textContent = item.speedMBps > 0 ? formatSpeed(item.speedMBps) : '';
                    speedEl.className = `active-speed-text ${item.speedMBps > 0 ? 'speed-active' : ''}`;
                }

                const controlsEl = document.getElementById(`controls_${job.jobId}_${item.videoId}`);
                if (controlsEl) {
                    if (isDone && !controlsEl.querySelector('span')) {
                        controlsEl.innerHTML = `<span style="color:#10b981; font-weight:800; font-size:15px; margin-right:4px;">✓</span>`;
                    } else if (isFailed && !controlsEl.querySelector('.btn-item-retry')) {
                        controlsEl.innerHTML = `<button type="button" class="btn-item-action-sm btn-item-retry" data-videoid="${item.videoId}" title="Retry">🔄 Retry</button>`;
                        controlsEl.querySelector('.btn-item-retry')?.addEventListener('click', async (e) => {
                            const vid = e.currentTarget.dataset.videoid;
                            await fetch('/api/playlist/retry-item', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ jobId: job.jobId, videoId: vid })
                            });
                            pollActiveJobs();
                        });
                    }
                }
            }
        });
    }

    function hideActivePanel() {
        if (activeDownloadsContainer) activeDownloadsContainer.style.display = 'none';
    }

    function bindRetryAllBtn(parent, jobId) {
        const btn = parent.querySelector('.btn-job-retry-all');
        if (btn) {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                btn.disabled = true;
                btn.innerHTML = '⏳ Retrying...';
                try {
                    await fetch(`/api/playlist/retry-all-failed/${jobId}`, { method: 'POST' });
                    setTimeout(pollActiveJobs, 500);
                } catch {
                    btn.disabled = false;
                    btn.innerHTML = '🔄 Retry Failed';
                }
            });
        }
    }

    function formatSpeed(mbps) {
        if (!mbps || mbps <= 0) return '0.0 MB/s';
        if (mbps >= 1000) return `${(mbps / 1024).toFixed(1)} GB/s`;
        return `${mbps.toFixed(1)} MB/s`;
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

    // Run Monitoring on Page Load
    startMonitoring();
})();
