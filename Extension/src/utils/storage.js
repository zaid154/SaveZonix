// src/utils/storage.js — Robust Chrome Storage Manager with State Persistence & History Sanitizer (Universal)

(function (root) {
    const Storage = {
        async get(key) {
            try {
                const data = await chrome.storage.local.get(key);
                return data[key];
            } catch {
                return null;
            }
        },

        async set(key, value) {
            try {
                await chrome.storage.local.set({ [key]: value });
                return true;
            } catch {
                return false;
            }
        },

        async remove(key) {
            try {
                await chrome.storage.local.remove(key);
                return true;
            } catch {
                return false;
            }
        },

        async getTabVideos(tabId) {
            const key = `tab_media_${tabId}`;
            const activeDlKey = `active_dl_${tabId}`;
            try {
                const data = await chrome.storage.local.get([key, 'completed_downloads', 'user_settings', activeDlKey]);
                // Clean legacy generic "Video.mp4" entries if present
                let completed = (data.completed_downloads || []).filter(i => i && i.filename && i.filename !== 'Video.mp4');
                return {
                    videos: data[key] || [],
                    completed: completed,
                    settings: data.user_settings || { defaultQuality: 'best', rememberQuality: true, autoDetectEpisode: true },
                    activeDownload: data[activeDlKey] || null
                };
            } catch {
                return { videos: [], completed: [], settings: {}, activeDownload: null };
            }
        },

        async saveCompletedDownload(item) {
            if (!item || !item.filename || item.filename === 'Video.mp4') return false;
            try {
                const data = await chrome.storage.local.get('completed_downloads');
                let list = (data.completed_downloads || []).filter(i => i && i.filename && i.filename !== 'Video.mp4');
                
                // Deduplicate by filename or title
                list = list.filter(i => i.filename !== item.filename && i.title !== item.title);
                
                const record = {
                    id: item.id || ('dl_' + Date.now()),
                    filename: item.filename,
                    title: item.title || item.filename,
                    site: item.site || item.platform || 'Stream',
                    quality: item.quality || 'Original Quality',
                    size: item.size || 'Media File',
                    sizeBytes: item.sizeBytes || 0,
                    timestamp: item.timestamp || Date.now(),
                    status: 'Completed',
                    downloadId: item.downloadId || null
                };

                list.unshift(record);
                await chrome.storage.local.set({ completed_downloads: list.slice(0, 30) });
                return true;
            } catch {
                return false;
            }
        },

        async removeCompletedDownload(id) {
            try {
                const data = await chrome.storage.local.get('completed_downloads');
                const list = (data.completed_downloads || []).filter(i => i.id !== id);
                await chrome.storage.local.set({ completed_downloads: list });
                return true;
            } catch {
                return false;
            }
        },

        async setActiveDownload(tabId, state) {
            if (!tabId || tabId <= 0) return;
            const key = `active_dl_${tabId}`;
            try {
                if (state) {
                    await chrome.storage.local.set({ [key]: state });
                } else {
                    await chrome.storage.local.remove(key);
                }
            } catch { }
        }
    };

    root.Storage = Storage;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
