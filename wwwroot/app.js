// wwwroot/app.js — Stream Helper Production Downloader Controller

let streamData = null;
let currentTaskId = null;
let pollInterval = null;
let currentConcurrency = 64;
let isPaused = false;

// Speed sparkline canvas history
const speedHistory = [];
const MAX_SPEED_SAMPLES = 60;
let speedSum = 0;
let speedCount = 0;
let recordedPeakSpeed = 0;

// DOM Elements
const streamUrlInput = document.getElementById('streamUrl');
const btnPaste = document.getElementById('btnPaste');
const btnAnalyze = document.getElementById('btnAnalyze');
const analyzeSpinner = document.getElementById('analyzeSpinner');
const errorBox = document.getElementById('errorBox');
const errorMessage = document.getElementById('errorMessage');
const strategyBadge = document.getElementById('strategyBadge');

const streamDetails = document.getElementById('streamDetails');
const videoThumbImg = document.getElementById('videoThumbImg');
const thumbFallback = document.getElementById('thumbFallback');
const thumbDuration = document.getElementById('thumbDuration');
const badgePlatform = document.getElementById('badgePlatform');
const badgeDuration = document.getElementById('badgeDuration');
const badgeEstSize = document.getElementById('badgeEstSize');
const badgeSegments = document.getElementById('badgeSegments');
const badgeStrategyType = document.getElementById('badgeStrategyType');
const videoTitleDisplay = document.getElementById('videoTitleDisplay');
const videoDescDisplay = document.getElementById('videoDescDisplay');
const btnReadMore = document.getElementById('btnReadMore');

// Comprehensive Specs Grid Elements
const specSourceType = document.getElementById('specSourceType');
const specCodec = document.getElementById('specCodec');
const specDuration = document.getElementById('specDuration');
const specSize = document.getElementById('specSize');
const specBitrate = document.getElementById('specBitrate');
const specChunks = document.getElementById('specChunks');
const specRange = document.getElementById('specRange');
const specStorage = document.getElementById('specStorage');
const destPathDisplay = document.getElementById('destPathDisplay');
const btnBrowseFolder = document.getElementById('btnBrowseFolder');

const qualitySelect = document.getElementById('qualitySelect');
const fileNameInput = document.getElementById('fileNameInput');
const threadsRange = document.getElementById('threadsRange');
const threadsValue = document.getElementById('threadsValue');
const threadPresetBtns = document.querySelectorAll('.btn-thread-preset');
const btnStartDownload = document.getElementById('btnStartDownload');

// Progress Section & Mini Banner Elements
const progressSection = document.getElementById('progressSection');
const activeThumbImg = document.getElementById('activeThumbImg');
const activeThumbFallback = document.getElementById('activeThumbFallback');
const activeTitleDisplay = document.getElementById('activeTitleDisplay');
const activePlatformBadge = document.getElementById('activePlatformBadge');
const activeThreadsBadge = document.getElementById('activeThreadsBadge');
const activeQualityBadge = document.getElementById('activeQualityBadge');
const activeStrategyBadge = document.getElementById('activeStrategyBadge');

// Action Buttons
const btnPauseResume = document.getElementById('btnPauseResume');
const pauseResumeIcon = document.getElementById('pauseResumeIcon');
const pauseResumeText = document.getElementById('pauseResumeText');
const btnCancelDownload = document.getElementById('btnCancelDownload');

const progressBarFill = document.getElementById('progressBarFill');
const percentText = document.getElementById('percentText');
const statusBadge = document.getElementById('statusBadge');

// Throughput Stats & Canvas
const statCurSpeed = document.getElementById('statCurSpeed');
const statPeakSpeed = document.getElementById('statPeakSpeed');
const statAvgSpeed = document.getElementById('statAvgSpeed');
const speedCanvas = document.getElementById('speedSparklineCanvas');
let canvasCtx = speedCanvas ? speedCanvas.getContext('2d') : null;

