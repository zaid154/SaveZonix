// client/src/utils/trialManager.js — Client-Side 3-Free-Trial Counter & Gatekeeper Service

const TRIAL_STORAGE_KEY = 'savezonix_trial_downloads_used';
export const MAX_FREE_TRIALS = 10;

export function isUserVip(user) {
  if (!user) {
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('savezonix_user') || localStorage.getItem('savezonix_cloud_user') || '{}');
        if (stored.email && stored.email.toLowerCase() === 'zaidm1323@gmail.com') return true;
        if (stored.isVip || stored.isAdmin || stored.role === 'Admin') return true;
      } catch {}
    }
    return false;
  }
  return Boolean(
    user.isVip ||
    user.role === 'Admin' ||
    user.Role === 'Admin' ||
    user.isAdmin ||
    (user.email && user.email.toLowerCase() === 'zaidm1323@gmail.com')
  );
}

export function getTrialDownloadsUsed() {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(TRIAL_STORAGE_KEY);
  const val = parseInt(raw || '0', 10);
  return isNaN(val) ? 0 : Math.max(0, val);
}

export function getRemainingTrials(user) {
  if (isUserVip(user)) return Infinity;
  const used = getTrialDownloadsUsed();
  return Math.max(0, MAX_FREE_TRIALS - used);
}

export function hasFreeTrialsRemaining(user) {
  if (isUserVip(user)) return true;
  return getTrialDownloadsUsed() < MAX_FREE_TRIALS;
}

export function recordTrialDownloadConsumed(user) {
  if (isUserVip(user)) return true;
  const current = getTrialDownloadsUsed();
  const updated = current + 1;
  localStorage.setItem(TRIAL_STORAGE_KEY, String(updated));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('savezonix:trial_updated', { detail: { used: updated, remaining: Math.max(0, MAX_FREE_TRIALS - updated) } }));
  }
  return updated <= MAX_FREE_TRIALS;
}
