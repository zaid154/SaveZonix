import React, { useState, useEffect } from 'react';
import { getYouTubeThumbnail, resolveMediaThumbnail } from '../../utils/mediaThumbnail';

/**
 * Reusable thumbnail box with referrer-safe image loading, automatic YouTube
 * thumbnail fallback on error, and SVG icon fallback when unavailable.
 */
export default function MediaThumb({
  record,
  src,
  alt = '',
  width = 56,
  height = 38,
  borderRadius = 6,
  border = '1px solid #1e293b',
  background = '#090d16',
  boxShadow,
  onClick,
  children,
  placeholder
}) {
  const primarySrc = (typeof src === 'string' && src.trim()) || resolveMediaThumbnail(record);
  const ytFallback = getYouTubeThumbnail(record?.originalUrl || record?.url || '');

  const [activeSrc, setActiveSrc] = useState(primarySrc);
  const [failed, setFailed] = useState(!primarySrc);

  useEffect(() => {
    setActiveSrc(primarySrc);
    setFailed(!primarySrc);
  }, [primarySrc]);

  function handleImgError() {
    if (ytFallback && activeSrc !== ytFallback) {
      setActiveSrc(ytFallback);
      return;
    }
    setFailed(true);
  }

  return (
    <div
      onClick={onClick}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: `${borderRadius}px`,
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        background,
        border,
        boxShadow,
        cursor: onClick ? 'pointer' : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {!failed && activeSrc ? (
        <img
          src={activeSrc}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleImgError}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        placeholder || (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <polygon points="10 8 16 12 10 16 10 8" fill="#475569" />
          </svg>
        )
      )}
      {children}
    </div>
  );
}
