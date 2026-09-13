import React from 'react';

export default function LegalModal({ isOpen, type, onClose, onSwitchType }) {
  if (!isOpen) return null;

  const content = {
    privacy: {
      title: 'Privacy Policy',
      subtitle: 'Last updated: September 2026',
      body: (
        <>
          <p>At SaveZonix, we are committed to protecting your privacy and ensuring you have a secure experience when downloading and managing your media.</p>
          <h4 style={{ color: '#f8fafc', marginTop: '16px', marginBottom: '8px' }}>1. Zero Personal Data Tracking</h4>
          <p>We do NOT track, store, or log the video URLs you analyze or download. Download requests are processed directly between your client machine and the target media servers.</p>
          <h4 style={{ color: '#f8fafc', marginTop: '16px', marginBottom: '8px' }}>2. Account Information</h4>
          <p>When you create a SaveZonix account, we collect only your email address and full name to manage your VIP subscription status and quota allocation. We will never sell or share your email with third parties.</p>
          <h4 style={{ color: '#f8fafc', marginTop: '16px', marginBottom: '8px' }}>3. Local Storage</h4>
          <p>SaveZonix uses local browser storage exclusively to store authentication tokens and daily guest counter limits. No tracking cookies or advertising pixels are used.</p>
          <h4 style={{ color: '#f8fafc', marginTop: '16px', marginBottom: '8px' }}>4. Security</h4>
          <p>All passwords are encrypted using industry-standard bcrypt hashing with automated salt generation. Access tokens utilize secure JSON Web Tokens (JWT) with 30-day auto-expiry.</p>
        </>
      )
    },
    terms: {
      title: 'Terms of Service',
      subtitle: 'Effective: September 2026',
      body: (
        <>
          <p>By downloading, installing, or using SaveZonix applications, services, or browser extensions, you agree to be bound by these Terms of Service.</p>
          <h4 style={{ color: '#f8fafc', marginTop: '16px', marginBottom: '8px' }}>1. Authorized Personal Use</h4>
          <p>SaveZonix is designed as a tool for personal archival, offline research, and backing up public media that you have the legal right or permission to access. You agree not to use SaveZonix for unauthorized commercial redistribution.</p>
          <h4 style={{ color: '#f8fafc', marginTop: '16px', marginBottom: '8px' }}>2. User Responsibility</h4>
          <p>You are solely responsible for compliance with the terms of service of the third-party platforms from which you download content, as well as applicable copyright laws in your jurisdiction.</p>
          <h4 style={{ color: '#f8fafc', marginTop: '16px', marginBottom: '8px' }}>3. VIP Subscriptions</h4>
          <p>VIP subscriptions provide higher concurrent connections (up to 256 threads) and 4K Ultra-HD resolution unlocking. Subscriptions are billed on a recurring monthly or lifetime basis and can be managed anytime.</p>
          <h4 style={{ color: '#f8fafc', marginTop: '16px', marginBottom: '8px' }}>4. Disclaimer of Warranty</h4>
          <p>SaveZonix is provided "as is" without warranty of any kind. We do not guarantee uninterrupted service or compatibility with all third-party media sources as web standards evolve.</p>
        </>
      )
    },
    dmca: {
      title: 'DMCA & Copyright Policy',
      subtitle: 'Notice and Takedown Procedure',
      body: (
        <>
          <p>SaveZonix respects the intellectual property rights of creators and copyright owners. SaveZonix does not host, store, cache, or stream any audio or video content on its servers.</p>
          <h4 style={{ color: '#f8fafc', marginTop: '16px', marginBottom: '8px' }}>1. Client-Side Tool Architecture</h4>
          <p>SaveZonix operates purely as a client-side stream parser and downloader that connects your local browser or desktop app directly to publicly accessible media links provided by content providers.</p>
          <h4 style={{ color: '#f8fafc', marginTop: '16px', marginBottom: '8px' }}>2. Filing a Takedown Notice</h4>
          <p>If you believe that your copyrighted content is being made accessible through our software in violation of your rights, please provide our Copyright Agent with the following details:</p>
          <ul style={{ paddingLeft: '20px', color: '#94a3b8', lineHeight: '1.7' }}>
            <li>Identification of the copyrighted work claimed to have been infringed.</li>
            <li>Direct URL or technical identifier of the material.</li>
            <li>Your contact information (name, address, telephone number, and email address).</li>
            <li>A statement that you have a good faith belief that the disputed use is not authorized by the copyright owner.</li>
          </ul>
          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '8px', color: '#38bdf8' }}>
            📧 <strong>Official Contact &amp; DMCA:</strong> <a href="mailto:savezonix@gmail.com" style={{ color: '#38bdf8', textDecoration: 'underline' }}>savezonix@gmail.com</a>
          </div>
        </>
      )
    },
    disclaimer: {
      title: 'Legal Disclaimer',
      subtitle: 'Fair Use & Open Technology Statement',
      body: (
        <>
          <p>SaveZonix is an independent open technology utility developed to provide multi-threaded parallel streaming and offline playback capabilities for digital media.</p>
          <h4 style={{ color: '#f8fafc', marginTop: '16px', marginBottom: '8px' }}>1. Third-Party Trademarks</h4>
          <p>All product names, logos, brands, trademarks, and registered trademarks mentioned (including YouTube, Instagram, TikTok, Facebook, Vimeo, X/Twitter) are the property of their respective owners. Their mention does not imply endorsement or affiliation.</p>
          <h4 style={{ color: '#f8fafc', marginTop: '16px', marginBottom: '8px' }}>2. Educational & Research Purpose</h4>
          <p>The software is created for technical research into multi-threaded network chunking, HLS stream segmentation, and FFmpeg transcoding performance. Users must ensure their usage adheres to local fair use regulations.</p>
        </>
      )
    }
  };

  const current = content[type] || content.privacy;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100000 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', margin: 0 }}>{current.title}</h2>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{current.subtitle}</div>
          </div>
          <button className="btn-close-modal" onClick={onClose}>✕</button>
        </div>

        {/* Tab switch buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {['privacy', 'terms', 'dmca', 'disclaimer'].map((key) => (
            <button
              key={key}
              onClick={() => onSwitchType(key)}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                border: '1px solid',
                cursor: 'pointer',
                background: type === key ? 'rgba(56,189,248,0.15)' : 'transparent',
                borderColor: type === key ? '#38bdf8' : '#334155',
                color: type === key ? '#38bdf8' : '#94a3b8'
              }}
            >
              {key === 'dmca' ? 'DMCA' : key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>

        {/* Modal body */}
        <div style={{ overflowY: 'auto', paddingRight: '6px', fontSize: '13.5px', color: '#94a3b8', lineHeight: '1.7', flex: 1 }}>
          {current.body}
        </div>

        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '14px', marginTop: '16px', textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', background: '#0284c7', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
