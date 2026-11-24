import React, { useEffect } from 'react';
import SEOHead from './SEOHead';
import { Shield, Zap, Lock, Globe, Server, HeartHandshake } from 'lucide-react';

export default function AboutPage({ onNavigate }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const schema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": "About SaveZonix — Universal Video Downloader & Stream Engine",
    "url": "https://savezonix-pro.vercel.app/about",
    "description": "Learn about SaveZonix, our zero-log client-side media transport architecture, and our mission to provide fast, ad-free video tools for creators.",
    "publisher": {
      "@type": "Organization",
      "name": "SaveZonix",
      "url": "https://savezonix-pro.vercel.app/",
      "logo": "https://savezonix-pro.vercel.app/logo.png"
    }
  };

  return (
    <div className="legal-page-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 16px 80px' }}>
      <SEOHead
        title="About Us — SaveZonix Universal Media Downloader & Engine"
        description="Learn about SaveZonix: our mission, zero-log privacy architecture, multi-threaded video stream engine, and our commitment to clean, ad-free media tools."
        canonical="https://savezonix-pro.vercel.app/about"
        schema={schema}
      />

      <div style={{ marginBottom: '36px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
          ABOUT SAVEZONIX
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.6rem)', fontWeight: '800', color: '#fff', marginBottom: '14px' }}>
          Engineered for Speed, Privacy &amp; Offline Freedom
        </h1>
        <p style={{ color: '#94a3b8', maxWidth: '680px', margin: '0 auto', fontSize: '1rem', lineHeight: '1.6' }}>
          SaveZonix is an independent, client-side media protocol analyzer and video downloader built to free digital media from intrusive advertising, popup spam, and forced buffering.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Mission Card */}
        <div style={{ background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(10, 15, 29, 0.95) 100%)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '32px', backdropFilter: 'blur(16px)' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#38bdf8', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Globe size={22} /> Our Vision &amp; Purpose
          </h2>
          <p style={{ color: '#cbd5e1', lineHeight: '1.7', fontSize: '0.96rem', marginBottom: '16px' }}>
            The modern web is inundated with low-quality video downloaders riddled with deceptive redirects, malware, and intrusive advertising. We founded <strong>SaveZonix</strong> with a clear, uncompromising principle: <em>provide creators, researchers, educators, and everyday users with an ultra-fast, completely clean, and ad-free offline media saver</em>.
          </p>
          <p style={{ color: '#94a3b8', lineHeight: '1.7', fontSize: '0.94rem' }}>
            Whether you need to preserve historical lectures, review 4K video footage on an airplane without Wi-Fi, or extract high-bitrate 320kbps MP3 audio for music production, SaveZonix provides a seamless browser-based solution that respects your time and your digital privacy.
          </p>
        </div>

        {/* 3 Pillars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399', marginBottom: '14px' }}>
              <Lock size={20} />
            </div>
            <h3 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '700', marginBottom: '8px' }}>Zero URL Logging</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: '1.6', margin: 0 }}>
              Your media consumption is private. We never log or inspect the video URLs, titles, or files you process. Everything operates over client-side direct streams.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', marginBottom: '14px' }}>
              <Zap size={20} />
            </div>
            <h3 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '700', marginBottom: '8px' }}>64-Thread Acceleration</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: '1.6', margin: 0 }}>
              Traditional single-stream downloaders suffer from ISP server-side throttling. Our engine splits media into parallel chunks to saturate your full connection bandwidth.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(129, 140, 248, 0.15)', border: '1px solid rgba(129, 140, 248, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', marginBottom: '14px' }}>
              <Shield size={20} />
            </div>
            <h3 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '700', marginBottom: '8px' }}>Strict Copyright Respect</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: '1.6', margin: 0 }}>
              SaveZonix operates strictly under statutory fair use and neutral protocol tool doctrines. We do not decrypt DRM-protected media or host copyrighted files.
            </p>
          </div>
        </div>

        {/* Back Button */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            onClick={() => onNavigate('/')}
            style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.35)', color: '#38bdf8', padding: '10px 24px', borderRadius: '10px', fontSize: '0.92rem', fontWeight: '700', cursor: 'pointer' }}
          >
            ← Back to Home Page &amp; Downloader
          </button>
        </div>
      </div>
    </div>
  );
}
