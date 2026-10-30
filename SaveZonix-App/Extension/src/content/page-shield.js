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
    // 3. YouTube Ad Auto-Skipper & 16x Instant Muted Fast-Forward
    // ─────────────────────────────────────────────────────────────
    if (currentHost.includes('youtube.com')) {
        let savedPlaybackRate = 1.0;
        let userMuted = false;

        function updateAdState() {
            const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
            if (!player || !video) return;

            const isAd = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');

            if (isAd) {
                // If ad is playing: save user preferences
                if (video.playbackRate <= 2) {
                    savedPlaybackRate = video.playbackRate || 1.0;
                    userMuted = Boolean(video.muted);
                }

                // 1. Click skip button if available
                const skipBtn = document.querySelector(
                    '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button'
                );
                if (skipBtn) {
                    try {
                        skipBtn.click();
                        notifyBlocked('youtube_ad_skipped');
                    } catch { }
                }

                // 2. Accelerate unskippable/countdown ads at 16x speed and mute audio
                try {
                    video.muted = true;
                    video.playbackRate = 16.0;
                } catch { }

                // 3. Dismiss overlay banners
                const overlayClose = document.querySelector('.ytp-ad-overlay-close-button');
                if (overlayClose) {
                    try { overlayClose.click(); } catch { }
                }
            } else if (video.playbackRate > 2) {
                // Main video restored: reset normal speed and sound immediately
                try {
                    video.playbackRate = savedPlaybackRate || 1.0;
                    if (!userMuted) {
                        video.muted = false;
                    }
                } catch { }
            }

            // Auto-dismiss anti-adblock modal if YouTube displays it
            const enforcementModal = document.querySelector('tp-yt-paper-dialog:has(ytd-enforcement-message-view-model), ytd-enforcement-message-view-model');
            if (enforcementModal) {
                const dismissBtn = enforcementModal.querySelector('#dismiss-button, button');
                if (dismissBtn) {
                    try { dismissBtn.click(); } catch { }
                } else {
                    enforcementModal.remove();
                    const backdrop = document.querySelector('tp-yt-iron-overlay-backdrop');
                    if (backdrop) backdrop.remove();
                    if (video && video.paused) video.play();
                }
            }
        }

        // Dual guard: Synchronous DOM MutationObserver on player class + fast 150ms check
        let playerObserverAttached = false;
        function attachObserver() {
            const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            if (player && !playerObserverAttached) {
                playerObserverAttached = true;
                const obs = new MutationObserver(() => updateAdState());
                obs.observe(player, { attributes: true, attributeFilter: ['class'] });
            }
        }

        setInterval(() => {
            attachObserver();
            updateAdState();
        }, 150);
    }

})();
