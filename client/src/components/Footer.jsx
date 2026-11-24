import React from 'react';

export default function Footer({ onOpenAdmin, onOpenLegal, onNavigate }) {
  const CHROME_STORE_DEFAULT = 'https://chromewebstore.google.com/detail/adblock-for-youtube/cmedhionkhpnakcndndgjdbohmhepckk?hl=en&pli=1';

  const handleNav = (path, e) => {
    if (e) e.preventDefault();
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.location.href = path;
    }
  };

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        {/* 4 Columns Grid */}
        <div className="footer-grid">
          {/* Column 1: Brand & E-E-A-T */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <img src="/logo.png" alt="SaveZonix" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
              <span style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Save<span style={{ color: '#38bdf8' }}>Zonix</span>
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', margin: '0 0 16px 0' }}>
              Fast universal video downloader &amp; 320kbps MP3 converter. 100% ad-free client-side stream remuxer for YouTube 4K, Instagram Reels, and web media.
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '20px', fontSize: '11.5px', color: '#34d399', fontWeight: '600' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>All Systems Operational
            </div>
          </div>

          {/* Column 2: Free SEO Media Tools */}
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#f8fafc', marginBottom: '16px' }}>
              Free Online Tools
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li>
                <a href="/youtube-downloader" onClick={(e) => handleNav('/youtube-downloader', e)} style={{ color: '#94a3b8', textDecoration: 'none' }}>
                  YouTube Video Downloader
                </a>
              </li>
              <li>
                <a href="/youtube-to-mp3" onClick={(e) => handleNav('/youtube-to-mp3', e)} style={{ color: '#94a3b8', textDecoration: 'none' }}>
                  YouTube to MP3 (320kbps)
                </a>
              </li>
              <li>
                <a href="/instagram-reels-downloader" onClick={(e) => handleNav('/instagram-reels-downloader', e)} style={{ color: '#94a3b8', textDecoration: 'none' }}>
                  Instagram Reels Downloader
                </a>
              </li>
              <li>
                <a href="/playlist-downloader" onClick={(e) => handleNav('/playlist-downloader', e)} style={{ color: '#94a3b8', textDecoration: 'none' }}>
                  YouTube Playlist Downloader
                </a>
              </li>
              <li>
                <a href={CHROME_STORE_DEFAULT} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', fontWeight: '600', textDecoration: 'none' }}>
                  Add Free Chrome Extension
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Company & Trust */}
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#f8fafc', marginBottom: '16px' }}>
              Company &amp; Trust
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li>
                <a href="/pricing" onClick={(e) => handleNav('/pricing', e)} style={{ color: '#94a3b8', textDecoration: 'none' }}>
                  Subscription Plans &amp; Pricing
                </a>
              </li>
              <li>
                <a href="/dashboard" onClick={(e) => handleNav('/dashboard', e)} style={{ color: '#94a3b8', textDecoration: 'none' }}>
                  User Dashboard &amp; Quota
                </a>
              </li>
              <li>
                <a href="/about" onClick={(e) => handleNav('/about', e)} style={{ color: '#94a3b8', textDecoration: 'none' }}>
                  About SaveZonix
                </a>
              </li>
              <li>
                <a href="/contact" onClick={(e) => handleNav('/contact', e)} style={{ color: '#94a3b8', textDecoration: 'none' }}>
                  Contact &amp; Support
                </a>
              </li>
              <li>
                <a href="#how-it-works" onClick={(e) => { e.preventDefault(); handleNav('/'); setTimeout(() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }), 200); }} style={{ color: '#94a3b8', textDecoration: 'none' }}>
                  How It Works Guide
                </a>
              </li>
              <li>
                <a href="#faq" onClick={(e) => { e.preventDefault(); handleNav('/'); setTimeout(() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' }), 200); }} style={{ color: '#94a3b8', textDecoration: 'none' }}>
                  Frequently Asked Questions
                </a>
              </li>
              <li>
                <a href="mailto:savezonix@gmail.com" style={{ color: '#38bdf8', fontWeight: '600', textDecoration: 'none' }}>
                  savezonix@gmail.com
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal & Policies */}
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#f8fafc', marginBottom: '16px' }}>
              Legal &amp; Compliance
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <li>
                <button onClick={() => onOpenLegal('privacy')} style={{ background: 'none', border: 'none', padding: 0, color: '#94a3b8', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}>
                  Privacy Policy
                </button>
              </li>
              <li>
                <button onClick={() => onOpenLegal('terms')} style={{ background: 'none', border: 'none', padding: 0, color: '#94a3b8', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}>
                  Terms of Service
                </button>
              </li>
              <li>
                <button onClick={() => onOpenLegal('dmca')} style={{ background: 'none', border: 'none', padding: 0, color: '#94a3b8', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}>
                  DMCA &amp; Copyright Policy
                </button>
              </li>
              <li>
                <button onClick={() => onOpenLegal('disclaimer')} style={{ background: 'none', border: 'none', padding: 0, color: '#94a3b8', fontSize: '13px', cursor: 'pointer', textAlign: 'left' }}>
                  Legal Disclaimer
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Global Legal & Safe-Harbor Disclaimer Notice */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '18px', marginBottom: '18px' }}>
          <p style={{ fontSize: '11.5px', lineHeight: '1.6', color: '#64748b', margin: 0 }}>
            <strong style={{ color: '#94a3b8' }}>Legal Disclaimer &amp; Safe Harbor:</strong> SaveZonix is an independent, client-side media transport protocol analyzer and offline recording utility for personal fair-use, educational analysis, and authorized private archiving. SaveZonix does not host, mirror, store, cache, stream, or redistribute any copyrighted video or audio files. All network requests are executed directly from the user's local device to origin servers. Users bear the sole and exclusive legal responsibility for verifying copyright ownership and ensuring full compliance with local laws and the terms of service of source platforms. Commercial infringement and DRM circumvention (e.g. Google Widevine, Apple FairPlay) are strictly prohibited. All third-party product names, logos, and trademarks belong exclusively to their respective owners.
          </p>
        </div>

        {/* Bottom Sub-Footer */}
        <div className="footer-bottom-row" style={{ borderTop: '1px solid #1e293b', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', fontSize: '12px', color: '#64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span>© 2026 SaveZonix. All rights reserved. Universal Video Stream Engine.</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '2px 8px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', fontSize: '11px', color: '#38bdf8', fontWeight: '700', fontFamily: 'monospace' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }}></span>Web Cloud v2.6.0
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
