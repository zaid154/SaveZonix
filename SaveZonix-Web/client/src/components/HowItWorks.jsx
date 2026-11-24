import React from 'react';

export default function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Copy Media URL',
      desc: 'Copy any video or playlist link from YouTube, Instagram Reels, TikTok, or streaming web pages.',
      icon: ''
    },
    {
      num: '02',
      title: 'Select 4K / 1080p or MP3',
      desc: 'Choose your desired format and quality: from 360p up to 4K Ultra HD video, or 320kbps MP3 audio.',
      icon: ''
    },
    {
      num: '03',
      title: 'Instant Free Download',
      desc: 'Click download to save the file directly to your smartphone, tablet, or PC without registration or watermarks.',
      icon: ''
    }
  ];

  return (
    <section className="section-container" id="how-it-works">
      <div className="section-header">
        <span className="section-tag">How It Works</span>
        <h2 className="section-title">How to Download Videos in 3 Easy Steps</h2>
        <p className="section-desc">Fast, secure, and runs directly in your browser with no software required.</p>
      </div>

      <div className="how-it-works-grid">
        {steps.map((s, idx) => (
          <div
            key={idx}
            className="how-it-works-card"
            style={{
              background: '#0a0f1d',
              border: '1px solid #1e293b',
              borderRadius: '16px',
              padding: '32px 24px',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.2s ease, border-color 0.2s ease'
            }}
          >
            <div style={{ position: 'absolute', top: '16px', right: '20px', fontSize: '36px', fontWeight: '900', color: 'rgba(56,189,248,0.08)', fontFamily: 'monospace' }}>
              {s.num}
            </div>
            {s.icon ? <div style={{ fontSize: '36px', marginBottom: '16px' }}>{s.icon}</div> : null}
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc', marginBottom: '10px' }}>{s.title}</h3>
            <p style={{ fontSize: '13.5px', color: '#94a3b8', lineHeight: '1.6', margin: 0 }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
