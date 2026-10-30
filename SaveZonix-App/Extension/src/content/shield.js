// src/content/shield.js — SaveZonix Universal Ad, Pop-up & Redirect Shield Engine
// Runs at document_start in isolated world; coordinates badge counters, cosmetic DOM cleanups & safe protective barriers.

(function () {
    'use strict';

    let isShieldEnabled = true;
    let blockedCount = 0;
    const currentHost = (window.location.hostname || '').toLowerCase();

    // 1. Storage & Whitelist Check
    try {
        chrome.storage.local.get(['savezonix_shield_enabled', 'savezonix_shield_whitelist'], (res) => {
            if (res) {
                if (typeof res.savezonix_shield_enabled === 'boolean') {
                    isShieldEnabled = res.savezonix_shield_enabled;
                }
                if (Array.isArray(res.savezonix_shield_whitelist)) {
                    if (res.savezonix_shield_whitelist.some(d => d && currentHost.includes(d.toLowerCase()))) {
                        isShieldEnabled = false;
                    }
                }
            }
            if (isShieldEnabled) {
                applyCosmeticShield();
                startDomDefense();
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

    // 2. Listen to messages from page-shield.js (Main World)
    window.addEventListener('message', (e) => {
        if (!isShieldEnabled) return;
        if (e.data && e.data.source === 'savezonix-shield-main') {
            reportBlocked(e.data.reason || 'main_world_threat_blocked');
        }
    });

    // ─────────────────────────────────────────────────────────────
    // Layer 1: Cosmetic Ad & Modal Hiding (CSS Shield)
    // ─────────────────────────────────────────────────────────────
    function applyCosmeticShield() {
        if (document.getElementById('savezonix-cosmetic-shield')) return;

        const css = `
            /* SaveZonix Safe Cosmetic Ad Shield */
            [class*="ad-banner"], [id*="ad-banner"],
            [class*="popunder"], [id*="popunder"],
            [class*="banner-ad"], [id*="banner-ad"],
            [class*="ad-wrapper"]:not(#masthead-container):not([id*="masthead"]),
            [id*="ad-wrapper"]:not(#masthead-container):not([id*="masthead"]),
            [class*="ad-container"]:not(#masthead-container):not([id*="masthead"]),
            [id*="ad-container"]:not(#masthead-container):not([id*="masthead"]),
            [class*="sponsored-post"], [class*="native-ad"],
            div[class*="floating-ad"], div[id*="floating-ad"],
            div[class*="outstream"], div[id*="outstream"],
            div[class*="aniview"], div[class*="connatix"], div[class*="vdoai"],
            /* Floating side video ad widget with AI robot or sound controls */
            div[style*="position: fixed"][style*="right: 0"]:has(video),
            div[style*="position: fixed"][style*="right:"][style*="bottom: 0"]:has(video),
            /* Fake push notification modals */
            div[class*="push-prompt"], div[id*="push-prompt"],
            div[class*="notification-modal"], div[id*="notification-dialog"],
            /* YouTube In-Feed, Banner & Player Overlay Ads */
            ytd-ad-slot-renderer,
            ytd-rich-item-renderer:has(> #content > ytd-ad-slot-renderer),
            ytd-in-feed-ad-layout-renderer,
            ytd-banner-promo-renderer,
            ytd-statement-banner-renderer,
            ytd-action-companion-ad-renderer,
            #player-ads,
            .ytd-merch-shelf-renderer,
            .ytp-ad-overlay-container,
            .ytp-ad-message-container,
            tp-yt-paper-dialog:has(ytd-enforcement-message-view-model) {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
                opacity: 0 !important;
                width: 0 !important;
                height: 0 !important;
            }

            /* Explicit protection for YouTube Header & Search Bar */
            #masthead-container, ytd-masthead, #masthead, ytd-searchbox, #search-form, ytm-mobile-topbar-renderer, .mobile-topbar-header {
                display: block !important;
                visibility: visible !important;
                pointer-events: auto !important;
                opacity: 1 !important;
            }
        `;

        const styleEl = document.createElement('style');
        styleEl.id = 'savezonix-cosmetic-shield';
        styleEl.textContent = css;

        if (document.head) {
            document.head.prepend(styleEl);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                if (document.head && !document.getElementById('savezonix-cosmetic-shield')) {
                    document.head.prepend(styleEl);
                }
            });
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Layer 2: Deceptive Scam Modal & Clickjack Annihilator (DOM Engine)
    // ─────────────────────────────────────────────────────────────
    // TARGETED SCAM PATTERNS: Only match known push-notification scams and fake browser alerts.
    // NOTE: Legitimate 18+ age verification gateways are strictly preserved.
    const SCAM_PATTERNS = [
        // Fake Browser / Captcha Lures
        "one more step",
        "please go to captcha",
        "choose your browser to continue",
        "is your browser firefox",
        "is your browser chrome",
        "captcha to access the site",
        "your browser is outdated",
        "system has been infected",
        "trade gold 24/7",

        // Fake Notification Scam Triggers (Never used by real age gates)
        "click \"allow\"",
        "click 'allow'",
        "click allow to",
        "press allow to",
        "confirm you are not a robot",
        "you received a message"
    ];

    function sweepDeceptiveModals() {
        if (!isShieldEnabled) return;

        // 1. Sweep modals containing deceptive scam patterns
        const allFloating = document.querySelectorAll('div, dialog, section, aside');
        allFloating.forEach(el => {
            const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
            if (!style) return;

            const isOverlay = style.position === 'fixed' || style.position === 'absolute';
            const isHighZ = parseInt(style.zIndex, 10) >= 30;

            if (isOverlay || isHighZ) {
                const text = (el.innerText || el.textContent || '').toLowerCase();

                // SAFEGUARD: Never delete legitimate navigation headers, search boxes, forms, login boxes, or authentic age verification gates
                if (el.closest('#masthead-container, ytd-masthead, #masthead, ytd-searchbox, #search-form, ytm-mobile-topbar-renderer, header, nav')) {
                    return;
                }

                const hasForm = el.querySelector('form') !== null;
                const hasInputs = el.querySelector('input[type="password"], input[type="email"], input[name*="user"], input[type="radio"]') !== null;
                const isAuthOrLogin = /login|signin|register|signup|auth|account/i.test(el.className + ' ' + el.id);

                // Authentic Age Gate detection: real age gates give choice ("Enter" / "Exit" / "I am 18" / "Under 18")
                // and do NOT ask to click browser notification "Allow" buttons.
                const isAuthenticAgeGate = (
                    (text.includes('18') || text.includes('age') || text.includes('disclaimer') || text.includes('terms')) &&
                    (text.includes('enter') || text.includes('yes') || text.includes('agree') || text.includes('exit') || text.includes('leave') || text.includes('continue')) &&
                    !text.includes('click "allow"') &&
                    !text.includes('click \'allow\'') &&
                    !text.includes('click allow') &&
                    !text.includes('press allow')
                );

                if (hasForm || hasInputs || isAuthOrLogin || isAuthenticAgeGate) {
                    return; // Preserve legitimate dialog/gateway intact
                }

                // Check against deceptive scam patterns
                const matchedPattern = SCAM_PATTERNS.find(pat => text.includes(pat));

                if (matchedPattern) {
                    console.warn('[SaveZonix Shield] 🛡️ Neutralized deceptive scam modal (' + matchedPattern + '):', el);
                    
                    const modalParent = el.closest('div[style*="position: fixed"], div[style*="z-index"]') || el;
                    modalParent.remove();
                    reportBlocked('deceptive_modal_removed');

                    // If body scroll was locked by the modal, restore it
                    if (document.body && (document.body.style.overflow === 'hidden' || document.body.style.position === 'fixed')) {
                        document.body.style.overflow = 'auto';
                        document.body.style.position = 'static';
                    }
                    if (document.documentElement && document.documentElement.style.overflow === 'hidden') {
                        document.documentElement.style.overflow = 'auto';
                    }
                }
            }
        });

        // 2. Sweep full-page transparent clickjack link overlays
        const allLinks = document.querySelectorAll('a');
        allLinks.forEach(a => {
            const style = window.getComputedStyle ? window.getComputedStyle(a) : null;
            if (!style) return;

            const isFixed = style.position === 'fixed' || style.position === 'absolute';
            const isFullCover = (a.offsetWidth > window.innerWidth * 0.5 && a.offsetHeight > window.innerHeight * 0.5);
            const isHighZ = parseInt(style.zIndex, 10) >= 100;
            const isTransparent = style.opacity === '0' || style.backgroundColor.includes('rgba(0, 0, 0, 0)');

            if (isFixed && (isFullCover || (isHighZ && isTransparent))) {
                console.warn('[SaveZonix Shield] 🛡️ Removed full-page clickjack overlay link:', a);
                a.remove();
                reportBlocked('clickjack_overlay_removed');
            }
        });

        // 3. Sweep floating outstream video ads (not genuine video players)
        const floatingVideos = document.querySelectorAll('video');
        floatingVideos.forEach(v => {
            if (v.hasAttribute('controls') || v.closest('#player') || v.closest('.player') || v.closest('.video-container') || v.closest('main')) {
                return;
            }
            const container = v.closest('div[style*="position: fixed"], div[style*="position: absolute"]');
            if (container) {
                const rect = container.getBoundingClientRect();
                if (rect.width < 450 && (rect.right >= window.innerWidth - 30 || rect.bottom >= window.innerHeight - 30)) {
                    console.warn('[SaveZonix Shield] 🛡️ Removed floating outstream video ad:', container);
                    container.remove();
                    reportBlocked('outstream_video_ad_removed');
                }
            }
        });

        // 4. Sweep floating sports/casino icons (e.g. bouncing basketball widget)
        const floatingIcons = document.querySelectorAll('div[style*="position: fixed"] img, div[style*="position: absolute"] img');
        floatingIcons.forEach(img => {
            const src = (img.src || '').toLowerCase();
            if (src.includes('basketball') || src.includes('bet') || src.includes('ball') || src.includes('coin')) {
                const parent = img.closest('div[style*="position: fixed"], div[style*="position: absolute"]');
                if (parent && parent.getBoundingClientRect().width < 100) {
                    parent.remove();
                    reportBlocked('floating_icon_ad_removed');
                }
            }
        });
    }

    function startDomDefense() {
        if (typeof document === 'undefined') return;

        // Immediate initial sweep
        sweepDeceptiveModals();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                applyCosmeticShield();
                sweepDeceptiveModals();
            });
        }

        // Real-time MutationObserver
        let debounceTimer = null;
        const observer = new MutationObserver(() => {
            if (!isShieldEnabled) return;
            if (!debounceTimer) {
                debounceTimer = setTimeout(() => {
                    sweepDeceptiveModals();
                    debounceTimer = null;
                }, 40);
            }
        });

        observer.observe(document.documentElement || document, {
            childList: true,
            subtree: true
        });

        // Periodic hygiene sweep
        setInterval(() => {
            if (isShieldEnabled) sweepDeceptiveModals();
        }, 800);

        // Dedicated YouTube Defuser in Content World (Dual-Engine Guard)
        if (currentHost.includes('youtube.com')) {
            const adSelectors = [
                '.ytp-skip-ad-button',
                '.ytp-ad-skip-button',
                '.ytp-ad-skip-button-modern',
                'button[id^="skip-button"]',
                '.ytp-ad-skip-button-container button',
                'button.ytp-ad-skip-button-text',
                '.ytp-ad-overlay-close-button',
                'button[aria-label*="Skip"]'
            ];

            setInterval(() => {
                if (!isShieldEnabled) return;
                const video = document.querySelector('video.html5-main-video') || document.querySelector('video');
                const isAdPlaying = Boolean(
                    document.querySelector('.ad-showing, .ad-interrupting, .ytp-ad-player-overlay, .video-ads:not(:empty), .ytp-ad-module:not(:empty)')
                );

                if (isAdPlaying && video) {
                    // Click skip button immediately
                    const skipBtns = document.querySelectorAll(adSelectors.join(', '));
                    skipBtns.forEach(btn => {
                        try {
                            btn.click();
                            btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window }));
                            btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window }));
                        } catch { }
                    });

                    // Safe Speedup & mute (Never mutate video.currentTime to avoid skipping playlist tracks)
                    try {
                        video.muted = true;
                        video.playbackRate = 16.0;
                    } catch { }
                }
            }, 50);
        }
    }

    // Toggle message listener
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'updateShieldStatus') {
            isShieldEnabled = Boolean(msg.enabled);
            const style = document.getElementById('savezonix-cosmetic-shield');
            if (isShieldEnabled) {
                applyCosmeticShield();
                sweepDeceptiveModals();
            } else if (style) {
                style.remove();
            }
            sendResponse({ success: true, isShieldEnabled });
        }
    });

})();
