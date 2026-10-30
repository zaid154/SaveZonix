// src/content/shield.js — SaveZonix Universal Ad, Pop-up & Redirect Shield Engine
// Runs at document_start to block pop-unders, clickjacking, fake captchas & auto-redirects globally.

(function () {
    'use strict';

    let isShieldEnabled = true;
    let blockedCount = 0;
    const currentHost = (window.location.hostname || '').toLowerCase();

    // 1. Initial Storage Check
    try {
        chrome.storage.local.get(['savezonix_shield_enabled', 'savezonix_shield_whitelist'], (res) => {
            if (res) {
                if (typeof res.savezonix_shield_enabled === 'boolean') {
                    isShieldEnabled = res.savezonix_shield_enabled;
                }
                if (Array.isArray(res.savezonix_shield_whitelist)) {
                    if (res.savezonix_shield_whitelist.some(d => currentHost.includes(d.toLowerCase()))) {
                        isShieldEnabled = false;
                    }
                }
            }
            if (isShieldEnabled) {
                applyCosmeticShield();
            }
        });
    } catch { }

    function reportBlocked(reason) {
        blockedCount++;
        try {
            chrome.runtime.sendMessage({
                action: 'shieldBlockedItem',
                hostname: currentHost,
                url: window.location.href,
                count: blockedCount,
                reason: reason || 'ad_blocked'
            });
        } catch { }
    }

    // ─────────────────────────────────────────────────────────────
    // Layer 1: Universal window.open & Pop-under Interception
    // ─────────────────────────────────────────────────────────────
    const rawWindowOpen = window.open;
    window.open = function (url, target, features) {
        if (!isShieldEnabled) {
            return rawWindowOpen.apply(this, arguments);
        }

        const urlStr = String(url || '').trim().toLowerCase();

        // Allow legitimate blank or internal popups created explicitly
        const isSameOrigin = urlStr.startsWith('/') || (urlStr.startsWith('http') && urlStr.includes(currentHost));
        const isSuspicious = !urlStr ||
            urlStr === 'about:blank' ||
            urlStr.startsWith('javascript:') ||
            urlStr.includes('monetag') ||
            urlStr.includes('adsterra') ||
            urlStr.includes('propeller') ||
            urlStr.includes('popads') ||
            urlStr.includes('popcash') ||
            urlStr.includes('exoclick') ||
            urlStr.includes('bet365') ||
            urlStr.includes('1xbet') ||
            urlStr.includes('casino') ||
            urlStr.includes('track') ||
            urlStr.includes('affiliate') ||
            urlStr.includes('deloton') ||
            urlStr.includes('onclkds') ||
            urlStr.includes('clickadu');

        // Check user gesture: if triggered in a call stack with no genuine isTrusted event
        const isUserGesture = Boolean(window.event && window.event.isTrusted);

        if (isSuspicious || (!isUserGesture && !isSameOrigin)) {
            console.warn('[SaveZonix Shield] 🛡️ Blocked pop-under / background popup window:', url || '(blank popunder)');
            reportBlocked('popunder_window_blocked');
            return null; // Neutralized
        }

        return rawWindowOpen.apply(this, arguments);
    };

    // ─────────────────────────────────────────────────────────────
    // Layer 2: Universal Push Notification Trap Defuser
    // ─────────────────────────────────────────────────────────────
    // Movie/streaming sites use fake "You received a message!" or fake verification to trick users
    if (typeof window.Notification !== 'undefined') {
        const rawRequestPermission = window.Notification.requestPermission;
        window.Notification.requestPermission = function (callback) {
            if (isShieldEnabled) {
                // If it's a known streaming/downloading or ad-heavy domain, auto-deny to prevent spam
                console.warn('[SaveZonix Shield] 🛡️ Neutralized fake notification permission trap.');
                reportBlocked('fake_notification_trap');
                const denied = Promise.resolve('denied');
                if (typeof callback === 'function') {
                    callback('denied');
                }
                return denied;
            }
            return rawRequestPermission.apply(this, arguments);
        };
    }

    // ─────────────────────────────────────────────────────────────
    // Layer 3: Anti-Clickjack Overlay Neutralizer
    // ─────────────────────────────────────────────────────────────
    function removeClickjackOverlays() {
        if (!isShieldEnabled) return;

        // Disarm full-page transparent links (common in streaming players)
        const suspiciousLinks = document.querySelectorAll('a[target="_blank"]');
        suspiciousLinks.forEach(a => {
            const style = window.getComputedStyle(a);
            const isFixed = style.position === 'fixed' || style.position === 'absolute';
            const isFullCover = (a.offsetWidth > window.innerWidth * 0.7 && a.offsetHeight > window.innerHeight * 0.7);
            const isHighZ = parseInt(style.zIndex, 10) > 1000;

            if (isFixed && (isFullCover || isHighZ) && (style.opacity === '0' || style.backgroundColor.includes('rgba(0, 0, 0, 0)'))) {
                a.remove();
                reportBlocked('clickjack_overlay_removed');
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    // Layer 4: Cosmetic Ad Hiding (CSS Shield)
    // ─────────────────────────────────────────────────────────────
    function applyCosmeticShield() {
        if (document.getElementById('savezonix-cosmetic-shield')) return;

        const css = `
            /* SaveZonix Universal Cosmetic Ad Shield */
            [class*="ad-banner"], [id*="ad-banner"],
            [class*="popunder"], [id*="popunder"],
            [class*="banner-ad"], [id*="banner-ad"],
            [class*="ad-wrapper"], [id*="ad-wrapper"],
            [class*="ad-container"], [id*="ad-container"],
            [class*="sponsored-post"], [class*="native-ad"],
            div[class*="floating-ad"], div[id*="floating-ad"],
            div[style*="z-index: 2147483647"]:not([id*="player"]):not([class*="player"]),
            div[style*="z-index: 999999"]:not([id*="player"]):not([class*="player"]):not([id*="modal"]),
            /* Floating sports / casino / sticky banners */
            div[style*="position: fixed"][style*="bottom: 0"][style*="z-index"]:has(a[target="_blank"]),
            div[style*="position: fixed"][style*="right:"][style*="top:"]:has(img[src*="ad"]),
            /* Fake notification overlays */
            div[class*="push-prompt"], div[id*="push-prompt"],
            div[class*="notification-modal"], div[id*="notification-dialog"] {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
                opacity: 0 !important;
                width: 0 !important;
                height: 0 !important;
            }
        `;

        const styleEl = document.createElement('style');
        styleEl.id = 'savezonix-cosmetic-shield';
        styleEl.textContent = css;

        if (document.head) {
            document.head.appendChild(styleEl);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                if (document.head && !document.getElementById('savezonix-cosmetic-shield')) {
                    document.head.appendChild(styleEl);
                }
            });
        }
    }

    // Periodic sweep for dynamically injected clickjack overlays
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', () => {
            if (isShieldEnabled) {
                applyCosmeticShield();
                removeClickjackOverlays();
            }
        });

        // MutationObserver to catch dynamically injected ad overlays
        const observer = new MutationObserver(() => {
            if (isShieldEnabled) {
                removeClickjackOverlays();
            }
        });

        observer.observe(document.documentElement || document, {
            childList: true,
            subtree: true
        });
    }

    // Listen for toggle updates from popup or background
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'updateShieldStatus') {
            isShieldEnabled = Boolean(msg.enabled);
            const style = document.getElementById('savezonix-cosmetic-shield');
            if (isShieldEnabled) {
                applyCosmeticShield();
            } else if (style) {
                style.remove();
            }
            sendResponse({ success: true, isShieldEnabled });
        }
        if (msg.action === 'getShieldPageStats') {
            sendResponse({ blockedCount, isShieldEnabled, host: currentHost });
        }
    });

})();
