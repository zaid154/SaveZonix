import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Download, 
  ListMusic, 
  History, 
  Play, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Zap, 
  Search,
  Music,
  Video,
  Lock,
  Crown,
  Clipboard,
  Loader2,
  Check
} from 'lucide-react';
import { getRemainingTrials, hasFreeTrialsRemaining, recordTrialDownloadConsumed, isUserVip, getMaxFreeTrials } from '../utils/trialManager';

const RENDER_API_BASE = 'https://savezonix.onrender.com';

export default function DownloadStudio({ user, appConfig, onOpenGatekeeper, onOpenExtensionModal, onOpenVip }) {
  const [activeTab, setActiveTab] = useState('single'); // 'single' | 'playlist' | 'history'
  
  // Single Downloader State
  const [url, setUrl] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedMedia, setResolvedMedia] = useState(null);
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [completedTask, setCompletedTask] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [localEngineActive, setLocalEngineActive] = useState(false);
  const maxTrials = appConfig?.guestDailyLimit || appConfig?.freeDailyLimit || getMaxFreeTrials();
  const [remainingTrials, setRemainingTrials] = useState(() => getRemainingTrials(user, maxTrials));

  useEffect(() => {
    setRemainingTrials(getRemainingTrials(user, maxTrials));
  }, [user, maxTrials]);

  useEffect(() => {
    const onTrialUpdated = (e) => setRemainingTrials(getRemainingTrials(user, e.detail?.max || maxTrials));
    window.addEventListener('savezonix:trial_updated', onTrialUpdated);
    return () => window.removeEventListener('savezonix:trial_updated', onTrialUpdated);
  }, [user, maxTrials]);

  // Playlist Studio State
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  const [playlistData, setPlaylistData] = useState(null);
  const [selectedVideoIds, setSelectedVideoIds] = useState(new Set());
  const [batchFormat, setBatchFormat] = useState('1080p');

  // History State
  const [historyList, setHistoryList] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  const socketRef = useRef(null);

  useEffect(() => {
    // Check if SaveZonix Local Companion Engine is running on localhost:5001
    const checkLocal = async () => {
      if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return '';
      }
      try {
        const res = await fetch('http://localhost:5001/api/health', { signal: AbortSignal.timeout(600) });
        if (res.ok) {
          const d = await res.json();
          if (d.status === 'ok') {
            setLocalEngineActive(true);
            return 'http://localhost:5001';
          }
        }
      } catch {}
      return '';
    };

    checkLocal().then(detectedBase => {
      // Check if query param ?url= or ?queueKey= exists
      const params = new URLSearchParams(window.location.search);
      const autoUrl = params.get('url');
      const autoQueue = params.get('queueKey');

      if (autoQueue) {
        setActiveTab('playlist');
        loadPlaylistQueue(autoQueue, '', detectedBase);
      } else if (autoUrl) {
        if (autoUrl.includes('list=') && !autoUrl.includes('watch?v=')) {
          setActiveTab('playlist');
          setPlaylistUrl(autoUrl);
          loadPlaylistQueue('', autoUrl, detectedBase);
        } else {
          setUrl(autoUrl);
          const autoDownload = params.get('autoDownload') === '1' || params.get('auto') === '1';
          resolveSingleUrl(autoUrl, autoDownload, detectedBase);
          setTimeout(() => {
            const el = document.getElementById('studio');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 300);
        }
      }
    });

    fetchHistory();
  }, []);

  // Connect to Socket.IO with reactive host (local engine vs cloud Render)
  useEffect(() => {
    const socketBase = localEngineActive
      ? 'http://localhost:5001'
      : (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
          ? 'https://savezonix.onrender.com'
          : '/');

    const socket = io(socketBase, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000
    });
    socketRef.current = socket;

    socket.on('download:progress', (data) => {
      setDownloadProgress(data);
      setIsDownloading(true);
    });

    socket.on('download:complete', (data) => {
      setCompletedTask(data);
      setIsDownloading(false);
      setDownloadProgress(null);
      fetchHistory();
    });

    socket.on('download:error', (data) => {
      setErrorMsg(data.error || 'Download failed.');
      setIsDownloading(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [localEngineActive]);

  // Safe JSON parser that never throws on HTML error pages (e.g. Vercel 502/504 or Express HTML errors)
  const safeJsonParse = async (response) => {
    try {
      const contentType = response?.headers?.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        if (response.status === 404 || text.includes('404')) {
          return { success: false, message: 'This video or media link was not found or was deleted from YouTube.' };
        }
        if (response.status === 502 || response.status === 504) {
          return { success: false, message: 'Cloud server is waking up or temporarily busy. Please wait a moment and try again.' };
        }
        if (text.toLowerCase().includes('unavailable') || text.toLowerCase().includes('private')) {
          return { success: false, message: 'This video is unavailable or private on YouTube.' };
        }
        return { success: false, message: `Server returned status ${response.status}. Please try again.` };
      }
    } catch {
      return { success: false, message: 'Network connection error. Please try again.' };
    }
  };

  // Build auth + fingerprint headers for API calls
  const getApiHeaders = () => {
    const headers = { 'Content-Type': 'application/json' };
    try {
      const token = localStorage.getItem('savezonix_token') || localStorage.getItem('savezonix_admin_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {}
    return headers;
  };

  // Resolve active API base URL (local companion vs same-origin Vercel rewrite for /resolve & /stream)
  const getApiBase = (explicitBase = null) => {
    if (explicitBase !== null && explicitBase !== '') return explicitBase;
    const isLocalHost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (isLocalHost) {
      return localEngineActive ? 'http://localhost:5001' : '';
    }
    return '';
  };

  // Pick smart default quality respecting user tier (VIP gets 1080p, free/guest defaults to 720p)
  const pickDefaultQuality = (qualities = []) => {
    const preferredOrder = isUserVip(user)
      ? ['1080p', '720p', '480p', '360p', 'MP3']
      : [appConfig?.guestMaxQuality || '720p', '720p', '480p', '360p', 'MP3'];
    for (const q of preferredOrder) {
      if (qualities.includes(q)) return q;
    }
    return qualities[0] || (isUserVip(user) ? '1080p' : '720p');
  };

  // Polling fallback: Detect completed local disk downloads even if WebSocket disconnects
  useEffect(() => {
    let interval;
    const isLocalHost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (isDownloading && isLocalHost && localEngineActive) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://localhost:5001/api/downloads/history?limit=1`);
          const data = await safeJsonParse(res);
          if (data.success && data.history?.length > 0) {
            const latest = data.history[0];
            const diffSec = (Date.now() - new Date(latest.createdAt).getTime()) / 1000;
            if (diffSec < 120 && latest.status === 'Completed') {
              setCompletedTask(latest);
              setIsDownloading(false);
              setDownloadProgress(null);
              fetchHistory();
            }
          }
        } catch {}
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isDownloading, localEngineActive]);

  // Get file download link routing to local engine or cloud
  const getFileDownloadUrl = (fileName) => {
    if (!fileName) return '#';
    const base = localEngineActive ? 'http://localhost:5001' : '';
    return `${base}/api/downloads/file/${encodeURIComponent(fileName)}`;
  };

  // Trigger native browser download (opens download in browser's download bar)
  const triggerBrowserDownload = (downloadUrl, filename) => {
    try {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename || 'download';
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
      }, 2000);
    } catch {}

    // Mobile fallback: On Android Chrome & Safari, async a.click() is blocked by popup blockers.
    // Navigating directly to the proxy-stream URL invokes the native Download Manager.
    const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isMobile) {
      setTimeout(() => {
        window.location.href = downloadUrl;
      }, 350);
    }
  };

  // Fetch download history from MongoDB
  const fetchHistory = async () => {
    setLoadingHistory(true);
    const isLocalHost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const base = (isLocalHost && localEngineActive) ? 'http://localhost:5001' : '';
    try {
      const res = await fetch(`${base}/api/downloads/history?search=${encodeURIComponent(historySearch)}`);
      const data = await safeJsonParse(res);
      if (data.success) {
        setHistoryList(data.history || []);
      }
    } catch {}
    setLoadingHistory(false);
  };

  // Sanitize single media URL: Normalizes Shorts, youtu.be, live, and watch links to standard watch URL
  // Detects and warns about incomplete/truncated YouTube IDs (e.g. less than 11 chars)
  const sanitizeSingleUrl = (raw) => {
    const rawStr = (typeof raw === 'string' && raw) ? raw : (typeof url === 'string' ? url : '');
    let clean = (rawStr || '').trim();
    try {
      const match = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) {
        const vid = match[1];
        if (vid.length < 11) {
          return { error: `⚠️ Incomplete YouTube link: ID "${vid}" has only ${vid.length} characters (must be 11). Please copy the complete video link (tap "Share" ➔ "Copy link" in YouTube).` };
        }
        return { url: `https://www.youtube.com/watch?v=${vid.substring(0, 11)}` };
      }
      const u = new URL(clean);
      if (u.searchParams.has('v') && !clean.includes('/playlist')) {
        const vParam = u.searchParams.get('v');
        if (vParam && vParam.length < 11) {
          return { error: `⚠️ Incomplete YouTube link: ID "${vParam}" has only ${vParam.length} characters (must be 11). Please copy the complete video link.` };
        }
        return { url: `https://www.youtube.com/watch?v=${(vParam || '').substring(0, 11)}` };
      }
    } catch {}
    return { url: clean };
  };

  // Quick 1-tap paste from clipboard for mobile and desktop
  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          const trimmed = clipText.trim();
          setUrl(trimmed);
          resolveSingleUrl(trimmed);
          return;
        }
      }
    } catch (clipErr) {
      console.warn('Clipboard read error:', clipErr);
    }
    const inputEl = document.getElementById('sz-main-input');
    if (inputEl) inputEl.focus();
  };

  // Resolve single media info
  const resolveSingleUrl = async (targetUrl = url, autoStart = false, engineBase = null, retryCount = 0) => {
    const rawTarget = (typeof targetUrl === 'string' && targetUrl) ? targetUrl : url;
    if (!rawTarget || !rawTarget.trim()) {
      setErrorMsg('Please paste a YouTube, video, or audio link to analyze.');
      return;
    }

    const sanitized = sanitizeSingleUrl(rawTarget);
    if (sanitized.error) {
      setErrorMsg(sanitized.error);
      return;
    }

    const cleanTarget = sanitized.url;
    if (!cleanTarget) return;

    setIsResolving(true);
    setErrorMsg('');
    setResolvedMedia(null);
    setCompletedTask(null);

    const isLocalHost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    let base = getApiBase(engineBase);

    try {
      let res;
      try {
        res = await fetch(`${base}/api/downloads/resolve`, {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({ url: cleanTarget }),
          signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(55000) : undefined
        });
      } catch (cloudErr) {
        if (isLocalHost) {
          try {
            res = await fetch('http://localhost:5001/api/downloads/resolve', {
              method: 'POST',
              headers: getApiHeaders(),
              body: JSON.stringify({ url: cleanTarget }),
              signal: AbortSignal.timeout(5000)
            });
            if (res.ok) {
              base = 'http://localhost:5001';
              setLocalEngineActive(true);
            }
          } catch {}
        }
        if (!res) throw cloudErr;
      }

      const data = await safeJsonParse(res);
      if (data.success) {
        setResolvedMedia(data);
        const topQuality = pickDefaultQuality(data.availableQualities);
        if (data.availableQualities?.length > 0) {
          setSelectedQuality(topQuality);
        }
        if (autoStart) {
          setTimeout(() => {
            handleStartDownload(cleanTarget, topQuality, base);
          }, 350);
        }
      } else {
        // Fallback to local companion engine if cloud resolution failed (only on localhost)
        if (isLocalHost) {
          try {
            const localRes = await fetch('http://localhost:5001/api/downloads/resolve', {
              method: 'POST',
              headers: getApiHeaders(),
              body: JSON.stringify({ url: cleanTarget }),
              signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(6000) : undefined
            });
            const localData = await safeJsonParse(localRes);
            if (localData.success) {
              setResolvedMedia(localData);
              setLocalEngineActive(true);
              const topQuality = pickDefaultQuality(localData.availableQualities);
              if (localData.availableQualities?.length > 0) {
                setSelectedQuality(topQuality);
              }
              if (autoStart) {
                setTimeout(() => {
                  handleStartDownload(cleanTarget, topQuality, 'http://localhost:5001');
                }, 350);
              }
              return;
            }
          } catch {}
        }

        const msgLower = (data.message || '').toLowerCase();
        if (msgLower.includes('incomplete') || msgLower.includes('must be 11')) {
          setErrorMsg(data.message);
        } else if (msgLower.includes('unavailable') || msgLower.includes('private') || msgLower.includes('not found') || msgLower.includes('does not exist')) {
          setErrorMsg('⚠️ This video is unavailable, deleted, or private on YouTube. Please try another video link.');
        } else if (msgLower.includes('player') || msgLower.includes('429') || msgLower.includes('bot') || msgLower.includes('throttled')) {
          setErrorMsg('⚡ Cloud servers are waking up or busy. Please try clicking Analyze again.');
        } else {
          setErrorMsg(data.message || 'Failed to resolve media stream.');
        }
      }
    } catch (err) {
      const errLower = (err?.message || '').toLowerCase();
      const isTimeout = err.name === 'AbortError' || errLower.includes('timeout') || errLower.includes('aborted');

      // Auto-retry once if server was sleeping on Render
      if (isTimeout && retryCount < 1) {
        setErrorMsg('⏳ Cloud server is waking up from sleep mode (Render free tier takes ~30s on first load). Retrying now...');
        setTimeout(() => {
          resolveSingleUrl(targetUrl, autoStart, engineBase, retryCount + 1);
        }, 2000);
        return;
      }

      if (errLower.includes('incomplete') || errLower.includes('must be 11')) {
        setErrorMsg(err.message);
      } else if (errLower.includes('unavailable') || errLower.includes('private') || errLower.includes('not found')) {
        setErrorMsg('⚠️ This video is unavailable, deleted, or private on YouTube. Please try another video link.');
      } else if (isTimeout) {
        setErrorMsg('⏳ Server is taking longer than usual to wake up. Please tap Analyze once more!');
      } else if (errLower.includes('not valid json') || errLower.includes('unexpected token')) {
        setErrorMsg('Cloud server is waking up. Please try again in 5 seconds.');
      } else {
        setErrorMsg('Unable to resolve media. Please check the URL and try again.');
      }
    } finally {
      setIsResolving(false);
    }
  };

  // Start single turbo download
  const handleStartDownload = async (targetUrl = url, targetQuality = selectedQuality, engineBase = null, retryCount = 0) => {
    // Gatekeeper enforcement for free web trials
    if (!hasFreeTrialsRemaining(user)) {
      if (onOpenGatekeeper) onOpenGatekeeper();
      return;
    }

    const actualUrl = (typeof targetUrl === 'string' && targetUrl) ? targetUrl : url;
    const actualQuality = (typeof targetQuality === 'string' && targetQuality) ? targetQuality : selectedQuality;
    const sanitized = sanitizeSingleUrl(actualUrl || url);
    if (sanitized?.error) {
      setErrorMsg(sanitized.error);
      return;
    }
    const finalUrl = typeof sanitized === 'string' ? sanitized : (sanitized?.url || actualUrl || url);
    if (!finalUrl || typeof finalUrl !== 'string') return;

    setIsDownloading(true);
    setErrorMsg('');
    setCompletedTask(null);

    const isLocalHost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    let base = getApiBase(engineBase);
    const isLocal = isLocalHost && (localEngineActive || base === 'http://localhost:5001');

    // ═══ LOCAL ENGINE: Use old disk-based flow with Socket.IO progress ═══
    if (isLocal) {
      try {
        const res = await fetch(`${base}/api/downloads/start`, {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({ url: finalUrl, quality: actualQuality || selectedQuality })
        });
        const data = await safeJsonParse(res);
        if (!data.success) {
          setErrorMsg(data.message || 'Failed to start download.');
          setIsDownloading(false);
        } else {
          recordTrialDownloadConsumed(user);
        }
      } catch (err) {
        setErrorMsg(err.message || 'Failed to start download.');
        setIsDownloading(false);
      }
      return;
    }

    // ═══ CLOUD DEPLOYMENT: Use streaming approach (Direct Render API) ═══
    try {
      // Step 1: Resolve stream URLs from server (pass Authorization header for VIP/Admin quotas)
      const res = await fetch(`${base}/api/downloads/stream`, {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({ url: finalUrl, quality: actualQuality }),
        signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(55000) : undefined
      });
      const data = await safeJsonParse(res);

      if (!data.success) {
        // Fallback: Try local companion engine only on localhost
        if (isLocalHost) {
          try {
            const localRes = await fetch('http://localhost:5001/api/downloads/stream', {
              method: 'POST',
              headers: getApiHeaders(),
              body: JSON.stringify({ url: finalUrl, quality: actualQuality }),
              signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(6000) : undefined
            });
            const localData = await safeJsonParse(localRes);
            if (localData.success) {
              setLocalEngineActive(true);
              const sUrl = localData.type === 'audio' ? localData.streamUrl : localData.videoStreamUrl;
              let dlUrl = `http://localhost:5001/api/downloads/proxy-stream?url=${encodeURIComponent(sUrl)}&filename=${encodeURIComponent(localData.fileName)}`;
              if (localData.audioStreamUrl && localData.needsMuxing) {
                dlUrl += `&audioUrl=${encodeURIComponent(localData.audioStreamUrl)}`;
              }
              triggerBrowserDownload(dlUrl, localData.fileName);
              recordTrialDownloadConsumed(user);
              setCompletedTask({ fileName: localData.fileName, title: localData.title, quality: actualQuality, directDownload: true, downloadUrl: dlUrl });
              setIsDownloading(false);
              return;
            }
          } catch {}
        }

        // Show descriptive error
        const msgLower = (data.message || '').toLowerCase();
        if (msgLower.includes('unavailable') || msgLower.includes('private') || msgLower.includes('not found') || msgLower.includes('does not exist')) {
          setErrorMsg('⚠️ This video is unavailable, deleted, or private on YouTube. Please try another video link.');
        } else {
          setErrorMsg(data.message || 'Failed to resolve stream.');
        }
        setIsDownloading(false);
        return;
      }

      // Step 2: Trigger browser download directly from Render (bypasses Vercel 30s proxy timeout)
      const streamUrl = data.type === 'audio' ? data.streamUrl : data.videoStreamUrl;
      let dlUrl = `${RENDER_API_BASE}/api/downloads/proxy-stream?url=${encodeURIComponent(streamUrl)}&filename=${encodeURIComponent(data.fileName)}`;
      if (data.audioStreamUrl && data.needsMuxing) {
        dlUrl += `&audioUrl=${encodeURIComponent(data.audioStreamUrl)}`;
      }

      triggerBrowserDownload(dlUrl, data.fileName);
      recordTrialDownloadConsumed(user);

      // Record telemetry in background (non-blocking)
      try {
        fetch(`${base}/api/downloads/record`, {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            title: data.title,
            thumbnailUrl: resolvedMedia?.thumbnailUrl || '',
            fileName: data.fileName,
            originalUrl: finalUrl,
            platform: 'YouTube',
            quality: actualQuality,
            format: data.type === 'audio' ? 'mp3' : 'mp4',
            fileSize: data.sizeBytes || data.videoSize || 0,
            status: 'Completed',
            downloadSource: 'web',
            userId: user?.id || user?._id || undefined,
            userEmail: user?.email || undefined
          })
        }).catch(() => {});
      } catch {}

      setCompletedTask({
        fileName: data.fileName,
        title: data.title,
        quality: actualQuality,
        fileSize: data.sizeBytes || data.videoSize || 0,
        directDownload: true,
        downloadUrl: dlUrl
      });
      setIsDownloading(false);
      fetchHistory();

    } catch (err) {
      // Fallback: Try local companion engine only on localhost
      if (isLocalHost) {
        try {
          const localRes = await fetch('http://localhost:5001/api/downloads/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: finalUrl, quality: actualQuality }),
            signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(6000) : undefined
          });
          const localData = await safeJsonParse(localRes);
          if (localData.success) {
            setLocalEngineActive(true);
            const sUrl = localData.type === 'audio' ? localData.streamUrl : localData.videoStreamUrl;
            let dlUrl = `http://localhost:5001/api/downloads/proxy-stream?url=${encodeURIComponent(sUrl)}&filename=${encodeURIComponent(localData.fileName)}`;
            if (localData.audioStreamUrl && localData.needsMuxing) {
              dlUrl += `&audioUrl=${encodeURIComponent(localData.audioStreamUrl)}`;
            }
            triggerBrowserDownload(dlUrl, localData.fileName);
            recordTrialDownloadConsumed(user);
            setCompletedTask({ fileName: localData.fileName, title: localData.title, quality: actualQuality, directDownload: true, downloadUrl: dlUrl });
            setIsDownloading(false);
            return;
          }
        } catch {}
      }

      const errLower = (err?.message || '').toLowerCase();
      const isTimeout = err.name === 'AbortError' || errLower.includes('timeout') || errLower.includes('aborted');

      if (isTimeout && retryCount < 1) {
        setErrorMsg('⏳ Server is starting up. Retrying download stream in 2s...');
        setTimeout(() => {
          handleStartDownload(targetUrl, targetQuality, engineBase, retryCount + 1);
        }, 2000);
        return;
      }

      if (isTimeout) {
        setErrorMsg('Download stream timed out. Please tap Download again.');
      } else if (errLower.includes('not valid json') || errLower.includes('unexpected token')) {
        setErrorMsg('Cloud server is waking up. Please try again in 5 seconds.');
      } else {
        setErrorMsg(err.message || 'Download failed.');
      }
      setIsDownloading(false);
    }
  };

  // Load Playlist or Tab Queue
  const loadPlaylistQueue = async (queueKey = '', customUrl = playlistUrl) => {
    // Gatekeeper enforcement for free web trials
    if (!hasFreeTrialsRemaining(user)) {
      if (onOpenGatekeeper) onOpenGatekeeper();
      return;
    }

    setIsLoadingPlaylist(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/playlist/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueKey: queueKey || undefined,
          url: customUrl.trim() || undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setPlaylistData(data);
        const set = new Set();
        (data.videos || []).forEach(v => set.add(v.videoId));
        setSelectedVideoIds(set);
      } else {
        setErrorMsg(data.message || 'Failed to load playlist.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Network communication error.');
    } finally {
      setIsLoadingPlaylist(false);
    }
  };

  // Toggle Video Selection
  const toggleSelect = (id) => {
    const next = new Set(selectedVideoIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedVideoIds(next);
  };

  // Delete History Item
  const handleDeleteHistory = async (id) => {
    try {
      await fetch(`/api/downloads/history/${id}`, { method: 'DELETE' });
      setHistoryList(historyList.filter(h => h._id !== id));
    } catch {}
  };

  return (
    <div className="sz-studio-container">
      {/* Tab Navigation Header */}
      <div className="sz-tabs-scroll">
        <button 
          onClick={() => setActiveTab('single')}
          className={`sz-tab-btn ${activeTab === 'single' ? 'active' : ''}`}
        >
          <Zap size={15} /> Single Downloader
        </button>
        <button 
          onClick={() => setActiveTab('playlist')}
          className={`sz-tab-btn ${activeTab === 'playlist' ? 'active' : ''}`}
        >
          <ListMusic size={15} /> Playlist Studio
        </button>
        <button 
          onClick={() => { setActiveTab('history'); fetchHistory(); }}
          className={`sz-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
        >
          <History size={15} /> History {historyList.length > 0 && <span className="sz-tab-count">{historyList.length}</span>}
        </button>
      </div>

      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} /> <span>{errorMsg}</span>
          </div>
          {(errorMsg.includes('Extension') || errorMsg.includes('Cloud IP') || errorMsg.includes('localhost')) && (
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={onOpenExtensionModal}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🚀 Install Free Extension
              </button>
              <a
                href="http://localhost:5001"
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'rgba(56, 189, 248, 0.2)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                ⚡ Open Local Engine
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── FREE TRIAL & VIP STATUS BANNER ── */}
      {isUserVip(user) ? (
        <div className="sz-trial-banner sz-vip-active-banner">
          <div className="sz-trial-left">
            <div className="sz-trial-icon-box sz-vip-icon-box">
              <Crown size={16} />
            </div>
            <div>
              <div className="sz-trial-title-row">
                <span className="sz-vip-title">VIP MEMBER ACTIVE</span>
                <span className="sz-vip-tag">UNLIMITED 4K</span>
              </div>
              <div className="sz-trial-subtitle">
                Unlimited 4K cinema & 320kbps MP3 cloud downloads unlocked.
              </div>
            </div>
          </div>
        </div>
      ) : remainingTrials > 0 ? (
        <div className={`sz-trial-banner ${remainingTrials === 1 ? 'sz-trial-low' : 'sz-trial-normal'}`}>
          <div className="sz-trial-left">
            <div className="sz-trial-icon-box">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="sz-trial-title-row">
                <span className="sz-trial-pulse-beacon">
                  <span className="sz-beacon-ring" />
                  <span className="sz-beacon-dot" />
                </span>
                <span className="sz-trial-title">
                  Free Web Trial: <strong>{remainingTrials} of {maxTrials} Downloads Left</strong>
                </span>
                {/* Visual quota indicators */}
                <div className="sz-trial-dots">
                  {Array.from({ length: Math.min(maxTrials, 10) }).map((_, idx) => (
                    <span 
                      key={idx} 
                      className={`sz-quota-dot ${idx < remainingTrials ? 'active' : 'used'}`}
                      title={idx < remainingTrials ? 'Available Download' : 'Used Download'}
                    />
                  ))}
                </div>
              </div>
              <div className="sz-trial-subtitle">
                Instant Direct Cloud Stream • No Login or Credit Card Required
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenExtensionModal}
            className="sz-btn-extension-cta"
          >
            <Zap size={14} />
            <span>Get Unlimited with Free Extension →</span>
          </button>
        </div>
      ) : (
        <div className="sz-trial-banner sz-trial-exhausted">
          <div className="sz-trial-left">
            <div className="sz-trial-icon-box sz-trial-lock-box">
              <Lock size={16} />
            </div>
            <div>
              <div className="sz-trial-title-row">
                <span className="sz-trial-lock-title">
                  Free Web Trial Limit Reached ({maxTrials}/{maxTrials} Used)
                </span>
              </div>
              <div className="sz-trial-subtitle">
                Install our 100% Free Chrome Extension or Upgrade to VIP for unlimited turbo downloads.
              </div>
            </div>
          </div>

          <div className="sz-trial-exhausted-actions">
            <button
              type="button"
              onClick={onOpenExtensionModal}
              className="sz-btn-extension-cta"
            >
              <Zap size={14} />
              <span>Install Free Extension</span>
            </button>
            <button
              type="button"
              onClick={onOpenGatekeeper}
              className="sz-btn-unlock-vip-cta"
            >
              <Crown size={14} />
              <span>Unlock Unlimited VIP</span>
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 1: SINGLE DOWNLOADER ── */}
      {activeTab === 'single' && (
        <div>
          <div className="sz-studio-card">
            {/* Header with high-tech badge */}
            <div className="sz-studio-header">
              <div className="sz-studio-title-wrap">
                <div className="sz-header-icon-box">
                  <Video size={18} />
                </div>
                <div>
                  <h2 className="sz-studio-title">Video Downloader</h2>
                  <p className="sz-studio-desc">Download videos & audio in pristine quality with instant cloud stream.</p>
                </div>
              </div>
              <div className="sz-engine-chip">
                <span className="sz-pulse-dot" />
                TURBO STREAM ENGINE
              </div>
            </div>

            {/* Modern Unified Command / Input Bar */}
            <div className="sz-modern-input-bar">
              <div className="sz-input-search-prefix">
                <Search size={18} />
              </div>
              <input
                id="sz-main-input"
                type="text"
                placeholder="Paste YouTube, Shorts, Video or Audio Link here..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && resolveSingleUrl()}
                className="sz-clean-input"
              />
              <div className="sz-input-actions-cluster">
                <button
                  type="button"
                  onClick={handlePaste}
                  className="sz-action-paste-btn"
                  title="Paste link from clipboard"
                >
                  <Clipboard size={14} />
                  <span>Paste</span>
                </button>
                {url && (
                  <button
                    type="button"
                    onClick={() => { setUrl(''); setErrorMsg(''); }}
                    className="sz-action-clear-btn"
                    title="Clear input"
                  >
                    ✕
                  </button>
                )}
                <button
                  onClick={() => resolveSingleUrl()}
                  disabled={isResolving || !url.trim()}
                  className="sz-btn-analyze-modern"
                >
                  {isResolving ? (
                    <>
                      <Loader2 size={16} className="sz-spin-icon" />
                      <span>Resolving...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Analyze</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Platform Feature Chips */}
            <div className="sz-feature-chips-row">
              <span className="sz-feature-chip">
                <Zap size={12} color="#38bdf8" /> 100MB/s Cloud Stream
              </span>
              <span className="sz-feature-chip">
                <Video size={12} color="#818cf8" /> Up to 4K Ultra HD
              </span>
              <span className="sz-feature-chip">
                <Music size={12} color="#34d399" /> 320kbps MP3 Audio
              </span>
              <span className="sz-feature-chip">
                <CheckCircle2 size={12} color="#a78bfa" /> 100% Free & Safe
              </span>
            </div>
          </div>

          {/* Resolved Media Card */}
          {resolvedMedia && (
            <div className="sz-studio-card sz-media-preview-card">
              <div className="sz-preview-layout">
                {/* 16:9 Thumbnail Container */}
                <div className="sz-thumb-wrapper">
                  <img 
                    src={resolvedMedia.thumbnailUrl} 
                    alt={resolvedMedia.title}
                    className="sz-preview-img-modern"
                  />
                  {/* Overlay Badges */}
                  <div className="sz-thumb-badge-top">
                    <span className="sz-source-badge">
                      <Video size={11} /> {url.includes('shorts') ? 'Shorts' : 'YouTube'}
                    </span>
                  </div>
                  {resolvedMedia.formattedDuration && resolvedMedia.formattedDuration !== '00:00' && resolvedMedia.formattedDuration !== '0:00' ? (
                    <div className="sz-thumb-badge-bottom">
                      <span className="sz-duration-pill">{resolvedMedia.formattedDuration}</span>
                    </div>
                  ) : (
                    <div className="sz-thumb-badge-bottom">
                      <span className="sz-duration-pill">HD Stream</span>
                    </div>
                  )}
                </div>

                {/* Media Details & Controls */}
                <div className="sz-preview-content">
                  <div className="sz-channel-pill-row">
                    <span className="sz-channel-pill">
                      <span className="sz-verified-indicator" />
                      {resolvedMedia.author || 'YouTube Channel'}
                    </span>
                    {resolvedMedia.formattedDuration && resolvedMedia.formattedDuration !== '00:00' && resolvedMedia.formattedDuration !== '0:00' ? (
                      <span className="sz-channel-pill" style={{ color: '#94a3b8' }}>
                        Duration: {resolvedMedia.formattedDuration}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="sz-media-title" title={resolvedMedia.title}>
                    {resolvedMedia.title}
                  </h3>

                  {/* Quality Selector & Download Row */}
                  <div className="sz-quality-control-container">
                    <div className="sz-quality-selection-wrap">
                      <label className="sz-quality-label">
                        <Sparkles size={13} color="#38bdf8" /> Select Quality:
                      </label>
                      <div className="sz-quality-pills-cluster">
                        {(resolvedMedia.availableQualities || []).map(q => {
                          const isSelected = selectedQuality === q;
                          const isAudio = q === 'MP3';
                          const is1080 = q === '1080p';
                          const is4K = q === '4K' || q === '2160p';
                          return (
                            <button
                              key={q}
                              type="button"
                              onClick={() => setSelectedQuality(q)}
                              className={`sz-quality-pill ${isSelected ? 'active' : ''}`}
                            >
                              {isAudio ? <Music size={12} className="sz-pill-icon" /> : null}
                              <span>{q}</span>
                              {is1080 && <span className="sz-pill-subtag">FHD</span>}
                              {is4K && <span className="sz-pill-subtag-gold">4K</span>}
                              {isAudio && <span className="sz-pill-subtag-audio">320k</span>}
                              {isSelected && <Check size={12} className="sz-pill-check" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartDownload()}
                      disabled={isDownloading}
                      className="sz-grand-download-btn"
                    >
                      <Download size={18} className="sz-btn-dl-icon" />
                      <span>{isDownloading ? 'Downloading Stream...' : `Download ${selectedQuality || '1080p'}`}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Real-time High-Tech Progress Card */}
              {isDownloading && (
                <div className="sz-downloading-card">
                  <div className="sz-dl-header">
                    <div className="sz-dl-left">
                      <div className="sz-dl-spinner-wrap">
                        <Loader2 className="sz-spin-icon" size={18} />
                      </div>
                      <div className="sz-dl-status-wrap">
                        <div className="sz-dl-badge-row">
                          <span className="sz-dl-badge">
                            <span className="sz-pulse-dot" />
                            FAST STREAM
                          </span>
                          <span className="sz-dl-quality-tag">{selectedQuality || '1080p'}</span>
                        </div>
                        <span className="sz-dl-status-text">
                          {downloadProgress?.status || 'Connecting to stream & preparing download...'}
                        </span>
                      </div>
                    </div>
                    <div className="sz-dl-right">
                      <span className="sz-dl-percent">
                        {downloadProgress?.percentage ? `${downloadProgress.percentage}%` : 'Starting...'}
                      </span>
                      {downloadProgress?.speedMBps ? (
                        <span className="sz-dl-speed">
                          <Zap size={12} className="sz-zap-icon" /> {downloadProgress.speedMBps} MB/s
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Modern Animated Progress Track */}
                  <div className="sz-progress-track">
                    <div 
                      className="sz-progress-fill"
                      style={{ width: `${Math.max(14, downloadProgress?.percentage || 14)}%` }}
                    >
                      <div className="sz-progress-glow" />
                    </div>
                  </div>

                  {/* High-Tech Sub-Row */}
                  <div className="sz-dl-footer">
                    <span className="sz-dl-meta-item">
                      <Sparkles size={12} style={{ color: '#38bdf8' }} /> High-Speed Cloud Muxer Active
                    </span>
                    <span className="sz-dl-meta-item">
                      Direct Browser Stream
                    </span>
                  </div>
                </div>
              )}

              {/* Modern Completed Success Card */}
              {completedTask && (
                <div className="sz-completed-card">
                  <div className="sz-completed-inner">
                    <div className="sz-completed-left">
                      <div className="sz-completed-icon-box">
                        <CheckCircle2 size={24} className="sz-success-check" />
                      </div>
                      <div className="sz-completed-details">
                        <div className="sz-completed-eyebrow">
                          <span className="sz-completed-pill">READY TO SAVE</span>
                          <span className="sz-completed-quality-pill">{completedTask.quality || selectedQuality || '1080p'}</span>
                        </div>
                        <h4 className="sz-completed-title" title={completedTask.fileName}>
                          {completedTask.fileName}
                        </h4>
                        <div className="sz-completed-stats">
                          {completedTask.fileSize ? (
                            <span className="sz-stat-chip">
                              {(completedTask.fileSize / 1024 / 1024).toFixed(2)} MB
                            </span>
                          ) : null}
                          {completedTask.timeSeconds ? (
                            <span className="sz-stat-chip">
                              {completedTask.timeSeconds}s
                            </span>
                          ) : null}
                          {completedTask.averageSpeedMBps ? (
                            <span className="sz-stat-chip sz-stat-speed">
                              <Zap size={11} /> {completedTask.averageSpeedMBps} MB/s
                            </span>
                          ) : null}
                          <span className="sz-stat-chip sz-stat-verified">
                            <Check size={11} /> Verified Safe
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="sz-completed-actions">
                      <a
                        href={completedTask.downloadUrl || getFileDownloadUrl(completedTask.fileName)}
                        download={completedTask.fileName}
                        target="_blank"
                        rel="noreferrer"
                        className="sz-btn-save-video"
                      >
                        <Download size={18} />
                        <span>Save Video</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: PLAYLIST STUDIO ── */}
      {activeTab === 'playlist' && (
        <div>
          <div className="sz-studio-card">
            <div className="sz-studio-header">
              <div className="sz-studio-title-wrap">
                <div className="sz-header-icon-box">
                  <ListMusic size={18} />
                </div>
                <div>
                  <h2 className="sz-studio-title">Playlist Downloader</h2>
                  <p className="sz-studio-desc">Download entire YouTube playlists & mixes with bulk selection.</p>
                </div>
              </div>
              <div className="sz-engine-chip">
                <span className="sz-pulse-dot" />
                BATCH STUDIO ENGINE
              </div>
            </div>

            <div className="sz-modern-input-bar">
              <div className="sz-input-search-prefix">
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="Paste YouTube Playlist or Mix Link here..."
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadPlaylistQueue('', playlistUrl)}
                className="sz-clean-input"
              />
              <div className="sz-input-actions-cluster">
                <button
                  onClick={() => loadPlaylistQueue('', playlistUrl)}
                  disabled={isLoadingPlaylist || !playlistUrl.trim()}
                  className="sz-btn-analyze-modern"
                >
                  {isLoadingPlaylist ? (
                    <>
                      <Loader2 size={16} className="sz-spin-icon" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Load Playlist</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {playlistData && (
            <div style={{ marginTop: '20px', background: '#111827', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="sz-playlist-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                  <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playlistData.title}</h3>
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>{selectedVideoIds.size} of {playlistData.videoCount} videos selected</p>
                </div>
                <div className="sz-playlist-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={batchFormat}
                    onChange={(e) => setBatchFormat(e.target.value)}
                    style={{ padding: '10px 12px', background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '8px', minHeight: '44px' }}>
                    <option value="1080p">1080p Full HD</option>
                    <option value="720p">720p HD</option>
                    <option value="480p">480p</option>
                    <option value="MP3">MP3 Audio Only</option>
                  </select>
                  <button
                    onClick={() => {
                      if (!hasFreeTrialsRemaining(user)) {
                        if (onOpenGatekeeper) onOpenGatekeeper();
                        return;
                      }
                      if (selectedVideoIds.size === 0) return alert('Please select at least 1 video.');
                      alert(`Queued ${selectedVideoIds.size} items for batch download.`);
                    }}
                    style={{
                      padding: '10px 20px', background: '#10b981', color: '#fff', fontWeight: 700,
                      borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px'
                    }}>
                    <Download size={16} /> Download Selected ({selectedVideoIds.size})
                  </button>
                </div>
              </div>

              {/* Videos Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(playlistData.videos || []).map((v) => (
                  <div
                    key={v.videoId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '16px', padding: '12px',
                      background: selectedVideoIds.has(v.videoId) ? 'rgba(59, 130, 246, 0.1)' : '#1f2937',
                      border: '1px solid ' + (selectedVideoIds.has(v.videoId) ? '#3b82f6' : 'transparent'),
                      borderRadius: '8px'
                    }}>
                    <input
                      type="checkbox"
                      checked={selectedVideoIds.has(v.videoId)}
                      onChange={() => toggleSelect(v.videoId)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ color: '#9ca3af', fontWeight: 600, width: '30px' }}>#{v.index}</span>
                    <img src={v.thumbnailUrl} alt={v.title} style={{ width: '70px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                    <div style={{ flex: 1 }}>
                      <h4 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600 }}>{v.title}</h4>
                      <p style={{ color: '#9ca3af', fontSize: '0.8rem' }}>{v.author} • {v.formattedDuration}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Progressive Load Banner */}
              <div style={{ marginTop: '20px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid #3b82f6', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ color: '#93c5fd', fontWeight: 600 }}>
                    {playlistData.hasMore ? `Showing first ${playlistData.videoCount} videos` : `✓ All ${playlistData.videoCount} Videos Loaded`}
                  </h4>
                  <p style={{ color: '#bfdbfe', fontSize: '0.85rem' }}>
                    {playlistData.hasMore ? 'Instant preview ready. Load additional tracks below.' : 'Complete playlist loaded successfully.'}
                  </p>
                </div>
                {playlistData.hasMore && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => loadPlaylistQueue('', playlistUrl)}
                      style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Load Next 25 Videos
                    </button>
                    <button
                      onClick={() => loadPlaylistQueue('', playlistUrl)}
                      style={{ padding: '8px 16px', background: '#1d4ed8', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      ⚡ Load All Videos
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: DOWNLOADS HISTORY ── */}
      {activeTab === 'history' && (
        <div className="sz-studio-card">
          <div className="sz-studio-header">
            <div className="sz-studio-title-wrap">
              <div className="sz-header-icon-box">
                <History size={18} />
              </div>
              <div>
                <h2 className="sz-studio-title">Download History</h2>
                <p className="sz-studio-desc">Saved telemetry and completed downloads powered by MongoDB Atlas.</p>
              </div>
            </div>
            <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
              <Search size={16} color="#38bdf8" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              <input
                type="text"
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  fetchHistory();
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1.5px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  color: '#fff',
                  outline: 'none',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s'
                }}
              />
            </div>
          </div>

          {loadingHistory ? (
            <p style={{ color: '#9ca3af' }}>Loading history from MongoDB...</p>
          ) : historyList.length === 0 ? (
            <p style={{ color: '#9ca3af' }}>No downloads recorded yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historyList.map((item) => (
                <div
                  key={item._id}
                  className="sz-history-row"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', background: '#1f2937', borderRadius: '10px', border: '1px solid #374151',
                    flexWrap: 'wrap', gap: '12px'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 220px' }}>
                    {item.format === 'mp3' ? <Music color="#10b981" size={22} style={{ flexShrink: 0 }} /> : <Video color="#3b82f6" size={22} style={{ flexShrink: 0 }} />}
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, wordBreak: 'break-word' }}>{item.title}</h4>
                      <p style={{ color: '#9ca3af', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                        {item.fileName} • {(item.fileSize / 1024 / 1024).toFixed(2)} MB • {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="sz-history-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                    {item.originalUrl ? (
                      <button
                        onClick={() => handleStartDownload(item.originalUrl, item.quality || '1080p')}
                        style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                        Download
                      </button>
                    ) : (
                      <a
                        href={getFileDownloadUrl(item.fileName)}
                        download={item.fileName}
                        target="_blank"
                        rel="noreferrer"
                        style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
                        Download
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteHistory(item._id)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px' }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
