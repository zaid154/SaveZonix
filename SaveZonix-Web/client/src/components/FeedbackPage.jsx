import React, { useState, useEffect } from 'react';

// Crisp SVG Icons (replacing amateur emojis)
const Icons = {
  AlertCircle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Gauge: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 14 4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  ),
  Sliders: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  ),
  Globe: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  Repeat: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  ),
  RotateCcw: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  ),
  Bug: () => (
    <svg width="18" height="24" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="8" height="14" x="8" y="6" rx="4" />
      <path d="m19 7-3 2" />
      <path d="m5 7 3 2" />
      <path d="m19 19-3-2" />
      <path d="m5 19 3-2" />
      <path d="M20 13h-4" />
      <path d="M4 13h4" />
      <path d="m10 4 1 2" />
      <path d="m14 4-1 2" />
    </svg>
  ),
  Message: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  HeaderNote: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  CheckCircle: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  Download: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Star: ({ filled }) => (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={filled ? '#fbbf24' : 'none'}
      stroke={filled ? '#fbbf24' : '#64748b'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: 'all 0.15s ease' }}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
};

export default function FeedbackPage({ onNavigate }) {
  const [source, setSource] = useState('extension');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get('source') || params.get('from') || 'extension';
    setSource(src.toLowerCase());
  }, []);

  const isDesktop = source === 'desktop' || source === 'app' || source === 'windows';

  const REASONS = [
    { id: 'failed_download', label: 'Media streams failed to capture or download', Icon: Icons.AlertCircle },
    { id: 'too_slow', label: 'Download speeds were slower than expected', Icon: Icons.Gauge },
    { id: 'hard_to_use', label: 'User interface was confusing or difficult to navigate', Icon: Icons.Sliders },
    { id: 'missing_sites', label: 'Lacked support for platforms or sites I use', Icon: Icons.Globe },
    { id: 'found_alternative', label: 'Switched to a different media downloader', Icon: Icons.Repeat },
    { id: 'temporary', label: 'Temporary uninstallation / clean reinstall', Icon: Icons.RotateCcw },
    { id: 'glitch', label: 'Encountered unexpected software errors or crashes', Icon: Icons.Bug },
    { id: 'other', label: 'Other specific reasons or requirements', Icon: Icons.Message }
  ];

  const ratingLabels = ['', 'Poor experience', 'Below expectations', 'Average', 'Good', 'Excellent'];

  function toggleReason(id) {
    if (selectedReasons.includes(id)) {
      setSelectedReasons(selectedReasons.filter(r => r !== id));
    } else {
      setSelectedReasons([...selectedReasons, id]);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      source: isDesktop ? 'desktop' : 'extension',
      rating,
      reasons: selectedReasons,
      comment,
      email,
      timestamp: new Date().toISOString()
    };

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn('Feedback submission offline fallback:', err);
    } finally {
      setIsSubmitting(false);
      setSubmitted(true);
    }
  }

  return (
    <div style={{
      minHeight: '85vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 16px',
      position: 'relative'
    }}>
      <div style={{
        maxWidth: '640px',
        width: '100%',
        background: 'rgba(11, 17, 32, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        padding: '36px 32px',
        boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(56, 189, 248, 0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle Ambient Glow */}
        <div style={{
          position: 'absolute',
          top: '-80px',
          right: '-80px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        {!submitted ? (
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                margin: '0 auto 16px auto',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icons.HeaderNote />
              </div>

              <h1 style={{
                fontSize: '22px',
                fontWeight: 700,
                color: '#f8fafc',
                letterSpacing: '-0.02em',
                marginBottom: '8px'
              }}>
                SaveZonix Uninstallation Feedback
              </h1>
              <p style={{
                fontSize: '13.5px',
                color: '#94a3b8',
                lineHeight: 1.55,
                maxWidth: '480px',
                margin: '0 auto'
              }}>
                You recently removed the <strong>SaveZonix {isDesktop ? 'Desktop Application' : 'Browser Extension'}</strong>.
                Sharing your experience takes less than a minute and directly influences our next release.
              </p>
            </div>

            {/* Rating */}
            <div style={{ marginBottom: '26px', textAlign: 'center' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '10px' }}>
                How would you rate your overall experience?
              </label>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '6px',
                        cursor: 'pointer',
                        transform: isFilled ? 'scale(1.12)' : 'scale(1)',
                        transition: 'transform 0.15s ease'
                      }}
                      title={`${star} out of 5`}
                    >
                      <Icons.Star filled={isFilled} />
                    </button>
                  );
                })}
              </div>
              {(hoverRating > 0 || rating > 0) && (
                <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600, marginTop: '6px' }}>
                  {ratingLabels[hoverRating || rating]}
                </div>
              )}
            </div>

            {/* Reasons Multi-Choice */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '12px' }}>
                What was the primary factor behind uninstalling? <span style={{ color: '#64748b', fontWeight: 400 }}>(Select all applicable)</span>
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '8px'
              }}>
                {REASONS.map(r => {
                  const isChecked = selectedReasons.includes(r.id);
                  const IconComponent = r.Icon;
                  return (
                    <div
                      key={r.id}
                      onClick={() => toggleReason(r.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        background: isChecked ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        border: isChecked ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.07)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <IconComponent />
                      </div>
                      <span style={{ fontSize: '12.5px', color: isChecked ? '#f8fafc' : '#cbd5e1', fontWeight: isChecked ? 600 : 400, lineHeight: 1.35 }}>
                        {r.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed Comment Box */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                Detailed feedback or feature requests
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share any specific issues, unsupported URLs, or improvements you would like to see..."
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Optional Email */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
                Email address <span style={{ color: '#64748b' }}>(Optional — if you'd like follow-up once addressed)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={{
                  width: '100%',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '11px 20px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 16px rgba(14, 165, 233, 0.3)',
                  transition: 'all 0.2s ease',
                  opacity: isSubmitting ? 0.7 : 1
                }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/')}
                style={{
                  padding: '11px 18px',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  color: '#94a3b8',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Skip
              </button>
            </div>
          </form>
        ) : (
          /* Thank You State */
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 20px auto',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icons.CheckCircle />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
              Thank You for Your Feedback
            </h2>
            <p style={{ fontSize: '13.5px', color: '#94a3b8', maxWidth: '440px', margin: '0 auto 28px auto', lineHeight: 1.55 }}>
              Your response has been recorded. Our engineering team reviews all uninstall feedback to resolve performance bottlenecks and improve cross-platform stability.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => onNavigate('/')}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Return to Homepage
              </button>

              <a
                href="https://github.com/zaid154/SaveZonix/releases/latest"
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px'
                }}
              >
                <Icons.Download />
                <span>Reinstall SaveZonix</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


