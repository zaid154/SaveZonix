import React from 'react';

export default function Navbar({ appConfig, user, onOpenAuth, onLogout, onNavigate, currentPath }) {
  const DIRECT_EXE_URL = 'https://github.com/zaid154/SaveZonix/releases/download/v2.5.0/SaveZonix-Setup-v2.5.0.exe';
  const downloadUrl = (appConfig?.appDownloadUrl && !appConfig.appDownloadUrl.includes('/releases/latest'))
    ? appConfig.appDownloadUrl
    : DIRECT_EXE_URL;

  function handleNavClick(e, targetHash) {
    e.preventDefault();
    if (currentPath !== '/') {
      onNavigate('/');
      setTimeout(() => {
        const el = document.querySelector(targetHash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.querySelector(targetHash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // If on Admin page, show special admin navbar
  if (currentPath === '/admin') {
    return (
      <header className="site-header">
        <div className="nav-container">
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); onNavigate('/'); }}
            className="brand-logo"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <img src="/logo.png" alt="SaveZonix" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
            <span className="logo-text">Save<span className="gradient-text">Zonix</span></span>
            <span style={{ fontSize: '11px', padding: '3px 8px', background: 'rgba(56,189,248,0.15)', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '12px', fontWeight: '700', marginLeft: '6px' }}>
              Admin Cockpit
            </span>
          </a>

          <div className="nav-actions">
            <button
              onClick={() => onNavigate('/')}
              className="btn-auth-nav"
              style={{ borderColor: '#334155', color: '#94a3b8' }}
            >
              ← Back to Main Website
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="site-header">
      <div className="nav-container">
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); onNavigate('/'); }}
          className="brand-logo"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <img src="/logo.png" alt="SaveZonix" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
          <span className="logo-text">Save<span className="gradient-text">Zonix</span></span>
        </a>

        <nav className="nav-links">
          <a href="#features" onClick={(e) => handleNavClick(e, '#features')}>Features</a>
          <a href="#how-it-works" onClick={(e) => handleNavClick(e, '#how-it-works')}>How It Works</a>
          <a href="#pricing" onClick={(e) => handleNavClick(e, '#pricing')}>Pricing</a>
          <a href="#faq" onClick={(e) => handleNavClick(e, '#faq')}>FAQ</a>
        </nav>

        <div className="nav-actions">
          {user ? (
            <div className="user-tag">
              <span>{user.isVip ? '👑' : '👤'} {user.name}</span>
              <button onClick={onLogout} className="btn-auth-nav" style={{ padding: '4px 10px', fontSize: '11px' }}>
                Logout
              </button>
            </div>
          ) : (
            <button onClick={onOpenAuth} className="btn-auth-nav">
              Sign In
            </button>
          )}

          <a href={downloadUrl} className="btn-nav-download">
            Download App
          </a>
        </div>
      </div>
    </header>
  );
}
