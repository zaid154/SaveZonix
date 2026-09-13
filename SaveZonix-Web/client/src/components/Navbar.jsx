import React from 'react';

export default function Navbar({ appConfig, user, onOpenAuth, onLogout, onOpenAdmin }) {
  const DIRECT_EXE_URL = 'https://github.com/zaid154/SaveZonix/releases/download/v2.5.0/SaveZonix-Setup-v2.5.0.exe';
  const downloadUrl = (appConfig?.appDownloadUrl && !appConfig.appDownloadUrl.includes('/releases/latest'))
    ? appConfig.appDownloadUrl
    : DIRECT_EXE_URL;

  return (
    <header className="site-header">
      <div className="nav-container">
        <a href="#" className="brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo.png" alt="SaveZonix" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
          <span className="logo-text">Save<span className="gradient-text">Zonix</span></span>
        </a>

        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
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
