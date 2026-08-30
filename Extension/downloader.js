let currentStreamUrl = '';
let masterQualities = [];
let targetSegments = [];

// Elements
const streamUrlDisplay = document.getElementById('streamUrlDisplay');
const qualitySelect = document.getElementById('qualitySelect');
const fileNameInput = document.getElementById('fileNameInput');
const concurrencySlider = document.getElementById('concurrencySlider');
const concurrencyBadge = document.getElementById('concurrencyBadge');
const btnStart = document.getElementById('btnStart');

const configSection = document.getElementById('configSection');
const progressSection = document.getElementById('progressSection');
const progressBarFill = document.getElementById('progressBarFill');
const percentText = document.getElementById('percentText');
const mSpeed = document.getElementById('mSpeed');
const mChunks = document.getElementById('mChunks');
const mSize = document.getElementById('mSize');
const mEta = document.getElementById('mEta');
const statusText = document.getElementById('statusText');

const completeSection = document.getElementById('completeSection');
const completeSummary = document.getElementById('completeSummary');
const btnDownloadAgain = document.getElementById('btnDownloadAgain');
const errorBox = document.getElementById('errorBox');
const errorMsg = document.getElementById('errorMsg');

concurrencySlider.addEventListener('input', (e) => {
    concurrencyBadge.textContent = `${e.target.value} Simultaneous Threads`;
});

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const rawUrl = params.get('url');

    if (!rawUrl) {
        showError('No stream URL provided.');
        return;
    }

    currentStreamUrl = decodeURIComponent(rawUrl);
    streamUrlDisplay.textContent = currentStreamUrl;

    btnStart.disabled = true;
    btnStart.textContent = '⏳ Analyzing Video Stream...';

    await analyzeStream(currentStreamUrl);
});

async function analyzeStream(url) {
    hideError();
    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`HTTP Error ${res.status}: Failed to reach stream server.`);
        }

        const text = await res.text();

        if (text.includes('#EXT-X-STREAM-INF')) {
            // Master Playlist
            masterQualities = parseMasterPlaylist(text, url);
            qualitySelect.innerHTML = '';

            masterQualities.forEach((q, i) => {
                const opt = document.createElement('option');
                opt.value = q.url;
                opt.textContent = q.displayName;
                if (i === 0) opt.selected = true;
                qualitySelect.appendChild(opt);
            });

            btnStart.disabled = false;
            btnStart.textContent = '⚡ START HIGH-SPEED DOWNLOAD';
        } else {
            // Media Playlist
            targetSegments = parseMediaPlaylist(text, url);
            if (targetSegments.length === 0) {
                throw new Error('Playlist contains 0 segments. The stream link might be expired.');
            }

            qualitySelect.innerHTML = `<option value="${url}">HD Stream (${targetSegments.length} Segments)</option>`;
            btnStart.disabled = false;
            btnStart.textContent = `⚡ START HIGH-SPEED DOWNLOAD (${targetSegments.length} Chunks)`;
        }
    } catch (err) {
        showError(err.message);
        btnStart.disabled = false;
        btnStart.textContent = '⚡ Retry Analysis';
    }
}

// Helpers to handle Relay Worker URLs (cinemaos-relay.../?url=...)
function getEffectiveBaseUrl(rawUrl) {
    if (rawUrl.includes('url=')) {
        try {
            const parsed = new URL(rawUrl);
            const nested = parsed.searchParams.get('url');
            if (nested && nested.startsWith('http')) {
                return new URL(nested);
            }
        } catch { }
    }
    return new URL(rawUrl);
}

function resolveSegmentUrl(segmentLine, parentUrl) {
    // If the line is already a full absolute URL
    if (segmentLine.startsWith('http://') || segmentLine.startsWith('https://')) {
        return parentUrl.includes('cinemaos-relay') && !segmentLine.includes('cinemaos-relay')
            ? `https://cinemaos-relay.hxsvpdi.workers.dev/?url=${encodeURIComponent(segmentLine)}`
            : segmentLine;
    }

    // Resolve relative URL against effective base
    const effectiveBase = getEffectiveBaseUrl(parentUrl);
    const resolvedUnderlying = new URL(segmentLine, effectiveBase).href;

    // Route back through relay if parent was relayed
    if (parentUrl.includes('cinemaos-relay')) {
        return `https://cinemaos-relay.hxsvpdi.workers.dev/?url=${encodeURIComponent(resolvedUnderlying)}`;
    }

    return resolvedUnderlying;
}

function parseMasterPlaylist(content, parentUrl) {
    const qualities = [];
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.Length || i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXT-X-STREAM-INF')) {
            let res = 'Video Stream';
            let bw = '';

            const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
            if (resMatch) res = `${resMatch[1]} HD`;

            const bwMatch = line.match(/BANDWIDTH=(\d+)/);
            if (bwMatch) bw = ` (${Math.round(parseInt(bwMatch[1], 10) / 1000)} kbps)`;

            for (let j = i + 1; j < lines.length; j++) {
                const next = lines[j].trim();
                if (next && !next.startsWith('#')) {
                    const resolved = resolveSegmentUrl(next, parentUrl);
                    qualities.push({
                        displayName: `${res}${bw}`,
                        url: resolved
                    });
                    i = j;
                    break;
                }
            }
        }
    }
    return qualities;
}

