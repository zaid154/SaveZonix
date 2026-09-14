import React, { useState } from 'react';
import { IconLock } from './AdminIcons';

export default function SecurityTab({ adminToken }) {
  const [testEmailInput, setTestEmailInput] = useState('');
  const [emailCheckResult, setEmailCheckResult] = useState(null);
  const [emailChecking, setEmailChecking] = useState(false);

  async function handleTestEmail(e) {
    e.preventDefault();
    if (!testEmailInput.trim()) return;
    setEmailChecking(true);
    setEmailCheckResult(null);
    try {
      const res = await fetch('/api/admin/security/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {})
        },
        body: JSON.stringify({ email: testEmailInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setEmailCheckResult(data);
      } else {
        alert(data.error || 'Email test failed.');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setEmailChecking(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
            <IconLock size={16} color="#34d399" />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
            Disposable Email &amp; Anti-Spam Security Sandbox
          </h3>
        </div>
        <p style={{ color: '#64748b', fontSize: '12.5px', marginBottom: '20px' }}>
          Real-time validation against disposable mailbox services to prevent multi-account quota abuse.
        </p>

        <form onSubmit={handleTestEmail} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <input
            type="email"
            placeholder="Enter email address to test (e.g., test@mailinator.com or user@gmail.com)"
            value={testEmailInput}
            onChange={(e) => setTestEmailInput(e.target.value)}
            style={{ flex: 1, minWidth: '280px', padding: '11px 14px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', outline: 'none' }}
            required
          />
          <button
            type="submit"
            disabled={emailChecking}
            style={{ padding: '11px 22px', background: '#2563eb', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            {emailChecking ? 'Testing...' : 'Verify Mailbox Integrity'}
          </button>
        </form>

        {emailCheckResult && (
          <div style={{
            padding: '16px',
            borderRadius: '8px',
            border: `1px solid ${emailCheckResult.isBlocked ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
            background: emailCheckResult.isBlocked ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '13.5px', color: emailCheckResult.isBlocked ? '#f87171' : '#34d399' }}>
                Status: {emailCheckResult.status}
              </span>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Domain: {emailCheckResult.domain}</span>
            </div>
            <div style={{ fontSize: '12.5px', color: '#cbd5e1' }}>
              {emailCheckResult.reason}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>Active Blacklist Filter Summary</h3>
        <p style={{ color: '#64748b', fontSize: '12.5px', marginBottom: '14px' }}>
          The registration engine immediately blocks user registration or guest access from any of these known disposable mailbox providers:
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            'mailinator.com', 'temp-mail.org', 'guerrillamail.com', '10minutemail.com',
            'yopmail.com', 'burnermail.io', 'fakeinbox.com', 'trashmail.com',
            'sharklasers.com', 'dispostable.com', 'crazymailing.com', 'nada.ltd'
          ].map((domain) => (
            <span key={domain} style={{ padding: '4px 10px', background: '#060a12', border: '1px solid #1a2333', borderRadius: '6px', color: '#f87171', fontSize: '11.5px', fontWeight: 500 }}>
              {domain}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
