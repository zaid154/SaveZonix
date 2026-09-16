import React, { useState, useMemo, useEffect } from 'react';
import { IconSearch, IconTrash, IconRefresh } from './AdminIcons';

// Helper: Extract YouTube Thumbnail from URL
function getYouTubeThumbnail(url, fallback = '') {
  if (!url || typeof url !== 'string') return fallback;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  if (match && match[1]) {
    return `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return fallback;
}

// Helper: Extract Series / Playlist Metadata
function extractSeriesInfo(title, strategy) {
  let totalExplicit = null;
  if (strategy && typeof strategy === 'string') {
    const totalM = strategy.match(/Total:\s*(\d+)/i);
    if (totalM) totalExplicit = parseInt(totalM[1], 10);
  }

  if (strategy && typeof strategy === 'string' && strategy.startsWith('Playlist:')) {
    const clean = strategy.replace(/^Playlist:\s*/i, '');
    const parts = clean.split('•').map(s => s.trim());
    const code = parts[0] || 'PL-01';
    const plTitle = parts[1] || parts[0] || 'YouTube Playlist';
    return { isPlaylist: true, code, title: plTitle, totalExpected: totalExplicit };
  }

  const rawTitle = title || '';
  const match = rawTitle.match(/^(.*?)(?:\s*[-–|:]\s*)?(?:Episode|Ep\.?|Part|Pt\.?|Season\s*\d+\s*Episode)\s*\d+/i);
  if (match && match[1] && match[1].trim().length > 2) {
    const cleanName = match[1].trim().replace(/^[-–|:_]+|[-–|:_]+$/g, '').trim();
    if (cleanName.length > 2) {
      return { isPlaylist: true, code: 'PL-SERIES', title: cleanName, totalExpected: totalExplicit };
    }
  }

  return { isPlaylist: false, code: '', title: '', totalExpected: null };
}

// Helper: Extract Numerical Episode / Part Number
function extractIndexNumber(title, fileName) {
  const combined = `${title || ''} ${fileName || ''}`;
  const epMatch = combined.match(/(?:Episode|Ep\.?|Part|Pt\.?)\s*(\d+)/i);
  if (epMatch && epMatch[1]) {
    return parseInt(epMatch[1], 10);
  }
  const prefixMatch = combined.match(/^(\d{1,4})\s*[-_.]\s*/);
  if (prefixMatch && prefixMatch[1]) {
    return parseInt(prefixMatch[1], 10);
  }
  return 999999;
}

// Helper: Format Speed
function formatSpeed(mbps) {
  if (!mbps || isNaN(mbps) || mbps <= 0) return '0.0 MB/s';
  return `${Number(mbps).toFixed(1)} MB/s`;
}

// Helper: Format File Size
function formatSize(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return 'N/A';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export default function DownloadsTab({
  downloads = [],
  onCleanStaleDownloads,
  onDeleteDownloadRecord,
  onDeletePlaylist,
  onRefresh
}) {
  const [searchDownload, setSearchDownload] = useState('');
  const [statusFilterDownload, setStatusFilterDownload] = useState('');
  const [platformFilterDownload, setPlatformFilterDownload] = useState('');
  const [groupByPlaylist, setGroupByPlaylist] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Accordion State for Expanded Playlists
  const [expandedGroupIds, setExpandedGroupIds] = useState(() => new Set());

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchDownload, statusFilterDownload, platformFilterDownload, groupByPlaylist, pageSize]);

  // 1. Filter Raw Downloads First
  const filteredDownloads = useMemo(() => {
    const q = searchDownload.toLowerCase().trim();
    return (downloads || []).filter((d) => {
      if (q) {
        const matchTitle = d.title && d.title.toLowerCase().includes(q);
        const matchFile = d.fileName && d.fileName.toLowerCase().includes(q);
        const matchUrl = d.originalUrl && d.originalUrl.toLowerCase().includes(q);
        const matchEmail = d.userEmail && d.userEmail.toLowerCase().includes(q);
        const matchStrategy = d.downloadStrategy && d.downloadStrategy.toLowerCase().includes(q);
        if (!matchTitle && !matchFile && !matchUrl && !matchEmail && !matchStrategy) return false;
      }
      if (statusFilterDownload && d.status !== statusFilterDownload) return false;
      if (platformFilterDownload && (!d.platform || !d.platform.toLowerCase().includes(platformFilterDownload.toLowerCase()))) return false;
      return true;
    });
  }, [downloads, searchDownload, statusFilterDownload, platformFilterDownload]);

  // 2. Group into Playlists vs Singles
  const displayEntries = useMemo(() => {
    if (!groupByPlaylist) {
      return filteredDownloads.map(d => ({ isGroup: false, ...d }));
    }

    const groups = new Map();
    const singles = [];

    filteredDownloads.forEach((d) => {
      const info = extractSeriesInfo(d.title, d.downloadStrategy);
      if (info.isPlaylist) {
        const userPrefix = (d.userEmail || 'guest').toLowerCase();
        const groupKey = `${userPrefix}__${info.title.toLowerCase().trim()}`;

        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            isGroup: true,
            groupId: groupKey,
            playlistCode: info.code || 'PL-01',
            title: info.title,
            platform: d.platform || 'YouTube',
            userEmail: d.userEmail || 'Guest',
            downloadType: d.downloadType || 'guest',
            thumbnailUrl: d.thumbnailUrl || '',
            items: [],
            createdAt: d.createdAt
          });
        }

        const grp = groups.get(groupKey);
        grp.items.push(d);
        if (!grp.thumbnailUrl && d.thumbnailUrl) grp.thumbnailUrl = d.thumbnailUrl;
        if (new Date(d.createdAt) > new Date(grp.createdAt)) {
          grp.createdAt = d.createdAt;
        }
      } else {
        singles.push({ isGroup: false, ...d });
      }
    });

    const processedGroups = [];
    let plCounter = 1;

    groups.forEach((grp) => {
      if (grp.items.length === 1 && (!grp.playlistCode || grp.playlistCode === 'PL-SERIES')) {
        singles.push({ isGroup: false, ...grp.items[0] });
      } else {
        if (grp.playlistCode === 'PL-SERIES') {
          grp.playlistCode = `PL-${String(plCounter).padStart(2, '0')}`;
          plCounter++;
        }

        // Sort sub-items numerically by episode number
        grp.items.sort((a, b) => {
          const numA = extractIndexNumber(a.title, a.fileName);
          const numB = extractIndexNumber(b.title, b.fileName);
          if (numA !== numB) return numA - numB;
          return new Date(a.createdAt) - new Date(b.createdAt);
        });

        // Resolve thumbnail from items or YouTube fallback
        if (!grp.thumbnailUrl) {
          const itemWithThumb = grp.items.find(i => i.thumbnailUrl);
          if (itemWithThumb && itemWithThumb.thumbnailUrl) {
            grp.thumbnailUrl = itemWithThumb.thumbnailUrl;
          } else if (grp.items[0]?.originalUrl) {
            grp.thumbnailUrl = getYouTubeThumbnail(grp.items[0].originalUrl);
          }
        }

        // Determine true total videos in playlist
        let maxIndexFound = 0;
        grp.items.forEach(it => {
          const num = extractIndexNumber(it.title, it.fileName);
          if (num !== 999999 && num > maxIndexFound) maxIndexFound = num;
          if (!grp.totalExpected) {
            const totalMatch = (it.downloadStrategy || '').match(/Total:\s*(\d+)/i);
            if (totalMatch) grp.totalExpected = parseInt(totalMatch[1], 10);
          }
        });

        const inferredTotal = grp.totalExpected || (maxIndexFound >= 35 ? Math.max(100, maxIndexFound) : maxIndexFound);
        grp.totalVideos = Math.max(inferredTotal || 0, grp.items.length);
        grp.completedCount = grp.items.filter(i => i.status === 'Completed').length;
        grp.downloadingCount = grp.items.filter(i => i.status === 'Downloading').length;
        grp.failedCount = grp.items.filter(i => i.status === 'Failed' || i.status === 'Cancelled').length;
        grp.totalBytes = grp.items.reduce((acc, i) => acc + (i.fileSize || i.downloadedBytes || 0), 0);

        // Aggregate speed
        const activeSpeeds = grp.items
          .filter(i => i.status === 'Downloading' && (i.downloadSpeedMBps || 0) > 0)
          .map(i => i.downloadSpeedMBps);
        grp.aggregateSpeed = activeSpeeds.length > 0
          ? activeSpeeds.reduce((a, b) => a + b, 0)
          : (grp.items[0]?.downloadSpeedMBps || 0);

        // Status
        if (grp.downloadingCount > 0) {
          grp.status = 'Downloading';
        } else if (grp.failedCount === grp.totalVideos) {
          grp.status = 'Failed';
        } else {
          grp.status = 'Completed';
        }

        grp.percent = grp.totalVideos > 0 ? Math.min(100, Math.round((grp.completedCount / grp.totalVideos) * 100)) : 0;
        processedGroups.push(grp);
      }
    });

    const combined = [...processedGroups, ...singles];
    combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return combined;
  }, [filteredDownloads, groupByPlaylist]);

  // 3. Pagination Calculations
  const totalEntries = displayEntries.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedEntries = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * pageSize;
    return displayEntries.slice(startIndex, startIndex + pageSize);
  }, [displayEntries, validCurrentPage, pageSize]);

  // Toggle Accordion Collapse
  function toggleGroupCollapse(groupId) {
    setExpandedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  const totalRawVideos = filteredDownloads.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Filter & Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '320px', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search by title, playlist, URL, or email..."
              value={searchDownload}
              onChange={(e) => setSearchDownload(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 34px',
                background: '#0d131f',
                border: '1px solid #1a2333',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <span style={{ position: 'absolute', left: '11px', top: '10px', color: '#64748b' }}>
              <IconSearch size={14} color="#64748b" />
            </span>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilterDownload}
            onChange={(e) => setStatusFilterDownload(e.target.value)}
            style={{
              padding: '9px 12px',
              background: '#0d131f',
              border: '1px solid #1a2333',
              borderRadius: '8px',
              color: '#cbd5e1',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Downloading">Downloading</option>
            <option value="Failed">Failed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Platform Filter */}
          <select
            value={platformFilterDownload}
            onChange={(e) => setPlatformFilterDownload(e.target.value)}
            style={{
              padding: '9px 12px',
              background: '#0d131f',
              border: '1px solid #1a2333',
              borderRadius: '8px',
              color: '#cbd5e1',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">All Platforms</option>
            <option value="YouTube">YouTube</option>
            <option value="Instagram">Instagram</option>
            <option value="Facebook">Facebook</option>
            <option value="TikTok">TikTok</option>
            <option value="PixelFlix">PixelFlix</option>
          </select>

          {/* Group by Playlist Toggle Button */}
          <button
            type="button"
            onClick={() => setGroupByPlaylist(!groupByPlaylist)}
            title="Toggle between Grouped Playlists and Flat List"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              background: groupByPlaylist ? '#13233f' : '#0d131f',
              border: `1px solid ${groupByPlaylist ? '#2563eb' : '#1a2333'}`,
              borderRadius: '8px',
              color: groupByPlaylist ? '#38bdf8' : '#94a3b8',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: '0.15s'
            }}
          >
            <span>📁 Group Playlists</span>
            <span style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '10px',
              background: groupByPlaylist ? 'rgba(56, 189, 248, 0.2)' : '#1e293b',
              color: groupByPlaylist ? '#38bdf8' : '#64748b'
            }}>
              {groupByPlaylist ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh Downloads from Server"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 12px',
                background: '#0d131f',
                border: '1px solid #1a2333',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '12.5px',
                cursor: 'pointer'
              }}
            >
              <IconRefresh size={13} color="#94a3b8" />
              <span>Refresh</span>
            </button>
          )}

          <button
            onClick={onCleanStaleDownloads}
            style={{
              padding: '9px 14px',
              background: '#131b2c',
              border: '1px solid rgba(251, 191, 36, 0.4)',
              borderRadius: '8px',
              color: '#fbbf24',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reconcile Sessions
          </button>
        </div>
      </div>

      {/* Main Table Container */}
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
              {paginatedEntries.map((entry) => {
                // CASE 1: GROUPED PLAYLIST CARD / ACCORDION ROW
                if (entry.isGroup) {
                  const isExpanded = expandedGroupIds.has(entry.groupId);
                  const isDownloading = entry.status === 'Downloading';

                  return (
                    <React.Fragment key={`group_${entry.groupId}`}>
                      {/* Playlist Header Row */}
                      <tr
                        style={{
                          borderBottom: '1px solid #1e293b',
                          background: isExpanded
                            ? 'linear-gradient(90deg, rgba(14, 165, 233, 0.12) 0%, rgba(13, 19, 31, 0.98) 100%)'
                            : 'linear-gradient(90deg, rgba(14, 165, 233, 0.05) 0%, rgba(13, 19, 31, 0.9) 100%)',
                          borderLeft: '4px solid #0ea5e9',
                          transition: 'background 0.2s ease'
                        }}
                      >
                        {/* Title & Playlist Banner */}
                        <td style={{ padding: '14px 16px', maxWidth: '440px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* Playlist Cover Image with corner badge */}
                            <div
                              onClick={() => toggleGroupCollapse(entry.groupId)}
                              style={{
                                width: '58px',
                                height: '40px',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                flexShrink: 0,
                                position: 'relative',
                                background: '#090d16',
                                border: '1px solid rgba(56, 189, 248, 0.4)',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)'
                              }}
                            >
                              {entry.thumbnailUrl ? (
                                <img
                                  src={entry.thumbnailUrl}
                                  alt={entry.title}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div
                                style={{
                                  display: entry.thumbnailUrl ? 'none' : 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '100%',
                                  height: '100%',
                                  background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)',
                                  color: '#fff',
                                  fontSize: '18px'
                                }}
                              >
                                📁
                              </div>
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: '2px',
                                  right: '2px',
                                  background: 'rgba(0, 0, 0, 0.85)',
                                  color: '#38bdf8',
                                  fontSize: '9px',
                                  fontWeight: 700,
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  border: '1px solid rgba(56, 189, 248, 0.3)',
                                  lineHeight: '1.1'
                                }}
                              >
                                📁 {entry.totalVideos}
                              </div>
                            </div>

                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                <span
                                  style={{
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    background: 'rgba(14, 165, 233, 0.2)',
                                    color: '#38bdf8',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    letterSpacing: '0.4px',
                                    border: '1px solid rgba(14, 165, 233, 0.35)',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                    display: 'inline-block'
                                  }}
                                >
                                  {entry.playlistCode}
                                </span>
                                <div
                                  onClick={() => toggleGroupCollapse(entry.groupId)}
                                  style={{
                                    fontWeight: 700,
                                    color: '#f8fafc',
                                    fontSize: '13.5px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer'
                                  }}
                                  title={entry.title}
                                >
                                  {entry.title}
                                </div>
                              </div>

                              {/* Progress Subtitle & Mini Track */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: '#94a3b8' }}>
                                <span>
                                  {entry.completedCount} / {entry.totalVideos} Completed
                                </span>
                                <span>•</span>
                                <span style={{ color: entry.percent === 100 ? '#34d399' : '#38bdf8', fontWeight: 600 }}>
                                  {entry.percent}%
                                </span>

                                {/* Mini Progress Track */}
                                <div
                                  style={{
                                    width: '70px',
                                    height: '5px',
                                    borderRadius: '4px',
                                    background: '#1e293b',
                                    overflow: 'hidden',
                                    marginLeft: '2px'
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${entry.percent}%`,
                                      height: '100%',
                                      background: entry.percent === 100 ? '#10b981' : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                                      borderRadius: '4px',
                                      transition: 'width 0.3s ease'
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Platform */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '4px', background: '#131b2c', color: '#38bdf8', fontSize: '11px', border: '1px solid #1e293b', fontWeight: 600 }}>
                            {entry.platform}
                          </span>
                        </td>

                        {/* User Email */}
                        <td style={{ padding: '14px 16px', color: '#94a3b8' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{entry.userEmail}</span>
                            <span style={{
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              background: entry.downloadType === 'admin' ? 'rgba(56, 189, 248, 0.15)' : (entry.downloadType === 'user' ? 'rgba(16, 185, 129, 0.15)' : '#131b2c'),
                              color: entry.downloadType === 'admin' ? '#38bdf8' : (entry.downloadType === 'user' ? '#34d399' : '#64748b'),
                              border: `1px solid ${entry.downloadType === 'admin' ? 'rgba(56, 189, 248, 0.3)' : (entry.downloadType === 'user' ? 'rgba(16, 185, 129, 0.3)' : '#1e293b')}`
                            }}>
                              {entry.downloadType}
                            </span>
                          </div>
                        </td>

                        {/* Total File Size */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '13px' }}>
                            {formatSize(entry.totalBytes)}
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap' }}>
                            {entry.completedCount} of {entry.totalVideos} Done {entry.percent < 100 && entry.completedCount > 0 ? `• ~${((entry.totalBytes / entry.completedCount * entry.totalVideos) / (1024 * 1024 * 1024)).toFixed(1)} GB Est.` : ''}
                          </div>
                        </td>

                        {/* Speed */}
                        <td style={{ padding: '14px 16px', color: '#34d399', fontWeight: 600 }}>
                          {entry.aggregateSpeed > 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span>⚡</span> {formatSpeed(entry.aggregateSpeed)}
                            </span>
                          ) : '0.0 MB/s'}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              background: isDownloading ? 'rgba(14, 165, 233, 0.15)' : (entry.status === 'Completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                              color: isDownloading ? '#38bdf8' : (entry.status === 'Completed' ? '#34d399' : '#f87171'),
                              border: `1px solid ${isDownloading ? 'rgba(14, 165, 233, 0.35)' : (entry.status === 'Completed' ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)')}`,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {isDownloading && (
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#38bdf8',
                                boxShadow: '0 0 8px #38bdf8',
                                display: 'inline-block'
                              }} />
                            )}
                            {isDownloading ? `Downloading (${entry.percent}%)` : entry.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                            {/* Expand / Collapse Button */}
                            <button
                              type="button"
                              onClick={() => toggleGroupCollapse(entry.groupId)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                background: isExpanded
                                  ? 'rgba(56, 189, 248, 0.18)'
                                  : 'linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(2, 132, 199, 0.3) 100%)',
                                border: `1px solid ${isExpanded ? '#38bdf8' : 'rgba(56, 189, 248, 0.4)'}`,
                                borderRadius: '20px',
                                color: isExpanded ? '#38bdf8' : '#7dd3fc',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: isExpanded ? '0 0 12px rgba(56, 189, 248, 0.3)' : 'none',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <span>{isExpanded ? '▲ Hide Videos' : `▼ View ${entry.totalVideos} Videos`}</span>
                            </button>

                            {/* Delete Entire Playlist */}
                            {onDeletePlaylist && (
                              <button
                                type="button"
                                onClick={() => onDeletePlaylist(entry.items.map(i => i._id), entry.title)}
                                title={`Delete all ${entry.totalVideos} videos in this playlist`}
                                style={{
                                  padding: '6px 9px',
                                  background: '#131b2c',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '6px',
                                  color: '#f87171',
                                  fontSize: '11.5px',
                                  cursor: 'pointer'
                                }}
                              >
                                <IconTrash size={13} color="#f87171" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Nested Sub-Items (Shown when expanded) */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0, background: '#080c15', borderBottom: '2px solid #1a2333' }}>
                            <div style={{ padding: '12px 18px 16px 50px' }}>
                              <div style={{
                                fontSize: '11.5px',
                                fontWeight: 700,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                marginBottom: '10px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <span>{entry.title} — Videos List ({entry.items.length})</span>
                                <span>Sorted by Sequence</span>
                              </div>

                              <div style={{ background: '#0b101b', border: '1px solid #1a2333', borderRadius: '8px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                  <thead>
                                    <tr style={{ background: '#05080e', color: '#475569', fontSize: '10.5px', textTransform: 'uppercase', borderBottom: '1px solid #151d2c' }}>
                                      <th style={{ padding: '8px 12px', width: '40px' }}>#</th>
                                      <th style={{ padding: '8px 12px' }}>Video Item</th>
                                      <th style={{ padding: '8px 12px' }}>Size</th>
                                      <th style={{ padding: '8px 12px' }}>Speed</th>
                                      <th style={{ padding: '8px 12px' }}>Status</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {entry.items.map((sub, sIdx) => {
                                      const num = extractIndexNumber(sub.title, sub.fileName);
                                      const epLabel = num !== 999999 ? `#${num}` : `#${sIdx + 1}`;
                                      return (
                                        <tr key={sub._id} style={{ borderBottom: '1px solid #131b2c', color: '#94a3b8' }}>
                                          <td style={{ padding: '8px 12px', color: '#64748b', fontWeight: 700 }}>
                                            {epLabel}
                                          </td>
                                          <td style={{ padding: '8px 12px', maxWidth: '380px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                              {/* Episode Thumbnail */}
                                              <div
                                                style={{
                                                  width: '46px',
                                                  height: '30px',
                                                  borderRadius: '4px',
                                                  overflow: 'hidden',
                                                  flexShrink: 0,
                                                  background: '#070a10',
                                                  border: '1px solid #1e293b',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center'
                                                }}
                                              >
                                                {sub.thumbnailUrl || getYouTubeThumbnail(sub.originalUrl) ? (
                                                  <img
                                                    src={sub.thumbnailUrl || getYouTubeThumbnail(sub.originalUrl)}
                                                    alt=""
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    onError={(e) => {
                                                      e.currentTarget.style.display = 'none';
                                                      if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
                                                    }}
                                                  />
                                                ) : null}
                                                <div
                                                  style={{
                                                    display: (sub.thumbnailUrl || getYouTubeThumbnail(sub.originalUrl)) ? 'none' : 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: '100%',
                                                    height: '100%',
                                                    fontSize: '11px',
                                                    color: '#475569'
                                                  }}
                                                >
                                                  🎬
                                                </div>
                                              </div>

                                              <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sub.title || sub.fileName}>
                                                  {sub.title || sub.fileName}
                                                </div>
                                                <div style={{ color: '#475569', fontSize: '10.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                  {sub.originalUrl}
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                          <td style={{ padding: '8px 12px' }}>
                                            {formatSize(sub.fileSize)}
                                          </td>
                                          <td style={{ padding: '8px 12px', color: '#34d399' }}>
                                            {sub.downloadSpeedMBps ? `${sub.downloadSpeedMBps.toFixed(1)} MB/s` : '—'}
                                          </td>
                                          <td style={{ padding: '8px 12px' }}>
                                            <span style={{
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              fontSize: '10.5px',
                                              fontWeight: 600,
                                              background: sub.status === 'Completed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                              color: sub.status === 'Completed' ? '#34d399' : '#f87171',
                                              border: `1px solid ${sub.status === 'Completed' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                                            }}>
                                              {sub.status}
                                            </span>
                                          </td>
                                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                                              {sub.originalUrl && (
                                                <a
                                                  href={sub.originalUrl}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  style={{ padding: '3px 6px', background: '#131b2c', border: '1px solid #1e293b', borderRadius: '4px', color: '#38bdf8', fontSize: '10.5px', textDecoration: 'none' }}
                                                >
                                                  Source
                                                </a>
                                              )}
                                              <button
                                                onClick={() => onDeleteDownloadRecord(sub._id)}
                                                style={{ padding: '3px 6px', background: '#131b2c', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '4px', color: '#f87171', fontSize: '10.5px', cursor: 'pointer' }}
                                              >
                                                <IconTrash size={10} color="#f87171" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                }

                // CASE 2: SINGLE DOWNLOAD ROW (Non-Playlist)
                return (
                  <tr key={entry._id} style={{ borderBottom: '1px solid #131b2c', color: '#cbd5e1' }}>
                    <td style={{ padding: '12px 16px', maxWidth: '340px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '56px',
                          height: '38px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          background: '#090d16',
                          border: '1px solid #1e293b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {entry.thumbnailUrl ? (
                            <img
                              src={entry.thumbnailUrl}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex'; }}
                            />
                          ) : null}
                          <div style={{
                            display: entry.thumbnailUrl ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '100%',
                            color: '#475569',
                            fontSize: '13px'
                          }}>🎬</div>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.title || entry.fileName}>
                            {entry.title || entry.fileName || 'Direct Stream'}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.originalUrl || 'Source URL'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#131b2c', color: '#38bdf8', fontSize: '11px', border: '1px solid #1e293b' }}>
                        {entry.platform || 'Direct'}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{entry.userEmail || 'Guest'}</span>
                        <span style={{
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          background: entry.downloadType === 'admin' ? 'rgba(56, 189, 248, 0.15)' : (entry.downloadType === 'user' ? 'rgba(16, 185, 129, 0.15)' : '#131b2c'),
                          color: entry.downloadType === 'admin' ? '#38bdf8' : (entry.downloadType === 'user' ? '#34d399' : '#64748b'),
                          border: `1px solid ${entry.downloadType === 'admin' ? 'rgba(56, 189, 248, 0.3)' : (entry.downloadType === 'user' ? 'rgba(16, 185, 129, 0.3)' : '#1e293b')}`
                        }}>
                          {entry.downloadType || (entry.userEmail && !entry.userEmail.startsWith('Guest') ? 'user' : 'guest')}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                      {formatSize(entry.fileSize)}
                    </td>

                    <td style={{ padding: '12px 16px', color: '#34d399' }}>
                      {entry.downloadSpeedMBps ? `${entry.downloadSpeedMBps.toFixed(1)} MB/s` : '18.4 MB/s'}
                    </td>

                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: entry.status === 'Completed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: entry.status === 'Completed' ? '#34d399' : '#f87171',
                        border: `1px solid ${entry.status === 'Completed' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                      }}>
                        {entry.status}
                      </span>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {entry.originalUrl && (
                          <a
                            href={entry.originalUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ padding: '5px 8px', background: '#131b2c', border: '1px solid #1e293b', borderRadius: '6px', color: '#38bdf8', fontSize: '11.5px', textDecoration: 'none' }}
                          >
                            Source
                          </a>
                        )}
                        <button
                          onClick={() => onDeleteDownloadRecord(entry._id)}
                          style={{ padding: '5px 8px', background: '#131b2c', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', color: '#f87171', fontSize: '11.5px', cursor: 'pointer' }}
                        >
                          <IconTrash size={12} color="#f87171" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedEntries.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No download records found matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION TOOLBAR */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            background: '#060a12',
            borderTop: '1px solid #1a2333',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '12.5px',
            color: '#64748b'
          }}
        >
          {/* Left Info */}
          <div>
            Showing <strong style={{ color: '#e2e8f0' }}>{totalEntries === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1}</strong> to <strong style={{ color: '#e2e8f0' }}>{Math.min(validCurrentPage * pageSize, totalEntries)}</strong> of <strong style={{ color: '#e2e8f0' }}>{totalEntries}</strong> entries {groupByPlaylist && `(${totalRawVideos} total videos)`}
          </div>

          {/* Right Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Page Size Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                style={{
                  background: '#0d131f',
                  border: '1px solid #1e293b',
                  borderRadius: '6px',
                  color: '#cbd5e1',
                  padding: '4px 8px',
                  fontSize: '12px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Page Buttons */}
            <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={validCurrentPage <= 1}
                style={{
                  padding: '4px 8px',
                  background: '#0d131f',
                  border: '1px solid #1e293b',
                  borderRadius: '5px',
                  color: validCurrentPage <= 1 ? '#334155' : '#cbd5e1',
                  cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '11.5px'
                }}
              >
                « First
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={validCurrentPage <= 1}
                style={{
                  padding: '4px 8px',
                  background: '#0d131f',
                  border: '1px solid #1e293b',
                  borderRadius: '5px',
                  color: validCurrentPage <= 1 ? '#334155' : '#cbd5e1',
                  cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '11.5px'
                }}
              >
                ‹ Prev
              </button>

              {/* Numbered Page Buttons */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - validCurrentPage) <= 1)
                .map((p, idx, arr) => {
                  const showEllipsisBefore = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsisBefore && <span style={{ padding: '0 4px', color: '#475569' }}>...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        style={{
                          minWidth: '28px',
                          padding: '4px 7px',
                          background: p === validCurrentPage ? '#2563eb' : '#0d131f',
                          border: `1px solid ${p === validCurrentPage ? '#2563eb' : '#1e293b'}`,
                          borderRadius: '5px',
                          color: p === validCurrentPage ? '#ffffff' : '#94a3b8',
                          fontWeight: p === validCurrentPage ? 700 : 500,
                          cursor: 'pointer',
                          fontSize: '11.5px'
                        }}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={validCurrentPage >= totalPages}
                style={{
                  padding: '4px 8px',
                  background: '#0d131f',
                  border: '1px solid #1e293b',
                  borderRadius: '5px',
                  color: validCurrentPage >= totalPages ? '#334155' : '#cbd5e1',
                  cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '11.5px'
                }}
              >
                Next ›
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={validCurrentPage >= totalPages}
                style={{
                  padding: '4px 8px',
                  background: '#0d131f',
                  border: '1px solid #1e293b',
                  borderRadius: '5px',
                  color: validCurrentPage >= totalPages ? '#334155' : '#cbd5e1',
                  cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '11.5px'
                }}
              >
                Last »
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
