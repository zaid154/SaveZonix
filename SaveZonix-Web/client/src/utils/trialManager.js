// client/src/utils/trialManager.js — Client-Side Dynamic Free-Trial Counter & Gatekeeper Service

const TRIAL_STORAGE_KEY = 'savezonix_trial_downloads_used';
const TRIAL_MAX_KEY = 'savezonix_max_free_trials';

export const DEFAULT_MAX_FREE_TRIALS = 3;

function getStoredMaxTrials() {
  if (typeof window === 'undefined') return DEFAULT_MAX_FREE_TRIALS;
  try {
    const stored = localStorage.getItem(TRIAL_MAX_KEY);
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  } catch {}
  return DEFAULT_MAX_FREE_TRIALS;
}

let dynamicMax = getStoredMaxTrials();

export function setMaxFreeTrials(limit) {
  const num = parseInt(limit, 10);
  if (!isNaN(num) && num > 0) {
    dynamicMax = num;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(TRIAL_MAX_KEY, String(num));
      } catch {}
      window.dispatchEvent(new CustomEvent('savezonix:trial_updated', {
        detail: { used: getTrialDownloadsUsed(), remaining: getRemainingTrials(), max: num }
      }));
    }
  }
}

export function getMaxFreeTrials() {
  return dynamicMax || getStoredMaxTrials();
}

export const MAX_FREE_TRIALS = DEFAULT_MAX_FREE_TRIALS;

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

export function getRemainingTrials(user, customMax) {
  if (isUserVip(user)) return Infinity;
  const max = customMax || getMaxFreeTrials();
  const used = getTrialDownloadsUsed();
  return Math.max(0, max - used);
}

export function hasFreeTrialsRemaining(user, customMax) {
  if (isUserVip(user)) return true;
  const max = customMax || getMaxFreeTrials();
  return getTrialDownloadsUsed() < max;
}

export function recordTrialDownloadConsumed(user, customMax) {
  if (isUserVip(user)) return true;
  const max = customMax || getMaxFreeTrials();
  const current = getTrialDownloadsUsed();
  const updated = current + 1;
  localStorage.setItem(TRIAL_STORAGE_KEY, String(updated));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('savezonix:trial_updated', {
      detail: { used: updated, remaining: Math.max(0, max - updated), max }
    }));
  }
  return updated <= max;
}
