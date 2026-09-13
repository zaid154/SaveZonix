import React from 'react';
import { IconShield } from './AdminIcons';

export default function AdminLoginModal({
  keyInput,
  setKeyInput,
  authError,
  authLoading,
  onLogin,
  onBack
}) {
  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '400px', width: '100%', padding: '36px 32px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '14px', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)', textAlign: 'center' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(37, 99, 235, 0.12)', border: '1px solid rgba(37, 99, 235, 0.3)', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
          <IconShield size={22} color="#38bdf8" />
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>SaveZonix Master Cockpit</h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.5', marginBottom: '22px' }}>
          Enter Master Admin Key to access fleet telemetry, AI CDN advisor, diagnostics, and engine controls.
        </p>

        {authError && (
          <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '12.5px', marginBottom: '16px', textAlign: 'left' }}>
            {authError}
          </div>
        )}

        <form onSubmit={onLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="password"
            placeholder="Master Admin Key"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            style={{ width: '100%', padding: '11px 14px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '13.5px', outline: 'none' }}
            disabled={authLoading}
            required
          />
          <button
            type="submit"
            disabled={authLoading}
            style={{ padding: '11px', background: '#2563eb', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '13.5px', fontWeight: 600, cursor: authLoading ? 'wait' : 'pointer', opacity: authLoading ? 0.7 : 1 }}
          >
            {authLoading ? 'Verifying Credentials...' : 'Authenticate Access'}
          </button>
          <button
            type="button"
            onClick={onBack}
            style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '12.5px', cursor: 'pointer', marginTop: '6px', padding: '6px' }}
          >
            Return to Website
          </button>
        </form>
      </div>
    </div>
  );
}
