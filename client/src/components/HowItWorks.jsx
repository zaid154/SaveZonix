import React from 'react';

export default function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Copy Video URL',
      desc: 'Copy the video link from YouTube, Instagram Reels, TikTok, or any supported web page.',
      icon: ''
    },
    {
      num: '02',
      title: 'Select Format & Quality',
      desc: 'Pick your preferred video quality from 360p up to 4K Ultra HD, or select MP3 for audio.',
      icon: ''
    },
    {
      num: '03',
      title: 'Download Directly',
      desc: 'Hit download to save the file straight to your phone or computer with no extra software needed.',
      icon: ''
    }
  ];

  return (
    <section className="section-container" id="how-it-works">
      <div className="section-header">
        <span className="section-tag">How It Works</span>
        <h2 className="section-title">How to Download in 3 Steps</h2>
        <p className="section-desc">Fast, simple, and runs directly in your browser.</p>
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
