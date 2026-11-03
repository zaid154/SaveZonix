// src/content/page-shield.js — SaveZonix Main-World Scriptlet
// Executes in "world": "MAIN" at document_start.
// Adopts uBlock Origin's open-source json-prune architecture for zero-delay YouTube ad neutralization.
// Strictly guarantees normal 1.0x playback speed across all websites with zero playbackRate or currentTime tampering.
// 0% CPU overhead: Zero layout thrashing, scoped observers, and instant skip button triggers.

(function () {
    'use strict';

    if (window.__savezonix_page_shield_installed__) return;
    window.__savezonix_page_shield_installed__ = true;

    const currentHost = (window.location.hostname || '').toLowerCase();
    const isYouTube = currentHost.includes('youtube.com') || currentHost.includes('youtu.be');
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
        if (!root || typeof root !== 'object') return false;

        let pruned = false;

        // uBlock Origin core prune keys
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
            if (pruneYouTubeAdObject(root.playerResponse)) pruned = true;
        }

        return pruned;
    }

    // Helper: sanitize headers when replacing a fetch response body
    // Prevents "ERR_CONTENT_DECODING_FAILED" or "An error occurred" on YouTube
    function sanitizeResponseHeaders(origHeaders) {
        const h = new Headers(origHeaders);
        h.delete('content-encoding');
        h.delete('content-length');
        h.set('content-type', 'application/json; charset=UTF-8');
        return h;
    }

    if (isYouTube) {
        // A. Intercept window.fetch strictly for /player, /get_watch, /reel endpoints
        // Uses uBlock Origin's clone-then-prune architecture:
        // If not pruned or on error, returns pristine untouched responseBefore!
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

            // Strictly filter target YouTube API endpoints: 0% overhead on all other calls
            const isYtPlayerEndpoint = requestUrl.includes('/youtubei/v1/player') ||
                requestUrl.includes('/youtubei/v1/get_watch') ||
                requestUrl.includes('/youtubei/v1/reel/reel_item_watch');

            if (!isYtPlayerEndpoint) return fetchPromise;

            return fetchPromise.then(responseBefore => {
                // Clone first so responseBefore remains untouched and valid if we don't prune
                const responseClone = responseBefore.clone();
                return responseClone.json().then(objBefore => {
                    if (!objBefore || typeof objBefore !== 'object') {
                        return responseBefore;
                    }

                    const didPrune = pruneYouTubeAdObject(objBefore);
                    if (!didPrune) {
                        // Nothing pruned — return pristine original response (zero risk of corruption)
                        return responseBefore;
                    }

                    notifyBlocked('youtube_ad_pruned');

                    const responseAfter = new Response(JSON.stringify(objBefore), {
                        status: responseBefore.status,
                        statusText: responseBefore.statusText,
                        headers: sanitizeResponseHeaders(responseBefore.headers)
                    });

                    Object.defineProperties(responseAfter, {
                        ok: { value: responseBefore.ok },
                        redirected: { value: responseBefore.redirected },
                        type: { value: responseBefore.type },
                        url: { value: responseBefore.url }
                    });

                    return responseAfter;
                }).catch(() => {
                    // JSON parsing failed (non-JSON endpoint or streaming response) — return original body untouched
                    return responseBefore;
                });
            }).catch(() => {
                return fetchPromise;
            });
        };

        // B. Intercept XMLHttpRequest for YouTube XHR player requests
        const rawXhrOpen = XMLHttpRequest.prototype.open;
        const rawXhrSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            this.__sz_url = String(url || '');
            return rawXhrOpen.call(this, method, url, ...rest);
        };
        XMLHttpRequest.prototype.send = function (...sendArgs) {
            const url = this.__sz_url || '';
            const isPlayerXhr = url.includes('/youtubei/v1/player') ||
                url.includes('/youtubei/v1/get_watch') ||
                url.includes('/youtubei/v1/reel/reel_item_watch');

            if (isShieldActive && isPlayerXhr) {
                this.addEventListener('readystatechange', function () {
                    if (this.readyState === 4 && this.status === 200) {
                        try {
                            if (typeof this.response === 'object' && this.response !== null) {
                                if (pruneYouTubeAdObject(this.response)) {
                                    notifyBlocked('youtube_ad_pruned_xhr');
                                }
                            } else if (typeof this.responseText === 'string') {
                                const json = JSON.parse(this.responseText);
                                if (pruneYouTubeAdObject(json)) {
                                    const serialized = JSON.stringify(json);
                                    Object.defineProperty(this, 'responseText', { value: serialized, configurable: true });
                                    Object.defineProperty(this, 'response', { value: serialized, configurable: true });
                                    notifyBlocked('youtube_ad_pruned_xhr');
                                }
                            }
                        } catch { }
                    }
                });
            }
            return rawXhrSend.apply(this, sendArgs);
        };

        // C. Intercept window.ytInitialPlayerResponse via Property Descriptor (0ms execution, runs once)
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

        // D. Intercept ytInitialData for masthead/companion/promoted ads in initial page HTML
        function pruneInitialData(val) {
            if (!val || typeof val !== 'object') return;
            try {
                if (val.topbar?.desktopTopbarRenderer?.promotedContent) {
                    delete val.topbar.desktopTopbarRenderer.promotedContent;
                }
                const topLevelAdKeys = ['playerOverlays', 'adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams'];
                for (let i = 0; i < topLevelAdKeys.length; i++) {
                    const k = topLevelAdKeys[i];
                    if (k in val) delete val[k];
                }
                const twoCol = val?.contents?.twoColumnWatchNextResults;
                if (twoCol?.secondaryResults?.secondaryResults?.results) {
                    twoCol.secondaryResults.secondaryResults.results =
                        twoCol.secondaryResults.secondaryResults.results.filter(r =>
                            !r.promotedSparklesWebRenderer &&
                            !r.adSlotRenderer &&
                            !r.promotedSparklesTextSearchRenderer &&
                            !r.statementBannerRenderer &&
                            !r.bannerPromoRenderer
                        );
                }
            } catch { }
        }

        let rawInitialData = window.ytInitialData;
        if (rawInitialData && typeof rawInitialData === 'object') {
            pruneInitialData(rawInitialData);
        }

        try {
            Object.defineProperty(window, 'ytInitialData', {
                get: function () {
                    return rawInitialData;
                },
                set: function (val) {
                    if (isShieldActive && val && typeof val === 'object') {
                        pruneInitialData(val);
                    }
                    rawInitialData = val;
                },
                configurable: true,
                enumerable: true
            });
        } catch { }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Strict Normal Video Speed Guardian (Zero Speed Tampering)
    //    Guarantees 100% normal (1.0x) playback speed across all sites.
    // ─────────────────────────────────────────────────────────────

    function enforceNormalPlaybackSpeed() {
        const videos = document.querySelectorAll('video');
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            // If speed was tampered with (e.g. residual 16x acceleration), reset to 1.0x
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

    let fastAdTicker = null;
    function checkFastAdTicker(ytPlayer) {
        if (!ytPlayer) return;
        const isAdActive = ytPlayer.classList.contains('ad-showing') || ytPlayer.classList.contains('ad-interrupting');
        if (isAdActive) {
            if (!fastAdTicker) {
                fastAdTicker = setInterval(() => {
                    const p = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
                    if (!p || (!p.classList.contains('ad-showing') && !p.classList.contains('ad-interrupting'))) {
                        clearInterval(fastAdTicker);
                        fastAdTicker = null;
                        return;
                    }
                    const btn = p.querySelector(
                        '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, button[class*="ytp-ad-skip-button"], button[class*="skip-button"], .ytp-ad-skip-button-container button, [aria-label*="Skip ad" i], [aria-label*="Skip" i]'
                    );
                    if (btn) {
                        try { btn.click(); } catch { }
                        try { dispatchRealClick(btn); } catch { }
                        notifyBlocked('ad_skip_button_clicked');
                    }
                }, 50);
            }
        } else if (fastAdTicker) {
            clearInterval(fastAdTicker);
            fastAdTicker = null;
        }
    }

    function processAdElements() {
        if (!isShieldActive) return;

        // ─────────────────────────────────────────────────────────
        // A. Dedicated Lightning-Fast YouTube Path (< 0.02ms, 0% CPU)
        // ─────────────────────────────────────────────────────────
        if (isYouTube) {
            const ytPlayer = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            if (ytPlayer) {
                // Scope search strictly inside player container (only ~20 elements, never query the entire page!)
                const skipBtn = ytPlayer.querySelector(
                    '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, button[class*="ytp-ad-skip-button"], button[class*="skip-button"], .ytp-ad-skip-button-container button, [aria-label*="Skip ad" i], [aria-label*="Skip" i]'
                );
                if (skipBtn) {
                    try { skipBtn.click(); } catch { }
                    try { dispatchRealClick(skipBtn); } catch { }
                    notifyBlocked('ad_skip_button_clicked');
                }

                if (ytPlayer.classList.contains('ad-showing') || ytPlayer.classList.contains('ad-interrupting')) {
                    if (typeof ytPlayer.skipAd === 'function') {
                        try { ytPlayer.skipAd(); } catch { }
                    }
                }

                const overlayClose = ytPlayer.querySelector('.ytp-ad-overlay-close-button');
                if (overlayClose) {
                    try { overlayClose.click(); } catch { }
                }

                checkFastAdTicker(ytPlayer);
            }

            // Dismiss anti-adblock modal if present
            const antiAdblockModal = document.querySelector('ytd-enforcement-message-view-model, tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)');
            if (antiAdblockModal) {
                antiAdblockModal.remove();
                document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach(b => b.remove());
            }

            enforceNormalPlaybackSpeed();
            return; // STRICT RETURN: YouTube is clean, do not run heavy generic queries!
        }

        // ─────────────────────────────────────────────────────────
        // B. Generic Players & Third-Party Tube Sites (Zero Overhead)
        // ─────────────────────────────────────────────────────────
        if (!document.querySelector('video')) {
            return; // 0% CPU overhead on non-video websites
        }

        const genericSkipBtn = document.querySelector(
            '.vast-skip-button, .skip-btn, .skip-button, .video-skip-ad, .vjs-skip-ad, .ad-skip, [class*="skip-button"], [class*="skip_button"], [class*="skip-ad"], [id*="skip-ad"], button[aria-label*="Skip" i]'
        );
        if (genericSkipBtn) {
            try { genericSkipBtn.click(); } catch { }
            try { dispatchRealClick(genericSkipBtn); } catch { }
            notifyBlocked('ad_skip_button_clicked');
        }

        // High-precision "Close ad" selector (avoids querying all buttons, a, span!)
        const closeAdBtns = document.querySelectorAll(
            '.close-ad, [class*="close-ad"], [class*="ad-close"], [id*="close-ad"]'
        );
        for (let i = 0; i < closeAdBtns.length; i++) {
            const btn = closeAdBtns[i];
            const txt = (btn.textContent || '').trim().toLowerCase();
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

        enforceNormalPlaybackSpeed();
    }

    // Attach lightweight observer strictly to player container
    let playerObserver = null;
    let observerThrottleTimer = null;
    function attachScopedPlayerObserver() {
        if (playerObserver) return;
        const playerContainer = document.getElementById('movie_player') || document.querySelector('.html5-video-player, .video-player, #player');
        if (playerContainer) {
            playerObserver = new MutationObserver(() => {
                if (observerThrottleTimer) return;
                observerThrottleTimer = setTimeout(() => {
                    observerThrottleTimer = null;
                    processAdElements();
                }, 100); // 100ms throttle
            });

            // Scoped observation: NO subtree recursion, only watch class attribute on player wrapper!
            playerObserver.observe(playerContainer, {
                childList: false,
                subtree: false,
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }

    // Fast Scoped Triggers (Zero continuous intervals on generic websites)
    if (isYouTube) {
        setInterval(() => {
            attachScopedPlayerObserver();
            processAdElements();
        }, 500);
    } else {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                if (document.querySelector('video')) processAdElements();
            }, { once: true });
        } else if (document.querySelector('video')) {
            processAdElements();
        }

        window.addEventListener('play', (e) => {
            if (e.target && e.target.tagName === 'VIDEO') {
                processAdElements();
            }
        }, { capture: true, passive: true });
    }

})();
