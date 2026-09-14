// src/download/download-manager.js â Complete Validated Media Download Pipeline & Multi-Candidate Fallback (Universal)

(function (root) {
    function isInvalidMediaUrl(url) {
        if (!url || typeof url !== 'string' || url.trim() === '') return true;
        const clean = url.split('?')[0].toLowerCase();
        
        if (clean.endsWith('.htm') || 
            clean.endsWith('.html') || 
            clean.endsWith('.php') || 
            clean.endsWith('.asp') || 
            clean.endsWith('.aspx') || 
            clean.endsWith('.js') || 
            clean.endsWith('.css') || 
            clean.endsWith('.xml') || 
            clean.endsWith('.json') || 
            url.includes('instagram.com/reel/') || 
            url.includes('instagram.com/p/') || 
            url.includes('youtube.com/watch') || 
            url.includes('youtube.com/shorts')) {
            return true;
        }

        const lower = url.toLowerCase();
        if (lower.includes('trafficjunky') || 
            lower.includes('doubleclick') || 
            lower.includes('exoclick') || 
            lower.includes('/preroll') || 
            lower.includes('/ads/') ||
            lower.includes('format=xml') || 
            lower.includes('type=xml') || 
            lower.includes('output=xml') || 
            lower.includes('format=json') || 
            lower.includes('type=json') || 
            lower.includes('/api/player') || 
            lower.includes('/api/source') || 
            lower.includes('/api/stream') ||
            lower.includes('getsource')) {
            return true;
        }

        return false;
    }

    class DownloadManager {
        constructor() {
            this.activeProcessors = {};
        }

        pause(id) {
            if (this.activeProcessors[id]) {
                this.activeProcessors[id].pause();
            }
        }

        resume(id) {
            if (this.activeProcessors[id]) {
                this.activeProcessors[id].resume();
            }
        }

        cancel(id) {
            if (this.activeProcessors[id]) {
                this.activeProcessors[id].abort();
                delete this.activeProcessors[id];
            }
        }

        async startDownload(video, selectedQualityUrl, selectedQualityLabel, onProgress, tabId, requestedThreads = 4) {
            const finalFileName = (root.FilenameGenerator && root.FilenameGenerator.generate(video, selectedQualityLabel)) || (video.title + '.mp4');
            const threadCount = Math.max(1, Math.min(8, parseInt(requestedThreads || 4, 10)));

            console.log(`[StreamHelper] ð¬ [DOWNLOAD PIPELINE INITIATED] (${threadCount} threads)`);
            console.log(`[StreamHelper] ð¬ [FILE TARGET] "${finalFileName}"`);

            // Build candidate URL list
            let candidateUrls = [];
            if (selectedQualityUrl && !isInvalidMediaUrl(selectedQualityUrl)) candidateUrls.push(selectedQualityUrl);
            if (video.url && !candidateUrls.includes(video.url) && !isInvalidMediaUrl(video.url)) candidateUrls.push(video.url);

            if (tabId && root.Storage?.getTabVideos) {
                try {
                    const tabData = await root.Storage.getTabVideos(tabId);
                    (tabData.videos || []).forEach(v => {
                        if (v.url && v.url.startsWith('http') && !candidateUrls.includes(v.url) && !isInvalidMediaUrl(v.url)) {
                            candidateUrls.push(v.url);
                        }
                    });
                } catch { }
            }

            candidateUrls = candidateUrls.filter(u => !isInvalidMediaUrl(u));

            if (candidateUrls.length === 0) {
                console.error('[StreamHelper] â No valid media stream URLs found in candidates');
                throw new Error('Download unavailable: No accessible media stream found for this video. Please play the video for 2 seconds and retry.');
            }

            console.log(`[StreamHelper] ð [CANDIDATE STREAMS EVALUATING] ${candidateUrls.length} stream(s):`, candidateUrls);

            const processor = new root.MediaProcessor();
            this.activeProcessors[video.id] = processor;

            let assembled = null;
            let lastError = null;

            // Iterate through candidates until a valid media stream successfully downloads
            for (let i = 0; i < candidateUrls.length; i++) {
                const targetUrl = candidateUrls[i];
                console.log(`[StreamHelper] ð [TRYING CANDIDATE ${i + 1}/${candidateUrls.length}] ${targetUrl}`);

                try {
                    const isDirectMedia = targetUrl.includes('.mp4') || targetUrl.includes('.webm') || targetUrl.includes('.m4v') || targetUrl.includes('videoplayback');

                    let manifest = null;
                    if (!isDirectMedia || targetUrl.includes('.m3u8') || targetUrl.includes('/hls/')) {
                        try {
                            manifest = await root.StreamDetector.parseHls(targetUrl, tabId);
                        } catch {
                            manifest = null;
                        }
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
                            console.log(`[StreamHelper] ð¯ [SELECTED VARIANT] ${lockedVariant.label || 'Default'} -> ${lockedVariant.url}`);
                            
                            const mediaManifest = await root.StreamDetector.parseHls(lockedVariant.url, tabId);
                            if (mediaManifest && !mediaManifest.isInvalid) {
                                segmentUrls = mediaManifest.segments || [];
                                initSegmentUrl = mediaManifest.initSegmentUrl || '';
                                keyInfo = mediaManifest.keyInfo || keyInfo;

                                if (manifest.audioTracks?.length > 0 && lockedVariant.audioGroup) {
                                    const audioTrack = manifest.audioTracks.find(a => a.groupId === lockedVariant.audioGroup) || manifest.audioTracks[0];
                                    if (audioTrack && audioTrack.url) {
                                        const audioManifest = await root.StreamDetector.parseHls(audioTrack.url, tabId);
                                        if (audioManifest && !audioManifest.isInvalid) {
                                            audioSegmentUrls = audioManifest.segments || [];
                                        }
                                    }
                                }
                            }
                        }

                        if (segmentUrls.length > 0) {
                            assembled = await processor.processSegments(segmentUrls, audioSegmentUrls, (p) => {
                                if (tabId && root.Storage?.setActiveDownload) {
                                    root.Storage.setActiveDownload(tabId, { ...p, filename: finalFileName, isDownloading: true });
                                }
                                if (onProgress) onProgress(p);
                            }, initSegmentUrl, keyInfo, threadCount);
                        }
                    }

                    // 2. Direct MP4 Stream Download Fallback with Multi-Threaded Range Chunking
                    if (!assembled && (isDirectMedia || (!manifest || manifest.isInvalid))) {
                        assembled = await processor.processDirectStream(targetUrl, (p) => {
                            if (tabId && root.Storage?.setActiveDownload) {
                                root.Storage.setActiveDownload(tabId, { ...p, filename: finalFileName, isDownloading: true });
                            }
                            if (onProgress) onProgress(p);
                        }, threadCount);
                    }

                    if (assembled && assembled.blob && assembled.sizeBytes >= 2097152) {
                        console.log(`[StreamHelper] â [CANDIDATE ${i + 1} SUCCEEDED] Assembled ${(assembled.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
                        break;
                    }
                } catch (err) {
                    console.warn(`[StreamHelper] â ï¸ Candidate ${i + 1} failed: ${err.message}`);
                    lastError = err;
                    if (processor.isAborted) {
                        break;
                    }
                }
            }

            if (!assembled || !assembled.blob || assembled.sizeBytes < 2097152) {
                if (tabId && root.Storage?.setActiveDownload) {
                    await root.Storage.setActiveDownload(tabId, null);
                }
                delete this.activeProcessors[video.id];
                throw (lastError || new Error('Download failed: No valid media stream could be downloaded.'));
            }

            const blobUrl = URL.createObjectURL(assembled.blob);

            return new Promise((resolve, reject) => {
                chrome.downloads.download({
                    url: blobUrl,
                    filename: finalFileName,
                    saveAs: false
                }, async (dlId) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[StreamHelper] Native chrome.downloads fallback:', chrome.runtime.lastError.message);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = finalFileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    }

                    if (root.Storage?.saveCompletedDownload) {
                        await root.Storage.saveCompletedDownload({
                            id: 'dl_' + Date.now(),
                            filename: finalFileName,
                            title: finalFileName,
                            site: video.platform || 'PixelFlix',
                            showName: video.showName || video.title,
                            quality: selectedQualityLabel || '1080p',
                            size: root.Helpers ? root.Helpers.formatBytes(assembled.sizeBytes) : `${(assembled.sizeBytes / 1024 / 1024).toFixed(1)} MB`,
                            sizeBytes: assembled.sizeBytes,
                            timestamp: Date.now(),
                            status: 'Completed',
                            downloadId: dlId || null
                        });
                    }

                    if (tabId && root.Storage?.setActiveDownload) {
                        await root.Storage.setActiveDownload(tabId, null);
                    }

                    delete this.activeProcessors[video.id];
                    resolve({ success: true, downloadId: dlId, filename: finalFileName });
                });
            });
        }
    }

    root.DownloadManager = DownloadManager;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
