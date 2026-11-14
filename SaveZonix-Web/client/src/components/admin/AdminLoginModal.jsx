import React, { useState } from 'react';
import { IconShield, IconLock, IconUsers } from './AdminIcons';

export default function AdminLoginModal({
  authError,
  authLoading,
  onLoginWithCredentials,
  onBack
}) {
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    onLoginWithCredentials(adminId, password);
  }

  function fillSuperAdmin() {
    setAdminId('zaidm1323@gmail.com');
    setPassword('Zaid@SaveZonix#2026!');
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
        <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.5', marginBottom: '22px' }}>
          Authenticate with your Administrator credentials to access platform fleet telemetry, AI CDN advisor, and engine controls.
        </p>

        {authError && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#f87171',
            fontSize: '12.5px',
            marginBottom: '18px',
            textAlign: 'left'
          }}>
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Admin ID / Email */}
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
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
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                disabled={authLoading}
                required
                autoFocus
              />
              <span style={{ position: 'absolute', left: '11px', top: '10px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                <IconUsers size={14} color="#64748b" />
              </span>
            </div>
          </div>

          {/* Password */}
          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
              Admin Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 42px 10px 34px',
                  background: '#060a12',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                disabled={authLoading}
                required
              />
              <span style={{ position: 'absolute', left: '11px', top: '10px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                <IconLock size={14} color="#64748b" />
              </span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '8px',
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
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
              transition: 'background 0.2s ease'
            }}
          >
            {authLoading ? 'Verifying Admin Access...' : 'Sign In as Administrator'}
          </button>

          {/* Quick Demo Pre-fill Link */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginTop: '4px' }}>
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
              Fill Super Admin (Demo)
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
            ← Return to Website
          </button>
        </form>
      </div>
    </div>
  );
}
