import React from 'react';
import { IconDatabase, IconCheck } from './AdminIcons';

export default function EngineTab({
  dbStatus,
  settings,
  setSettings,
  onSyncDatabases,
  onSaveSettings
}) {
  if (!settings) return null;

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
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Database Dual-Stack Engine</h3>
                <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0 0' }}>MongoDB Atlas &amp; Microsoft SQL Server Synchronization</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onSyncDatabases}
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
      <form onSubmit={onSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
  );
}
