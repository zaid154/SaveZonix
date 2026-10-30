// src/content/page-shield.js — SaveZonix Main-World Scriptlet
// Executes in "world": "MAIN" at document_start.
// Non-intrusive: Protects against unprompted popunders without poisoning DOM prototypes or breaking SPAs.

(function () {
    'use strict';

    if (window.__savezonix_page_shield_installed__) return;
    window.__savezonix_page_shield_installed__ = true;

    const currentHost = (window.location.hostname || '').toLowerCase();

    let lastAdBlockedNotificationTime = 0;
    function notifyBlocked(reason, url) {
        const now = Date.now();
        // Debounce notifications so high-frequency scanners do not explode badge count
        if (now - lastAdBlockedNotificationTime < 2000) return;
        lastAdBlockedNotificationTime = now;

        try {
            window.postMessage({
                source: 'savezonix-shield-main',
                action: 'shieldItemBlocked',
                reason: reason || 'ad_blocked',
                url: url || ''
            }, '*');
        } catch { }
    }

    // ─────────────────────────────────────────────────────────────
    // 1. Surgical window.open Pop-under Defuser
    // ─────────────────────────────────────────────────────────────
    const rawWindowOpen = window.open;
    window.open = function (url, target, features) {
        const urlStr = String(url || '').trim().toLowerCase();

        // Safe checks: allow internal/same-origin navigation or legitimate blank windows
        const isSameOrigin = !urlStr ||
            urlStr === 'about:blank' ||
            urlStr.startsWith('/') ||
            (urlStr.startsWith('http') && urlStr.includes(currentHost));

        const isKnownAdDomain = /footful|sisseth|thistly|enstatenewark|tumbekmetage|wyvercasus|chukchipias|imbutidi|monetag|adsterra|propeller|popads|popcash|exoclick|bet365|1xbet|deloton|onclkds|luglawhauls|whomeeno|gloaphoo|soodroab|vaheedra|poawoopt|propush|onclickalgo/i.test(urlStr);

        // Check if event is genuine direct user navigation vs script popunder
        const evt = window.event;
        const isTrustedEvent = Boolean(evt && evt.isTrusted);

        // ALWAYS allow genuine user clicks to legitimate external websites (e.g. job apply links on naukri.com)
        if (isTrustedEvent && !isKnownAdDomain && urlStr.startsWith('http')) {
            return rawWindowOpen.apply(this, arguments);
        }

        // Block if:
        // 1. Target URL matches a known ad syndicate, OR
        // 2. Unprompted window.open called by scripts without a trusted user click
        if (isKnownAdDomain || (!isSameOrigin && !isTrustedEvent)) {
            console.warn('[SaveZonix Shield] 🛡️ Neutralized pop-under / unauthorized window.open:', url || '(blank popunder)');
            notifyBlocked('popunder_window_blocked', urlStr);

            // Return a safe dummy proxy window so calling scripts don't throw null errors
            return {
                focus: function () { },
                blur: function () { },
                close: function () { },
                closed: true,
                document: { write: function () { }, close: function () { } },
                location: { href: '', replace: function () { }, assign: function () { } }
            };
        }

        return rawWindowOpen.apply(this, arguments);
    };

    // ─────────────────────────────────────────────────────────────
    // 2. Safe Notification.requestPermission Trap Disarmer
    // ─────────────────────────────────────────────────────────────
    if (typeof window.Notification !== 'undefined' && window.Notification.requestPermission) {
        const rawRequestPermission = window.Notification.requestPermission;
        window.Notification.requestPermission = function (callback) {
            console.warn('[SaveZonix Shield] 🛡️ Auto-denied notification permission prompt.');
            notifyBlocked('notification_prompt_denied');
            if (typeof callback === 'function') {
                try { callback('denied'); } catch { }
            }
            return Promise.resolve('denied');
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Universal In-Stream Video Ad Auto-Skipper & 16x Fast-Forward
    //    Applies to ANY video player on ANY website across the internet!
    // ─────────────────────────────────────────────────────────────

    // Helper: Dispatch full event chain to trigger any framework's listeners (React, VAST, JWPlayer, VideoJS, YouTube)
    function dispatchRealClick(el) {
        if (!el) return;
        try {
            const rect = el.getBoundingClientRect();
            const opts = {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: rect.x + (rect.width ? rect.width / 2 : 10),
                clientY: rect.y + (rect.height ? rect.height / 2 : 10)
            };
            el.dispatchEvent(new PointerEvent('pointerdown', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new PointerEvent('pointerup', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.click();
        } catch {
            try { el.click(); } catch { }
        }
    }

    // Known Skip Button Selectors across all major web video players (YouTube, VAST, JWPlayer, Fluid, VideoJS, xHamster, etc.)
    const SKIP_BUTTON_SELECTORS = [
        '.ytp-skip-ad-button',
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-ad-skip-button-text',
        '.ytp-ad-skip-button-container button',
        'button[class*="ytp-ad-skip-button"]',
        'div[class*="ytp-ad-skip-button"]',
        '.vast-skip-button',
        '.skip-btn',
        '.skip-button',
        '.video-skip-ad',
        '.vjs-skip-ad',
        '.ad-skip',
        '[class*="skip-button"]',
        '[class*="skip_button"]',
        '[class*="skip-btn"]',
        '[class*="skip_btn"]',
        '[class*="skip-ad"]',
        '[class*="skipAd"]',
        '[class*="video-skip"]',
        '[class*="ad-skip-button"]',
        '[id*="skip-ad"]',
        '[id*="skipAd"]',
        '[id*="skip-button"]',
        '[data-role*="skip"]',
        'button[aria-label*="Skip ad" i]',
        'button[aria-label*="Skip advertisement" i]',
        'button[aria-label*="Skip" i]'
    ].join(', ');

    // Known in-stream ad container / overlay selectors across all platforms
    const AD_OVERLAY_SELECTORS = [
        '.ad-showing',
        '.ad-interrupting',
        '.ytp-ad-player-overlay',
        '[class*="ad-container"]',
        '[class*="ad-overlay"]',
        '[class*="vast-"]',
        '[class*="vpaid-"]',
        '[class*="video-ad"]',
        '.xplayer-ads',
        'div[class*="ad-badge"]',
        'div[class*="ad-timer"]',
        '[class*="ad_countdown"]',
        '[class*="preroll"]',
        '[class*="midroll"]',
        '[class*="ad-ui"]',
        '#player-ads',
        '[data-role*="sponsor"]',
        '[data-role*="promo"]',
        '[data-role*="ad"]',
        'a[data-role="player-sponsor-link"]',
        'div[data-role="sponsor-banner"]',
        'div[data-class="vjs-inplayer-overlay"]',
        '[class*="sponsor-link"]',
        '[class*="sponsor-overlay"]',
        '[class*="inplayer-overlay"]',
        '[class*="video-ads"]',
        '[class*="vjs-inplayer"]'
    ].join(', ');

    function processUniversalVideoAds() {
        const videos = document.querySelectorAll('video');
        if (!videos.length) return;

        const pageHasAdOverlay = Boolean(document.querySelector(AD_OVERLAY_SELECTORS));

        videos.forEach(video => {
            const playerWrapper = video.closest(
                '#movie_player, .html5-video-player, .video-player, .player-container, #player, .player, [class*="player"]'
            );

            let isThisVideoAd = false;

            // 1. YouTube: Strictly check authoritative player classes (NEVER arbitrary text or times like 00:17)
            if (currentHost.includes('youtube.com')) {
                const ytPlayer = document.getElementById('movie_player') || playerWrapper;
                isThisVideoAd = Boolean(
                    ytPlayer && (
                        ytPlayer.classList.contains('ad-showing') ||
                        ytPlayer.classList.contains('ad-interrupting') ||
                        ytPlayer.querySelector('.ytp-ad-player-overlay, .ytp-ad-text')
                    )
                );

                // If YouTube is playing an ad, try native API first
                if (isThisVideoAd && ytPlayer && typeof ytPlayer.skipAd === 'function') {
                    try { ytPlayer.skipAd(); } catch { }
                }
            } else {
                // 2. Non-YouTube: Check ad overlays & specific ad countdown widgets
                isThisVideoAd = pageHasAdOverlay && (
                    !playerWrapper ||
                    Boolean(playerWrapper.querySelector(AD_OVERLAY_SELECTORS)) ||
                    playerWrapper.classList.contains('ad-showing')
                );

                if (!isThisVideoAd && playerWrapper) {
                    const adTimerWidget = playerWrapper.querySelector('[class*="ad-timer"], [class*="ad_countdown"], [class*="ad-counter"], [class*="preroll-timer"]');
                    const sponsorLink = playerWrapper.querySelector('a[target="_blank"], a[data-role="player-sponsor-link"], a[href*="bonus"], a[href*="bet"], a[href*="parimatch"]');
                    if ((adTimerWidget || sponsorLink) && video.duration && video.duration > 0 && video.duration < 120) {
                        isThisVideoAd = true;
                    }
                }
            }

            if (isThisVideoAd) {
                // Video is currently an in-stream ad!
                if (!video.__sz_is_ad_active) {
                    video.__sz_is_ad_active = true;
                    // Save legitimate user playback preferences
                    if (video.playbackRate > 0 && video.playbackRate <= 2) {
                        video.__sz_saved_rate = video.playbackRate;
                        video.__sz_saved_muted = Boolean(video.muted);
                    }
                    notifyBlocked('video_ad_accelerated');
                }

                // A. Look for Skip Ad button STRICTLY INSIDE the player wrapper during ad
                const searchContainer = playerWrapper || video.parentElement;
                if (searchContainer) {
                    const skipBtn = searchContainer.querySelector(SKIP_BUTTON_SELECTORS);
                    if (skipBtn && (skipBtn.offsetParent !== null || skipBtn.offsetWidth > 0)) {
                        dispatchRealClick(skipBtn);
                        notifyBlocked('universal_video_ad_skipped');
                    } else {
                        // Text scan strictly inside player
                        const candidateButtons = searchContainer.querySelectorAll('button, div[role="button"], a[role="button"], [class*="skip"]');
                        for (const b of candidateButtons) {
                            const txt = (b.innerText || b.textContent || '').trim().toLowerCase();
                            if (txt.includes('skip ad') || txt.includes('skip advertisement') || txt.includes('skip video') || txt.includes('skip >')) {
                                if (b.offsetParent !== null || b.offsetWidth > 0) {
                                    dispatchRealClick(b);
                                    notifyBlocked('universal_video_ad_skipped');
                                    break;
                                }
                            }
                        }
                    }
                }

                // 1. Mute during ad
                try { video.muted = true; } catch { }

                // 2. Accelerate 16x during ad
                try { video.playbackRate = 16.0; } catch { }

                // 3. For ALL sites except YouTube: jump currentTime directly to end if short ad (< 120s)
                if (!currentHost.includes('youtube.com')) {
                    try {
                        if (video.duration && !isNaN(video.duration) && video.duration > 0 && video.duration < 120) {
                            video.currentTime = video.duration - 0.05;
                        }
                    } catch { }
                }

                // Dismiss any closeable overlay banners
                const overlayClose = document.querySelector('.ytp-ad-overlay-close-button, .ad-overlay-close, [class*="overlay-close"]');
                if (overlayClose) {
                    try { overlayClose.click(); } catch { }
                }
            } else {
                // Main video is active!
                // If it was just accelerated or muted by an ad, restore normal speed immediately!
                if (video.__sz_is_ad_active || video.playbackRate > 1.0) {
                    video.__sz_is_ad_active = false;
                    try {
                        video.playbackRate = video.__sz_saved_rate || 1.0;
                        if (!video.__sz_saved_muted) {
                            video.muted = false;
                        }
                    } catch { }
                }
            }
        });

        // Auto-dismiss top promo messages and banner strips
        const promoCloseBtn = document.querySelector(
            'div[data-role="promo-messages-wrapper"] button, div[class*="top-banner"] button, div[class*="promo-banner"] button, [class*="header-banner"] button, div[data-role="promo-messages-wrapper"] [class*="close"], div[data-role="promo-messages-wrapper"] svg'
        );
        if (promoCloseBtn) {
            try { promoCloseBtn.click(); } catch { }
        }

        // Auto-dismiss anti-adblock modals (YouTube & Universal)
        const antiAdblockModal = document.querySelector(
            'tp-yt-paper-dialog:has(ytd-enforcement-message-view-model), ytd-enforcement-message-view-model, [class*="anti-adblock"], [id*="adblock-dialog"]'
        );
        if (antiAdblockModal) {
            const dismissBtn = antiAdblockModal.querySelector('#dismiss-button, button[class*="dismiss"], button[class*="close"], button');
            if (dismissBtn) {
                try { dismissBtn.click(); } catch { }
            } else {
                antiAdblockModal.remove();
                const backdrop = document.querySelector('tp-yt-iron-overlay-backdrop, .modal-backdrop');
                if (backdrop) backdrop.remove();
            }
        }
    }

    // Attach synchronous DOM MutationObserver to catch ad insertions instantly
    let universalObserver = null;
    function setupUniversalObserver() {
        if (universalObserver) return;
        if (!document.body) return;

        universalObserver = new MutationObserver(() => {
            processUniversalVideoAds();
        });

        universalObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'src', 'style']
        });
    }

    if (document.body) {
        setupUniversalObserver();
    } else {
        document.addEventListener('DOMContentLoaded', setupUniversalObserver);
    }

    // High-frequency polling safety net (every 100ms)
    setInterval(processUniversalVideoAds, 100);

})();
