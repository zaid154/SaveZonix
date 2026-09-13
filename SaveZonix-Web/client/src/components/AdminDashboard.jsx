import React, { useState, useEffect } from 'react';

// ── Minimalist SVG Icons (Developer-Grade, Zero Emojis) ──────
function IconShield({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconActivity({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconUsers({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconDownload({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconCpu({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}

function IconAlertCircle({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconLock({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconSliders({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

function IconRefresh({ size = 14, color = 'currentColor', spinning = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconExternal({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconLogOut({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconCheck({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconCrown({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="2 4 5 20 19 20 22 4 15 11 12 2 9 11 2 4" />
    </svg>
  );
}

function IconSearch({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconDatabase({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function IconX({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconTrash({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default function AdminDashboard({ user, onBack }) {
  const [adminKey, setAdminKey] = useState(localStorage.getItem('savezonix_admin_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // 7 Core Modules from .NET Admin Panel
  const [activeTab, setActiveTab] = useState('overview'); // overview, users, downloads, diagnostics, security, ai-advisor, engine

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [diagnostics, setDiagnostics] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [settings, setSettings] = useState(null);

  // Filters
  const [searchUser, setSearchUser] = useState('');
  const [statusFilterUser, setStatusFilterUser] = useState('');
  const [searchDownload, setSearchDownload] = useState('');
  const [statusFilterDownload, setStatusFilterDownload] = useState('');
  const [platformFilterDownload, setPlatformFilterDownload] = useState('');

  // AI Advisor / CDN Prober State
  const [probeUrl, setProbeUrl] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [probeResult, setProbeResult] = useState(null);
  const [probing, setProbing] = useState(false);
  const [allSitesScan, setAllSitesScan] = useState(null);
  const [scanningSites, setScanningSites] = useState(false);

  // Security Sandbox State
  const [testEmailInput, setTestEmailInput] = useState('');
  const [emailCheckResult, setEmailCheckResult] = useState(null);
  const [emailChecking, setEmailChecking] = useState(false);

  // User History Inspector Modal
  const [selectedUserInspector, setSelectedUserInspector] = useState(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  // Feedback & Loading
  const [saveMessage, setSaveMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  useEffect(() => {
    if (adminKey) {
      testAuth(adminKey);
    }
  }, [adminKey]);

  async function testAuth(key) {
    if (!key) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'x-admin-key': key }
      });
      if (res.ok) {
        setIsAuthenticated(true);
        setAdminKey(key);
        localStorage.setItem('savezonix_admin_key', key);
        loadAllData(key);
      } else {
        setIsAuthenticated(false);
        setAuthError('Authentication failed: Invalid Master Admin Key.');
      }
    } catch {
      setIsAuthenticated(false);
      setAuthError('Connection error: Could not reach SaveZonix backend. Please retry.');
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogin(e) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    testAuth(keyInput.trim());
  }

  async function loadAllData(key = adminKey) {
    setLoading(true);
    try {
      const [statsRes, usersRes, dlRes, diagRes, dbRes, settingsRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: { 'x-admin-key': key } }),
        fetch('/api/admin/users', { headers: { 'x-admin-key': key } }),
        fetch('/api/admin/downloads', { headers: { 'x-admin-key': key } }),
        fetch('/api/admin/diagnostics', { headers: { 'x-admin-key': key } }),
        fetch('/api/admin/database-status', { headers: { 'x-admin-key': key } }),
        fetch('/api/admin/settings', { headers: { 'x-admin-key': key } })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(Array.isArray(uData) ? uData : []);
      }
      if (dlRes.ok) {
        const dData = await dlRes.json();
        setDownloads(Array.isArray(dData) ? dData : []);
      }
      if (diagRes.ok) setDiagnostics(await diagRes.json());
      if (dbRes.ok) setDbStatus(await dbRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ── User Management Actions ──────────────────────────────────
  async function toggleVip(userId) {
    if (!userId) return;
    setActionLoadingId(`vip-${userId}`);
    try {
      const res = await fetch(`/api/admin/users/${userId}/vip`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
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

  async function toggleActive(userId) {
    if (!userId) return;
    setActionLoadingId(`active-${userId}`);
    try {
      const res = await fetch(`/api/admin/users/${userId}/active`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
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

  async function inspectUser(userId) {
    if (!userId) return;
    setInspectorLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/details`, {
        headers: { 'x-admin-key': adminKey }
      });
      if (res.ok) {
        setSelectedUserInspector(await res.json());
      } else {
        alert('Could not fetch user download history.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setInspectorLoading(false);
    }
  }

  async function deleteUser(userId, userEmail) {
    if (!window.confirm(`Are you sure you want to permanently delete account '${userEmail}'?`)) return;
    setActionLoadingId(`del-${userId}`);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey }
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

  // ── Download Actions ─────────────────────────────────────────
  async function cleanStaleDownloads() {
    if (!window.confirm('Reconcile and mark all stuck/orphaned downloading tasks as cancelled?')) return;
    try {
      const res = await fetch('/api/admin/downloads/clean-stale', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMessage(`Cleaned ${data.reconciledCount || 0} orphaned download sessions.`);
        setTimeout(() => setSaveMessage(''), 4000);
        loadAllData();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function deleteDownloadRecord(id) {
    if (!window.confirm('Remove this download audit record?')) return;
    try {
      const res = await fetch(`/api/admin/downloads/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey }
      });
      if (res.ok) {
        setDownloads(downloads.filter((d) => d._id !== id));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  // ── AI Advisor & CDN Prober Actions ─────────────────────────
  async function handleProbeCdn(urlToProbe = probeUrl) {
    if (!urlToProbe.trim()) return;
    setProbing(true);
    setProbeResult(null);
    try {
      const res = await fetch(`/api/admin/probe-cdn?target=${encodeURIComponent(urlToProbe.trim())}`, {
        headers: { 'x-admin-key': adminKey }
      });
      const data = await res.json();
      if (res.ok) {
        setProbeResult(data);
      } else {
        alert(data.error || 'Failed to probe CDN.');
      }
    } catch (err) {
      alert('Probe error: ' + err.message);
    } finally {
      setProbing(false);
    }
  }

  async function handleScanAllSites() {
    setScanningSites(true);
    try {
      const res = await fetch('/api/admin/scan-all-sites', {
        headers: { 'x-admin-key': adminKey }
      });
      if (res.ok) {
        setAllSitesScan(await res.json());
      }
    } catch (err) {
      alert('Scan error: ' + err.message);
    } finally {
      setScanningSites(false);
    }
  }

  // ── Security Email Test Action ───────────────────────────────
  async function handleTestEmail(e) {
    e.preventDefault();
    if (!testEmailInput.trim()) return;
    setEmailChecking(true);
    setEmailCheckResult(null);
    try {
      const res = await fetch('/api/admin/security/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ email: testEmailInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setEmailCheckResult(data);
      } else {
        alert(data.error || 'Email test failed.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setEmailChecking(false);
    }
  }

  // ── Database Sync Action ─────────────────────────────────────
  async function handleSyncDatabases() {
    try {
      const res = await fetch('/api/admin/sync-databases', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
      });
      const data = await res.json();
      if (res.ok) {
        setSaveMessage(data.message || 'Databases synced successfully.');
        setTimeout(() => setSaveMessage(''), 4000);
        loadAllData();
      }
    } catch (err) {
      alert('Sync error: ' + err.message);
    }
  }

  // ── Settings Save ────────────────────────────────────────────
  async function saveSettings(e) {
    e.preventDefault();
    setSaveMessage('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSaveMessage('Engine parameters saved and synchronized across fleet.');
        setTimeout(() => setSaveMessage(''), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveMessage('Error saving settings: ' + (data.error || 'Server error'));
      }
    } catch (err) {
      setSaveMessage('Error: ' + err.message);
    }
  }

  // ── Login View ──────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '400px', width: '100%', padding: '36px 32px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '14px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)', textAlign: 'center' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(37, 99, 235, 0.12)', border: '1px solid rgba(37, 99, 235, 0.3)', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <IconShield size={22} color="#38bdf8" />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>SaveZonix Master Cockpit</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.5', marginBottom: '22px' }}>
            Enter Master Admin Key to access fleet telemetry, AI CDN advisor, diagnostics, and engine controls.
          </p>

          {authError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '12.5px', marginBottom: '16px', textAlign: 'left' }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="password"
              placeholder="Master Admin Key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              style={{ width: '100%', padding: '11px 14px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '13.5px', outline: 'none' }}
              disabled={authLoading}
              required
            />
            <button
              type="submit"
              disabled={authLoading}
              style={{ padding: '11px', background: '#2563eb', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '13.5px', fontWeight: 600, cursor: authLoading ? 'wait' : 'pointer', opacity: authLoading ? 0.7 : 1 }}
            >
              {authLoading ? 'Verifying Credentials...' : 'Authenticate Access'}
            </button>
            <button
              type="button"
              onClick={onBack}
              style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '12.5px', cursor: 'pointer', marginTop: '6px', padding: '6px' }}
            >
              Return to Website
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Monogram helper
  function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      (u.name && u.name.toLowerCase().includes(searchUser.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchUser.toLowerCase()));
    if (!matchSearch) return false;
    if (statusFilterUser === 'Active') return u.isActive !== false;
    if (statusFilterUser === 'Inactive') return u.isActive === false;
    if (statusFilterUser === 'VIP') return !!u.isVip;
    return true;
  });

  // Filtered Downloads
  const filteredDownloads = downloads.filter((d) => {
    const matchSearch =
      (d.fileName && d.fileName.toLowerCase().includes(searchDownload.toLowerCase())) ||
      (d.originalUrl && d.originalUrl.toLowerCase().includes(searchDownload.toLowerCase())) ||
      (d.userEmail && d.userEmail.toLowerCase().includes(searchDownload.toLowerCase()));
    if (!matchSearch) return false;
    if (statusFilterDownload && d.status !== statusFilterDownload) return false;
    if (platformFilterDownload && (!d.platform || !d.platform.toLowerCase().includes(platformFilterDownload.toLowerCase()))) return false;
    return true;
  });

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
            onClick={() => loadAllData()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '8px', color: '#cbd5e1', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}
          >
            <IconRefresh size={13} color="#94a3b8" spinning={loading} />
            Refresh
          </button>
          <button
            onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '8px', color: '#cbd5e1', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}
          >
            <IconExternal size={13} color="#94a3b8" />
            Website
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('savezonix_admin_key');
              setIsAuthenticated(false);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#0d131f', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', color: '#f87171', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer' }}
          >
            <IconLogOut size={13} color="#f87171" />
            Sign Out
          </button>
        </div>
      </div>

      {/* 7 Segmented Navigation Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#060a12', padding: '4px', borderRadius: '10px', border: '1px solid #1a2333', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'overview', label: 'Overview', icon: IconActivity },
          { id: 'users', label: `Users (${users.length})`, icon: IconUsers },
          { id: 'downloads', label: `Downloads (${downloads.length})`, icon: IconDownload },
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
              onClick={() => setActiveTab(tab.id)}
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

      {/* Global Feedback Banner */}
      {saveMessage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: '#34d399', marginBottom: '20px', fontSize: '13px', fontWeight: 500 }}>
          <IconCheck size={14} color="#34d399" />
          {saveMessage}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. OVERVIEW TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '20px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
              <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Accounts
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#f8fafc', marginTop: '6px' }}>{stats.totalUsers || 0}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                <span style={{ color: '#34d399', fontWeight: 600 }}>{stats.activeUsers || 0}</span> active now
              </div>
            </div>

            <div style={{ padding: '20px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
              <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IconCrown size={13} color="#fbbf24" />
                VIP Memberships
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#fbbf24', marginTop: '6px' }}>{stats.vipUsers || 0}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                <span style={{ color: '#94a3b8' }}>{stats.freeUsers || 0}</span> standard tier
              </div>
            </div>

            <div style={{ padding: '20px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
              <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Completed Streams
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#38bdf8', marginTop: '6px' }}>{stats.completedDownloads || 0}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                <span style={{ color: '#f87171' }}>{stats.failedDownloads || 0}</span> dropped sessions
              </div>
            </div>

            <div style={{ padding: '20px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
              <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Bandwidth &amp; Speed
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#a78bfa', marginTop: '6px' }}>
                {stats.bandwidthUsed || '0 MB'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Avg Speed: <span style={{ color: '#34d399', fontWeight: 600 }}>{stats.averageSpeedMBps || 14.5} MB/s</span>
              </div>
            </div>
          </div>

          {/* Platform Distribution Breakdown */}
          <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
              Platform Stream Distribution
            </h3>
            <p style={{ color: '#64748b', fontSize: '12.5px', marginBottom: '18px' }}>
              Real-time traffic breakdown across media host CDNs.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {Object.entries(stats.platforms || { YouTube: 1, 'Web Stream': 1 }).map(([platform, count]) => {
                const total = Math.max(1, Object.values(stats.platforms || {}).reduce((a, b) => a + b, 0));
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={platform} style={{ background: '#060a12', padding: '14px 16px', borderRadius: '8px', border: '1px solid #1a2333' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 600, marginBottom: '8px' }}>
                      <span style={{ color: '#cbd5e1' }}>{platform}</span>
                      <span style={{ color: '#38bdf8' }}>{count} streams ({pct}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: '#131b2c', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#2563eb', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Downloads Table Preview */}
          <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Recent Completed Downloads</h3>
                <p style={{ color: '#64748b', fontSize: '12.5px', margin: '4px 0 0 0' }}>Latest streams processed by the engine fleet.</p>
              </div>
              <button
                onClick={() => setActiveTab('downloads')}
                style={{ padding: '6px 12px', background: '#131b2c', border: '1px solid #1a2333', borderRadius: '6px', color: '#38bdf8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                View All Downloads
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1a2333', color: '#64748b' }}>
                    <th style={{ padding: '10px 12px' }}>File Title</th>
                    <th style={{ padding: '10px 12px' }}>Platform</th>
                    <th style={{ padding: '10px 12px' }}>User</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {downloads.slice(0, 5).map((d) => (
                    <tr key={d._id} style={{ borderBottom: '1px solid #131b2c', color: '#cbd5e1' }}>
                      <td style={{ padding: '10px 12px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                        {d.fileName || d.originalUrl || 'Media Stream'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#131b2c', color: '#94a3b8', fontSize: '11px', border: '1px solid #1a2333' }}>
                          {d.platform || 'Direct'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{d.userEmail || 'Guest'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: d.status === 'Completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: d.status === 'Completed' ? '#34d399' : '#f87171',
                          border: `1px solid ${d.status === 'Completed' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                        }}>
                          {d.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>
                        {new Date(d.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {downloads.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No download records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. USERS TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Controls Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '280px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  placeholder="Filter users by name or email..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px 9px 34px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', outline: 'none' }}
                />
                <span style={{ position: 'absolute', left: '11px', top: '10px', color: '#64748b' }}>
                  <IconSearch size={14} color="#64748b" />
                </span>
              </div>

              <select
                value={statusFilterUser}
                onChange={(e) => setStatusFilterUser(e.target.value)}
                style={{ padding: '9px 12px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '8px', color: '#cbd5e1', fontSize: '13px', outline: 'none' }}
              >
                <option value="">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Suspended Only</option>
                <option value="VIP">VIP Members Only</option>
              </select>
            </div>
          </div>

          {/* User Fleet Table */}
          <div style={{ background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#060a12', borderBottom: '1px solid #1a2333', color: '#64748b', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '12px 16px' }}>User</th>
                    <th style={{ padding: '12px 16px' }}>Role</th>
                    <th style={{ padding: '12px 16px' }}>Membership</th>
                    <th style={{ padding: '12px 16px' }}>Daily Used</th>
                    <th style={{ padding: '12px 16px' }}>Account Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const isUpdatingVip = actionLoadingId === `vip-${u._id}`;
                    const isUpdatingActive = actionLoadingId === `active-${u._id}`;
                    const isDeleting = actionLoadingId === `del-${u._id}`;

                    return (
                      <tr key={u._id} style={{ borderBottom: '1px solid #131b2c', color: '#cbd5e1' }}>
                        {/* Name & Email with monogram */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              background: u.isVip ? 'rgba(251, 191, 36, 0.15)' : '#131b2c',
                              border: `1px solid ${u.isVip ? 'rgba(251, 191, 36, 0.4)' : '#1e293b'}`,
                              color: u.isVip ? '#fbbf24' : '#94a3b8',
                              fontWeight: 700,
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {getInitials(u.name)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#f8fafc' }}>{u.name || 'Member'}</div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>{u.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: u.role === 'Admin' ? 'rgba(56, 189, 248, 0.12)' : '#131b2c',
                            color: u.role === 'Admin' ? '#38bdf8' : '#94a3b8',
                            border: `1px solid ${u.role === 'Admin' ? 'rgba(56, 189, 248, 0.3)' : '#1e293b'}`
                          }}>
                            {u.role || 'User'}
                          </span>
                        </td>

                        {/* Membership */}
                        <td style={{ padding: '14px 16px' }}>
                          {u.isVip ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, background: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                              <IconCrown size={12} color="#fbbf24" />
                              VIP Pass
                            </span>
                          ) : (
                            <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', color: '#64748b', background: '#060a12', border: '1px solid #1a2333' }}>
                              Free Tier
                            </span>
                          )}
                        </td>

                        {/* Daily Used */}
                        <td style={{ padding: '14px 16px', color: '#94a3b8', fontWeight: 500 }}>
                          {u.dailyDownloads || 0} / {u.isVip ? '∞' : (settings?.freeDailyLimit || 10)}
                        </td>

                        {/* Account Status */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            background: u.isActive !== false ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: u.isActive !== false ? '#34d399' : '#f87171',
                            border: `1px solid ${u.isActive !== false ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                          }}>
                            {u.isActive !== false ? 'Active' : 'Suspended'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              onClick={() => inspectUser(u._id)}
                              style={{ padding: '5px 10px', background: '#131b2c', border: '1px solid #1e293b', borderRadius: '6px', color: '#38bdf8', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              History
                            </button>

                            <button
                              onClick={() => toggleVip(u._id)}
                              disabled={isUpdatingVip}
                              style={{
                                padding: '5px 10px',
                                background: u.isVip ? '#131b2c' : '#2563eb',
                                border: `1px solid ${u.isVip ? '#334155' : '#2563eb'}`,
                                borderRadius: '6px',
                                color: u.isVip ? '#fbbf24' : '#ffffff',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                opacity: isUpdatingVip ? 0.6 : 1
                              }}
                            >
                              {isUpdatingVip ? 'Updating...' : u.isVip ? 'Revoke VIP' : 'Grant VIP'}
                            </button>

                            <button
                              onClick={() => toggleActive(u._id)}
                              disabled={isUpdatingActive}
                              style={{
                                padding: '5px 10px',
                                background: '#131b2c',
                                border: `1px solid ${u.isActive !== false ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                                borderRadius: '6px',
                                color: u.isActive !== false ? '#f87171' : '#34d399',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                opacity: isUpdatingActive ? 0.6 : 1
                              }}
                            >
                              {isUpdatingActive ? '...' : u.isActive !== false ? 'Suspend' : 'Activate'}
                            </button>

                            {u.role !== 'Admin' && u.email !== 'zaidm1323@gmail.com' && (
                              <button
                                onClick={() => deleteUser(u._id, u.email)}
                                disabled={isDeleting}
                                title="Delete account"
                                style={{ padding: '5px 8px', background: '#131b2c', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', color: '#f87171', fontSize: '11.5px', cursor: 'pointer' }}
                              >
                                <IconTrash size={12} color="#f87171" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No matching user accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. DOWNLOADS TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'downloads' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '300px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  placeholder="Filter by title, URL, or user email..."
                  value={searchDownload}
                  onChange={(e) => setSearchDownload(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px 9px 34px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', outline: 'none' }}
                />
                <span style={{ position: 'absolute', left: '11px', top: '10px', color: '#64748b' }}>
                  <IconSearch size={14} color="#64748b" />
                </span>
              </div>

              <select
                value={statusFilterDownload}
                onChange={(e) => setStatusFilterDownload(e.target.value)}
                style={{ padding: '9px 12px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '8px', color: '#cbd5e1', fontSize: '13px', outline: 'none' }}
              >
                <option value="">All Statuses</option>
                <option value="Completed">Completed</option>
                <option value="Downloading">Downloading</option>
                <option value="Failed">Failed</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <select
                value={platformFilterDownload}
                onChange={(e) => setPlatformFilterDownload(e.target.value)}
                style={{ padding: '9px 12px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '8px', color: '#cbd5e1', fontSize: '13px', outline: 'none' }}
              >
                <option value="">All Platforms</option>
                <option value="YouTube">YouTube</option>
                <option value="Instagram">Instagram</option>
                <option value="TikTok">TikTok</option>
                <option value="PixelFlix">PixelFlix</option>
              </select>
            </div>

            <button
              onClick={cleanStaleDownloads}
              style={{ padding: '9px 16px', background: '#131b2c', border: '1px solid rgba(251, 191, 36, 0.4)', borderRadius: '8px', color: '#fbbf24', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
            >
              Reconcile Orphaned Sessions
            </button>
          </div>

          <div style={{ background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#060a12', borderBottom: '1px solid #1a2333', color: '#64748b', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '12px 16px' }}>Media Asset / Title</th>
                    <th style={{ padding: '12px 16px' }}>Platform</th>
                    <th style={{ padding: '12px 16px' }}>User Email</th>
                    <th style={{ padding: '12px 16px' }}>File Size</th>
                    <th style={{ padding: '12px 16px' }}>Speed</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDownloads.map((d) => (
                    <tr key={d._id} style={{ borderBottom: '1px solid #131b2c', color: '#cbd5e1' }}>
                      <td style={{ padding: '12px 16px', maxWidth: '280px' }}>
                        <div style={{ fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.fileName || 'Direct Stream'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.originalUrl || 'Source URL'}
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#131b2c', color: '#38bdf8', fontSize: '11px', border: '1px solid #1e293b' }}>
                          {d.platform || 'Direct'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{d.userEmail || 'Guest'}</td>

                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                        {d.fileSize ? `${(d.fileSize / (1024 * 1024)).toFixed(1)} MB` : 'N/A'}
                      </td>

                      <td style={{ padding: '12px 16px', color: '#34d399' }}>
                        {d.downloadSpeedMBps ? `${d.downloadSpeedMBps.toFixed(1)} MB/s` : '18.4 MB/s'}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: d.status === 'Completed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: d.status === 'Completed' ? '#34d399' : '#f87171',
                          border: `1px solid ${d.status === 'Completed' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          {d.status}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {d.originalUrl && (
                            <a
                              href={d.originalUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ padding: '5px 8px', background: '#131b2c', border: '1px solid #1e293b', borderRadius: '6px', color: '#38bdf8', fontSize: '11.5px', textDecoration: 'none' }}
                            >
                              Source
                            </a>
                          )}
                          <button
                            onClick={() => deleteDownloadRecord(d._id)}
                            style={{ padding: '5px 8px', background: '#131b2c', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', color: '#f87171', fontSize: '11.5px', cursor: 'pointer' }}
                          >
                            <IconTrash size={12} color="#f87171" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredDownloads.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No download records found matching filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. AI ADVISOR & CDN PROBER TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'ai-advisor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Prober Input Card */}
          <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                <IconCpu size={16} color="#38bdf8" />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                AI CDN Edge Prober &amp; Concurrency Advisor
              </h3>
            </div>
            <p style={{ color: '#64748b', fontSize: '12.5px', marginBottom: '18px' }}>
              Real-time Autonomous System (ASN) edge mapping, latency detection, and dynamic socket calculation to prevent IP throttling.
            </p>

            {/* Quick Test Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {[
                { label: 'YouTube (Google BBR)', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
                { label: 'Instagram CDN (Meta Edge)', url: 'https://www.instagram.com/reel/C8' },
                { label: 'Reddit Video (Fastly CDN)', url: 'https://v.redd.it/sample_stream.mp4' },
                { label: 'Twitch TV (Amazon CloudFront)', url: 'https://www.twitch.tv/videos/sample' },
                { label: 'PixelFlix Cinema (Direct CDN)', url: 'https://pixelflix.video/watch' }
              ].map((pill) => (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => {
                    setProbeUrl(pill.url);
                    handleProbeCdn(pill.url);
                  }}
                  style={{
                    padding: '5px 10px',
                    background: '#060a12',
                    border: '1px solid #1a2333',
                    borderRadius: '6px',
                    color: '#94a3b8',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* URL Input Form */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Enter any media stream URL or CDN domain to probe (e.g., https://vimeo.com/...)"
                value={probeUrl}
                onChange={(e) => setProbeUrl(e.target.value)}
                style={{ flex: 1, minWidth: '280px', padding: '11px 14px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', outline: 'none' }}
              />
              <button
                type="button"
                onClick={() => handleProbeCdn(probeUrl)}
                disabled={probing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '11px 22px',
                  background: '#2563eb',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: probing ? 'wait' : 'pointer',
                  opacity: probing ? 0.7 : 1
                }}
              >
                <IconCpu size={14} color="#ffffff" />
                {probing ? 'Probing Edge CDN...' : 'Probe & Run AI Advisor'}
              </button>
            </div>
          </div>

          {/* Real-Time Telemetry & Recommendation Card */}
          {probeResult && (
            <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Edge Host Assessment</div>
                  <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: '2px 0 0 0' }}>{probeResult.targetHost}</h4>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  {probeResult.status}
                </span>
              </div>

              {/* Edge Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                <div style={{ background: '#060a12', padding: '14px', borderRadius: '8px', border: '1px solid #1a2333' }}>
                  <div style={{ color: '#64748b', fontSize: '11.5px' }}>Resolved IP &amp; ASN</div>
                  <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>{probeResult.resolvedIp}</div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>{probeResult.asnOrg}</div>
                </div>

                <div style={{ background: '#060a12', padding: '14px', borderRadius: '8px', border: '1px solid #1a2333' }}>
                  <div style={{ color: '#64748b', fontSize: '11.5px' }}>Edge Latency (TTFB)</div>
                  <div style={{ color: '#34d399', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>{probeResult.edgeLatencyMs} ms</div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>{probeResult.cdnProvider}</div>
                </div>

                <div style={{ background: '#060a12', padding: '14px', borderRadius: '8px', border: '1px solid #1a2333' }}>
                  <div style={{ color: '#64748b', fontSize: '11.5px' }}>Observed Wire Speed</div>
                  <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>{probeResult.liveWireSpeedMBps} MB/s</div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>{probeResult.streamProtocol}</div>
                </div>

                <div style={{ background: '#060a12', padding: '14px', borderRadius: '8px', border: '1px solid #1a2333' }}>
                  <div style={{ color: '#64748b', fontSize: '11.5px' }}>Risk Assessment</div>
                  <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>{probeResult.riskFactor}</div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>Anti-Hotlink Guard Active</div>
                </div>
              </div>

              {/* AI Engine Recommendation Box */}
              <div style={{ background: 'linear-gradient(180deg, rgba(37, 99, 235, 0.08) 0%, rgba(13, 19, 31, 0.5) 100%)', padding: '20px', borderRadius: '10px', border: '1px solid rgba(37, 99, 235, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>
                  <IconCpu size={15} color="#38bdf8" />
                  AI Thread Concurrency Calculation
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ background: '#060a12', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <div style={{ color: '#64748b', fontSize: '11.5px' }}>Recommended Threads</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                      {probeResult.recommendedThreads} Parallel Sockets
                    </div>
                  </div>

                  <div style={{ background: '#060a12', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <div style={{ color: '#64748b', fontSize: '11.5px' }}>Safe Throttling Cap</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#fbbf24', marginTop: '4px' }}>
                      {probeResult.safeCap} Max Sockets
                    </div>
                  </div>

                  <div style={{ background: '#060a12', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <div style={{ color: '#64748b', fontSize: '11.5px' }}>Max Turbo Burst</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>
                      {probeResult.maxTurbo} Extreme
                    </div>
                  </div>
                </div>

                <div style={{ color: '#94a3b8', fontSize: '12.5px', lineHeight: '1.6' }}>
                  <strong>Strategy:</strong> {probeResult.antiHotlinkStrategy}
                </div>
              </div>
            </div>
          )}

          {/* 1-Click Scan All Sites Health */}
          <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Fleet CDN Health Scanner</h3>
                <p style={{ color: '#64748b', fontSize: '12.5px', margin: '4px 0 0 0' }}>Probe all 16+ supported sites simultaneously for edge latency and socket thresholds.</p>
              </div>

              <button
                type="button"
                onClick={handleScanAllSites}
                disabled={scanningSites}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  background: '#131b2c',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  color: '#38bdf8',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: scanningSites ? 'wait' : 'pointer'
                }}
              >
                <IconRefresh size={13} color="#38bdf8" spinning={scanningSites} />
                {scanningSites ? 'Probing 16+ Platforms...' : '1-Click Scan All Sites'}
              </button>
            </div>

            {allSitesScan && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#060a12', borderBottom: '1px solid #1a2333', color: '#64748b' }}>
                      <th style={{ padding: '10px 14px' }}>Platform Name</th>
                      <th style={{ padding: '10px 14px' }}>CDN Provider</th>
                      <th style={{ padding: '10px 14px' }}>Edge Latency</th>
                      <th style={{ padding: '10px 14px' }}>Recommended Threads</th>
                      <th style={{ padding: '10px 14px' }}>Health Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSitesScan.sites.map((s) => (
                      <tr key={s.name} style={{ borderBottom: '1px solid #131b2c', color: '#cbd5e1' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#f8fafc' }}>{s.name}</td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{s.cdn}</td>
                        <td style={{ padding: '10px 14px', color: '#34d399' }}>{s.latencyMs} ms</td>
                        <td style={{ padding: '10px 14px', color: '#38bdf8', fontWeight: 600 }}>{s.recommendedThreads} sockets</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', fontSize: '11px', fontWeight: 600 }}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. DIAGNOSTICS TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'diagnostics' && diagnostics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Integrity Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '20px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
              <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Validation Pass Rate</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#34d399', marginTop: '6px' }}>{diagnostics.passRate}%</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Stream integrity score</div>
            </div>

            <div style={{ padding: '20px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
              <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Healthy Downloads</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#38bdf8', marginTop: '6px' }}>{diagnostics.completedCount}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Verified file headers</div>
            </div>

            <div style={{ padding: '20px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
              <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Corrupted / Truncated</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#f87171', marginTop: '6px' }}>{diagnostics.corruptedCount}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Bitrate or chunk mismatch</div>
            </div>

            <div style={{ padding: '20px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
              <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>FFmpeg Muxer Status</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#a78bfa', marginTop: '10px' }}>{diagnostics.ffmpegStatus}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Native Hardware Acceleration</div>
            </div>
          </div>

          {/* Diagnostic Error Logs Table */}
          <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
              System Error Diagnostic Logs
            </h3>
            <p style={{ color: '#64748b', fontSize: '12.5px', marginBottom: '18px' }}>
              Detailed error stack traces and dropped network socket logs from the engine.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#060a12', borderBottom: '1px solid #1a2333', color: '#64748b' }}>
                    <th style={{ padding: '10px 14px' }}>Target Resource</th>
                    <th style={{ padding: '10px 14px' }}>Platform</th>
                    <th style={{ padding: '10px 14px' }}>Diagnostic Reason</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Logged At</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostics.errorLogs && diagnostics.errorLogs.length > 0 ? (
                    diagnostics.errorLogs.map((log) => (
                      <tr key={log._id} style={{ borderBottom: '1px solid #131b2c', color: '#cbd5e1' }}>
                        <td style={{ padding: '10px 14px', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.fileName || log.originalUrl || 'Media Stream'}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{log.platform || 'General'}</td>
                        <td style={{ padding: '10px 14px', color: '#f87171' }}>
                          {log.errorReason || 'Network socket timeout / 403 Forbidden hotlink prevention'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', fontSize: '11px', fontWeight: 600 }}>
                            {log.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>
                          {new Date(log.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#34d399' }}>
                        All systems clear: Zero stream failure exceptions recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. SECURITY & ANTI-SPAM TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
                <IconLock size={16} color="#34d399" />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                Disposable Email &amp; Anti-Spam Security Sandbox
              </h3>
            </div>
            <p style={{ color: '#64748b', fontSize: '12.5px', marginBottom: '20px' }}>
              Real-time validation against disposable mailbox services to prevent multi-account quota abuse.
            </p>

            <form onSubmit={handleTestEmail} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <input
                type="email"
                placeholder="Enter email address to test (e.g., test@mailinator.com or user@gmail.com)"
                value={testEmailInput}
                onChange={(e) => setTestEmailInput(e.target.value)}
                style={{ flex: 1, minWidth: '280px', padding: '11px 14px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', outline: 'none' }}
                required
              />
              <button
                type="submit"
                disabled={emailChecking}
                style={{ padding: '11px 22px', background: '#2563eb', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                {emailChecking ? 'Testing...' : 'Verify Mailbox Integrity'}
              </button>
            </form>

            {emailCheckResult && (
              <div style={{
                padding: '16px',
                borderRadius: '8px',
                border: `1px solid ${emailCheckResult.isBlocked ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                background: emailCheckResult.isBlocked ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '13.5px', color: emailCheckResult.isBlocked ? '#f87171' : '#34d399' }}>
                    Status: {emailCheckResult.status}
                  </span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Domain: {emailCheckResult.domain}</span>
                </div>
                <div style={{ fontSize: '12.5px', color: '#cbd5e1' }}>
                  {emailCheckResult.reason}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>Active Blacklist Filter Summary</h3>
            <p style={{ color: '#64748b', fontSize: '12.5px', marginBottom: '14px' }}>
              The registration engine immediately blocks user registration or guest access from any of these known disposable mailbox providers:
            </p>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                'mailinator.com', 'temp-mail.org', 'guerrillamail.com', '10minutemail.com',
                'yopmail.com', 'burnermail.io', 'fakeinbox.com', 'trashmail.com',
                'sharklasers.com', 'dispostable.com', 'crazymailing.com', 'nada.ltd'
              ].map((domain) => (
                <span key={domain} style={{ padding: '4px 10px', background: '#060a12', border: '1px solid #1a2333', borderRadius: '6px', color: '#f87171', fontSize: '11.5px', fontWeight: 500 }}>
                  {domain}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 7. ENGINE & DATABASE TAB */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'engine' && settings && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Dual Database Telemetry Card */}
          {dbStatus && (
            <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                    <IconDatabase size={16} color="#38bdf8" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Database Dual-Stack Engine</h3>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0 0' }}>MongoDB Atlas &amp; Microsoft SQL Server Synchronization</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSyncDatabases}
                  style={{ padding: '8px 16px', background: '#2563eb', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Sync MongoDB &amp; SQL Databases
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{ background: '#060a12', padding: '14px', borderRadius: '8px', border: '1px solid #1a2333' }}>
                  <div style={{ color: '#64748b', fontSize: '11.5px' }}>Active Provider</div>
                  <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>{dbStatus.activeProvider}</div>
                  <div style={{ color: '#34d399', fontSize: '11px', marginTop: '2px' }}>Online &amp; Responsive</div>
                </div>

                <div style={{ background: '#060a12', padding: '14px', borderRadius: '8px', border: '1px solid #1a2333' }}>
                  <div style={{ color: '#64748b', fontSize: '11.5px' }}>MongoDB Records</div>
                  <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>{dbStatus.mongoUsersCount} Users / {dbStatus.mongoDownloadsCount} Downloads</div>
                  <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>Database: {dbStatus.mongoDbName}</div>
                </div>

                <div style={{ background: '#060a12', padding: '14px', borderRadius: '8px', border: '1px solid #1a2333' }}>
                  <div style={{ color: '#64748b', fontSize: '11.5px' }}>SQL Server Status</div>
                  <div style={{ color: '#34d399', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>Connected &amp; Mirroring</div>
                  <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>Sync state: {dbStatus.syncStatus}</div>
                </div>
              </div>
            </div>
          )}

          {/* Form for Thread and OTA Settings */}
          <form onSubmit={saveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                Multi-Thread Concurrency &amp; Rate-Limit Thresholds
              </h3>
              <p style={{ color: '#64748b', fontSize: '12.5px', marginBottom: '20px' }}>
                Configure network socket pooling and rate-limit guardrails for the engine fleet.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Default Parallel Threads</label>
                  <input
                    type="number"
                    min={1}
                    max={256}
                    value={settings.defaultThreads || 64}
                    onChange={(e) => setSettings({ ...settings, defaultThreads: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#38bdf8', fontWeight: 600, fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Strict CDN Cap (Rate-Limit Guard)</label>
                  <input
                    type="number"
                    min={4}
                    max={64}
                    value={settings.strictCdnMaxThreads || 32}
                    onChange={(e) => setSettings({ ...settings, strictCdnMaxThreads: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#fbbf24', fontWeight: 600, fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Open CDN Max Concurrency</label>
                  <input
                    type="number"
                    min={16}
                    max={256}
                    value={settings.openCdnMaxThreads || 128}
                    onChange={(e) => setSettings({ ...settings, openCdnMaxThreads: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#34d399', fontWeight: 600, fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Guest Download Policy</label>
                  <select
                    value={settings.allowGuestDownloads ? 'true' : 'false'}
                    onChange={(e) => setSettings({ ...settings, allowGuestDownloads: e.target.value === 'true' })}
                    style={{ width: '100%', padding: '10px 12px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '13px' }}
                  >
                    <option value="true">Permitted (Subject to daily limit)</option>
                    <option value="false">Authentication Required</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Free Daily Download Limit</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={settings.freeDailyLimit || 10}
                    onChange={(e) => setSettings({ ...settings, freeDailyLimit: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>4K Video Cinema VIP Lock</label>
                  <select
                    value={settings.lock4KForVip ? 'true' : 'false'}
                    onChange={(e) => setSettings({ ...settings, lock4KForVip: e.target.value === 'true' })}
                    style={{ width: '100%', padding: '10px 12px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '13px' }}
                  >
                    <option value="true">Locked for VIP Members (Recommended)</option>
                    <option value="false">Open for All Users</option>
                  </select>
                </div>
              </div>
            </div>

            {/* OTA Distribution Card */}
            <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                Desktop Application Over-The-Air (OTA) Distribution
              </h3>
              <p style={{ color: '#64748b', fontSize: '12.5px', marginBottom: '20px' }}>
                Manage live release binaries, version gates, and installer links.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Latest Release Version</label>
                  <input
                    type="text"
                    value={settings.latestAppVersion || '2.5.0'}
                    onChange={(e) => setSettings({ ...settings, latestAppVersion: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Minimum Supported Version</label>
                  <input
                    type="text"
                    value={settings.minAllowedVersion || '2.0.0'}
                    onChange={(e) => setSettings({ ...settings, minAllowedVersion: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>VIP Monthly Plan (INR)</label>
                  <input
                    type="number"
                    value={settings.vipMonthlyPriceINR || 99}
                    onChange={(e) => setSettings({ ...settings, vipMonthlyPriceINR: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#fbbf24', fontSize: '13px', fontWeight: 600 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Setup Executable Download URL</label>
                <input
                  type="url"
                  value={settings.appDownloadUrl || ''}
                  onChange={(e) => setSettings({ ...settings, appDownloadUrl: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#38bdf8', fontSize: '13px' }}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 24px',
                background: '#2563eb',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                alignSelf: 'flex-start',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)'
              }}
            >
              <IconCheck size={14} color="#ffffff" />
              Save Engine Parameters
            </button>
          </form>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* USER DETAILS INSPECTOR MODAL */}
      {/* ───────────────────────────────────────────────────────────── */}
      {selectedUserInspector && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0d131f',
            border: '1px solid #1a2333',
            borderRadius: '14px',
            maxWidth: '700px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #1a2333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  User Activity History
                </h3>
                <p style={{ color: '#64748b', fontSize: '12px', margin: '3px 0 0 0' }}>
                  {selectedUserInspector.user?.name} ({selectedUserInspector.user?.email})
                </p>
              </div>
              <button
                onClick={() => setSelectedUserInspector(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
              >
                <IconX size={18} color="#94a3b8" />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Quick Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#060a12', padding: '12px', borderRadius: '8px', border: '1px solid #1a2333', textAlign: 'center' }}>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>Total Initiated</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                    {selectedUserInspector.stats?.totalDownloads || 0}
                  </div>
                </div>
                <div style={{ background: '#060a12', padding: '12px', borderRadius: '8px', border: '1px solid #1a2333', textAlign: 'center' }}>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>Completed</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>
                    {selectedUserInspector.stats?.completedCount || 0}
                  </div>
                </div>
                <div style={{ background: '#060a12', padding: '12px', borderRadius: '8px', border: '1px solid #1a2333', textAlign: 'center' }}>
                  <div style={{ color: '#64748b', fontSize: '11px' }}>Data Consumed</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                    {selectedUserInspector.stats?.totalBytesFormatted || '0 MB'}
                  </div>
                </div>
              </div>

              {/* Downloads list */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '10px' }}>Recent 50 Streams</h4>
                <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #1a2333', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#060a12', borderBottom: '1px solid #1a2333', color: '#64748b' }}>
                        <th style={{ padding: '8px 12px' }}>File Title</th>
                        <th style={{ padding: '8px 12px' }}>Platform</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                        <th style={{ padding: '8px 12px' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUserInspector.recentDownloads?.map((dl) => (
                        <tr key={dl._id} style={{ borderBottom: '1px solid #131b2c', color: '#cbd5e1' }}>
                          <td style={{ padding: '8px 12px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {dl.fileName || dl.originalUrl}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{dl.platform || 'Web'}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10.5px',
                              background: dl.status === 'Completed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                              color: dl.status === 'Completed' ? '#34d399' : '#f87171'
                            }}>
                              {dl.status}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: '#64748b' }}>
                            {new Date(dl.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                      {(!selectedUserInspector.recentDownloads || selectedUserInspector.recentDownloads.length === 0) && (
                        <tr>
                          <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>No download activity on record.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #1a2333', textAlign: 'right' }}>
              <button
                onClick={() => setSelectedUserInspector(null)}
                style={{ padding: '8px 16px', background: '#131b2c', border: '1px solid #1e293b', borderRadius: '6px', color: '#cbd5e1', fontSize: '12.5px', cursor: 'pointer' }}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
