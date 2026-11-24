import React, { useState, useEffect } from 'react';
import SEOHead from './SEOHead';
import {
  Download,
  Shield,
  Zap,
  Clock,
  Sparkles,
  CreditCard,
  Key,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Search,
  Lock,
  ArrowUpRight
} from 'lucide-react';

export default function UserDashboard({ user, onOpenAuth, onOpenVip, onNavigate }) {
  const [activeTab, setActiveTab] = useState('history'); // history | billing | security
  const [profileData, setProfileData] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historySearch, setHistorySearch] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, success: null, error: null });

  const token = typeof window !== 'undefined' ? localStorage.getItem('savezonix_token') : null;

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    fetchProfile();
    fetchHistory();
    fetchInvoices();
  }, [token]);

  async function fetchProfile() {
    try {
      const res = await fetch('/api/auth/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setProfileData(data.user);
      }
    } catch (err) {
      console.warn('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistory() {
    try {
      const res = await fetch('/api/downloads/history?limit=30', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        setHistoryItems(data.history);
      }
    } catch {}
  }

  async function fetchInvoices() {
    try {
      const res = await fetch('/api/payment/invoices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.invoices)) {
        setInvoices(data.invoices);
      }
    } catch {}
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ loading: false, success: null, error: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus({ loading: false, success: null, error: 'Password must be at least 6 characters long.' });
      return;
    }

    setPasswordStatus({ loading: true, success: null, error: null });
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setPasswordStatus({ loading: false, success: 'Password changed successfully!', error: null });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordStatus({ loading: false, success: null, error: data.message || 'Failed to update password.' });
      }
    } catch (err) {
      setPasswordStatus({ loading: false, success: null, error: err.message });
    }
  }

  if (!user && !token) {
    return (
      <div className="section-container" style={{ minHeight: '65vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '40px 28px',
          backdropFilter: 'blur(20px)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(56, 189, 248, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#38bdf8'
          }}>
            <Lock size={32} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', marginBottom: '10px' }}>
            Account Sign-In Required
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14.5px', lineHeight: 1.6, marginBottom: '28px' }}>
            Sign in or create a free SaveZonix account to access your personal dashboard, daily quota status, and saved download history.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={onOpenAuth}
              className="btn-plan primary"
              style={{ padding: '12px 28px' }}
            >
              Sign In / Register
            </button>
            <button
              onClick={() => onNavigate('/')}
              className="btn-plan secondary"
              style={{ padding: '12px 20px' }}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const effectiveUser = profileData || user || {};
  const currentPlan = effectiveUser.plan || { name: 'Free', slug: 'free', maxVideoQuality: '720p', dailyDownloadLimit: 5 };
  const quota = effectiveUser.quota || { dailyLimit: 5, usedToday: 0, remainingToday: 5 };
  const isUnlimited = quota.dailyLimit === -1;
  const quotaPercentage = isUnlimited
    ? 100
    : Math.min(100, Math.round((quota.usedToday / Math.max(1, quota.dailyLimit)) * 100));

  const filteredHistory = historyItems.filter((item) => {
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    return (item.title || '').toLowerCase().includes(q) || (item.fileName || '').toLowerCase().includes(q);
  });

  return (
    <div className="section-container" style={{ paddingTop: '32px', minHeight: '80vh' }}>
      <SEOHead
        title="My Account & Dashboard — SaveZonix"
        description="Check today's download quota, view past downloads, and manage your SaveZonix subscription plan."
        canonical="https://savezonix-pro.vercel.app/dashboard"
      />
      {/* Top Banner / Welcome Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              My Account &amp; Dashboard
            </h1>
            <span style={{
              background: currentPlan.slug === 'ultimate'
                ? 'linear-gradient(135deg, #7928ca 0%, #ff0080 100%)'
                : currentPlan.slug === 'pro'
                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                : currentPlan.slug === 'basic'
                ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)'
                : 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              {currentPlan.name} Plan
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '14.5px', margin: 0 }}>
            Logged in as <strong style={{ color: '#f1f5f9' }}>{effectiveUser.email}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => onNavigate('/pricing')}
            className="btn-plan primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '13.5px' }}
          >
            <Sparkles size={16} /> Upgrade / Change Plan
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '36px'
      }}>
        {/* Card 1: Daily Quota Gauge */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '24px',
          backdropFilter: 'blur(16px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ color: '#94a3b8', fontSize: '13.5px', fontWeight: 600 }}>TODAY'S USAGE</span>
            <span style={{
              background: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '8px'
            }}>
              Resets 12 AM IST
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#f8fafc' }}>
              {quota.usedToday}
            </span>
            <span style={{ color: '#64748b', fontSize: '15px' }}>
              / {isUnlimited ? '∞ Unlimited' : `${quota.dailyLimit} downloads`}
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: '999px',
            overflow: 'hidden',
            marginBottom: '12px'
          }}>
            <div style={{
              width: `${quotaPercentage}%`,
              height: '100%',
              background: isUnlimited
                ? 'linear-gradient(90deg, #10b981, #059669)'
                : quotaPercentage >= 100
                ? '#ef4444'
                : 'linear-gradient(90deg, #38bdf8, #6366f1)',
              borderRadius: '999px',
              transition: 'width 0.4s ease'
            }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#94a3b8' }}>
            <span>{isUnlimited ? 'Unlimited downloads' : `${quota.remainingToday} left today`}</span>
            <span style={{ color: '#38bdf8' }}>Max {currentPlan.maxVideoQuality}</span>
          </div>
        </div>

        {/* Card 2: Active Plan Perks */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '24px',
          backdropFilter: 'blur(16px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ color: '#94a3b8', fontSize: '13.5px', fontWeight: 600 }}>PLAN STATUS</span>
            <span style={{
              background: effectiveUser.vipExpiresAt ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: effectiveUser.vipExpiresAt ? '#fbbf24' : '#34d399',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '8px'
            }}>
              {effectiveUser.vipExpiresAt ? 'Active Subscription' : 'Free Forever'}
            </span>
          </div>

          <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
            SaveZonix {currentPlan.name}
          </div>

          <div style={{ color: '#94a3b8', fontSize: '13.5px', marginBottom: '16px' }}>
            {effectiveUser.vipExpiresAt
              ? `Renews on ${new Date(effectiveUser.vipExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : 'Upgrade to PRO for 4K video, playlists & high-speed acceleration.'}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11.5px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px 8px', borderRadius: '6px', color: '#cbd5e1' }}>
              ✓ {currentPlan.maxVideoQuality} Video
            </span>
            <span style={{ fontSize: '11.5px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px 8px', borderRadius: '6px', color: '#cbd5e1' }}>
              ✓ {currentPlan.maxAudioQuality || 128}kbps MP3
            </span>
            <span style={{ fontSize: '11.5px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px 8px', borderRadius: '6px', color: '#cbd5e1' }}>
              {currentPlan.playlistDownload ? '✓ Playlists' : '✗ No Playlists'}
            </span>
          </div>
        </div>

        {/* Card 3: Speed & Engine Priority */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '24px',
          backdropFilter: 'blur(16px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ color: '#94a3b8', fontSize: '13.5px', fontWeight: 600 }}>ENGINE ALLOCATION</span>
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700 }}>
              <Zap size={13} /> Active
            </span>
          </div>

          <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
            {currentPlan.speedPriority === 'ultra' ? 'Ultra 256-Thread Speed' : currentPlan.speedPriority === 'high' ? 'High Speed Turbo' : 'Standard Speed (64 Threads)'}
          </div>

          <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
            {currentPlan.ads ? 'Includes sponsored links and occasional ads.' : '100% Ad-Free, clean uninterrupted downloads.'}
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '24px'
      }}>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'history' ? '#38bdf8' : '#94a3b8',
            fontWeight: 600,
            fontSize: '14.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Clock size={16} /> Download History ({historyItems.length})
        </button>

        <button
          onClick={() => setActiveTab('billing')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'billing' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'billing' ? '#38bdf8' : '#94a3b8',
            fontWeight: 600,
            fontSize: '14.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CreditCard size={16} /> Invoices &amp; Payments ({invoices.length})
        </button>

        <button
          onClick={() => setActiveTab('security')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'security' ? '2px solid #38bdf8' : '2px solid transparent',
            color: activeTab === 'security' ? '#38bdf8' : '#94a3b8',
            fontWeight: 600,
            fontSize: '14.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Key size={16} /> Security &amp; Password
        </button>
      </div>

      {/* Tab 1: Download History */}
      {activeTab === 'history' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', maxWidth: '320px', width: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search history..."
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '13.5px'
                }}
              />
            </div>
            <button
              onClick={fetchHistory}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '8px 14px',
                borderRadius: '8px',
                color: '#cbd5e1',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {filteredHistory.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 20px',
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              color: '#94a3b8'
            }}>
              <Download size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ margin: '0 0 12px 0', fontSize: '15px' }}>No downloads found in your history.</p>
              <button
                onClick={() => onNavigate('/')}
                className="btn-plan secondary"
                style={{ fontSize: '13px', padding: '8px 18px' }}
              >
                Go to Downloader
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredHistory.map((item) => (
                <div
                  key={item._id || item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '12px',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '240px', flex: 1 }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '8px',
                      background: 'rgba(56, 189, 248, 0.1)',
                      color: '#38bdf8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Download size={20} />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '14px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {item.title || item.fileName || 'Media Item'}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>
                        <span>{item.platform || 'Web'}</span>
                        <span>•</span>
                        <span style={{ color: '#38bdf8' }}>{item.quality || '1080p'}</span>
                        <span>•</span>
                        <span>{item.format ? item.format.toUpperCase() : 'MP4'}</span>
                        <span>•</span>
                        <span>{new Date(item.createdAt || item.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {item.originalUrl && (
                      <a
                        href={item.originalUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: '6px 12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#cbd5e1',
                          fontSize: '12.5px',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        Source <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Billing & Invoices */}
      {activeTab === 'billing' && (
        <div>
          {invoices.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px 20px',
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              color: '#94a3b8'
            }}>
              <CreditCard size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ margin: '0 0 12px 0', fontSize: '15px' }}>No payment receipts found on your account.</p>
              <button
                onClick={() => onNavigate('/pricing')}
                className="btn-plan primary"
                style={{ fontSize: '13px', padding: '8px 20px' }}
              >
                Browse Plans
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {invoices.map((inv) => (
                <div
                  key={inv._id || inv.orderId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '12px',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '14.5px' }}>
                      SaveZonix {inv.plan ? inv.plan.toUpperCase() : 'VIP'} Subscription
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '12.5px', marginTop: '3px' }}>
                      Order: {inv.orderId} • {new Date(inv.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#34d399' }}>
                      ₹{inv.amount}
                    </div>
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600
                    }}>
                      Paid
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Security & Password */}
      {activeTab === 'security' && (
        <div style={{ maxWidth: '520px' }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
              Change Password
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '13.5px', marginBottom: '20px' }}>
              Ensure your account is using a long, random password to stay secure.
            </p>

            {passwordStatus.success && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: '#34d399', fontSize: '13.5px', marginBottom: '16px' }}>
                <CheckCircle size={16} /> {passwordStatus.success}
              </div>
            )}
            {passwordStatus.error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '13.5px', marginBottom: '16px' }}>
                <AlertCircle size={16} /> {passwordStatus.error}
              </div>
            )}

            <form onSubmit={handlePasswordChange}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: '6px' }}>
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: '6px' }}>
                  New Password (min. 6 characters)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc', fontSize: '14px' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: '6px' }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc', fontSize: '14px' }}
                />
              </div>

              <button
                type="submit"
                disabled={passwordStatus.loading}
                className="btn-plan primary"
                style={{ width: '100%', padding: '11px', fontSize: '14px' }}
              >
                {passwordStatus.loading ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
