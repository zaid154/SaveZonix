// SaveZonix Cloud Sync & In-App Auth Controller (OTA Updates, Guest Limits, VIP Gatekeeper, OTP Auth)
(function () {
    let CURRENT_VERSION = '2.5.2';
    const CLOUD_API_BASE = 'https://savezonix.onrender.com';

    let cloudConfig = null;
    let currentUser = null;

    // Load user session from storage
    try {
        const saved = localStorage.getItem('savezonix_cloud_user');
        if (saved) currentUser = JSON.parse(saved);
    } catch { }

    // Cross-tab Synchronization: Listen for storage events from other tabs
    window.addEventListener('storage', (e) => {
        if (!e.key) return;
        if (e.key === 'savezonix_cloud_user' || e.key === 'savezonix_cloud_token') {
            try {
                const saved = localStorage.getItem('savezonix_cloud_user');
                currentUser = saved ? JSON.parse(saved) : null;
            } catch {
                currentUser = null;
            }
            renderUserBadge();
        } else if (e.key.startsWith('savezonix_guest_count_')) {
            renderUserBadge();
        }
    });

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', initCloudSync);

    async function initCloudSync() {
        injectAuthModalHTML();
        renderUserBadge(); // Instant synchronous render on load — NO delay, NO flicker!
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

        // Periodically refresh cloud configuration (every 20s) to react to maintenance mode or OTA updates
        setInterval(async () => {
            await fetchCloudConfig();
            renderBanners();
            renderUserBadge();
        }, 20000);
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
            announcementMessage: '',
            maintenanceMode: false,
            maintenanceDurationMinutes: 15,
            maintenanceEndsAt: null,
            maintenanceMessage: 'Server routine upgrade in progress. All stream engines will resume shortly.',
            freeMaxSpeedMBps: 15,
            vipMaxSpeedMBps: 0,
            platformThreadCaps: { youtube: 64, instagram: 24, tiktok: 24, directCdn: 128 }
        };
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Render Banners & Lock Screen
    // ─────────────────────────────────────────────────────────────
    function renderBanners() {
        if (!cloudConfig) return;

        // Smart Fleet Maintenance Mode Check
        if (cloudConfig.maintenanceMode === true) {
            showMaintenanceModal();
            return;
        } else {
            removeMaintenanceModal();
        }

        // Announcement Banner
        if (cloudConfig.announcementMessage && cloudConfig.announcementMessage.trim().length > 0) {
            let el = document.getElementById('cloudAnnouncementBanner');
            if (!el) {
                el = document.createElement('div');
                el.id = 'cloudAnnouncementBanner';
                el.style.cssText = 'background: linear-gradient(90deg, #0284c7, #7c3aed); color: #fff; padding: 8px 16px; text-align: center; font-size: 13px; font-weight: 700; z-index: 999;';
                document.body.prepend(el);
            }
            el.innerHTML = ` ${cloudConfig.announcementMessage}`;
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

        showSilentToast(` Preparing SaveZonix v${version} update...`, 0);

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
                    showSilentToast(` Installing v${version}... Launching new engine!`, 100);
                    setTimeout(() => removeSilentToast(), 6000);
                    return;
                }

                if (state.isActive) {
                    const pct = state.percent || 0;
                    const mbText = state.totalMB > 0 ? ` (${state.downloadedMB} MB / ${state.totalMB} MB)` : '';
                    showSilentToast(` Downloading v${version}: ${pct}%${mbText}`, pct);
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
            <span>New SaveZonix v${cloudConfig.latestAppVersion} available!</span>
            <a href="${cloudConfig.appDownloadUrl}" target="_blank" style="padding: 3px 10px; background: #f59e0b; color: #000; border-radius: 6px; font-weight: 700; text-decoration: none; font-size: 12px;">Download Update</a>
            <button id="btnDismissUpdate" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; margin-left: 8px;"></button>
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
                    
                    <h2 style="color: #f8fafc; font-size: 22px; font-weight: 800; margin: 0 0 8px 0;">Update Required</h2>
                    <p style="color: #94a3b8; font-size: 13.5px; line-height: 1.5; margin: 0 0 20px 0;">Your current version (v${CURRENT_VERSION}) is deprecated. To continue downloading high-speed streams, please install the latest update (v${cloudConfig?.latestAppVersion || '2.5.0'}).
                    </p>
                    <a href="${cloudConfig?.appDownloadUrl || 'https://github.com/zaid154/SaveZonix/releases/latest'}" target="_blank" style="display: block; padding: 14px 24px; background: #ef4444; color: #fff; font-weight: 800; font-size: 15px; border-radius: 8px; text-decoration: none;">
                        ⬇ Download Latest Installer (.exe)
                    </a>
                </div>
            `;
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
    }

    // ─────────────────────────────────────────────────────────────
    // Smart Fleet Maintenance Modal & Live Countdown
    // ─────────────────────────────────────────────────────────────
    let maintenanceCountdownTimer = null;

    function showMaintenanceModal() {
        let modal = document.getElementById('cloudMaintenanceModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'cloudMaintenanceModal';
            modal.style.cssText = 'position: fixed; inset: 0; background: rgba(3, 7, 18, 0.96); z-index: 9999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(16px); padding: 24px; font-family: inherit;';
            document.body.appendChild(modal);
        }

        const msg = cloudConfig?.maintenanceMessage || 'Fleet engines are undergoing scheduled performance tuning & core infrastructure updates. Service will resume momentarily.';

        modal.innerHTML = `
            <div style="max-width: 520px; width: 100%; background: linear-gradient(180deg, #0f172a 0%, #080d19 100%); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 20px; padding: 36px 28px; text-align: center; box-shadow: 0 30px 70px rgba(0,0,0,0.85); position: relative; overflow: hidden;">
                
                
                

                <div style="display: inline-flex; align-items: center; gap: 8px; padding: 4px 14px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 20px; color: #fbbf24; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px;">
                    <span style="width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span>Scheduled Fleet Maintenance
                </div>

                <h2 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 10px 0; letter-spacing: -0.3px;">Engines Under Optimization
                </h2>

                <p style="color: #94a3b8; font-size: 13.5px; line-height: 1.6; margin: 0 0 24px 0;">
                    ${msg}
                </p>

                <!-- Countdown Timer Display -->
                <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid #1e293b; border-radius: 14px; padding: 18px 24px; margin-bottom: 24px; display: flex; align-items: center; justify-content: center; gap: 24px;">
                    <div>
                        <div id="maintTimerMinutes" style="font-size: 32px; font-weight: 800; color: #f8fafc; font-family: monospace;">--</div>
                        <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Minutes</div>
                    </div>
                    <div style="font-size: 26px; font-weight: 800; color: #f59e0b; margin-top: -14px;">:</div>
                    <div>
                        <div id="maintTimerSeconds" style="font-size: 32px; font-weight: 800; color: #f8fafc; font-family: monospace;">--</div>
                        <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Seconds</div>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="btnCheckMaintStatus" style="padding: 10px 22px; background: #1e293b; border: 1px solid #334155; color: #e2e8f0; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">Recheck Status
                    </button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';

        document.getElementById('btnCheckMaintStatus')?.addEventListener('click', async () => {
            const btn = document.getElementById('btnCheckMaintStatus');
            if (btn) btn.innerText = 'Checking...';
            await fetchCloudConfig();
            if (!cloudConfig?.maintenanceMode) {
                removeMaintenanceModal();
            } else if (btn) {
                btn.innerText = 'Recheck Status';
            }
        });

        startMaintenanceCountdown();
    }

    function startMaintenanceCountdown() {
        if (maintenanceCountdownTimer) clearInterval(maintenanceCountdownTimer);

        const updateClock = () => {
            if (!cloudConfig?.maintenanceEndsAt) {
                const minEl = document.getElementById('maintTimerMinutes');
                const secEl = document.getElementById('maintTimerSeconds');
                if (minEl) minEl.innerText = '--';
                if (secEl) secEl.innerText = '--';
                return;
            }

            const endsAt = new Date(cloudConfig.maintenanceEndsAt).getTime();
            const now = Date.now();
            const diffMs = endsAt - now;

            if (diffMs <= 0) {
                const minEl = document.getElementById('maintTimerMinutes');
                const secEl = document.getElementById('maintTimerSeconds');
                if (minEl) minEl.innerText = '00';
                if (secEl) secEl.innerText = '00';

                // Periodically re-check config when time expires
                fetchCloudConfig().then(() => {
                    if (!cloudConfig?.maintenanceMode) {
                        removeMaintenanceModal();
                    }
                });
                return;
            }

            const totalSeconds = Math.floor(diffMs / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;

            const minEl = document.getElementById('maintTimerMinutes');
            const secEl = document.getElementById('maintTimerSeconds');
            if (minEl) minEl.innerText = String(minutes).padStart(2, '0');
            if (secEl) secEl.innerText = String(seconds).padStart(2, '0');
        };

        updateClock();
        maintenanceCountdownTimer = setInterval(updateClock, 1000);
    }

    function removeMaintenanceModal() {
        if (maintenanceCountdownTimer) {
            clearInterval(maintenanceCountdownTimer);
            maintenanceCountdownTimer = null;
        }
        const modal = document.getElementById('cloudMaintenanceModal');
        if (modal) modal.remove();
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
            const badgeLabel = isVip ? 'VIP Pro' : `${currentUser.name.split(' ')[0]} (${used}/${dailyLimit})`;

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
                        ${!isVip ? `
                        <a href="https://save-zonix.vercel.app/#pricing" target="_blank" style="display: block; width: 100%; padding: 6px; background: rgba(245,158,11,0.15); border: 1px solid #f59e0b; color: #fbbf24; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; text-align: center; text-decoration: none; margin-bottom: 6px; box-sizing: border-box;">Upgrade to VIP Pro
                        </a>
                        ` : ''}
                        <button id="btnCloudLogout" style="width: 100%; padding: 6px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #f87171; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600;">Sign Out
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
            // Stable Guest Mode Badge (Pre-rendered by Razor to prevent any flicker)
            const today = new Date().toISOString().split('T')[0];
            const guestUsed = parseInt(localStorage.getItem(`savezonix_guest_count_${today}`) || '0', 10);
            const guestLimit = cloudConfig?.guestDailyDownloadLimit || 5;
            const guestRemaining = Math.max(0, guestLimit - guestUsed);

            const guestText = document.getElementById('guestBadgeText');
            if (guestText) {
                guestText.textContent = `Guest (${guestRemaining} left)`;
            }

            const btnAuth = document.getElementById('btnOpenAuthModal');
            if (btnAuth && !btnAuth.dataset.bound) {
                btnAuth.dataset.bound = 'true';
                btnAuth.addEventListener('click', () => openAuthModal('login'));
            }
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
        // Check Maintenance Mode First!
        if (cloudConfig?.maintenanceMode === true) {
            showMaintenanceModal();
            return { allowed: false, reason: cloudConfig?.maintenanceMessage || 'Fleet engines are undergoing scheduled maintenance. Please check back shortly.' };
        }

        // Check Force Update first
        if (cloudConfig?.forceUpdate === true || compareVersions(CURRENT_VERSION, cloudConfig?.minAllowedVersion) < 0) {
            showForceUpdateModal();
            return { allowed: false, reason: 'Please update your application to continue.' };
        }

        const is4K = typeof selectedResolution === 'string' && (selectedResolution.includes('2160') || selectedResolution.includes('4K') || selectedResolution.includes('1440'));

        // Check 4K Lock for VIP
        if (is4K && cloudConfig?.lock4KForVip === true) {
            if (!currentUser || currentUser.isVip !== true) {
                openAuthModal('signIn');
                showAuthMessage(' 4K Ultra-HD is reserved for VIP members. Please sign in or select 1080p.', 'error');
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
                openAuthModal('limitReached', currentUser.dailyDownloads || freeLimit, freeLimit);
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
            openAuthModal('limitReached', 0, 0);
            return { allowed: false, reason: 'Guest mode disabled' };
        }

        const today = new Date().toISOString().split('T')[0];
        const key = `savezonix_guest_count_${today}`;
        const guestUsed = parseInt(localStorage.getItem(key) || '0', 10);
        const guestLimit = cloudConfig?.guestDailyDownloadLimit || 5;

        if (guestUsed >= guestLimit) {
            openAuthModal('limitReached', guestUsed, guestLimit);
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
        modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(3, 7, 18, 0.88); z-index: 99999; align-items: center; justify-content: center; backdrop-filter: blur(10px); padding: 20px; box-sizing: border-box;';
        modal.innerHTML = `
            <div style="max-width: 440px; width: 100%; background: #0a0f1d; border: 1px solid #1e293b; border-radius: 18px; padding: 30px 26px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.85); position: relative; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box;">
                <button id="btnCloudAuthClose" aria-label="Close" style="position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 14px; cursor: pointer; transition: all 0.2s ease;"></button>

                <!-- Status Message -->
                

                <!-- VIEW 0: GUEST LIMIT REACHED -->
                <div id="viewLimitReached" style="display: none; text-align: center;">
                    
                    <h2 style="color: #f8fafc; font-size: 21px; font-weight: 800; margin: 0 0 6px 0;">Guest Limit Reached</h2>
                    <p style="color: #94a3b8; font-size: 13.5px; line-height: 1.5; margin: 0 0 18px 0;">You have completed your free guest downloads today.<br>Sign in with your account or register to unlock more downloads!
                    </p>

                    <div style="background: #030712; border: 1px solid #1e293b; border-radius: 12px; padding: 14px; margin-bottom: 20px; display: flex; justify-content: space-around; align-items: center;">
                        <div>
                            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">Today's Guest Usage</div>
                            <div id="lblLimitCount" style="font-size: 18px; font-weight: 800; color: #f59e0b; margin-top: 3px;">5 / 5 Used</div>
                        </div>
                        
                        <div>
                            <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">With Free Account</div>
                            <div style="font-size: 18px; font-weight: 800; color: #38bdf8; margin-top: 3px;">Unlimited / 10+</div>
                        </div>
                    </div>

                    <!-- Direct Links to Dedicated Pages -->
                    <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
                        <a href="/Account/Register" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; box-sizing: border-box; padding: 12px 18px; background: linear-gradient(135deg, #0284c7, #0ea5e9); color: #fff; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none; box-shadow: 0 4px 14px rgba(2,132,199,0.35);">
                            <span>Create Free Account (Full Page)</span>
                        </a>
                        <a href="/Account/Login" style="display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; box-sizing: border-box; padding: 12px 18px; background: #161f30; color: #e2e8f0; border: 1px solid #334155; border-radius: 10px; font-weight: 700; font-size: 14px; text-decoration: none;">
                            <span>Sign In with ID / Password</span>
                        </a>
                    </div>

                    <div style="padding-top: 14px; border-top: 1px solid #1e293b; font-size: 12.5px; color: #64748b;">Quick In-App Access:
                        <a href="#" id="linkQuickSignIn" style="color: #38bdf8; font-weight: 700; text-decoration: none; margin-left: 5px;">Sign In Here</a>
                        <span style="margin: 0 5px;">•</span>
                        <a href="#" id="linkQuickRegister" style="color: #38bdf8; font-weight: 700; text-decoration: none;">Register Here</a>
                    </div>
                </div>

                <!-- VIEW 1: SIGN IN -->
                <div id="viewSignIn" style="display: none;">
                    <h2 style="color: #f8fafc; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">Sign In to SaveZonix</h2>
                    <p style="color: #94a3b8; font-size: 13px; margin: 0 0 16px 0;">Access your profile, sync downloads, and enjoy VIP speeds.
                    </p>
                    
                    <form id="formSignIn" style="display: flex; flex-direction: column; gap: 14px;">
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Email Address</label>
                            <input type="email" id="inputSignInEmail" style="box-sizing: border-box; width: 100%; display: block; padding: 11px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13.5px;" placeholder="rahul.sharma@gmail.com" required />
                        </div>
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <label style="font-size: 12px; font-weight: 700; color: #cbd5e1;">Password</label>
                                <a href="#" id="linkForgotPassword" style="font-size: 11.5px; color: #38bdf8; text-decoration: none;">Forgot password?</a>
                            </div>
                            <input type="password" id="inputSignInPassword" style="box-sizing: border-box; width: 100%; display: block; padding: 11px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13.5px;" placeholder="••••••••" required />
                        </div>
                        <button type="submit" id="btnSubmitSignIn" style="box-sizing: border-box; width: 100%; margin-top: 6px; padding: 12px; background: linear-gradient(135deg, #0284c7, #0ea5e9); color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;">Sign In</button>
                    </form>

                    <div style="text-align: center; margin-top: 18px; font-size: 12.5px; color: #94a3b8;">Don't have an account? <a href="#" id="linkGoToRegister" style="color: #38bdf8; font-weight: 700; text-decoration: none;">Create Free Account</a>
                        <div style="margin-top: 8px;">
                            <a href="/Account/Login" style="color: #64748b; font-size: 11.5px; text-decoration: none;">Prefer full screen sign-in page? Click here →</a>
                        </div>
                    </div>
                </div>

                <!-- VIEW 2: REGISTER -->
                <div id="viewRegister" style="display: none;">
                    <h2 style="color: #f8fafc; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">Create Free Account</h2>
                    <p style="color: #94a3b8; font-size: 13px; margin: 0 0 16px 0;">Sign up with your details to get started.
                    </p>

                    <form id="formRegister" style="display: flex; flex-direction: column; gap: 14px;">
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Full Name</label>
                            <input type="text" id="inputRegisterName" style="box-sizing: border-box; width: 100%; display: block; padding: 11px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13.5px;" placeholder="Rahul Sharma" required />
                        </div>
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Email Address</label>
                            <input type="email" id="inputRegisterEmail" style="box-sizing: border-box; width: 100%; display: block; padding: 11px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13.5px;" placeholder="rahul.sharma@gmail.com" required />
                        </div>
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Choose Password</label>
                            <input type="password" id="inputRegisterPassword" minlength="6" style="box-sizing: border-box; width: 100%; display: block; padding: 11px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13.5px;" placeholder="At least 6 characters" required />
                        </div>
                        <button type="submit" id="btnSubmitRegister" style="box-sizing: border-box; width: 100%; margin-top: 6px; padding: 12px; background: linear-gradient(135deg, #0284c7, #0ea5e9); color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;">Create Free Account</button>
                    </form>

                    <div style="text-align: center; margin-top: 18px; font-size: 12.5px; color: #94a3b8;">Already registered? <a href="#" id="linkGoToSignIn" style="color: #38bdf8; font-weight: 700; text-decoration: none;">Sign In</a>
                        <div style="margin-top: 8px;">
                            <a href="/Account/Register" style="color: #64748b; font-size: 11.5px; text-decoration: none;">Prefer full screen register page? Click here →</a>
                        </div>
                    </div>
                </div>

                <!-- VIEW 3: OTP VERIFICATION -->
                <div id="viewOtp" style="display: none; text-align: center;">
                    
                    <h2 style="color: #f8fafc; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">Enter 6-Digit Code</h2>
                    <p id="txtOtpNotice" style="color: #94a3b8; font-size: 13px; margin: 0 0 20px 0;">We sent a verification code to your email.</p>

                    <form id="formOtp" style="display: flex; flex-direction: column; gap: 18px;">
                        <input type="text" id="inputOtpCode" maxlength="6" pattern="[0-9]{6}" style="box-sizing: border-box; width: 220px; margin: 0 auto; text-align: center; font-size: 28px; font-weight: 900; letter-spacing: 8px; padding: 12px; background: #030712; border: 2px solid #38bdf8; border-radius: 12px; color: #38bdf8; font-family: monospace;" placeholder="------" required />
                        
                        <button type="submit" id="btnSubmitOtp" style="box-sizing: border-box; width: 100%; padding: 12px; background: #10b981; color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;">Verify &amp; Activate Account</button>
                    </form>

                    <div style="margin-top: 16px;">
                        <button type="button" id="btnBackFromOtp" style="background: transparent; border: none; color: #64748b; font-size: 12.5px; cursor: pointer;">← Change Email / Back</button>
                    </div>
                </div>

                <!-- VIEW 4: FORGOT PASSWORD -->
                <div id="viewForgotPassword" style="display: none;">
                    <h2 style="color: #f8fafc; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">Reset Password</h2>
                    <p style="color: #94a3b8; font-size: 13px; margin: 0 0 20px 0;">Enter your registered email to receive a reset code.</p>

                    <form id="formForgotStep1" style="display: flex; flex-direction: column; gap: 14px;">
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Registered Email</label>
                            <input type="email" id="inputForgotEmail" style="box-sizing: border-box; width: 100%; display: block; padding: 11px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13.5px;" placeholder="rahul.sharma@gmail.com" required />
                        </div>
                        <button type="submit" id="btnSendResetOtp" style="box-sizing: border-box; width: 100%; padding: 12px; background: linear-gradient(135deg, #0284c7, #0ea5e9); color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;">Send Reset Code </button>
                    </form>

                    <form id="formForgotStep2" style="display: none; flex-direction: column; gap: 14px; margin-top: 14px;">
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">6-Digit OTP Code</label>
                            <input type="text" id="inputForgotOtp" maxlength="6" style="box-sizing: border-box; width: 100%; display: block; padding: 11px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #38bdf8; font-weight: 700; font-size: 16px; text-align: center; letter-spacing: 4px;" placeholder="123456" required />
                        </div>
                        <div>
                            <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">New Password</label>
                            <input type="password" id="inputForgotNewPassword" minlength="6" style="box-sizing: border-box; width: 100%; display: block; padding: 11px 14px; background: #030712; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 13.5px;" placeholder="At least 6 characters" required />
                        </div>
                        <button type="submit" id="btnSubmitResetPassword" style="box-sizing: border-box; width: 100%; padding: 12px; background: #10b981; color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer;">Save New Password &amp; Sign In</button>
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
        document.getElementById('linkQuickSignIn')?.addEventListener('click', (e) => { e.preventDefault(); switchAuthView('signIn'); });
        document.getElementById('linkQuickRegister')?.addEventListener('click', (e) => { e.preventDefault(); switchAuthView('register'); });
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
                btn.textContent = 'Sign In';
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
                btn.textContent = 'Send Verification Code';
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
                alert('Welcome to SaveZonix! Your account has been verified.');
            } catch (err) {
                showAuthMessage(err.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Verify & Activate Account';
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
                btn.textContent = 'Send Reset Code';
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
                showAuthMessage('Password updated successfully! You are now logged in.', 'success');
                setTimeout(closeAuthModal, 1200);
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
            limitReached: document.getElementById('viewLimitReached'),
            signIn: document.getElementById('viewSignIn'),
            register: document.getElementById('viewRegister'),
            otp: document.getElementById('viewOtp'),
            forgot: document.getElementById('viewForgotPassword')
        };
        Object.keys(views).forEach(k => {
            if (views[k]) views[k].style.display = (k === viewName) ? 'block' : 'none';
        });
        if (viewName === 'forgot') {
            const s1 = document.getElementById('formForgotStep1');
            const s2 = document.getElementById('formForgotStep2');
            if (s1) s1.style.display = 'flex';
            if (s2) s2.style.display = 'none';
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

    function openAuthModal(initialView = 'signIn', guestCount = 5, maxCount = 5) {
        injectAuthModalHTML();
        if (initialView === 'limitReached') {
            const countEl = document.getElementById('lblLimitCount');
            const summaryEl = document.getElementById('lblLimitSummary');
            if (countEl) countEl.textContent = `${guestCount} / ${maxCount} Used`;
            if (summaryEl) summaryEl.textContent = `${maxCount} guest downloads`;
        }
        switchAuthView(initialView);
        const modal = document.getElementById('cloudAuthModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeAuthModal() {
        const modal = document.getElementById('cloudAuthModal');
        if (modal) modal.style.display = 'none';
    }

    window.openCloudAuth = openAuthModal;
    window.getCloudConfig = () => cloudConfig;
    window.getFleetEngineSettings = () => ({
        freeMaxSpeedMBps: cloudConfig?.freeMaxSpeedMBps ?? 15,
        vipMaxSpeedMBps: cloudConfig?.vipMaxSpeedMBps ?? 0,
        platformThreadCaps: cloudConfig?.platformThreadCaps || { youtube: 64, instagram: 24, tiktok: 24, directCdn: 128 },
        isVip: !!(currentUser && currentUser.isVip)
    });
})();
