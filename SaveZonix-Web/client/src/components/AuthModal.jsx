import React, { useState, useEffect, useRef } from 'react';

// Domain typo dictionary for instant suggestion
const TYPO_MAP = {
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com'
};

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [view, setView] = useState('login'); // 'login' | 'register' | 'otp' | 'forgot'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [magicResetToken, setMagicResetToken] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const otpInputRefs = useRef([]);

  // Check domain typos
  function getEmailSuggestion(val) {
    if (!val || !val.includes('@')) return null;
    const domain = val.split('@')[1]?.toLowerCase().trim();
    if (TYPO_MAP[domain]) {
      return val.split('@')[0] + '@' + TYPO_MAP[domain];
    }
    return null;
  }

  const emailSuggestion = getEmailSuggestion(email);

  // 60-second cooldown timer effect
  useEffect(() => {
    let timer = null;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  // Magic Link auto-verification from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyEmail = params.get('verify_email');
    const verifyToken = params.get('verify_token');
    const resetEmail = params.get('reset_email');
    const resetToken = params.get('reset_token');

    if (verifyEmail && verifyToken) {
      // 1-Click Registration Verification
      setLoading(true);
      fetch('/api/auth/magic-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyEmail, token: verifyToken })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.token) {
            localStorage.setItem('savezonix_token', data.token);
            localStorage.setItem('savezonix_user', JSON.stringify(data.user));
            onAuthSuccess(data.user);
            setMessage('🎉 Account verified successfully via 1-Click Magic Link!');
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            setError(data.error || 'Magic link verification failed.');
          }
        })
        .catch(() => setError('Connection failed during verification.'))
        .finally(() => setLoading(false));
    } else if (resetEmail && resetToken) {
      // 1-Click Password Reset
      setEmail(resetEmail);
      setMagicResetToken(resetToken);
      setView('forgot');
      setMessage('1-Click reset link verified! Please enter your new password.');
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Handle 6-Box OTP input changes
  function handleOtpDigitChange(index, value) {
    const char = value.slice(-1); // Only take latest char
    if (char && !/^\d$/.test(char)) return; // Only allow digits

    const newDigits = [...otpDigits];
    newDigits[index] = char;
    setOtpDigits(newDigits);

    // Auto-focus next box
    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  }

  // Handle Backspace navigation
  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  }

  // Handle Clipboard Paste across 6 boxes
  function handleOtpPaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);

    const focusIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIndex]?.focus();
  }

  const combinedOtp = otpDigits.join('');

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
    e?.preventDefault();
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
      setCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
      setView('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (combinedOtp.length < 6) {
      setError('Please enter all 6 digits of your verification code.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-register-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: combinedOtp })
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
    e?.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/send-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reset code');

      setMessage(data.message || `Reset code sent to ${email}`);
      setCooldown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotStep2(e) {
    e.preventDefault();
    if (!magicResetToken && combinedOtp.length < 6) {
      setError('Please enter the 6-digit reset code.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp: magicResetToken ? undefined : combinedOtp,
          magicToken: magicResetToken || undefined,
          newPassword
        })
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
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <button className="btn-close-modal" onClick={onClose}>✕</button>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#f87171', borderRadius: '8px', fontSize: '13px', marginBottom: '14px', lineHeight: '1.4' }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#34d399', borderRadius: '8px', fontSize: '13px', marginBottom: '14px', lineHeight: '1.4' }}>
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
                  placeholder="name@example.com"
                  required
                />
              </div>

              {emailSuggestion && (
                <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '-6px', marginBottom: '10px' }}>
                  Did you mean <strong style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => setEmail(emailSuggestion)}>{emailSuggestion}</strong>?
                </div>
              )}

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label>Password</label>
                  <span onClick={() => { setView('forgot'); setError(''); setMessage(''); }} style={{ color: '#38bdf8', fontSize: '12px', cursor: 'pointer' }}>
                    Forgot password?
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
              <span onClick={() => { setView('register'); setError(''); setMessage(''); }}>Create Free Account</span>
            </p>
          </div>
        )}

        {/* 2. REGISTER VIEW */}
        {view === 'register' && (
          <div>
            <h2 className="modal-title">Create an Account</h2>
            <p className="modal-desc">We will send a 6-digit verification code & 1-Click magic link to your email.</p>

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

              {emailSuggestion && (
                <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '-6px', marginBottom: '10px' }}>
                  Did you mean <strong style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => setEmail(emailSuggestion)}>{emailSuggestion}</strong>?
                </div>
              )}

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
                {loading ? 'Sending verification code...' : 'Send Verification OTP'}
              </button>
            </form>

            <p className="modal-toggle-text">Already have an account?{' '}
              <span onClick={() => { setView('login'); setError(''); setMessage(''); }}>Sign In</span>
            </p>
          </div>
        )}

        {/* 3. OTP VERIFICATION VIEW (6-Box Auto-Focus UI + 60s Cooldown) */}
        {view === 'otp' && (
          <div style={{ textAlign: 'center' }}>
            <h2 className="modal-title">Enter Verification Code</h2>
            <p className="modal-desc">Enter the 6-digit code sent to <strong style={{ color: '#38bdf8' }}>{email}</strong> or click the 1-Click link in your email.</p>

            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
              
              {/* 6 Individual Auto-Focus OTP Boxes */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }} onPaste={handleOtpPaste}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    style={{
                      width: '46px',
                      height: '56px',
                      fontSize: '24px',
                      fontWeight: 800,
                      textAlign: 'center',
                      background: '#030712',
                      border: digit ? '2px solid #0ea5e9' : '2px solid #1e293b',
                      borderRadius: '10px',
                      color: '#38bdf8',
                      outline: 'none',
                      fontFamily: 'monospace',
                      boxShadow: digit ? '0 0 12px rgba(14,165,233,0.3)' : 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
                  />
                ))}
              </div>

              <button type="submit" className="btn-modal-submit" style={{ background: '#10b981' }} disabled={loading || combinedOtp.length < 6}>
                {loading ? 'Verifying...' : 'Verify & Activate Account'}
              </button>
            </form>

            {/* Resend Cooldown Button */}
            <div style={{ marginTop: '16px', fontSize: '13px', color: '#94a3b8' }}>
              Didn't receive the code?{' '}
              {cooldown > 0 ? (
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>Resend in {cooldown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendRegisterOtp}
                  disabled={loading}
                  style={{ background: 'none', border: 'none', color: '#38bdf8', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  Resend Code
                </button>
              )}
            </div>

            <p className="modal-toggle-text" style={{ marginTop: '14px' }}>Wrong email?{' '}
              <span onClick={() => { setView('register'); setError(''); setMessage(''); }}>Change Email</span>
            </p>
          </div>
        )}

        {/* 4. FORGOT PASSWORD VIEW */}
        {view === 'forgot' && (
          <div>
            <h2 className="modal-title">Reset Password</h2>
            <p className="modal-desc">
              {magicResetToken
                ? 'Your reset link is verified. Set your new password below.'
                : 'Enter your registered email to receive a 6-digit reset code.'}
            </p>

            {!magicResetToken && (
              <form onSubmit={handleForgotStep1} style={{ marginBottom: '16px' }}>
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
                    <button
                      type="submit"
                      className="btn btn-secondary"
                      style={{ padding: '8px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                      disabled={loading || cooldown > 0}
                    >
                      {cooldown > 0 ? `${cooldown}s` : 'Send Code'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            <form onSubmit={handleForgotStep2}>
              {!magicResetToken && (
                <div className="form-group">
                  <label>6-Digit Reset Code</label>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '8px 0 14px' }} onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputRefs.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        style={{
                          width: '42px',
                          height: '50px',
                          fontSize: '22px',
                          fontWeight: 800,
                          textAlign: 'center',
                          background: '#030712',
                          border: digit ? '2px solid #0ea5e9' : '2px solid #1e293b',
                          borderRadius: '8px',
                          color: '#38bdf8',
                          outline: 'none',
                          fontFamily: 'monospace'
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

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
              <span onClick={() => { setView('login'); setError(''); setMessage(''); setMagicResetToken(null); }}>Back to Sign In</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
