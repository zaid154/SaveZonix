// src/content/floating-button.js  IDM-Style Floating Video Downloader Overlay
(function () {
    if (window.__SZ_FLOATING_INJECTED__) return;
    window.__SZ_FLOATING_INJECTED__ = true;

    const ATTACHED_CLASS = 'sz-video-tracked';

    function createFloatingPill(videoEl) {
        const wrap = document.createElement('div');
        wrap.className = 'sz-floating-btn-wrap';
        wrap.setAttribute('data-sz-ignore', 'true');

        wrap.innerHTML = `
            <div class="sz-floating-btn-logo">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            </div>
            <span class="sz-floating-btn-title">SaveZonix</span>
            <span class="sz-floating-btn-badge">HD</span>
            <div class="sz-floating-options">
                <div class="sz-floating-opt-item" data-quality="best">?? Best Quality (1080p/4K)</div>
                <div class="sz-floating-opt-item" data-quality="720p">? Fast HD (720p)</div>
                <div class="sz-floating-opt-item" data-quality="mp3">?? Audio Only (MP3)</div>
            </div>
        `;

        function positionButton() {
            if (!videoEl || !videoEl.isConnected) {
                wrap.remove();
                return;
            }
            const rect = videoEl.getBoundingClientRect();
            if (rect.width < 160 || rect.height < 120) {
                wrap.style.display = 'none';
                return;
            }
            wrap.style.display = 'inline-flex';
            wrap.style.top = `${Math.max(10, rect.top + window.scrollY + 12)}px`;
            wrap.style.left = `${Math.max(10, rect.left + window.scrollX + 12)}px`;
        }

        wrap.addEventListener('click', (e) => {
            e.stopPropagation();
            const opt = e.target.closest('.sz-floating-opt-item');
            const quality = opt ? opt.getAttribute('data-quality') : 'best';

            // Send download request directly to SaveZonix desktop or open local app
            const pageUrl = window.location.href;
            const targetUrl = `http://localhost:5000/?url=${encodeURIComponent(pageUrl)}&quality=${encodeURIComponent(quality)}`;
            window.open(targetUrl, '_blank');
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
