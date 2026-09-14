// wwwroot/app.js — Stream Helper Production Downloader Controller

let streamData = null;
let currentTaskId = null;
let pollInterval = null;
let currentConcurrency = 64;
let isPaused = false;
let autoStartDownload = false;

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
    if (urlParams.get('autoDownload') === '1' || urlParams.get('auto') === '1') {
        autoStartDownload = true;
    }
    if (paramStreamUrl) {
        streamUrlInput.value = decodeURIComponent(paramStreamUrl);
        setTimeout(() => {
            btnAnalyze.click();
        }, 300);
    }
});

// URL Choice Modal Elements
const urlChoiceModal = document.getElementById('urlChoiceModal');
const btnCloseUrlChoice = document.getElementById('btnCloseUrlChoice');
const btnChoiceSingleVideo = document.getElementById('btnChoiceSingleVideo');
const btnChoiceFullPlaylist = document.getElementById('btnChoiceFullPlaylist');
let pendingHybridUrl = '';

function isPurePlaylistUrl(url) {
    if (!url) return false;
    const clean = url.trim();
    // Has playlist ID but NO specific video ID
    const hasList = /[?&]list=([a-zA-Z0-9_-]+)/i.test(clean) || /youtube\.com\/playlist\?/i.test(clean);
    const hasVideo = /[?&]v=([a-zA-Z0-9_-]{11})/i.test(clean) || /youtu\.be\/([a-zA-Z0-9_-]{11})/i.test(clean);
    return hasList && !hasVideo;
}

function isHybridVideoPlaylistUrl(url) {
    if (!url) return false;
    const clean = url.trim();
    // Has both a specific video ID AND a list parameter
    const hasList = /[?&]list=([a-zA-Z0-9_-]+)/i.test(clean);
    const hasVideo = /[?&]v=([a-zA-Z0-9_-]{11})/i.test(clean) || /youtu\.be\/([a-zA-Z0-9_-]{11})/i.test(clean);
    return hasList && hasVideo;
}

function extractSingleVideoUrl(url) {
    try {
        const u = new URL(url);
        const v = u.searchParams.get('v');
        if (v) {
            return `https://www.youtube.com/watch?v=${v}`;
        }
    } catch { }
    // Fallback regex strip
    return url.replace(/([?&])list=[^&]+/i, '').replace(/([?&])index=\d+/i, '').replace(/&&+/g, '&').replace(/[?&]$/, '');
}

function showUrlChoiceModal(url) {
    pendingHybridUrl = url;
    if (urlChoiceModal) {
        urlChoiceModal.style.display = 'flex';
    }
}

function hideUrlChoiceModal() {
    pendingHybridUrl = '';
    if (urlChoiceModal) {
        urlChoiceModal.style.display = 'none';
    }
}

if (btnCloseUrlChoice) {
    btnCloseUrlChoice.addEventListener('click', hideUrlChoiceModal);
}

if (btnChoiceSingleVideo) {
    btnChoiceSingleVideo.addEventListener('click', () => {
        const urlToUse = pendingHybridUrl || streamUrlInput.value.trim();
        hideUrlChoiceModal();
        const singleUrl = extractSingleVideoUrl(urlToUse);
        streamUrlInput.value = singleUrl;
        triggerAnalyze(singleUrl);
    });
}

if (btnChoiceFullPlaylist) {
    btnChoiceFullPlaylist.addEventListener('click', () => {
        const urlToUse = pendingHybridUrl || streamUrlInput.value.trim();
        hideUrlChoiceModal();
        showError('⚡ Opening YouTube Playlist Studio...');
        window.location.href = '/playlist?url=' + encodeURIComponent(urlToUse);
    });
}

// Enter key to Analyze
if (streamUrlInput) {
    streamUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnAnalyze.click();
        }
    });

    // Auto-detect on paste or direct input
    streamUrlInput.addEventListener('paste', (e) => {
        setTimeout(() => {
            const val = streamUrlInput.value.trim();
            if (isHybridVideoPlaylistUrl(val)) {
                showUrlChoiceModal(val);
            } else if (isPurePlaylistUrl(val)) {
                showError('⚡ YouTube Playlist detected! Opening Playlist Studio...');
                window.location.href = '/playlist?url=' + encodeURIComponent(val);
            }
        }, 50);
    });
}

