// popup.js — Popup UI Controller & Download Manager
import { HlsFetcher } from './hls-fetcher.js';

document.addEventListener('DOMContentLoaded', async () => {
    const videoList = document.getElementById('videoList');
    const emptyState = document.getElementById('emptyState');
    const detectedCountBadge = document.getElementById('detectedCountBadge');
    const completedSection = document.getElementById('completedSection');
    const completedList = document.getElementById('completedList');
    const btnRefresh = document.getElementById('btnRefresh');
    const btnClearAll = document.getElementById('btnClearAll');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    // Trigger in-page scan
    try { chrome.tabs.sendMessage(tab.id, { action: 'scanPage' }); } catch { }

    async function loadData() {
        chrome.runtime.sendMessage({ action: 'getTabVideos', tabId: tab.id }, (res) => {
            if (!res) return;

            const videos = res.videos || [];
            const completed = res.completed || [];

            detectedCountBadge.textContent = videos.length.toString();

            if (videos.length > 0) {
                emptyState.classList.add('hidden');
                videoList.classList.remove('hidden');
                renderVideoCards(videos);
            } else {
                emptyState.classList.remove('hidden');
                videoList.classList.add('hidden');
            }

            if (completed.length > 0) {
                completedSection.classList.remove('hidden');
                renderCompletedList(completed);
            } else {
                completedSection.classList.add('hidden');
            }
        });
    }

    await loadData();
    const pollInterval = setInterval(loadData, 1200);

    btnRefresh.addEventListener('click', async () => {
        try { chrome.tabs.sendMessage(tab.id, { action: 'scanPage' }); } catch { }
        await loadData();
    });

    btnClearAll.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'clearTabMedia', tabId: tab.id }, () => {
            loadData();
        });
    });

    function sanitizeFileName(name) {
        return (name || 'Video').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
    }

    function renderVideoCards(videos) {
        videoList.innerHTML = '';

        videos.forEach((video) => {
            const card = document.createElement('div');
            card.className = 'video-card';
            card.id = `card_${video.id}`;

            const thumbHtml = video.thumbnail
                ? `<img class="thumbnail-img" src="${video.thumbnail}" alt="thumb">`
                : `<span class="thumb-fallback">${video.format || 'MEDIA'}</span>`;

            const durationHtml = video.duration
                ? `<span class="duration-tag">${video.duration}</span>`
                : '';

            card.innerHTML = `
                <div class="card-left">
                    ${thumbHtml}
                    ${durationHtml}
                </div>
                <div class="card-center">
                    <div class="video-title" title="${video.title}">${video.title}</div>
                    <div class="meta-row">
                        <span class="format-pill">${video.format || 'MP4'}</span>
                        <span class="domain-text">${video.domain}</span>
                        <select class="quality-select hidden" id="qual_${video.id}">
                            <option value="">Auto Quality</option>
                        </select>
                    </div>
                    <div class="download-progress-container hidden" id="prog_box_${video.id}">
                        <div class="progress-track">
                            <div class="progress-fill" id="prog_bar_${video.id}" style="width: 0%;"></div>
                        </div>
                        <div class="progress-labels">
                            <span id="prog_text_${video.id}">Starting...</span>
                            <span id="prog_pct_${video.id}">0%</span>
                        </div>
                    </div>
                </div>
                <div class="card-right">
                    <button class="btn-download" id="btn_dl_${video.id}">
                        <span>⚡ Download</span>
                    </button>
                    <span class="error-text hidden" id="err_${video.id}"></span>
                </div>
            `;

            const dlBtn = card.querySelector(`#btn_dl_${video.id}`);
            const qualSelect = card.querySelector(`#qual_${video.id}`);
            const progBox = card.querySelector(`#prog_box_${video.id}`);
            const progBar = card.querySelector(`#prog_bar_${video.id}`);
            const progText = card.querySelector(`#prog_text_${video.id}`);
            const progPct = card.querySelector(`#prog_pct_${video.id}`);
            const errSpan = card.querySelector(`#err_${video.id}`);

            // If HLS, asynchronously inspect master playlist variants
            if (video.format === 'HLS' && !card.dataset.inspected) {
                card.dataset.inspected = 'true';
                const fetcher = new HlsFetcher();
                fetcher.parseManifest(video.url).then(parsed => {
                    if (parsed.isDrmProtected) {
                        dlBtn.disabled = true;
                        errSpan.textContent = 'DRM Protected';
                        errSpan.classList.remove('hidden');
                    } else if (parsed.isMaster && parsed.variants?.length > 0) {
                        qualSelect.innerHTML = '';
                        parsed.variants.forEach(v => {
                            const opt = document.createElement('option');
                            opt.value = v.url;
                            opt.textContent = v.label;
                            qualSelect.appendChild(opt);
                        });
                        qualSelect.classList.remove('hidden');
                    }
                }).catch(() => { });
            }

            dlBtn.addEventListener('click', async () => {
                dlBtn.disabled = true;
                errSpan.classList.add('hidden');
                progBox.classList.remove('hidden');

                const targetUrl = qualSelect.value || video.url;
                const safeTitle = sanitizeFileName(video.title);

                if (video.format === 'HLS') {
                    const fetcher = new HlsFetcher();

                    try {
                        progText.textContent = 'Parsing manifest...';
                        const manifest = await fetcher.parseManifest(targetUrl);

                        if (manifest.isDrmProtected) {
                            throw new Error('Download unavailable: DRM protected stream.');
                        }

                        let segmentUrls = manifest.segments || [];
                        if (manifest.isMaster && manifest.variants?.length > 0) {
                            const selectedVariantUrl = qualSelect.value || manifest.variants[0].url;
                            const mediaManifest = await fetcher.parseManifest(selectedVariantUrl);
                            segmentUrls = mediaManifest.segments || [];
                        }

                        if (segmentUrls.length === 0) {
                            throw new Error('No accessible segments found in stream.');
                        }

                        progText.textContent = `Downloading (${segmentUrls.length} chunks)...`;

                        const assembled = await fetcher.downloadAndAssemble(segmentUrls, (progress) => {
                            progBar.style.width = `${progress.percent}%`;
                            progPct.textContent = `${progress.percent}%`;
                            progText.textContent = `${progress.completed}/${progress.total} chunks (${formatBytes(progress.totalBytes)})`;
                        });

                        progText.textContent = 'Assembling final file...';
                        const blobUrl = URL.createObjectURL(assembled.blob);
                        const fileName = `${safeTitle}.${assembled.extension}`;

                        chrome.downloads.download({
                            url: blobUrl,
                            filename: fileName,
                            saveAs: false
                        }, (downloadId) => {
                            if (chrome.runtime.lastError) {
                                // Fallback to anchor click if chrome.downloads fails on blob URL
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = fileName;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                            }

                            chrome.runtime.sendMessage({
                                action: 'saveCompletedDownload',
                                item: {
                                    title: safeTitle,
                                    domain: video.domain,
                                    format: assembled.extension.toUpperCase(),
                                    timestamp: Date.now()
                                }
                            });

                            dlBtn.disabled = false;
                            progBox.classList.add('hidden');
                        });
                    } catch (err) {
                        dlBtn.disabled = false;
                        progBox.classList.add('hidden');
                        errSpan.textContent = err.message || 'Download unavailable for this stream.';
                        errSpan.classList.remove('hidden');
                    }
                } else {
                    // Direct MP4 / WebM download
                    try {
                        chrome.downloads.download({
                            url: targetUrl,
                            filename: `${safeTitle}.${video.format.toLowerCase()}`,
                            saveAs: false
                        });
                        dlBtn.disabled = false;
                        progBox.classList.add('hidden');
                    } catch (err) {
                        dlBtn.disabled = false;
                        progBox.classList.add('hidden');
                        errSpan.textContent = 'Download failed.';
                        errSpan.classList.remove('hidden');
                    }
                }
            });

            videoList.appendChild(card);
        });
    }

    function renderCompletedList(items) {
        completedList.innerHTML = '';
        items.slice(0, 5).forEach(item => {
            const div = document.createElement('div');
            div.className = 'completed-card';
            div.innerHTML = `
                <span class="comp-title" title="${item.title}">✓ ${item.title}</span>
                <span class="comp-badge">${item.format || 'MP4'}</span>
            `;
            completedList.appendChild(div);
        });
    }

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
});
