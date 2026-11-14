// src/content/floating-button.js — Disabled per user configuration (downloads managed exclusively via popup)
(function () {
    // Disabled: zero on-page DOM elements
    return;
    if (window.top !== window.self) return;
    if (window.__SZ_FLOATING_INJECTED__) return;
    window.__SZ_FLOATING_INJECTED__ = true;

    const ATTACHED_CLASS = 'sz-video-tracked';

    function createFloatingPill(videoEl) {
        // Prevent duplicate buttons on page
        const existing = document.querySelector('.sz-floating-btn-wrap');
        if (existing) return;

        const wrap = document.createElement('div');
        wrap.className = 'sz-floating-btn-wrap';
        wrap.setAttribute('data-sz-ignore', 'true');

        wrap.innerHTML = `
            <div class="sz-floating-btn-logo">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            </div>
            <span class="sz-floating-btn-title">SaveZonix</span>
            <span class="sz-floating-btn-badge">4K / HD</span>
            <div class="sz-floating-options">
                <div class="sz-floating-opt-item" data-quality="best">
                    <span>⚡ 4K / 1080p Ultra HD</span>
                </div>
                <div class="sz-floating-opt-item" data-quality="720p">
                    <span>🎬 720p Fast HD</span>
                </div>
                <div class="sz-floating-opt-item" data-quality="mp3">
                    <span>🎵 Audio Only (MP3)</span>
                </div>
            </div>
        `;

        function positionButton() {
            if (!videoEl || !videoEl.isConnected) {
                wrap.remove();
                return;
            }
            const rect = videoEl.getBoundingClientRect();
            // Don't show on tiny preview video thumbnails
            if (rect.width < 320 || rect.height < 180) {
                wrap.style.display = 'none';
                return;
            }
            wrap.style.display = 'inline-flex';
            // Anchor neatly to top-right corner of the video player like IDM
            const topPos = Math.max(14, rect.top + window.scrollY + 14);
            const rightOffset = (window.innerWidth - (rect.right + window.scrollX)) + 14;
            wrap.style.top = `${topPos}px`;
            wrap.style.right = `${Math.max(14, rightOffset)}px`;
            wrap.style.left = 'auto';
        }

        wrap.addEventListener('click', (e) => {
            e.stopPropagation();
            const opt = e.target.closest('.sz-floating-opt-item');
            const quality = opt ? opt.getAttribute('data-quality') : 'best';

            // Send download request directly to SaveZonix desktop or open local app
            const pageUrl = window.location.href;
            chrome.storage.local.get(['savezonix_backend_url', 'savezonix_backend_port'], (res) => {
                const baseUrl = res?.savezonix_backend_url || (res?.savezonix_backend_port ? `http://localhost:${res.savezonix_backend_port}` : 'http://localhost:50550');
                const targetUrl = `${baseUrl}/?url=${encodeURIComponent(pageUrl)}&quality=${encodeURIComponent(quality)}`;
                window.open(targetUrl, '_blank');
            });
        });

        document.body.appendChild(wrap);

        // Position tracking
        window.addEventListener('scroll', positionButton, { passive: true });
        window.addEventListener('resize', positionButton, { passive: true });
        const interval = setInterval(positionButton, 1000);
        positionButton();

        // Cleanup if video removed
        const observer = new MutationObserver(() => {
            if (!videoEl.isConnected) {
                clearInterval(interval);
                wrap.remove();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function scanForVideos() {
        const videos = document.querySelectorAll('video');
        videos.forEach(v => {
            if (v.classList.contains(ATTACHED_CLASS)) return;
            v.classList.add(ATTACHED_CLASS);
            createFloatingPill(v);
        });
    }

    // Passive observe
    setInterval(scanForVideos, 1500);
    scanForVideos();
})();