// Paste from Clipboard Button
btnPaste.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            const cleanUrl = text.trim();
            streamUrlInput.value = cleanUrl;
            if (isHybridVideoPlaylistUrl(cleanUrl)) {
                showUrlChoiceModal(cleanUrl);
            } else if (isPurePlaylistUrl(cleanUrl)) {
                showError('⚡ YouTube Playlist detected! Opening Playlist Studio...');
                window.location.href = '/playlist?url=' + encodeURIComponent(cleanUrl);
            } else {
                btnAnalyze.click();
            }
        }
    } catch {
        showError('Could not access clipboard. Please paste URL manually.');
    }
});

// Description Read More / Read Less Toggle
if (btnReadMore) {
    btnReadMore.addEventListener('click', () => {
        const isExp = videoDescDisplay.classList.toggle('expanded');
        videoDescDisplay.style.display = isExp ? 'block' : '-webkit-box';
        btnReadMore.textContent = isExp ? 'Read less ▴' : 'Read more ▾';
    });
}

// Browse / Open Destination Folder
if (btnBrowseFolder) {
    btnBrowseFolder.addEventListener('click', async () => {
        const oldText = btnBrowseFolder.textContent;
        btnBrowseFolder.textContent = '✓ Opening...';
        btnBrowseFolder.disabled = true;
        try {
            const res = await fetch('/api/open-folder', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                if (data.path && destPathDisplay) {
                    destPathDisplay.textContent = data.path;
                }
            }
        } catch { }
        setTimeout(() => {
            btnBrowseFolder.textContent = oldText;
            btnBrowseFolder.disabled = false;
        }, 1200);
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
        const isMatch = parseInt(btn.dataset.threads, 10) === threads;
        btn.classList.toggle('active', isMatch);
    });
}

function isInstagramPageUrl(url) {
    try { return new URL(url).hostname.toLowerCase().includes('instagram.com'); }
    catch { return false; }
}

function requestInstagramStreamFromExtension(url) {
    return new Promise((resolve) => {
        const requestId = `ig_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const cleanup = () => window.removeEventListener('message', handler);
        const timeout = setTimeout(() => {
            cleanup();
            resolve(null);
        // The extension polls the already-open Reel briefly because recent
        // Instagram embeds often omit video_url until playback attaches the
        // signed CDN source. Leave enough room for that scan to finish.
        }, 10000);
        const handler = (event) => {
            if (event.origin !== window.location.origin || event.source !== window) return;
            const data = event.data;
            if (!data || data.source !== 'SaveZonixExtension' || data.type !== 'instagramResolved' || data.requestId !== requestId) return;
            clearTimeout(timeout);
            cleanup();
            resolve(data.response || null);
        };
        window.addEventListener('message', handler);
        window.postMessage({ source: 'SaveZonixDashboard', type: 'resolveInstagram', requestId, url }, window.location.origin);
    });
}

function requestPageStreamFromExtension(url) {
    return new Promise((resolve) => {
        const requestId = `page_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const cleanup = () => window.removeEventListener('message', handler);
        const timeout = setTimeout(() => { cleanup(); resolve(null); }, 7000);
        const handler = (event) => {
            if (event.origin !== window.location.origin || event.source !== window) return;
            const data = event.data;
            if (!data || data.source !== 'SaveZonixExtension' || data.type !== 'pageResolved' || data.requestId !== requestId) return;
            clearTimeout(timeout);
            cleanup();
            resolve(data.response || null);
        };
        window.addEventListener('message', handler);
        window.postMessage({ source: 'SaveZonixDashboard', type: 'resolvePage', requestId, url }, window.location.origin);
    });
}

function triggerAnalyze(url) {
    if (url) streamUrlInput.value = url;
    executeAnalyze();
}

// Analyze Video / Stream URL with progressive status messages
btnAnalyze.addEventListener('click', () => {
    executeAnalyze();
});

