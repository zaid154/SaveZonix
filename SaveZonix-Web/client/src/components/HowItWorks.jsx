import React from 'react';

export default function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Copy Media URL',
      desc: 'Grab the link from YouTube, Instagram Reels, TikTok, Vimeo, or any live HLS stream from your browser.',
      icon: '🔗'
    },
    {
      num: '02',
      title: 'Smart Deep Analysis',
      desc: 'SaveZonix auto-detects all available resolutions (360p to 4K Ultra-HD), bitrates, audio tracks, and segment playlists.',
      icon: '⚡'
    },
    {
      num: '03',
      title: '64x Turbo Download',
      desc: 'Download using up to 64 parallel network chunk connections. Enjoy zero buffering, instant merging, and cinema playback.',
      icon: '🚀'
    }
  ];

  return (
    <section className="section-container" id="how-it-works">
      <div className="section-header">
        <span className="section-tag">EFFORTLESS PROCESS</span>
        <h2 className="section-title">How SaveZonix Works in 3 Steps</h2>
        <p className="section-desc">Engineered for maximum speed and simplicity. No complex setup or command line required.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        {steps.map((s, idx) => (
          <div
            key={idx}
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
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>{s.icon}</div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#f8fafc', marginBottom: '10px' }}>{s.title}</h3>
            <p style={{ fontSize: '13.5px', color: '#94a3b8', lineHeight: '1.6', margin: 0 }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
