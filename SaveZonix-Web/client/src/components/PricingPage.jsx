import React, { useState, useEffect } from 'react';
import SEOHead from './SEOHead';
import { Check, Sparkles, Zap, Shield, HelpCircle, ArrowRight, Tag } from 'lucide-react';

export default function PricingPage({ user, onOpenAuth, onNavigate }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState('monthly'); // monthly | yearly
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(null); // planId being checked out

  useEffect(() => {
    fetch('/api/plans')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.plans) && data.plans.length > 0) {
          setPlans(data.plans);
        } else {
          // Fallback static default plans
          setPlans([
            { id: 'free', slug: 'free', name: 'Free', priceINR: 0, dailyDownloadLimit: 5, maxVideoQuality: '720p', maxAudioQuality: 128, playlistDownload: false, speedPriority: 'standard', ads: true },
            { id: 'basic', slug: 'basic', name: 'Basic', priceINR: 49, dailyDownloadLimit: 25, maxVideoQuality: '1080p', maxAudioQuality: 192, playlistDownload: true, maxPlaylistItems: 10, speedPriority: 'standard', ads: false },
            { id: 'pro', slug: 'pro', name: 'Pro', priceINR: 99, dailyDownloadLimit: 100, maxVideoQuality: '4K', maxAudioQuality: 320, playlistDownload: true, maxPlaylistItems: 50, speedPriority: 'high', ads: false, isPopular: true },
            { id: 'ultimate', slug: 'ultimate', name: 'Ultimate', priceINR: 199, dailyDownloadLimit: -1, maxVideoQuality: '4K', maxAudioQuality: 320, playlistDownload: true, maxPlaylistItems: 500, speedPriority: 'ultra', ads: false }
          ]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleApplyCoupon(e) {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await fetch('/api/payment/apply-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setAppliedCoupon(data);
        setCouponError(null);
      } else {
        setCouponError(data.message || 'Invalid coupon code');
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponError('Network error verifying coupon');
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleCheckout(plan) {
    if (plan.priceINR === 0) {
      onNavigate('/');
      return;
    }

    if (!user) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    setCheckoutLoading(plan._id || plan.id || plan.slug);

    try {
      const token = localStorage.getItem('savezonix_token');
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          planId: plan._id || plan.id || plan.slug,
          couponCode: appliedCoupon ? appliedCoupon.code : undefined,
          email: user?.email,
          name: user?.name
        })
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.success) {
        alert(orderData.error || orderData.message || 'Payment initiation failed.');
        setCheckoutLoading(null);
        return;
      }

      // Check if Razorpay script is available
      if (typeof window.Razorpay === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        await new Promise((resolve) => { script.onload = resolve; });
      }

      const options = {
        key: orderData.keyId,
        amount: Math.round(orderData.amount * 100),
        currency: orderData.currency || 'INR',
        name: 'SaveZonix Media Suite',
        description: `${plan.name} Subscription`,
        order_id: orderData.orderId,
        prefill: {
          name: user.name || '',
          email: user.email || ''
        },
        theme: {
          color: '#0284c7'
        },
        handler: async function (response) {
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: token ? `Bearer ${token}` : ''
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId: plan._id || plan.id || plan.slug,
                userId: user.id || user._id,
                userEmail: user.email
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              if (verifyData.token) {
                localStorage.setItem('savezonix_token', verifyData.token);
              }
              if (verifyData.user) {
                localStorage.setItem('savezonix_user', JSON.stringify(verifyData.user));
              }
              alert(`🎉 Payment Successful! You are now subscribed to ${plan.name}.`);
              onNavigate('/dashboard');
            } else {
              alert('Verification failed: ' + (verifyData.error || 'Please contact support.'));
            }
          } catch (vErr) {
            alert('Verification network error: ' + vErr.message);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert('Checkout error: ' + err.message);
    } finally {
      setCheckoutLoading(null);
    }
  }

  function getCalculatedPrice(plan) {
    if (plan.priceINR === 0) return 0;
    let base = plan.priceINR;
    if (billingCycle === 'yearly') {
      base = Math.round(base * 12 * 0.8); // 20% discount on yearly
    }
    if (appliedCoupon) {
      if (appliedCoupon.discountType === 'percentage') {
        base = base - (base * appliedCoupon.discountValue) / 100;
      } else {
        base = Math.max(1, base - appliedCoupon.discountValue);
      }
    }
    return Math.max(0, Math.round(base));
  }

  return (
    <div className="section-container" style={{ paddingTop: '40px', minHeight: '85vh' }}>
      <SEOHead
        title="Pricing & VIP Plans — SaveZonix: 4K Downloads & Playlists"
        description="Compare SaveZonix plans: Free, Basic, Pro, and Ultimate. Enjoy 4K video downloads, 320kbps MP3 conversion, batch playlists, and full speed acceleration."
        canonical="https://savezonix-pro.vercel.app/pricing"
      />
      {/* Page Header */}
      <div className="section-header" style={{ marginBottom: '28px' }}>
        <span className="section-tag">SaveZonix Pricing &amp; Plans</span>
        <h1 className="section-title">Upgrade Your Download Experience</h1>
        <p className="section-desc" style={{ maxWidth: '640px', margin: '0 auto' }}>
          Choose the right plan for your workflow. From everyday free downloads to unlimited 4K Ultra HD video and batch playlists.
        </p>

        {/* Billing Cycle Switcher */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '30px',
          padding: '4px',
          marginTop: '24px'
        }}>
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            style={{
              padding: '8px 20px',
              borderRadius: '24px',
              border: 'none',
              background: billingCycle === 'monthly' ? '#0284c7' : 'transparent',
              color: billingCycle === 'monthly' ? '#fff' : '#94a3b8',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('yearly')}
            style={{
              padding: '8px 20px',
              borderRadius: '24px',
              border: 'none',
              background: billingCycle === 'yearly' ? '#0284c7' : 'transparent',
              color: billingCycle === 'yearly' ? '#fff' : '#94a3b8',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            Annual Billing
            <span style={{
              background: '#10b981',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '10px'
            }}>
              SAVE 20%
            </span>
          </button>
        </div>
      </div>

      {/* Coupon Code Input Bar */}
      <div style={{ maxWidth: '420px', margin: '0 auto 40px auto' }}>
        <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Tag size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Have a promo code? e.g. PROMO20"
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: appliedCoupon ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                color: '#f8fafc',
                fontSize: '13.5px'
              }}
            />
          </div>
          <button
            type="submit"
            disabled={couponLoading || !couponCode.trim()}
            style={{
              padding: '10px 18px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '10px',
              color: '#38bdf8',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {couponLoading ? '...' : 'Apply'}
          </button>
        </form>

        {appliedCoupon && (
          <div style={{ fontSize: '12.5px', color: '#34d399', marginTop: '6px', textAlign: 'center' }}>
            ✓ Coupon <strong>{appliedCoupon.code}</strong> applied ({appliedCoupon.discountValue}{appliedCoupon.discountType === 'percentage' ? '%' : '₹'} off)!
          </div>
        )}
        {couponError && (
          <div style={{ fontSize: '12.5px', color: '#f87171', marginTop: '6px', textAlign: 'center' }}>
            ✗ {couponError}
          </div>
        )}
      </div>

      {/* Plans Pricing Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '24px',
        marginBottom: '60px'
      }}>
        {plans.map((plan) => {
          const isPro = plan.slug === 'pro' || plan.isPopular;
          const displayPrice = getCalculatedPrice(plan);

          return (
            <div
              key={plan._id || plan.id || plan.slug}
              style={{
                background: isPro ? 'rgba(14, 28, 54, 0.85)' : 'rgba(15, 23, 42, 0.7)',
                border: isPro ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '24px',
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: isPro ? '0 16px 48px -12px rgba(56, 189, 248, 0.25)' : 'none',
                backdropFilter: 'blur(16px)'
              }}
            >
              {isPro && (
                <div style={{
                  position: 'absolute',
                  top: '-13px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.8px',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)'
                }}>
                  MOST POPULAR
                </div>
              )}

              <div style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>
                {plan.name}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '16px' }}>
                <span style={{ fontSize: '36px', fontWeight: 900, color: '#f8fafc' }}>
                  ₹{displayPrice}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>
                  {plan.priceINR === 0 ? 'forever' : billingCycle === 'yearly' ? '/ year' : '/ month'}
                </span>
              </div>

              <p style={{ color: '#94a3b8', fontSize: '13.5px', lineHeight: 1.5, marginBottom: '24px', minHeight: '40px' }}>
                {plan.slug === 'free'
                  ? 'Great for casual personal downloads with standard resolution.'
                  : plan.slug === 'basic'
                  ? 'Enhanced speed and Full HD video for regular content viewers.'
                  : plan.slug === 'pro'
                  ? 'Maximum 4K Ultra HD clarity, high-speed engine, and batch playlists.'
                  : 'Unlimited downloads, 8K stream extraction, zero rate limits, and VIP support.'}
              </p>

              {/* Feature Checklist */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#e2e8f0' }}>
                  <Check size={16} color="#34d399" />
                  <strong>
                    {plan.dailyDownloadLimit === -1 ? 'Unlimited Daily Downloads' : `${plan.dailyDownloadLimit} Downloads / Day`}
                  </strong>
                </li>

                <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#e2e8f0' }}>
                  <Check size={16} color="#34d399" />
                  <span>Up to <strong>{plan.maxVideoQuality}</strong> Video Quality</span>
                </li>

                <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#e2e8f0' }}>
                  <Check size={16} color="#34d399" />
                  <span>Up to <strong>{plan.maxAudioQuality || 128} kbps</strong> MP3 Bitrate</span>
                </li>

                <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: plan.playlistDownload ? '#e2e8f0' : '#64748b' }}>
                  <Check size={16} color={plan.playlistDownload ? '#34d399' : '#475569'} />
                  <span>{plan.playlistDownload ? `Playlist Downloads (${plan.maxPlaylistItems || 50} items)` : 'No Playlist Downloads'}</span>
                </li>

                <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#e2e8f0' }}>
                  <Check size={16} color="#34d399" />
                  <span>{plan.speedPriority === 'ultra' ? 'Ultra 256-Thread Speed' : plan.speedPriority === 'high' ? 'High Speed Acceleration' : 'Standard 64-Thread Speed'}</span>
                </li>

                <li style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px', color: '#e2e8f0' }}>
                  <Check size={16} color="#34d399" />
                  <span>{plan.ads ? 'Standard Web Ads' : '100% Ad-Free Experience'}</span>
                </li>
              </ul>

              <button
                type="button"
                onClick={() => handleCheckout(plan)}
                disabled={checkoutLoading === (plan._id || plan.id || plan.slug)}
                className={`btn-plan ${isPro ? 'primary' : 'secondary'}`}
                style={{
                  width: '100%',
                  padding: '13px',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {checkoutLoading === (plan._id || plan.id || plan.slug) ? (
                  'Initiating...'
                ) : plan.priceINR === 0 ? (
                  'Use Free Plan'
                ) : (
                  <>Upgrade to {plan.name} <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Matrix Table */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        padding: '32px',
        backdropFilter: 'blur(16px)',
        marginBottom: '60px',
        overflowX: 'auto'
      }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', marginBottom: '20px' }}>
          Detailed Plan Feature Comparison
        </h2>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', fontSize: '13px' }}>
              <th style={{ padding: '12px 16px' }}>Feature</th>
              <th style={{ padding: '12px 16px' }}>Free</th>
              <th style={{ padding: '12px 16px' }}>Basic</th>
              <th style={{ padding: '12px 16px', color: '#38bdf8' }}>Pro</th>
              <th style={{ padding: '12px 16px' }}>Ultimate</th>
            </tr>
          </thead>
          <tbody style={{ color: '#e2e8f0', fontSize: '13.5px' }}>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <td style={{ padding: '14px 16px', fontWeight: 600 }}>Daily Downloads</td>
              <td style={{ padding: '14px 16px' }}>5 / day</td>
              <td style={{ padding: '14px 16px' }}>25 / day</td>
              <td style={{ padding: '14px 16px', color: '#38bdf8', fontWeight: 700 }}>100 / day</td>
              <td style={{ padding: '14px 16px', fontWeight: 700 }}>Unlimited</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <td style={{ padding: '14px 16px', fontWeight: 600 }}>Max Video Resolution</td>
              <td style={{ padding: '14px 16px' }}>720p HD</td>
              <td style={{ padding: '14px 16px' }}>1080p Full HD</td>
              <td style={{ padding: '14px 16px', color: '#38bdf8', fontWeight: 700 }}>4K Ultra HD</td>
              <td style={{ padding: '14px 16px', fontWeight: 700 }}>4K &amp; 8K</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <td style={{ padding: '14px 16px', fontWeight: 600 }}>Audio MP3 Bitrate</td>
              <td style={{ padding: '14px 16px' }}>128 kbps</td>
              <td style={{ padding: '14px 16px' }}>192 kbps</td>
              <td style={{ padding: '14px 16px', color: '#38bdf8', fontWeight: 700 }}>320 kbps High</td>
              <td style={{ padding: '14px 16px', fontWeight: 700 }}>320 kbps Studio</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <td style={{ padding: '14px 16px', fontWeight: 600 }}>Batch Playlists</td>
              <td style={{ padding: '14px 16px', color: '#64748b' }}>✗</td>
              <td style={{ padding: '14px 16px' }}>Up to 10</td>
              <td style={{ padding: '14px 16px', color: '#38bdf8', fontWeight: 700 }}>Up to 50</td>
              <td style={{ padding: '14px 16px', fontWeight: 700 }}>Up to 500</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <td style={{ padding: '14px 16px', fontWeight: 600 }}>Download Speed</td>
              <td style={{ padding: '14px 16px' }}>Standard</td>
              <td style={{ padding: '14px 16px' }}>Fast</td>
              <td style={{ padding: '14px 16px', color: '#38bdf8', fontWeight: 700 }}>High Priority</td>
              <td style={{ padding: '14px 16px', fontWeight: 700 }}>Ultra 256 Threads</td>
            </tr>
            <tr>
              <td style={{ padding: '14px 16px', fontWeight: 600 }}>Ad-Free Experience</td>
              <td style={{ padding: '14px 16px', color: '#64748b' }}>With Ads</td>
              <td style={{ padding: '14px 16px' }}>Ad-Free</td>
              <td style={{ padding: '14px 16px', color: '#38bdf8', fontWeight: 700 }}>Ad-Free</td>
              <td style={{ padding: '14px 16px', fontWeight: 700 }}>Ad-Free + VIP Support</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
