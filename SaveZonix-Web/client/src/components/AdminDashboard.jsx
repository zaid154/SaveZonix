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
  IconCheck
} from './admin/AdminIcons';

import AdminErrorBoundary from './admin/AdminErrorBoundary';
import OverviewTab from './admin/OverviewTab';
import UsersTab from './admin/UsersTab';
import UserDetailsModal from './admin/UserDetailsModal';
import DownloadsTab from './admin/DownloadsTab';
import AiAdvisorTab from './admin/AiAdvisorTab';
import DiagnosticsTab from './admin/DiagnosticsTab';
import SecurityTab from './admin/SecurityTab';
import EngineTab from './admin/EngineTab';

export default function AdminDashboard({ user, currentPath = '/admin/overview', onNavigate, onBack }) {
  const MASTER_ADMIN_KEY = 'savezonix_admin_2026';
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('savezonix_admin_key') || MASTER_ADMIN_KEY);
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('savezonix_admin_token') || '');

  function getTabFromPath(path) {
    if (!path) return 'overview';
    const sub = path.replace(/^\/admin\/?/i, '').toLowerCase().trim();
    const valid = ['overview', 'users', 'downloads', 'ai-advisor', 'diagnostics', 'security', 'engine'];
    if (valid.includes(sub)) return sub;
    if (sub === 'ai_advisor') return 'ai-advisor';
    return 'overview';
  }

  // 7 Core Modules from .NET Admin Panel
  const [activeTab, setActiveTab] = useState(() => getTabFromPath(currentPath));

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [settings, setSettings] = useState(null);

  // Loaded Tabs Cache for 0ms Instant Switching
  const [loadedTabs, setLoadedTabs] = useState(() => new Set());

  // User History Inspector Modal
  const [selectedUserInspector, setSelectedUserInspector] = useState(null);

  // Global Feedback & Loading
  const [saveMessage, setSaveMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  function getAuthHeaders(key = adminKey, token = adminToken) {
    const headers = {};
    if (key) headers['x-admin-key'] = key;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  useEffect(() => {
    const targetTab = getTabFromPath(currentPath);
    setActiveTab(targetTab);
    loadTabData(targetTab, false, adminKey, adminToken);
  }, [currentPath]);

  function handleTabClick(tabId) {
    setActiveTab(tabId);
    if (onNavigate) {
      onNavigate(`/admin/${tabId}`);
    } else {
      window.history.pushState({}, '', `/admin/${tabId}`);
    }
    loadTabData(tabId, false, adminKey, adminToken);
  }

  // High-Speed Lazy Loader: Loads only what is needed for the requested tab and caches in React state
  async function loadTabData(tab = activeTab, force = false, key = adminKey, token = adminToken) {
    if (!force && loadedTabs.has(tab)) {
      return; // 0ms instant transition from cache
    }

    setLoading(true);
    const headers = getAuthHeaders(key, token);

    try {
      const calls = [];

      // 1. Overview tab: needs stats + downloads
      if (tab === 'overview') {
        if (!stats || force) {
          calls.push(
            fetch('/api/admin/stats', { headers })
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d) setStats(d); })
              .catch(() => null)
          );
        }
        if (downloads.length === 0 || force) {
          calls.push(
            fetch('/api/admin/downloads', { headers })
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (Array.isArray(d)) setDownloads(d); })
              .catch(() => null)
          );
        }
      }

      // 2. Users / Security tabs: needs users list + settings
      if (tab === 'users' || tab === 'security') {
        if (users.length === 0 || force) {
          calls.push(
            fetch('/api/admin/users', { headers })
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (Array.isArray(d)) setUsers(d); })
              .catch(() => null)
          );
        }
        if (!settings || force) {
          calls.push(
            fetch('/api/admin/settings', { headers })
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d) setSettings(d); })
              .catch(() => null)
          );
        }
      }

      // 3. Downloads tab: needs downloads list
      if (tab === 'downloads') {
        if (downloads.length === 0 || force) {
          calls.push(
            fetch('/api/admin/downloads', { headers })
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (Array.isArray(d)) setDownloads(d); })
              .catch(() => null)
          );
        }
      }

      // 4. Diagnostics tab: needs diagnostics + dbStatus
      if (tab === 'diagnostics') {
        if (!diagnostics || force) {
          calls.push(
            fetch('/api/admin/diagnostics', { headers })
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d) setDiagnostics(d); })
              .catch(() => null)
          );
        }
      }

      // 5. Engine tab: needs dbStatus + settings
      if (tab === 'engine') {
        if (!dbStatus || force) {
          calls.push(
            fetch('/api/admin/database-status', { headers })
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d) setDbStatus(d); })
              .catch(() => null)
          );
        }
        if (!settings || force) {
          calls.push(
            fetch('/api/admin/settings', { headers })
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d) setSettings(d); })
              .catch(() => null)
          );
        }
      }

      await Promise.all(calls);
      setLoadedTabs(prev => new Set([...prev, tab]));
    } catch (err) {
      console.error('Error loading tab:', tab, err);
    } finally {
      setLoading(false);
    }
  }

  function handleTabClick(tabId) {
    setActiveTab(tabId);
    loadTabData(tabId);
  }

  // User Actions
  async function handleToggleVip(userId) {
    if (!userId) return;
    setActionLoadingId(`vip-${userId}`);
    try {
      const res = await fetch(`/api/admin/users/${userId}/vip`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUsers(users.map((u) => (u._id === userId ? { ...u, isVip: data.isVip } : u)));
        setSaveMessage('User VIP membership updated.');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        alert('Action failed: ' + (data.error || 'Server error.'));
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleToggleActive(userId) {
    if (!userId) return;
    setActionLoadingId(`active-${userId}`);
    try {
      const res = await fetch(`/api/admin/users/${userId}/active`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUsers(users.map((u) => (u._id === userId ? { ...u, isActive: data.isActive } : u)));
        setSaveMessage('User status updated.');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        alert('Action failed: ' + (data.error || 'Server error.'));
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleInspectUser(userId) {
    if (!userId) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/details`, {
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
    if (!window.confirm(`Are you sure you want to permanently delete account '${userEmail}'?`)) return;
    setActionLoadingId(`del-${userId}`);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUsers(users.filter((u) => u._id !== userId));
        setSaveMessage('Account removed from database.');
        setTimeout(() => setSaveMessage(''), 3000);
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
        setDownloads(downloads.filter((d) => d._id !== id));
      }
    } catch (err) {
      alert('Error: ' + err.message);
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
        setSaveMessage('✅ Engine parameters saved and synchronized across fleet!');
        showAdminToast('✅ Engine configuration saved to MongoDB & live across all apps!');
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

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 20px', minHeight: '85vh', color: '#f8fafc' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em', margin: 0 }}>
              SaveZonix Fleet Console
            </h1>
            <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
              Operational
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
            R&amp;D platform telemetry, user fleets, stream diagnostics, and real-time AI CDN concurrency advisor.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => loadTabData(activeTab, true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '8px', color: '#cbd5e1', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}
          >
            <IconRefresh size={13} color="#94a3b8" spinning={loading} />
            Refresh
          </button>
          <button
            onClick={onBack || (() => onNavigate ? onNavigate('/') : window.location.href = '/')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '8px', color: '#cbd5e1', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}
          >
            <IconExternal size={13} color="#94a3b8" />
            Website
          </button>
        </div>
      </div>

      {/* 7 Segmented Navigation Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#060a12', padding: '4px', borderRadius: '10px', border: '1px solid #1a2333', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { id: 'overview', label: 'Overview', icon: IconActivity },
          { id: 'users', label: `Users (${users.length || stats?.totalUsers || 0})`, icon: IconUsers },
          { id: 'downloads', label: `Downloads (${downloads.length || stats?.totalDownloads || 0})`, icon: IconDownload },
          { id: 'ai-advisor', label: 'AI CDN Advisor', icon: IconCpu },
          { id: 'diagnostics', label: 'Diagnostics', icon: IconAlertCircle },
          { id: 'security', label: 'Security & Anti-Spam', icon: IconLock },
          { id: 'engine', label: 'Engine & Database', icon: IconSliders }
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

      {/* Tab Data Fast Loading Indicator */}
      {loading && (
        <div style={{ height: '3px', width: '100%', background: '#0d131f', borderRadius: '3px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ height: '100%', width: '45%', background: 'linear-gradient(90deg, #0284c7, #38bdf8, #10b981)', borderRadius: '3px' }} />
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
            onNavigateToDownloads={() => handleTabClick('downloads')}
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
          />
        </AdminErrorBoundary>
      )}

      {/* 4. AI Advisor & CDN Prober Tab with Error Guard */}
      {activeTab === 'ai-advisor' && (
        <AdminErrorBoundary moduleName="AI CDN Prober & Concurrency Advisor">
          <AiAdvisorTab adminKey={adminKey} />
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
          <SecurityTab adminKey={adminKey} />
        </AdminErrorBoundary>
      )}

      {/* 7. Engine & Database Tab with Error Guard */}
      {activeTab === 'engine' && (
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