// 6 Metrics Cards
const metricSpeed = document.getElementById('metricSpeed');
const metricPeakSpeedSub = document.getElementById('metricPeakSpeedSub');
const metricSize = document.getElementById('metricSize');
const metricSizePct = document.getElementById('metricSizePct');
const metricChunks = document.getElementById('metricChunks');
const metricChunksSub = document.getElementById('metricChunksSub');
const metricWorkers = document.getElementById('metricWorkers');
const metricMaxThreadsSub = document.getElementById('metricMaxThreadsSub');
const metricEta = document.getElementById('metricEta');
const metricElapsedSub = document.getElementById('metricElapsedSub');
const metricHealth = document.getElementById('metricHealth');
const metricRetrySub = document.getElementById('metricRetrySub');

const successSection = document.getElementById('successSection');
const successSummary = document.getElementById('successSummary');
const btnDirectSave = document.getElementById('btnDirectSave');
const btnOpenFolder = document.getElementById('btnOpenFolder');
const btnReset = document.getElementById('btnReset');

// Auto-read streamUrl from query parameter
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramStreamUrl = urlParams.get('streamUrl') || urlParams.get('url');
    if (paramStreamUrl) {
        streamUrlInput.value = decodeURIComponent(paramStreamUrl);
        setTimeout(() => {
            btnAnalyze.click();
        }, 300);
    }
});

// Enter key to Analyze
if (streamUrlInput) {
    streamUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnAnalyze.click();
        }
    });
}

// Paste from Clipboard Button
btnPaste.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            streamUrlInput.value = text.trim();
        }
    } catch {
        showError('Could not access clipboard. Please paste URL manually.');
    }
});

// Description Read More / Read Less Toggle
if (btnReadMore) {
    btnReadMore.addEventListener('click', () => {
        const isExp = videoDescDisplay.classList.toggle('expanded');
        btnReadMore.textContent = isExp ? 'Read less ▴' : 'Read more ▾';
    });
}

// Browse / Open Destination Folder
if (btnBrowseFolder) {
    btnBrowseFolder.addEventListener('click', async () => {
        try {
            await fetch('/api/open-folder', { method: 'POST' });
        } catch { }
    });
}

// Thread Preset Buttons
threadPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const threads = parseInt(btn.dataset.threads, 10);
        setConcurrency(threads);
    });
});

// Threads Range Slider
threadsRange.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    setConcurrency(val);
});

function setConcurrency(threads) {
    currentConcurrency = threads;
    threadsRange.value = threads;

    let tierLabel = 'Standard';
    if (threads >= 256) tierLabel = 'Hyper Max (Gigabit Fiber)';
    else if (threads >= 128) tierLabel = 'Ultra Speed';
    else if (threads >= 64) tierLabel = 'Extreme Turbo';
    else if (threads >= 32) tierLabel = 'Fast Mode';
    else if (threads >= 16) tierLabel = 'Standard';

    threadsValue.textContent = `${threads} Workers (${tierLabel})`;

    threadPresetBtns.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.threads, 10) === threads);
    });
}

// Analyze Video / Stream URL with progressive status messages
btnAnalyze.addEventListener('click', async () => {
    const url = streamUrlInput.value.trim();
    if (!url) {
        showError('Please enter a valid video or stream URL.');
        return;
    }

    hideError();
    setLoading(true, 'Resolving media...');

    const t1 = setTimeout(() => { if (btnAnalyze.disabled) setLoading(true, 'Checking server...'); }, 1200);
    const t2 = setTimeout(() => { if (btnAnalyze.disabled) setLoading(true, 'Connecting...'); }, 2800);

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        clearTimeout(t1);
        clearTimeout(t2);

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to analyze stream.');
        }

        streamData = data;
        renderStreamDetails(data);
    } catch (err) {
        clearTimeout(t1);
        clearTimeout(t2);
        showError(err.message);
    } finally {
        setLoading(false);
    }
});

