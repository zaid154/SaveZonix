// src/content/page-shield.js — SaveZonix Main-World Scriptlet
// Executes in "world": "MAIN" at document_start.
// Non-intrusive: Protects against unprompted popunders without poisoning DOM prototypes or breaking SPAs.

(function () {
    'use strict';

    if (window.__savezonix_page_shield_installed__) return;
    window.__savezonix_page_shield_installed__ = true;

    const currentHost = (window.location.hostname || '').toLowerCase();

    function notifyBlocked(reason, url) {
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
        // A. 1. Click native player API if present (e.g. YouTube movie_player.skipAd())
        try {
            const ytPlayer = document.getElementById('movie_player');
            if (ytPlayer && typeof ytPlayer.skipAd === 'function') {
                const isYtAd = ytPlayer.classList.contains('ad-showing') || ytPlayer.classList.contains('ad-interrupting');
                if (isYtAd) {
                    ytPlayer.skipAd();
                }
            }
        } catch { }

        // A. 2. Auto-click any visible Skip Ad buttons across ANY video player
        const skipElements = document.querySelectorAll(SKIP_BUTTON_SELECTORS);
        for (const el of skipElements) {
            if (el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0) {
                dispatchRealClick(el);
                notifyBlocked('universal_video_ad_skipped');
                break;
            }
        }

        // A. 3. Text-based scan: catch any custom button / div / a / span with text "Skip Ad" or "Skip"
        const allPotentialButtons = document.querySelectorAll(
            'button, div[role="button"], a[role="button"], span[role="button"], div[class*="skip"], span[class*="skip"], a[class*="skip"], div[class*="btn"]'
        );
        for (const btn of allPotentialButtons) {
            const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
            if (txt.includes('skip ad') || txt.includes('skip advertisement') || txt.includes('skip video') || txt.includes('skip promo') || txt.includes('skip >') || (txt.startsWith('skip') && txt.length <= 15)) {
                if (btn.offsetParent !== null || btn.offsetWidth > 0) {
                    dispatchRealClick(btn);
                    notifyBlocked('universal_video_ad_skipped');
                    break;
                }
            }
        }

        // B. In-Stream Ad Detection & 16x Muted Acceleration
        const videos = document.querySelectorAll('video');
        if (!videos.length) return;

        const pageHasAdOverlay = Boolean(document.querySelector(AD_OVERLAY_SELECTORS));

        videos.forEach(video => {
            const playerWrapper = video.closest(
                '#movie_player, .html5-video-player, .video-player, .player-container, #player, .player, [class*="player"]'
            );

            // 1. Check if wrapper or page contains ad overlay
            let isThisVideoAd = pageHasAdOverlay && (
                !playerWrapper ||
                Boolean(playerWrapper.querySelector(AD_OVERLAY_SELECTORS)) ||
                playerWrapper.classList.contains('ad-showing') ||
                playerWrapper.classList.contains('ad-interrupting')
            );

            // 2. Check for in-player countdown timers (e.g. "00:17", "00:05", "Ad 1 of 2", "Sponsored", "Win now")
            if (!isThisVideoAd && playerWrapper) {
                const textNodes = playerWrapper.querySelectorAll('div, span, p, a');
                for (const node of textNodes) {
                    const t = (node.innerText || node.textContent || '').trim().toLowerCase();
                    if (/^00:\d\d$/.test(t) || /^ad\s*:\s*\d+/i.test(t) || /^ad\s+1\s+of/i.test(t) || t === 'sponsored' || t.includes('win now') || t.includes('claim your bonus')) {
                        isThisVideoAd = true;
                        break;
                    }
                }
            }

            // 3. Check for external sponsor links inside player with short duration (< 120s)
            if (!isThisVideoAd && playerWrapper) {
                const sponsorLink = playerWrapper.querySelector('a[target="_blank"], a[data-role="player-sponsor-link"], a[href*="bonus"], a[href*="bet"], a[href*="parimatch"]');
                if (sponsorLink && video.duration && video.duration > 0 && video.duration < 120) {
                    isThisVideoAd = true;
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
                }

                // 1. Mute during ad
                try { video.muted = true; } catch { }

                // 2. Accelerate 16x during ad
                try { video.playbackRate = 16.0; } catch { }

                // 3. For ALL sites except YouTube: jump currentTime directly to end if short ad (< 120s)
                // This burns the 15-20s ad in 0.01 seconds without breaking YouTube playlists!
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
            } else if (video.__sz_is_ad_active || video.playbackRate > 2) {
                // Ad has ended or main video started: IMMEDIATELY restore normal speed & audio
                video.__sz_is_ad_active = false;
                try {
                    video.playbackRate = video.__sz_saved_rate || 1.0;
                    if (!video.__sz_saved_muted) {
                        video.muted = false;
                    }
                } catch { }
            }
        });

        // C. Auto-dismiss top promo messages and banner strips
        const promoCloseBtn = document.querySelector(
            'div[data-role="promo-messages-wrapper"] button, div[class*="top-banner"] button, div[class*="promo-banner"] button, [class*="header-banner"] button, div[data-role="promo-messages-wrapper"] [class*="close"], div[data-role="promo-messages-wrapper"] svg'
        );
        if (promoCloseBtn) {
            try { promoCloseBtn.click(); } catch { }
        }

        // D. Auto-dismiss anti-adblock modals (YouTube & Universal)
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
                const mainVid = document.querySelector('video');
                if (mainVid && mainVid.paused) mainVid.play();
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
