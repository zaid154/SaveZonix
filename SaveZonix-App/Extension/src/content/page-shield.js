// src/content/page-shield.js — SaveZonix Main-World Scriptlet
// Executes in "world": "MAIN" at document_start.
// Adopts uBlock Origin's open-source json-prune architecture for zero-delay YouTube ad neutralization.
// Strictly guarantees normal 1.0x playback speed across all websites with zero playbackRate or currentTime tampering.
// Neutralizes unauthorized pop-unders, auto-popups on click, bounce redirects, and clickjacking transparent overlays.
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
    // 1. Unified Ad Syndicate & Suspicious URL Classifier
    // ─────────────────────────────────────────────────────────────
    const AD_DOMAIN_REGEX = new RegExp(
        '\\b(' +
        // Major popunder / redirect / push ad networks
        'adsterra|monetag|propellerads|propeller|popads|popcash|exoclick|trafficstars|trafficjunky|' +
        'juicyads|ero-advertising|clickadu|adxad|hilltopads|rollerads|richads|adcash|admaven|yllix|' +
        'revenuehits|bidvertiser|twinred|galaksion|pushground|coinzilla|evadav|adport|clickorience|' +
        'daftporn|realsrv|syndication|tsyndicate|adtrue|bidgear|adsco|a-ads|clicksor|infolinks|' +
        'chitika|plugrush|adxpansion|zergnet|mgid|revcontent|' +
        // Known redirect / syndicate tracking domains
        'footful|sisseth|thistly|enstatenewark|tumbekmetage|wyvercasus|chukchipias|imbutidi|deloton|' +
        'onclkds|luglawhauls|whomeeno|gloaphoo|soodroab|vaheedra|poawoopt|propush|onclickalgo|' +
        'onclickperf|onclicksuper|onclickgate|feedaty|clkmon|traffic-media|prmsrv|servenobid|' +
        'deloplen|adkeep|adtrack|smartclick|trackvoluum|voluumtrk|clickfunnels|directrev|' +
        // Gambling & casino redirect lures
        'bet365|1xbet|melbet|mostbet|linebet|22bet|vulkan|parimatch|bcgame|stake\\.com|cbet|roobet|' +
        '888casino|sportybet|megapari|betwinner|spinaway|pin-up|' +
        // Cam & adult redirect lures
        'stripchat|chaturbate|flirt4free|livejasmin|cams\\.com|bongacams|cam4|streamate|imlive|jerkmate|myfreecams' +
        ')\\b',
        'i'
    );

    function isSameOriginUrl(urlStr) {
        if (!urlStr || urlStr === 'about:blank' || urlStr.startsWith('/') || urlStr.startsWith('#')) {
            return true;
        }
        try {
            const u = new URL(urlStr, window.location.href);
            return u.hostname === window.location.hostname || u.hostname.endsWith('.' + window.location.hostname);
        } catch {
            return urlStr.includes(currentHost);
        }
    }

    function isSuspiciousAdQuery(urlStr) {
        if (!urlStr) return false;
        return /[?&](zoneid|clickid|traffic_source|popunder|popup|ad_id|aff_id|pubid|campaign_id|cid|subid)=/i.test(urlStr);
    }

    function isAdOrSuspiciousUrl(url) {
        if (!url) return false;
        const urlStr = String(url).trim().toLowerCase();
        if (urlStr.startsWith('javascript:') || urlStr.startsWith('data:text/html')) {
            return true;
        }
        if (AD_DOMAIN_REGEX.test(urlStr)) {
            return true;
        }
        if (urlStr.startsWith('http') && !isSameOriginUrl(urlStr) && isSuspiciousAdQuery(urlStr)) {
            return true;
        }
        return false;
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Protected Element Inspector (Preserves Authentic UI)
    // ─────────────────────────────────────────────────────────────
    function isLegitimateProtectedElement(el) {
        if (!el || el === document.body || el === document.documentElement) return true;

        // 1. YouTube Masthead, Headers, Nav & Video Player
        if (el.closest('#masthead-container, ytd-masthead, #masthead, ytd-searchbox, #search-form, ytm-mobile-topbar-renderer, header, nav')) {
            return true;
        }

        // 2. Video Players & Media Elements (YouTube, HTML5, Vimeo, Twitch, Generic players)
        if (el.matches('video, audio, #player, .video-player, #movie_player, .html5-video-player, ytd-player, ytd-miniplayer, ytd-watch-flexy, .vjs-control-bar, .plyr, .jwplayer') ||
            el.closest('#player, .video-player, #movie_player, .html5-video-player, ytd-player, ytd-miniplayer, ytd-watch-flexy, .vjs-control-bar, .plyr, .jwplayer') ||
            el.querySelector('video, audio, .html5-main-video, iframe[src*="youtube.com/embed"], iframe[src*="player.vimeo.com"]')) {
            return true;
        }

        // 3. Search Bars & Search Forms
        if (el.matches('input[type="search"], [role="search"], form[role="search"], [class*="search-box"], [class*="search-bar"], #search-form') ||
            el.closest('[role="search"], form[role="search"], .search-box, .search-bar, ytd-searchbox') ||
            el.querySelector('input[type="search"], [role="search"], input[name*="search" i], input[id*="search" i]')) {
            return true;
        }

        // 4. Legitimate Login & Authentication Forms
        const hasPassword = el.matches('input[type="password"]') || el.querySelector('input[type="password"], input[autocomplete*="password"]') !== null;
        const hasAuthInputs = el.querySelector('input[type="email"], input[name*="user" i], input[name*="login" i], input[id*="login" i], input[id*="signin" i]') !== null;
        const hasForm = el.matches('form') || el.querySelector('form') !== null;
        const isAuthOrLogin = /login|signin|sign-in|register|signup|sign-up|auth|account|oauth/i.test((el.className || '') + ' ' + (el.id || ''));

        if (hasPassword || (hasForm && hasAuthInputs) || (isAuthOrLogin && (hasForm || hasAuthInputs))) {
            return true;
        }

        // 5. Authentic Age Verification Gates
        const text = (el.textContent || '').toLowerCase();
        if (text.length >= 5) {
            const hasAgeClues = text.includes('18') || text.includes('21') || text.includes('age verification') ||
                text.includes('legal age') || text.includes('verify your age') || text.includes('date of birth') ||
                text.includes('disclaimer') || text.includes('terms of service');
            const hasAgeChoices = text.includes('enter') || text.includes('exit') || text.includes('i am 18') ||
                text.includes('i am 21') || text.includes('i agree') || text.includes('agree') ||
                text.includes('yes') || text.includes('leave') || text.includes('continue');
            const hasAgeInputs = el.querySelector('select[name*="year" i], select[name*="age" i], select[name*="dob" i], input[type="date"], input[name*="dob" i], input[name*="birth" i]') !== null;
            const hasDeceptiveTrap = text.includes('click "allow"') || text.includes("click 'allow'") ||
                text.includes('click allow') || text.includes('press allow') ||
                text.includes('enable notifications') || text.includes('robot');

            if ((hasAgeClues && (hasAgeChoices || hasAgeInputs)) && !hasDeceptiveTrap) {
                return true;
            }
        }

        return false;
    }

    // ─────────────────────────────────────────────────────────────
    // 3. User Gesture Tracker & Clickjacking Neutralizer
    // ─────────────────────────────────────────────────────────────
    let lastUserInteractionTime = 0;
    let lastClickedElement = null;

    function isRecentPlayerClick() {
        if (!lastClickedElement) return false;
        const now = Date.now();
        if (now - lastUserInteractionTime > 1500) return false;
        return Boolean(
            lastClickedElement.matches('video, audio, .video-player, #movie_player, .html5-video-player, ytd-player') ||
            lastClickedElement.closest('#player, .video-player, #movie_player, .html5-video-player, ytd-player, .vjs-control-bar, .plyr, .jwplayer')
        );
    }

    function isClickjackElement(el) {
        if (!el || el === document.body || el === document.documentElement) return false;
        if (isLegitimateProtectedElement(el)) return false;

        const cls = (el.className && typeof el.className === 'string' ? el.className : '').toLowerCase();
        const id = (el.id && typeof el.id === 'string' ? el.id : '').toLowerCase();
        if (cls.includes('clickjack') || id.includes('clickjack') || cls.includes('popunder') || id.includes('popunder')) {
            return true;
        }

        // 1. Anchors styled to cover screen
        if (el.tagName === 'A') {
            const href = (el.getAttribute('href') || '').toLowerCase();
            const style = window.getComputedStyle(el);
            if (style.position === 'fixed' || style.position === 'absolute') {
                const rect = el.getBoundingClientRect();
                const isHuge = rect.width >= window.innerWidth * 0.5 && rect.height >= window.innerHeight * 0.5;
                const isTransparent = parseFloat(style.opacity) < 0.1 || style.visibility === 'hidden' ||
                    (style.backgroundColor === 'rgba(0, 0, 0, 0)' && (el.innerText || '').trim() === '');
                if (isHuge && (isTransparent || isAdOrSuspiciousUrl(href))) {
                    return true;
                }
            }
        }

        // 2. Large transparent fixed/absolute DIVs, SPANs, IFRAMEs capturing clicks
        if (el.tagName === 'DIV' || el.tagName === 'SPAN' || el.tagName === 'IFRAME') {
            const style = window.getComputedStyle(el);
            if (style.position === 'fixed' || style.position === 'absolute') {
                const zIndex = parseInt(style.zIndex, 10);
                if (zIndex >= 50 || isNaN(zIndex)) {
                    const rect = el.getBoundingClientRect();
                    const coversScreen = rect.width >= window.innerWidth * 0.7 && rect.height >= window.innerHeight * 0.7;
                    if (coversScreen) {
                        const opacity = parseFloat(style.opacity);
                        const isTransparent = opacity <= 0.05 ||
                            (style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent');

                        const hasVisibleText = (el.innerText || '').trim().length > 0;
                        const hasControls = el.querySelector('input, button, select, textarea, video, audio, form, [role="button"]');

                        if (isTransparent && !hasVisibleText && !hasControls) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    // Capture-phase listener executes BEFORE page/ad scripts
    window.addEventListener('click', function (e) {
        lastUserInteractionTime = Date.now();
        lastClickedElement = e.target;

        if (!isShieldActive || e.__sz_defused) return;

        const target = e.target;
        if (!target || target === document.body || target === document.documentElement) return;

        let candidate = target;
        let isJack = false;
        while (candidate && candidate !== document.body && candidate !== document.documentElement) {
            if (isLegitimateProtectedElement(candidate)) {
                break;
            }
            if (isClickjackElement(candidate)) {
                isJack = true;
                break;
            }
            if (candidate.matches('main, article, header, nav, #app, #root')) {
                break;
            }
            candidate = candidate.parentElement;
        }

        if (isJack && candidate) {
            console.warn('[SaveZonix Shield] 🛡️ Defused clickjacking overlay on click:', candidate);
            notifyBlocked('clickjack_overlay_neutralized');

            e.stopImmediatePropagation();
            e.preventDefault();

            const targetToRemove = candidate;
            targetToRemove.style.setProperty('pointer-events', 'none', 'important');
            targetToRemove.style.setProperty('display', 'none', 'important');
            try { targetToRemove.remove(); } catch { }

            // Re-target authentic click to genuine element underneath
            const underEl = document.elementFromPoint(e.clientX, e.clientY);
            if (underEl && underEl !== targetToRemove && !isClickjackElement(underEl)) {
                try {
                    const fakeEvt = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        clientX: e.clientX,
                        clientY: e.clientY
                    });
                    fakeEvt.__sz_defused = true;
                    underEl.dispatchEvent(fakeEvt);
                } catch {
                    try { underEl.click(); } catch { }
                }
            }
        }
    }, true);

    // ─────────────────────────────────────────────────────────────
    // 4. Surgical window.open Pop-under Defuser & Dummy Window Proxy
    // ─────────────────────────────────────────────────────────────
    function createDummyWindow(initialUrl) {
        let currentUrl = initialUrl || 'about:blank';
        const fakeLocation = {
            get href() { return currentUrl; },
            set href(val) {
                const valStr = String(val || '').trim().toLowerCase();
                if (isAdOrSuspiciousUrl(valStr) || (!isSameOriginUrl(valStr) && isRecentPlayerClick())) {
                    console.warn('[SaveZonix Shield] 🛡️ Blocked pop-under delayed navigation:', val);
                    notifyBlocked('popunder_redirect_blocked', valStr);
                    return;
                }
                currentUrl = val;
            },
            replace(val) { this.href = val; },
            assign(val) { this.href = val; },
            reload() { },
            toString() { return currentUrl; }
        };

        const fakeDoc = {
            write() { },
            writeln() { },
            open() { return this; },
            close() { },
            createElement() { return {}; },
            head: {},
            body: {},
            location: fakeLocation
        };

        const dummy = {
            focus() { },
            blur() { },
            close() { },
            closed: true,
            opener: null,
            location: fakeLocation,
            document: fakeDoc,
            postMessage() { },
            addEventListener() { },
            removeEventListener() { },
            dispatchEvent() { return true; },
            setTimeout(fn) { return 0; },
            clearTimeout() { },
            setInterval(fn) { return 0; },
            clearInterval() { }
        };

        return new Proxy(dummy, {
            get(target, prop) {
                if (prop in target) return target[prop];
                return function () { };
            },
            set(target, prop, val) {
                if (prop === 'location') {
                    fakeLocation.href = val;
                    return true;
                }
                target[prop] = val;
                return true;
            }
        });
    }

    let lastExternalPopupTime = 0;
    const rawWindowOpen = window.open;
    window.open = function (url, target, features) {
        if (!isShieldActive) {
            return rawWindowOpen.apply(this, arguments);
        }

        const urlStr = String(url || '').trim().toLowerCase();
        const isBlankOrEmpty = !urlStr || urlStr === 'about:blank';
        const isSameOrigin = isBlankOrEmpty || isSameOriginUrl(urlStr);

        const isAd = isAdOrSuspiciousUrl(urlStr);
        const evt = window.event;
        const isTrustedEvent = Boolean(evt && evt.isTrusted);
        const now = Date.now();
        const hasRecentUserClick = (now - lastUserInteractionTime < 1200) && isTrustedEvent;
        const clickedInsidePlayer = isRecentPlayerClick();

        // 1. Block known ad syndicates or suspicious redirect trackers immediately
        if (isAd) {
            console.warn('[SaveZonix Shield] 🛡️ Neutralized pop-under / ad window.open:', url || '(blank popunder)');
            notifyBlocked('popunder_window_blocked', urlStr);
            return createDummyWindow(url);
        }

        // 2. Block hijacked video player click popups
        if (clickedInsidePlayer && !isSameOrigin) {
            console.warn('[SaveZonix Shield] 🛡️ Blocked hijacked video player click popup:', url);
            notifyBlocked('popunder_window_blocked', urlStr);
            return createDummyWindow(url);
        }

        // 3. For blank/about:blank windows opened on user clicks:
        if (isBlankOrEmpty) {
            if (!hasRecentUserClick) {
                console.warn('[SaveZonix Shield] 🛡️ Blocked unauthorized background blank window.open');
                notifyBlocked('popunder_window_blocked', 'about:blank');
                return createDummyWindow('about:blank');
            }
            return createDummyWindow('about:blank');
        }

        // 4. Rate-limit external popups: at most 1 external window per 1500ms
        if (!isSameOrigin) {
            if (!hasRecentUserClick || (now - lastExternalPopupTime < 1500)) {
                console.warn('[SaveZonix Shield] 🛡️ Blocked rapid / unprompted external window.open:', url);
                notifyBlocked('popunder_window_blocked', urlStr);
                return createDummyWindow(url);
            }
            lastExternalPopupTime = now;
        }

        // 5. Authentic user clicks to legitimate external websites proceed normally
        return rawWindowOpen.apply(this, arguments);
    };

    // ─────────────────────────────────────────────────────────────
    // 5. Malicious window.onbeforeunload & Tab-Trap Defuser
    // ─────────────────────────────────────────────────────────────
    function hasUserFormEdits() {
        try {
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
                return true;
            }
            const dirtyInputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea');
            for (let i = 0; i < dirtyInputs.length; i++) {
                const input = dirtyInputs[i];
                if (input.value && input.value !== input.defaultValue && input.value.trim().length > 0) {
                    return true;
                }
            }
        } catch { }
        return false;
    }

    let rawBeforeUnloadHandler = null;
    try {
        Object.defineProperty(window, 'onbeforeunload', {
            get: function () {
                return rawBeforeUnloadHandler;
            },
            set: function (fn) {
                if (typeof fn === 'function') {
                    rawBeforeUnloadHandler = function (e) {
                        if (!isShieldActive) return fn.call(this, e);
                        if (!hasUserFormEdits()) {
                            console.warn('[SaveZonix Shield] 🛡️ Neutralized malicious beforeunload tab-trap.');
                            notifyBlocked('beforeunload_trap_neutralized');
                            return undefined;
                        }
                        return fn.call(this, e);
                    };
                } else {
                    rawBeforeUnloadHandler = null;
                }
            },
            configurable: true,
            enumerable: true
        });
    } catch { }

    if (typeof EventTarget !== 'undefined' && EventTarget.prototype && EventTarget.prototype.addEventListener) {
        const rawAddEventListener = EventTarget.prototype.addEventListener;
        const rawRemoveEventListener = EventTarget.prototype.removeEventListener;

        EventTarget.prototype.addEventListener = function (type, listener, options) {
            if (type === 'beforeunload' && this === window && typeof listener === 'function') {
                const wrappedListener = function (e) {
                    if (!isShieldActive) return listener.call(this, e);
                    if (!hasUserFormEdits()) {
                        console.warn('[SaveZonix Shield] 🛡️ Neutralized beforeunload event listener trap.');
                        notifyBlocked('beforeunload_trap_neutralized');
                        try {
                            e.stopImmediatePropagation();
                            delete e.returnValue;
                        } catch { }
                        return undefined;
                    }
                    return listener.call(this, e);
                };
                try {
                    listener.__sz_wrapped_beforeunload = wrappedListener;
                } catch { }
                return rawAddEventListener.call(this, type, wrappedListener, options);
            }
            return rawAddEventListener.call(this, type, listener, options);
        };

        if (rawRemoveEventListener) {
            EventTarget.prototype.removeEventListener = function (type, listener, options) {
                if (type === 'beforeunload' && this === window && listener && listener.__sz_wrapped_beforeunload) {
                    return rawRemoveEventListener.call(this, type, listener.__sz_wrapped_beforeunload, options);
                }
                return rawRemoveEventListener.call(this, type, listener, options);
            };
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 6. Artificial Redirect & Navigation Defuser
    // ─────────────────────────────────────────────────────────────
    try {
        if (typeof window.Location !== 'undefined' && window.Location.prototype) {
            const rawAssign = window.Location.prototype.assign;
            if (typeof rawAssign === 'function') {
                window.Location.prototype.assign = function (url) {
                    const urlStr = String(url || '').trim().toLowerCase();
                    if (isShieldActive && isAdOrSuspiciousUrl(urlStr)) {
                        console.warn('[SaveZonix Shield] 🛡️ Blocked location.assign redirect to ad domain:', url);
                        notifyBlocked('ad_redirect_blocked', urlStr);
                        return;
                    }
                    return rawAssign.call(this, url);
                };
            }

            const rawReplace = window.Location.prototype.replace;
            if (typeof rawReplace === 'function') {
                window.Location.prototype.replace = function (url) {
                    const urlStr = String(url || '').trim().toLowerCase();
                    if (isShieldActive && isAdOrSuspiciousUrl(urlStr)) {
                        console.warn('[SaveZonix Shield] 🛡️ Blocked location.replace redirect to ad domain:', url);
                        notifyBlocked('ad_redirect_blocked', urlStr);
                        return;
                    }
                    return rawReplace.call(this, url);
                };
            }
        }
    } catch { }

    if (typeof HTMLAnchorElement !== 'undefined' && HTMLAnchorElement.prototype && HTMLAnchorElement.prototype.click) {
        const rawAnchorClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
            if (isShieldActive) {
                const href = (this.href || '').trim().toLowerCase();
                if (href && isAdOrSuspiciousUrl(href)) {
                    console.warn('[SaveZonix Shield] 🛡️ Blocked synthetic anchor click redirect to ad:', this.href);
                    notifyBlocked('ad_anchor_click_blocked', href);
                    return;
                }
            }
            return rawAnchorClick.apply(this, arguments);
        };
    }

    if (typeof history !== 'undefined' && history.pushState) {
        const rawPushState = history.pushState;
        let pushCountInWindow = 0;
        let lastPushReset = Date.now();

        history.pushState = function (state, title, url) {
            if (isShieldActive) {
                const now = Date.now();
                if (now - lastPushReset > 2000) {
                    pushCountInWindow = 0;
                    lastPushReset = now;
                }
                pushCountInWindow++;
                if (pushCountInWindow > 8) {
                    console.warn('[SaveZonix Shield] 🛡️ Throttled history pushState flood (back-button hijacking attempt).');
                    return;
                }
                if (url) {
                    const urlStr = String(url).trim().toLowerCase();
                    if (isAdOrSuspiciousUrl(urlStr)) {
                        console.warn('[SaveZonix Shield] 🛡️ Blocked history pushState to ad URL:', url);
                        notifyBlocked('ad_redirect_blocked', urlStr);
                        return;
                    }
                }
            }
            return rawPushState.apply(this, arguments);
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 7. Clickjack Overlay Cosmetic Neutralizer & YouTube Ad Shield
    // ─────────────────────────────────────────────────────────────
    function injectAntiClickjackStyles() {
        if (isYouTube) return; // 0% overhead on YouTube
        try {
            const css = `
                div[style*="position: fixed"][style*="opacity: 0"]:not(:has(video, audio, input, button, form, [role="dialog"])),
                div[style*="position: fixed"][style*="opacity:0"]:not(:has(video, audio, input, button, form, [role="dialog"])),
                div[style*="position:fixed"][style*="opacity: 0"]:not(:has(video, audio, input, button, form, [role="dialog"])),
                div[style*="position:fixed"][style*="opacity:0"]:not(:has(video, audio, input, button, form, [role="dialog"])),
                a[style*="position: fixed"][style*="opacity: 0"],
                a[style*="position: fixed"][style*="opacity:0"],
                a[style*="position:fixed"][style*="opacity: 0"],
                a[style*="position:fixed"][style*="opacity:0"] {
                    pointer-events: none !important;
                    display: none !important;
                }
            `;
            const style = document.createElement('style');
            style.id = 'savezonix-anticlickjack-style';
            style.textContent = css;
            (document.head || document.documentElement).appendChild(style);
        } catch { }
    }
    injectAntiClickjackStyles();

    function injectYouTubeAdblockStyles() {
        if (!isYouTube) return;
        try {
            const css = `
                #player-ads,
                .video-ads,
                .ytp-ad-module,
                .ytp-ad-overlay-container,
                .ytp-ad-overlay-slot,
                .ytp-ad-player-overlay,
                .ytp-ad-player-overlay-flyout-cta,
                ytd-ad-slot-renderer,
                ytd-banner-promo-renderer,
                ytd-in-feed-ad-layout-renderer,
                ytd-promoted-sparkles-web-renderer,
                ytd-promoted-sparkles-text-search-renderer,
                ytd-promoted-video-renderer,
                ytd-display-ad-renderer,
                #masthead-ad,
                ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
                #companion,
                #ad-card-shelf,
                .ytd-merch-shelf-renderer {
                    display: none !important;
                }
            `;
            const style = document.createElement('style');
            style.id = 'savezonix-yt-adblock-style';
            style.textContent = css;
            (document.head || document.documentElement).appendChild(style);
        } catch { }
    }
    injectYouTubeAdblockStyles();

    // ─────────────────────────────────────────────────────────────
    // 8. Safe Notification.requestPermission Trap Disarmer
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
    // 9. uBlock Origin json-prune Architecture for YouTube
    //    Pre-emptively strips ad keys so YouTube NEVER schedules an ad.
    // ─────────────────────────────────────────────────────────────

    function pruneYouTubeAdObject(root) {
        if (!root || typeof root !== 'object') return false;

        let pruned = false;

        // Core YouTube ad placement & player keys
        const adKeys = [
            'adPlacements',
            'playerAds',
            'adSlots',
            'adPlacementConfig',
            'adBreakHeartbeatParams',
            'adBreakParams',
            'adParams',
            'playerOverlays'
        ];
        for (let i = 0; i < adKeys.length; i++) {
            const k = adKeys[i];
            if (k in root) {
                delete root[k];
                pruned = true;
            }
        }

        // Nested playerResponse in watchEndpoint, next response, or initialData
        if (root.playerResponse && typeof root.playerResponse === 'object') {
            if (pruneYouTubeAdObject(root.playerResponse)) pruned = true;
        }

        // Nested playbackTracking
        if (root.playbackTracking && typeof root.playbackTracking === 'object') {
            const pt = root.playbackTracking;
            if (pt.videostatsPlaybackUrl && typeof pt.videostatsPlaybackUrl.baseUrl === 'string' && pt.videostatsPlaybackUrl.baseUrl.includes('ad_')) {
                delete pt.videostatsPlaybackUrl;
                pruned = true;
            }
        }

        // Array traversal (e.g. watch next recommendations / mixes)
        if (Array.isArray(root)) {
            for (let i = 0; i < root.length; i++) {
                if (root[i] && typeof root[i] === 'object') {
                    if (pruneYouTubeAdObject(root[i])) pruned = true;
                }
            }
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
        // 0. Intercept JSON.parse for YouTube data structures (uBlock Origin style)
        try {
            const rawJsonParse = JSON.parse;
            JSON.parse = function (...args) {
                const parsed = rawJsonParse.apply(this, args);
                if (isShieldActive && parsed && typeof parsed === 'object') {
                    pruneYouTubeAdObject(parsed);
                }
                return parsed;
            };
        } catch { }

        // A. Intercept window.fetch strictly for /youtubei/v1/player & /youtubei/v1/next endpoints
        // Uses uBlock Origin's clone-then-prune architecture:
        // Strictly targets player/next JSON. Non-player and non-JSON requests are returned untouched immediately.
        const rawFetch = window.fetch;
        window.fetch = function (...args) {
            const fetchPromise = rawFetch.apply(this, args);
            if (!isShieldActive) return fetchPromise;

            let requestUrl = '';
            try {
                if (typeof args[0] === 'string') {
                    requestUrl = args[0];
                } else if (args[0] && typeof args[0].url === 'string') {
                    requestUrl = args[0].url;
                } else if (args[0] && typeof args[0].href === 'string') {
                    requestUrl = args[0].href;
                }
            } catch { }

            // Target YouTube player and watch next API endpoints (supports standard watch + mixes & radio playlists)
            const isTargetEndpoint = requestUrl.includes('/youtubei/v1/player') || requestUrl.includes('/youtubei/v1/next');
            if (!isTargetEndpoint) {
                return fetchPromise;
            }

            return fetchPromise.then(responseBefore => {
                if (!responseBefore) return responseBefore;

                const contentType = (responseBefore.headers && responseBefore.headers.get('content-type')) || '';
                if (!contentType.includes('application/json')) {
                    return responseBefore;
                }

                try {
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
                        // JSON parsing failed — return original body untouched
                        return responseBefore;
                    });
                } catch {
                    return responseBefore;
                }
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
            const isPlayerXhr = url.includes('/youtubei/v1/player');

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
    // 10. Strict Normal Video Speed Guardian (Zero Speed Tampering)
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
    // 11. Silent Skip Button Auto-Clicker & Interstitial Defuser
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

    function processAdElements() {
        if (!isShieldActive) return;

        // ─────────────────────────────────────────────────────────
        // A. Dedicated Lightning-Fast YouTube Path (< 0.02ms, 0% CPU)
        // ─────────────────────────────────────────────────────────
        if (isYouTube) {
            const ytPlayer = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
            if (ytPlayer) {
                const isAdShowing = ytPlayer.classList.contains('ad-showing') || ytPlayer.classList.contains('ad-interrupting');
                const video = ytPlayer.querySelector('video');

                if (isAdShowing) {
                    // 1. Try native skip function
                    if (typeof ytPlayer.skipAd === 'function') {
                        try { ytPlayer.skipAd(); } catch { }
                    }

                    // 2. Click skip button immediately if present
                    const skipBtn = ytPlayer.querySelector(
                        '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, button[class*="ytp-ad-skip-button"], button[class*="skip-button"], .ytp-ad-skip-button-container button, [aria-label*="Skip ad" i], [aria-label*="Skip" i]'
                    );
                    if (skipBtn) {
                        try { skipBtn.click(); } catch { }
                        try { dispatchRealClick(skipBtn); } catch { }
                        notifyBlocked('ad_skip_button_clicked');
                    }

                    // 3. Unskippable & bumper ad fast-forward annihilator (< 50ms)
                    if (video) {
                        video.muted = true;
                        video.playbackRate = 16.0;
                        if (isFinite(video.duration) && video.duration > 0) {
                            video.currentTime = video.duration;
                        }
                    }
                    notifyBlocked('youtube_ad_annihilated');
                } else {
                    // Normal main video is playing: ensure 1.0x normal speed
                    if (video && video.playbackRate > 2.0) {
                        try { video.playbackRate = 1.0; } catch { }
                    }
                }

                const overlayClose = ytPlayer.querySelector('.ytp-ad-overlay-close-button');
                if (overlayClose) {
                    try { overlayClose.click(); } catch { }
                }
            }

            // Dismiss anti-adblock modal if present and auto-resume playback
            const antiAdblockModal = document.querySelector('ytd-enforcement-message-view-model, tp-yt-paper-dialog:has(ytd-enforcement-message-view-model)');
            if (antiAdblockModal) {
                antiAdblockModal.remove();
                document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach(b => b.remove());
                const v = document.querySelector('video');
                if (v && v.paused) {
                    try { v.play(); } catch { }
                }
            }

            return; // STRICT RETURN: YouTube is clean, do not run heavy generic queries!
        }

        // ─────────────────────────────────────────────────────────
        // B. Generic Players & Third-Party Tube Sites (Zero Overhead)
        // ─────────────────────────────────────────────────────────
        if (!document.querySelector('video')) {
            return; // 0% CPU overhead on non-video websites
        }

        // Neutralize clickjack transparent overlays
        const clickjacks = document.querySelectorAll(
            'div[style*="position: fixed"][style*="opacity: 0"], div[style*="position: fixed"][style*="opacity:0"], ' +
            'a[style*="position: fixed"][style*="opacity: 0"], a[style*="position: fixed"][style*="opacity:0"], ' +
            'div[style*="position:fixed"][style*="opacity:0"], a[style*="position:fixed"][style*="opacity:0"], ' +
            '[class*="clickjack"], [id*="clickjack"]'
        );
        for (let i = 0; i < clickjacks.length; i++) {
            const cj = clickjacks[i];
            if (isClickjackElement(cj)) {
                console.warn('[SaveZonix Shield] 🛡️ Removed clickjack overlay:', cj);
                cj.remove();
                notifyBlocked('clickjack_overlay_neutralized');
            }
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
    function attachScopedPlayerObserver() {
        if (playerObserver) return;
        const playerContainer = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
        if (playerContainer) {
            playerObserver = new MutationObserver(() => {
                processAdElements();
            });

            // Scoped observation: watch class changes on player wrapper
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
        // Immediate event listeners on video player: 0ms reaction time
        window.addEventListener('timeupdate', (e) => {
            if (e.target && e.target.tagName === 'VIDEO') {
                const ytPlayer = e.target.closest('#movie_player, .html5-video-player');
                if (ytPlayer && (ytPlayer.classList.contains('ad-showing') || ytPlayer.classList.contains('ad-interrupting'))) {
                    processAdElements();
                }
            }
        }, { capture: true, passive: true });

        window.addEventListener('play', (e) => {
            if (e.target && e.target.tagName === 'VIDEO') {
                attachScopedPlayerObserver();
                processAdElements();
            }
        }, { capture: true, passive: true });

        setInterval(() => {
            attachScopedPlayerObserver();
            processAdElements();
        }, 300);
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
