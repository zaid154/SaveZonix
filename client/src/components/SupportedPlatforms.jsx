import React from 'react';
import { Video, Music, Camera, Share2, Film, Radio, Sparkles } from 'lucide-react';

const PLATFORMS = [
  {
    name: 'YouTube',
    tag: '4K • 1080p • 60FPS • Shorts',
    desc: 'Download videos, YouTube Shorts, and live replays in up to 4K Ultra HD and high-bitrate MP3 audio.',
    color: '#ef4444',
    icon: <Video size={24} color="#ef4444" />
  },
  {
    name: 'Instagram',
    tag: 'Reels • Stories • Posts',
    desc: 'Save Instagram Reels, video carousels, and Story clips in crisp Full HD without watermarks or login.',
    color: '#f472b6',
    icon: <Camera size={24} color="#f472b6" />
  },
  {
    name: 'TikTok',
    tag: 'Clean Video • No Watermark',
    desc: 'Extract trending TikTok sounds and download high-resolution videos without the distracting watermark.',
    color: '#06b6d4',
    icon: <Film size={24} color="#06b6d4" />
  },
  {
    name: 'Facebook & Twitter (X)',
    tag: 'News Clips • Viral Videos',
    desc: 'Download public video clips, interviews, and community videos directly to your camera roll or PC.',
    color: '#3b82f6',
    icon: <Share2 size={24} color="#3b82f6" />
  },
  {
    name: 'Vimeo & Dailymotion',
    tag: 'HQ Cinema Streams',
    desc: 'Direct media stream extraction for high-quality artistic documentaries and independent filmmaking.',
    color: '#818cf8',
    icon: <Sparkles size={24} color="#818cf8" />
  },
  {
    name: 'Podcasts & Music Streams',
    tag: '320kbps MP3 & AAC',
    desc: 'Convert any video soundtrack or podcast episode into high-fidelity 320kbps MP3 audio with one tap.',
    color: '#10b981',
    icon: <Music size={24} color="#10b981" />
  }
];

export default function SupportedPlatforms() {
  return (
    <section className="section-container" id="supported-platforms" style={{ padding: '60px 16px' }}>
      <div className="section-header" style={{ textAlign: 'center', marginBottom: '40px' }}>
        <span className="section-tag" style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '10px' }}>
          UNIVERSAL COMPATIBILITY
        </span>
        <h2 className="section-title" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.4rem)', fontWeight: '800', color: '#fff', marginBottom: '12px' }}>
          Supported Streaming Platforms &amp; Formats
        </h2>
        <p className="section-desc" style={{ color: '#94a3b8', maxWidth: '640px', margin: '0 auto', fontSize: '0.98rem', lineHeight: '1.6' }}>
          SaveZonix's multi-protocol stream parser handles major video networks, social media platforms, and direct web media streams effortlessly.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', maxWidth: '1140px', margin: '0 auto' }}>
        {PLATFORMS.map((p, idx) => (
          <div
            key={idx}
            className="platform-card"
            style={{
              background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(10, 15, 29, 0.9) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '24px',
              backdropFilter: 'blur(16px)',
              transition: 'transform 0.2s ease, border-color 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${p.color}18`, border: `1px solid ${p.color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.icon}
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: p.color, background: `${p.color}15`, border: `1px solid ${p.color}35`, padding: '2px 8px', borderRadius: '6px' }}>
                {p.tag}
              </span>
            </div>
            <div>
              <h3 style={{ color: '#fff', fontSize: '1.15rem', fontWeight: '700', margin: '0 0 6px 0' }}>{p.name}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0, lineHeight: '1.5' }}>{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
