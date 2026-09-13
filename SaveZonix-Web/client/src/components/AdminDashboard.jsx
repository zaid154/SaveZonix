import React, { useState, useEffect } from 'react';

export default function AdminDashboard({ user, onBack }) {
  const [adminKey, setAdminKey] = useState(localStorage.getItem('savezonix_admin_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, users, downloads, updates, engine
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [settings, setSettings] = useState(null);
  const [searchUser, setSearchUser] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Check auth
  useEffect(() => {
    if (adminKey) {
      testAuth(adminKey);
    }
  }, [adminKey]);

  async function testAuth(key) {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'x-admin-key': key }
      });
      if (res.ok) {
        setIsAuthenticated(true);
        localStorage.setItem('savezonix_admin_key', key);
        loadAllData(key);
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }

  function handleLogin(e) {
    e.preventDefault();
    testAuth(keyInput.trim());
  }

  async function loadAllData(key = adminKey) {
    setLoading(true);
    try {
      const [statsRes, usersRes, dlRes, settingsRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: { 'x-admin-key': key } }),
        fetch('/api/admin/users', { headers: { 'x-admin-key': key } }),
        fetch('/api/admin/downloads', { headers: { 'x-admin-key': key } }),
        fetch('/api/admin/settings', { headers: { 'x-admin-key': key } })
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (dlRes.ok) setDownloads(await dlRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleVip(userId) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/vip`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(users.map((u) => (u._id === userId ? { ...u, isVip: data.isVip } : u)));
        loadAllData();
      }
    } catch (err) {
      alert('Failed to update VIP: ' + err.message);
    }
  }

  async function toggleActive(userId) {
    try {
      const res = await fetch(`/api/admin/users/${userId}/active`, {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(users.map((u) => (u._id === userId ? { ...u, isActive: data.isActive } : u)));
      }
    } catch (err) {
      alert('Failed to toggle status: ' + err.message);
    }
  }

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
        setSaveMessage('✅ Settings saved successfully & synced with 50,000+ desktop apps!');
        setTimeout(() => setSaveMessage(''), 4000);
      }
    } catch (err) {
      setSaveMessage('❌ Error: ' + err.message);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-login-wrapper" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass-card" style={{ maxWidth: '420px', width: '100%', padding: '36px', textAlign: 'center', background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🛡️</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>SaveZonix Master Admin</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '24px' }}>Enter your Master Admin Key to access global user controls and app update rollouts.</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="password"
              placeholder="Admin Master Key (e.g. savezonix_admin_2026)"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              style={{ padding: '12px 16px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '14px' }}
              required
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '12px', fontSize: '14px', fontWeight: 700 }}>
              Authenticate Admin Access 🚀
            </button>
            <button type="button" onClick={onBack} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '13px', cursor: 'pointer', marginTop: '8px' }}>
              ← Return to Main Website
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container" style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc' }}>⚡ SaveZonix Central Admin Cockpit</h1>
            <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.2)', color: '#34d399', border: '1px solid rgba(16,185,129,0.4)', padding: '3px 10px', borderRadius: '12px', fontWeight: 700 }}>
              LIVE CLOUD SYNC
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
            Controlling 50,000+ Active Desktop Apps, VIP Memberships, Engine Limits &amp; Over-The-Air Updates
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => loadAllData()} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '12.5px' }}>
            🔄 Refresh Data
          </button>
          <button onClick={onBack} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '12.5px' }}>
            ← View Website
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('savezonix_admin_key');
              setIsAuthenticated(false);
            }}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '12.5px', color: '#f87171' }}
          >
            Logout Admin
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1e293b', paddingBottom: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'overview', label: '📊 Overview & Analytics' },
          { id: 'users', label: '👥 User & VIP Manager' },
          { id: 'downloads', label: '📥 Downloads Log' },
          { id: 'updates', label: '🚀 App Updates & Monetization' },
          { id: 'engine', label: '⚡ Engine & CDN Settings' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: activeTab === tab.id ? '1px solid #38bdf8' : '1px solid transparent',
              background: activeTab === tab.id ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {saveMessage && (
        <div style={{ padding: '12px 18px', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', borderRadius: '8px', color: '#34d399', marginBottom: '20px', fontWeight: 600, fontSize: '13.5px' }}>
          {saveMessage}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: OVERVIEW */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="glass-card" style={{ padding: '20px', background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: '12px' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Total Registered Users</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>{stats.totalUsers}</div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>Active cloud accounts</div>
            </div>

            <div className="glass-card" style={{ padding: '20px', background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: '12px' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>💎 Active VIP Subscribers</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', marginTop: '6px' }}>{stats.vipUsers}</div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>Paying unlimited members</div>
            </div>

            <div className="glass-card" style={{ padding: '20px', background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: '12px' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Total Downloads Recorded</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>{stats.totalDownloads}</div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>Today: {stats.todayDownloads} downloads</div>
            </div>

            <div className="glass-card" style={{ padding: '20px', background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: '12px' }}>
              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Current Live App Version</span>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#f43f5e', marginTop: '6px' }}>v{stats.latestAppVersion}</div>
              <div style={{ fontSize: '11.5px', color: stats.forceUpdate ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                {stats.forceUpdate ? '🚨 Force Update Active' : '✅ Grace Period Active'}
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px', background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '14px' }}>⚡ Quick Fleet Controls</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={() => setActiveTab('updates')} className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '13px' }}>
                🚀 Push New Desktop Version
              </button>
              <button onClick={() => setActiveTab('users')} className="btn btn-secondary" style={{ padding: '10px 20px', fontSize: '13px' }}>
                💎 Manage VIP Subscriptions
              </button>
              <button onClick={() => setActiveTab('engine')} className="btn btn-secondary" style={{ padding: '10px 20px', fontSize: '13px' }}>
                ⚡ Adjust Parallel Download Speeds
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: USERS & VIP */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="glass-card" style={{ padding: '24px', background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>👥 User Fleet Management ({users.length} Users)</h3>
              <p style={{ color: '#94a3b8', fontSize: '12.5px' }}>Grant VIP passes, set download access, and monitor user activity.</p>
            </div>
            <input
              type="text"
              placeholder="🔍 Search user by name or email..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              style={{ padding: '8px 14px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', width: '280px' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: '11.5px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 10px' }}>User</th>
                  <th style={{ padding: '12px 10px' }}>Role</th>
                  <th style={{ padding: '12px 10px' }}>Membership</th>
                  <th style={{ padding: '12px 10px' }}>Daily Used</th>
                  <th style={{ padding: '12px 10px' }}>Status</th>
                  <th style={{ padding: '12px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users
                  .filter((u) => u.name.toLowerCase().includes(searchUser.toLowerCase()) || u.email.toLowerCase().includes(searchUser.toLowerCase()))
                  .map((u) => (
                    <tr key={u._id} style={{ borderBottom: '1px solid #0f172a' }}>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{u.name}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>{u.email}</div>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: u.role === 'Admin' ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.05)', color: u.role === 'Admin' ? '#fb7185' : '#94a3b8' }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 700, background: u.isVip ? 'rgba(245,158,11,0.2)' : 'rgba(100,116,139,0.2)', color: u.isVip ? '#fbbf24' : '#94a3b8' }}>
                          {u.isVip ? '💎 VIP Pro' : 'Free Tier'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', color: '#cbd5e1' }}>
                        {u.dailyDownloads} / {settings?.freeDailyLimit || 10}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{ color: u.isActive ? '#34d399' : '#f87171', fontSize: '12px', fontWeight: 700 }}>
                          {u.isActive ? '🟢 Active' : '🔴 Suspended'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        <button
                          onClick={() => toggleVip(u._id)}
                          style={{ marginRight: '8px', padding: '4px 10px', fontSize: '11.5px', borderRadius: '6px', cursor: 'pointer', background: u.isVip ? 'rgba(245,158,11,0.2)' : 'rgba(56,189,248,0.2)', border: '1px solid #38bdf8', color: '#38bdf8' }}
                        >
                          {u.isVip ? 'Revoke VIP' : 'Make VIP 💎'}
                        </button>
                        <button
                          onClick={() => toggleActive(u._id)}
                          style={{ padding: '4px 10px', fontSize: '11.5px', borderRadius: '6px', cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                        >
                          {u.isActive ? 'Suspend' : 'Unban'}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: DOWNLOADS LOG */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'downloads' && (
        <div className="glass-card" style={{ padding: '24px', background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: '12px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>📥 Live Download Logs</h3>
          <p style={{ color: '#94a3b8', fontSize: '12.5px', marginBottom: '18px' }}>Recent video streams processed by active desktop installations.</p>

          {downloads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>No downloads recorded yet. As users download videos in desktop apps, they appear here live.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: '11.5px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px' }}>File / Stream</th>
                  <th style={{ padding: '10px' }}>Quality</th>
                  <th style={{ padding: '10px' }}>Format</th>
                  <th style={{ padding: '10px' }}>User</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {downloads.map((d) => (
                  <tr key={d._id} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '10px', color: '#f8fafc', fontWeight: 600 }}>{d.fileName}</td>
                    <td style={{ padding: '10px', color: '#38bdf8' }}>{d.quality}</td>
                    <td style={{ padding: '10px', color: '#94a3b8' }}>{d.format.toUpperCase()}</td>
                    <td style={{ padding: '10px', color: '#cbd5e1' }}>{d.userEmail}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ color: d.status === 'Completed' ? '#34d399' : '#f87171', fontWeight: 700 }}>{d.status}</span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#64748b' }}>{new Date(d.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 4: APP UPDATES & MONETIZATION */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'updates' && settings && (
        <form onSubmit={saveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '24px', background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>🚀 Desktop App Over-The-Air Update Controls</h3>
            <p style={{ color: '#94a3b8', fontSize: '12.5px', marginBottom: '20px' }}>
              Changes here instantly broadcast to all 50,000+ active desktop apps upon their next startup check.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>Latest App Version Released</label>
                <input
                  type="text"
                  value={settings.latestAppVersion || ''}
                  onChange={(e) => setSettings({ ...settings, latestAppVersion: e.target.value })}
                  style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#38bdf8', fontWeight: 700 }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>Minimum Allowed Version (Grace Expiry)</label>
                <input
                  type="text"
                  value={settings.minAllowedVersion || ''}
                  onChange={(e) => setSettings({ ...settings, minAllowedVersion: e.target.value })}
                  style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#fbbf24', fontWeight: 700 }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>Force Update Mode</label>
                <select
                  value={settings.forceUpdate ? 'true' : 'false'}
                  onChange={(e) => setSettings({ ...settings, forceUpdate: e.target.value === 'true' })}
                  style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontWeight: 700 }}
                >
                  <option value="false">Optional Notification (Grace Period Active)</option>
                  <option value="true">🚨 Strict Lock (App Blocked Until Updated)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>Setup Installer (.exe) Download URL</label>
              <input
                type="text"
                value={settings.appDownloadUrl || ''}
                onChange={(e) => setSettings({ ...settings, appDownloadUrl: e.target.value })}
                placeholder="https://github.com/zaid154/SaveZonix/releases/latest/download/SaveZonix-Setup.exe"
                style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>Release Notes / Update Changelog</label>
              <textarea
                rows={3}
                value={settings.updateChangelog || ''}
                onChange={(e) => setSettings({ ...settings, updateChangelog: e.target.value })}
                style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
              />
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px', background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>💎 Monetization, Free Tier Quota &amp; VIP Gatekeeper</h3>
            <p style={{ color: '#94a3b8', fontSize: '12.5px', marginBottom: '20px' }}>Control user download limits and upsell to VIP passes.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>Free User Daily Download Limit</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={settings.freeDailyLimit || 10}
                  onChange={(e) => setSettings({ ...settings, freeDailyLimit: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#10b981', fontWeight: 700 }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>Lock 4K / Ultra-HD (VIP Only)</label>
                <select
                  value={settings.lock4KForVip ? 'true' : 'false'}
                  onChange={(e) => setSettings({ ...settings, lock4KForVip: e.target.value === 'true' })}
                  style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontWeight: 700 }}
                >
                  <option value="false">🔓 4K Open for All Free Users</option>
                  <option value="true">🔒 Restrict 4K / 2160p to VIP Subscribers</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>VIP Monthly Price (INR)</label>
                <input
                  type="number"
                  value={settings.vipMonthlyPriceINR || 99}
                  onChange={(e) => setSettings({ ...settings, vipMonthlyPriceINR: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#fbbf24', fontWeight: 700 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>Global In-App Announcement Banner (Optional)</label>
              <input
                type="text"
                value={settings.announcementMessage || ''}
                onChange={(e) => setSettings({ ...settings, announcementMessage: e.target.value })}
                placeholder="e.g. 🎉 Flash Sale: Get Lifetime VIP for ₹199 this week only!"
                style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '15px', fontWeight: 800, alignSelf: 'flex-start' }}>
            💾 Save &amp; Broadcast OTA Update to 50,000 Users
          </button>
        </form>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 5: ENGINE & CDN SETTINGS */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'engine' && settings && (
        <form onSubmit={saveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '24px', background: '#0a0f1d', border: '1px solid #1e293b', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>⚡ Download Engine &amp; Multi-Thread Defaults</h3>
            <p style={{ color: '#94a3b8', fontSize: '12.5px', marginBottom: '20px' }}>
              Calibrate multi-thread concurrency and CDN rate-limit caps across the platform fleet.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>Default Parallel Threads</label>
                <input
                  type="number"
                  min={1}
                  max={256}
                  value={settings.defaultThreads || 64}
                  onChange={(e) => setSettings({ ...settings, defaultThreads: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#38bdf8', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>Strict CDN Max Cap (Ban Prevention)</label>
                <input
                  type="number"
                  min={4}
                  max={64}
                  value={settings.strictCdnMaxThreads || 32}
                  onChange={(e) => setSettings({ ...settings, strictCdnMaxThreads: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#fbbf24', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>Open CDN Max Threads</label>
                <input
                  type="number"
                  min={16}
                  max={256}
                  value={settings.openCdnMaxThreads || 128}
                  onChange={(e) => setSettings({ ...settings, openCdnMaxThreads: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#34d399', fontWeight: 700 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>Allow Guest Downloads</label>
                <select
                  value={settings.allowGuestDownloads ? 'true' : 'false'}
                  onChange={(e) => setSettings({ ...settings, allowGuestDownloads: e.target.value === 'true' })}
                  style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                >
                  <option value="true">Allowed (Subject to guest limit)</option>
                  <option value="false">Require Sign In</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>Guest Daily Limit</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.guestDailyDownloadLimit || 10}
                  onChange={(e) => setSettings({ ...settings, guestDailyDownloadLimit: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px', background: '#030712', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '15px', fontWeight: 800, alignSelf: 'flex-start' }}>
            💾 Save Engine Configuration
          </button>
        </form>
      )}
    </div>
  );
}
