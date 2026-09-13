import React from 'react';

export default function Navbar({ appConfig, user, onOpenAuth, onLogout, onOpenAdmin }) {
  return (
    <header className="site-header">
      <div className="nav-container">
        <a href="#" className="brand-logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">Save<span className="gradient-text">Zonix</span></span>
        </a>

        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#download">Download</a>
        </nav>

        <div className="nav-actions">
          <button
            onClick={onOpenAdmin}
            className="btn-auth-nav"
            style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.08)' }}
            title="Open Central Cloud Admin Dashboard"
          >
            🛡️ Admin
          </button>

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

          <a href={appConfig?.appDownloadUrl || 'https://github.com/zaid154/SaveZonix/releases/latest'} className="btn-nav-download">
            Download App
          </a>
        </div>
      </div>
    </header>
  );
}
