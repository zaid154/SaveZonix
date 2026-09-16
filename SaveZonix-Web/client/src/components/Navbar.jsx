import React, { useState, useRef, useEffect } from 'react';

export default function Navbar({ appConfig, user, onOpenAuth, onOpenVip, onLogout, onNavigate, currentPath }) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const DIRECT_EXE_URL = 'https://github.com/zaid154/SaveZonix/releases/download/v2.5.0/SaveZonix-Setup-v2.5.0.exe';
  const downloadUrl = (appConfig?.appDownloadUrl && !appConfig.appDownloadUrl.includes('/releases/latest'))
    ? appConfig.appDownloadUrl
    : DIRECT_EXE_URL;

  const isAdmin = Boolean(
    user && (
      user.role === 'Admin' ||
      user.Role === 'Admin' ||
      user.isAdmin ||
      (user.email && user.email.toLowerCase() === 'zaidm1323@gmail.com') ||
      (user.name && user.name.toLowerCase().includes('admin'))
    )
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

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
  if (currentPath === '/admin' || currentPath.startsWith('/admin/')) {
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
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: dropdownOpen ? 'rgba(56, 189, 248, 0.12)' : 'rgba(18, 24, 38, 0.8)',
                  border: dropdownOpen ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '24px',
                  padding: '5px 12px 5px 6px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: isAdmin ? 'linear-gradient(135deg, #2563eb, #38bdf8)' : 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700
                }}>
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name || 'Account'}
                </span>
                {isAdmin && (
                  <span style={{ fontSize: '10px', background: 'rgba(56, 189, 248, 0.18)', color: '#38bdf8', padding: '1px 6px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.35)', fontWeight: 700 }}>
                    Admin
                  </span>
                )}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '230px',
                  background: '#0d131f',
                  border: '1px solid #1e293b',
                  borderRadius: '12px',
                  boxShadow: '0 16px 36px rgba(0, 0, 0, 0.6)',
                  padding: '8px',
                  zIndex: 1000
                }}>
                  {/* Profile Header */}
                  <div style={{ padding: '8px 10px 10px 10px', borderBottom: '1px solid #1a2333', marginBottom: '6px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {user.name || 'User'}
                      {user.isVip && (
                        <span style={{ fontSize: '10px', background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '1px 6px', borderRadius: '8px', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                          VIP
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', wordBreak: 'break-all' }}>
                      {user.email || 'Member'}
                    </div>
                  </div>

                  {/* If Admin: Prominent Admin Dashboard Link */}
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          onNavigate('/admin/overview');
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 10px',
                          background: 'rgba(56, 189, 248, 0.08)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          borderRadius: '8px',
                          color: '#38bdf8',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'left',
                          marginBottom: '6px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.18)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)'}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span>Admin Dashboard</span>
                        <span style={{ marginLeft: 'auto', fontSize: '10px', background: 'rgba(56, 189, 248, 0.2)', padding: '2px 6px', borderRadius: '4px', color: '#7dd3fc' }}>
                          Cockpit
                        </span>
                      </button>
                      <div style={{ height: '1px', background: '#1a2333', margin: '4px 0 6px 0' }} />
                    </>
                  )}

                  {/* Sign Out Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onLogout();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#f87171',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={onOpenAuth} className="btn-auth-nav">
              Sign In
            </button>
          )}

          {(!user?.isVip && !isAdmin) ? (
            <button
              type="button"
              onClick={onOpenVip}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '8px',
                color: '#fbbf24',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Upgrade VIP
            </button>
          ) : (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                background: 'rgba(251, 191, 36, 0.12)',
                border: '1px solid rgba(251, 191, 36, 0.35)',
                borderRadius: '8px',
                color: '#fbbf24',
                fontSize: '12px',
                fontWeight: 700
              }}
            >
              👑 {isAdmin ? 'Admin VIP' : 'VIP Pro'}
            </div>
          )}

          <a href={downloadUrl} className="btn-nav-download">
            Download App
          </a>
        </div>
      </div>
    </header>
  );
}
