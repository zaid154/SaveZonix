// src/content/shield.js — SaveZonix Universal Ad, Pop-up & Redirect Shield Engine
// Runs at document_start in isolated world; coordinates badge counters, cosmetic DOM cleanups & fail-safe scriptlet injection.

(function () {
    'use strict';

    let isShieldEnabled = true;
    let blockedCount = 0;
    const currentHost = (window.location.hostname || '').toLowerCase();

    // 1. Storage Check
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
                injectMainWorldFailsafe();
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

    // 2. Failsafe injection of page-shield.js into Main World
    function injectMainWorldFailsafe() {
        try {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('src/content/page-shield.js');
            script.async = false;
            (document.head || document.documentElement).prepend(script);
            script.onload = () => script.remove();
        } catch { }
    }

    // 3. Listen to messages from page-shield.js (Main World)
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
            /* SaveZonix Universal Cosmetic Ad & Modal Shield */
            [class*="ad-banner"], [id*="ad-banner"],
            [class*="popunder"], [id*="popunder"],
            [class*="banner-ad"], [id*="banner-ad"],
            [class*="ad-wrapper"], [id*="ad-wrapper"],
            [class*="ad-container"], [id*="ad-container"],
            [class*="sponsored-post"], [class*="native-ad"],
            div[class*="floating-ad"], div[id*="floating-ad"],
            div[class*="outstream"], div[id*="outstream"],
            div[class*="aniview"], div[class*="connatix"], div[class*="vdoai"],
            /* Floating sports / casino / sticky banners / basketball widget */
            div[style*="position: fixed"][style*="bottom: 0"][style*="z-index"]:has(a[target="_blank"]),
            div[style*="position: fixed"][style*="right:"][style*="top:"]:has(img),
            /* Floating side video ad with AI robot or sound controls */
            div[style*="position: fixed"][style*="right: 0"]:has(video),
            div[style*="position: fixed"][style*="right:"][style*="bottom: 0"]:has(video),
            /* Fake notification / age / captcha prompts */
            div[class*="push-prompt"], div[id*="push-prompt"],
            div[class*="notification-modal"], div[id*="notification-dialog"],
            /* Fake Cloudflare / Browser captcha prompts */
            div[style*="position: fixed"]:has(img[src*="browser"]),
            div[style*="position: fixed"]:has(input[type="checkbox"][id*="captcha"]) {
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
    // Layer 2: Deceptive Modal & Clickjack Annihilator (DOM Engine)
    // ─────────────────────────────────────────────────────────────
    const SCAM_PATTERNS = [
        // Fake Captcha & Browser Verification Prompts (Discovered in user screenshot)
        "one more step",
        "please go to captcha",
        "verify you are human",
        "is your browser",
        "choose your browser to continue",
        "captcha to access the site",

        // Fake Push Notifications & Age Checks
        "over 18",
        "confirm that you're over",
        "confirm that you are over",
        "confirm you are not a robot",
        "i'm not a robot",
        "you received a message",
        "click allow to view",
        "click allow to verify",
        "click \"allow\"",
        "click 'allow'",
        "press allow to continue",
        "your browser is outdated",
        "system has been infected",
        "trade gold 24/7"
    ];

    function sweepDeceptiveModals() {
        if (!isShieldEnabled) return;

        // 1. Sweep modals containing scam phrases
        const allFloating = document.querySelectorAll('div, dialog, section, aside');
        allFloating.forEach(el => {
            const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
            if (!style) return;

            const isOverlay = style.position === 'fixed' || style.position === 'absolute';
            const isHighZ = parseInt(style.zIndex, 10) >= 30;

            if (isOverlay || isHighZ) {
                const text = (el.innerText || el.textContent || '').toLowerCase();
                const matchedPattern = SCAM_PATTERNS.find(pat => text.includes(pat));

                if (matchedPattern) {
                    console.warn('[SaveZonix Shield] 🛡️ Removed deceptive scam modal (' + matchedPattern + '):', el);
                    
                    // If element has a parent modal container with position: fixed, remove the whole container
                    const modalParent = el.closest('div[style*="position: fixed"], div[style*="z-index"]') || el;
                    modalParent.remove();
                    reportBlocked('deceptive_modal_removed');

                    // If body overflow was set to hidden by modal, restore it
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
            if (v.hasAttribute('controls') || v.closest('#player') || v.closest('.player') || v.closest('.video-container')) {
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

        // 4. Sweep floating sports/basketball icons
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

        // Immediate initial sweeps
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

        // Periodic hygiene sweep for dynamically delayed scripts
        setInterval(() => {
            if (isShieldEnabled) sweepDeceptiveModals();
        }, 800);
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
