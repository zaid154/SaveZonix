// SaveZonix Cloud Sync & In-App Auth Controller (OTA Updates, Guest Limits, VIP Gatekeeper, OTP Auth)
(function () {
    let CURRENT_VERSION = '2.5.0';
    const CLOUD_API_BASE = 'https://savezonix.onrender.com';

    let cloudConfig = null;
    let currentUser = null;

    // Load user session from storage
    try {
        const saved = localStorage.getItem('savezonix_cloud_user');
        if (saved) currentUser = JSON.parse(saved);
    } catch { }

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', initCloudSync);

    async function initCloudSync() {
        injectAuthModalHTML();
        try {
            const healthRes = await fetch('/api/system/health');
            if (healthRes.ok) {
                const health = await healthRes.json();
                if (health && health.version) CURRENT_VERSION = health.version;
            }
        } catch { }
        await fetchCloudConfig();
        renderBanners();
        renderUserBadge();
    }

    // ─────────────────────────────────────────────────────────────
    // 1. Fetch Remote Config (Always Live from Render Cloud)
    // ─────────────────────────────────────────────────────────────
    async function fetchCloudConfig() {
        try {
            // Fetch live config from Render Cloud
            const res = await fetch(`${CLOUD_API_BASE}/api/app-config`);
            if (res.ok) {
                cloudConfig = await res.json();
                return;
            }
        } catch { }

        try {
            // Local C# fallback
            const res = await fetch('/api/app-config');
            if (res.ok) {
                cloudConfig = await res.json();
                return;
            }
        } catch { }

        // Local safe default
        cloudConfig = {
            latestAppVersion: CURRENT_VERSION,
            minAllowedVersion: '2.0.0',
            forceUpdate: false,
            freeDailyLimit: 10,
            lock4KForVip: true,
            allowGuestDownloads: true,
            guestDailyDownloadLimit: 5,
            appDownloadUrl: 'https://github.com/zaid154/SaveZonix/releases/latest',
            announcementMessage: ''
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Render Banners & Lock Screen
    // ─────────────────────────────────────────────────────────────
    function renderBanners() {
        if (!cloudConfig) return;

        // Announcement Banner
        if (cloudConfig.announcementMessage && cloudConfig.announcementMessage.trim().length > 0) {
            let el = document.getElementById('cloudAnnouncementBanner');
            if (!el) {
                el = document.createElement('div');
                el.id = 'cloudAnnouncementBanner';
                el.style.cssText = 'background: linear-gradient(90deg, #0284c7, #7c3aed); color: #fff; padding: 8px 16px; text-align: center; font-size: 13px; font-weight: 700; z-index: 999;';
                document.body.prepend(el);
            }
            el.innerHTML = `📢 ${cloudConfig.announcementMessage}`;
            el.style.display = 'block';
        }

        // Auto-Update Checks
        const isForceUpdate = cloudConfig.forceUpdate === true || compareVersions(CURRENT_VERSION, cloudConfig.minAllowedVersion) < 0;
        const isOptionalUpdate = compareVersions(CURRENT_VERSION, cloudConfig.latestAppVersion) < 0;

        if (isForceUpdate) {
            showForceUpdateModal();
        } else if (isOptionalUpdate) {
            if (cloudConfig.silentAutoUpdate === true && cloudConfig.appDownloadUrl) {
                triggerSilentAutoUpdate(cloudConfig.appDownloadUrl, cloudConfig.latestAppVersion);
            } else {
                showGraceUpdateBanner();
            }
        }
    }

    let isSilentUpdateRunning = false;
    let updatePollInterval = null;

    function triggerSilentAutoUpdate(url, version) {
        if (isSilentUpdateRunning) return;
        isSilentUpdateRunning = true;

        showSilentToast(`⚡ Preparing SaveZonix v${version} update...`, 0);

        fetch('/api/system/silent-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloadUrl: url, targetVersion: version })
        }).then(res => res.json()).then(data => {
            if (!data.success) {
                showGraceUpdateBanner();
                removeSilentToast();
                return;
            }
            startUpdateProgressPolling(version);
        }).catch(() => {
            showGraceUpdateBanner();
            removeSilentToast();
        });
    }

    function startUpdateProgressPolling(version) {
        if (updatePollInterval) clearInterval(updatePollInterval);
        updatePollInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/system/update-progress');
                if (!res.ok) return;
                const state = await res.json();

                if (state.isError) {
                    clearInterval(updatePollInterval);
                    removeSilentToast();
                    showGraceUpdateBanner();
                    return;
                }

                if (state.isComplete) {
                    clearInterval(updatePollInterval);
                    showSilentToast(`🚀 Installing v${version}... Launching new engine!`, 100);
                    setTimeout(() => removeSilentToast(), 6000);
                    return;
                }

                if (state.isActive) {
                    const pct = state.percent || 0;
                    const mbText = state.totalMB > 0 ? ` (${state.downloadedMB} MB / ${state.totalMB} MB)` : '';
                    showSilentToast(`⚡ Downloading v${version}: ${pct}%${mbText}`, pct);
                }
            } catch { }
        }, 1000);
    }

    function showSilentToast(msg, percent) {
        let toast = document.getElementById('silentUpdateToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'silentUpdateToast';
            toast.style.cssText = 'position: fixed; bottom: 24px; right: 24px; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(56, 189, 248, 0.4); color: #38bdf8; padding: 12px 20px; border-radius: 12px; font-size: 13px; font-weight: 600; box-shadow: 0 10px 30px rgba(0,0,0,0.6); z-index: 99999; display: flex; flex-direction: column; gap: 6px; backdrop-filter: blur(8px); min-width: 280px;';
            document.body.appendChild(toast);
        }
        const barWidth = typeof percent === 'number' ? Math.max(0, Math.min(100, percent)) : 0;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>${msg}</span>
            </div>
            <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; margin-top: 4px;">
                <div style="width: ${barWidth}%; height: 100%; background: #38bdf8; transition: width 0.3s ease;"></div>
            </div>
        `;
    }

    function removeSilentToast() {
        const toast = document.getElementById('silentUpdateToast');
        if (toast) toast.remove();
        isSilentUpdateRunning = false;
    }

    function compareVersions(v1, v2) {
        if (!v1 || !v2) return 0;
        const p1 = v1.replace(/[^0-9.]/g, '').split('.').map(Number);
        const p2 = v2.replace(/[^0-9.]/g, '').split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const num1 = p1[i] || 0;
            const num2 = p2[i] || 0;
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        return 0;
    }

    function showGraceUpdateBanner() {
        if (sessionStorage.getItem('savezonix_dismiss_update') === '1') return;
        let el = document.getElementById('cloudUpdateBanner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'cloudUpdateBanner';
            el.style.cssText = 'background: rgba(245, 158, 11, 0.15); border-bottom: 1px solid #f59e0b; color: #fbbf24; padding: 8px 16px; display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 13px; font-weight: 600; z-index: 998;';
            const navbar = document.querySelector('.navbar');
            if (navbar) navbar.parentNode.insertBefore(el, navbar.nextSibling);
            else document.body.prepend(el);
        }
        el.innerHTML = `
            <span>🚀 New SaveZonix v${cloudConfig.latestAppVersion} available!</span>
            <a href="${cloudConfig.appDownloadUrl}" target="_blank" style="padding: 3px 10px; background: #f59e0b; color: #000; border-radius: 6px; font-weight: 700; text-decoration: none; font-size: 12px;">Download Update</a>
            <button id="btnDismissUpdate" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; margin-left: 8px;">✕</button>
        `;
        document.getElementById('btnDismissUpdate')?.addEventListener('click', () => {
            el.style.display = 'none';
            sessionStorage.setItem('savezonix_dismiss_update', '1');
        });
    }

    function showForceUpdateModal() {
        let modal = document.getElementById('cloudForceUpdateModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'cloudForceUpdateModal';
            modal.style.cssText = 'position: fixed; inset: 0; background: rgba(3, 7, 18, 0.95); z-index: 999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(12px); padding: 20px;';
            modal.innerHTML = `
                <div style="max-width: 460px; width: 100%; background: #0f172a; border: 2px solid #ef4444; border-radius: 16px; padding: 32px 24px; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.8);">
                    <div style="font-size: 48px; margin-bottom: 12px;">🚨</div>
                    <h2 style="color: #f8fafc; font-size: 22px; font-weight: 800; margin: 0 0 8px 0;">Update Required</h2>
                    <p style="color: #94a3b8; font-size: 13.5px; line-height: 1.5; margin: 0 0 20px 0;">
                        Your current version (v${CURRENT_VERSION}) is deprecated. To continue downloading high-speed streams, please install the latest update (v${cloudConfig?.latestAppVersion || '2.5.0'}).
                    </p>
                    <a href="${cloudConfig?.appDownloadUrl || 'https://github.com/zaid154/SaveZonix/releases/latest'}" target="_blank" style="display: block; padding: 14px 24px; background: #ef4444; color: #fff; font-weight: 800; font-size: 15px; border-radius: 8px; text-decoration: none;">
                        ⬇️ Download Latest Installer (.exe)
                    </a>
                </div>
            `;
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
    }

    // ─────────────────────────────────────────────────────────────
    // 3. User Badge & Navigation Integration
    // ─────────────────────────────────────────────────────────────
    function renderUserBadge() {
        const navActions = document.querySelector('.nav-actions');
        if (!navActions) return;

        // Check if server-side user is already signed in (Razor Identity)
        const isServerUserLoggedIn = !!document.getElementById('userMenuBtn') || !!document.querySelector('.user-dropdown-container');
        if (isServerUserLoggedIn) {
            const existingBadge = document.getElementById('cloudUserBadgeContainer');
            if (existingBadge) existingBadge.remove();
            return;
        }

        let badgeContainer = document.getElementById('cloudUserBadgeContainer');
        if (!badgeContainer) {
            badgeContainer = document.createElement('div');
            badgeContainer.id = 'cloudUserBadgeContainer';
            badgeContainer.style.display = 'inline-flex';
            badgeContainer.style.alignItems = 'center';
            navActions.prepend(badgeContainer);
        } else {
            badgeContainer.style.display = 'inline-flex';
        }

        if (currentUser) {
            const isVip = currentUser.isVip === true;
            const dailyLimit = cloudConfig?.freeDailyLimit || 10;
            const used = currentUser.dailyDownloads || 0;
            const badgeLabel = isVip ? '💎 VIP Pro' : `🟢 ${currentUser.name.split(' ')[0]} (${used}/${dailyLimit})`;

            badgeContainer.innerHTML = `
                <div style="position: relative; display: inline-block;">
                    <button id="btnCloudUserMenu" style="padding: 6px 14px; background: ${isVip ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)'}; border: 1px solid ${isVip ? '#f59e0b' : '#10b981'}; color: ${isVip ? '#fbbf24' : '#34d399'}; border-radius: 20px; font-size: 12.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <span>${badgeLabel}</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    <div id="cloudUserDropdown" style="display: none; position: absolute; top: calc(100% + 6px); right: 0; width: 220px; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 1000;">
                        <div style="font-weight: 700; color: #f8fafc; font-size: 13px;">${currentUser.name}</div>
                        <div style="color: #64748b; font-size: 11.5px; margin-bottom: 8px;">${currentUser.email}</div>
                        <div style="padding: 6px 10px; background: #030712; border-radius: 6px; font-size: 11.5px; color: ${isVip ? '#fbbf24' : '#38bdf8'}; margin-bottom: 10px; font-weight: 600;">
                            ${isVip ? 'Unlimited 4K Downloads' : `${Math.max(0, dailyLimit - used)} free downloads left today`}
                        </div>
                        <button id="btnCloudLogout" style="width: 100%; padding: 6px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #f87171; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600;">
                            🚪 Sign Out
                        </button>
                    </div>
                </div>
            `;

            const btnMenu = document.getElementById('btnCloudUserMenu');
            const dropdown = document.getElementById('cloudUserDropdown');
            btnMenu?.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
            });
            document.addEventListener('click', () => {
                if (dropdown) dropdown.style.display = 'none';
            });
            document.getElementById('btnCloudLogout')?.addEventListener('click', handleLogout);
        } else {
            // Guest Mode Badge
            const today = new Date().toISOString().split('T')[0];
            const guestUsed = parseInt(localStorage.getItem(`savezonix_guest_count_${today}`) || '0', 10);
            const guestLimit = cloudConfig?.guestDailyDownloadLimit || 5;

            badgeContainer.innerHTML = `
                <button id="btnOpenAuthModal" style="padding: 6px 14px; background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.4); color: #38bdf8; border-radius: 20px; font-size: 12.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                    <span>👤 Guest (${guestUsed}/${guestLimit})</span>
                    <span style="font-size: 11px; opacity: 0.8; font-weight: normal;">• Sign In</span>
                </button>
            `;
            document.getElementById('btnOpenAuthModal')?.addEventListener('click', () => openAuthModal('login'));
        }
    }

    function handleLogout() {
        localStorage.removeItem('savezonix_cloud_user');
        localStorage.removeItem('savezonix_cloud_token');
        currentUser = null;
        renderUserBadge();
    }

    // ─────────────────────────────────────────────────────────────
    // 4. Download Gatekeeper (Guest & Free Quotas, 4K VIP Lock)
    // ─────────────────────────────────────────────────────────────
    window.checkDownloadPermission = function (selectedResolution) {
        // Check Force Update first
        if (cloudConfig?.forceUpdate === true || compareVersions(CURRENT_VERSION, cloudConfig?.minAllowedVersion) < 0) {
            showForceUpdateModal();
            return { allowed: false, reason: 'Please update your application to continue.' };
        }

        const is4K = typeof selectedResolution === 'string' && (selectedResolution.includes('2160') || selectedResolution.includes('4K') || selectedResolution.includes('1440'));

        // Check 4K Lock for VIP
        if (is4K && cloudConfig?.lock4KForVip === true) {
            if (!currentUser || currentUser.isVip !== true) {
                alert('🔒 4K Ultra-HD is reserved for VIP members.\n\nPlease select 1080p or upgrade to VIP for unrestricted 4K access!');
                return { allowed: false, reason: '4K VIP Restricted' };
            }
        }

        // If logged in via ASP.NET Core Identity
        const isServerUser = !!document.getElementById('userMenuBtn') || !!document.querySelector('.user-dropdown-container');
        if (isServerUser) {
            return { allowed: true };
        }

        // If user is logged in
        if (currentUser) {
            if (currentUser.isVip === true) {
                // Unlimited!
                return { allowed: true };
            }

            const freeLimit = cloudConfig?.freeDailyLimit || 10;
            if ((currentUser.dailyDownloads || 0) >= freeLimit) {
                alert(`⚠️ Daily Limit Reached!\n\nYou have used your ${freeLimit} free downloads for today.\nUpgrade to VIP for unlimited downloads, or return tomorrow!`);
                return { allowed: false, reason: 'Free daily limit reached' };
            }

            // Increment local user count
            currentUser.dailyDownloads = (currentUser.dailyDownloads || 0) + 1;
            localStorage.setItem('savezonix_cloud_user', JSON.stringify(currentUser));
            renderUserBadge();
            return { allowed: true };
        }

        // If Guest (not logged in)
        if (cloudConfig?.allowGuestDownloads === false) {
            alert('🔐 Sign In Required\n\nGuest downloads are currently disabled. Please sign in or create a free account to download.');
            openAuthModal('register');
            return { allowed: false, reason: 'Guest mode disabled' };
        }

        const today = new Date().toISOString().split('T')[0];
        const key = `savezonix_guest_count_${today}`;
        const guestUsed = parseInt(localStorage.getItem(key) || '0', 10);
        const guestLimit = cloudConfig?.guestDailyDownloadLimit || 5;

        if (guestUsed >= guestLimit) {
            alert(`⚠️ Guest Limit Exceeded!\n\nYou have completed ${guestLimit} guest downloads today.\nCreate a free account in 10 seconds to get ${cloudConfig?.freeDailyLimit || 10} downloads!`);
            openAuthModal('register');
            return { allowed: false, reason: 'Guest limit exceeded' };
        }

        // Increment guest count
        localStorage.setItem(key, (guestUsed + 1).toString());
        renderUserBadge();
        return { allowed: true };
    };

    // ─────────────────────────────────────────────────────────────
    // 5. In-App Dark Auth Modal (Login, Register with OTP, Forgot PW)
    // ─────────────────────────────────────────────────────────────
    let pendingRegisterData = null;
    let pendingResetEmail = null;

    function injectAuthModalHTML() {
        if (document.getElementById('cloudAuthModal')) return;

        const modal = document.createElement('div');
        modal.id = 'cloudAuthModal';
        modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(3, 7, 18, 0.85); z-index: 99999; align-items: center; justify-content: center; backdrop-filter: blur(8px); padding: 20px;';
        modal.innerHTML = `
            <div style="max-width: 440px; width: 100%; background: #0a0f1d; border: 1px solid #1e293b; border-radius: 16px; padding: 32px 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.8); position: relative; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                <button id="btnCloudAuthClose" style="position: absolute; top: 16px; right: 16px; background: transparent; border: none; color: #64748b; font-size: 18px; cursor: pointer;">✕</button>

                <!-- Status Message -->
                <div id="cloudAuthMessage" style="display: none; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-bottom: 16px;"></div>

                <!-- VIEW 1: SIGN IN -->
                <div id="viewSignIn">
                    <h2 style="color: #f8fafc; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">Sign In to SaveZonix</h2>
                    <p style="color: #94a3b8; font-size: 13px; margin: 0 0 20px 0;">Access your profile, sync downloads, and enjoy VIP speeds.</p>
                    
                    <form id="formSignIn" style="display: flex; flexDirection: column; gap: 14px;">
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Email Address</label>
                            <input type="email" id="inputSignInEmail" style="width: 100%; padding: 10px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13.5px;" placeholder="user@example.com" required />
                        </div>
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <label style="font-size: 12px; font-weight: 700; color: #cbd5e1;">Password</label>
                                <a href="#" id="linkForgotPassword" style="font-size: 11.5px; color: #38bdf8; text-decoration: none;">Forgot password?</a>
                            </div>
                            <input type="password" id="inputSignInPassword" style="width: 100%; padding: 10px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13.5px;" placeholder="••••••••" required />
                        </div>
                        <button type="submit" id="btnSubmitSignIn" style="margin-top: 6px; padding: 12px; background: #0284c7; color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;">Sign In 🚀</button>
                    </form>

                    <div style="text-align: center; margin-top: 18px; font-size: 12.5px; color: #94a3b8;">
                        Don't have an account? <a href="#" id="linkGoToRegister" style="color: #38bdf8; font-weight: 700; text-decoration: none;">Create Free Account</a>
                    </div>
                </div>

                <!-- VIEW 2: REGISTER -->
                <div id="viewRegister" style="display: none;">
                    <h2 style="color: #f8fafc; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">Create Free Account</h2>
                    <p style="color: #94a3b8; font-size: 13px; margin: 0 0 20px 0;">We will email you a 6-digit verification code.</p>

                    <form id="formRegister" style="display: flex; flexDirection: column; gap: 14px;">
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Full Name</label>
                            <input type="text" id="inputRegisterName" style="width: 100%; padding: 10px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13.5px;" placeholder="Zaid" required />
                        </div>
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Email Address</label>
                            <input type="email" id="inputRegisterEmail" style="width: 100%; padding: 10px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13.5px;" placeholder="user@gmail.com" required />
                        </div>
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Choose Password</label>
                            <input type="password" id="inputRegisterPassword" minlength="6" style="width: 100%; padding: 10px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13.5px;" placeholder="At least 6 characters" required />
                        </div>
                        <button type="submit" id="btnSubmitRegister" style="margin-top: 6px; padding: 12px; background: #0284c7; color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;">Send Verification Code ✉️</button>
                    </form>

                    <div style="text-align: center; margin-top: 18px; font-size: 12.5px; color: #94a3b8;">
                        Already registered? <a href="#" id="linkGoToSignIn" style="color: #38bdf8; font-weight: 700; text-decoration: none;">Sign In</a>
                    </div>
                </div>

                <!-- VIEW 3: OTP VERIFICATION -->
                <div id="viewOtp" style="display: none; text-align: center;">
                    <div style="font-size: 36px; margin-bottom: 8px;">🔐</div>
                    <h2 style="color: #f8fafc; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">Enter 6-Digit Code</h2>
                    <p id="txtOtpNotice" style="color: #94a3b8; font-size: 13px; margin: 0 0 20px 0;">We sent a verification code to your email.</p>

                    <form id="formOtp" style="display: flex; flexDirection: column; gap: 18px;">
                        <input type="text" id="inputOtpCode" maxlength="6" pattern="[0-9]{6}" style="width: 220px; margin: 0 auto; text-align: center; font-size: 28px; font-weight: 900; letter-spacing: 8px; padding: 12px; background: #030712; border: 2px solid #38bdf8; border-radius: 12px; color: #38bdf8; font-family: monospace;" placeholder="------" required />
                        
                        <button type="submit" id="btnSubmitOtp" style="padding: 12px; background: #10b981; color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;">
                            Verify &amp; Activate Account ✅
                        </button>
                    </form>

                    <div style="margin-top: 16px;">
                        <button type="button" id="btnBackFromOtp" style="background: transparent; border: none; color: #64748b; font-size: 12.5px; cursor: pointer;">← Change Email / Back</button>
                    </div>
                </div>

                <!-- VIEW 4: FORGOT PASSWORD -->
                <div id="viewForgotPassword" style="display: none;">
                    <h2 style="color: #f8fafc; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">Reset Password</h2>
                    <p style="color: #94a3b8; font-size: 13px; margin: 0 0 20px 0;">Enter your registered email to receive a reset code.</p>

                    <form id="formForgotStep1" style="display: flex; flexDirection: column; gap: 14px;">
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Registered Email</label>
                            <input type="email" id="inputForgotEmail" style="width: 100%; padding: 10px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13.5px;" placeholder="user@gmail.com" required />
                        </div>
                        <button type="submit" id="btnSendResetOtp" style="padding: 12px; background: #0284c7; color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;">Send Reset Code ✉️</button>
                    </form>

                    <form id="formForgotStep2" style="display: none; flexDirection: column; gap: 14px; margin-top: 14px;">
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">6-Digit OTP Code</label>
                            <input type="text" id="inputForgotOtp" maxlength="6" style="width: 100%; padding: 10px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #38bdf8; font-weight: 700; font-size: 16px; text-align: center; letter-spacing: 4px;" placeholder="123456" required />
                        </div>
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">New Password</label>
                            <input type="password" id="inputForgotNewPassword" minlength="6" style="width: 100%; padding: 10px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13.5px;" placeholder="At least 6 characters" required />
                        </div>
                        <button type="submit" id="btnSubmitResetPassword" style="padding: 12px; background: #10b981; color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;">Save New Password &amp; Sign In</button>
                    </form>

                    <div style="text-align: center; margin-top: 16px;">
                        <button type="button" id="btnBackToSignInFromForgot" style="background: transparent; border: none; color: #64748b; font-size: 12.5px; cursor: pointer;">← Back to Sign In</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Wire Event Listeners
        document.getElementById('btnCloudAuthClose')?.addEventListener('click', closeAuthModal);
        document.getElementById('linkGoToRegister')?.addEventListener('click', (e) => { e.preventDefault(); switchAuthView('register'); });
        document.getElementById('linkGoToSignIn')?.addEventListener('click', (e) => { e.preventDefault(); switchAuthView('signIn'); });
        document.getElementById('linkForgotPassword')?.addEventListener('click', (e) => { e.preventDefault(); switchAuthView('forgot'); });
        document.getElementById('btnBackToSignInFromForgot')?.addEventListener('click', () => switchAuthView('signIn'));
        document.getElementById('btnBackFromOtp')?.addEventListener('click', () => switchAuthView('register'));

        // Handle Sign In Submit
        document.getElementById('formSignIn')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('inputSignInEmail').value.trim();
            const password = document.getElementById('inputSignInPassword').value;
            const btn = document.getElementById('btnSubmitSignIn');

            btn.disabled = true;
            btn.textContent = 'Signing in...';
            showAuthMessage('');

            try {
                const res = await fetch(`${CLOUD_API_BASE}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Login failed');

                localStorage.setItem('savezonix_cloud_token', data.token);
                localStorage.setItem('savezonix_cloud_user', JSON.stringify(data.user));
                currentUser = data.user;
                renderUserBadge();
                closeAuthModal();
            } catch (err) {
                showAuthMessage(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Sign In 🚀';
            }
        });

        // Handle Register Submit (Step 1: Send OTP)
        document.getElementById('formRegister')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('inputRegisterName').value.trim();
            const email = document.getElementById('inputRegisterEmail').value.trim();
            const password = document.getElementById('inputRegisterPassword').value;
            const btn = document.getElementById('btnSubmitRegister');

            btn.disabled = true;
            btn.textContent = 'Sending OTP...';
            showAuthMessage('');

            try {
                const res = await fetch(`${CLOUD_API_BASE}/api/auth/send-register-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

                pendingRegisterData = { name, email, password };
                document.getElementById('txtOtpNotice').textContent = `We sent a 6-digit verification code to ${email}`;
                switchAuthView('otp');
            } catch (err) {
                showAuthMessage(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Send Verification Code ✉️';
            }
        });

        // Handle OTP Submit (Step 2: Verify & Login)
        document.getElementById('formOtp')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otp = document.getElementById('inputOtpCode').value.trim();
            const btn = document.getElementById('btnSubmitOtp');

            if (!pendingRegisterData) {
                showAuthMessage('Session expired. Please register again.', 'error');
                switchAuthView('register');
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Verifying...';
            showAuthMessage('');

            try {
                const res = await fetch(`${CLOUD_API_BASE}/api/auth/verify-register-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: pendingRegisterData.email, otp })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Invalid OTP code');

                localStorage.setItem('savezonix_cloud_token', data.token);
                localStorage.setItem('savezonix_cloud_user', JSON.stringify(data.user));
                currentUser = data.user;
                renderUserBadge();
                closeAuthModal();
                alert('🎉 Welcome to SaveZonix! Your account has been verified.');
            } catch (err) {
                showAuthMessage(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Verify & Activate Account ✅';
            }
        });

        // Handle Forgot Password Step 1 (Send Reset OTP)
        document.getElementById('formForgotStep1')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('inputForgotEmail').value.trim();
            const btn = document.getElementById('btnSendResetOtp');

            btn.disabled = true;
            btn.textContent = 'Sending...';
            showAuthMessage('');

            try {
                const res = await fetch(`${CLOUD_API_BASE}/api/auth/send-reset-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                pendingResetEmail = email;
                showAuthMessage(`Reset code sent to ${email}. Check your inbox!`, 'success');
                document.getElementById('formForgotStep1').style.display = 'none';
                document.getElementById('formForgotStep2').style.display = 'flex';
            } catch (err) {
                showAuthMessage(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Send Reset Code ✉️';
            }
        });

        // Handle Forgot Password Step 2 (Verify OTP & Save Password)
        document.getElementById('formForgotStep2')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const otp = document.getElementById('inputForgotOtp').value.trim();
            const newPassword = document.getElementById('inputForgotNewPassword').value;
            const btn = document.getElementById('btnSubmitResetPassword');

            btn.disabled = true;
            btn.textContent = 'Saving...';
            showAuthMessage('');

            try {
                const res = await fetch(`${CLOUD_API_BASE}/api/auth/verify-reset-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: pendingResetEmail, otp, newPassword })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Password reset failed');

                localStorage.setItem('savezonix_cloud_token', data.token);
                localStorage.setItem('savezonix_cloud_user', JSON.stringify(data.user));
                currentUser = data.user;
                renderUserBadge();
                closeAuthModal();
                alert('✅ Password updated successfully! You are now logged in.');
            } catch (err) {
                showAuthMessage(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Save New Password & Sign In';
            }
        });
    }

    function switchAuthView(viewName) {
        showAuthMessage('');
        const views = {
            signIn: document.getElementById('viewSignIn'),
            register: document.getElementById('viewRegister'),
            otp: document.getElementById('viewOtp'),
            forgot: document.getElementById('viewForgotPassword')
        };
        Object.keys(views).forEach(k => {
            if (views[k]) views[k].style.display = k === viewName ? 'block' : 'none';
        });
        if (viewName === 'forgot') {
            document.getElementById('formForgotStep1').style.display = 'flex';
            document.getElementById('formForgotStep2').style.display = 'none';
        }
    }

    function showAuthMessage(msg, type = 'error') {
        const el = document.getElementById('cloudAuthMessage');
        if (!el) return;
        if (!msg) {
            el.style.display = 'none';
            return;
        }
        el.textContent = msg;
        el.style.display = 'block';
        if (type === 'error') {
            el.style.background = 'rgba(239, 68, 68, 0.15)';
            el.style.border = '1px solid #ef4444';
            el.style.color = '#f87171';
        } else {
            el.style.background = 'rgba(16, 185, 129, 0.15)';
            el.style.border = '1px solid #10b981';
            el.style.color = '#34d399';
        }
    }

    function openAuthModal(initialView = 'signIn') {
        injectAuthModalHTML();
        switchAuthView(initialView);
        const modal = document.getElementById('cloudAuthModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeAuthModal() {
        const modal = document.getElementById('cloudAuthModal');
        if (modal) modal.style.display = 'none';
    }

    window.openCloudAuth = openAuthModal;
})();
