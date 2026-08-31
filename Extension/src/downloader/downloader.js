// src/downloader/downloader.js — Dedicated High-Speed Tab Downloader Engine with Multi-Candidate Fallback (Manifest V3)

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const initialStreamUrl = urlParams.get('url') || '';
    const videoTitle = urlParams.get('title') || 'Video';
    const videoShow = urlParams.get('showName') || videoTitle;
    const videoSub = urlParams.get('subtitle') || '';
    const qualityLabel = urlParams.get('quality') || '1080p Full HD';
    const platform = urlParams.get('platform') || 'PixelFlix';
    const thumbnail = urlParams.get('thumbnail') || '';
    const originTabId = parseInt(urlParams.get('tabId') || '0', 10);

    // DOM Elements
    const elTitle = document.getElementById('videoTitle');
    const elSubtitle = document.getElementById('videoSubtitle');
    const elPlatform = document.getElementById('platformBadge');
    const elQuality = document.getElementById('qualityBadge');
    const elFilename = document.getElementById('targetFilename');
    const elThumbBox = document.getElementById('thumbBox');
    const elStatusHeading = document.getElementById('statusHeading');
    const elStatusPulse = document.getElementById('statusPulse');
    const elPercent = document.getElementById('percentCounter');
    const elProgressFill = document.getElementById('progressFill');
    const elValSize = document.getElementById('valSize');
    const elValSpeed = document.getElementById('valSpeed');
    const elValSegments = document.getElementById('valSegments');
    const elValEta = document.getElementById('valEta');
    const elBtnPause = document.getElementById('btnPause');
    const elBtnCancel = document.getElementById('btnCancel');
    const elErrorBox = document.getElementById('errorBox');
    const elErrorMessage = document.getElementById('errorMessage');
    const elBtnRetry = document.getElementById('btnRetry');
    const elSuccessBox = document.getElementById('successBox');
    const elBtnOpenFolder = document.getElementById('btnOpenFolder');

    // Populate Initial Metadata
    elTitle.textContent = videoShow || videoTitle;
    elSubtitle.textContent = videoSub || `Source: ${platform}`;
    elPlatform.textContent = platform;
    elQuality.textContent = `⭐ ${qualityLabel}`;

    const videoObj = {
        title: videoTitle,
        showName: videoShow,
        subtitle: videoSub,
        platform: platform,
        season: urlParams.get('season') ? parseInt(urlParams.get('season'), 10) : undefined,
        episode: urlParams.get('episode') ? parseInt(urlParams.get('episode'), 10) : undefined,
        episodeTitle: urlParams.get('episodeTitle') || ''
    };

    const finalFileName = (window.FilenameGenerator && window.FilenameGenerator.generate(videoObj, qualityLabel)) || (videoTitle + '.mp4');
    elFilename.textContent = finalFileName;
    document.title = `Downloading (${0}%) — ${finalFileName}`;

    if (thumbnail) {
        elThumbBox.innerHTML = `<img src="${thumbnail}" alt="Thumbnail">`;
    }

    const processor = new window.MediaProcessor();
    let isPaused = false;
    let completedDownloadId = null;

    // Pause / Resume handler
    elBtnPause.addEventListener('click', () => {
        isPaused = !isPaused;
        if (isPaused) {
            processor.pause();
            elBtnPause.querySelector('.btn-text').textContent = 'Resume Download';
            elBtnPause.querySelector('.icon').textContent = '▶️';
            elStatusHeading.textContent = 'Download Paused';
            elStatusPulse.style.background = '#eab308';
            elStatusPulse.style.boxShadow = '0 0 10px #eab308';
        } else {
            processor.resume();
            elBtnPause.querySelector('.btn-text').textContent = 'Pause Download';
            elBtnPause.querySelector('.icon').textContent = '⏸️';
            elStatusHeading.textContent = 'Downloading media segments at full speed...';
            elStatusPulse.style.background = '#3b82f6';
            elStatusPulse.style.boxShadow = '0 0 10px #3b82f6';
        }
    });

    // Cancel handler
    elBtnCancel.addEventListener('click', () => {
        if (confirm('Are you sure you want to cancel this download?')) {
            processor.abort();
            elStatusHeading.textContent = 'Download Cancelled';
            elStatusPulse.style.background = '#ef4444';
            elProgressFill.style.background = '#ef4444';
            elBtnPause.disabled = true;
            elBtnCancel.disabled = true;
        }
    });

    // Retry handler
    elBtnRetry.addEventListener('click', () => {
        elErrorBox.classList.add('hidden');
        startDownloadPipeline();
    });

    // Open Folder handler
    elBtnOpenFolder.addEventListener('click', () => {
        if (completedDownloadId && chrome.downloads) {
            chrome.downloads.show(completedDownloadId);
        }
    });

    // Build complete multi-candidate stream list
    async function collectAllCandidates() {
        const list = [];
        if (initialStreamUrl && initialStreamUrl.startsWith('http')) {
            list.push(initialStreamUrl);
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

        // Also query active storage keys
        try {
            const allStorage = await chrome.storage.local.get(null);
            Object.keys(allStorage).forEach(k => {
                if (k.startsWith('tab_media_')) {
                    const arr = allStorage[k];
                    if (Array.isArray(arr)) {
                        arr.forEach(v => {
                            if (v.url && v.url.startsWith('http') && !list.includes(v.url) && !window.isInvalidStreamUrl?.(v.url)) {
                                list.push(v.url);
                            }
                        });
                    }
                }
            });
        } catch { }

        return list;
    }

    // Download Pipeline
    async function startDownloadPipeline() {
        elStatusHeading.textContent = 'Connecting to stream & evaluating candidates...';
        elStatusPulse.style.background = '#3b82f6';
        elProgressFill.style.background = 'linear-gradient(90deg, #2563eb, #38bdf8)';
        elBtnPause.disabled = false;
        elBtnCancel.disabled = false;

        const candidateUrls = await collectAllCandidates();
        console.log('[Downloader] 📋 Evaluating candidate streams:', candidateUrls);

        if (candidateUrls.length === 0) {
            showError('No valid media stream URL was found. Please play the video for 2 seconds and retry.');
            return;
        }

        let assembled = null;
        let lastError = null;

        // Iterate through candidates until a valid stream downloads
        for (let i = 0; i < candidateUrls.length; i++) {
            const targetUrl = candidateUrls[i];
            console.log(`[Downloader] 🚀 [TRYING CANDIDATE ${i + 1}/${candidateUrls.length}] ${targetUrl}`);
            elStatusHeading.textContent = `Analyzing candidate stream ${i + 1}/${candidateUrls.length}...`;

            try {
                // 1. Parse HLS Manifest (supports master playlists, variant selection & query tokens)
                let manifest = null;
                try {
                    manifest = await window.StreamDetector.parseHls(targetUrl, originTabId);
                } catch (err) {
                    console.warn(`[Downloader] Candidate ${i + 1} parse notice:`, err.message);
                }

                // If candidate returned non-media document (XML/HTML), discard immediately and proceed to next candidate
                if (manifest && manifest.isInvalid) {
                    console.warn(`[Downloader] ❌ Candidate ${i + 1} is a non-media XML/HTML document. Discarding...`);
                    throw new Error('Candidate returned non-media document (XML/HTML).');
                }

                if (manifest && !manifest.isInvalid) {
                    if (manifest.isDrmProtected) {
                        throw new Error('This stream is DRM-protected and cannot be downloaded.');
                    }

                    let segmentUrls = manifest.segments || [];
                    let initSegmentUrl = manifest.initSegmentUrl || '';
                    let keyInfo = manifest.keyInfo || null;
                    let audioSegmentUrls = [];

                    if (manifest.isMaster && manifest.variants?.length > 0) {
                        const lockedVariant = manifest.variants.find(v => v.url === targetUrl) || manifest.bestVariant || manifest.variants[0];
                        console.log(`[Downloader] 🎯 Selected Variant: ${lockedVariant.label} -> ${lockedVariant.url}`);
                        
                        const mediaManifest = await window.StreamDetector.parseHls(lockedVariant.url, originTabId);
                        if (mediaManifest.isInvalid) {
                            throw new Error('Variant playlist returned non-media document.');
                        }

                        segmentUrls = mediaManifest.segments || [];
                        initSegmentUrl = mediaManifest.initSegmentUrl || '';
                        keyInfo = mediaManifest.keyInfo || keyInfo;

                        if (manifest.audioTracks?.length > 0 && lockedVariant.audioGroup) {
                            const audioTrack = manifest.audioTracks.find(a => a.groupId === lockedVariant.audioGroup) || manifest.audioTracks[0];
                            if (audioTrack && audioTrack.url) {
                                const audioManifest = await window.StreamDetector.parseHls(audioTrack.url, originTabId);
                                audioSegmentUrls = audioManifest.segments || [];
                            }
                        }
                    }

                    if (segmentUrls.length > 0) {
                        elStatusHeading.textContent = `Downloading ${segmentUrls.length} high-speed media segments...`;
                        elValSegments.textContent = `0 / ${segmentUrls.length}`;

                        assembled = await processor.processSegments(
                            segmentUrls,
                            audioSegmentUrls,
                            (p) => {
                                updateUIProgress(p, segmentUrls.length);
                            },
                            initSegmentUrl,
                            keyInfo
                        );
                    }
                }

                // 2. Direct MP4 Stream Download Fallback (ONLY if target is direct media file, not XML/HTML)
                const isDirectMediaFile = targetUrl.includes('.mp4') || targetUrl.includes('.webm') || targetUrl.includes('.m4v') || targetUrl.includes('videoplayback');
                if (!assembled && isDirectMediaFile) {
                    elStatusHeading.textContent = 'Streaming direct media container...';
                    assembled = await processor.processDirectStream(targetUrl, (p) => {
                        updateUIProgress(p, 1);
                    });
                }

                if (assembled && assembled.blob && assembled.sizeBytes >= 10240) {
                    console.log(`[Downloader] ✅ Candidate ${i + 1} succeeded (${(assembled.sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
                    break;
                }
            } catch (err) {
                console.warn(`[Downloader] ⚠️ Candidate ${i + 1} failed: ${err.message}`);
                lastError = err;
                if (processor.isAborted) break;
            }
        }

        if (!assembled || !assembled.blob || assembled.sizeBytes < 10240) {
            showError(lastError?.message || 'Downloaded stream is empty or corrupt. Please play the video and retry.');
            return;
        }

        // Finalize & Save
        elStatusHeading.textContent = 'Finalizing container & saving to disk...';
        const blobUrl = URL.createObjectURL(assembled.blob);

        chrome.downloads.download({
            url: blobUrl,
            filename: finalFileName,
            saveAs: false
        }, async (dlId) => {
            completedDownloadId = dlId || null;

            if (chrome.runtime.lastError) {
                console.warn('[Downloader] Chrome downloads API fallback:', chrome.runtime.lastError.message);
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
                    quality: qualityLabel.replace('⭐ Best Quality — ', ''),
                    size: window.Helpers.formatBytes(assembled.sizeBytes),
                    sizeBytes: assembled.sizeBytes,
                    timestamp: Date.now(),
                    status: 'Completed',
                    downloadId: dlId || null
                });
            }

            // Success UI
            elStatusHeading.textContent = '✓ Download Complete!';
            elStatusPulse.style.background = '#10b981';
            elStatusPulse.style.boxShadow = '0 0 15px #10b981';
            elProgressFill.style.background = '#10b981';
            elPercent.textContent = '100%';
            elProgressFill.style.width = '100%';
            elBtnPause.classList.add('hidden');
            elBtnCancel.classList.add('hidden');
            elSuccessBox.classList.remove('hidden');
            document.title = `✓ Complete — ${finalFileName}`;
        });
    }

    function updateUIProgress(p, totalSegmentsCount) {
        const pct = Math.min(100, Math.max(0, p.percent || 0));
        elProgressFill.style.width = `${pct}%`;
        elPercent.textContent = `${pct}%`;
        document.title = `(${pct}%) ${finalFileName}`;

        elValSize.textContent = `${window.Helpers.formatBytes(p.totalBytes)} / ${window.Helpers.formatBytes(p.estimatedTotalBytes)}`;
        elValSpeed.textContent = `${(p.speedMBps || 0).toFixed(1)} MB/s`;
        elValSegments.textContent = `${p.completed || 0} / ${p.total || totalSegmentsCount}`;
        elValEta.textContent = window.Helpers.formatEta(p.remainingSeconds || 0);
    }

    function showError(msg) {
        elStatusHeading.textContent = 'Download Failed';
        elStatusPulse.style.background = '#ef4444';
        elStatusPulse.style.boxShadow = '0 0 10px #ef4444';
        elErrorMessage.textContent = msg;
        elErrorBox.classList.remove('hidden');
        elBtnPause.classList.add('hidden');
        elBtnCancel.classList.add('hidden');
        document.title = `⚠️ Failed — ${finalFileName}`;
    }

    // Launch download immediately on tab open
    startDownloadPipeline();
});
