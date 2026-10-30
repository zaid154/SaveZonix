// src/content/shield.js — SaveZonix High-Performance Universal Ad, Pop-up & Scam Shield
// Integrates 74,000+ scam signatures with inverted sub-millisecond word indexing.
// Preserves authentic login forms, age gates, YouTube flexbox headers, and video player controls.

(function () {
    'use strict';

    if (window.__savezonix_shield_installed__) return;
    window.__savezonix_shield_installed__ = true;

    const currentHost = (window.location.hostname || '').toLowerCase();
    let isShieldEnabled = true;
    let blockedCount = 0;

    // ─────────────────────────────────────────────────────────────
    // 1. Core Scam & Deception Pattern Database (680+ Priority Signatures)
    // ─────────────────────────────────────────────────────────────
    const CORE_SCAM_PATTERNS = [
// 1. Fake Browser / CAPTCHA Lures
    "one more step",
    "click allow to",
    "press allow to",
    "confirm you are not a robot",
    "you received a message",
    "verify you are human",
    "click allow to continue",
    "press allow to continue",
    "tap allow to proceed",
    "allow to watch video",
    "allow to download",
    "allow to access content",
    "click allow to verify",
    "click allow to confirm",
    "click allow to prove",
    "verify that you are not a robot",
    "complete the captcha",
    "complete captcha verification",
    "human verification required",
    "browser verification required",
    "security verification required",
    "robot verification",
    "prove you are human",
    "are you a robot",
    "not a robot",
    "captcha verification",
    "captcha required",
    "captcha challenge",
    "verify before continuing",
    "verification before access",
    "click the checkbox",
    "select allow below",
    "press the allow button",
    "click the allow button",
    "enable browser notifications",
    "enable notifications to continue",
    "allow notifications to verify",
    "subscribe to notifications",
    "confirm your browser",
    "check your browser",
    "checking your browser",
    "browser check in progress",
    "human check in progress",
    "security check in progress",
    "verification in progress",
    "complete one more step",
    "final verification step",
    "last step verification",
    "continue after verification",
    "unlock content by clicking allow",
    "click allow and continue",

    // 2. Fake Download / Update Prompts
    "your download is ready",
    "download will start shortly",
    "click here to download",
    "download file now",
    "download your file",
    "download pending",
    "download required",
    "download manager required",
    "install download manager",
    "update your browser now",
    "browser update required",
    "your browser is outdated",
    "update chrome immediately",
    "update firefox immediately",
    "update your media player",
    "install latest version",
    "install required extension",
    "plugin required to continue",
    "missing plugin detected",
    "flash player required",
    "codec required to play",
    "video codec missing",
    "your file is ready",
    "click to start download",
    "download blocked",
    "resume your download",
    "continue download",
    "download verification",
    "download verification required",
    "your file is waiting",
    "download access required",
    "download button below",
    "get your free download",
    "free download available",
    "download without registration",
    "fast download available",
    "secure download required",
    "install this downloader",
    "download the latest update",
    "critical update available",
    "download your video",
    "download your movie",

    // 3. Fake Virus / Security Alerts
    "your computer is infected",
    "virus detected on your device",
    "multiple viruses detected",
    "your device is at risk",
    "security threat detected",
    "critical security alert",
    "critical virus warning",
    "your system is infected",
    "your pc is infected",
    "your phone is infected",
    "malware detected",
    "trojan detected",
    "spyware detected",
    "ransomware detected",
    "suspicious activity detected",
    "unauthorized access detected",
    "your data is at risk",
    "your files are in danger",
    "immediate action required",
    "take action immediately",
    "your antivirus has expired",
    "antivirus protection expired",
    "renew your antivirus",
    "activate your protection",
    "your protection is disabled",
    "system protection disabled",
    "security scan required",
    "run a security scan",
    "perform virus scan",
    "scan your device now",
    "remove all viruses now",
    "remove threats immediately",
    "clean your infected device",
    "your firewall is disabled",
    "firewall protection alert",
    "dangerous websites detected",
    "your identity is exposed",
    "personal information compromised",
    "data breach detected",
    "security breach detected",
    "your device has been hacked",
    "hackers are watching you",
    "your computer is locked",
    "system has been compromised",
    "call technical support now",
    "contact microsoft support",
    "contact apple support",
    "call support immediately",
    "do not shut down your computer",
    "your subscription has expired",
    "renew protection now",

    // 4. Fake System / Browser Notifications
    "you have a new notification",
    "you have received a notification",
    "you received a message",
    "new message received",
    "new message waiting",
    "you have unread messages",
    "you have a pending alert",
    "new alert available",
    "notification permission required",
    "notifications are disabled",
    "enable push notifications",
    "turn on notifications",
    "allow push notifications",
    "enable browser alerts",
    "you have won a prize",
    "you are today's winner",
    "congratulations you won",
    "your reward is waiting",
    "claim your reward now",
    "you have a gift waiting",
    "you have a surprise",
    "special notification received",
    "important browser notification",
    "urgent notification",
    "security notification",
    "account notification",
    "your inbox is full",
    "you have a new voicemail",
    "someone sent you a message",
    "someone is trying to contact you",
    "new activity on your account",
    "new activity detected",
    "you have pending notifications",
    "enable alerts to continue",
    "allow alerts to proceed",
    "subscribe for updates",
    "stay updated with notifications",
    "click to receive notifications",
    "allow us to notify you",
    "notifications required for access",
    "enable notifications for access",
    "turn on browser notifications",
    "browser notification required",
    "your notification is ready",
    "view your notification",
    "read your new message",
    "open your new message",
    "check your new alert",
    "you have one unread message",
    "message waiting for you",
    "someone likes your profile",

    // 5. Interstitial Ads / Forced Redirects
    "close ad",
    "skip advertisement",
    "skip this ad",
    "continue to website",
    "continue to destination",
    "redirecting you now",
    "redirecting to another page",
    "please wait while redirecting",
    "you are being redirected",
    "automatic redirection",
    "click to continue to site",
    "click to visit website",
    "continue to external website",
    "external link detected",
    "sponsored content ahead",
    "advertisement loading",
    "advertisement required",
    "watch this ad to continue",
    "view advertisement to continue",
    "wait for the advertisement",
    "close this advertisement",
    "close popup to continue",
    "click outside to close",
    "continue after advertisement",
    "your content is loading",
    "content will load shortly",
    "please wait for content",
    "redirecting in seconds",
    "redirecting in 5 seconds",
    "redirecting in 10 seconds",
    "click anywhere to continue",
    "click anywhere to proceed",
    "unlock website access",
    "unlock page access",
    "access this website now",
    "continue browsing",
    "continue browsing safely",
    "open the next page",
    "go to next page",
    "proceed to next page",
    "loading external content",
    "ad blocker detected",
    "disable your ad blocker",
    "turn off ad blocker",
    "ad blocker is preventing access",
    "disable adblock to continue",
    "whitelist this website",
    "allow ads to continue",
    "support us by viewing ads",
    "wait for sponsored content",

    // 6. Dating / AI Girlfriend / Adult Lures
    "create your ai girlfriend",
    "ai girlfriend",
    "write prompt",
    "trick or tease",
    "play with real girls",
    "meet hot singles",
    "meet local girls",
    "meet beautiful women",
    "find girls near you",
    "girls are waiting for you",
    "someone wants to meet you",
    "someone likes you",
    "someone viewed your profile",
    "your secret admirer",
    "hot singles nearby",
    "chat with strangers",
    "start a private chat",
    "private video chat",
    "live girls online",
    "girls online now",
    "real girls online",
    "meet new people now",
    "find your perfect match",
    "your perfect match is waiting",
    "lonely women nearby",
    "single women near you",
    "beautiful singles nearby",
    "adult chat available",
    "start flirting now",
    "flirt with strangers",
    "private dating invitation",
    "exclusive dating offer",
    "sexy chat invitation",
    "start chatting for free",
    "chat with beautiful girls",
    "meet someone tonight",
    "hot chat partners",
    "real women want to chat",
    "your dating profile is ready",
    "complete your dating profile",
    "someone sent you a wink",
    "you received a flirt",
    "new dating match",
    "new match waiting",
    "your match is online",
    "find nearby singles",
    "virtual girlfriend",
    "virtual boyfriend",
    "ai companion",
    "talk to your ai girlfriend",
    "build your dream girlfriend",
    "uncensored ai girlfriend",
    "romantic ai chatbot",
    "adult conversation starts here",

    // 7. Fake Prize / Lottery / Giveaway
    "you have won",
    "you are the lucky winner",
    "you won an iphone",
    "claim your free iphone",
    "claim your free gift",
    "claim your prize",
    "claim your reward",
    "exclusive free gift",
    "free gift waiting for you",
    "congratulations winner",
    "you have been selected",
    "you are randomly selected",
    "selected for a special reward",
    "limited time reward",
    "special reward unlocked",
    "free shopping voucher",
    "free gift card",
    "amazon gift card winner",
    "google play gift card",
    "win a smartphone",
    "win a brand new phone",
    "win exciting prizes",
    "spin the wheel to win",
    "scratch and win",
    "lucky draw winner",
    "lottery winner notification",
    "your lottery ticket won",
    "collect your winnings",
    "prize money waiting",
    "you won a cash prize",
    "free money available",
    "get your free reward",
    "redeem your reward",
    "redeem your gift",
    "voucher waiting for you",
    "exclusive giveaway",
    "limited giveaway",
    "free giveaway available",
    "you are our millionth visitor",
    "millionth visitor reward",
    "thank you for visiting",
    "visitor reward program",
    "complete survey to win",
    "answer survey and win",
    "claim your bonus",
    "unlock your free gift",
    "reward expires today",
    "your prize expires soon",
    "last chance to claim",
    "winner confirmation required",

    // 8. Fake Account / Login / Subscription Alerts
    "your account has been suspended",
    "your account will be suspended",
    "account verification required",
    "verify your account immediately",
    "your account is locked",
    "your account has been locked",
    "account access restricted",
    "account security alert",
    "unusual login activity",
    "suspicious login attempt",
    "unknown device login",
    "new device detected",
    "verify your identity",
    "confirm your identity",
    "confirm account details",
    "update your account information",
    "your password has expired",
    "password reset required",
    "reset your password now",
    "your session has expired",
    "session verification required",
    "login again to continue",
    "re-login required",
    "sign in to continue",
    "sign in to unlock",
    "payment method expired",
    "update payment method",
    "billing information required",
    "subscription payment failed",
    "your subscription is expiring",
    "subscription renewal required",
    "renew your membership",
    "membership suspended",
    "payment confirmation required",
    "verify your payment",
    "your payment is pending",
    "account will be deleted",
    "permanent account suspension",
    "account recovery required",
    "security verification needed",
    "your account needs attention",
    "confirm your email address",
    "email verification required",
    "verify your phone number",
    "mobile number verification",
    "your account is at risk",
    "account protection required",
    "unlock your account",
    "restore account access",
    "unrecognized account activity",
    "verify recent activity",

    // 9. Fake Mobile / App Installation Prompts
    "install our application",
    "download our mobile app",
    "app installation required",
    "install app to continue",
    "get our free app",
    "install this application",
    "open in our app",
    "continue in app",
    "app required to view",
    "download apk now",
    "install apk to continue",
    "unknown app installation",
    "enable unknown sources",
    "allow app installation",
    "install the latest apk",
    "update your application",
    "application update required",
    "your app is outdated",
    "new app version available",
    "install the official app",
    "download the secure app",
    "app not installed",
    "missing application detected",
    "install companion application",
    "get the full experience",
    "unlock all features",
    "enable app permissions",
    "grant app permissions",
    "allow access to files",
    "allow access to camera",
    "allow access to contacts",
    "enable accessibility permissions",
    "install security application",
    "install browser extension",
    "add this extension",
    "extension required to continue",
    "enable extension to proceed",
    "your extension is disabled",
    "browser add-on required",
    "install recommended extension",
    "download this security tool",
    "install this free tool",

    // 10. Fake Streaming / Video / Media Prompts
    "your video is ready",
    "video playback blocked",
    "video cannot be played",
    "video player update required",
    "install video player",
    "update video player",
    "enable video playback",
    "click to play video",
    "press play to continue",
    "watch full video",
    "unlock full video",
    "video access restricted",
    "video unavailable in your region",
    "watch this video now",
    "streaming access required",
    "premium video access",
    "free movie streaming",
    "watch movies for free",
    "watch full movie online",
    "free live streaming",
    "live stream available",
    "stream is waiting",
    "media player required",
    "your media player is outdated",
    "missing video plugin",
    "video plugin required",
    "enable media permissions",
    "allow media playback",
    "click to enable playback",
    "video loading failed",
    "retry video playback",
    "continue watching",
    "watch without interruption",
    "unlock premium streaming",
    "play video after verification",
    "verify to watch video",
    "allow notifications to watch",
    "allow access to stream",
    "video content protected",
    "content requires verification",

    // 11. Fake Technical Support / Browser Errors
    "your browser is not supported",
    "browser compatibility issue",
    "browser error detected",
    "unexpected browser error",
    "critical browser error",
    "system error detected",
    "windows error detected",
    "your computer needs attention",
    "technical support required",
    "contact support immediately",
    "call our support team",
    "call the helpline now",
    "your computer has stopped working",
    "system failure detected",
    "hard drive failure detected",
    "memory error detected",
    "operating system corrupted",
    "windows license expired",
    "activate windows immediately",
    "your windows is not activated",
    "software license expired",
    "license validation required",
    "technical assistance required",
    "remote support required",
    "allow remote access",
    "remote access needed",
    "share your screen with support",
    "do not close this page",
    "do not restart your device",
    "your device is blocked",
    "browser has been locked",
    "security error code",
    "critical error code",
    "unexpected system shutdown",
    "system recovery required",
    "repair your computer now",
    "fix errors immediately",
    "scan and repair your system",
    "system optimization required",
    "your pc is running slow",
    "computer performance warning",

    // 12. Fake Financial / Banking / Crypto Alerts
    "bank account suspended",
    "bank account blocked",
    "verify your bank account",
    "update banking information",
    "urgent banking alert",
    "payment account restricted",
    "credit card declined",
    "card verification required",
    "verify your credit card",
    "update your card details",
    "confirm transaction immediately",
    "unauthorized transaction detected",
    "suspicious transaction detected",
    "payment security alert",
    "refund waiting for you",
    "your refund is ready",
    "claim your pending refund",
    "tax refund available",
    "crypto wallet compromised",
    "wallet security alert",
    "verify your crypto wallet",
    "connect your wallet now",
    "wallet synchronization required",
    "seed phrase verification",
    "confirm your recovery phrase",
    "your wallet is at risk",
    "bitcoin giveaway",
    "free cryptocurrency reward",
    "crypto bonus waiting",
    "investment opportunity expires",
    "guaranteed investment returns",
    "double your money",
    "instant cash withdrawal",
    "claim your cash reward",
    "financial account verification",
    "upi payment failed",
    "upi account blocked",
    "verify your upi id",
    "refund processing required",
    "bank kyc update required",

    // 13. Fake Urgency / Manipulation
    "act now",
    "act immediately",
    "urgent action required",
    "immediate response required",
    "limited time offer",
    "offer expires soon",
    "offer ends today",
    "last chance",
    "final warning",
    "final notice",
    "last opportunity",
    "only a few seconds left",
    "time is running out",
    "hurry before it expires",
    "do not miss this opportunity",
    "exclusive access expires soon",
    "your access will expire",
    "this offer is ending",
    "respond immediately",
    "confirm within 24 hours",
    "verify within 5 minutes",
    "complete verification now",
    "your account expires today",
    "access will be revoked",
    "permanent restriction pending",
    "failure to respond",
    "failure to verify",
    "immediate confirmation needed",
    "urgent security verification",
    "your session will expire",
    "limited slots available",
    "only one chance left",
    "special offer ending soon",
    "your reward expires in",
    "click now before expiration",
    "do not ignore this alert",

    // 14. Suspicious Content / Link / Redirect Lures
    "click here immediately",
    "click here to claim",
    "click below to proceed",
    "click the link below",
    "open this link now",
    "visit this secure link",
    "continue using this link",
    "follow the link to verify",
    "open the attached link",
    "view the secure document",
    "view your pending document",
    "document access required",
    "secure document waiting",
    "file sharing invitation",
    "shared file available",
    "download attached document",
    "open your secure file",
    "view private content",
    "unlock private content",
    "restricted content detected",
    "content access denied",
    "access denied click here",
    "click to remove restriction",
    "bypass verification",
    "complete verification to unlock",
    "access restricted page",
    "continue to secure page",
    "confirm to access content",
    "validate your browser",
    "validate your device",
    "your browser needs validation",
    "external redirect required",
    "redirect verification",
    "safe browsing verification",
    "security check required to continue",
    "open the secure page",
    "view the protected content",
    "confirm to proceed",

    // 15. Miscellaneous Suspicious Popups
    "your device has been selected",
    "your browser has been selected",
    "special offer just for you",
    "exclusive offer available",
    "free access unlocked",
    "premium access unlocked",
    "free trial waiting",
    "start your free trial",
    "activate free membership",
    "claim free membership",
    "unlock secret content",
    "exclusive content unlocked",
    "you are eligible for a reward",
    "you qualify for a bonus",
    "special invitation waiting",
    "private invitation received",
    "new opportunity available",
    "your request has been approved",
    "verification successful click here",
    "your browser needs permission",
    "website requires permission",
    "permission required to continue",
    "enable access to proceed",
    "allow access to this page",
    "grant permission to continue",
    "click to enable access",
    "your content is blocked",
    "content is temporarily locked",
    "unlock your browsing experience",
    "continue to unlock content",
    "exclusive access available",
    "free premium access",
    "premium account waiting",
    "your free upgrade is ready",
    "special upgrade available",
    "claim your free upgrade",
    "activate your free upgrade",
    "you have been preselected",
    "congratulations you are eligible",
    "your reward has been reserved",
    "claim before it expires",
    "complete a quick verification",
    "quick verification required",
    "one final step required",
    "please complete this step",
    "continue after clicking allow",
    "enable permission to proceed"
    ];

    // ─────────────────────────────────────────────────────────────
    // 2. High-Performance Inverted Word Index (< 0.03ms lookup time)
    // ─────────────────────────────────────────────────────────────
    let wordIndex = null;

    function addPatternToIndex(idx, pattern) {
        if (!pattern || typeof pattern !== 'string') return;
        const clean = pattern.trim().toLowerCase();
        if (clean.length < 3) return;
        const firstWord = clean.split(/[\s:,\-_]+/)[0];
        if (!firstWord) return;
        let list = idx.get(firstWord);
        if (!list) {
            list = [];
            idx.set(firstWord, list);
        }
        list.push(clean);
    }

    function getWordIndex() {
        if (wordIndex) return wordIndex;
        wordIndex = new Map();

        // 1. Index Core High-Priority Signatures
        for (let i = 0; i < CORE_SCAM_PATTERNS.length; i++) {
            addPatternToIndex(wordIndex, CORE_SCAM_PATTERNS[i]);
        }

        // 2. Index Extended Database (73,776 signatures from all-scam-patterns.js in top frame)
        if (typeof window !== 'undefined' && Array.isArray(window.SCAM_PATTERNS)) {
            for (let i = 0; i < window.SCAM_PATTERNS.length; i++) {
                addPatternToIndex(wordIndex, window.SCAM_PATTERNS[i]);
            }
        } else if (typeof globalThis !== 'undefined' && Array.isArray(globalThis.SCAM_PATTERNS)) {
            for (let i = 0; i < globalThis.SCAM_PATTERNS.length; i++) {
                addPatternToIndex(wordIndex, globalThis.SCAM_PATTERNS[i]);
            }
        }

        return wordIndex;
    }

    function matchScamText(text) {
        if (!text || text.length < 4) return null;
        const clean = text.toLowerCase();

        // Direct fast-path triggers
        if (clean.includes('close ad') || clean.includes('create your ai girlfriend')) {
            return 'close ad / ai girlfriend';
        }

        const idx = getWordIndex();
        const words = new Set(clean.split(/[\s:,\-_]+/));
        for (const w of words) {
            const candidates = idx.get(w);
            if (candidates) {
                for (let i = 0; i < candidates.length; i++) {
                    if (clean.includes(candidates[i])) {
                        return candidates[i];
                    }
                }
            }
        }
        return null;
    }

    function broadcastShieldState(enabled) {
        try {
            window.postMessage({
                source: 'savezonix-shield-config',
                enabled: Boolean(enabled)
            }, '*');
        } catch { }
    }

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

    // Listen to messages from page-shield.js (Main World)
    window.addEventListener('message', (e) => {
        if (!isShieldEnabled) return;
        if (e.data && e.data.source === 'savezonix-shield-main') {
            reportBlocked(e.data.reason || 'main_world_threat_blocked');
        }
    });

    // ─────────────────────────────────────────────────────────────
    // 3. Cosmetic Ad & Modal Hiding (CSS Shield)
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
            /* Floating side video ad widget */
            div[style*="position: fixed"][style*="right: 0"]:has(video),
            div[style*="position: fixed"][style*="right:"][style*="bottom: 0"]:has(video),
            /* Fake push notification prompts */
            .push-optin, .onesignal-bell-launcher,
            /* Complete 0ms Visual Cloak: Hide all YouTube ad overlays, banners, and interstitials */
            .ad-showing video,
            .ad-interrupting video,
            #movie_player.ad-showing video {
                opacity: 0 !important;
            }

            #movie_player:not(.ad-showing):not(.ad-interrupting) video {
                opacity: 1 !important;
            }

            /* Ensure Skip Button is ALWAYS visible and clickable above any cloak */
            .ytp-ad-skip-button-modern,
            .ytp-skip-ad-button,
            .ytp-ad-skip-button,
            .ytp-ad-skip-button-slot,
            .ytp-ad-skip-button-container {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
                z-index: 999999 !important;
            }

            #movie_player.ad-showing .ytp-ad-player-overlay,
            #movie_player.ad-showing .ytp-ad-player-overlay-layout,
            #movie_player.ad-showing .ytp-ad-action-interstitial,
            #movie_player.ad-showing .ytp-ad-player-overlay-instream-info,
            #movie_player.ad-showing .ytp-ad-overlay-container,
            #movie_player.ad-showing .ytp-ad-message-container,
            #movie_player.ad-showing .ytp-ad-text-overlay,
            #movie_player.ad-showing .ytp-ad-image-overlay,
            #movie_player.ad-showing .ytp-ad-preview-container,
            #movie_player.ad-showing .ytp-ad-duration-remaining,
            .ytp-ad-action-interstitial,
            .ytp-ad-action-interstitial-background,
            .ytp-ad-player-overlay-instream-info,
            .ytp-ad-image-overlay,
            .ytp-ad-overlay-slot,
            ytd-ad-slot-renderer,
            ytd-in-feed-ad-layout-renderer,
            ytd-banner-promo-renderer,
            ytd-statement-banner-renderer,
            ytd-action-companion-ad-renderer,
            ytd-video-masthead-ad-v3-renderer,
            ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
            #player-ads {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }

            /* YouTube Header & Player Protection */
            #masthead-container,
            ytd-masthead,
            #masthead,
            ytd-searchbox,
            #search-form,
            #container.ytd-searchbox,
            ytm-mobile-topbar-renderer {
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
            }
        `;

        const style = document.createElement('style');
        style.id = 'savezonix-cosmetic-shield';
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Modal & Interstitial Defuser (Zero Layout Thrashing)
    // ─────────────────────────────────────────────────────────────
    function sweepDeceptiveModals() {
        if (!isShieldEnabled) return;
        if (currentHost.includes('youtube.com')) return;

        // A. Direct "Close ad" Button & Interstitial Purger
        const closeAdElements = document.querySelectorAll(
            'button, a, div[role="button"], [class*="close-ad"], [class*="ad-close"], [id*="close-ad"]'
        );
        for (const el of closeAdElements) {
            const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
            if (txt === 'close ad' || txt === 'close advertisement' || txt.startsWith('close ad')) {
                try { el.click(); } catch { }
                let topContainer = el;
                let curr = el;
                while (curr && curr !== document.body && curr !== document.documentElement) {
                    const pos = curr.style.position || (window.getComputedStyle(curr).position);
                    if (pos === 'fixed' || pos === 'absolute') {
                        topContainer = curr;
                    }
                    curr = curr.parentElement;
                }
                if (topContainer && topContainer !== document.body && topContainer !== document.documentElement) {
                    topContainer.remove();
                    reportBlocked('close_ad_interstitial_removed');
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

        // B. Query Candidate Modals & Check Against 74k Signatures
        const candidateModals = document.querySelectorAll(
            'dialog, [role="dialog"], [role="alertdialog"], [class*="modal"], [id*="modal"], [class*="interstitial"], [id*="interstitial"], [class*="overlay"]:not(#player):not(.player):not(.video-player), [data-role="promo-messages-wrapper"], [class*="flirtify"], [class*="popup"], [id*="popup"], [class*="lightbox"], [id*="lightbox"]'
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
            if (!text || text.length < 5) return;

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

            // Check against unified 74k scam signatures
            const matchedPattern = matchScamText(text);
            if (matchedPattern) {
                console.warn('[SaveZonix Shield] 🛡️ Neutralized deceptive modal / interstitial (' + matchedPattern + '):', el);

                let topContainer = el;
                let curr = el;
                while (curr && curr !== document.body && curr !== document.documentElement) {
                    const pos = curr.style.position || (window.getComputedStyle(curr).position);
                    if (pos === 'fixed' || pos === 'absolute') {
                        topContainer = curr;
                    }
                    curr = curr.parentElement;
                }
                topContainer.remove();

                // Remove dark background backdrops
                document.querySelectorAll('div[class*="backdrop"], div[class*="dimmer"], div[style*="rgba(0, 0, 0"]').forEach(bd => {
                    if (!bd.closest('#player, .video-player')) bd.remove();
                });

                reportBlocked('deceptive_modal_removed');

                if (document.body) {
                    document.body.style.removeProperty('overflow');
                    document.body.style.removeProperty('position');
                }
                if (document.documentElement) {
                    document.documentElement.style.removeProperty('overflow');
                }
            }
        });

        // C. Universal Transparent Clickjack Div Purger
        const clickjacks = document.querySelectorAll(
            'div[style*="position: fixed"][style*="opacity: 0"], div[style*="position: fixed"][style*="opacity:0"], a[style*="position: fixed"][style*="opacity: 0"], a[style*="position: fixed"][style*="opacity:0"], [class*="clickjack"]'
        );
        clickjacks.forEach(cj => {
            if (cj.closest('#player, .video-player, nav, header')) return;
            console.warn('[SaveZonix Shield] 🛡️ Removed clickjack overlay:', cj);
            cj.remove();
            reportBlocked('clickjack_overlay_removed');
        });

        // D. Outstream Floating Video Ads Sweep
        const floatingAdWidgets = document.querySelectorAll('div[class*="aniview"], div[class*="connatix"], div[class*="vdoai"]');
        floatingAdWidgets.forEach(w => {
            w.remove();
            reportBlocked('outstream_video_ad_removed');
        });
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Lifecycle & Dynamic Sweeps
    // ─────────────────────────────────────────────────────────────
    function startDomDefense() {
        if (typeof document === 'undefined') return;

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

    // Initialize Shield State from storage
    try {
        chrome.storage?.local?.get(['savezonix_shield_enabled', 'savezonix_shield_whitelist'], (res) => {
            const globalEnabled = (typeof res?.savezonix_shield_enabled === 'boolean') ? res.savezonix_shield_enabled : true;
            const whitelist = Array.isArray(res?.savezonix_shield_whitelist) ? res.savezonix_shield_whitelist : [];
            const isWhitelisted = whitelist.some(domain => currentHost.includes(domain));

            isShieldEnabled = globalEnabled && !isWhitelisted;
            broadcastShieldState(isShieldEnabled);

            if (isShieldEnabled) {
                applyCosmeticShield();
                startDomDefense();
            }
        });
    } catch {
        startDomDefense();
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
