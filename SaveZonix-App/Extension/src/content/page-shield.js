// src/content/page-shield.js — SaveZonix Main-World Scriptlet
// Executes in "world": "MAIN" at document_start to directly control the webpage's JavaScript execution context.

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
    // 1. Direct window.open Pop-under Defuser (Neutralizes h(e) in pixelflix)
    // ─────────────────────────────────────────────────────────────
    const rawWindowOpen = window.open;
    window.open = function (url, target, features) {
        const urlStr = String(url || '').trim().toLowerCase();

        // Safe checks: allow internal/same-origin navigation or legitimate blank windows for print/downloads
        const isSameOrigin = !urlStr ||
            urlStr === 'about:blank' && (!features || !features.includes('popup')) ||
            urlStr.startsWith('/') ||
            (urlStr.startsWith('http') && urlStr.includes(currentHost));

        const isAdDomainOrPattern = /footful|sisseth|thistly|enstatenewark|tumbekmetage|wyvercasus|chukchipias|imbutidi|monetag|adsterra|propeller|popads|popcash|exoclick|bet365|1xbet|forex|trade|gold|crypto|casino|bonus|affiliate|track|clickadu|deloton|onclkds|luglawhauls|whomeeno|gloaphoo|soodroab|vaheedra|poawoopt|propush|onclickalgo/i.test(urlStr);

        // Check if event is genuine direct user navigation vs script popunder
        const evt = window.event;
        const isTrustedEvent = Boolean(evt && evt.isTrusted);
        const isTargetBlank = (target === '_blank');

        if (isAdDomainOrPattern || (isTargetBlank && !isSameOrigin) || (!isSameOrigin && !isTrustedEvent)) {
            console.warn('[SaveZonix Shield] 🛡️ Neutralized pop-under / unauthorized window.open:', url || '(blank popunder)');
            notifyBlocked('popunder_window_blocked', urlStr);

            // Return a safe dummy proxy window so the ad script doesn't crash or throw exceptions
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
    // 2. Neutralize Site-level Ad Engine Fetches (/ads-config.json & /ad-manager.enc)
    // ─────────────────────────────────────────────────────────────
    const rawFetch = window.fetch;
    window.fetch = function (input, init) {
        const urlStr = String(typeof input === 'string' ? input : (input?.url || '')).toLowerCase();

        if (urlStr.includes('ad-manager.enc') || urlStr.includes('api/ad-token') || urlStr.includes('ads-config.json')) {
            console.warn('[SaveZonix Shield] 🛡️ Intercepted and neutralized ad engine fetch:', urlStr);
            notifyBlocked('ad_engine_request_blocked', urlStr);

            if (urlStr.includes('ads-config.json')) {
                // Return disabled config so site's Next.js ad distributor sets ads: []
                return Promise.resolve(new Response(JSON.stringify({
                    enabled: false,
                    visible: { enabled: false, breaks: [] },
                    click: { enabled: false, ads: [] },
                    antiInspect: { enabled: false }
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }));
            }

            return Promise.reject(new TypeError('Ad engine blocked by SaveZonix Shield'));
        }

        return rawFetch.apply(this, arguments);
    };

    // Intercept XMLHttpRequest for the same ad endpoints
    const rawXhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        const urlStr = String(url || '').toLowerCase();
        if (urlStr.includes('ad-manager.enc') || urlStr.includes('api/ad-token') || urlStr.includes('ads-config.json')) {
            console.warn('[SaveZonix Shield] 🛡️ Blocked XHR ad engine request:', urlStr);
            notifyBlocked('ad_engine_xhr_blocked', urlStr);
            return;
        }
        return rawXhrOpen.apply(this, arguments);
    };

    // Lock window.__ix so site cannot install decrypted ad manager
    try {
        Object.defineProperty(window, '__ix', {
            get: function () {
                return {
                    install: function () { },
                    setHeroAllowed: function () { },
                    fire: function () { }
                };
            },
            set: function () { },
            configurable: false
        });
    } catch { }

    // ─────────────────────────────────────────────────────────────
    // 3. Direct Notification.requestPermission Scam Trap Disarmer
    // ─────────────────────────────────────────────────────────────
    if (typeof window.Notification !== 'undefined') {
        try {
            Object.defineProperty(window.Notification, 'requestPermission', {
                value: function (callback) {
                    console.warn('[SaveZonix Shield] 🛡️ Auto-denied deceptive notification prompt.');
                    notifyBlocked('notification_prompt_denied');
                    if (typeof callback === 'function') {
                        try { callback('denied'); } catch { }
                    }
                    return Promise.resolve('denied');
                },
                configurable: false,
                writable: false
            });
        } catch {
            window.Notification.requestPermission = function (callback) {
                console.warn('[SaveZonix Shield] 🛡️ Auto-denied deceptive notification prompt.');
                notifyBlocked('notification_prompt_denied');
                if (typeof callback === 'function') {
                    try { callback('denied'); } catch { }
                }
                return Promise.resolve('denied');
            };
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Dynamic Ad Script & Iframe Injection Blocker
    // ─────────────────────────────────────────────────────────────
    const rawCreateElement = Document.prototype.createElement;
    Document.prototype.createElement = function (tagName, options) {
        const el = rawCreateElement.call(this, tagName, options);
        const tag = String(tagName).toLowerCase();

        if (tag === 'script' || tag === 'iframe') {
            const rawSetAttribute = el.setAttribute;
            el.setAttribute = function (name, value) {
                if (String(name).toLowerCase() === 'src') {
                    const srcStr = String(value || '').toLowerCase();
                    if (/footful|sisseth|thistly|enstatenewark|tumbekmetage|wyvercasus|chukchipias|imbutidi|monetag|adsterra|propeller|popads|popcash|deloton|onclkds|luglawhauls|whomeeno|gloaphoo|soodroab|connatix|aniview|vi\.ai|vdo\.ai|primis/i.test(srcStr)) {
                        console.warn('[SaveZonix Shield] 🛡️ Blocked dynamic ad script/iframe injection:', srcStr);
                        notifyBlocked('dynamic_ad_script_blocked', srcStr);
                        return; // Drop src!
                    }
                }
                return rawSetAttribute.apply(this, arguments);
            };

            // Intercept direct src property setter
            let currentSrc = '';
            Object.defineProperty(el, 'src', {
                get: function () { return currentSrc; },
                set: function (val) {
                    const srcStr = String(val || '').toLowerCase();
                    if (/footful|sisseth|thistly|enstatenewark|tumbekmetage|wyvercasus|chukchipias|imbutidi|monetag|adsterra|propeller|popads|popcash|deloton|onclkds|luglawhauls|whomeeno|gloaphoo|soodroab|connatix|aniview|vi\.ai|vdo\.ai|primis/i.test(srcStr)) {
                        console.warn('[SaveZonix Shield] 🛡️ Blocked direct src setter on ad element:', srcStr);
                        notifyBlocked('ad_src_property_blocked', srcStr);
                        currentSrc = '';
                        return;
                    }
                    currentSrc = val;
                    el.setAttribute('src', val);
                },
                configurable: true
            });
        }
        return el;
    };

    // ─────────────────────────────────────────────────────────────
    // 5. Intercept Programmatic Anchor Clicks (Hidden Redirect Links)
    // ─────────────────────────────────────────────────────────────
    const rawAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
        const href = (this.getAttribute('href') || '').toLowerCase();
        const isExternal = href.startsWith('http') && !href.includes(currentHost);
        const isAd = /footful|sisseth|thistly|imbutidi|monetag|adsterra|propeller|popads|trade|gold|forex|casino|bet/i.test(href);

        if (isAd || (isExternal && this.target === '_blank' && !window.event?.isTrusted)) {
            console.warn('[SaveZonix Shield] 🛡️ Neutralized programmatic fake link click:', href);
            notifyBlocked('programmatic_link_click_blocked', href);
            return;
        }

        return rawAnchorClick.apply(this, arguments);
    };

})();
