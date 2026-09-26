import React, { useState, useMemo } from 'react';
import { IconSearch, IconTrash, IconRefresh, IconMessageSquare, IconStar } from './AdminIcons';

export default function FeedbackTab({
  feedbacks = [],
  onDeleteFeedback,
  onRefresh,
  loading = false
}) {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Filtered feedbacks
  const filteredFeedbacks = useMemo(() => {
    return (feedbacks || []).filter((item) => {
      // Source filter
      if (sourceFilter !== 'all') {
        if (sourceFilter === 'desktop' && item.source !== 'desktop') return false;
        if (sourceFilter === 'extension' && item.source !== 'extension') return false;
        if (sourceFilter === 'web' && item.source !== 'web') return false;
      }

      // Rating filter
      if (ratingFilter !== 'all') {
        const targetRating = parseInt(ratingFilter, 10);
        if (item.rating !== targetRating) return false;
      }

      // Search text
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const emailMatch = (item.email || '').toLowerCase().includes(q);
        const commentMatch = (item.comment || '').toLowerCase().includes(q);
        const reasonMatch = Array.isArray(item.reasons) && item.reasons.some(r => (r || '').toLowerCase().includes(q));
        const ipMatch = (item.ip || '').toLowerCase().includes(q);
        const sourceMatch = (item.source || '').toLowerCase().includes(q);
        if (!emailMatch && !commentMatch && !reasonMatch && !ipMatch && !sourceMatch) {
          return false;
        }
      }

      return true;
    });
  }, [feedbacks, sourceFilter, ratingFilter, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredFeedbacks.length / pageSize));
  const paginatedFeedbacks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFeedbacks.slice(start, start + pageSize);
  }, [filteredFeedbacks, currentPage, pageSize]);

  // High-level Metrics
  const totalCount = feedbacks.length;
  const desktopUninstallCount = feedbacks.filter(f => f.source === 'desktop').length;
  const extensionCount = feedbacks.filter(f => f.source === 'extension').length;
  const ratedFeedbacks = feedbacks.filter(f => f.rating > 0);
  const avgRating = ratedFeedbacks.length > 0
    ? (ratedFeedbacks.reduce((sum, f) => sum + f.rating, 0) / ratedFeedbacks.length).toFixed(1)
    : '0.0';

  function renderStars(rating) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} style={{ color: i <= rating ? '#fbbf24' : '#334155', fontSize: '15px' }}>
          ★
        </span>
      );
    }
    return stars;
  }

  function getSourceBadge(source) {
    if (source === 'desktop') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 700,
          background: 'rgba(239, 68, 68, 0.12)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }}>
          🖥️ Desktop Uninstall
        </span>
      );
    }
    if (source === 'extension') {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 700,
          background: 'rgba(56, 189, 248, 0.12)',
          color: '#38bdf8',
          border: '1px solid rgba(56, 189, 248, 0.3)'
        }}>
          🧩 Extension
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 700,
        background: 'rgba(16, 185, 129, 0.12)',
        color: '#34d399',
        border: '1px solid rgba(16, 185, 129, 0.3)'
      }}>
        🌐 Web Portal
      </span>
    );
  }

  function formatDate(d) {
    if (!d) return 'N/A';
    try {
      const date = new Date(d);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(d);
    }
  }

  return (
    <div>
      {/* 4 Telemetry Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '22px'
      }}>
        {/* Total Feedbacks */}
        <div style={{
          background: '#090d16',
          border: '1px solid #1a2333',
          borderRadius: '12px',
          padding: '16px 20px',
          position: 'relative'
        }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Feedback Entries
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
            User satisfaction submissions
          </div>
        </div>

        {/* Desktop Uninstalls */}
        <div style={{
          background: '#090d16',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '16px 20px',
          position: 'relative'
        }}>
          <div style={{ fontSize: '12px', color: '#f87171', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🖥️ Desktop Uninstalls
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#fca5a5', marginTop: '6px' }}>
            {desktopUninstallCount}
          </div>
          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
            Submitted upon uninstalling app
          </div>
        </div>

        {/* Average Rating */}
        <div style={{
          background: '#090d16',
          border: '1px solid rgba(251, 191, 36, 0.25)',
          borderRadius: '12px',
          padding: '16px 20px',
          position: 'relative'
        }}>
          <div style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ⭐ Average Rating
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#fef08a', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {avgRating} <span style={{ fontSize: '16px', color: '#ca8a04', fontWeight: 500 }}>/ 5.0</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
            Based on {ratedFeedbacks.length} ratings
          </div>
        </div>

        {/* Extension / Web */}
        <div style={{
          background: '#090d16',
          border: '1px solid #1a2333',
          borderRadius: '12px',
          padding: '16px 20px',
          position: 'relative'
        }}>
          <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🧩 Extension &amp; Web
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#bae6fd', marginTop: '6px' }}>
            {extensionCount} <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>ext / {totalCount - desktopUninstallCount - extensionCount} web</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
            Portal &amp; in-app feedback
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        background: '#090d16',
        border: '1px solid #1a2333',
        borderRadius: '12px',
        padding: '14px 18px',
        marginBottom: '20px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
            <IconSearch size={14} />
          </span>
          <input
            type="text"
            placeholder="Search email, comments, reasons, IP..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              background: '#060a12',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        {/* Source Filter */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Source:</span>
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1); }}
            style={{
              padding: '8px 12px',
              background: '#060a12',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '12.5px',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="all">All Sources</option>
            <option value="desktop">🖥️ Desktop Uninstall Only</option>
            <option value="extension">🧩 Chrome Extension</option>
            <option value="web">🌐 Web Portal</option>
          </select>
        </div>

        {/* Rating Filter */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Rating:</span>
          <select
            value={ratingFilter}
            onChange={(e) => { setRatingFilter(e.target.value); setCurrentPage(1); }}
            style={{
              padding: '8px 12px',
              background: '#060a12',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '12.5px',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="all">All Ratings</option>
            <option value="5">⭐⭐⭐⭐⭐ (5 Stars)</option>
            <option value="4">⭐⭐⭐⭐ (4 Stars)</option>
            <option value="3">⭐⭐⭐ (3 Stars)</option>
            <option value="2">⭐⭐ (2 Stars)</option>
            <option value="1">⭐ (1 Star)</option>
          </select>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            background: '#131b2c',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            color: '#38bdf8',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <IconRefresh size={13} color="#38bdf8" spinning={loading} />
          Refresh
        </button>
      </div>

      {/* Feedback Feed / Cards */}
      {paginatedFeedbacks.length === 0 ? (
        <div style={{
          background: '#090d16',
          border: '1px solid #1a2333',
          borderRadius: '12px',
          padding: '48px 24px',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <div style={{ width: '48px', height: '48px', margin: '0 auto 12px auto', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
            <IconMessageSquare size={24} />
          </div>
          <h3 style={{ fontSize: '16px', color: '#f8fafc', margin: '0 0 6px 0', fontWeight: 600 }}>No Feedback Records Found</h3>
          <p style={{ fontSize: '13px', margin: 0 }}>
            {search || sourceFilter !== 'all' || ratingFilter !== 'all'
              ? 'Try adjusting your search criteria or filters.'
              : 'Feedback submitted during app uninstallation or from the web portal will appear here in real-time.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {paginatedFeedbacks.map((item) => (
            <div
              key={item._id}
              style={{
                background: '#090d16',
                border: item.source === 'desktop' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid #1a2333',
                borderRadius: '12px',
                padding: '18px 20px',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Header: Source, Rating, Date, Delete */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {getSourceBadge(item.source)}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    {renderStars(item.rating || 0)}
                  </div>
                  {item.email ? (
                    <span style={{ fontSize: '12.5px', color: '#38bdf8', fontWeight: 600, fontFamily: 'monospace' }}>
                      ✉️ {item.email}
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                      Anonymous
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {formatDate(item.createdAt)}
                  </span>
                  {onDeleteFeedback && (
                    <button
                      onClick={() => onDeleteFeedback(item._id)}
                      title="Delete this feedback entry"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '4px',
                        transition: 'color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#f87171'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                    >
                      <IconTrash size={14} color="currentColor" />
                    </button>
                  )}
                </div>
              </div>

              {/* Reasons Chips */}
              {Array.isArray(item.reasons) && item.reasons.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {item.reasons.map((r, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 600,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        background: item.source === 'desktop' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                        color: item.source === 'desktop' ? '#fca5a5' : '#7dd3fc',
                        border: item.source === 'desktop' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(56, 189, 248, 0.25)'
                      }}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              )}

              {/* User Comment */}
              {item.comment ? (
                <div style={{
                  padding: '12px 14px',
                  background: '#060a12',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '13.5px',
                  lineHeight: '1.5',
                  marginBottom: '10px',
                  fontStyle: 'normal'
                }}>
                  &ldquo;{item.comment}&rdquo;
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic', marginBottom: '10px' }}>
                  No written comment provided.
                </div>
              )}

              {/* Footer Meta: IP / User-Agent */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#475569', borderTop: '1px solid #131b2c', paddingTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <span title={item.userAgent || 'Unknown Agent'} style={{ maxWidth: '650px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  💻 {item.userAgent ? item.userAgent.split(')')[0] + ')' : 'Client device'}
                </span>
                {item.ip && (
                  <span style={{ fontFamily: 'monospace' }}>IP: {item.ip.replace(/^::ffff:/, '')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '24px' }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '6px 14px',
              background: '#0d131f',
              border: '1px solid #1a2333',
              borderRadius: '6px',
              color: currentPage === 1 ? '#475569' : '#cbd5e1',
              fontSize: '12.5px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            &larr; Previous
          </button>
          <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
            Page <strong style={{ color: '#fff' }}>{currentPage}</strong> of <strong style={{ color: '#fff' }}>{totalPages}</strong>
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '6px 14px',
              background: '#0d131f',
              border: '1px solid #1a2333',
              borderRadius: '6px',
              color: currentPage === totalPages ? '#475569' : '#cbd5e1',
              fontSize: '12.5px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
