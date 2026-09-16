import React, { useState } from 'react';
import { IconDatabase, IconCheck, IconCpu, IconAlertCircle, IconSliders } from './AdminIcons';

export default function EngineTab({
  dbStatus,
  settings,
  setSettings,
  onSyncDatabases,
  onSaveSettings
}) {
  const [syncingGithub, setSyncingGithub] = useState(false);
  const [githubMsg, setGithubMsg] = useState('');

  if (!settings) {
    return (
      <div style={{ padding: '32px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px', textAlign: 'center', color: '#64748b' }}>
        Loading engine telemetry and database mirrors...
      </div>
    );
  }

  const platformCaps = settings.platformThreadCaps || { youtube: 64, instagram: 24, tiktok: 24, directCdn: 128 };

  async function handleSyncWithGithub() {
    setSyncingGithub(true);
    setGithubMsg('');
    try {
      const adminToken = localStorage.getItem('savezonix_token') || localStorage.getItem('savezonix_admin_token') || '';
      const res = await fetch('/api/admin/sync-github-release', {
        method: 'POST',
        headers: {
          'x-admin-key': 'savezonix_admin_2026',
          ...(adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {})
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSettings(prev => ({
          ...prev,
          latestAppVersion: data.tag || prev.latestAppVersion,
          appDownloadUrl: data.appDownloadUrl || prev.appDownloadUrl,
          updateChangelog: data.updateChangelog || prev.updateChangelog
        }));
        setGithubMsg(`✓ Synced latest release v${data.tag} from GitHub!`);
        setTimeout(() => setGithubMsg(''), 4000);
      } else {
        alert(data.error || 'Failed to fetch release from GitHub.');
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    } finally {
      setSyncingGithub(false);
    }
  }

  return (
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
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Database &amp; Engine Architecture</h3>
                <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0 0' }}>MongoDB Atlas Cloud Cluster &amp; Embedded SQLite Engine</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onSyncDatabases}
              style={{ padding: '8px 16px', background: '#2563eb', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
            >
              Sync &amp; Refresh Fleet State
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#060a12', padding: '14px', borderRadius: '8px', border: '1px solid #1a2333' }}>
              <div style={{ color: '#64748b', fontSize: '11.5px' }}>Active Cloud Provider</div>
              <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>{dbStatus.activeProvider || 'MongoDB Atlas'}</div>
              <div style={{ color: '#34d399', fontSize: '11px', marginTop: '2px' }}>Online &amp; Responsive</div>
            </div>

            <div style={{ background: '#060a12', padding: '14px', borderRadius: '8px', border: '1px solid #1a2333' }}>
              <div style={{ color: '#64748b', fontSize: '11.5px' }}>Cloud Data Records</div>
              <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>{dbStatus.mongoUsersCount ?? 0} Users / {dbStatus.mongoDownloadsCount ?? 0} Downloads</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>Cluster: {dbStatus.mongoDbName || 'SaveZonixDb'}</div>
            </div>

            <div style={{ background: '#060a12', padding: '14px', borderRadius: '8px', border: '1px solid #1a2333' }}>
              <div style={{ color: '#64748b', fontSize: '11.5px' }}>Desktop Client Storage</div>
              <div style={{ color: '#34d399', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>Embedded SQLite (Local)</div>
              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>Zero SQL Server Overhead</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={onSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

        {/* 1. Emergency Maintenance Mode Card */}
        <div style={{
          padding: '24px',
          background: settings.maintenanceMode ? 'rgba(239, 68, 68, 0.05)' : '#0d131f',
          border: `1px solid ${settings.maintenanceMode ? 'rgba(239, 68, 68, 0.4)' : '#1a2333'}`,
          borderRadius: '12px',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: settings.maintenanceMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                border: `1px solid ${settings.maintenanceMode ? 'rgba(239, 68, 68, 0.3)' : '#1e293b'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: settings.maintenanceMode ? '#f87171' : '#94a3b8'
              }}>
                <IconAlertCircle size={18} color={settings.maintenanceMode ? '#f87171' : '#94a3b8'} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Emergency Maintenance &amp; Routine Upgrade Mode
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    background: settings.maintenanceMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.12)',
                    color: settings.maintenanceMode ? '#f87171' : '#34d399',
                    border: `1px solid ${settings.maintenanceMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.3)'}`
                  }}>
                    {settings.maintenanceMode ? 'ACTIVE (CLIENTS LOCKED)' : 'NORMAL OPERATIONAL'}
                  </span>
                </h3>
                <p style={{ color: '#64748b', fontSize: '12px', margin: '3px 0 0 0' }}>
                  Locks client download engines and displays a live countdown timer and update notice to all users.
                </p>
              </div>
            </div>

            {/* Maintenance Master Toggle */}
            <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!settings.maintenanceMode}
                onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute', inset: 0, backgroundColor: settings.maintenanceMode ? '#ef4444' : '#334155',
                borderRadius: '26px', transition: '0.2s', display: 'block'
              }}>
                <span style={{
                  position: 'absolute', height: '20px', width: '20px', left: settings.maintenanceMode ? '25px' : '3px', bottom: '3px',
                  backgroundColor: '#ffffff', borderRadius: '50%', transition: '0.2s', display: 'block'
                }} />
              </span>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                Estimated Duration (Minutes)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={settings.maintenanceDurationMinutes || 15}
                  onChange={(e) => setSettings({ ...settings, maintenanceDurationMinutes: Number(e.target.value) })}
                  style={{ width: '100%', padding: '10px 12px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', fontWeight: 700, fontSize: '13px' }}
                />
                {[15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setSettings({ ...settings, maintenanceDurationMinutes: mins })}
                    style={{
                      padding: '8px 12px',
                      background: settings.maintenanceDurationMinutes === mins ? 'rgba(56, 189, 248, 0.2)' : '#060a12',
                      border: `1px solid ${settings.maintenanceDurationMinutes === mins ? '#38bdf8' : '#1e293b'}`,
                      borderRadius: '8px',
                      color: settings.maintenanceDurationMinutes === mins ? '#38bdf8' : '#94a3b8',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
                Custom Announcement &amp; Maintenance Notice (Shown to Users)
              </label>
              <input
                type="text"
                placeholder="Server routine upgrade in progress. Stream services will resume in 15 minutes."
                value={settings.maintenanceMessage || ''}
                onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '13px' }}
              />
            </div>
          </div>
        </div>

        {/* 2. Bandwidth Speed Throttler (Free vs VIP Speed Limiter) */}
        <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <IconSliders size={16} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                Bandwidth Speed Throttler &amp; User Rate Limiter
              </h3>
              <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0 0' }}>
                Regulate network download speeds per user tier. Motivate upgrades by allocating full gigabit speeds to VIP members.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '18px' }}>
            {/* Free Tier Speed Cap */}
            <div style={{ padding: '16px', background: '#060a12', border: '1px solid #1a2333', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Free Tier Max Download Speed</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: settings.freeMaxSpeedMBps ? '#38bdf8' : '#34d399' }}>
                  {settings.freeMaxSpeedMBps ? `${settings.freeMaxSpeedMBps} MB/s` : '⚡ Uncapped (Full Speed)'}
                </span>
              </div>
              <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 12px 0' }}>
                Limits connection throughput for standard free guest &amp; registered accounts. Set 0 for uncapped.
              </p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {[5, 10, 15, 25, 0].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setSettings({ ...settings, freeMaxSpeedMBps: spd })}
                    style={{
                      padding: '5px 10px',
                      background: (settings.freeMaxSpeedMBps ?? 15) === spd ? '#2563eb' : '#131b2c',
                      border: `1px solid ${(settings.freeMaxSpeedMBps ?? 15) === spd ? '#3b82f6' : '#1e293b'}`,
                      borderRadius: '6px',
                      color: (settings.freeMaxSpeedMBps ?? 15) === spd ? '#ffffff' : '#94a3b8',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {spd === 0 ? 'Uncapped' : `${spd} MB/s`}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0}
                max={500}
                value={settings.freeMaxSpeedMBps ?? 15}
                onChange={(e) => setSettings({ ...settings, freeMaxSpeedMBps: Number(e.target.value) })}
                style={{ width: '100%', padding: '9px 12px', background: '#0d131f', border: '1px solid #1e293b', borderRadius: '8px', color: '#38bdf8', fontWeight: 700, fontSize: '13px' }}
              />
            </div>

            {/* VIP Pro Tier Speed Mode */}
            <div style={{ padding: '16px', background: '#060a12', border: '1px solid #1a2333', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fbbf24' }}>👑 VIP Pro Tier Speed Mode</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: !settings.vipMaxSpeedMBps ? '#34d399' : '#fbbf24' }}>
                  {!settings.vipMaxSpeedMBps ? '⚡ Uncapped Gigabit (Max Speed)' : `${settings.vipMaxSpeedMBps} MB/s`}
                </span>
              </div>
              <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 12px 0' }}>
                By default, VIP Pass holders bypass all ISP &amp; CDN throttles with 64-thread native line speed.
              </p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, vipMaxSpeedMBps: 0 })}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    background: !settings.vipMaxSpeedMBps ? 'rgba(16, 185, 129, 0.15)' : '#131b2c',
                    border: `1px solid ${!settings.vipMaxSpeedMBps ? '#10b981' : '#1e293b'}`,
                    borderRadius: '6px',
                    color: !settings.vipMaxSpeedMBps ? '#34d399' : '#94a3b8',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Gigabit Uncapped (Full)
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, vipMaxSpeedMBps: 50 })}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    background: settings.vipMaxSpeedMBps > 0 ? 'rgba(251, 191, 36, 0.15)' : '#131b2c',
                    border: `1px solid ${settings.vipMaxSpeedMBps > 0 ? '#fbbf24' : '#1e293b'}`,
                    borderRadius: '6px',
                    color: settings.vipMaxSpeedMBps > 0 ? '#fbbf24' : '#94a3b8',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Custom Cap (MB/s)
                </button>
              </div>
              {settings.vipMaxSpeedMBps > 0 && (
                <input
                  type="number"
                  min={10}
                  max={2000}
                  value={settings.vipMaxSpeedMBps || 50}
                  onChange={(e) => setSettings({ ...settings, vipMaxSpeedMBps: Number(e.target.value) })}
                  style={{ width: '100%', padding: '9px 12px', background: '#0d131f', border: '1px solid #1e293b', borderRadius: '8px', color: '#fbbf24', fontWeight: 700, fontSize: '13px' }}
                />
              )}
            </div>
          </div>
        </div>

        {/* 3. Multi-Thread Concurrency & Platform Presets */}
        <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
            Multi-Thread Concurrency &amp; Platform-Specific Presets
          </h3>
          <p style={{ color: '#64748b', fontSize: '12.5px', marginBottom: '20px' }}>
            Configure network socket pooling and rate-limit guardrails per media platform.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
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
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Strict CDN Cap (Anti-Ban Guard)</label>
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

          {/* Platform Specific Sliders */}
          <div style={{ background: '#060a12', padding: '16px', borderRadius: '10px', border: '1px solid #1a2333' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: '12px' }}>
              🎯 Platform Concurrency Presets (Anti-Ban Calibration)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>YouTube HLS/DASH</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>{platformCaps.youtube || 64} Threads</span>
                </label>
                <input
                  type="range"
                  min={8}
                  max={128}
                  step={8}
                  value={platformCaps.youtube || 64}
                  onChange={(e) => setSettings({
                    ...settings,
                    platformThreadCaps: { ...platformCaps, youtube: Number(e.target.value) }
                  })}
                  style={{ width: '100%', accentColor: '#38bdf8' }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>Instagram / FB Edge</span>
                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>{platformCaps.instagram || 24} Threads</span>
                </label>
                <input
                  type="range"
                  min={8}
                  max={48}
                  step={4}
                  value={platformCaps.instagram || 24}
                  onChange={(e) => setSettings({
                    ...settings,
                    platformThreadCaps: { ...platformCaps, instagram: Number(e.target.value) }
                  })}
                  style={{ width: '100%', accentColor: '#fbbf24' }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>TikTok ByteDance CDN</span>
                  <span style={{ color: '#a78bfa', fontWeight: 700 }}>{platformCaps.tiktok || 24} Threads</span>
                </label>
                <input
                  type="range"
                  min={8}
                  max={48}
                  step={4}
                  value={platformCaps.tiktok || 24}
                  onChange={(e) => setSettings({
                    ...settings,
                    platformThreadCaps: { ...platformCaps, tiktok: Number(e.target.value) }
                  })}
                  style={{ width: '100%', accentColor: '#a78bfa' }}
                />
              </div>

              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#94a3b8', marginBottom: '4px' }}>
                  <span>Cloudflare / Direct MP4</span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>{platformCaps.directCdn || 128} Threads</span>
                </label>
                <input
                  type="range"
                  min={16}
                  max={256}
                  step={16}
                  value={platformCaps.directCdn || 128}
                  onChange={(e) => setSettings({
                    ...settings,
                    platformThreadCaps: { ...platformCaps, directCdn: Number(e.target.value) }
                  })}
                  style={{ width: '100%', accentColor: '#34d399' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '20px' }}>
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

        {/* 4. OTA Distribution Card */}
        <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                Desktop Application Over-The-Air (OTA) Distribution
              </h3>
              <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0 0' }}>
                Manage live release binaries, version gates, and auto-update links.
              </p>
            </div>

            {/* 1-Click GitHub Release Sync Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {githubMsg && (
                <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>{githubMsg}</span>
              )}
              <button
                type="button"
                onClick={handleSyncWithGithub}
                disabled={syncingGithub}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: '8px',
                  color: '#38bdf8',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: syncingGithub ? 0.6 : 1
                }}
              >
                {syncingGithub ? 'Syncing...' : '🔄 Sync with GitHub Releases'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>Latest Release Version</label>
              <input
                type="text"
                value={settings.latestAppVersion || '2.5.2'}
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

          <div style={{ marginTop: '16px', padding: '12px 16px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚡ Zero-Click Silent Auto-Update</span>
                <span style={{ fontSize: '10px', padding: '2px 8px', background: settings.silentAutoUpdate !== false ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: settings.silentAutoUpdate !== false ? '#10b981' : '#f87171', borderRadius: '12px', fontWeight: 800 }}>
                  {settings.silentAutoUpdate !== false ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                When active, client desktop apps silently download &amp; apply updates in the background without user wizard prompt.
              </div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.silentAutoUpdate !== false}
                onChange={(e) => setSettings({ ...settings, silentAutoUpdate: e.target.checked })}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute', inset: 0, backgroundColor: settings.silentAutoUpdate !== false ? '#10b981' : '#334155',
                borderRadius: '24px', transition: '0.2s', display: 'block'
              }}>
                <span style={{
                  position: 'absolute', height: '18px', width: '18px', left: settings.silentAutoUpdate !== false ? '23px' : '3px', bottom: '3px',
                  backgroundColor: '#ffffff', borderRadius: '50%', transition: '0.2s', display: 'block'
                }} />
              </span>
            </label>
          </div>
        </div>

        {/* Save Settings Submit Button */}
        <button
          type="submit"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 28px',
            background: '#2563eb',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            alignSelf: 'flex-start',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
          }}
        >
          <IconCheck size={16} color="#ffffff" />
          Save &amp; Apply Fleet Engine Parameters
        </button>
      </form>
    </div>
  );
}
