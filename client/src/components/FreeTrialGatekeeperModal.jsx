import React, { useEffect } from 'react';
import { Shield, Zap, Sparkles, Check, Crown, X, ArrowRight, Lock } from 'lucide-react';

const ChromeIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M12 12m-9.5 0a9.5 9.5 0 1 0 19 0a9.5 9.5 0 1 0 -19 0Z"/>
    <path fill="#EA4335" d="M12 2.5C7.9 2.5 4.3 4.9 2.7 8.3l4.8 8.3L12 12l8.2 0C19.1 6.6 15.9 2.5 12 2.5z"/>
    <path fill="#FBBC05" d="M2.7 8.3C1.9 9.9 1.5 11.7 1.5 13.5c0 5 3.5 9.2 8.2 10.3l4.8-8.3-2.5-3.5L2.7 8.3z"/>
    <path fill="#34A853" d="M9.7 23.8c.8.2 1.5.2 2.3.2 5.8 0 10.5-4.7 10.5-10.5 0-1.8-.5-3.5-1.3-5L12 12l-2.3 11.8z"/>
    <circle cx="12" cy="12" r="4.8" fill="#FFFFFF"/>
    <circle cx="12" cy="12" r="3.8" fill="#1A73E8"/>
  </svg>
);

export default function FreeTrialGatekeeperModal({ isOpen, onClose, onOpenExtension, onOpenVip, onOpenAuth }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sz-modal-box gatekeeper-modal-box"
        style={{
          width: '100%',
          maxWidth: '680px',
          background: 'linear-gradient(165deg, #0e172a 0%, #060b14 100%)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          boxShadow: '0 25px 70px -15px rgba(0, 0, 0, 0.95), 0 0 35px rgba(56, 189, 248, 0.2)',
          color: '#f8fafc',
          position: 'relative',
          maxHeight: '94dvh',
          overflowY: 'auto'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#94a3b8',
            width: '44px',
            height: '44px',
            minWidth: '44px',
            minHeight: '44px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.color = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <X size={18} />
        </button>

        {/* Header Badge & Title */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.5px',
              marginBottom: '12px'
            }}
          >
            <Lock size={14} /> FREE TRIAL LIMIT REACHED (3/3 USED)
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: '#f8fafc' }}>
            Free Web Trial Limit Reached
          </h2>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
            You have used all 3 free trial downloads. Choose an option below to continue downloading:
          </p>
        </div>

        {/* Dual Options Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '16px', marginBottom: '24px' }}>
          {/* Option 1: Chrome Extension (Recommended - 100% Free) */}
          <div
            className="gatekeeper-extension-card"
            style={{
              background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
              border: '2px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '16px',
              padding: '20px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-11px',
                left: '20px',
                background: '#10b981',
                color: '#022c22',
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 10px',
                borderRadius: '9999px',
                letterSpacing: '0.5px'
              }}
            >
              100% FREE FOREVER
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', marginTop: '4px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#34d399'
                }}
              >
                <ChromeIcon size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  SaveZonix Extension
                </h3>
                <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 600 }}>Zero Server Delays</span>
              </div>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li style={{ fontSize: '13px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={15} color="#10b981" /> <strong>Unlimited 4K & 8K</strong> Downloads
              </li>
              <li style={{ fontSize: '13px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={15} color="#10b981" /> <strong>Full Speed Direct</strong> Downloads (PC Hardware)
              </li>
              <li style={{ fontSize: '13px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={15} color="#10b981" /> Built-in <strong>Ad & Popup Shield</strong>
              </li>
              <li style={{ fontSize: '13px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={15} color="#10b981" /> No login or payment required
              </li>
            </ul>

            <button
              onClick={() => {
                onClose();
                if (onOpenExtension) onOpenExtension();
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <Zap size={16} /> Install Free Extension <ArrowRight size={15} />
            </button>
          </div>

          {/* Option 2: VIP Cloud Pass */}
          <div
            style={{
              background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              borderRadius: '16px',
              padding: '20px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-11px',
                left: '20px',
                background: '#8b5cf6',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 10px',
                borderRadius: '9999px',
                letterSpacing: '0.5px'
              }}
            >
              VIP CLOUD PASS
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', marginTop: '4px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(139, 92, 246, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#a78bfa'
                }}
              >
                <Crown size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  VIP Cloud Web
                </h3>
                <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 600 }}>Mobile, Tablet & PC</span>
              </div>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li style={{ fontSize: '13px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={15} color="#a78bfa" /> <strong>Direct Web Downloads</strong> (No extension)
              </li>
              <li style={{ fontSize: '13px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={15} color="#a78bfa" /> Works on <strong>iPhone, Android, Mac & PC</strong>
              </li>
              <li style={{ fontSize: '13px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={15} color="#a78bfa" /> Full <strong>Playlist Batch Extraction</strong>
              </li>
              <li style={{ fontSize: '13px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={15} color="#a78bfa" /> Dedicated High-Speed Cloud Bandwidth
              </li>
            </ul>

            <button
              onClick={() => {
                onClose();
                if (onOpenVip) onOpenVip();
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <Crown size={16} /> Upgrade to VIP (₹99 / $4.99) <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* Sign In Footer for Existing VIP Users */}
        <div style={{ textAlign: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>
            Already purchased a VIP subscription?{' '}
            <button
              onClick={() => {
                onClose();
                if (onOpenAuth) onOpenAuth();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#38bdf8',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Sign In to unlock
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
