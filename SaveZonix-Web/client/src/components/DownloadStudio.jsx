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
  Crown
} from 'lucide-react';
import { getRemainingTrials, hasFreeTrialsRemaining, recordTrialDownloadConsumed, isUserVip, MAX_FREE_TRIALS } from '../utils/trialManager';

export default function DownloadStudio({ user, onOpenGatekeeper, onOpenExtensionModal, onOpenVip }) {
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
  const [remainingTrials, setRemainingTrials] = useState(() => getRemainingTrials(user));

  useEffect(() => {
    setRemainingTrials(getRemainingTrials(user));
  }, [user]);

  useEffect(() => {
    const onTrialUpdated = () => setRemainingTrials(getRemainingTrials(user));
    window.addEventListener('savezonix:trial_updated', onTrialUpdated);
    return () => window.removeEventListener('savezonix:trial_updated', onTrialUpdated);
  }, [user]);

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

    // Connect to Socket.IO with dynamic host
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

    fetchHistory();

    return () => {
      socket.disconnect();
    };
  }, []);

  // Polling fallback: Automatically detect completed downloads even if WebSocket disconnects
  useEffect(() => {
    let interval;
    if (isDownloading) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/downloads/history?limit=1');
          const data = await res.json();
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
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isDownloading]);

  // Get file download link routing to local engine or cloud
  const getFileDownloadUrl = (fileName) => {
    if (!fileName) return '#';
    const base = localEngineActive ? 'http://localhost:5001' : '';
    return `${base}/api/downloads/file/${encodeURIComponent(fileName)}`;
  };

  // Fetch download history from MongoDB
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/downloads/history?search=${encodeURIComponent(historySearch)}`);
      const data = await res.json();
      if (data.success) {
        setHistoryList(data.history || []);
      }
    } catch {}
    setLoadingHistory(false);
  };

  // Sanitize single media URL
  const sanitizeSingleUrl = (raw) => {
    const rawStr = (typeof raw === 'string' && raw) ? raw : (typeof url === 'string' ? url : '');
    let clean = (rawStr || '').trim();
    try {
      const u = new URL(clean);
      if (u.searchParams.has('v') && !clean.includes('/playlist')) {
        clean = `https://www.youtube.com/watch?v=${u.searchParams.get('v')}`;
      }
    } catch {}
    return clean;
  };

  // Resolve single media info
  const resolveSingleUrl = async (targetUrl = url, autoStart = false, engineBase = null) => {
    const cleanTarget = sanitizeSingleUrl(targetUrl || url);
    if (!cleanTarget) return;
    setIsResolving(true);
    setErrorMsg('');
    setResolvedMedia(null);
    setCompletedTask(null);

    let base = engineBase !== null ? engineBase : (localEngineActive ? 'http://localhost:5001' : '');

    try {
      let res;
      try {
        res = await fetch(`${base}/api/downloads/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: cleanTarget }),
          signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(8000) : undefined
        });
      } catch (cloudErr) {
        if (!base) {
          try {
            res = await fetch('http://localhost:5001/api/downloads/resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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

      const data = await res.json();
      if (data.success) {
        setResolvedMedia(data);
        const topQuality = data.availableQualities?.includes('1080p') ? '1080p' : (data.availableQualities?.[0] || '1080p');
        if (data.availableQualities?.length > 0) {
          setSelectedQuality(topQuality);
        }
        if (autoStart) {
          setTimeout(() => {
            handleStartDownload(cleanTarget, topQuality, base);
          }, 350);
        }
      } else {
        // Fallback to local companion engine if cloud resolution failed
        if (!base) {
          try {
            const localRes = await fetch('http://localhost:5001/api/downloads/resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: cleanTarget }),
              signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(6000) : undefined
            });
            const localData = await localRes.json();
            if (localData.success) {
              setResolvedMedia(localData);
              setLocalEngineActive(true);
              const topQuality = localData.availableQualities?.includes('1080p') ? '1080p' : (localData.availableQualities?.[0] || '1080p');
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

        if (data.message?.includes('player') || data.message?.includes('429') || data.message?.includes('bot') || data.message?.includes('throttled')) {
          setErrorMsg('YouTube Cloud IP Throttled: Cloud datacenter servers are restricted by YouTube. Please use the SaveZonix Chrome Extension or open http://localhost:5001 for 100% unrestricted 4K/8K downloads!');
        } else {
          setErrorMsg(data.message || 'Failed to resolve media stream.');
        }
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('aborted') || err.message?.includes('player')) {
        setErrorMsg('YouTube Cloud IP Throttled: Cloud datacenter servers are restricted by YouTube. Please use the SaveZonix Chrome Extension or open http://localhost:5001 for 100% unrestricted 4K/8K downloads!');
      } else {
        setErrorMsg(err.message || 'Resolution failed.');
      }
    } finally {
      setIsResolving(false);
    }
  };

  // Start single turbo download
  const handleStartDownload = async (targetUrl = url, targetQuality = selectedQuality, engineBase = null) => {
    // Gatekeeper enforcement for free web trials
    if (!hasFreeTrialsRemaining(user)) {
      if (onOpenGatekeeper) onOpenGatekeeper();
      return;
    }

    const actualUrl = (typeof targetUrl === 'string' && targetUrl) ? targetUrl : url;
    const actualQuality = (typeof targetQuality === 'string' && targetQuality) ? targetQuality : selectedQuality;

    const finalUrl = sanitizeSingleUrl(actualUrl || url);
    if (!finalUrl) return;
    setIsDownloading(true);
    setErrorMsg('');
    setCompletedTask(null);

    let base = engineBase !== null ? engineBase : (localEngineActive ? 'http://localhost:5001' : '');

    try {
      let res;
      try {
        res = await fetch(`${base}/api/downloads/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: finalUrl,
            quality: actualQuality || selectedQuality
          })
        });
      } catch (cloudErr) {
        if (!base) {
          try {
            res = await fetch('http://localhost:5001/api/downloads/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: finalUrl,
                quality: actualQuality || selectedQuality
              })
            });
            if (res.ok) {
              base = 'http://localhost:5001';
              setLocalEngineActive(true);
            }
          } catch {}
        }
        if (!res) throw cloudErr;
      }

      const data = await res.json();
      if (!data.success) {
        // Fallback to local engine if cloud failed to start
        if (!base) {
          try {
            const localRes = await fetch('http://localhost:5001/api/downloads/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: finalUrl,
                quality: actualQuality || selectedQuality
              })
            });
            const localData = await localRes.json();
            if (localData.success) {
              setLocalEngineActive(true);
              recordTrialDownloadConsumed(user);
              return;
            }
          } catch {}
        }

        setErrorMsg(data.message || 'Failed to start download.');
        setIsDownloading(false);
      } else {
        // Record trial download consumption
        recordTrialDownloadConsumed(user);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to start download.');
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
    <div className="download-studio-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Tab Navigation Header */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('single')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px',
            background: activeTab === 'single' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
            color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600
          }}>
          <Zap size={18} /> Single Downloader
        </button>
        <button 
          onClick={() => setActiveTab('playlist')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px',
            background: activeTab === 'playlist' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
            color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600
          }}>
          <ListMusic size={18} /> Playlist Studio
        </button>
        <button 
          onClick={() => { setActiveTab('history'); fetchHistory(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px',
            background: activeTab === 'history' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
            color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600
          }}>
          <History size={18} /> Downloads History ({historyList.length})
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
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '12px',
          padding: '8px 16px',
          marginBottom: '20px',
          color: '#fbbf24',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 4px 15px rgba(245, 158, 11, 0.1)'
        }}>
          <Crown size={16} color="#fbbf24" />
          <span>👑 VIP Member Active • Unlimited 4K Cloud Downloads Unlocked</span>
        </div>
      ) : remainingTrials > 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: remainingTrials === 1 
            ? 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(234, 88, 12, 0.05) 100%)'
            : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.05) 100%)',
          border: remainingTrials === 1 ? '1px solid rgba(249, 115, 22, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '12px',
          padding: '10px 16px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🎁</span>
            <div>
              <span style={{
                color: remainingTrials === 1 ? '#fb923c' : '#34d399',
                fontSize: '13.5px',
                fontWeight: 700
              }}>
                Free Web Trial: {remainingTrials} of {MAX_FREE_TRIALS} Downloads Left
              </span>
              <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '8px' }}>
                • No Login or Card Required
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenExtensionModal}
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.25)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'}
          >
            <Zap size={13} />
            <span>Get Unlimited with Free Extension →</span>
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.08) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '12px',
          padding: '12px 18px',
          marginBottom: '20px',
          boxShadow: '0 0 25px rgba(239, 68, 68, 0.15)',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Lock size={16} color="#f87171" />
            </div>
            <div>
              <div style={{ color: '#f87171', fontSize: '14px', fontWeight: 700 }}>
                Free Web Trial Limit Reached (3/3 Used)
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                Install the 100% Free Chrome Extension or Upgrade to VIP for unlimited turbo downloads.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onOpenExtensionModal}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                fontSize: '12.5px',
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>Install Free Extension</span>
            </button>
            <button
              type="button"
              onClick={onOpenGatekeeper}
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                border: 'none',
                color: '#fff',
                fontSize: '12.5px',
                fontWeight: 700,
                padding: '7px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(37, 99, 235, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Zap size={14} />
              <span>Unlock Unlimited</span>
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 1: SINGLE DOWNLOADER ── */}
      {activeTab === 'single' && (
        <div>
          <div style={{ background: '#111827', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap color="#3b82f6" /> Turbo High-Speed Downloader
            </h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                placeholder="Paste YouTube, Video or Audio Link here..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && resolveSingleUrl()}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: '8px', background: '#1f2937',
                  border: '1px solid #374151', color: '#fff', fontSize: '1rem', outline: 'none'
                }}
              />
              <button
                onClick={() => resolveSingleUrl()}
                disabled={isResolving || !url.trim()}
                style={{
                  padding: '12px 24px', background: '#2563eb', color: '#fff', fontWeight: 600,
                  borderRadius: '8px', border: 'none', cursor: 'pointer'
                }}>
                {isResolving ? 'Resolving...' : 'Analyze'}
              </button>
            </div>
          </div>

          {/* Resolved Media Card */}
          {resolvedMedia && (
            <div style={{ marginTop: '20px', background: '#111827', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <img 
                  src={resolvedMedia.thumbnailUrl} 
                  alt={resolvedMedia.title}
                  style={{ width: '220px', height: '124px', objectFit: 'cover', borderRadius: '8px' }}
                />
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <h3 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 600, marginBottom: '6px' }}>{resolvedMedia.title}</h3>
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '16px' }}>Channel: {resolvedMedia.author} • Duration: {resolvedMedia.formattedDuration}</p>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ color: '#e5e7eb', fontSize: '0.9rem', fontWeight: 500 }}>Select Quality:</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {(resolvedMedia.availableQualities || []).map(q => (
                        <button
                          key={q}
                          onClick={() => setSelectedQuality(q)}
                          style={{
                            padding: '6px 14px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600,
                            background: selectedQuality === q ? '#3b82f6' : '#1f2937',
                            color: selectedQuality === q ? '#fff' : '#9ca3af',
                            border: '1px solid ' + (selectedQuality === q ? '#3b82f6' : '#374151'),
                            cursor: 'pointer'
                          }}>
                          {q}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => handleStartDownload()}
                      disabled={isDownloading}
                      style={{
                        marginLeft: 'auto', padding: '10px 24px', background: '#10b981', color: '#fff',
                        fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px'
                      }}>
                      <Download size={18} /> {isDownloading ? 'Downloading...' : '⚡ Turbo Download'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Real-time Progress Bar */}
              {isDownloading && (
                <div style={{ marginTop: '24px', background: '#1f2937', padding: '16px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', background: '#10b981' }} />
                      {downloadProgress?.status || '⚡ Turbo Engine: Processing & fetching stream chunks from YouTube...'}
                    </span>
                    <span>{downloadProgress?.percentage || 15}% {downloadProgress?.speedMBps ? `(${downloadProgress.speedMBps} MB/s)` : ''}</span>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: '#374151', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.max(15, downloadProgress?.percentage || 15)}%`, height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              )}

              {/* Completed Card */}
              {completedTask && (
                <div style={{ marginTop: '20px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 color="#10b981" size={24} />
                    <div>
                      <h4 style={{ color: '#fff', fontWeight: 600 }}>Download Completed Successfully!</h4>
                      <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{completedTask.fileName} • {(completedTask.fileSize / 1024 / 1024).toFixed(2)} MB in {completedTask.timeSeconds}s (@ {completedTask.averageSpeedMBps} MB/s)</p>
                    </div>
                  </div>
                  <a
                    href={getFileDownloadUrl(completedTask.fileName)}
                    download={completedTask.fileName}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '8px 18px', background: '#10b981', color: '#fff', fontWeight: 600,
                      borderRadius: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px'
                    }}>
                    <Download size={16} /> Save to PC
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: PLAYLIST STUDIO ── */}
      {activeTab === 'playlist' && (
        <div>
          <div style={{ background: '#111827', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ListMusic color="#3b82f6" /> YouTube Playlist & Mix Studio
            </h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                placeholder="Paste YouTube Playlist or Mix Link..."
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadPlaylistQueue('', playlistUrl)}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: '8px', background: '#1f2937',
                  border: '1px solid #374151', color: '#fff', fontSize: '1rem', outline: 'none'
                }}
              />
              <button
                onClick={() => loadPlaylistQueue('', playlistUrl)}
                disabled={isLoadingPlaylist || !playlistUrl.trim()}
                style={{
                  padding: '12px 24px', background: '#2563eb', color: '#fff', fontWeight: 600,
                  borderRadius: '8px', border: 'none', cursor: 'pointer'
                }}>
                {isLoadingPlaylist ? 'Loading...' : 'Load Playlist'}
              </button>
            </div>
          </div>

          {playlistData && (
            <div style={{ marginTop: '20px', background: '#111827', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
                <div>
                  <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>{playlistData.title}</h3>
                  <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>{selectedVideoIds.size} of {playlistData.videoCount} videos selected</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <select
                    value={batchFormat}
                    onChange={(e) => setBatchFormat(e.target.value)}
                    style={{ padding: '8px 12px', background: '#1f2937', color: '#fff', border: '1px solid #374151', borderRadius: '6px' }}>
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
                      alert(`Queued ${selectedVideoIds.size} items for turbo batch download!`);
                    }}
                    style={{
                      padding: '10px 20px', background: '#10b981', color: '#fff', fontWeight: 700,
                      borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
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
        <div style={{ background: '#111827', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History color="#3b82f6" /> Download History (MongoDB Atlas)
            </h2>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="text"
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  fetchHistory();
                }}
                style={{
                  width: '100%', padding: '8px 12px 8px 36px', background: '#1f2937',
                  border: '1px solid #374151', borderRadius: '6px', color: '#fff', outline: 'none'
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
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', background: '#1f2937', borderRadius: '8px', border: '1px solid #374151'
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {item.format === 'mp3' ? <Music color="#10b981" size={24} /> : <Video color="#3b82f6" size={24} />}
                    <div>
                      <h4 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 600 }}>{item.title}</h4>
                      <p style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                        {item.fileName} • {(item.fileSize / 1024 / 1024).toFixed(2)} MB • Speed: {item.downloadSpeedMBps || 0} MB/s • {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <a
                      href={getFileDownloadUrl(item.fileName)}
                      download={item.fileName}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', borderRadius: '6px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
                      Download
                    </a>
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
