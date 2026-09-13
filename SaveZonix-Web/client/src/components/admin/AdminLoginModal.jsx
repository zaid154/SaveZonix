import React, { useState } from 'react';
import { IconShield, IconLock, IconUsers } from './AdminIcons';

export default function AdminLoginModal({
  authError,
  authLoading,
  onLoginWithCredentials,
  onLoginWithKey,
  onBack
}) {
  const [loginMode, setLoginMode] = useState('credentials'); // 'credentials' or 'key'
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [masterKey, setMasterKey] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (loginMode === 'credentials') {
      onLoginWithCredentials(adminId, password);
    } else {
      onLoginWithKey(masterKey);
    }
  }

  function fillSuperAdmin() {
    setLoginMode('credentials');
    setAdminId('zaidm1323@gmail.com');
    setPassword('Zaid@SaveZonix#2026!');
  }

  function fillMasterKey() {
    setLoginMode('key');
    setMasterKey('savezonix_admin_2026');
  }

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{
        maxWidth: '430px',
        width: '100%',
        padding: '36px 32px',
        background: '#0d131f',
        border: '1px solid #1a2333',
        borderRadius: '14px',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
        textAlign: 'center'
      }}>
        {/* Shield Icon */}
        <div style={{
          width: '46px',
          height: '46px',
          borderRadius: '12px',
          background: 'rgba(37, 99, 235, 0.12)',
          border: '1px solid rgba(37, 99, 235, 0.3)',
          color: '#38bdf8',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <IconShield size={24} color="#38bdf8" />
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
          SaveZonix Master Cockpit
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.5', marginBottom: '20px' }}>
          Authenticate to access platform fleet telemetry, AI CDN advisor, and engine controls.
        </p>

        {/* Tab Switcher: ID & Password vs Master Key */}
        <div style={{
          display: 'flex',
          gap: '4px',
          background: '#060a12',
          padding: '4px',
          borderRadius: '8px',
          border: '1px solid #1a2333',
          marginBottom: '20px'
        }}>
          <button
            type="button"
            onClick={() => setLoginMode('credentials')}
            style={{
              flex: 1,
              padding: '7px',
              border: 'none',
              borderRadius: '6px',
              background: loginMode === 'credentials' ? '#131b2c' : 'transparent',
              color: loginMode === 'credentials' ? '#38bdf8' : '#64748b',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Admin ID &amp; Password
          </button>
          <button
            type="button"
            onClick={() => setLoginMode('key')}
            style={{
              flex: 1,
              padding: '7px',
              border: 'none',
              borderRadius: '6px',
              background: loginMode === 'key' ? '#131b2c' : 'transparent',
              color: loginMode === 'key' ? '#38bdf8' : '#64748b',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Master Admin Key
          </button>
        </div>

        {authError && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#f87171',
            fontSize: '12.5px',
            marginBottom: '16px',
            textAlign: 'left'
          }}>
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loginMode === 'credentials' ? (
            <>
              {/* Admin ID / Email */}
              <div style={{ textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', marginBottom: '5px' }}>
                  Admin ID or Email
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="e.g. zaidm1323@gmail.com or admin"
                    value={adminId}
                    onChange={(e) => setAdminId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 34px',
                      background: '#060a12',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                    disabled={authLoading}
                    required
                  />
                  <span style={{ position: 'absolute', left: '11px', top: '10px', color: '#64748b' }}>
                    <IconUsers size={14} color="#64748b" />
                  </span>
                </div>
              </div>

              {/* Password */}
              <div style={{ textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', marginBottom: '5px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 38px 10px 34px',
                      background: '#060a12',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                    disabled={authLoading}
                    required
                  />
                  <span style={{ position: 'absolute', left: '11px', top: '10px', color: '#64748b' }}>
                    <IconLock size={14} color="#64748b" />
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '9px',
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: '2px 4px'
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Master Key Mode */
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', marginBottom: '5px' }}>
                Master Admin Key
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  placeholder="Enter Master Key"
                  value={masterKey}
                  onChange={(e) => setMasterKey(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 34px',
                    background: '#060a12',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                  disabled={authLoading}
                  required
                />
                <span style={{ position: 'absolute', left: '11px', top: '10px', color: '#64748b' }}>
                  <IconShield size={14} color="#64748b" />
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={authLoading}
            style={{
              padding: '11px',
              background: '#2563eb',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: authLoading ? 'wait' : 'pointer',
              opacity: authLoading ? 0.7 : 1,
              marginTop: '4px',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)'
            }}
          >
            {authLoading ? 'Verifying Admin Access...' : 'Sign In as Administrator'}
          </button>

          {/* Quick Demo Pre-fill Links */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={fillSuperAdmin}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                fontSize: '11.5px',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Fill Super Admin
            </button>
            <span style={{ color: '#334155' }}>|</span>
            <button
              type="button"
              onClick={fillMasterKey}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '11.5px',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Fill Master Key
            </button>
          </div>

          <button
            type="button"
            onClick={onBack}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '12px',
              cursor: 'pointer',
              marginTop: '6px',
              padding: '4px'
            }}
          >
            Return to Website
          </button>
        </form>
      </div>
    </div>
  );
}
