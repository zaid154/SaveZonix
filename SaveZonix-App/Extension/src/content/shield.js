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
            /* Top Promo Banner Strips & Video Platform Ad Bars */
            div[class*="top-banner"], div[id*="top-banner"],
            div[class*="header-banner"], div[id*="header-banner"],
            div[class*="promo-banner"], div[id*="promo-banner"],
            div[class*="banner-promo"], div[id*="banner-promo"],
            div[class*="promo-strip"], div[id*="promo-strip"],
            div[class*="top-promo"], div[id*="top-promo"],
            div[class*="ad-header"], div[id*="ad-header"],
            div[class*="ad-strip"], div[class*="ad_strip"],
            div[class*="site-banner"], div[id*="site-banner"],
            div[class*="top-strip"], div[id*="top-strip"],
            div[data-role="promo-messages-wrapper"],
            div[data-role*="promo-message"],
            div[data-role="sponsor-banner"],
            div[data-role*="sponsor"],
            div[data-role*="player-sponsor"],
            a[data-role="player-sponsor-link"],
            div[data-testid*="banner"],
            div[data-testid*="promo"],
            aside[class*="premium-n-overlay"],
            div[class*="premium-n-overlay"],
            .live-nav,
            /* Promoted sidebar / join boxes */
            div[class*="promoted-box"], div[class*="sponsored-box"],
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

            /* Explicit protection for YouTube Header & Search Bar (Preserves native flexbox layout) */
            #masthead-container, ytd-masthead, #masthead, ytd-searchbox, #search-form, ytm-mobile-topbar-renderer, .mobile-topbar-header {
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
    // Layer 2: Deceptive Scam Modal & Clickjack Annihilator (Ultra-Fast DOM Engine)
    // ─────────────────────────────────────────────────────────────
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
        "you received a message",

        // Interstitial Ad / Dating & AI Girlfriend Modals
        "close ad",
        "create your ai girlfriend",
        "ai girlfriend",
        "write prompt",
        "trick or tease",
        "play with real girls"
    ];

    function broadcastShieldState(enabled) {
        try {
            window.postMessage({
                source: 'savezonix-shield-config',
                enabled: Boolean(enabled)
            }, '*');
        } catch { }
    }

    function sweepDeceptiveModals() {
        if (!isShieldEnabled) return;
        if (currentHost.includes('youtube.com')) return;

        // 1. High-Performance Modal Sweep: strictly query modal/dialog containers (Zero Layout Thrashing)
        const candidateModals = document.querySelectorAll(
            'dialog, [class*="modal"], [id*="modal"], [class*="interstitial"], [id*="interstitial"], [class*="overlay"]:not(#player):not(.player):not(.video-player), [data-role="promo-messages-wrapper"]'
        );

        candidateModals.forEach(el => {
            // SAFEGUARD: Never delete legitimate navigation headers, search boxes, forms, login boxes, or authentic age verification gates
            if (el.closest('#masthead-container, ytd-masthead, #masthead, ytd-searchbox, #search-form, ytm-mobile-topbar-renderer, header, nav, #player, .video-player')) {
                return;
            }

            const hasForm = el.querySelector('form') !== null;
            const hasInputs = el.querySelector('input[type="password"], input[type="email"], input[name*="user"], input[type="radio"]') !== null;
            const isAuthOrLogin = /login|signin|register|signup|auth|account/i.test(el.className + ' ' + el.id);

            const text = (el.innerText || el.textContent || '').toLowerCase();

            // Authentic Age Gate detection: real age gates give choice ("Enter" / "Exit" / "I am 18" / "Under 18")
            const isAuthenticAgeGate = (
                (text.includes('18') || text.includes('age') || text.includes('disclaimer') || text.includes('terms')) &&
                (text.includes('enter') || text.includes('yes') || text.includes('agree') || text.includes('exit') || text.includes('leave') || text.includes('continue')) &&
                !text.includes('click "allow"') &&
                !text.includes('click \'allow\'') &&
                !text.includes('click allow')
            );

            if ((hasForm || hasInputs || isAuthOrLogin || isAuthenticAgeGate) && !text.includes('close ad') && !text.includes('ai girlfriend')) {
                return; // Preserve legitimate dialog/gateway intact
            }

            // Check against deceptive scam patterns or interstitial ad cards
            const matchedPattern = SCAM_PATTERNS.find(pat => text.includes(pat));
            if (matchedPattern) {
                console.warn('[SaveZonix Shield] 🛡️ Neutralized deceptive modal / interstitial (' + matchedPattern + '):', el);
                
                const modalParent = el.closest('div[style*="position: fixed"], div[style*="z-index"]') || el;
                modalParent.remove();

                // Remove dark background backdrops
                document.querySelectorAll('div[class*="backdrop"], div[style*="rgba(0, 0, 0"]').forEach(bd => {
                    if (!bd.closest('#player, .video-player')) bd.remove();
                });

                reportBlocked('deceptive_modal_removed');

                if (document.body && (document.body.style.overflow === 'hidden' || document.body.style.position === 'fixed')) {
                    document.body.style.overflow = 'auto';
                    document.body.style.position = 'static';
                }
                if (document.documentElement && document.documentElement.style.overflow === 'hidden') {
                    document.documentElement.style.overflow = 'auto';
                }
            }
        });

        // 2. High-Performance Clickjack Purger (Targets invisible full-screen overlays without getComputedStyle loop)
        const clickjacks = document.querySelectorAll(
            'div[style*="position: fixed"][style*="opacity: 0"], div[style*="position: fixed"][style*="opacity:0"], a[style*="position: fixed"][style*="opacity: 0"], a[style*="position: fixed"][style*="opacity:0"], [class*="clickjack"]'
        );
        clickjacks.forEach(cj => {
            if (cj.closest('#player, .video-player, nav, header')) return;
            console.warn('[SaveZonix Shield] 🛡️ Removed clickjack overlay:', cj);
            cj.remove();
            reportBlocked('clickjack_overlay_removed');
        });

        // 3. Fast Outstream Video Ads Sweep
        const floatingAdWidgets = document.querySelectorAll('div[class*="aniview"], div[class*="connatix"], div[class*="vdoai"]');
        floatingAdWidgets.forEach(w => {
            w.remove();
            reportBlocked('outstream_video_ad_removed');
        });
    }

    function startDomDefense() {
        if (typeof document === 'undefined') return;

        // Immediate initial sweep & broadcast enabled status
        broadcastShieldState(isShieldEnabled);
        sweepDeceptiveModals();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                applyCosmeticShield();
                sweepDeceptiveModals();
                broadcastShieldState(isShieldEnabled);
            });
        }

        // Lightweight debounced MutationObserver (250ms debounce prevents CPU freezing)
        let debounceTimer = null;
        const observer = new MutationObserver(() => {
            if (!isShieldEnabled) return;
            if (!debounceTimer) {
                debounceTimer = setTimeout(() => {
                    sweepDeceptiveModals();
                    debounceTimer = null;
                }, 250);
            }
        });

        observer.observe(document.documentElement || document, {
            childList: true,
            subtree: true
        });

        // Periodic low-frequency hygiene sweep (every 2.5 seconds, near zero CPU)
        setInterval(() => {
            if (isShieldEnabled) sweepDeceptiveModals();
        }, 2500);
    }

    // Toggle message listener
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'updateShieldStatus') {
            isShieldEnabled = Boolean(msg.enabled);
            broadcastShieldState(isShieldEnabled);
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