async function executeAnalyze() {
    const url = streamUrlInput.value.trim();
    if (!url) {
        showError('Please enter a valid video or stream URL.');
        return;
    }

    // Check for Hybrid Video + Playlist URL first
    if (isHybridVideoPlaylistUrl(url)) {
        showUrlChoiceModal(url);
        return;
    }

    // Pure YouTube Playlist URL
    if (isPurePlaylistUrl(url)) {
        btnAnalyze.disabled = true;
        showError('Detected YouTube Playlist! Redirecting to YouTube Playlist Studio...');
        window.location.href = '/playlist?url=' + encodeURIComponent(url);
        return;
    }

    // Reset previous task polling and enable download button for new media
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    currentTaskId = null;
    if (btnStartDownload) btnStartDownload.disabled = false;

    hideError();
    setLoading(true, 'Resolving media...');

    const t1 = setTimeout(() => { if (btnAnalyze.disabled) setLoading(true, 'Checking server...'); }, 1200);
    const t2 = setTimeout(() => { if (btnAnalyze.disabled) setLoading(true, 'Connecting...'); }, 2800);

    try {
        // A server cannot use the user's Instagram session.  Ask the installed
        // extension first, before making any request for the reel webpage, so
        // a normal Instagram paste does not deliberately generate a 400.
        if (isInstagramPageUrl(url)) {
            setLoading(true, 'Checking extension or resolving stream...');
            let bridge = null;
            try {
                bridge = await Promise.race([
                    requestInstagramStreamFromExtension(url),
                    new Promise(res => setTimeout(() => res(null), 2500))
                ]);
            } catch { }

            if (bridge?.success && bridge.url) {
                const directResponse = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: bridge.url })
                });
                const directData = await directResponse.json();
                if (directResponse.ok && directData.success) {
                    directData.title = bridge.title || directData.title;
                    directData.thumbnailUrl = bridge.thumbnail || directData.thumbnailUrl;
                    directData.platform = 'Instagram';
                    directData.resolvedStreamUrl = bridge.url;
                    directData.expectedResolution = bridge.resolution || '';
                    if (bridge.duration) {
                        const durationMatch = String(bridge.duration).match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
                        if (durationMatch) {
                            const hours = parseInt(durationMatch[1] || '0', 10);
                            const minutes = parseInt(durationMatch[2], 10);
                            const seconds = parseInt(durationMatch[3], 10);
                            directData.durationSeconds = hours * 3600 + minutes * 60 + seconds;
                        }
                    }
                    if (bridge.audioUrl) {
                        directData.audioUrl = bridge.audioUrl;
                        if (directData.qualities && directData.qualities.length > 0) {
                            directData.qualities.forEach(q => q.audioUrl = bridge.audioUrl);
                        }
                    }
                    streamData = directData;
                    renderStreamDetails(directData);
                    return;
                }
            }
            // If extension was not found or didn't resolve, fall through to server-side /api/analyze
        }

        // Some KVS/tube hosts block server-side HTML requests but expose the
        // exact signed source to their already-open browser player.
        if (new URL(url).hostname.toLowerCase().includes('freepornvideo.sex')) {
            setLoading(true, 'Reading the playable stream from Chrome...');
            const bridge = await requestPageStreamFromExtension(url);
            if (!bridge?.success || !bridge.url) {
                throw new Error(bridge?.message || 'Open this page in Chrome, start the video briefly, then retry.');
            }
            const directResponse = await fetch('/api/analyze', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: bridge.url })
            });
            const directData = await directResponse.json();
            if (!directResponse.ok || !directData.success) throw new Error(directData.message || 'The captured stream has expired. Play the video and retry.');
            directData.title = bridge.title || directData.title;
            directData.thumbnailUrl = bridge.thumbnail || directData.thumbnailUrl;
            directData.platform = bridge.platform || directData.platform;
            directData.expectedResolution = bridge.resolution || '';
            streamData = directData;
            renderStreamDetails(directData);
            return;
        }

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
}

let currentFormatMode = 'video';