function parseMediaPlaylist(content, parentUrl) {
    const segments = [];
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // 1. EXTINF tag followed by segment link
        if (line.startsWith('#EXTINF')) {
            for (let j = i + 1; j < lines.length; j++) {
                const next = lines[j].trim();
                if (next && !next.startsWith('#')) {
                    segments.push(resolveSegmentUrl(next, parentUrl));
                    i = j;
                    break;
                }
            }
        }
        // 2. Direct segment file lines
        else if (!line.startsWith('#') && (line.includes('.ts') || line.includes('.m4s') || line.includes('.mp4') || line.includes('segment') || line.includes('chunk') || line.includes('index_'))) {
            segments.push(resolveSegmentUrl(line, parentUrl));
        }
    }

    return [...new Set(segments)];
}

// Start Download
btnStart.addEventListener('click', async () => {
    hideError();

    let chosenUrl = qualitySelect.value || currentStreamUrl;

    if (masterQualities.length > 0) {
        btnStart.disabled = true;
        btnStart.textContent = '⏳ Loading chosen quality segments...';

        try {
            const res = await fetch(chosenUrl);
            const text = await res.text();
            targetSegments = parseMediaPlaylist(text, chosenUrl);
        } catch (err) {
            showError('Could not fetch segments: ' + err.message);
            btnStart.disabled = false;
            btnStart.textContent = '⚡ START HIGH-SPEED DOWNLOAD';
            return;
        }
    }

    if (!targetSegments || targetSegments.length === 0) {
        // Attempt fallback re-analysis
        await analyzeStream(chosenUrl);
        if (!targetSegments || targetSegments.length === 0) {
            showError('No video chunks found. Please refresh the video page and try a fresh link.');
            return;
        }
    }

    configSection.classList.add('hidden');
    progressSection.classList.remove('hidden');

    const concurrency = parseInt(concurrencySlider.value, 10) || 16;
    const fileName = fileNameInput.value.trim() || 'PixelFlix_Video.mp4';

    await downloadChunksInParallel(targetSegments, concurrency, fileName);
});

async function downloadChunksInParallel(segments, concurrency, outputFileName) {
    const total = segments.length;
    const downloadedBuffers = new Array(total);
    let downloadedCount = 0;
    let totalBytes = 0;

    const startTime = Date.now();
    let lastBytes = 0;
    let lastTime = startTime;

    const interval = setInterval(() => {
        const now = Date.now();
        const elapsedSec = (now - lastTime) / 1000;
        if (elapsedSec >= 0.3) {
            const speedMBps = ((totalBytes - lastBytes) / 1024 / 1024) / elapsedSec;
            lastBytes = totalBytes;
            lastTime = now;

            const percent = ((downloadedCount / total) * 100).toFixed(1);
            progressBarFill.style.width = `${percent}%`;
            percentText.textContent = `${percent}%`;

            mSpeed.textContent = `${Math.max(0, speedMBps).toFixed(1)} MB/s`;
            mChunks.textContent = `${downloadedCount} / ${total}`;
            mSize.textContent = formatBytes(totalBytes);

            if (speedMBps > 0 && downloadedCount > 0) {
                const remainingSecs = ((total - downloadedCount) * (totalBytes / downloadedCount)) / (speedMBps * 1024 * 1024);
                const mins = Math.floor(remainingSecs / 60);
                const secs = Math.floor(remainingSecs % 60);
                mEta.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            }
        }
    }, 300);

    let currentIndex = 0;

    async function worker() {
        while (currentIndex < total) {
            const index = currentIndex++;
            const url = segments[index];

            let attempt = 0;
            let success = false;

            while (attempt < 4 && !success) {
                try {
                    attempt++;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);

                    const buffer = await res.arrayBuffer();
                    downloadedBuffers[index] = buffer;
                    totalBytes += buffer.byteLength;
                    downloadedCount++;
                    success = true;
                } catch {
                    if (attempt < 4) await new Promise(r => setTimeout(r, 300 * attempt));
                }
            }
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(concurrency, total); i++) {
        workers.push(worker());
    }

    await Promise.all(workers);
    clearInterval(interval);

    progressBarFill.style.width = '100%';
    percentText.textContent = '100%';
    mChunks.textContent = `${total} / ${total}`;
    mSize.textContent = formatBytes(totalBytes);

    statusText.textContent = '🔄 Merging video chunks into single MP4...';

    // Assemble single continuous blob
    const mergedBlob = new Blob(downloadedBuffers, { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(mergedBlob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = outputFileName.endsWith('.mp4') ? outputFileName : outputFileName + '.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    progressSection.classList.add('hidden');
    completeSection.classList.remove('hidden');

    completeSummary.textContent = `Completed! ${formatBytes(totalBytes)} assembled into ${outputFileName} and downloaded directly to your Downloads folder!`;
}

btnDownloadAgain.addEventListener('click', () => {
    window.close();
});

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorBox.classList.remove('hidden');
}

function hideError() {
    errorBox.classList.add('hidden');
}
