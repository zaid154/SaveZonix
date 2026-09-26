import React from 'react';
import { IconCrown, IconMessageSquare } from './AdminIcons';

export default function OverviewTab({ stats, downloads, feedbacks = [], onNavigateToDownloads, onNavigateToFeedback }) {
  if (!stats) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Skeleton Top Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ padding: '20px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
              <div style={{ width: '90px', height: '12px', background: '#131b2c', borderRadius: '4px', marginBottom: '12px', opacity: 0.6 }} />
              <div style={{ width: '60px', height: '28px', background: '#1a2333', borderRadius: '6px', marginBottom: '8px' }} />
              <div style={{ width: '120px', height: '12px', background: '#131b2c', borderRadius: '4px', opacity: 0.4 }} />
            </div>
          ))}
        </div>

        {/* Skeleton Platform Distribution */}
        <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
          <div style={{ width: '180px', height: '16px', background: '#1a2333', borderRadius: '4px', marginBottom: '8px' }} />
          <div style={{ width: '260px', height: '12px', background: '#131b2c', borderRadius: '4px', marginBottom: '20px', opacity: 0.5 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '80px', height: '12px', background: '#1a2333', borderRadius: '4px' }} />
                <div style={{ flex: 1, height: '8px', background: '#131b2c', borderRadius: '4px' }} />
                <div style={{ width: '30px', height: '12px', background: '#1a2333', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
        </div>

        {/* Skeleton Recent Activity */}
        <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
          <div style={{ width: '160px', height: '16px', background: '#1a2333', borderRadius: '4px', marginBottom: '20px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: '40px', background: '#060a12', border: '1px solid #131b2c', borderRadius: '8px' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
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

        <div
          onClick={onNavigateToFeedback}
          style={{ padding: '20px', background: '#0d131f', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', cursor: onNavigateToFeedback ? 'pointer' : 'default', transition: 'all 0.15s ease' }}
        >
          <div style={{ color: '#f87171', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <IconMessageSquare size={13} color="#f87171" />
              Feedbacks &amp; Uninstalls
            </span>
            {onNavigateToFeedback && <span style={{ fontSize: '11px', color: '#38bdf8' }}>View All &rarr;</span>}
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#fca5a5', marginTop: '6px' }}>
            {Array.isArray(feedbacks) ? feedbacks.length : 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            <span style={{ color: '#f87171', fontWeight: 600 }}>
              {Array.isArray(feedbacks) ? feedbacks.filter(f => f && f.source === 'desktop').length : 0}
            </span> desktop uninstalls
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
            onClick={onNavigateToDownloads}
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
              {(downloads || []).slice(0, 5).map((d) => (
                <tr key={d._id} style={{ borderBottom: '1px solid #131b2c', color: '#cbd5e1' }}>
                  <td style={{ padding: '10px 12px', maxWidth: '300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '42px', height: '28px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: '#090d16', border: '1px solid #1a2333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {d.thumbnailUrl ? (
                          <img
                            src={d.thumbnailUrl}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex'; }}
                          />
                        ) : null}
                        <div style={{ display: d.thumbnailUrl ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#475569' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="18" height="18" x="3" y="3" rx="2" />
                            <polygon points="10 8 16 12 10 16 10 8" fill="#475569" />
                          </svg>
                        </div>
                      </div>
                      <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: '#f8fafc' }} title={d.title || d.fileName}>
                        {d.title || d.fileName || d.originalUrl || 'Media Stream'}
                      </div>
                    </div>
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
                    {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'Recent'}
                  </td>
                </tr>
              ))}
              {(!downloads || downloads.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No download records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
