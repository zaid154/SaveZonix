import React from 'react';

export default function Hero({ appConfig, onOpenExtensionModal }) {
  const scrollToStudio = (e) => {
    e.preventDefault();
    const studioEl = document.getElementById('studio');
    if (studioEl) {
      studioEl.scrollIntoView({ behavior: 'smooth' });
      const inputEl = studioEl.querySelector('input');
      if (inputEl) inputEl.focus();
    }
  };

  return (
    <section className="hero-section" id="hero">
      <div className="hero-container">
        <div className="hero-pill">
          <span className="pill-dot"></span>
          <span>⚡ 100% Free Web Downloader &amp; Chrome Extension</span>
        </div>

        <h1 className="hero-title">
          The World's Fastest<br />
          <span className="gradient-text-hero">Universal Media Downloader</span>
        </h1>

        <p className="hero-subtitle">
          Download YouTube 4K videos, MP3 music, Instagram Reels, and entire playlists directly in your browser or with our 1-click Chrome Extension. No apps or software installation required.
        </p>

        <div className="hero-cta-group">
          {/* Primary: Add to Chrome (Opens 1-Click Free Setup Modal) */}
          <button
            type="button"
            onClick={onOpenExtensionModal}
            className="btn-hero-primary"
            style={{
              background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
              color: '#030816',
              boxShadow: '0 8px 30px rgba(56, 189, 248, 0.4)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {/* Chrome 4-color SVG Logo */}
            <svg width="24" height="24" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#4285F4" d="M12 12m-9.5 0a9.5 9.5 0 1 0 19 0a9.5 9.5 0 1 0 -19 0Z"/>
              <path fill="#EA4335" d="M12 2.5C7.9 2.5 4.3 4.9 2.7 8.3l4.8 8.3L12 12l8.2 0C19.1 6.6 15.9 2.5 12 2.5z"/>
              <path fill="#FBBC05" d="M2.7 8.3C1.9 9.9 1.5 11.7 1.5 13.5c0 5 3.5 9.2 8.2 10.3l4.8-8.3-2.5-3.5L2.7 8.3z"/>
              <path fill="#34A853" d="M9.7 23.8c.8.2 1.5.2 2.3.2 5.8 0 10.5-4.7 10.5-10.5 0-1.8-.5-3.5-1.3-5L12 12l-2.3 11.8z"/>
              <circle cx="12" cy="12" r="4.8" fill="#FFFFFF"/>
              <circle cx="12" cy="12" r="3.8" fill="#1A73E8"/>
            </svg>
            <div className="btn-text-wrap">
              <span className="btn-main-label">Add to Chrome — It's Free</span>
              <span className="btn-sub-label">YouTube Ad Blocker &amp; 1-Click Downloader</span>
            </div>
          </button>

          {/* Secondary: Direct Web Downloader */}
          <a
            href="#studio"
            onClick={scrollToStudio}
            className="btn-hero-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <div className="btn-text-wrap" style={{ textAlign: 'left' }}>
              <span style={{ fontSize: '15px', fontWeight: '700', color: '#fff' }}>Use Web Downloader</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Paste Link &amp; Download Online</span>
            </div>
          </a>
        </div>

        {/* Feature badges under Hero */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap', marginTop: '16px', color: '#94a3b8', fontSize: '12.5px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> No Software to Install
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> 4K Ultra HD &amp; 320kbps MP3
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> YouTube, Instagram, Reels &amp; More
          </span>
        </div>
      </div>
    </section>
  );
}
