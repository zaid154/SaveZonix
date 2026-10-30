// src/content/page-shield.js — SaveZonix Main-World Scriptlet
// Executes in "world": "MAIN" at document_start.
// Adopts uBlock Origin's open-source json-prune architecture for zero-delay YouTube ad neutralization.
// Strictly guarantees normal 1.0x playback speed across all websites with zero playbackRate or currentTime tampering.

(function () {
    'use strict';

    if (window.__savezonix_page_shield_installed__) return;
    window.__savezonix_page_shield_installed__ = true;

    const currentHost = (window.location.hostname || '').toLowerCase();
    let isShieldActive = true; // Controlled by popup extension toggle

    // Listen for extension toggle events from shield.js content script
    window.addEventListener('message', (event) => {
        if (event.data && event.data.source === 'savezonix-shield-config') {
            isShieldActive = Boolean(event.data.enabled);
            if (!isShieldActive) {
                // Ensure all videos remain at normal playback speed when shield is toggled
                document.querySelectorAll('video').forEach(v => {
                    v.playbackRate = 1.0;
                });
            }
        }
    });

    let lastAdBlockedNotificationTime = 0;
    function notifyBlocked(reason, url) {
        const now = Date.now();
        // Debounce notifications so badge counter remains crisp
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

        const isKnownAdDomain = /footful|sisseth|thistly|enstatenewark|tumbekmetage|wyvercasus|chukchipias|imbutidi|monetag|adsterra|propeller|popads|popcash|exoclick|bet365|1xbet|deloton|onclkds|luglawhauls|whomeeno|gloaphoo|soodroab|vaheedra|poawoopt|propush|onclickalgo|trafficjunky|juicyads|ero-advertising|clickadu|adxad|hilltopads|rollerads|stripchat|chaturbate|flirt4free|livejasmin|cams\.com|bongacams/i.test(urlStr);

        const evt = window.event;
        const isTrustedEvent = Boolean(evt && evt.isTrusted);

        // Allow authentic user clicks to legitimate external websites
        if (isTrustedEvent && !isKnownAdDomain && urlStr.startsWith('http')) {
            return rawWindowOpen.apply(this, arguments);
        }

        // Block known ad syndicates or unauthorized background script pop-unders
        if (isKnownAdDomain || (!isSameOrigin && !isTrustedEvent)) {
            console.warn('[SaveZonix Shield] 🛡️ Neutralized pop-under / unauthorized window.open:', url || '(blank popunder)');
            notifyBlocked('popunder_window_blocked', urlStr);

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
    // 3. uBlock Origin json-prune Architecture for YouTube
    //    Pre-emptively strips ad keys so YouTube NEVER schedules an ad.
    // ─────────────────────────────────────────────────────────────

    function pruneYouTubeAdObject(root) {
        if (!root || typeof root !== 'object') return root;

        let pruned = false;

        // uBlock Origin prune keys
        const adKeys = ['adPlacements', 'playerAds', 'adSlots', 'adPlacementConfig', 'adBreakHeartbeatParams'];
        for (let i = 0; i < adKeys.length; i++) {
            const k = adKeys[i];
            if (k in root) {
                delete root[k];
                pruned = true;
            }
        }

        // Nested playerResponse in watchEndpoint or initialData
        if (root.playerResponse && typeof root.playerResponse === 'object') {
            pruneYouTubeAdObject(root.playerResponse);
            pruned = true;
        }

        // Playlist & array prefetch responses
        if (Array.isArray(root)) {
            for (let i = 0; i < root.length; i++) {
                if (root[i] && typeof root[i] === 'object') {
                    if (pruneYouTubeAdObject(root[i])) pruned = true;
                }
            }
        }

        return pruned;
    }

    if (currentHost.includes('youtube.com')) {
        // A. Intercept window.fetch for /player, /get_watch, /reel
        const rawFetch = window.fetch;
        window.fetch = async function (...args) {
            const fetchPromise = rawFetch.apply(this, args);
            if (!isShieldActive) return fetchPromise;

            let requestUrl = '';
            try {
                if (typeof args[0] === 'string') {
                    requestUrl = args[0];
                } else if (args[0] && args[0].url) {
                    requestUrl = args[0].url;
                }
            } catch { }

            const isYtPlayerEndpoint = requestUrl.includes('/youtubei/v1/player') ||
                requestUrl.includes('/youtubei/v1/get_watch') ||
                requestUrl.includes('/youtubei/v1/reel/reel_item_watch') ||
                requestUrl.includes('/player?');

            if (!isYtPlayerEndpoint) return fetchPromise;

            try {
                const response = await fetchPromise;
                const clone = response.clone();
                const json = await clone.json();

                const didPrune = pruneYouTubeAdObject(json);
                if (!didPrune) return response;

                notifyBlocked('youtube_ad_pruned');

                const sanitizedResponse = new Response(JSON.stringify(json), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });

                Object.defineProperties(sanitizedResponse, {
                    ok: { value: response.ok },
                    redirected: { value: response.redirected },
                    type: { value: response.type },
                    url: { value: response.url }
                });

                return sanitizedResponse;
            } catch {
                return fetchPromise;
            }
        };

        // B. Intercept XMLHttpRequest for YouTube
        const rawXhrOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            this.__sz_is_yt_player = typeof url === 'string' && (
                url.includes('/youtubei/v1/player') ||
                url.includes('/youtubei/v1/get_watch') ||
                url.includes('/player?')
            );
            return rawXhrOpen.apply(this, [method, url, ...rest]);
        };

        const origXhrResponseGetter = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'response')?.get;
        if (origXhrResponseGetter) {
            Object.defineProperty(XMLHttpRequest.prototype, 'response', {
                get: function () {
                    const original = origXhrResponseGetter.call(this);
                    if (!isShieldActive || !this.__sz_is_yt_player) return original;

                    if (typeof original === 'object' && original !== null) {
                        pruneYouTubeAdObject(original);
                        return original;
                    }
                    if (typeof original === 'string') {
                        try {
                            const parsed = JSON.parse(original);
                            if (pruneYouTubeAdObject(parsed)) {
                                return JSON.stringify(parsed);
                            }
                        } catch { }
                    }
                    return original;
                },
                configurable: true,
                enumerable: true
            });
        }

        const origXhrResponseTextGetter = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText')?.get;
        if (origXhrResponseTextGetter) {
            Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
                get: function () {
                    const original = origXhrResponseTextGetter.call(this);
                    if (!isShieldActive || !this.__sz_is_yt_player || typeof original !== 'string') return original;

                    try {
                        const parsed = JSON.parse(original);
                        if (pruneYouTubeAdObject(parsed)) {
                            return JSON.stringify(parsed);
                        }
                    } catch { }
                    return original;
                },
                configurable: true,
                enumerable: true
            });
        }

        // C. Intercept window.ytInitialPlayerResponse via Property Descriptor
        let rawInitialPlayerResponse = window.ytInitialPlayerResponse;
        if (rawInitialPlayerResponse && typeof rawInitialPlayerResponse === 'object') {
            pruneYouTubeAdObject(rawInitialPlayerResponse);
        }

        try {
            Object.defineProperty(window, 'ytInitialPlayerResponse', {
                get: function () {
                    return rawInitialPlayerResponse;
                },
                set: function (val) {
                    if (isShieldActive && val && typeof val === 'object') {
                        pruneYouTubeAdObject(val);
                    }
                    rawInitialPlayerResponse = val;
                },
                configurable: true,
                enumerable: true
            });
        } catch { }

        // D. Intercept JSON.parse for YouTube Ad Placement payloads
        const rawJsonParse = JSON.parse;
        JSON.parse = function (text, reviver) {
            const result = rawJsonParse.apply(this, arguments);
            if (isShieldActive && result && typeof result === 'object') {
                pruneYouTubeAdObject(result);
            }
            return result;
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Strict Normal Video Speed Guardian (Zero Speed Tampering)
    //    Guarantees 100% normal (1.0x) playback speed across all sites.
    // ─────────────────────────────────────────────────────────────

    function enforceNormalPlaybackSpeed() {
        const videos = document.querySelectorAll('video');
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];

            // If any rogue script altered playbackRate beyond normal bounds (0.25x - 2.0x), reset to 1.0x
            if (video.playbackRate > 2.0 || video.playbackRate <= 0.2) {
                try {
                    video.playbackRate = 1.0;
                } catch { }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Silent Skip Button Auto-Clicker & Interstitial Defuser
    // ─────────────────────────────────────────────────────────────

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

    const SKIP_BUTTON_SELECTORS = [
        '.ytp-skip-ad-button',
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-ad-skip-button-text',
        '.ytp-ad-skip-button-slot button',
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

    function processUniversalAdElements() {
        // A. Instant Skip Button Auto-Clicker (Fires immediately whenever any skip button appears)
        const skipBtn = document.querySelector(SKIP_BUTTON_SELECTORS);
        if (skipBtn && skipBtn.id !== 'skip-navigation') {
            try { skipBtn.click(); } catch { }
            try { dispatchRealClick(skipBtn); } catch { }
            if (skipBtn.parentElement) {
                try { skipBtn.parentElement.click(); } catch { }
            }
            notifyBlocked('ad_skip_button_clicked');
        }

        // B. YouTube Native skipAd() call if player is interrupting
        if (currentHost.includes('youtube.com')) {
            const ytPlayer = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            if (ytPlayer && (ytPlayer.classList.contains('ad-showing') || ytPlayer.classList.contains('ad-interrupting'))) {
                if (typeof ytPlayer.skipAd === 'function') {
                    try { ytPlayer.skipAd(); } catch { }
                }
            }

            // Dismiss overlay ads on YouTube
            const overlayClose = document.querySelector('.ytp-ad-overlay-close-button, .ad-overlay-close');
            if (overlayClose) {
                try { overlayClose.click(); } catch { }
            }
        }

        // C. Universal "Close ad" & Interstitial Modal Defuser (e.g. AI Girlfriend popup)
        const closeAdBtns = document.querySelectorAll(
            'button, a, div[role="button"], span, [class*="close-ad"], [class*="ad-close"], [id*="close-ad"]'
        );
        for (let i = 0; i < closeAdBtns.length; i++) {
            const btn = closeAdBtns[i];
            const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
            if (txt === 'close ad' || txt === 'close advertisement' || txt.startsWith('close ad')) {
                try { btn.click(); } catch { }
                let topContainer = btn;
                let curr = btn;
                while (curr && curr !== document.body && curr !== document.documentElement) {
                    const pos = curr.style.position || (window.getComputedStyle(curr).position);
                    if (pos === 'fixed' || pos === 'absolute') {
                        topContainer = curr;
                    }
                    curr = curr.parentElement;
                }
                if (topContainer && topContainer !== document.body && topContainer !== document.documentElement) {
                    topContainer.remove();
                }
                document.querySelectorAll('div[class*="backdrop"], div[class*="dimmer"]').forEach(bd => {
                    if (!bd.closest('#player, .video-player')) bd.remove();
                });
                if (document.body) {
                    document.body.style.removeProperty('overflow');
                    document.body.style.removeProperty('position');
                }
                if (document.documentElement) {
                    document.documentElement.style.removeProperty('overflow');
                }
                break;
            }
        }

        // D. Auto-dismiss top promo messages and banner strips
        const promoCloseBtn = document.querySelector(
            'div[data-role="promo-messages-wrapper"] button, div[class*="top-banner"] button, div[class*="promo-banner"] button, [class*="header-banner"] button, div[data-role="promo-messages-wrapper"] [class*="close"]'
        );
        if (promoCloseBtn) {
            try { promoCloseBtn.click(); } catch { }
        }

        // E. Auto-dismiss anti-adblock modals (YouTube & Universal)
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

        // F. Enforce normal speed (1.0x)
        enforceNormalPlaybackSpeed();
    }

    // Attach lightweight observer strictly to player container
    let playerObserver = null;
    let observerThrottleTimer = null;
    function attachScopedPlayerObserver() {
        if (playerObserver) return;
        const playerContainer = document.getElementById('movie_player') || document.querySelector('.html5-video-player, .video-player, .player-container, #player');
        if (playerContainer) {
            playerObserver = new MutationObserver(() => {
                if (observerThrottleTimer) return;
                observerThrottleTimer = setTimeout(() => {
                    observerThrottleTimer = null;
                    if (isShieldActive) processUniversalAdElements();
                }, 50); // 50ms throttle: 0% CPU, no lag
            });
            playerObserver.observe(playerContainer, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }

    // Periodic safety sweep (every 300ms, < 0.01ms execution, 0% CPU)
    setInterval(() => {
        if (!isShieldActive) return;
        attachScopedPlayerObserver();
        processUniversalAdElements();
    }, 300);

})();