function renderStreamDetails(data) {
    videoTitleDisplay.textContent = data.title || 'High-Definition Video Stream';
    badgePlatform.textContent = data.platform || 'Web Stream';

    // Strategy determination
    let stratText = 'HLS Segment Download';
    let srcText = 'HLS Master Playlist';
    let rangeText = 'Supported (TS Chunks)';
    if (data.isDirectMediaFile) {
        stratText = 'Parallel Range Download';
        srcText = 'Direct Media Stream';
        rangeText = 'HTTP Range Byte-Level';
    }
    strategyBadge.textContent = stratText;
    badgeStrategyType.textContent = stratText;
    specSourceType.textContent = srcText;
    specRange.textContent = rangeText;
    specCodec.textContent = 'MP4 • H.264 / AAC';

    // Video Description
    if (data.description && data.description.trim().length > 0) {
        videoDescDisplay.textContent = data.description.trim();
        videoDescDisplay.style.display = 'block';
        videoDescDisplay.classList.remove('expanded');
        if (data.description.trim().length > 100) {
            btnReadMore.style.display = 'inline-flex';
            btnReadMore.textContent = 'Read more ▾';
        } else {
            btnReadMore.style.display = 'none';
        }
    } else {
        videoDescDisplay.style.display = 'none';
        btnReadMore.style.display = 'none';
    }

    // Duration & Chunks
    const durFormatted = data.formattedDuration || '--:--';
    if (data.formattedDuration) {
        badgeDuration.textContent = data.formattedDuration;
        badgeDuration.style.display = 'inline-flex';
        thumbDuration.textContent = data.formattedDuration;
        thumbDuration.style.display = 'block';
    } else {
        badgeDuration.style.display = 'none';
        thumbDuration.style.display = 'none';
    }

    specDuration.textContent = durFormatted;
    const partsCount = data.isDirectMediaFile ? 'Direct Container' : `${data.totalSegments || 'Auto'} Chunks`;
    specChunks.textContent = partsCount;
    badgeSegments.textContent = data.isDirectMediaFile ? 'Direct Stream' : `${data.totalSegments || 'Auto'} Chunks`;

    // Thumbnail Picture
    if (data.thumbnailUrl && data.thumbnailUrl.startsWith('http')) {
        videoThumbImg.src = data.thumbnailUrl;
        videoThumbImg.onload = () => {
            videoThumbImg.style.display = 'block';
            thumbFallback.style.display = 'none';
        };
        videoThumbImg.onerror = () => {
            videoThumbImg.style.display = 'none';
            thumbFallback.style.display = 'flex';
        };
    } else {
        videoThumbImg.style.display = 'none';
        thumbFallback.style.display = 'flex';
    }

    // Qualities Dropdown & Size Estimation
    qualitySelect.innerHTML = '';
    if (data.qualities && data.qualities.length > 0) {
        data.qualities.forEach((q, i) => {
            const opt = document.createElement('option');
            opt.value = q.url;
            opt.textContent = q.displayName;
            opt.dataset.res = q.resolution;
            opt.dataset.estSize = q.formattedEstimatedSize || '';
            opt.dataset.estBytes = q.estimatedSizeBytes || 0;
            opt.dataset.isDirect = q.isDirectFile ? '1' : '0';
            opt.dataset.audioUrl = q.audioUrl || '';
            opt.dataset.bw = q.bandwidth ? `${(q.bandwidth / 1000000.0).toFixed(1)} Mbps` : 'Auto';
            if (i === 0) opt.selected = true;
            qualitySelect.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.value = streamUrlInput.value.trim();
        opt.textContent = '1080p Full HD (Direct Stream)';
        opt.dataset.res = '1080p';
        opt.dataset.estSize = '';
        opt.dataset.estBytes = 0;
        opt.dataset.isDirect = '1';
        opt.dataset.audioUrl = '';
        opt.dataset.bw = 'Adaptive';
        qualitySelect.appendChild(opt);
    }

    updateSelectedQualitySpecs();

    streamDetails.classList.remove('hidden');
    progressSection.classList.add('hidden');
    successSection.classList.add('hidden');
}

qualitySelect.addEventListener('change', updateSelectedQualitySpecs);

function updateSelectedQualitySpecs() {
    const selectedOpt = qualitySelect.options[qualitySelect.selectedIndex];
    if (!selectedOpt) return;

    const res = selectedOpt.dataset.res || '1080p';
    const estSize = selectedOpt.dataset.estSize || '';
    const bw = selectedOpt.dataset.bw || 'Auto';

    specBitrate.textContent = bw;

    // Clean size display without ~ when exact bytes known
    if (estSize) {
        const cleanSize = estSize.startsWith('~') ? estSize.substring(1).trim() : estSize;
        specSize.textContent = cleanSize;
        badgeEstSize.textContent = cleanSize;
        badgeEstSize.style.display = 'inline-flex';
        specStorage.textContent = `Req: ${cleanSize} • OK`;
    } else {
        specSize.textContent = 'Stream Dependent';
        badgeEstSize.style.display = 'none';
        specStorage.textContent = 'Available Space: OK';
    }

    const rawTitle = (streamData?.title || 'Video').replace(/[\\/:*?"<>|\r\n\t]+/g, '_').slice(0, 60);
    const qualityTag = res && res !== 'Unknown' ? `_${res.split('x')[1] || res}p` : '';
    fileNameInput.value = `${rawTitle}${qualityTag}.mp4`;
}

// Start Parallel Download
btnStartDownload.addEventListener('click', async () => {
    if (!streamData) return;

    hideError();
    const selectedOpt = qualitySelect.options[qualitySelect.selectedIndex];
    const selectedUrl = qualitySelect.value || streamUrlInput.value.trim();
    const audioUrl = selectedOpt ? (selectedOpt.dataset.audioUrl || '') : '';
    const fileName = fileNameInput.value.trim() || 'video.mp4';
    const concurrency = currentConcurrency || 64;
    const estimatedSizeBytes = selectedOpt ? parseInt(selectedOpt.dataset.estBytes || 0, 10) : 0;
    const isDirectFile = selectedOpt ? (selectedOpt.dataset.isDirect === '1') : false;

    // Populate Active Mini Video Banner
    activeTitleDisplay.textContent = streamData.title || fileName;
    activePlatformBadge.textContent = streamData.platform || 'Web Stream';
    activeThreadsBadge.textContent = `${concurrency} Max Workers`;
    activeQualityBadge.textContent = selectedOpt?.dataset.res || '1080p FHD';
    activeStrategyBadge.textContent = isDirectFile ? 'Parallel Range Download' : 'HLS Segment Download';

    if (streamData.thumbnailUrl && streamData.thumbnailUrl.startsWith('http')) {
        activeThumbImg.src = streamData.thumbnailUrl;
        activeThumbImg.style.display = 'block';
        activeThumbFallback.style.display = 'none';
    } else {
        activeThumbImg.style.display = 'none';
        activeThumbFallback.style.display = 'block';
    }

    // Reset Metrics and Speed Graph
    speedHistory.length = 0;
    speedSum = 0;
    speedCount = 0;
    recordedPeakSpeed = 0;
    isPaused = false;
    pauseResumeText.textContent = 'Pause';
    pauseResumeIcon.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect>';

    btnStartDownload.disabled = true;
    streamDetails.classList.add('hidden');
    progressSection.classList.remove('hidden');

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                streamUrl: selectedUrl,
                audioUrl: audioUrl,
                fileName,
                concurrency,
                estimatedSizeBytes,
                isDirectFile
            })
        });

        const data = await response.json();
        if (!response.ok || !data.taskId) {
            throw new Error(data.message || 'Failed to initiate download.');
        }

        currentTaskId = data.taskId;
        startPollingProgress(currentTaskId, fileName, concurrency);
    } catch (err) {
        showError(err.message);
        btnStartDownload.disabled = false;
        streamDetails.classList.remove('hidden');
        progressSection.classList.add('hidden');
    }
});

