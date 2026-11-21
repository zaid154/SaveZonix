import React from 'react';

const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: 'High-Speed Downloads',
    desc: 'Parallel stream connections download audio and video segments simultaneously at max connection speed.'
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="15" x="2" y="3" rx="2" />
        <polygon points="10 8 15 11 10 14 10 8" fill="#818cf8" />
        <line x1="2" y1="21" x2="22" y2="21" />
      </svg>
    ),
    title: 'Ad-Free Player',
    desc: 'Watch and preview video streams directly in the browser without interruptions or popup redirects.'
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19.439 7.85c0-1.571-.9-2.85-2.01-2.85h-1.85a3 3 0 0 0-2.83 2h-1.49a3 3 0 0 0-2.83-2H6.57c-1.11 0-2.01 1.279-2.01 2.85v1.85a3 3 0 0 0 2 2.83v1.49a3 3 0 0 0-2 2.83v1.85c0 1.571.9 2.85 2.01 2.85h1.85a3 3 0 0 0 2.83-2h1.49a3 3 0 0 0 2.83 2h1.85c1.11 0 2.01-1.279 2.01-2.85v-1.85a3 3 0 0 0-2-2.83v-1.49a3 3 0 0 0 2-2.83z" />
      </svg>
    ),
    title: 'Chrome Extension',
    desc: 'Quickly detect media and download videos directly with 1 click while browsing YouTube and web pages.'
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
    title: '320kbps MP3 Audio',
    desc: 'Extract clean MP3 and AAC audio from music videos and podcasts with original clarity.'
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 6 4 14" />
        <path d="M12 6v14" />
        <path d="M8 8v12" />
        <path d="M4 4v16" />
      </svg>
    ),
    title: 'Playlist Support',
    desc: 'Select and download entire YouTube playlists or mixes in one go without downloading one by one.'
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    title: 'Reliable File Output',
    desc: 'Files are checked and muxed properly so they open and play smoothly on all phones, tablets, and PCs.'
  }
];

export default function Features() {
  return (
    <section className="section-container" id="features">
      <div className="section-header">
        <span className="section-tag">Features</span>
        <h2 className="section-title">Everything You Need in a Downloader</h2>
        <p className="section-desc">Download videos in original resolution, save audio, and enjoy a clean experience.</p>
      </div>

      <div className="features-grid">
        {FEATURES.map((item, index) => (
          <div key={index} className="feature-card">
            <div className="feature-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {item.icon}
            </div>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

