import React, { useState } from 'react';
import { IconSearch, IconTrash } from './AdminIcons';

export default function DownloadsTab({
  downloads,
  onCleanStaleDownloads,
  onDeleteDownloadRecord
}) {
  const [searchDownload, setSearchDownload] = useState('');
  const [statusFilterDownload, setStatusFilterDownload] = useState('');
  const [platformFilterDownload, setPlatformFilterDownload] = useState('');

  const filteredDownloads = (downloads || []).filter((d) => {
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
          onClick={onCleanStaleDownloads}
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
                        onClick={() => onDeleteDownloadRecord(d._id)}
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
  );
}
