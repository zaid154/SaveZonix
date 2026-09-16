import React from 'react';

const FEATURES = [
  {
    icon: '',
    title: '64-Thread Acceleration',
    desc: 'Splits direct MP4 and adaptive HLS streams into 64 concurrent micro-ranges for maximum ISP speed saturation.'
  },
  {
    icon: '',
    title: 'CleanStream Cinema',
    desc: 'Stream web videos in an ad-free cinema player with CORS bypass proxy, subtitles, and picture-in-picture.'
  },
  {
    icon: '🧩',
    title: 'Chrome Companion Extension',
    desc: 'Sniff media streams directly from browser network traffic with 1-click handover to your local desktop engine.'
  },
  {
    icon: '🎵',
    title: '320kbps MP3 Extractor',
    desc: 'Extract studio-grade 320kbps MP3 and AAC audio from music videos and podcasts with lossless FFmpeg.'
  },
  {
    icon: '📦',
    title: 'Batch Playlist Studio',
    desc: 'Download entire YouTube playlists with 1 click. Smart queue manager runs smoothly in the background.'
  },
  {
    icon: '',
    title: 'Anti-Corruption Validator',
    desc: 'Deep binary inspection validates moov, moof, and mdat container atoms so your files never fail to play.'
  }
];

export default function Features() {
  return (
    <section className="section-container" id="features">
      <div className="section-header">
        <span className="section-tag">UNMATCHED POWER</span>
        <h2 className="section-title">Built for Speed, Designed for Creators</h2>
        <p className="section-desc">Everything you need to capture, remux, and stream media effortlessly.</p>
      </div>

      <div className="features-grid">
        {FEATURES.map((item, index) => (
          <div key={index} className="feature-card">
            <div className="feature-icon">{item.icon}</div>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