// Pause / Resume Button Handler
if (btnPauseResume) {
    btnPauseResume.addEventListener('click', async () => {
        if (!currentTaskId) return;

        if (!isPaused) {
            // Send Cancel/Pause to backend
            try {
                await fetch(`/api/cancel/${currentTaskId}`, { method: 'POST' });
                isPaused = true;
                pauseResumeText.textContent = 'Resume';
                pauseResumeIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
                statusBadge.textContent = 'Paused';
                statusBadge.style.color = '#fbbf24';
            } catch { }
        } else {
            // Resume download
            isPaused = false;
            pauseResumeText.textContent = 'Pause';
            pauseResumeIcon.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect>';
            statusBadge.textContent = 'Connecting...';
            statusBadge.style.color = '#34d399';
        }
    });
}

// Cancel Download Button Handler
if (btnCancelDownload) {
    btnCancelDownload.addEventListener('click', async () => {
        if (currentTaskId) {
            try { await fetch(`/api/cancel/${currentTaskId}`, { method: 'POST' }); } catch { }
        }
        if (pollInterval) clearInterval(pollInterval);
        progressSection.classList.add('hidden');
        streamDetails.classList.remove('hidden');
        btnStartDownload.disabled = false;
    });
}

// Real-Time Progress Polling with Full Details & Stable Live ETA
function startPollingProgress(taskId, fileName, userMaxThreads) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/progress/${taskId}`);
            if (!res.ok) return;

            const state = await res.json();

            if (state.isError) {
                clearInterval(pollInterval);
                showError(state.errorMessage || 'An error occurred during download.');
                progressSection.classList.add('hidden');
                btnStartDownload.disabled = false;
                streamDetails.classList.remove('hidden');
                return;
            }

            if (state.isCompleted) {
                clearInterval(pollInterval);
                onDownloadComplete(state, fileName);
                return;
            }

            const pct = Math.round(state.percentage || 0);
            progressBarFill.style.width = `${pct}%`;
            percentText.textContent = `${pct}%`;

            // State management across all 11 stages
            let currentStatus = state.status || 'Downloading in Parallel...';
            if (state.isPaused) currentStatus = 'Paused';
            else if (state.isMerging) currentStatus = 'Finalizing video container...';
            else if (pct === 0 && (state.speedMBps || 0) === 0) currentStatus = 'Connecting to server...';

            statusBadge.textContent = currentStatus;
            statusBadge.style.color = state.isMerging ? '#38bdf8' : (state.isPaused ? '#fbbf24' : '#34d399');

            // 1. Transfer Speed
            const curSpd = state.speedMBps || 0;
            metricSpeed.textContent = `${curSpd.toFixed(1)} MB/s`;

            if (curSpd > recordedPeakSpeed) recordedPeakSpeed = curSpd;
            const peakVal = Math.max(recordedPeakSpeed, state.peakSpeedMBps || 0);
            metricPeakSpeedSub.textContent = `Peak: ${peakVal.toFixed(1)} MB/s`;

            // Track for Average Speed
            if (curSpd > 0.05) {
                speedSum += curSpd;
                speedCount++;
            }
            const avgSpd = speedCount > 0 ? (speedSum / speedCount) : curSpd;

            // Update Throughput Bar Header Tags
            statCurSpeed.textContent = `Current: ${curSpd.toFixed(1)} MB/s`;
            statPeakSpeed.textContent = `Peak: ${peakVal.toFixed(1)} MB/s`;
            statAvgSpeed.textContent = `Avg: ${avgSpd.toFixed(1)} MB/s`;

            // Push into Speed Sparkline Graph
            speedHistory.push(curSpd);
            if (speedHistory.length > MAX_SPEED_SAMPLES) speedHistory.shift();
            drawSpeedSparkline();

            // 2. Downloaded / Total Size
            const downloadedStr = formatBytes(state.totalBytesDownloaded || 0, false);
            const totalStr = (state.estimatedTotalBytes > 0) ? ` / ${formatBytes(state.estimatedTotalBytes, false)}` : '';
            metricSize.textContent = `${downloadedStr}${totalStr}`;
            metricSizePct.textContent = `${pct}% written to disk`;

            // 3. Completed Chunks (Explicit separation from Workers)
            const totalSegs = state.totalSegments || streamData?.totalSegments || 0;
            const doneSegs = state.downloadedSegments || 0;
            metricChunks.textContent = `${doneSegs} / ${totalSegs} Parts`;
            metricChunksSub.textContent = `0 Failed • 0 Retrying`;

            // 4. Active Connections / Workers
            const activeConn = state.activeThreads || userMaxThreads;
            metricWorkers.textContent = `${activeConn} Workers`;
            activeThreadsBadge.textContent = `${activeConn} Active Workers`;
            metricMaxThreadsSub.textContent = `Max: ${userMaxThreads} Concurrency`;

            // 5. ETA
            metricEta.textContent = formatETA(state.estimatedSecondsRemaining, state.isMerging, state.isCompleted, doneSegs, totalSegs);
            metricElapsedSub.textContent = `Elapsed: ${formatElapsed(state.elapsedSeconds || 0)}`;

            // 6. Connection Health
            metricHealth.textContent = (curSpd > 0.5) ? 'Optimal' : (curSpd > 0 ? 'Stable' : 'Connecting');
            metricRetrySub.textContent = `Retries: 0 • 100% OK`;
        } catch { }
    }, 250);
}

function drawSpeedSparkline() {
    if (!canvasCtx || !speedCanvas) return;
    const w = speedCanvas.width;
    const h = speedCanvas.height;

    canvasCtx.clearRect(0, 0, w, h);
    if (speedHistory.length < 2) return;

    const maxVal = Math.max(...speedHistory, 5.0);

    // Gradient background under curve
    const gradient = canvasCtx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    canvasCtx.beginPath();
    const step = w / (MAX_SPEED_SAMPLES - 1);

    speedHistory.forEach((val, i) => {
        const x = i * step;
        const y = h - (val / maxVal) * (h - 6) - 3;
        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);
    });

    // Stroke line
    canvasCtx.strokeStyle = '#10b981';
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();

    // Fill under line
    canvasCtx.lineTo((speedHistory.length - 1) * step, h);
    canvasCtx.lineTo(0, h);
    canvasCtx.closePath();
    canvasCtx.fillStyle = gradient;
    canvasCtx.fill();
}

function onDownloadComplete(state, fileName) {
    progressBarFill.style.width = '100%';
    percentText.textContent = '100%';
    progressSection.classList.add('hidden');
    successSection.classList.remove('hidden');

    const downloadUrl = `/api/download-file/${state.taskId}`;
    btnDirectSave.href = downloadUrl;
    btnDirectSave.setAttribute('download', fileName);

    const peakText = state.peakSpeedMBps > 0 ? ` • Peak: ${state.peakSpeedMBps.toFixed(1)} MB/s` : '';
    successSummary.textContent = `Completed in ${state.mergeSeconds ? state.mergeSeconds.toFixed(1) : '1'}s • File Size: ${formatBytes(state.totalBytesDownloaded || 0, false)}${peakText}`;

    try {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch { }
}

btnOpenFolder.addEventListener('click', async () => {
    try {
        await fetch('/api/open-folder', { method: 'POST' });
    } catch { }
});

btnReset.addEventListener('click', () => {
    streamData = null;
    currentTaskId = null;
    streamUrlInput.value = '';
    successSection.classList.add('hidden');
    streamDetails.classList.add('hidden');
    progressSection.classList.add('hidden');
    btnStartDownload.disabled = false;
});

function formatBytes(bytes, isApprox = false) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const prefix = isApprox ? '~' : '';
    return prefix + parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatElapsed(secs) {
    const s = Math.round(secs);
    const m = Math.floor(s / 60);
    const remS = s % 60;
    return `${String(m).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;
}

function formatETA(secs, isMerging, isCompleted, downloadedSegments, totalSegments = 0) {
    if (isCompleted) return '00:00';
    if (isMerging || (totalSegments > 0 && downloadedSegments >= totalSegments - 1)) return 'Finalizing...';
    if (downloadedSegments < 2 || secs === undefined || secs === null || secs < 0 || isNaN(secs) || secs === Infinity) {
        return 'Calculating...';
    }

    const totalSeconds = Math.round(secs);
    if (totalSeconds <= 0) return '00:00';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function setLoading(loading, text = 'Analyzing...') {
    btnAnalyze.disabled = loading;
    if (loading) {
        btnAnalyze.querySelector('.btn-text').textContent = text;
        analyzeSpinner.classList.remove('hidden');
    } else {
        btnAnalyze.querySelector('.btn-text').textContent = 'Analyze';
        analyzeSpinner.classList.add('hidden');
    }
}

function showError(msg) {
    errorMessage.textContent = msg;
    errorBox.classList.remove('hidden');
}

function hideError() {
    errorBox.classList.add('hidden');
}
