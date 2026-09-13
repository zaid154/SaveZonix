import React from 'react';

export default function DiagnosticsTab({ diagnostics }) {
  if (!diagnostics) {
    return (
      <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px', textAlign: 'center', color: '#64748b' }}>
        Loading diagnostics telemetry...
      </div>
    );
  }

  return (
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
                      {log.createdAt ? new Date(log.createdAt).toLocaleDateString() : 'Recent'}
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
  );
}
