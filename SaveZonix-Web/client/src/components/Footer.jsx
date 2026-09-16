import React from 'react';

export default function Footer({ onOpenAdmin, onOpenLegal }) {
  const DIRECT_EXE_URL = 'https://github.com/zaid154/SaveZonix/releases/download/v2.5.0/SaveZonix-Setup-v2.5.0.exe';

  return (
    <footer style={{ background: '#050914', borderTop: '1px solid #1e293b', paddingTop: '60px', paddingBottom: '30px', marginTop: '60px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        {/* 4 Columns Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '40px', marginBottom: '50px' }}>
          {/* Column 1: Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <img src="/logo.png" alt="SaveZonix" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
              <span style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>
                Save<span style={{ color: '#38bdf8' }}>Zonix</span>
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', margin: '0 0 16px 0' }}>
              High-performance multi-threaded stream analyzer and 4K media saver. Engineered in native C# .NET for creators and offline archival.
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '20px', fontSize: '11.5px', color: '#34d399', fontWeight: '600' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
              All Systems Operational
            </div>
          </div>

          {/* Column 2: Product */}
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#f8fafc', marginBottom: '16px' }}>
              Product &amp; Engine
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#94a3b8' }}>
              <li><a href="#features" style={{ color: '#94a3b8', textDecoration: 'none' }}>64-Thread Engine</a></li>
              <li><a href="#how-it-works" style={{ color: '#94a3b8', textDecoration: 'none' }}>Cinema Player 4K HDR</a></li>
              <li><a href="#features" style={{ color: '#94a3b8', textDecoration: 'none' }}>Playlist Studio</a></li>
              <li><a href="#pricing" style={{ color: '#94a3b8', textDecoration: 'none' }}>VIP Pro Tier</a></li>
              <li><a href={DIRECT_EXE_URL} style={{ color: '#38bdf8', fontWeight: '600', textDecoration: 'none' }}>Windows Setup (.exe)</a></li>
            </ul>
          </div>

          {/* Column 3: Resources & Docs */}
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#f8fafc', marginBottom: '16px' }}>
              Resources &amp; Docs
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#94a3b8' }}>
              <li><a href="#how-it-works" style={{ color: '#94a3b8', textDecoration: 'none' }}>How It Works Guide</a></li>
              <li><a href="#faq" style={{ color: '#94a3b8', textDecoration: 'none' }}>Frequently Asked Questions</a></li>
              <li><a href="mailto:savezonix@gmail.com" style={{ color: '#38bdf8', fontWeight: '600', textDecoration: 'none' }}>📧 savezonix@gmail.com</a></li>
            </ul>
          </div>

          {/* Column 4: Legal & Trust */}
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#f8fafc', marginBottom: '16px' }}>
              Legal &amp; Trust
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#94a3b8' }}>
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
                  Disclaimer &amp; Fair Use
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Sub-Footer */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', fontSize: '12px', color: '#64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span>© 2026 SaveZonix Inc. All rights reserved. Universal Video Stream Engine.</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '2px 8px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', fontSize: '11px', color: '#38bdf8', fontWeight: '700', fontFamily: 'monospace' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }}></span>
              Web Cloud v2.5.2
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
