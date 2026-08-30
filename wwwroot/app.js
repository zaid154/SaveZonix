let streamData = null;
let currentTaskId = null;
let pollInterval = null;

// DOM Elements
const streamUrlInput = document.getElementById('streamUrl');
const btnPaste = document.getElementById('btnPaste');
const btnAnalyze = document.getElementById('btnAnalyze');
const analyzeSpinner = document.getElementById('analyzeSpinner');
const errorBox = document.getElementById('errorBox');
const errorMessage = document.getElementById('errorMessage');

const streamDetails = document.getElementById('streamDetails');
const qualitySelect = document.getElementById('qualitySelect');
const fileNameInput = document.getElementById('fileNameInput');
const threadsRange = document.getElementById('threadsRange');
const threadsValue = document.getElementById('threadsValue');
const totalChunksBadge = document.getElementById('totalChunksBadge');
const btnStartDownload = document.getElementById('btnStartDownload');

const progressSection = document.getElementById('progressSection');
const progressBarFill = document.getElementById('progressBarFill');
const percentText = document.getElementById('percentText');
const metricSpeed = document.getElementById('metricSpeed');
const metricChunks = document.getElementById('metricChunks');
const metricSize = document.getElementById('metricSize');
const metricEta = document.getElementById('metricEta');
const statusBadge = document.getElementById('statusBadge');

const successSection = document.getElementById('successSection');
const successSummary = document.getElementById('successSummary');
const btnOpenFolder = document.getElementById('btnOpenFolder');
const btnReset = document.getElementById('btnReset');

// Auto-read streamUrl from query parameter
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const paramStreamUrl = urlParams.get('streamUrl');
    if (paramStreamUrl) {
        streamUrlInput.value = decodeURIComponent(paramStreamUrl);
        // Automatically start analyzing the stream!
        setTimeout(() => {
            btnAnalyze.click();
        }, 300);
    }
});

// Paste Button
btnPaste.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            streamUrlInput.value = text.trim();
        }
    } catch {
        showError('Could not access clipboard. Please paste manually.');
    }
});

// Threads Slider
threadsRange.addEventListener('input', (e) => {
    const val = e.target.value;
    threadsValue.textContent = `${val} Workers (${val >= 24 ? 'Extreme Turbo' : 'Recommended'})`;
});

// Analyze Stream
btnAnalyze.addEventListener('click', async () => {
    const url = streamUrlInput.value.trim();
    if (!url) {
        showError('Please enter a valid Stream or Video URL.');
        return;
    }

    hideError();
    setLoading(true);

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to parse stream.');
        }

        streamData = data;
        renderStreamDetails(data);
    } catch (err) {
        showError(err.message);
    } finally {
        setLoading(false);
    }
});

function renderStreamDetails(data) {
    qualitySelect.innerHTML = '';

    if (data.qualities && data.qualities.length > 0) {
        data.qualities.forEach((q, i) => {
            const opt = document.createElement('option');
            opt.value = q.url;
            opt.textContent = q.displayName;
            if (i === 0) opt.selected = true;
            qualitySelect.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.value = streamUrlInput.value.trim();
        opt.textContent = 'Standard Video Stream';
        qualitySelect.appendChild(opt);
    }

    const defaultName = `Zonix_Video_${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)}.mp4`;
    fileNameInput.value = defaultName;
    totalChunksBadge.textContent = `${data.totalSegments || 'Auto'} segments`;

    streamDetails.classList.remove('hidden');
    progressSection.classList.add('hidden');
    successSection.classList.add('hidden');
}

// Start Download
btnStartDownload.addEventListener('click', async () => {
    if (!streamData) return;

    hideError();
    const selectedUrl = qualitySelect.value || streamUrlInput.value.trim();
    const fileName = fileNameInput.value.trim() || 'Zonix_Video.mp4';
    const concurrency = parseInt(threadsRange.value, 10) || 16;

    btnStartDownload.disabled = true;
    streamDetails.classList.add('hidden');
    progressSection.classList.remove('hidden');

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                streamUrl: selectedUrl,
                fileName,
                concurrency
            })
        });

        const data = await response.json();
        if (!response.ok || !data.taskId) {
            throw new Error(data.message || 'Failed to start download.');
        }

        currentTaskId = data.taskId;
        startPollingProgress(currentTaskId);
    } catch (err) {
        showError(err.message);
        btnStartDownload.disabled = false;
        streamDetails.classList.remove('hidden');
        progressSection.classList.add('hidden');
    }
});

function startPollingProgress(taskId) {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/progress/${taskId}`);
            const progress = await res.json();

            if (progress) {
                updateProgressUI(progress);

                if (progress.isCompleted) {
                    clearInterval(pollInterval);
                    handleDownloadCompleted(progress);
                } else if (progress.isError) {
                    clearInterval(pollInterval);
                    showError(progress.errorMessage || 'Download failed.');
                }
            }
        } catch {
            // Ignore temporary polling errors
        }
    }, 400);
}

function updateProgressUI(progress) {
    const percent = Math.min(100, Math.max(0, progress.percentage || 0)).toFixed(1);
    progressBarFill.style.width = `${percent}%`;
    percentText.textContent = `${percent}%`;

    metricSpeed.textContent = `${(progress.speedMBps || 0).toFixed(1)} MB/s`;
    metricChunks.textContent = `${progress.downloadedSegments || 0} / ${progress.totalSegments || 0}`;
    metricSize.textContent = formatBytes(progress.totalBytesDownloaded || 0);
    
    if (progress.estimatedSecondsRemaining > 0) {
        const mins = Math.floor(progress.estimatedSecondsRemaining / 60);
        const secs = Math.floor(progress.estimatedSecondsRemaining % 60);
        metricEta.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } else {
        metricEta.textContent = '--:--';
    }

    if (progress.isMerging) {
        statusBadge.textContent = '🔄 Merging segments into MP4...';
    } else {
        statusBadge.textContent = '⚡ Downloading in Parallel...';
    }
}

function handleDownloadCompleted(progress) {
    progressSection.classList.add('hidden');
    successSection.classList.remove('hidden');
    btnStartDownload.disabled = false;

    successSummary.textContent = `File saved (${formatBytes(progress.totalBytesDownloaded)}). Merged cleanly in ${(progress.mergeSeconds || 1).toFixed(1)}s!`;
}

// Open Folder
btnOpenFolder.addEventListener('click', async () => {
    try {
        await fetch('/api/open-folder', { method: 'POST' });
    } catch {
        alert('Downloads folder located at: Zonix/Downloads');
    }
});

// Reset
btnReset.addEventListener('click', () => {
    successSection.classList.add('hidden');
    streamDetails.classList.add('hidden');
    progressSection.classList.add('hidden');
    streamUrlInput.value = '';
    streamData = null;
    currentTaskId = null;
});

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function setLoading(isLoading) {
    btnAnalyze.disabled = isLoading;
    if (isLoading) {
        analyzeSpinner.classList.remove('hidden');
        btnAnalyze.querySelector('.btn-text').textContent = 'Analyzing...';
    } else {
        analyzeSpinner.classList.add('hidden');
        btnAnalyze.querySelector('.btn-text').textContent = '🔍 Analyze Stream';
    }
}

function showError(msg) {
    errorMessage.textContent = msg;
    errorBox.classList.remove('hidden');
}

function hideError() {
    errorBox.classList.add('hidden');
}
