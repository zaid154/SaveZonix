import React, { useState, useEffect } from 'react';
import {
  IconActivity,
  IconUsers,
  IconDownload,
  IconCpu,
  IconAlertCircle,
  IconLock,
  IconSliders,
  IconRefresh,
  IconExternal,
  IconLogOut,
  IconCheck,
  IconCreditCard,
  IconMessageSquare
} from './admin/AdminIcons';

import AdminErrorBoundary from './admin/AdminErrorBoundary';
import OverviewTab from './admin/OverviewTab';
import FinancialsTab from './admin/FinancialsTab';
import UsersTab from './admin/UsersTab';
import UserDetailsModal from './admin/UserDetailsModal';
import DownloadsTab from './admin/DownloadsTab';
import FeedbackTab from './admin/FeedbackTab';
import AiAdvisorTab from './admin/AiAdvisorTab';
import DiagnosticsTab from './admin/DiagnosticsTab';
import SecurityTab from './admin/SecurityTab';
import EngineTab from './admin/EngineTab';

export default function AdminDashboard({ user, currentPath = '/admin/overview', onNavigate, onBack, onOpenAuth, onLogout }) {
  // 1. Unified Authentication Resolution
  const userToken = localStorage.getItem('savezonix_token') || '';
  const adminLegacyToken = localStorage.getItem('savezonix_admin_token') || '';
  const activeToken = userToken || adminLegacyToken;

  const effectiveUser = user || (() => {
    try {
      const stored = localStorage.getItem('savezonix_user') || localStorage.getItem('savezonix_admin_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  const isSuperAdminEmail = effectiveUser?.email?.toLowerCase() === 'zaidm1323@gmail.com' ||
                            effectiveUser?.email?.toLowerCase() === 'savezonix@gmail.com';
  const isAdmin = Boolean(effectiveUser && (
    effectiveUser.role === 'Admin' ||
    effectiveUser.role === 'admin' ||
    effectiveUser.Role === 'Admin' ||
    effectiveUser.isAdmin === true ||
    isSuperAdminEmail
  )) || Boolean(adminLegacyToken);

  function getTabFromPath(path) {
    if (!path) return 'overview';
    const sub = path.replace(/^\/admin\/?/i, '').toLowerCase().trim();
    if (sub === 'financials' || sub === 'finance' || sub === 'sales') return 'financials';
    if (sub === 'ai-cdn-advisor' || sub === 'ai-advisor' || sub === 'ai_advisor') return 'ai-cdn-advisor';
    if (sub === 'engine-database' || sub === 'engine' || sub === 'engine_database') return 'engine-database';
    if (sub === 'feedback' || sub === 'feedbacks') return 'feedback';
    const valid = ['overview', 'financials', 'users', 'downloads', 'feedback', 'ai-cdn-advisor', 'diagnostics', 'security', 'engine-database'];
    if (valid.includes(sub)) return sub;
    return 'overview';
  }

  // 7 Core Modules from .NET Admin Panel
  const [activeTab, setActiveTab] = useState(() => getTabFromPath(currentPath));

  const [stats, setStats] = useState(() => {
    try {
      const cached = sessionStorage.getItem('sz_cache_stats');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [users, setUsers] = useState(() => {
    try {
      const cached = sessionStorage.getItem('sz_cache_users');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [downloads, setDownloads] = useState(() => {
    try {
      const cached = sessionStorage.getItem('sz_cache_downloads');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  });
  const [diagnostics, setDiagnostics] = useState(() => {
    try {
      const cached = sessionStorage.getItem('sz_cache_diagnostics');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [dbStatus, setDbStatus] = useState(() => {
    try {
      const cached = sessionStorage.getItem('sz_cache_dbStatus');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [settings, setSettings] = useState(() => {
    try {
      const cached = sessionStorage.getItem('sz_cache_settings');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [feedbacks, setFeedbacks] = useState(() => {
    try {
      const cached = sessionStorage.getItem('sz_cache_feedbacks');
      const parsed = cached ? JSON.parse(cached) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  // Loaded Tabs Cache for 0ms Instant Switching
  const [loadedTabs, setLoadedTabs] = useState(() => new Set());

  // User History Inspector Modal
  const [selectedUserInspector, setSelectedUserInspector] = useState(null);

  // Global Feedback & Loading
  const [saveMessage, setSaveMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  function handleAdminLogout() {
    localStorage.removeItem('savezonix_admin_token');
    localStorage.removeItem('savezonix_admin_user');
    localStorage.removeItem('savezonix_admin_key');
    localStorage.removeItem('savezonix_token');
    localStorage.removeItem('savezonix_user');
    if (onLogout) onLogout();
    if (onBack) onBack();
    else if (onNavigate) onNavigate('/');
    else window.location.href = '/';
  }

  function getAuthHeaders(token = activeToken) {
    const headers = {
      'Content-Type': 'application/json',
      'x-admin-key': 'savezonix_admin_2026'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  useEffect(() => {
    const targetTab = getTabFromPath(currentPath);
    setActiveTab(targetTab);
    loadTabData(targetTab, true, activeToken);
  }, [currentPath, activeToken, isAdmin]);

  function handleTabClick(tabId) {
    setActiveTab(tabId);
    if (onNavigate) {
      onNavigate(`/admin/${tabId}`);
    } else {
      window.history.pushState({}, '', `/admin/${tabId}`);
    }
    loadTabData(tabId, true, activeToken);
  }

  // High-Speed SWR Loader: Loads live data from MongoDB and keeps React state + session cache up to date
  async function loadTabData(tab = activeTab, force = true, token = activeToken) {
    const resolvedToken = token || activeToken;
    setLoading(true);
    const headers = getAuthHeaders(resolvedToken);

    try {
      const calls = [];

      // 1. Overview tab: needs stats + downloads
      if (tab === 'overview') {
        calls.push(
          fetch('/api/admin/stats', { headers })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (d) {
                setStats(d);
                try { sessionStorage.setItem('sz_cache_stats', JSON.stringify(d)); } catch {}
              }
            })
            .catch(() => null)
        );
        calls.push(
          fetch('/api/admin/downloads', { headers })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (Array.isArray(d)) {
                setDownloads(d);
                try { sessionStorage.setItem('sz_cache_downloads', JSON.stringify(d)); } catch {}
              }
            })
            .catch(() => null)
        );
      }

      // 2. Users / Security tabs: needs fresh users list + settings
      if (tab === 'users' || tab === 'security') {
        calls.push(
          fetch('/api/admin/users', { headers })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (Array.isArray(d)) {
                setUsers(d);
                try { sessionStorage.setItem('sz_cache_users', JSON.stringify(d)); } catch {}
              }
            })
            .catch(() => null)
        );
        calls.push(
          fetch('/api/admin/settings', { headers })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (d) {
                setSettings(d);
                try { sessionStorage.setItem('sz_cache_settings', JSON.stringify(d)); } catch {}
              }
            })
            .catch(() => null)
        );
      }

      // 3. Downloads tab: needs fresh downloads list
      if (tab === 'downloads') {
        calls.push(
          fetch('/api/admin/downloads', { headers })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (Array.isArray(d)) {
                setDownloads(d);
                try { sessionStorage.setItem('sz_cache_downloads', JSON.stringify(d)); } catch {}
              }
            })
            .catch(() => null)
        );
      }

      // 4. Diagnostics tab: needs diagnostics + dbStatus
      if (tab === 'diagnostics') {
        calls.push(
          fetch('/api/admin/diagnostics', { headers })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (d) {
                setDiagnostics(d);
                try { sessionStorage.setItem('sz_cache_diagnostics', JSON.stringify(d)); } catch {}
              }
            })
            .catch(() => null)
        );
      }

      // 5. Engine tab: needs dbStatus + settings
      if (tab === 'engine' || tab === 'engine-database') {
        calls.push(
          fetch('/api/admin/database-status', { headers })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (d) {
                setDbStatus(d);
                try { sessionStorage.setItem('sz_cache_dbStatus', JSON.stringify(d)); } catch {}
              }
            })
            .catch(() => null)
        );
        calls.push(
          fetch('/api/admin/settings', { headers })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (d) {
                setSettings(d);
                try { sessionStorage.setItem('sz_cache_settings', JSON.stringify(d)); } catch {}
              }
            })
            .catch(() => null)
        );
      }

      // 6. Financials tab: needs settings + stats
      if (tab === 'financials') {
        calls.push(
          fetch('/api/admin/settings', { headers })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (d) {
                setSettings(d);
                try { sessionStorage.setItem('sz_cache_settings', JSON.stringify(d)); } catch {}
              }
            })
            .catch(() => null)
        );
      }

      // 7. Feedback tab (and pre-fetch on overview): needs fresh feedback list AND stats & downloads
      if (tab === 'feedback' || tab === 'overview') {
        calls.push(
          fetch('/api/feedback', { headers })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (d && Array.isArray(d.feedbacks)) {
                setFeedbacks(d.feedbacks);
                try { sessionStorage.setItem('sz_cache_feedbacks', JSON.stringify(d.feedbacks)); } catch {}
              }
            })
            .catch(() => null)
        );
        calls.push(
          fetch('/api/admin/stats', { headers })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (d) {
                setStats(d);
                try { sessionStorage.setItem('sz_cache_stats', JSON.stringify(d)); } catch {}
              }
            })
            .catch(() => null)
        );
        calls.push(
          fetch('/api/admin/downloads', { headers })
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (Array.isArray(d)) {
                setDownloads(d);
                try { sessionStorage.setItem('sz_cache_downloads', JSON.stringify(d)); } catch {}
              }
            })
            .catch(() => null)
        );
      }

      await Promise.all(calls);
      setLoadedTabs(prev => new Set([...prev, tab]));
    } catch (err) {
      console.error('Error loading tab:', tab, err);
    } finally {
      setLoading(false);
    }
  }

  // User Actions
  async function handleToggleVip(userId, userEmail, desiredPlan) {
    if (!userId && !userEmail) return;
    const targetId = userId || 'by-email';
    setActionLoadingId(`vip-${userId || userEmail}`);
    try {
      const res = await fetch(`/api/admin/users/${targetId}/vip`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          email: userEmail,
          plan: desiredPlan === 'revoke' ? 'free' : (desiredPlan || 'monthly'),
          action: desiredPlan === 'revoke' ? 'revoke' : 'grant'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUsers(prev => {
          const updated = prev.map(u =>
            (u._id === userId || (userEmail && u.email?.toLowerCase() === userEmail.toLowerCase()))
              ? { ...u, isVip: data.isVip, vipPlan: data.vipPlan, vipExpiresAt: data.vipExpiresAt }
              : u
          );
          try { sessionStorage.setItem('sz_cache_users', JSON.stringify(updated)); } catch {}
          return updated;
        });
        setSaveMessage(`User VIP ${data.isVip ? 'granted (' + (data.vipPlan || 'active') + ')' : 'revoked'}.`);
        setTimeout(() => setSaveMessage(''), 3000);
        loadTabData('users', true);
      } else {
        alert('Action failed: ' + (data.error || 'Server error.'));
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleToggleActive(userId, userEmail) {
    if (!userId && !userEmail) return;
    const targetId = userId || 'by-email';
    setActionLoadingId(`active-${userId || userEmail}`);
    try {
      const res = await fetch(`/api/admin/users/${targetId}/active`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email: userEmail })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUsers(prev => {
          const updated = prev.map(u =>
            (u._id === userId || (userEmail && u.email?.toLowerCase() === userEmail.toLowerCase()))
              ? { ...u, isActive: data.isActive }
              : u
          );
          try { sessionStorage.setItem('sz_cache_users', JSON.stringify(updated)); } catch {}
          return updated;
        });
        setSaveMessage('User status updated.');
        setTimeout(() => setSaveMessage(''), 3000);
        loadTabData('users', true);
      } else {
        alert('Action failed: ' + (data.error || 'Server error.'));
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleInspectUser(userId, userEmail) {
    if (!userId && !userEmail) return;
    try {
      const res = await fetch(`/api/admin/users/${userId || userEmail}/details`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setSelectedUserInspector(await res.json());
      } else {
        alert('Could not fetch user download history.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleDeleteUser(userId, userEmail) {
    if (!window.confirm(`Are you sure you want to permanently delete account '${userEmail || userId}'?`)) return;
    setActionLoadingId(`del-${userId || userEmail}`);
    try {
      const res = await fetch(`/api/admin/users/${userId || 'by-email'}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email: userEmail })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUsers(prev => {
          const updated = prev.filter(u => u._id !== userId && (!userEmail || u.email?.toLowerCase() !== userEmail.toLowerCase()));
          try { sessionStorage.setItem('sz_cache_users', JSON.stringify(updated)); } catch {}
          return updated;
        });
        setSaveMessage('Account removed from database.');
        setTimeout(() => setSaveMessage(''), 3000);
        loadTabData('users', true);
      } else {
        alert(data.error || 'Failed to delete user.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  }

  // Download Actions
  async function handleCleanStaleDownloads() {
    if (!window.confirm('Reconcile and mark all stuck/orphaned downloading tasks as cancelled?')) return;
    try {
      const res = await fetch('/api/admin/downloads/clean-stale', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMessage(`Cleaned ${data.reconciledCount || 0} orphaned download sessions.`);
        setTimeout(() => setSaveMessage(''), 4000);
        loadTabData('downloads', true);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleDeleteDownloadRecord(id) {
    if (!window.confirm('Remove this download audit record?')) return;
    try {
      const res = await fetch(`/api/admin/downloads/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setDownloads(prev => prev.filter((d) => d._id !== id));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleDeletePlaylist(ids, playlistTitle) {
    if (!ids || ids.length === 0) return;
    if (!window.confirm(`Permanently remove all ${ids.length} records for "${playlistTitle || 'this playlist'}"?`)) return;
    try {
      const res = await fetch('/api/admin/downloads/bulk-delete', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ids })
      });
      if (res.ok) {
        setDownloads(prev => prev.filter((d) => !ids.includes(d._id)));
        setSaveMessage(`Removed ${ids.length} records for playlist.`);
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Failed to remove playlist records.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleDeleteFeedback(id) {
    if (!window.confirm('Are you sure you want to delete this feedback record?')) return;
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setFeedbacks(prev => {
          const updated = prev.filter(f => f._id !== id);
          try { sessionStorage.setItem('sz_cache_feedbacks', JSON.stringify(updated)); } catch {}
          return updated;
        });
        setSaveMessage('Feedback record deleted.');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        alert('Failed to delete feedback record.');
      }
    } catch (err) {
      alert('Error deleting feedback: ' + err.message);
    }
  }

  // Database Sync & Settings
  async function handleSyncDatabases() {
    try {
      const res = await fetch('/api/admin/sync-databases', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMessage(data.message || 'Databases synced successfully.');
        setTimeout(() => setSaveMessage(''), 4000);
        loadTabData('engine', true);
      }
    } catch (err) {
      alert('Sync error: ' + err.message);
    }
  }

  async function handleSaveSettings(e) {
    if (e && e.preventDefault) e.preventDefault();
    setSaveMessage('');

    // 1. Validation for release version and URL
    if (settings.latestAppVersion && !/^\d+\.\d+\.\d+$/.test(settings.latestAppVersion.trim())) {
      alert('Validation Error: Latest App Version must be in format x.y.z (e.g. 2.5.1)');
      return;
    }

    if (settings.appDownloadUrl && settings.appDownloadUrl.trim().length > 0) {
      const url = settings.appDownloadUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert('Validation Error: Setup Download URL must start with https:// or http://');
        return;
      }
    }

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSaveMessage('Engine parameters saved and synchronized across fleet!');
        showAdminToast('Engine configuration saved to MongoDB & live across all apps!');
        setTimeout(() => setSaveMessage(''), 5000);
      } else {
        const data = await res.json().catch(() => ({}));
        const errMsg = 'Error saving settings: ' + (data.error || 'Server error');
        setSaveMessage(errMsg);
        alert(errMsg);
      }
    } catch (err) {
      setSaveMessage('Error: ' + err.message);
      alert('Network error: ' + err.message);
    }
  }

  function showAdminToast(text) {
    let toast = document.getElementById('adminFloatingToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'adminFloatingToast';
      toast.style.cssText = 'position: fixed; top: 24px; right: 24px; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(16, 185, 129, 0.6); color: #34d399; padding: 14px 24px; border-radius: 12px; font-size: 14px; font-weight: 700; box-shadow: 0 12px 36px rgba(0,0,0,0.8), 0 0 20px rgba(16, 185, 129, 0.3); z-index: 999999; display: flex; align-items: center; gap: 10px; backdrop-filter: blur(12px); animation: fadeIn 0.3s ease;';
      document.body.appendChild(toast);
    }
    toast.innerHTML = text;
    toast.style.display = 'flex';
    setTimeout(() => {
      if (toast) toast.style.display = 'none';
    }, 4500);
  }

  // Authentication Guard: Ensure only signed-in administrators can access
  if (!effectiveUser && !activeToken) {
    return (
      <div style={{ maxWidth: '460px', margin: '90px auto', padding: '38px 30px', background: '#090d16', border: '1px solid #1a2333', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', textAlign: 'center', color: '#f8fafc' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.25)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', margin: '0 auto 16px auto' }}>
          <IconLock size={30} color="#38bdf8" />
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>Administrator Sign In Required</h2>
        <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: '0 0 24px 0', lineHeight: 1.5 }}>You must be signed in with an Administrator account to view the SaveZonix Control Panel.
        </p>

        <button
          onClick={onOpenAuth}
          style={{ width: '100%', padding: '12px 20px', background: 'linear-gradient(135deg, #0284c7, #38bdf8)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14.5px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(2, 132, 199, 0.35)', transition: 'all 0.2s ease' }}
        >Sign In to Your Account
        </button>

        <div style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid #1a2333', paddingTop: '16px' }}>
          <button
            onClick={onBack || (() => onNavigate ? onNavigate('/') : window.location.href = '/')}
            style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            &larr; Return to Public Website
          </button>
        </div>
      </div>
    );
  }

  if (effectiveUser && !isAdmin) {
    return (
      <div style={{ maxWidth: '480px', margin: '90px auto', padding: '38px 30px', background: '#090d16', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', textAlign: 'center', color: '#f8fafc' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', margin: '0 auto 16px auto' }}>
          <IconAlertCircle size={30} color="#f87171" />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>Access Denied</h2>
        <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: 1.5 }}>Signed in as <strong style={{ color: '#fff' }}>{effectiveUser.email}</strong>.<br />This account does not have Administrator privileges.
        </p>

        <button
          onClick={onOpenAuth}
          style={{ width: '100%', padding: '11px 20px', background: '#131b2c', border: '1px solid #1e293b', borderRadius: '10px', color: '#38bdf8', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '12px' }}
        >Switch to Administrator Account
        </button>

        <div style={{ marginTop: '16px', textAlign: 'center', borderTop: '1px solid #1a2333', paddingTop: '16px' }}>
          <button
            onClick={onBack || (() => onNavigate ? onNavigate('/') : window.location.href = '/')}
            style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            &larr; Return to Public Website
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 20px', minHeight: '85vh', color: '#f8fafc' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>SaveZonix Fleet Console
            </h1>
            <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
              {effectiveUser ? `Signed in as ${effectiveUser.name || effectiveUser.email}` : 'Operational'}
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>R&amp;D platform telemetry, user fleets, stream diagnostics, and real-time AI CDN concurrency advisor.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => loadTabData(activeTab, true, activeToken)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '8px', color: '#cbd5e1', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}
          >
            <IconRefresh size={13} color="#94a3b8" spinning={loading} />Refresh
          </button>
          <button
            onClick={onBack || (() => onNavigate ? onNavigate('/') : window.location.href = '/')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '8px', color: '#cbd5e1', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}
          >
            <IconExternal size={13} color="#94a3b8" />Website
          </button>
          <button
            onClick={handleAdminLogout}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', color: '#f87171', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
          >
            <IconLogOut size={13} color="#f87171" />Sign Out
          </button>
        </div>
      </div>

      {/* 7 Segmented Navigation Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#060a12', padding: '4px', borderRadius: '10px', border: '1px solid #1a2333', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { id: 'overview', label: 'Overview', icon: IconActivity },
          { id: 'financials', label: 'Financials & VIP', icon: IconCreditCard },
          { id: 'users', label: `Users (${users.length || stats?.totalUsers || 0})`, icon: IconUsers },
          { id: 'downloads', label: `Downloads (${downloads.length || stats?.totalDownloads || 0})`, icon: IconDownload },
          { id: 'feedback', label: `Feedbacks (${Array.isArray(feedbacks) ? feedbacks.length : 0})`, icon: IconMessageSquare },
          { id: 'ai-cdn-advisor', label: 'AI CDN Advisor', icon: IconCpu },
          { id: 'diagnostics', label: 'Diagnostics', icon: IconAlertCircle },
          { id: 'security', label: 'Security & Anti-Spam', icon: IconLock },
          { id: 'engine-database', label: 'Engine & Database', icon: IconSliders }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 15px',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? '#131b2c' : 'transparent',
                color: isActive ? '#38bdf8' : '#64748b',
                fontWeight: isActive ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={14} color={isActive ? '#38bdf8' : '#64748b'} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* High-Tech Cyber Fleet Sync Loader */}
      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          padding: '10px 18px',
          background: 'linear-gradient(90deg, rgba(2, 132, 199, 0.12), rgba(16, 185, 129, 0.12))',
          border: '1px solid rgba(56, 189, 248, 0.28)',
          borderRadius: '10px',
          marginBottom: '20px',
          boxShadow: '0 4px 20px rgba(56, 189, 248, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Spinning Cyber Orb */}
            <div style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              border: '2px solid rgba(56, 189, 248, 0.25)',
              borderTopColor: '#38bdf8',
              borderRightColor: '#10b981',
              animation: 'spin 0.75s linear infinite'
            }} />
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#f8fafc', letterSpacing: '0.2px' }}>Synchronizing SaveZonix Cloud Fleet Telemetry...
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>Cloud API Active
            </span>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#34d399',
              boxShadow: '0 0 8px #34d399',
              animation: 'pulse 1.2s infinite'
            }} />
          </div>
        </div>
      )}

      {/* Global Feedback Banner */}
      {saveMessage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: '#34d399', marginBottom: '20px', fontSize: '13px', fontWeight: 500 }}>
          <IconCheck size={14} color="#34d399" />
          {saveMessage}
        </div>
      )}

      {/* 1. Overview Tab with Error Guard */}
      {activeTab === 'overview' && (
        <AdminErrorBoundary moduleName="System Overview & Telemetry">
          <OverviewTab
            stats={stats}
            downloads={downloads}
            feedbacks={feedbacks}
            onNavigateToDownloads={() => handleTabClick('downloads')}
            onNavigateToFeedback={() => handleTabClick('feedback')}
          />
        </AdminErrorBoundary>
      )}

      {/* Financials & VIP Sales Tab with Error Guard */}
      {activeTab === 'financials' && (
        <AdminErrorBoundary moduleName="Financials & VIP Transactions">
          <FinancialsTab
            settings={settings}
            setSettings={setSettings}
            onSaveSettings={handleSaveSettings}
          />
        </AdminErrorBoundary>
      )}

      {/* 2. Users Tab with Error Guard */}
      {activeTab === 'users' && (
        <AdminErrorBoundary moduleName="User Fleet Management">
          <UsersTab
            users={users}
            freeDailyLimit={settings?.freeDailyLimit}
            actionLoadingId={actionLoadingId}
            onToggleVip={handleToggleVip}
            onToggleActive={handleToggleActive}
            onInspectUser={handleInspectUser}
            onDeleteUser={handleDeleteUser}
          />
        </AdminErrorBoundary>
      )}

      {/* 3. Downloads Tab with Error Guard */}
      {activeTab === 'downloads' && (
        <AdminErrorBoundary moduleName="Downloads History & Audit">
          <DownloadsTab
            downloads={downloads}
            onCleanStaleDownloads={handleCleanStaleDownloads}
            onDeleteDownloadRecord={handleDeleteDownloadRecord}
            onDeletePlaylist={handleDeletePlaylist}
            onRefresh={() => loadTabData('downloads', true)}
          />
        </AdminErrorBoundary>
      )}

      {/* Feedbacks & Uninstalls Tab with Error Guard */}
      {activeTab === 'feedback' && (
        <AdminErrorBoundary moduleName="User & Uninstall Feedbacks">
          <FeedbackTab
            feedbacks={feedbacks}
            stats={stats}
            downloads={downloads}
            onDeleteFeedback={handleDeleteFeedback}
            onRefresh={() => loadTabData('feedback', true)}
            loading={loading}
          />
        </AdminErrorBoundary>
      )}

      {/* 4. AI Advisor & CDN Prober Tab with Error Guard */}
      {(activeTab === 'ai-cdn-advisor' || activeTab === 'ai-advisor') && (
        <AdminErrorBoundary moduleName="AI CDN Prober & Concurrency Advisor">
          <AiAdvisorTab adminToken={activeToken} />
        </AdminErrorBoundary>
      )}

      {/* 5. Diagnostics Tab with Error Guard */}
      {activeTab === 'diagnostics' && (
        <AdminErrorBoundary moduleName="Stream Diagnostics & Exceptions">
          <DiagnosticsTab diagnostics={diagnostics} />
        </AdminErrorBoundary>
      )}

      {/* 6. Security Tab with Error Guard */}
      {activeTab === 'security' && (
        <AdminErrorBoundary moduleName="Security & Anti-Spam Sandbox">
          <SecurityTab adminToken={activeToken} />
        </AdminErrorBoundary>
      )}

      {/* 7. Engine & Database Tab with Error Guard */}
      {(activeTab === 'engine-database' || activeTab === 'engine') && (
        <AdminErrorBoundary moduleName="Engine Parameters & Database Mirroring">
          <EngineTab
            dbStatus={dbStatus}
            settings={settings}
            setSettings={setSettings}
            onSyncDatabases={handleSyncDatabases}
            onSaveSettings={handleSaveSettings}
          />
        </AdminErrorBoundary>
      )}

      {/* User Activity Inspector Modal */}
      {selectedUserInspector && (
        <UserDetailsModal
          inspectorData={selectedUserInspector}
          onClose={() => setSelectedUserInspector(null)}
        />
      )}
    </div>
  );
}
