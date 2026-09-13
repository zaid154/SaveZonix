// SaveZonix-Web Dynamic Client Engine
document.addEventListener('DOMContentLoaded', async () => {
    const navVersionBadge = document.getElementById('navVersionBadge');
    const btnPrimaryDownload = document.getElementById('btnPrimaryDownload');
    const proPlanPriceDisplay = document.getElementById('proPlanPriceDisplay');

    // Default Fallbacks
    const DEFAULT_CONFIG = {
        latestAppVersion: "2.1.0",
        appDownloadUrl: "https://github.com/zaid154/SaveZonix/releases/latest/download/SaveZonix-Setup.exe",
        vipMonthlyPriceINR: 99
    };

    try {
        // Try fetching remote config from the Render API or current origin
        const apiHost = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
        const res = await fetch(`${apiHost}/api/app-config`, { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            if (data.latestAppVersion && navVersionBadge) {
                navVersionBadge.textContent = `v${data.latestAppVersion}`;
            }
            if (data.appDownloadUrl && btnPrimaryDownload) {
                btnPrimaryDownload.href = data.appDownloadUrl;
            }
            if (data.vipMonthlyPriceINR && proPlanPriceDisplay) {
                proPlanPriceDisplay.innerHTML = `₹${data.vipMonthlyPriceINR} <span>/ month</span>`;
            }
        }
    } catch {
        // Fallback already set in static HTML
        if (navVersionBadge) navVersionBadge.textContent = `v${DEFAULT_CONFIG.latestAppVersion}`;
        if (btnPrimaryDownload) btnPrimaryDownload.href = DEFAULT_CONFIG.appDownloadUrl;
        if (proPlanPriceDisplay) proPlanPriceDisplay.innerHTML = `₹${DEFAULT_CONFIG.vipMonthlyPriceINR} <span>/ month</span>`;
    }
});
