import React, { useState } from 'react';

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState(0);

  const faqs = [
    {
      q: 'Is SaveZonix completely free to use?',
      a: 'Yes! SaveZonix offers a generous free tier for both Guests and registered users. Free accounts get daily downloads with up to 1080p Full HD resolution and multi-threaded acceleration. For unlimited 4K downloads and maximum concurrency, you can upgrade to VIP PRO.'
    },
    {
      q: 'How fast is the 64-thread parallel engine?',
      a: 'Unlike traditional downloaders that pull files over a single TCP stream, SaveZonix splits large media streams into up to 64 concurrent chunk segments. This bypasses ISP server-side bandwidth throttling and saturates your full internet connection speed.'
    },
    {
      q: 'Which video platforms and formats are supported?',
      a: 'SaveZonix supports over 1,000+ streaming sites including YouTube, Instagram Reels, TikTok, Vimeo, Dailymotion, Twitter/X, and direct media files. It also features a dedicated HLS (.m3u8) live stream capturer and DASH fMP4 merger.'
    },
    {
      q: 'How does Guest Mode work?',
      a: 'You can start downloading immediately after installing the app without creating an account! Guest users can download up to 5 videos daily. To get more downloads and save your history, simply sign in with a free account verified by email OTP.'
    },
    {
      q: 'How do I download in 4K Ultra-HD resolution?',
      a: 'When analyzing a 4K-capable video, SaveZonix will detect the 2160p and 1440p quality streams. 4K downloads are unlocked for VIP members to ensure dedicated high-bandwidth server prioritization.'
    },
    {
      q: 'Is the Chrome Extension companion safe?',
      a: 'Absolutely. The extension runs locally in your browser to detect hidden media streams and sends the URL to your local SaveZonix desktop engine. It contains no tracking pixels, adware, or data harvesting scripts.'
    }
  ];

  return (
    <section className="section-container" id="faq">
      <div className="section-header">
        <span className="section-tag">FREQUENTLY ASKED QUESTIONS</span>
        <h2 className="section-title">Everything You Need to Know</h2>
        <p className="section-desc">Got questions about performance, limits, or security? We have answers.</p>
      </div>

      <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {faqs.map((f, i) => {
          const isOpen = openIdx === i;
          return (
            <div
              key={i}
              onClick={() => setOpenIdx(isOpen ? null : i)}
              style={{
                background: '#0a0f1d',
                border: '1px solid',
                borderColor: isOpen ? '#38bdf8' : '#1e293b',
                borderRadius: '12px',
                padding: '18px 22px',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15.5px', fontWeight: '700', color: isOpen ? '#38bdf8' : '#f8fafc', margin: 0 }}>
                  {f.q}
                </h3>
                <span style={{ fontSize: '18px', color: isOpen ? '#38bdf8' : '#64748b', fontWeight: 'bold', marginLeft: '12px' }}>
                  {isOpen ? '−' : '+'}
                </span>
              </div>
              {isOpen && (
                <p style={{ marginTop: '12px', marginBottom: 0, fontSize: '13.5px', color: '#94a3b8', lineHeight: '1.6' }}>
                  {f.a}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
