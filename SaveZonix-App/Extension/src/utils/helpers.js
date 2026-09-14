// src/utils/helpers.js â Common Formatting, Sanitization & Math Utilities (Classic & Module compatible)

(function (root) {
    function formatBytes(bytes) {
        if (!bytes || bytes === 0 || isNaN(bytes)) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function formatDuration(seconds) {
        if (!seconds || isNaN(seconds) || seconds === Infinity || seconds <= 0) return '';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function formatEta(seconds, completedCount) {
        if (completedCount !== undefined && completedCount < 2) return 'Calculating...';
        if (!seconds || seconds <= 0 || seconds === Infinity || isNaN(seconds)) return 'Calculating...';
        const total = Math.round(seconds);
        const hours = Math.floor(total / 3600);
        const mins = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        if (hours > 0) return `~${hours}h ${mins}m remaining`;
        if (mins > 0) return `~${mins}m ${secs}s remaining`;
        return `~${secs}s remaining`;
    }

    function sanitizeText(str) {
        return (str || '').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function sanitizeFileName(name, fallback) {
        const clean = (name || fallback || 'Video')
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 90);
        return clean || fallback || 'Video';
    }

    const Helpers = {
        formatBytes: formatBytes,
        formatDuration: formatDuration,
        formatEta: formatEta,
        sanitizeText: sanitizeText,
        sanitizeFileName: sanitizeFileName
    };

    root.Helpers = Helpers;
    root.formatBytes = formatBytes;
    root.formatDuration = formatDuration;
    root.formatEta = formatEta;
    root.sanitizeText = sanitizeText;
    root.sanitizeFileName = sanitizeFileName;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
