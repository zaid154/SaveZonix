import React, { useState, useEffect } from 'react';
import { Download, Copy, Check, X, Shield, Zap, ExternalLink, Sparkles } from 'lucide-react';

export default function ExtensionInstallModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const [downloadTriggered, setDownloadTriggered] = useState(false);

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

  const handleCopyUrl = () => {
    navigator.clipboard.writeText('chrome://extensions');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sz-extension-modal-box"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'linear-gradient(165deg, #0e172a 0%, #090e1a 100%)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 30px rgba(56, 189, 248, 0.15)',
          padding: '28px',
          color: '#f8fafc',
          position: 'relative',
          maxHeight: '92dvh',
          overflowY: 'auto'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            minWidth: '44px',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.borderColor = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          <X size={18} />
        </button>

        {/* Mobile Notice */}
        <div className="mobile-extension-notice" style={{ display: 'none', marginBottom: '14px', padding: '8px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', fontSize: '12px', color: '#38bdf8', textAlign: 'center' }}>
          Extension is designed for desktop Chrome, Edge, and Brave browsers.
        </div>

        {/* Header Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11.5px',
            fontWeight: 700,
            padding: '4px 10px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399',
            borderRadius: '20px'
          }}>
            <Sparkles size={13} /> 100% Free • Manifest V3
          </span>
          <span style={{
            fontSize: '11.5px',
            fontWeight: 600,
            padding: '4px 10px',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            color: '#7dd3fc',
            borderRadius: '20px'
          }}>
            Chrome, Edge &amp; Brave
          </span>
        </div>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M12 12m-9.5 0a9.5 9.5 0 1 0 19 0a9.5 9.5 0 1 0 -19 0Z"/>
              <path fill="#EA4335" d="M12 2.5C7.9 2.5 4.3 4.9 2.7 8.3l4.8 8.3L12 12l8.2 0C19.1 6.6 15.9 2.5 12 2.5z"/>
              <path fill="#FBBC05" d="M2.7 8.3C1.9 9.9 1.5 11.7 1.5 13.5c0 5 3.5 9.2 8.2 10.3l4.8-8.3-2.5-3.5L2.7 8.3z"/>
              <path fill="#34A853" d="M9.7 23.8c.8.2 1.5.2 2.3.2 5.8 0 10.5-4.7 10.5-10.5 0-1.8-.5-3.5-1.3-5L12 12l-2.3 11.8z"/>
              <circle cx="12" cy="12" r="4.8" fill="#FFFFFF"/>
              <circle cx="12" cy="12" r="3.8" fill="#1A73E8"/>
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Install SaveZonix Extension
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '2px 0 0 0' }}>
              YouTube Ad Blocker &amp; Universal Media Downloader
            </p>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          margin: '18px 0 22px 0'
        }}>
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Shield size={16} color="#34d399" />
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#a7f3d0' }}>
              Zero YouTube Ads
            </span>
          </div>

          <div style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Zap size={16} color="#38bdf8" />
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#bae6fd' }}>
              1-Click YouTube Button
            </span>
          </div>
        </div>

        {/* Step 1: Big Download Button */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: '#38bdf8',
              color: '#030816',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>1</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
              Download Extension Package
            </span>
          </div>

          <a
            href="/SaveZonix-Extension.zip"
            download="SaveZonix-Extension.zip"
            onClick={() => setDownloadTriggered(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px 20px',
              background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
              color: '#030816',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '14.5px',
              textDecoration: 'none',
              boxShadow: '0 6px 20px rgba(56, 189, 248, 0.35)',
              transition: 'transform 0.15s ease'
            }}
          >
            <Download size={18} strokeWidth={2.5} />
            <span>{downloadTriggered ? '✓ Downloaded — Now follow steps below' : 'Download SaveZonix-Extension.zip'}</span>
          </a>
          <p style={{ fontSize: '11.5px', color: '#64748b', textAlign: 'center', margin: '6px 0 0 0' }}>
            Safe, verified &amp; lightweight (~120 KB) • No installer required
          </p>
        </div>

        {/* Steps Container */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          {/* Step 2: Unzip */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.2)',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>2</span>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc' }}>
                Unzip the downloaded file
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Right-click <code style={{ color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '1px 5px', borderRadius: '4px' }}>SaveZonix-Extension.zip</code> and click <strong>Extract All</strong> (or Extract Here).
              </div>
            </div>
          </div>

          {/* Step 3: Open Chrome Extensions */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.2)',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>3</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc' }}>
                Open Extensions in Chrome
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Paste this into a new Chrome tab address bar:
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '6px',
                background: '#090d16',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '8px',
                padding: '6px 10px'
              }}>
                <code style={{ fontSize: '12.5px', color: '#38bdf8', flex: 1, fontFamily: 'monospace' }}>
                  chrome://extensions
                </code>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid ' + (copied ? '#10b981' : 'rgba(255, 255, 255, 0.15)'),
                    borderRadius: '6px',
                    color: copied ? '#34d399' : '#f8fafc',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied!' : 'Copy URL'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Step 4: Turn on Developer Mode & Load */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.2)',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>4</span>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#f8fafc' }}>
                Load Unpacked Folder
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px', lineHeight: '1.5' }}>
                1. Top-right me <strong style={{ color: '#f8fafc' }}>Developer mode</strong> toggle ko ON karein.<br />
                2. Top-left me <strong style={{ color: '#38bdf8' }}>Load unpacked</strong> button dabayein aur extract kiya hua folder select karein!
              </div>
            </div>
          </div>
        </div>

        {/* Done Button */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 22px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '10px',
              color: '#f8fafc',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Done / Close
          </button>
        </div>
      </div>
    </div>
  );
}
