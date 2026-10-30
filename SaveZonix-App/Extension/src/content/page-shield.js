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
    // 3. YouTube JSON Player Response Pruner & Safe Ad Defuser
    // ─────────────────────────────────────────────────────────────
    if (currentHost.includes('youtube.com')) {
        function pruneAdData(target) {
            if (!target || typeof target !== 'object') return target;
            try {
                if (target.adPlacements) delete target.adPlacements;
                if (target.playerAds) delete target.playerAds;
                if (target.adSlots) delete target.adSlots;
                if (target.playerResponse) {
                    pruneAdData(target.playerResponse);
                }
            } catch { }
            return target;
        }

        // 1. Intercept JSON.parse to prune ad data from YouTube player responses
        const rawJSONParse = JSON.parse;
        JSON.parse = function () {
            const result = rawJSONParse.apply(this, arguments);
            return pruneAdData(result);
        };

        // 2. Intercept Fetch API Response.prototype.json
        if (typeof Response !== 'undefined' && Response.prototype.json) {
            const rawResponseJson = Response.prototype.json;
            Response.prototype.json = function () {
                return rawResponseJson.apply(this, arguments).then(data => pruneAdData(data));
            };
        }

        // 3. Intercept window.ytInitialPlayerResponse
        let initialPlayerResponse = window.ytInitialPlayerResponse;
        if (initialPlayerResponse) pruneAdData(initialPlayerResponse);
        try {
            Object.defineProperty(window, 'ytInitialPlayerResponse', {
                get: function () { return initialPlayerResponse; },
                set: function (val) { initialPlayerResponse = pruneAdData(val); },
                configurable: true
            });
        } catch { }

        // 4. Safe Player Defuser — NEVER mutate video.currentTime (to prevent skipping playlist tracks)
        let isAdSpeedUp = false;
        let originalRate = 1;
        let userWasMuted = false;

        function defuseYouTubeAd() {
            const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            const video = document.querySelector('video.html5-main-video') || document.querySelector('video');

            const isAdShowing = Boolean(
                player?.classList.contains('ad-showing') ||
                player?.classList.contains('ad-interrupting')
            );

            if (isAdShowing && video) {
                // Try native player skip method if exposed
                if (typeof player?.skipAd === 'function') {
                    try { player.skipAd(); } catch { }
                }

                // Click true ad skip button (strictly scoped to ad classes or ad module)
                const skipBtn = document.querySelector(
                    '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button, .ytp-ad-module button'
                );
                if (skipBtn) {
                    try {
                        skipBtn.click();
                        skipBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
                        skipBtn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
                        skipBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                    } catch { }
                }

                // Mute and speed up ad to 16x without jumping currentTime
                if (!isAdSpeedUp) {
                    isAdSpeedUp = true;
                    originalRate = (video.playbackRate > 0 && video.playbackRate <= 2) ? video.playbackRate : 1;
                    userWasMuted = Boolean(video.muted);
                }

                try {
                    video.muted = true;
                    video.playbackRate = 16.0;
                } catch { }

                notifyBlocked('youtube_ad_defused');
            } else if (isAdSpeedUp && video) {
                // Ad ended: restore original playback speed and audio
                isAdSpeedUp = false;
                try {
                    video.playbackRate = originalRate || 1;
                    if (!userWasMuted) {
                        video.muted = false;
                    }
                } catch { }
            }

            // Auto-dismiss anti-adblock modal if YouTube displays it
            const enforcementModal = document.querySelector('tp-yt-paper-dialog:has(ytd-enforcement-message-view-model), ytd-enforcement-message-view-model');
            if (enforcementModal) {
                const dismissBtn = enforcementModal.querySelector('#dismiss-button, button');
                if (dismissBtn) {
                    dismissBtn.click();
                } else {
                    enforcementModal.remove();
                    const backdrop = document.querySelector('tp-yt-iron-overlay-backdrop');
                    if (backdrop) backdrop.remove();
                    if (video && video.paused) video.play();
                }
            }
        }

        setInterval(defuseYouTubeAd, 50);
    }

})();
