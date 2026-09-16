import React, { useState } from 'react';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [view, setView] = useState('login'); // 'login' | 'register' | 'otp' | 'forgot'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('savezonix_token', data.token);
      localStorage.setItem('savezonix_user', JSON.stringify(data.user));
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendRegisterOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/send-register-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

      setMessage(`Verification code sent to ${email}`);
      setView('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-register-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid OTP code');

      localStorage.setItem('savezonix_token', data.token);
      localStorage.setItem('savezonix_user', JSON.stringify(data.user));
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotStep1(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/send-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotStep2(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password reset failed');

      localStorage.setItem('savezonix_token', data.token);
      localStorage.setItem('savezonix_user', JSON.stringify(data.user));
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <button className="btn-close-modal" onClick={onClose}>✕</button>

        {error && (
          <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#f87171', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>
             {error}
          </div>
        )}

        {message && (
          <div style={{ padding: '8px 12px', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#34d399', borderRadius: '8px', fontSize: '13px', marginBottom: '14px' }}>
             {message}
          </div>
        )}

        {/* 1. LOGIN VIEW */}
        {view === 'login' && (
          <div>
            <h2 className="modal-title">Welcome Back</h2>
            <p className="modal-desc">Login to access your VIP status and sync download stats.</p>

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rahul.sharma@gmail.com"
                  required
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label>Password</label>
                  <span onClick={() => { setView('forgot'); setError(''); setMessage(''); }} style={{ color: '#38bdf8', fontSize: '12px', cursor: 'pointer' }}>Forgot password?
                  </span>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button type="submit" className="btn-modal-submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="modal-toggle-text">Don't have an account yet?{' '}
              <span onClick={() => { setView('register'); setError(''); setMessage(''); }}>Create Free Account
              </span>
            </p>
          </div>
        )}

        {/* 2. REGISTER VIEW */}
        {view === 'register' && (
          <div>
            <h2 className="modal-title">Create an Account</h2>
            <p className="modal-desc">We will send a 6-digit verification code to your email.</p>

            <form onSubmit={handleSendRegisterOtp}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Rahul Sharma"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="rahul.sharma@gmail.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                />
              </div>

              <button type="submit" className="btn-modal-submit" disabled={loading}>
                {loading ? 'Sending verification code...' : 'Send Verification OTP '}
              </button>
            </form>

            <p className="modal-toggle-text">Already have an account?{' '}
              <span onClick={() => { setView('login'); setError(''); setMessage(''); }}>Sign In
              </span>
            </p>
          </div>
        )}

        {/* 3. OTP VERIFICATION VIEW */}
        {view === 'otp' && (
          <div style={{ textAlign: 'center' }}>
            <h2 className="modal-title">Enter Verification Code</h2>
            <p className="modal-desc">Check your inbox ({email}) for your 6-digit code.</p>

            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  letterSpacing: '8px',
                  textAlign: 'center',
                  padding: '12px',
                  background: '#030712',
                  border: '2px solid #38bdf8',
                  borderRadius: '12px',
                  color: '#38bdf8',
                  fontFamily: 'monospace'
                }}
                required
              />

              <button type="submit" className="btn-modal-submit" style={{ background: '#10b981' }} disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Activate Account '}
              </button>
            </form>

            <p className="modal-toggle-text" style={{ marginTop: '14px' }}>Wrong email?{' '}
              <span onClick={() => { setView('register'); setError(''); setMessage(''); }}>Change Email
              </span>
            </p>
          </div>
        )}

        {/* 4. FORGOT PASSWORD VIEW */}
        {view === 'forgot' && (
          <div>
            <h2 className="modal-title">Reset Password</h2>
            <p className="modal-desc">Enter your email and the 6-digit OTP sent to your inbox.</p>

            <form onSubmit={handleForgotStep1} style={{ marginBottom: '14px' }}>
              <div className="form-group">
                <label>Registered Email</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rahul.sharma@gmail.com"
                    required
                  />
                  <button type="submit" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap' }} disabled={loading}>Send OTP
                  </button>
                </div>
              </div>
            </form>

            <form onSubmit={handleForgotStep2}>
              <div className="form-group">
                <label>6-Digit Reset Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  required
                />
              </div>

              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                />
              </div>

              <button type="submit" className="btn-modal-submit" disabled={loading}>
                {loading ? 'Updating...' : 'Save New Password & Sign In'}
              </button>
            </form>

            <p className="modal-toggle-text">Remember your password?{' '}
              <span onClick={() => { setView('login'); setError(''); setMessage(''); }}>Back to Sign In
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
