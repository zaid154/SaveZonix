import React, { useState } from 'react';

export default function UpgradeVipModal({ isOpen, onClose, onSuccess, user }) {
  const [selectedPlan, setSelectedPlan] = useState('annual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Guest inputs
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');

  // Offline license key
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');

  if (!isOpen) return null;

  function loadRazorpayScript() {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        return resolve(true);
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function handleCheckout() {
    setError('');
    setLoading(true);

    try {
      const email = user?.email || guestEmail.trim();
      const name = user?.name || guestName.trim() || 'Customer';

      if (!email) {
        setError('Please enter a valid email address to associate with your subscription.');
        setLoading(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Unable to load payment gateway. Check your internet connection.');
      }

      const token = localStorage.getItem('savezonix_token') || localStorage.getItem('savezonix_cloud_token') || '';
      const orderRes = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          plan: selectedPlan,
          email,
          name
        })
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Failed to create payment order');
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount * 100,
        currency: orderData.currency || 'INR',
        name: 'SaveZonix',
        description: `${selectedPlan.toUpperCase()} VIP Subscription`,
        order_id: orderData.orderId,
        prefill: {
          name,
          email
        },
        theme: {
          color: '#2563eb'
        },
        handler: async function (response) {
          try {
            setLoading(true);
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: selectedPlan,
                userId: orderData.user?.id,
                userEmail: email,
                method: 'Razorpay UPI / Online'
              })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || 'Payment verification failed');
            }

            if (verifyData.token) {
              localStorage.setItem('savezonix_token', verifyData.token);
              localStorage.setItem('savezonix_cloud_token', verifyData.token);
            }
            if (verifyData.user) {
              localStorage.setItem('savezonix_user', JSON.stringify(verifyData.user));
              localStorage.setItem('savezonix_cloud_user', JSON.stringify(verifyData.user));
            }

            setSuccessMsg(`Your ${selectedPlan} VIP subscription is now active! All restrictions have been unlocked.`);
            if (onSuccess) onSuccess(verifyData.user);
          } catch (err) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleRedeemKey(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const email = user?.email || guestEmail.trim();
      if (!email) {
        setError('Please enter your email to bind the license key to your account.');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('savezonix_token') || localStorage.getItem('savezonix_cloud_token') || '';
      const res = await fetch('/api/payment/redeem-license', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ licenseKey, email })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid or expired key');

      if (data.token) {
        localStorage.setItem('savezonix_token', data.token);
        localStorage.setItem('savezonix_cloud_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('savezonix_user', JSON.stringify(data.user));
        localStorage.setItem('savezonix_cloud_user', JSON.stringify(data.user));
      }

      setSuccessMsg('License key activated successfully! All VIP capabilities are enabled.');
      if (onSuccess) onSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#0d131f',
          border: '1px solid #1e293b',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.7)',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            fontSize: '18px',
            cursor: 'pointer'
          }}
        >
          ✕
        </button>

        {successMsg ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                margin: '0 auto 16px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 700
              }}
            >
              ✓
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: '0 0 8px 0' }}>
              Subscription Verified
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              {successMsg}
            </p>
            <button
              onClick={onClose}
              style={{
                padding: '10px 24px',
                background: '#2563eb',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Continue to Application
            </button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '22px' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '16px',
                  color: '#fbbf24',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.6px',
                  textTransform: 'uppercase',
                  marginBottom: '10px'
                }}
              >
                VIP Pro Membership
              </span>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px 0' }}>
                Unlock Full Engine Capabilities
              </h2>
              <p style={{ color: '#64748b', fontSize: '12.5px', margin: 0 }}>
                High-throughput gigabit speed, 4K HDR streams, and unlimited daily downloads.
              </p>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#f87171', fontSize: '12px', marginBottom: '16px' }}>
                {error}
              </div>
            )}

            {/* Plan Selector Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
              {/* Monthly */}
              <div
                onClick={() => setSelectedPlan('monthly')}
                style={{
                  padding: '14px 10px',
                  background: selectedPlan === 'monthly' ? '#131f37' : '#060a12',
                  border: `1.5px solid ${selectedPlan === 'monthly' ? '#2563eb' : '#1e293b'}`,
                  borderRadius: '10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: '0.15s'
                }}
              >
                <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>Monthly</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '4px 0 2px 0' }}>
                  ₹99
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748b' }}>30 Days</div>
              </div>

              {/* Annual */}
              <div
                onClick={() => setSelectedPlan('annual')}
                style={{
                  padding: '14px 10px',
                  background: selectedPlan === 'annual' ? '#131f37' : '#060a12',
                  border: `1.5px solid ${selectedPlan === 'annual' ? '#2563eb' : '#1e293b'}`,
                  borderRadius: '10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: '0.15s'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-9px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '8px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Best Value
                </div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>Annual</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '4px 0 2px 0' }}>
                  ₹799
                </div>
                <div style={{ fontSize: '10.5px', color: '#38bdf8' }}>Save ₹389</div>
              </div>

              {/* Lifetime */}
              <div
                onClick={() => setSelectedPlan('lifetime')}
                style={{
                  padding: '14px 10px',
                  background: selectedPlan === 'lifetime' ? '#131f37' : '#060a12',
                  border: `1.5px solid ${selectedPlan === 'lifetime' ? '#2563eb' : '#1e293b'}`,
                  borderRadius: '10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: '0.15s'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '-9px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#f59e0b',
                    color: '#000000',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '8px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Founder Pass
                </div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>Lifetime</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '4px 0 2px 0' }}>
                  ₹1,999
                </div>
                <div style={{ fontSize: '10.5px', color: '#fbbf24' }}>One-Time</div>
              </div>
            </div>

            {/* Feature Checklist */}
            <div style={{ background: '#060a12', border: '1px solid #1a2333', borderRadius: '10px', padding: '14px', marginBottom: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: '#94a3b8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span>
                  <span>Uncapped Gigabit Speeds</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span>
                  <span>4K / 8K HDR Stream Extraction</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span>
                  <span>Unlimited Daily Downloads</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span>
                  <span>128-Thread Direct Tunneling</span>
                </div>
              </div>
            </div>

            {/* User Details Input if Guest */}
            {!user && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: '#94a3b8', marginBottom: '4px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="user@example.com"
                    style={{ width: '100%', padding: '8px 10px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '6px', color: '#f8fafc', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: '#94a3b8', marginBottom: '4px' }}>
                    Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your Name"
                    style={{ width: '100%', padding: '8px 10px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '6px', color: '#f8fafc', fontSize: '12px' }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: '#2563eb',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                marginBottom: '12px'
              }}
            >
              {loading ? 'Processing...' : `Pay via UPI / Card (₹${selectedPlan === 'monthly' ? '99' : selectedPlan === 'annual' ? '799' : '1,999'})`}
            </button>

            {/* License Key Redemption Toggle */}
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setShowKeyInput(!showKeyInput)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '11.5px',
                  textDecoration: 'underline',
                  cursor: 'pointer'
                }}
              >
                {showKeyInput ? 'Hide license redemption' : 'Have an offline license key? Redeem here'}
              </button>
            </div>

            {showKeyInput && (
              <form onSubmit={handleRedeemKey} style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="SZ-VIP-..."
                  style={{ flex: 1, padding: '8px 10px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '6px', color: '#f8fafc', fontSize: '12px' }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: '8px 14px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '12px', cursor: 'pointer' }}
                >
                  Activate
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
