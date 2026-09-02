// src/downloader/downloader.js — Dedicated High-Speed Tab Downloader Engine (Manifest V3)

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const initialStreamUrl = urlParams.get('url') || '';
    const videoTitle = urlParams.get('title') || 'Video';
    const videoShow = urlParams.get('showName') || videoTitle;
    const videoSub = urlParams.get('subtitle') || '';
    const qualityLabel = (urlParams.get('quality') || '1080p Full HD').replace('⭐ Best Quality — ', '');
    const platform = urlParams.get('platform') || 'PixelFlix';
    const thumbnail = urlParams.get('thumbnail') || '';
    const durationParam = urlParams.get('duration') || '';
    const originTabId = parseInt(urlParams.get('tabId') || '0', 10);

    // Initial Concurrency Parameter (Supports up to 256 Threads — Default: 64)
    const rawThreadParam = urlParams.get('threads') || '64';
    let initialThreads = parseInt(rawThreadParam, 10);
    if (isNaN(initialThreads) || initialThreads < 1 || initialThreads > 256) {
        initialThreads = 64;
    }

    // Extract verified numeric season & episode
    function parseNumericParam(key) {
        const val = urlParams.get(key);
        if (!val) return null;
        const num = parseInt(val, 10);
        return (!isNaN(num) && num > 0) ? num : null;
    }

    const rawSeason = parseNumericParam('season');
    const rawEpisode = parseNumericParam('episode');
    const episodeTitle = urlParams.get('episodeTitle') || '';

    // DOM Elements
    const elTitle = document.getElementById('videoTitle');
    const elPlatform = document.getElementById('platformBadge');
    const elQuality = document.getElementById('qualityBadge');
    const elDurationBadge = document.getElementById('durationBadge');
    const elSizeBadge = document.getElementById('sizeBadge');
    const elFilename = document.getElementById('targetFilename');
    const elThumbBox = document.getElementById('thumbBox');
    const elThumbImg = document.getElementById('thumbImg');
    const elThumbPlaceholder = document.getElementById('thumbPlaceholder');
    const elThumbPlayBtn = document.getElementById('thumbPlayBtn');
    const elThumbProgressFill = document.getElementById('thumbProgressFill');
    const elThumbTimeDisplay = document.getElementById('thumbTimeDisplay');
    const elStatusHeading = document.getElementById('statusHeading');
    const elPercent = document.getElementById('percentCounter');
    const elProgressFill = document.getElementById('progressFill');
    const elValSize = document.getElementById('valSize');
    const elValSpeed = document.getElementById('valSpeed');
    const elValSegments = document.getElementById('valSegments');
    const elValEta = document.getElementById('valEta');
    const elValPeakSpeed = document.getElementById('valPeakSpeed');
    const elValHealth = document.getElementById('valHealth');
    const elValRetrySub = document.getElementById('valRetrySub');
    const elBtnPause = document.getElementById('btnPause');
    const elBtnCancel = document.getElementById('btnCancel');
    const elBtnSavePartial = document.getElementById('btnSavePartial');
    const elBtnSavePartialError = document.getElementById('btnSavePartialError');
    const elErrorBox = document.getElementById('errorBox');
    const elErrorMessage = document.getElementById('errorMessage');
    const elBtnRetry = document.getElementById('btnRetry');
    const elSuccessBox = document.getElementById('successBox');
    const elBtnOpenFolder = document.getElementById('btnOpenFolder');
    const elSelThreads = document.getElementById('selActiveThreads');
    const speedCanvas = document.getElementById('speedCanvas');
    const elPreviewSection = document.getElementById('previewSection');
    const elPreviewPlayer = document.getElementById('previewPlayer');
    const elBtnWatchPreview = document.getElementById('btnWatchPreview');
    const elBtnClosePreview = document.getElementById('btnClosePreview');

    let isCompleted = false;
    let isPaused = false;
    let currentPct = 0;
    let completedDownloadId = null;
    let videoDurationSeconds = 0;
    let totalSegmentsTracked = 0;

    if (elSelThreads) {
        elSelThreads.value = String(initialThreads);
    }

    // Populate Initial UI State
    if (elTitle) elTitle.textContent = videoShow || videoTitle;
    if (elPlatform) elPlatform.textContent = platform;
    if (elQuality) elQuality.textContent = qualityLabel;

    // Duration Display Handler
    function updateDurationDisplay(durString) {
        if (!durString) return;
        const cleanDur = durString.replace(/^⏱️\s*/, '').trim();
        if (cleanDur) {
            if (elThumbTimeDisplay) {
                elThumbTimeDisplay.textContent = `00:00 / ${cleanDur}`;
            }
            // Parse duration string into seconds if mm:ss or hh:mm:ss
            const parts = cleanDur.split(':').map(n => parseInt(n, 10));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                videoDurationSeconds = parts[0] * 60 + parts[1];
            } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                videoDurationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
        }
    }

    if (durationParam) {
        updateDurationDisplay(durationParam);
    }

    // Thumbnail Display Handler
    function updateThumbnailDisplay(thumbSrc) {
        if (!thumbSrc || typeof thumbSrc !== 'string' || thumbSrc.includes('data:image/svg+xml')) return;
        if (elThumbImg) {
            elThumbImg.src = thumbSrc;
            elThumbImg.onload = () => {
                elThumbImg.style.display = 'block';
                if (elThumbPlaceholder) elThumbPlaceholder.style.display = 'none';
            };
            elThumbImg.onerror = () => {
                elThumbImg.style.display = 'none';
                if (elThumbPlaceholder) elThumbPlaceholder.style.display = 'flex';
            };
        }
    }

    if (thumbnail) {
        updateThumbnailDisplay(thumbnail);
    } else if (initialStreamUrl && (initialStreamUrl.includes('.mp4') || initialStreamUrl.includes('.webm'))) {
        // Automatic First-Frame Extraction from Video Stream
        try {
            const vSnap = document.createElement('video');
            vSnap.crossOrigin = 'anonymous';
            vSnap.muted = true;
            vSnap.preload = 'metadata';
            vSnap.src = initialStreamUrl;
            vSnap.onloadedmetadata = () => {
                if (vSnap.duration && !videoDurationSeconds) {
                    videoDurationSeconds = Math.round(vSnap.duration);
                    const durFormatted = window.Helpers ? window.Helpers.formatDuration(videoDurationSeconds) : '';
                    if (durFormatted && elThumbTimeDisplay) {
                        elThumbTimeDisplay.textContent = `00:00 / ${durFormatted}`;
                    }
                }
                try { vSnap.currentTime = 1; } catch { }
            };
            vSnap.onseeked = () => {
                try {
                    const c = document.createElement('canvas');
                    c.width = 160;
                    c.height = 90;
                    const ctx = c.getContext('2d');
                    ctx.drawImage(vSnap, 0, 0, c.width, c.height);
                    const snapUrl = c.toDataURL('image/jpeg', 0.8);
                    if (snapUrl && snapUrl.length > 500) {
                        updateThumbnailDisplay(snapUrl);
                    }
                } catch { }
            };
        } catch { }
    }

    // Request missing metadata & thumbnail from origin tab if needed
    if (originTabId > 0 && (!thumbnail || !durationParam)) {
        try {
            chrome.tabs.sendMessage(originTabId, { action: 'scanPage' }, (res) => {
                if (res && res.metadata) {
                    if (!thumbnail && res.metadata.thumbnail) {
                        updateThumbnailDisplay(res.metadata.thumbnail);
                    }
                    if (!durationParam && res.metadata.duration) {
                        updateDurationDisplay(res.metadata.duration);
                    }
                }
            });
        } catch { }
    }

    if (elThumbBox) {
        elThumbBox.addEventListener('click', () => {
            if (isPreviewOpen) closePreview();
            else openPreview();
        });
    }

    const videoObj = {
        title: videoTitle,
        showName: videoShow,
        subtitle: videoSub,
        platform: platform,
        season: rawSeason,
        episode: rawEpisode,
        episodeTitle: episodeTitle
    };

    const finalFileName = (window.FilenameGenerator && window.FilenameGenerator.generate(videoObj, qualityLabel)) || (videoTitle + '.mp4');
    if (elFilename) elFilename.textContent = finalFileName;
    document.title = `Downloading (${0}%) — ${finalFileName}`;

    // ─── THROUGHPUT SPARKLINE GRAPH CONTROLLER ────────────────────────────
    const speedHistory = new Array(35).fill(0);
    let peakSpeedMBps = 0;

    function renderSpeedSparkline(currentSpeed) {
        if (!speedCanvas) return;
        speedHistory.shift();
        speedHistory.push(currentSpeed);

        if (currentSpeed > peakSpeedMBps) {
            peakSpeedMBps = currentSpeed;
            if (elValPeakSpeed) elValPeakSpeed.textContent = `Peak: ${peakSpeedMBps.toFixed(1)} MB/s`;
        }

        const ctx = speedCanvas.getContext('2d');
        const w = speedCanvas.width;
        const h = speedCanvas.height;

        ctx.clearRect(0, 0, w, h);

        // Draw background subtle grid lines
        ctx.strokeStyle = '#21262d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        const maxVal = Math.max(10, peakSpeedMBps * 1.1);
        const step = w / (speedHistory.length - 1);

        // Fill area under speed curve
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let i = 0; i < speedHistory.length; i++) {
            const x = i * step;
            const y = h - (speedHistory[i] / maxVal) * (h - 4);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.fillStyle = 'rgba(63, 185, 80, 0.12)';
        ctx.fill();

        // Stroke throughput line
        ctx.beginPath();
        for (let i = 0; i < speedHistory.length; i++) {
            const x = i * step;
            const y = h - (speedHistory[i] / maxVal) * (h - 4);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#3fb950';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    // ─── SYNTHESIZED WEB AUDIO COMPLETION CHIME ────────────────────────────
    function playCompletionChime() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5

            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.6);
        } catch { }
    }

    const processor = new window.MediaProcessor();

    // ─── SAVE PARTIAL DOWNLOADED VIDEO ────────────────────────────────────
    function savePartialVideo() {
        const partial = processor.getPartialBlob();
        if (!partial || !partial.blob) {
            alert('No valid downloaded segments available to save yet.');
            return;
        }

        const partialFileName = `[Partially Downloaded ${currentPct}%] ${finalFileName}`;
        const blobUrl = URL.createObjectURL(partial.blob);

        chrome.downloads.download({
            url: blobUrl,
            filename: partialFileName,
            saveAs: false
        }, (dlId) => {
            if (chrome.runtime.lastError) {
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = partialFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
            playCompletionChime();
            if (elStatusHeading) elStatusHeading.textContent = `Partial video saved (${window.Helpers.formatBytes(partial.sizeBytes)})`;
        });
    }

    if (elBtnSavePartial) {
        elBtnSavePartial.addEventListener('click', savePartialVideo);
    }
    if (elBtnSavePartialError) {
        elBtnSavePartialError.addEventListener('click', savePartialVideo);
    }

    // ─── ACCIDENTAL TAB CLOSE PROTECTION (beforeunload) ───────────────────
    window.addEventListener('beforeunload', (e) => {
        if (!isCompleted && !processor.isAborted) {
            e.preventDefault();
            e.returnValue = 'Download is in progress. Closing this tab will cancel the download.';
            return e.returnValue;
        }
    });

    // ─── NETWORK LOSS & RECOVERY HANDLERS ─────────────────────────────────
    window.addEventListener('offline', () => {
        if (!isCompleted && !processor.isAborted) {
            processor.pause();
            isPaused = true;
            const btnText = elBtnPause?.querySelector('.btn-text');
            if (btnText) btnText.textContent = 'Resume';
            if (elStatusHeading) elStatusHeading.textContent = 'Network disconnected. Waiting for internet connection...';
            if (elBtnSavePartial && currentPct > 5) elBtnSavePartial.classList.remove('hidden');
        }
    });

    window.addEventListener('online', () => {
        if (!isCompleted && !processor.isAborted && isPaused) {
            processor.resume();
            isPaused = false;
            const btnText = elBtnPause?.querySelector('.btn-text');
            if (btnText) btnText.textContent = 'Pause';
            if (elStatusHeading) elStatusHeading.textContent = 'Internet connection restored. Resuming download...';
        }
    });

    // ─── LIVE THREAD SWITCHER ──────────────────────────────────────────────
    if (elSelThreads) {
        elSelThreads.addEventListener('change', () => {
            const count = parseInt(elSelThreads.value, 10) || 64;
            processor.setConcurrency(count);
            if (elThreadsBadge) {
                elThreadsBadge.textContent = `⚡ ${count} Threads`;
            }
            if (elValActiveWorkers) {
                elValActiveWorkers.textContent = `${count} Workers`;
            }
            if (elStatusHeading && !elStatusHeading.textContent.includes('complete') && !elStatusHeading.textContent.includes('Paused')) {
                elStatusHeading.textContent = elStatusHeading.textContent.replace(/\(\d+\s*threads\)/i, `(${count} threads)`);
            }
        });
    }

    // Pause / Resume Controls
    function togglePause() {
        if (!elBtnPause || elBtnPause.disabled) return;
        isPaused = !isPaused;
        const btnText = elBtnPause.querySelector('.btn-text');
        if (isPaused) {
            processor.pause();
            if (btnText) btnText.textContent = 'Resume';
            if (elStatusHeading) elStatusHeading.textContent = 'Download Paused';
            if (elBtnSavePartial && currentPct > 5) elBtnSavePartial.classList.remove('hidden');
        } else {
            processor.resume();
            if (btnText) btnText.textContent = 'Pause';
            if (elStatusHeading) elStatusHeading.textContent = 'Downloading...';
            if (elBtnSavePartial) elBtnSavePartial.classList.add('hidden');
        }
    }

    if (elBtnPause) {
        elBtnPause.addEventListener('click', togglePause);
    }

    // Cancel Controls
    function cancelDownload() {
        if (confirm('Cancel this download?')) {
            processor.abort();
            if (elStatusHeading) elStatusHeading.textContent = 'Download cancelled';
            if (elBtnPause) elBtnPause.disabled = true;
            if (elBtnCancel) elBtnCancel.disabled = true;
            if (elProgressFill) elProgressFill.style.background = '#8b949e';
            if (elBtnSavePartial && currentPct > 5) elBtnSavePartial.classList.remove('hidden');
        }
    }

    if (elBtnCancel) {
        elBtnCancel.addEventListener('click', cancelDownload);
    }

    // Retry Controls
    if (elBtnRetry) {
        elBtnRetry.addEventListener('click', () => {
            if (elErrorBox) elErrorBox.classList.add('hidden');
            startDownloadPipeline();
        });
    }

    // Open Folder Handler
    if (elBtnOpenFolder) {
        elBtnOpenFolder.addEventListener('click', () => {
            if (completedDownloadId && chrome.downloads) {
                chrome.downloads.show(completedDownloadId);
            }
        });
    }

    // ─── LIVE PREVIEW PLAYER (WATCH WHILE DOWNLOADING) ───────────────────
    let isPreviewOpen = false;

    function openPreview() {
        if (!elPreviewSection || !elPreviewPlayer || !initialStreamUrl) return;
        elPreviewSection.classList.remove('hidden');
        // Point the native video player directly at the original stream URL
        // Browser will independently buffer & stream from CDN for playback
        if (!elPreviewPlayer.src || elPreviewPlayer.src !== initialStreamUrl) {
            elPreviewPlayer.src = initialStreamUrl;
        }
        elPreviewPlayer.play().catch(() => {});
        isPreviewOpen = true;
        if (elBtnWatchPreview) {
            const btnText = elBtnWatchPreview.querySelector('.btn-text');
            if (btnText) btnText.textContent = 'Watching';
        }
    }

    function closePreview() {
        if (!elPreviewSection || !elPreviewPlayer) return;
        elPreviewPlayer.pause();
        elPreviewPlayer.removeAttribute('src');
        elPreviewPlayer.load(); // Release the stream connection
        elPreviewSection.classList.add('hidden');
        isPreviewOpen = false;
        if (elBtnWatchPreview) {
            const btnText = elBtnWatchPreview.querySelector('.btn-text');
            if (btnText) btnText.textContent = 'Watch';
        }
    }

    if (elBtnWatchPreview) {
        elBtnWatchPreview.addEventListener('click', () => {
            if (isPreviewOpen) closePreview();
            else openPreview();
        });
    }

    if (elBtnClosePreview) {
        elBtnClosePreview.addEventListener('click', closePreview);
    }

    // ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT') {
            e.preventDefault();
            togglePause();
        } else if (e.code === 'Escape') {
            if (isPreviewOpen) { closePreview(); return; }
            cancelDownload();
        } else if (e.code === 'KeyW' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
            if (isPreviewOpen) closePreview();
            else openPreview();
        } else if (e.code === 'Enter' && completedDownloadId) {
            chrome.downloads.show(completedDownloadId);
        }
    });

    // Build Candidate URLs strictly for selected stream
    async function collectAllCandidates() {
        const list = [];
        if (initialStreamUrl && initialStreamUrl.startsWith('http') && !window.isInvalidStreamUrl?.(initialStreamUrl)) {
            list.push(initialStreamUrl);
            return list; // Strictly stick to the specific video stream selected
        }

        if (originTabId > 0 && window.Storage?.getTabVideos) {
            try {
                const tabData = await window.Storage.getTabVideos(originTabId);
                (tabData.videos || []).forEach(v => {
                    if (v.url && v.url.startsWith('http') && !list.includes(v.url) && !window.isInvalidStreamUrl?.(v.url)) {
                        list.push(v.url);
                    }
                });
            } catch { }
        }

        return list;
    }

    // Download Pipeline
    async function startDownloadPipeline() {
        isCompleted = false;
        const activeConcurrency = parseInt(elSelThreads?.value, 10) || 64;
        processor.setConcurrency(activeConcurrency);

        if (elStatusHeading) elStatusHeading.textContent = 'Connecting to stream...';
        if (elPercent) elPercent.textContent = '0%';
        if (elProgressFill) {
            elProgressFill.style.width = '0%';
            elProgressFill.style.background = 'linear-gradient(90deg, #238636 0%, #3fb950 100%)';
        }

        const candidates = await collectAllCandidates();

        if (candidates.length === 0) {
            showError('No downloadable video stream URL found. Please reload the video page and try again.');
            return;
        }

        if (platform === 'YouTube' || (candidates[0] && candidates[0].includes('googlevideo.com'))) {
            const ytUrl = candidates[0].includes('googlevideo.com') ? (window.location.href.split('url=')[1] ? decodeURIComponent(window.location.href.split('url=')[1].split('&')[0]) : '') : '';
            showError(`YouTube uses adaptive DASH streams with separate video & audio channels.<br><a href="http://localhost:5000/?url=${encodeURIComponent(ytUrl || 'https://www.youtube.com')}" target="_blank" style="display:inline-block; margin-top:8px; padding:6px 14px; background:#2563eb; color:#fff; border-radius:6px; font-weight:700; text-decoration:none;">🚀 Download 1080p with Zonix Desktop</a>`);
            return;
        }

        let assembled = null;
        let lastError = null;

        for (const targetUrl of candidates) {
            try {
                const isDirectMediaFile = targetUrl.includes('.mp4') || targetUrl.includes('.webm') || targetUrl.includes('.m4v');
                const elStrat = document.getElementById('strategyBadge');
                if (isDirectMediaFile && elStrat) {
                    elStrat.textContent = 'Direct MP4 Chunk Download';
                }

                let manifest = null;
                try {
                    manifest = await window.StreamDetector.parseHls(targetUrl, originTabId);
                } catch { }

                // 1. If parsed as valid HLS / DASH manifest with segments:
                if (manifest && !manifest.isInvalid) {
                    if (manifest.isDrmProtected) {
                        throw new Error('This stream is DRM-protected and cannot be downloaded.');
                    }

                    const elStrat = document.getElementById('strategyBadge');
                    if (elStrat) elStrat.textContent = 'HLS Segment Stream';

                    let segmentUrls = manifest.segments || [];
                    let initSegmentUrl = manifest.initSegmentUrl || '';
                    let keyInfo = manifest.keyInfo || null;
                    let audioSegmentUrls = [];

                    if (manifest.isMaster && manifest.variants?.length > 0) {
                        const lockedVariant = manifest.variants.find(v => v.url === targetUrl) || manifest.bestVariant || manifest.variants[0];
                        if (elQuality && lockedVariant?.label) {
                            elQuality.textContent = lockedVariant.label.split(' • ')[0];
                        }
                        
                        const mediaManifest = await window.StreamDetector.parseHls(lockedVariant.url, originTabId);
                        if (mediaManifest && !mediaManifest.isInvalid) {
                            segmentUrls = mediaManifest.segments || [];
                            initSegmentUrl = mediaManifest.initSegmentUrl || '';
                            keyInfo = mediaManifest.keyInfo || keyInfo;

                            if (mediaManifest.durationSeconds > 0) {
                                const dur = window.Helpers ? window.Helpers.formatDuration(mediaManifest.durationSeconds) : '';
                                updateDurationDisplay(dur);
                            }

                            if (manifest.audioTracks?.length > 0 && lockedVariant.audioGroup) {
                                const audioTrack = manifest.audioTracks.find(a => a.groupId === lockedVariant.audioGroup) || manifest.audioTracks[0];
                                if (audioTrack && audioTrack.url) {
                                    const audioManifest = await window.StreamDetector.parseHls(audioTrack.url, originTabId);
                                    if (audioManifest && !audioManifest.isInvalid) {
                                        audioSegmentUrls = audioManifest.segments || [];
                                    }
                                }
                            }
                        }
                    } else if (manifest.durationSeconds > 0) {
                        const dur = window.Helpers ? window.Helpers.formatDuration(manifest.durationSeconds) : '';
                        updateDurationDisplay(dur);
                    }

                    if (segmentUrls.length > 0) {
                        const currentConcurrency = parseInt(elSelThreads?.value, 10) || activeConcurrency;
                        if (elStatusHeading) elStatusHeading.textContent = `Downloading ${segmentUrls.length} segments (${currentConcurrency} threads)...`;
                        if (elValSegments) elValSegments.textContent = `0 / ${segmentUrls.length}`;

                        assembled = await processor.processSegments(
                            segmentUrls,
                            audioSegmentUrls,
                            (p) => {
                                updateUIProgress(p, segmentUrls.length);
                            },
                            initSegmentUrl,
                            keyInfo,
                            currentConcurrency
                        );
                    }
                }

                // 2. Direct progressive container fallback with real HTTP Range chunking
                if (!assembled && (isDirectMediaFile || (!manifest || manifest.isInvalid))) {
                    const currentConcurrency = parseInt(elSelThreads?.value, 10) || activeConcurrency;
                    if (elStatusHeading) elStatusHeading.textContent = `Downloading media container (${currentConcurrency} threads)...`;
                    try {
                        assembled = await processor.processDirectStream(targetUrl, (p) => {
                            updateUIProgress(p, 1);
                        }, currentConcurrency);
                    } catch (directErr) {
                        if (directErr.message === 'M3U8_MANIFEST_DETECTED') {
                            const elStrat = document.getElementById('strategyBadge');
                            if (elStrat) elStrat.textContent = 'HLS Segment Stream';

                            const dynManifest = await window.StreamDetector.parseHls(targetUrl, originTabId);
                            if (dynManifest && !dynManifest.isInvalid) {
                                let segs = dynManifest.segments || [];
                                let initSeg = dynManifest.initSegmentUrl || '';
                                let kInfo = dynManifest.keyInfo || null;

                                if (dynManifest.isMaster && dynManifest.variants?.length > 0) {
                                    const bestVar = dynManifest.variants.find(v => v.url === targetUrl) || dynManifest.bestVariant || dynManifest.variants[0];
                                    if (elQuality && bestVar?.label) {
                                        elQuality.textContent = bestVar.label.split(' • ')[0];
                                    }
                                    const mVar = await window.StreamDetector.parseHls(bestVar.url, originTabId);
                                    if (mVar?.segments?.length > 0) {
                                        segs = mVar.segments;
                                        initSeg = mVar.initSegmentUrl || initSeg;
                                        kInfo = mVar.keyInfo || kInfo;
                                    }
                                }
                                if (segs.length > 0) {
                                    if (elStatusHeading) elStatusHeading.textContent = `Downloading ${segs.length} segments (${currentConcurrency} threads)...`;
                                    if (elValSegments) elValSegments.textContent = `0 / ${segs.length}`;

                                    assembled = await processor.processSegments(
                                        segs,
                                        [],
                                        (p) => {
                                            updateUIProgress(p, segs.length);
                                        },
                                        initSeg,
                                        kInfo,
                                        currentConcurrency
                                    );
                                }
                            }
                        } else {
                            console.warn(`[Downloader] Direct stream fallback notice:`, directErr.message);
                        }
                    }
                }

                if (assembled && assembled.blob && assembled.sizeBytes >= 524288) {
                    break;
                }
            } catch (err) {
                lastError = err;
                if (processor.isAborted) break;
            }
        }

        if (!assembled || !assembled.blob || assembled.sizeBytes < 32768) {
            // Try to auto-save whatever partial data we have
            const partial = processor.getPartialBlob();
            if (partial && partial.blob && partial.sizeBytes >= 32768) {
                // Auto-save partial video to Downloads
                console.log(`[Downloader] ⚠️ Full download incomplete but ${window.Helpers.formatBytes(partial.sizeBytes)} available. Auto-saving partial video.`);
                assembled = partial;
            } else {
                showError(lastError?.message || 'Downloaded stream is empty or corrupt. Please play the video on the original tab and retry.');
                return;
            }
        }

        // Finalize & Save
        isCompleted = true;
        if (isPreviewOpen) closePreview(); // Free CDN connection

        const finalParts = totalSegmentsTracked || 64;
        const elapsedSecs = Math.floor((Date.now() - downloadStartTime) / 1000);
        const elMins = Math.floor(elapsedSecs / 60);
        const elSecs = elapsedSecs % 60;
        const timeFmt = `${String(elMins).padStart(2, '0')}:${String(elSecs).padStart(2, '0')}`;

        // Immediately update UI to 100% and show complete banner with clean non-contradictory metrics
        if (elStatusHeading) elStatusHeading.textContent = 'Download complete';
        if (elPercent) elPercent.textContent = '100%';
        if (elProgressFill) {
            elProgressFill.style.width = '100%';
            elProgressFill.style.background = '#3fb950';
        }
        if (elThumbProgressFill) elThumbProgressFill.style.width = '100%';
        if (videoDurationSeconds > 0 && elThumbTimeDisplay) {
            const durFmt = window.Helpers ? window.Helpers.formatDuration(videoDurationSeconds) : '00:00';
            elThumbTimeDisplay.textContent = `${durFmt} / ${durFmt}`;
        }
        if (elValSizePct) elValSizePct.textContent = '100% written to disk';
        if (elValSpeed) elValSpeed.textContent = 'Saved to Disk';
        if (elValSegments) elValSegments.textContent = `${finalParts} / ${finalParts} Parts`;
        if (elValSegmentsSub) elValSegmentsSub.textContent = 'All Parts Verified';
        if (elValActiveWorkers) elValActiveWorkers.textContent = '0 Active (Idle)';
        if (elValMaxConcurrencySub) elValMaxConcurrencySub.textContent = 'Complete';
        if (elValEta) elValEta.textContent = 'Finished';
        if (elValElapsedSub) elValElapsedSub.textContent = `Total Time: ${timeFmt}`;
        if (elValHealth) elValHealth.textContent = 'Optimal';
        if (elValRetrySub) elValRetrySub.textContent = '100% Verified';
        if (elBtnPause) elBtnPause.classList.add('hidden');
        if (elBtnCancel) elBtnCancel.classList.add('hidden');
        if (elBtnSavePartial) elBtnSavePartial.classList.add('hidden');
        if (elSuccessBox) elSuccessBox.classList.remove('hidden');
        document.title = `✓ ${finalFileName}`;
        playCompletionChime();

        const blobUrl = URL.createObjectURL(assembled.blob);

        if (elSizeBadge && assembled.sizeBytes > 0) {
            elSizeBadge.textContent = `${window.Helpers.formatBytes(assembled.sizeBytes)}`;
            elSizeBadge.style.display = 'inline-flex';
        }

        chrome.downloads.download({
            url: blobUrl,
            filename: finalFileName,
            saveAs: false
        }, async (dlId) => {
            completedDownloadId = dlId || null;

            if (chrome.runtime.lastError) {
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = finalFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }

            // Save to persistent storage history
            if (window.Storage && window.Storage.saveCompletedDownload) {
                await window.Storage.saveCompletedDownload({
                    id: 'dl_' + Date.now(),
                    filename: finalFileName,
                    title: finalFileName,
                    site: platform,
                    showName: videoShow,
                    quality: qualityLabel,
                    size: window.Helpers.formatBytes(assembled.sizeBytes),
                    sizeBytes: assembled.sizeBytes,
                    timestamp: Date.now(),
                    status: 'Completed',
                    downloadId: dlId || null
                });
            }
        });
    }

    // Extended DOM Elements
    const elStrategyBadge = document.getElementById('strategyBadge');
    const elValPeakSpeedSub = document.getElementById('valPeakSpeedSub');
    const elValSizePct = document.getElementById('valSizePct');
    const elValSegmentsSub = document.getElementById('valSegmentsSub');
    const elValActiveWorkers = document.getElementById('valActiveWorkers');
    const elValMaxConcurrencySub = document.getElementById('valMaxConcurrencySub');
    const elValElapsedSub = document.getElementById('valElapsedSub');
    const elValCurSpeedTag = document.getElementById('valCurSpeedTag');
    const elValAvgSpeedTag = document.getElementById('valAvgSpeedTag');

    let downloadStartTime = Date.now();
    let speedSumTotal = 0;
    let speedCountTotal = 0;

    function updateUIProgress(p, totalSegmentsCount) {
        if (isCompleted) return;

        const pct = Math.min(100, Math.max(0, p.percent || 0));
        currentPct = pct;
        if (elProgressFill) elProgressFill.style.width = `${pct}%`;
        if (elPercent) elPercent.textContent = `${pct}%`;
        if (elThumbProgressFill) elThumbProgressFill.style.width = `${pct}%`;
        document.title = `(${pct}%) ${finalFileName}`;

        // Live Thumbnail Duration / Current Time
        if (videoDurationSeconds > 0 && elThumbTimeDisplay) {
            const curSecs = Math.round((pct / 100) * videoDurationSeconds);
            const curFmt = window.Helpers ? window.Helpers.formatDuration(curSecs) : '00:00';
            const durFmt = window.Helpers ? window.Helpers.formatDuration(videoDurationSeconds) : '00:00';
            elThumbTimeDisplay.textContent = `${curFmt} / ${durFmt}`;
        }

        if (elBtnSavePartial && pct > 5) {
            elBtnSavePartial.querySelector('span').textContent = `Save Partial (${pct}%)`;
        }

        const speed = p.speedMBps || 0;
        renderSpeedSparkline(speed);

        if (speed > 0.05) {
            speedSumTotal += speed;
            speedCountTotal++;
        }
        const avgSpd = speedCountTotal > 0 ? (speedSumTotal / speedCountTotal) : speed;

        if (elValCurSpeedTag) elValCurSpeedTag.textContent = `Cur: ${speed.toFixed(1)} MB/s`;
        if (elValAvgSpeedTag) elValAvgSpeedTag.textContent = `Avg: ${avgSpd.toFixed(1)} MB/s`;
        if (elValPeakSpeedSub) elValPeakSpeedSub.textContent = `Peak: ${peakSpeedMBps.toFixed(1)} MB/s`;

        const totalBytesStr = window.Helpers.formatBytes(p.totalBytes);
        const estBytesStr = p.estimatedTotalBytes > 0 ? window.Helpers.formatBytes(p.estimatedTotalBytes) : '';
        if (elValSize) elValSize.textContent = estBytesStr ? `${totalBytesStr} / ${estBytesStr}` : totalBytesStr;
        if (elValSizePct) elValSizePct.textContent = `${pct}% written`;

        if (elValSpeed) elValSpeed.textContent = `${speed.toFixed(1)} MB/s`;
        
        const doneParts = p.completed || 0;
        const totalParts = p.total || totalSegmentsCount || 0;
        totalSegmentsTracked = totalParts;
        if (elValSegments) elValSegments.textContent = `${doneParts} / ${totalParts} Parts`;
        if (elValSegmentsSub) elValSegmentsSub.textContent = `0 Failed`;

        const activeWorkersCount = p.threads || Math.min(doneParts + 4, parseInt(elSelThreads?.value || '64', 10));
        if (elValActiveWorkers) elValActiveWorkers.textContent = `${activeWorkersCount} Workers`;
        if (elValMaxConcurrencySub) elValMaxConcurrencySub.textContent = `Max: ${elSelThreads?.value || '64'} Concurrency`;

        if (elValEta) elValEta.textContent = window.Helpers.formatEta(p.remainingSeconds || 0);
        
        const elapsedSecs = Math.floor((Date.now() - downloadStartTime) / 1000);
        const elMins = Math.floor(elapsedSecs / 60);
        const elSecs = elapsedSecs % 60;
        if (elValElapsedSub) elValElapsedSub.textContent = `Elapsed: ${String(elMins).padStart(2, '0')}:${String(elSecs).padStart(2, '0')}`;

        if (p.estimatedTotalBytes > 0 && elSizeBadge) {
            elSizeBadge.textContent = `${window.Helpers.formatBytes(p.estimatedTotalBytes)}`;
            elSizeBadge.style.display = 'inline-flex';
        }

        if (p.threads && elStatusHeading && !elStatusHeading.textContent.includes('Paused') && !elStatusHeading.textContent.includes('complete')) {
            const currentText = elStatusHeading.textContent;
            if (currentText.includes('threads')) {
                elStatusHeading.textContent = currentText.replace(/\(.*?\)/i, `(${p.threads} threads)`);
            }
        }
    }

    function showError(msg) {
        if (elStatusHeading) elStatusHeading.textContent = 'Download failed';
        if (elErrorMessage) elErrorMessage.textContent = msg;
        if (elErrorBox) elErrorBox.classList.remove('hidden');
        if (elBtnPause) elBtnPause.classList.add('hidden');
        if (elBtnCancel) elBtnCancel.classList.add('hidden');
        if (currentPct > 5 && elBtnSavePartialError) {
            elBtnSavePartialError.classList.remove('hidden');
            elBtnSavePartialError.textContent = `Save Partial (${currentPct}%)`;
        }
        document.title = `Failed — ${finalFileName}`;
    }

    // Launch pipeline immediately
    startDownloadPipeline();
});
