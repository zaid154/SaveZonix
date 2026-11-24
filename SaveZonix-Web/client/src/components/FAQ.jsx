import React, { useState } from 'react';

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState(0);

  const faqs = [
    {
      q: 'How do I download YouTube videos in 4K or 1080p for free?',
      a: 'To download YouTube videos in 4K UHD or 1080p Full HD, copy the video link from YouTube, paste it into the SaveZonix input box above, and click Analyze. Select your preferred resolution (2160p 4K, 1440p, or 1080p) and tap Download to save the file straight to your device with no watermarks or registration required.'
    },
    {
      q: 'How do I convert YouTube videos to 320kbps MP3 audio?',
      a: 'Simply paste any YouTube video or music link into the SaveZonix search box and hit Analyze. Select the "MP3 (320k Audio)" quality option and click Download. SaveZonix extracts the native audio stream without lossy compression so your file plays in pristine studio quality.'
    },
    {
      q: 'Can I download Instagram Reels and Stories without logging in?',
      a: 'Yes! SaveZonix is 100% anonymous and never asks for your Instagram login or password. Copy any public Reel, video post, or Story link from the Instagram app, paste it into SaveZonix, and download the clean MP4 video directly.'
    },
    {
      q: 'How do I download an entire YouTube playlist at once?',
      a: 'Switch to the "Playlist Studio" tab, paste any YouTube playlist or mix URL (containing list=...), and click Load Playlist. SaveZonix scans the full catalog, allowing you to select all videos or individual tracks and download them in batch.'
    },
    {
      q: 'Is SaveZonix completely free with no signup required?',
      a: 'Yes, SaveZonix offers free guest downloads daily with up to 1080p Full HD resolution and multi-threaded stream acceleration. You do not need to register, provide an email, or submit a credit card to start downloading.'
    },
    {
      q: 'Is downloading videos with SaveZonix safe and ad-free?',
      a: 'Absolutely. Unlike legacy conversion sites loaded with popups, malware, and intrusive redirects, SaveZonix provides a clean, secure, SSL-encrypted environment with zero adware or tracking cookies.'
    },
    {
      q: 'What devices and operating systems are supported?',
      a: 'SaveZonix runs directly in modern web browsers including Google Chrome, Apple Safari, Mozilla Firefox, Microsoft Edge, and Brave. It works seamlessly across Windows, macOS, Linux, Android smartphones, iPhones, and iPads.'
    },
    {
      q: 'Does SaveZonix store or host any downloaded videos?',
      a: 'No. SaveZonix operates as a direct client-side transport protocol analyzer and stream remuxer. We do not host, store, cache, mirror, or redistribute any media files on our servers. All downloads stream directly from origin content delivery networks to your local device.'
    },
    {
      q: 'How fast is the 64-thread turbo streaming download engine?',
      a: 'Traditional download tools pull files over a single TCP connection, which ISPs and servers frequently throttle. SaveZonix splits large media streams into up to 64 parallel chunks simultaneously, maximizing your bandwidth for up to 100MB/s speeds.'
    },
    {
      q: 'Is it legal to download videos for personal offline use?',
      a: 'Yes. SaveZonix is an authorized technical utility engineered for lawful personal archiving, educational fair use (17 U.S.C. § 107), Creative Commons media, and public domain preservation under the established Sony Betamax legal doctrine.'
    }
  ];

  // Schema.org FAQPage Structured Data
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(f => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.a
      }
    }))
  };

  return (
    <section className="section-container" id="faq">
      {/* Inline FAQPage JSON-LD Schema for Google Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="section-header">
        <span className="section-tag">FREQUENTLY ASKED QUESTIONS</span>
        <h2 className="section-title">Everything You Need to Know</h2>
        <p className="section-desc">Got questions about performance, limits, formats, or security? We have answers.</p>
      </div>

      <div className="faq-container" style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '880px' }}>
        {faqs.map((f, i) => {
          const isOpen = openIdx === i;
          return (
            <div
              key={i}
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="faq-item"
              style={{
                background: '#0a0f1d',
                border: '1px solid',
                borderColor: isOpen ? '#38bdf8' : '#1e293b',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease',
                padding: '16px 20px',
                minHeight: '44px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '36px' }}>
                <h3 className="faq-question" style={{ fontWeight: '700', fontSize: '1.02rem', color: isOpen ? '#38bdf8' : '#f8fafc', margin: 0, paddingRight: '12px', lineHeight: '1.4' }}>
                  {f.q}
                </h3>
                <span style={{ fontSize: '20px', color: isOpen ? '#38bdf8' : '#64748b', fontWeight: 'bold', flexShrink: 0 }}>
                  {isOpen ? '−' : '+'}
                </span>
              </div>
              {isOpen && (
                <p className="faq-answer" style={{ marginTop: '14px', marginBottom: 0, color: '#94a3b8', lineHeight: '1.7', fontSize: '0.94rem' }}>
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
