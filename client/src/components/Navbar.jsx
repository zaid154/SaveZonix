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
                  gap: '9px',
                  background: dropdownOpen ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.85)',
                  border: dropdownOpen ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '24px',
                  padding: '4px 12px 4px 5px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: dropdownOpen ? '0 0 16px rgba(56, 189, 248, 0.2)' : '0 2px 8px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: isAdmin
                    ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)'
                    : user.isVip
                    ? 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)'
                    : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
                  flexShrink: 0
                }}>
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {user.name || 'Account'}
                </span>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    flexShrink: 0
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {/* Modern Glassmorphic Dropdown Menu */}
              {dropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: '260px',
                  background: 'rgba(9, 14, 26, 0.95)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  boxShadow: '0 20px 48px -10px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(255, 255, 255, 0.06)',
                  padding: '8px',
                  zIndex: 1000,
                  animation: 'dropdownFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                  {/* User Profile Header Card */}
                  <div style={{
                    padding: '12px 14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user.name || 'User'}
                      </span>
                      {isAdmin ? (
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          flexShrink: 0
                        }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          Admin
                        </span>
                      ) : user.isVip ? (
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          background: 'rgba(251, 191, 36, 0.15)',
                          color: '#fbbf24',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          border: '1px solid rgba(251, 191, 36, 0.35)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          flexShrink: 0
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="#fbbf24" stroke="none">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                          VIP Pro
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          background: 'rgba(148, 163, 184, 0.1)',
                          color: '#94a3b8',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          border: '1px solid rgba(148, 163, 184, 0.2)',
                          flexShrink: 0
                        }}>
                          Free
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', wordBreak: 'break-all', fontFamily: 'system-ui, sans-serif' }}>
                      {user.email || 'Member'}
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {/* Admin Dashboard / Cockpit */}
                    {isAdmin && (
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
                          padding: '10px 12px',
                          background: 'rgba(56, 189, 248, 0.08)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          borderRadius: '10px',
                          color: '#38bdf8',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(56, 189, 248, 0.18)';
                          e.currentTarget.style.borderColor = '#38bdf8';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)';
                          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.25)';
                        }}
                      >
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 600, lineHeight: 1.2 }}>Admin Dashboard</div>
                          <div style={{ color: '#38bdf8', fontSize: '11px', fontWeight: 500 }}>System Cockpit</div>
                        </div>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          background: 'rgba(56, 189, 248, 0.2)',
                          color: '#7dd3fc',
                          padding: '2px 7px',
                          borderRadius: '6px'
                        }}>
                          Cockpit
                        </span>
                      </button>
                    )}

                    {/* Upgrade VIP link inside dropdown for Free users */}
                    {(!user.isVip && !isAdmin) && (
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          onOpenVip();
                        }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          background: 'rgba(251, 191, 36, 0.08)',
                          border: '1px solid rgba(251, 191, 36, 0.25)',
                          borderRadius: '10px',
                          color: '#fbbf24',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(251, 191, 36, 0.16)';
                          e.currentTarget.style.borderColor = '#fbbf24';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(251, 191, 36, 0.08)';
                          e.currentTarget.style.borderColor = 'rgba(251, 191, 36, 0.25)';
                        }}
                      >
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          background: 'rgba(251, 191, 36, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 600, lineHeight: 1.2 }}>Upgrade to VIP</div>
                          <div style={{ color: '#fbbf24', fontSize: '11px', fontWeight: 500 }}>Unlock 64x Speed</div>
                        </div>
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          background: 'rgba(251, 191, 36, 0.2)',
                          color: '#fde68a',
                          padding: '2px 7px',
                          borderRadius: '6px'
                        }}>
                          ₹99/mo
                        </span>
                      </button>
                    )}

                    <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.06)', margin: '4px 2px' }} />

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
                        padding: '9px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '10px',
                        color: '#f87171',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                        e.currentTarget.style.color = '#ef4444';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#f87171';
                      }}
                    >
                      <div style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                      </div>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button onClick={onOpenAuth} className="btn-auth-nav">
              Sign In
            </button>
          )}

          {/* Show Upgrade VIP in header ONLY if logged in and not VIP/Admin */}
          {(user && !user.isVip && !isAdmin) && (
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
          )}

          <a href={downloadUrl} className="btn-nav-download">
            Download App
          </a>
        </div>
      </div>
    </header>
  );
}
