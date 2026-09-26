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
    const renderedSingleTaskIds = new Set();
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
            if (!confirm('Cancel all running downloads?')) return;
            try {
                btnActiveCancelAll.disabled = true;
                btnActiveCancelAll.textContent = 'Cancelling...';

                // Call global cancel-all endpoint
                await fetch('/api/downloads/cancel-all', { method: 'POST' });

                // Also cancel any playlist jobs
                try {
                    const resp = await fetch('/api/playlist/active-jobs');
                    if (resp.ok) {
                        const jobs = await resp.json();
                        if (Array.isArray(jobs)) {
                            await Promise.all(jobs.map(j => fetch(`/api/playlist/cancel/${j.jobId}`, { method: 'POST' })));
                        }
                    }
                } catch { }

                // Immediate UI feedback: update visible progress bars to Cancelled
                document.querySelectorAll('.active-dl-card').forEach(card => {
                    const statusBadge = card.querySelector('.active-dl-status');
                    if (statusBadge) {
                        statusBadge.className = 'active-dl-status status-failed';
                        statusBadge.textContent = 'Cancelled';
                    }
                });

                setTimeout(() => {
                    pollActiveJobs();
                    btnActiveCancelAll.disabled = false;
                    btnActiveCancelAll.textContent = '⏹ Cancel All';
                }, 300);
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

    // Global Single Download Cancellation
    window.cancelSingleActiveTask = async function(taskId) {
        if (!confirm('Cancel this download?')) return;
        try {
            await fetch(`/api/cancel/${taskId}`, { method: 'POST' });
            const card = document.getElementById(`singleTaskCard_${taskId}`);
            if (card) card.remove();
            renderedSingleTaskIds.delete(taskId);
            pollActiveJobs();
        } catch { }
    };

    async function pollActiveJobs() {
        try {
            let activeJobs = [];
            let singleTasks = [];

            try {
                const resp = await fetch('/api/downloads/active-all');
                if (resp.ok) {
                    const data = await resp.json();
                    activeJobs = Array.isArray(data.playlistJobs) ? data.playlistJobs : [];
                    singleTasks = Array.isArray(data.singleDownloads) ? data.singleDownloads : [];
                }
            } catch {
                try {
                    const resp = await fetch('/api/playlist/active-jobs');
                    if (resp.ok) {
                        activeJobs = await resp.json();
                    }
                } catch { }
            }

            if (!Array.isArray(activeJobs)) activeJobs = [];
            if (!Array.isArray(singleTasks)) singleTasks = [];

            // If active-jobs list is empty, check localStorage fallback for single playlist job
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

            // Filter only truly active jobs that are currently running or queued
            const currentActiveJobs = activeJobs.filter(j => {
                const hasPendingWork = (j.activeCount > 0 || j.queuedCount > 0);
                const isOngoing = (j.status === 'Running' || j.status === 'Downloading' || j.status === 'Queued' || j.status === 'Pending') && !j.endTime;
                return hasPendingWork || isOngoing;
            });

            // Filter truly active single downloads
            const currentSingleTasks = singleTasks.filter(t => !t.isCompleted && !t.isError && !t.isPaused);

            if (currentActiveJobs.length === 0 && currentSingleTasks.length === 0) {
                if ((renderedJobIds.size > 0 || renderedSingleTaskIds.size > 0) && !isReloadPending) {
                    isReloadPending = true;
                    setTimeout(() => {
                        window.location.reload();
                    }, 2200);
                } else if (!isReloadPending) {
                    hideActivePanel();
                }
                return;
            }

            renderMultiJobs(currentActiveJobs, currentSingleTasks);

        } catch (err) {
            console.error('[ActiveMonitor] Poll error:', err);
        }
    }

    function renderMultiJobs(jobs, singleTasks = []) {
        activeDownloadsContainer.style.display = 'block';

        // Calculate global summary across all active playlists and single downloads
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

        singleTasks.forEach(t => {
            if (t.speedMBps && t.speedMBps > 0) {
                globalSpeedSum += t.speedMBps;
            }
            if (t.activeThreads && t.activeThreads > 0) {
                totalActiveStreams += t.activeThreads;
            }
        });

        globalSpeedSum = Math.round(globalSpeedSum * 10) / 10;

        // Update Top Global Header
        if (activeJobsCountBadge) {
            if (jobs.length > 0 && singleTasks.length > 0) {
                activeJobsCountBadge.textContent = `${jobs.length} Playlist(s), ${singleTasks.length} Stream(s)`;
            } else if (jobs.length > 0) {
                activeJobsCountBadge.textContent = `${jobs.length} Playlist${jobs.length > 1 ? 's' : ''} (${totalPendingVideos} in queue)`;
            } else {
                activeJobsCountBadge.textContent = `${singleTasks.length} Active Download${singleTasks.length > 1 ? 's' : ''}`;
            }
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

        // 1. Manage Single Download Cards
        const liveSingleIds = new Set(singleTasks.map(t => t.taskId));
        renderedSingleTaskIds.forEach(id => {
            if (!liveSingleIds.has(id)) {
                const el = document.getElementById(`singleTaskCard_${id}`);
                if (el) el.remove();
                renderedSingleTaskIds.delete(id);
            }
        });

        singleTasks.forEach(task => {
            renderSingleTaskCard(task);
        });

        // 2. Manage Playlist Job Cards
        const liveJobIds = new Set(jobs.map(j => j.jobId));
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

            // Also synchronize matching history table rows below strictly by JobId
            try {
                const rows = document.querySelectorAll('.history-pl-group-row');
                rows.forEach(row => {
                    const rowJobId = row.getAttribute('data-job-id');
                    if (rowJobId && rowJobId === job.jobId) {
                        const countEl = row.querySelector('.file-name-sub .file-text');
                        if (countEl) {
                            countEl.textContent = `${job.completedCount} of ${job.totalVideos} completed`;
                        }
                    }
                });
            } catch { }
        });
    }

    function renderSingleTaskCard(task) {
        renderedSingleTaskIds.add(task.taskId);

        let card = document.getElementById(`singleTaskCard_${task.taskId}`);
        const pct = Math.min(100, Math.max(0, Math.round(task.percentage || 0)));
        const speed = task.speedMBps || 0;
        const title = task.title || task.fileName || 'Active Download';
        const threads = task.activeThreads || task.concurrency || 16;
        const downloadedBytes = task.totalBytesDownloaded || 0;
        const estBytes = task.estimatedTotalBytes || 0;
        const statusText = task.status || (task.isMerging ? 'Merging Audio & Video...' : 'Downloading in Parallel...');

        if (!card) {
            card = document.createElement('div');
            card.id = `singleTaskCard_${task.taskId}`;
            card.className = 'single-task-active-card playlist-job-card';
            card.style.marginBottom = '12px';
            card.innerHTML = `
                <div class="playlist-job-header" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px;">
                    <div class="job-header-left" style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
                        <div class="media-thumb-container" style="width: 44px; height: 44px; min-width: 44px; border-radius: 8px; overflow: hidden; background: #1e293b; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            ${task.thumbnailUrl ? `<img src="${escapeHtml(task.thumbnailUrl)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'font-size:20px;\\'>🎬</span>';" />` : `<span style="font-size: 20px;">🎬</span>`}
                        </div>
                        <div class="job-info-wrap" style="min-width: 0; flex: 1;">
                            <h3 class="job-title" title="${escapeHtml(title)}" style="font-size: 13.5px; font-weight: 700; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0 0 4px 0;">
                                <span class="pl-code-pill" style="margin-right: 6px; background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.3); font-size: 10.5px; padding: 1px 6px; border-radius: 4px;">STREAM</span>${escapeHtml(title)}
                            </h3>
                            <div class="job-meta-line" style="display: flex; gap: 8px; align-items: center; font-size: 11.5px; color: #94a3b8; flex-wrap: wrap;">
                                <span id="stPct_${task.taskId}" style="color: #38bdf8; font-weight: 700;">${pct}%</span>
                                <span>•</span>
                                <span id="stBytes_${task.taskId}">${formatBytes(downloadedBytes)} ${estBytes > 0 ? '/ ' + formatBytes(estBytes) : ''}</span>
                                <span>•</span>
                                <span>${threads} workers</span>
                                <span id="stStatus_${task.taskId}" style="color: #a5f3fc;">• ${escapeHtml(statusText)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="job-header-center" style="margin: 0 16px;">
                        <span class="active-speed-badge ${speed > 0 ? '' : 'zero-speed'}" id="stSpeed_${task.taskId}">
                            ⚡ ${formatSpeed(speed)}
                        </span>
                    </div>
                    <div class="job-header-actions" style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                        <button type="button" class="btn-job-action btn-job-cancel" onclick="cancelSingleActiveTask('${task.taskId}')" title="Cancel this download">
                            Cancel
                        </button>
                    </div>
                </div>
                <div class="job-progress-bar-wrap" style="padding: 0 18px 14px 18px;">
                    <div class="job-progress-track" style="height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 999px; overflow: hidden; position: relative;">
                        <div class="job-progress-fill" id="stFill_${task.taskId}" style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #0ea5e9, #38bdf8); transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
            activePlaylistsAccordionList.prepend(card);
        } else {
            const pctEl = document.getElementById(`stPct_${task.taskId}`);
            if (pctEl) pctEl.textContent = `${pct}%`;

            const bytesEl = document.getElementById(`stBytes_${task.taskId}`);
            if (bytesEl) bytesEl.textContent = `${formatBytes(downloadedBytes)} ${estBytes > 0 ? '/ ' + formatBytes(estBytes) : ''}`;

            const statusEl = document.getElementById(`stStatus_${task.taskId}`);
            if (statusEl) statusEl.textContent = `• ${statusText}`;

            const speedEl = document.getElementById(`stSpeed_${task.taskId}`);
            if (speedEl) {
                speedEl.className = `active-speed-badge ${speed > 0 ? '' : 'zero-speed'}`;
                speedEl.textContent = `⚡ ${formatSpeed(speed)}`;
            }

            const fillEl = document.getElementById(`stFill_${task.taskId}`);
            if (fillEl) fillEl.style.width = `${pct}%`;
        }
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
                        <div class="job-info-wrap">
                            <h3 class="job-title" title="${escapeHtml(job.playlistTitle || 'YouTube Playlist')}">
                                ${job.playlistCode ? `<span class="pl-code-pill" style="margin-right: 6px;">${escapeHtml(job.playlistCode)}</span>` : ''}${escapeHtml(job.playlistTitle || 'YouTube Playlist')}
                            </h3>
                            <div class="job-meta-line">
                                <span id="jobStatusText_${job.jobId}">
                                    ${job.completedCount || 0} / ${job.totalVideos || 0} Completed
                                </span>
                                ${job.failedCount > 0 ? `<span style="color:#f43f5e;" id="jobFailedText_${job.jobId}">• ${job.failedCount} Failed</span>` : `<span id="jobFailedText_${job.jobId}" style="display:none;"></span>`}
                                <span id="jobTiming_${job.jobId}" class="job-timing-info" style="color: #94a3b8; font-size: 11.5px; margin-left: 6px;"></span>
                            </div>
                        </div>
                    </div>
                    <div class="job-header-center">
                        <span class="active-speed-badge ${effectiveSpeed > 0 ? '' : 'zero-speed'}" id="jobSpeedBadge_${job.jobId}">
                            ${effectiveSpeed > 0 ? `${formatSpeed(effectiveSpeed)}${job.peakSpeedMBps > 0 ? ` <span style="font-size:10.5px; opacity:0.8; margin-left:4px;">(Peak: ${formatSpeed(job.peakSpeedMBps)})</span>` : ''}` : (job.peakSpeedMBps > 0 ? `Peak: ${formatSpeed(job.peakSpeedMBps)}` : '0.0 MB/s')}
                        </span>
                        <span class="job-percent-badge" id="jobPercentBadge_${job.jobId}">
                            ${effectivePct}%
                        </span>
                    </div>
                    <div class="job-header-right">
                        <span id="jobRetryAllWrap_${job.jobId}">
                            ${job.failedCount > 0 ? `
                                <button type="button" class="btn-active-ctrl btn-job-retry-all" data-jobid="${job.jobId}" title="Retry all failed videos">
                                    Retry Failed (${job.failedCount})
                                </button>
                            ` : ''}
                        </span>
                        <button type="button" class="btn-active-ctrl btn-job-folder" data-folder="${escapeHtml(job.outputFolder || '')}" title="Open Folder">
                            Open
                        </button>
                        ${!isDone ? `
                            <button type="button" class="btn-active-ctrl btn-active-cancel btn-job-cancel" data-jobid="${job.jobId}" title="Cancel this playlist">
                                Cancel
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

            const jobTimingEl = document.getElementById(`jobTiming_${job.jobId}`);
            if (jobTimingEl) {
                const jStart = formatTimeStr(job.startTime);
                const jEnd = formatTimeStr(job.endTime);
                if (jStart) {
                    jobTimingEl.textContent = `• Started ${jStart}${jEnd ? ` — Finished ${jEnd}` : ''}`;
                } else {
                    jobTimingEl.textContent = '';
                }
            }

            const speedBadgeEl = document.getElementById(`jobSpeedBadge_${job.jobId}`);
            if (speedBadgeEl) {
                if (effectiveSpeed > 0) {
                    speedBadgeEl.className = 'active-speed-badge';
                    speedBadgeEl.innerHTML = `${formatSpeed(effectiveSpeed)}${job.peakSpeedMBps > 0 ? ` <span style="font-size:10.5px; opacity:0.8; margin-left:4px;">(Peak: ${formatSpeed(job.peakSpeedMBps)})</span>` : ''}`;
                } else {
                    speedBadgeEl.className = 'active-speed-badge zero-speed';
                    speedBadgeEl.textContent = job.peakSpeedMBps > 0 ? `Peak: ${formatSpeed(job.peakSpeedMBps)}` : '0.0 MB/s';
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
                            <span id="telem_${job.jobId}_${item.videoId}" class="active-item-telem" style="font-size: 11px; color: #94a3b8; margin: 0 8px;">${escapeHtml(formatTelemetryInfo(item))}</span>
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

                const telemEl = document.getElementById(`telem_${job.jobId}_${item.videoId}`);
                if (telemEl) {
                    telemEl.textContent = formatTelemetryInfo(item);
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

    function formatTimeStr(isoString) {
        if (!isoString) return '';
        try {
            const d = new Date(isoString);
            return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        } catch { return ''; }
    }

    function formatTelemetryInfo(item) {
        const startStr = formatTimeStr(item.startTime);
        const endStr = formatTimeStr(item.endTime);
        const isDone = item.status === 'Completed';
        const isFailed = item.status === 'Failed' || item.status === 'Cancelled';
        const peakStr = item.peakSpeedMBps > 0 ? `Peak: ${formatSpeed(item.peakSpeedMBps)}` : '';
        const avgStr = item.averageSpeedMBps > 0 ? `Avg: ${formatSpeed(item.averageSpeedMBps)}` : '';

        if (isDone) {
            const dur = item.durationSecondsTaken > 0 ? `${item.durationSecondsTaken}s` : '';
            return `${startStr ? 'Started ' + startStr : ''} ${endStr ? '— Completed ' + endStr : ''} ${dur ? `(${dur})` : ''} ${avgStr ? `• ${avgStr}` : ''} ${peakStr ? `• ${peakStr}` : ''}`.trim();
        }
        if (isFailed) {
            return `${startStr ? `Started: ${startStr}` : ''} ${endStr ? `• Stopped: ${endStr}` : ''}`.trim();
        }
        if (startStr) {
            return `Started: ${startStr} ${peakStr ? `• ${peakStr}` : ''}`.trim();
        }
        return '';
    }

    function formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
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