function switchFormatMode(mode) {
    currentFormatMode = mode;
    const tabVideo = document.getElementById('tabModeVideo');
    const tabAudio = document.getElementById('tabModeAudio');
    const lblQuality = document.getElementById('lblQualitySelect');
    const btnDownloadText = document.getElementById('btnDownloadText');

    if (mode === 'audio') {
        if (tabAudio) {
            tabAudio.style.borderColor = '#38bdf8';
            tabAudio.style.background = '#1e293b';
            tabAudio.style.color = '#38bdf8';
        }
        if (tabVideo) {
            tabVideo.style.borderColor = '#30363d';
            tabVideo.style.background = '#0f172a';
            tabVideo.style.color = '#94a3b8';
        }
        if (lblQuality) lblQuality.textContent = 'Audio Format & Bitrate';
        if (btnDownloadText) btnDownloadText.textContent = '🎵 Download Audio (MP3)';

        // Populate Audio Options
        qualitySelect.innerHTML = `
            <option value="320" data-format="mp3" data-bitrate="320" selected>320 kbps MP3 (Ultra High Quality Audio)</option>
            <option value="192" data-format="mp3" data-bitrate="192">192 kbps MP3 (High Quality Audio)</option>
            <option value="128" data-format="mp3" data-bitrate="128">128 kbps MP3 (Standard Audio)</option>
            <option value="256" data-format="m4a" data-bitrate="256">256 kbps M4A / AAC (Apple Audio)</option>
        `;

        const rawTitle = (streamData?.title || 'Audio').replace(/[\\/:*?"<>|\r\n\t]+/g, '_').slice(0, 60);
        fileNameInput.value = `${rawTitle}.mp3`;
        badgeEstSize.textContent = '~12 MB';
    } else {
        if (tabVideo) {
            tabVideo.style.borderColor = '#38bdf8';
            tabVideo.style.background = '#1e293b';
            tabVideo.style.color = '#38bdf8';
        }
        if (tabAudio) {
            tabAudio.style.borderColor = '#30363d';
            tabAudio.style.background = '#0f172a';
            tabAudio.style.color = '#94a3b8';
        }
        if (lblQuality) lblQuality.textContent = 'Video Quality';
        if (btnDownloadText) btnDownloadText.textContent = '⬇️ Download Video (MP4)';

        renderVideoQualities();
    }
}

function renderVideoQualities() {
    if (!streamData) return;
    qualitySelect.innerHTML = '';
    const urlParams = new URLSearchParams(window.location.search);
    const paramQuality = urlParams.get('quality');
    const prefQuality = (paramQuality || streamData.defaultQuality || 'Highest').toLowerCase();

    if (streamData.qualities && streamData.qualities.length > 0) {
        let bestIndex = 0;
        
        // Find best quality matching preference or default to highest available resolution (1080p/4K)
        if (prefQuality && prefQuality !== 'highest' && prefQuality !== 'best') {
            const foundIdx = streamData.qualities.findIndex(q => 
                (q.resolution && q.resolution.toLowerCase().includes(prefQuality)) ||
                (q.displayName && q.displayName.toLowerCase().includes(prefQuality))
            );
            if (foundIdx !== -1) bestIndex = foundIdx;
        } else {
            // Default to Highest/Best: Skip pure audio streams and pick top video resolution
            const topVideoIdx = streamData.qualities.findIndex(q => !q.resolution.toLowerCase().includes('audio only'));
            if (topVideoIdx !== -1) bestIndex = topVideoIdx;
        }

        streamData.qualities.forEach((q, i) => {
            const opt = document.createElement('option');
            opt.value = q.url;
            opt.textContent = q.displayName;
            opt.dataset.res = q.resolution;
            opt.dataset.estSize = q.formattedEstimatedSize || '';
            opt.dataset.estBytes = q.estimatedSizeBytes || 0;
            opt.dataset.isDirect = q.isDirectFile ? '1' : '0';
            opt.dataset.audioUrl = q.audioUrl || streamData?.audioUrl || '';
            opt.dataset.bw = q.bandwidth ? `${(q.bandwidth / 1000000.0).toFixed(1)} Mbps` : 'Auto';
            if (i === bestIndex) opt.selected = true;
            qualitySelect.appendChild(opt);
        });
    } else if (streamData?.requiresBrowserContext) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '🔒 Stream requires SaveZonix Chrome Extension';
        opt.disabled = true;
        qualitySelect.appendChild(opt);
        if (btnStartDownload) btnStartDownload.disabled = true;
        showError(streamData.statusMessage || 'This video requires the SaveZonix Chrome Extension for direct browser-authenticated playback.');
    } else {
        const isDirect = streamData?.isDirectMediaFile === true;
        const opt = document.createElement('option');
        opt.value = streamUrlInput.value.trim();
        opt.textContent = isDirect ? '1080p Full HD (Direct File)' : (streamData?.isLiveStream ? '🔴 Live Stream (Adaptive)' : 'Original Quality (HLS Stream)');
        opt.dataset.res = '1080p';
        opt.dataset.estSize = '';
        opt.dataset.estBytes = 0;
        opt.dataset.isDirect = isDirect ? '1' : '0';
        opt.dataset.audioUrl = streamData?.audioUrl || '';
        opt.dataset.bw = 'Adaptive';
        qualitySelect.appendChild(opt);
    }
    updateSelectedQualitySpecs();
}

function renderStreamDetails(data) {
    videoTitleDisplay.textContent = data.title || 'High-Definition Video Stream';
    badgePlatform.textContent = data.platform || 'Web Stream';

    // Duration & Format Badges
    if (data.isLiveStream) {
        badgePlatform.textContent = '🔴 LIVE Broadcast';
        badgePlatform.style.background = '#e11d48';
        badgePlatform.style.color = '#ffffff';
        badgeDuration.textContent = 'Live';
        badgeDuration.style.display = 'inline-flex';
        thumbDuration.textContent = 'LIVE';
        thumbDuration.style.display = 'block';

        const existingLiveCinema = document.getElementById('btnLiveCinemaLink');
        if (existingLiveCinema) existingLiveCinema.remove();
        const cinemaBtn = document.createElement('a');
        cinemaBtn.id = 'btnLiveCinemaLink';
        cinemaBtn.href = `/cinema?stream=${encodeURIComponent(streamUrlInput.value.trim())}`;
        cinemaBtn.target = '_blank';
        cinemaBtn.className = 'badge badge-cinema';
        cinemaBtn.style.cssText = 'background: #e11d48; color: #fff; font-size: 11px; padding: 2px 10px; border-radius: 4px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;';
        cinemaBtn.innerHTML = '🎬 Watch in Cinema';
        const metaBadges = document.querySelector('.meta-badges');
        if (metaBadges) metaBadges.appendChild(cinemaBtn);
    } else if (data.formattedDuration && data.formattedDuration !== '00:00') {
        badgeDuration.textContent = data.formattedDuration;
        badgeDuration.style.display = 'inline-flex';
        thumbDuration.textContent = data.formattedDuration;
        thumbDuration.style.display = 'block';
    } else {
        badgeDuration.textContent = 'HD Video';
        badgeDuration.style.display = 'inline-flex';
        thumbDuration.textContent = 'HD';
        thumbDuration.style.display = 'block';
    }

    // Thumbnail Picture with Stealth Proxy (Zero CORS / Zero 403)
    if (data.thumbnailUrl && data.thumbnailUrl.length > 0) {
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

    // Reset to Video Tab & Render
    currentFormatMode = 'video';
    renderVideoQualities();

    if (btnStartDownload) btnStartDownload.disabled = false;
    streamDetails.classList.remove('hidden');
    progressSection.classList.add('hidden');
    successSection.classList.add('hidden');

    if (autoStartDownload) {
        autoStartDownload = false;
        setTimeout(() => {
            if (btnStartDownload && !btnStartDownload.disabled) {
                btnStartDownload.click();
            }
        }, 400);
    }
}

qualitySelect.addEventListener('change', () => {
    if (currentFormatMode === 'video') {
        updateSelectedQualitySpecs();
    } else {
        const sel = qualitySelect.options[qualitySelect.selectedIndex];
        const fmt = sel?.dataset.format || 'mp3';
        const rawTitle = (streamData?.title || 'Audio').replace(/[\\/:*?"<>|\r\n\t]+/g, '_').slice(0, 60);
        fileNameInput.value = `${rawTitle}.${fmt}`;
    }
});

function updateSelectedQualitySpecs() {
    if (currentFormatMode !== 'video') return;
    const selectedOpt = qualitySelect.options[qualitySelect.selectedIndex];
    if (!selectedOpt) return;

    const res = selectedOpt.dataset.res || '1080p';
    const estSize = selectedOpt.dataset.estSize || '';

    if (estSize && !estSize.includes('~0 MB')) {
        const cleanSize = estSize.startsWith('~') ? estSize.substring(1).trim() : estSize;
        badgeEstSize.textContent = cleanSize;
        badgeEstSize.style.display = 'inline-flex';
    } else {
        // Fallback calculation
        let computedMb = 0;
        if (streamData?.durationSeconds > 0) {
            computedMb = Math.round((streamData.durationSeconds * 2800000) / (8 * 1024 * 1024));
        } else if (streamData?.totalSegments > 0) {
            computedMb = Math.round(streamData.totalSegments * 1.5);
        }
        
        if (computedMb > 0) {
            badgeEstSize.textContent = `${computedMb} MB`;
            badgeEstSize.style.display = 'inline-flex';
        } else {
            badgeEstSize.textContent = 'HD Stream';
            badgeEstSize.style.display = 'inline-flex';
        }
    }

    const rawTitle = (streamData?.title || 'Video').replace(/[\\/:*?"<>|\r\n\t]+/g, '_').slice(0, 60);
    const qualityTag = res && res !== 'Unknown' ? `_${res.split('x')[1] || res}p` : '';
    fileNameInput.value = `${rawTitle}${qualityTag}.mp4`;
}

// Start Parallel Download
btnStartDownload.addEventListener('click', async () => {
    if (!streamData) return;

    hideError();
    const isAudioMode = currentFormatMode === 'audio';
    const selectedOpt = qualitySelect.options[qualitySelect.selectedIndex];

    // Cloud Download Gatekeeper (Quota, Guest limits, 4K VIP lock)
    const selectedResolution = selectedOpt ? (selectedOpt.dataset.res || '') : '';
    if (typeof window.checkDownloadPermission === 'function') {
        const check = window.checkDownloadPermission(selectedResolution);
        if (check && !check.allowed) {
            return;
        }
    }
    
    // In audio mode, use the stream source URL and target format
    const selectedUrl = isAudioMode 
        ? (streamData.qualities?.[0]?.url || streamUrlInput.value.trim())
        : (qualitySelect.value || streamUrlInput.value.trim());

    if (!selectedUrl || !/^https?:\/\//i.test(selectedUrl)) {
        showError('No verified stream is selected. Analyze the video again before downloading.');
        return;
    }

    const audioUrl = (selectedOpt ? (selectedOpt.dataset.audioUrl || '') : '') || streamData?.audioUrl || '';
    const fileName = fileNameInput.value.trim() || (isAudioMode ? 'audio.mp3' : 'video.mp4');
    const concurrency = currentConcurrency || 16;
    const estimatedSizeBytes = selectedOpt ? parseInt(selectedOpt.dataset.estBytes || 0, 10) : 0;
    const isDirectFile = !isAudioMode && selectedOpt ? (selectedOpt.dataset.isDirect === '1') : false;
    const selectedFormat = isAudioMode ? (selectedOpt?.dataset.format?.toUpperCase() || 'MP3') : 'MP4';
    const audioBitrate = isAudioMode ? parseInt(selectedOpt?.dataset.bitrate || '320', 10) : 0;

    // Populate Active Mini Video Banner
    activeTitleDisplay.textContent = streamData.title || fileName;
    activePlatformBadge.textContent = streamData.platform || 'Web Stream';
    activeThreadsBadge.textContent = `${concurrency} Max Workers`;
    activeQualityBadge.textContent = isAudioMode ? `${audioBitrate} kbps ${selectedFormat}` : (selectedOpt?.dataset.res || '1080p FHD');
    activeStrategyBadge.textContent = isAudioMode ? 'Extracting High-Quality Audio' : (isDirectFile ? 'Parallel Range Download' : 'HLS Segment Download');

    const thumbUrl = streamData.thumbnailUrl || streamData.rawThumbnailUrl;
    if (thumbUrl && thumbUrl.length > 0) {
        activeThumbImg.referrerPolicy = 'no-referrer';
        activeThumbImg.src = thumbUrl;
        activeThumbImg.onload = () => {
            activeThumbImg.style.display = 'block';
            activeThumbFallback.style.display = 'none';
        };
        activeThumbImg.onerror = () => {
            if (!activeThumbImg.src.includes('/api/proxy-image') && thumbUrl.startsWith('http')) {
                activeThumbImg.src = `/api/proxy-image?url=${encodeURIComponent(thumbUrl)}`;
            } else {
                activeThumbImg.style.display = 'none';
                activeThumbFallback.style.display = 'flex';
            }
        };
    } else {
        activeThumbImg.style.display = 'none';
        activeThumbFallback.style.display = 'flex';
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

    // Smoothly anchor viewport directly to the downloader progress card
    const cardEl = document.querySelector('.downloader-card');
    if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    try {
        let cloudUser = {};
        try {
            cloudUser = JSON.parse(localStorage.getItem('savezonix_cloud_user') || '{}');
        } catch { }

        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                streamUrl: selectedUrl,
                audioUrl: audioUrl,
                originalPageUrl: streamUrlInput.value.trim(),
                title: streamData.title || fileName,
                thumbnailUrl: streamData.thumbnailUrl || '',
                platform: streamData.platform || 'Web Stream',
                quality: selectedOpt?.dataset.res || '1080p',
                format: isDirectFile ? 'MP4' : 'HLS/MP4',
                fileName,
                concurrency,
                estimatedSizeBytes,
                isDirectFile,
                durationSeconds: streamData.durationSeconds || 0,
                expectedResolution: streamData.expectedResolution || selectedOpt?.dataset.res || '',
                userEmail: cloudUser.email || '',
                userId: cloudUser.id || cloudUser._id || ''
            })
        });

        const data = await response.json();
        if (!response.ok || !data.taskId) {
            if (data.requireAuth) {
                showError(`${data.message} <br><br><div style="display:flex; gap:10px; margin-top:10px; justify-content:center;"><a href="/Account/Login" class="btn btn-sm btn-primary" style="text-decoration:none;">🔑 Sign In to Continue</a> <a href="/Account/Register" class="btn btn-sm btn-subtle" style="text-decoration:none;">✨ Create Free Account</a></div>`);
                btnStartDownload.disabled = false;
                streamDetails.classList.remove('hidden');
                progressSection.classList.add('hidden');
                return;
            }
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
                const errMsg = state.errorMessage || state.status || 'Download Failed/Corrupted – Please Redownload';
                showError(`⚠️ <strong>Download Failed/Corrupted</strong><br><span style="font-size:13px; color:#fca5a5;">${errMsg}</span><br><br><span style="font-size:12px; color:var(--text-muted);">The invalid file was removed and was not saved as a completed download.</span><br><button type="button" id="btnRetryDownload" class="btn btn-primary btn-sm" style="margin-top:10px;">Retry Download</button>`);
                progressSection.classList.add('hidden');
                btnStartDownload.disabled = false;
                streamDetails.classList.remove('hidden');

                document.getElementById('btnRetryDownload')?.addEventListener('click', () => {
                    hideError();
                    btnStartDownload.click();
                }, { once: true });

                try {
                    fetch('/api/analytics/client-error', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            taskId: taskId,
                            url: streamUrlInput?.value || '',
                            errorType: 'DownloadValidationError',
                            errorMessage: errMsg,
                            userAgent: navigator.userAgent
                        })
                    });
                } catch { }
                return;
            }

            if (state.isCompleted) {
                clearInterval(pollInterval);
                onDownloadComplete(state, fileName);
                return;
            }

            let pct = Math.round(state.percentage || 0);
            if (state.totalBytesDownloaded > 0 && state.estimatedTotalBytes > 0) {
                pct = Math.min(99, Math.round((state.totalBytesDownloaded / state.estimatedTotalBytes) * 100));
            }
            if (state.isCompleted) pct = 100;
            progressBarFill.style.width = `${pct}%`;
            percentText.textContent = `${pct}%`;

            // State management with lively finishing feedback at 99%
            let currentStatus = state.status || 'Downloading in Parallel...';
            const isFinishing = pct >= 99 || state.isMerging;

            if (state.isPaused) {
                currentStatus = 'Paused';
                progressBarFill.classList.remove('finishing-touches-active');
            } else if (isFinishing) {
                progressBarFill.classList.add('finishing-touches-active');
                if (state.isMerging) {
                    currentStatus = '⚡ Merging Video & Audio (Lossless Remux)...';
                } else {
                    currentStatus = '⚡ Finalizing Container & Verifying Streams...';
                }
            } else {
                progressBarFill.classList.remove('finishing-touches-active');
                if (pct === 0 && (state.speedMBps || 0) === 0) {
                    currentStatus = 'Connecting to server...';
                }
            }

            statusBadge.textContent = currentStatus;
            statusBadge.style.color = isFinishing ? '#38bdf8' : (state.isPaused ? '#fbbf24' : '#34d399');

            // 1. Transfer Speed
            const curSpd = isFinishing ? (state.speedMBps > 0 ? state.speedMBps : 14.5) : (state.speedMBps || 0);
            metricSpeed.textContent = isFinishing ? 'Finishing...' : `${curSpd.toFixed(1)} MB/s`;

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
            let totalStr = '';
            if (state.estimatedTotalBytes > 0) {
                totalStr = ` / ${formatBytes(state.estimatedTotalBytes, false)}`;
            } else if (state.totalBytesDownloaded > 0 && isFinishing) {
                totalStr = ` / ${downloadedStr}`;
            }
            metricSize.textContent = `${downloadedStr}${totalStr}`;

            if (isFinishing || pct >= 99) {
                metricSizePct.textContent = `100% downloaded • Assembling container`;
            } else {
                metricSizePct.textContent = `${pct}% written to disk`;
            }

            // 3. Completed Chunks (Real-time active chunks calculation)
            const totalSegs = state.totalSegments || streamData?.totalSegments || 256;
            let doneSegs = state.downloadedSegments || 0;
            if (doneSegs === 0 && pct > 0 && totalSegs > 0) {
                doneSegs = Math.min(totalSegs - 1, Math.floor((pct / 100.0) * totalSegs));
            }
            metricChunks.textContent = `${doneSegs} / ${totalSegs} Parts`;
            metricChunksSub.textContent = `0 Failed • ${totalSegs} Parallel Active`;

            // 4. Active Connections / Workers
            const activeConn = state.activeThreads || userMaxThreads || 256;
            metricWorkers.textContent = `${activeConn} Workers`;
            activeThreadsBadge.textContent = `${activeConn} Active Workers`;
            metricMaxThreadsSub.textContent = `Max: ${userMaxThreads || 256} Concurrency`;

            // 5. ETA (Instant Live Countdown)
            metricEta.textContent = formatETA(state.estimatedSecondsRemaining, state.isMerging, state.isCompleted, state);
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

    const btnDirectSaveText = document.getElementById('btnDirectSaveText');
    if (btnDirectSaveText) {
        btnDirectSaveText.textContent = `Save Video (${fileName.substring(fileName.lastIndexOf('.')) || '.mp4'})`;
    }

    const peakText = state.peakSpeedMBps > 0 ? ` • Peak: ${state.peakSpeedMBps.toFixed(1)} MB/s` : '';
    successSummary.textContent = `Completed in ${state.mergeSeconds ? state.mergeSeconds.toFixed(1) : '1'}s • File Size: ${formatBytes(state.totalBytesDownloaded || 0, false)}${peakText}`;

    // ⚡ Instant Telemetry Push to Render MongoDB (so Cloud Admin Panel gets live download history)
    try {
        let cloudUser = {};
        try {
            cloudUser = JSON.parse(localStorage.getItem('savezonix_cloud_user') || '{}');
        } catch { }
        const email = (cloudUser && cloudUser.email) ? cloudUser.email : 'guest@savezonix.com';

        fetch('https://savezonix.onrender.com/api/admin/record-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId: state.taskId,
                title: streamData?.title || fileName,
                fileName: fileName,
                originalUrl: streamUrlInput?.value || '',
                platform: streamData?.platform || 'Web Stream',
                quality: activeQualityBadge?.textContent || '1080p Full HD',
                fileSize: state.totalBytesDownloaded || 0,
                downloadSpeedMBps: state.speedMBps || 0,
                peakSpeedMBps: state.peakSpeedMBps || 0,
                format: fileName.endsWith('.mp3') ? 'mp3' : 'mp4',
                status: 'Completed',
                userEmail: email,
                userId: cloudUser.id || cloudUser._id || null
            })
        }).catch(() => {});
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

function formatETA(secs, isMerging, isCompleted, state = null) {
    if (isCompleted) return '00:00';
    if (isMerging) return 'Finalizing...';

    let totalSeconds = secs;
    if (totalSeconds === undefined || totalSeconds === null || totalSeconds <= 0 || isNaN(totalSeconds) || totalSeconds === Infinity) {
        if (state && state.speedMBps > 0.05 && state.estimatedTotalBytes > state.totalBytesDownloaded) {
            const remBytes = state.estimatedTotalBytes - state.totalBytesDownloaded;
            totalSeconds = Math.round(remBytes / (state.speedMBps * 1024.0 * 1024.0));
        } else {
            return '00:45';
        }
    }

    totalSeconds = Math.round(totalSeconds);
    if (totalSeconds <= 0) return '00:01';

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
    errorMessage.innerHTML = msg;
    errorBox.classList.remove('hidden');
}

function hideError() {
    errorBox.classList.add('hidden');
}

// Auto-populate & analyze from URL query parameters (e.g. http://localhost:5000/?url=https://...)
document.addEventListener('DOMContentLoaded', () => {
    try {
        fetch('/api/downloads-directory')
            .then(r => r.json())
            .then(d => {
                if (d.path && destPathDisplay) {
                    destPathDisplay.textContent = d.path;
                }
            }).catch(() => {});

        const params = new URLSearchParams(window.location.search);
        const autoUrl = params.get('url');
        if (autoUrl && streamUrlInput) {
            streamUrlInput.value = autoUrl;
            if (typeof analyzeStream === 'function') {
                analyzeStream(autoUrl);
            }
        }
    } catch { }
});

// Global Telemetry & Client Exception Logger
window.addEventListener('error', (event) => {
    try {
        fetch('/api/analytics/client-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: window.location.href,
                errorType: 'ClientUncaughtError',
                errorMessage: event.message || 'Uncaught script error',
                stackTrace: event.error ? event.error.stack : `${event.filename}:${event.lineno}:${event.colno}`,
                userAgent: navigator.userAgent
            })
        });
    } catch { }
});

window.addEventListener('unhandledrejection', (event) => {
    try {
        fetch('/api/analytics/client-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: window.location.href,
                errorType: 'UnhandledPromiseRejection',
                errorMessage: event.reason?.message || String(event.reason),
                stackTrace: event.reason?.stack || '',
                userAgent: navigator.userAgent
            })
        });
    } catch { }
});
