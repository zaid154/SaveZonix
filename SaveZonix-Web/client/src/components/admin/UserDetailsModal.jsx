import React from 'react';
import { IconX } from './AdminIcons';

export default function UserDetailsModal({ inspectorData, onClose }) {
  if (!inspectorData) return null;

  return (
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
              {inspectorData.user?.name} ({inspectorData.user?.email})
            </p>
          </div>
          <button
            onClick={onClose}
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
                {inspectorData.stats?.totalDownloads || 0}
              </div>
            </div>
            <div style={{ background: '#060a12', padding: '12px', borderRadius: '8px', border: '1px solid #1a2333', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '11px' }}>Completed</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#34d399', marginTop: '2px' }}>
                {inspectorData.stats?.completedCount || 0}
              </div>
            </div>
            <div style={{ background: '#060a12', padding: '12px', borderRadius: '8px', border: '1px solid #1a2333', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: '11px' }}>Data Consumed</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                {inspectorData.stats?.totalBytesFormatted || '0 MB'}
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
                  {inspectorData.recentDownloads?.map((dl) => (
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
                        {dl.createdAt ? new Date(dl.createdAt).toLocaleDateString() : 'Recent'}
                      </td>
                    </tr>
                  ))}
                  {(!inspectorData.recentDownloads || inspectorData.recentDownloads.length === 0) && (
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
            onClick={onClose}
            style={{ padding: '8px 16px', background: '#131b2c', border: '1px solid #1e293b', borderRadius: '6px', color: '#cbd5e1', fontSize: '12.5px', cursor: 'pointer' }}
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
