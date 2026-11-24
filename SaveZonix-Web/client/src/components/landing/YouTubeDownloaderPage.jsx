import React from 'react';
import SEOHead from '../SEOHead';
import DownloadStudio from '../DownloadStudio';
import { Video, Sparkles, Zap, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

export default function YouTubeDownloaderPage({ user, appConfig, onOpenGatekeeper, onOpenExtensionModal, onOpenVip, onNavigate }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "SaveZonix YouTube Video Downloader",
    "url": "https://savezonix-pro.vercel.app/youtube-downloader",
    "description": "Download YouTube videos in 4K, 1080p Full HD, 60fps and MP4 format for free with no signup required.",
    "applicationCategory": "MultimediaApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  return (
    <div className="landing-page-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 16px 80px' }}>
      <SEOHead
        title="YouTube Video Downloader — Download YouTube 4K & 1080p Free | SaveZonix"
        description="Fast YouTube video downloader online. Save YouTube videos in 4K UHD, 1080p, 60fps, and Shorts directly to your device without software. 100% free & safe!"
        canonical="https://savezonix-pro.vercel.app/youtube-downloader"
        keywords="YouTube video downloader, 4K video downloader online free, download YouTube videos, YouTube shorts downloader, fast video downloader"
        schema={schema}
      />

      {/* Hero Header */}
      <header className="landing-hero-header" style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', borderRadius: '20px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
          <Sparkles size={14} /> FREE YOUTUBE DOWNLOADER ONLINE
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: '800', color: '#fff', lineHeight: '1.2', marginBottom: '16px' }}>
          YouTube Video Downloader <br />
          <span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            In 4K Ultra HD &amp; 1080p 60FPS
          </span>
        </h1>
        <p style={{ maxWidth: '720px', margin: '0 auto', color: '#94a3b8', fontSize: '1.05rem', lineHeight: '1.6' }}>
          Save videos, YouTube Shorts, tutorials, and music streams directly to your phone, tablet, or PC in original cinema resolution. No app installation or registration needed.
        </p>
      </header>

      {/* Embedded Live Downloader Studio */}
      <section style={{ marginBottom: '60px' }}>
        <DownloadStudio
          user={user}
          appConfig={appConfig}
          onOpenGatekeeper={onOpenGatekeeper}
          onOpenExtensionModal={onOpenExtensionModal}
          onOpenVip={onOpenVip}
        />
      </section>

      {/* Educational Article Content (350+ Words) */}
      <article className="landing-article-card" style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '36px 30px', backdropFilter: 'blur(16px)', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#fff', marginBottom: '16px' }}>
          Why SaveZonix is the Best Online YouTube Video Downloader
        </h2>
        <p style={{ color: '#cbd5e1', lineHeight: '1.7', fontSize: '0.98rem', marginBottom: '20px' }}>
          Watching YouTube videos offline has never been easier. Whether you are traveling without reliable Wi-Fi, archiving educational lectures, or saving your favorite creator's content before it gets deleted, <strong>SaveZonix</strong> provides the most reliable, ad-free video downloading experience on the web. Our proprietary 64-thread acceleration engine connects directly to origin CDN streams, allowing you to bypass bandwidth throttling and download large 4K files at your full connection speed.
        </p>

        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#38bdf8', marginTop: '28px', marginBottom: '12px' }}>
          How to Download YouTube Videos in 3 Simple Steps
        </h3>
        <ol style={{ paddingLeft: '20px', color: '#94a3b8', lineHeight: '1.8', fontSize: '0.95rem', marginBottom: '24px' }}>
          <li><strong style={{ color: '#f1f5f9' }}>Copy Video URL:</strong> Open YouTube on your browser or mobile app and copy the link of any video, Short, or live replay.</li>
          <li><strong style={{ color: '#f1f5f9' }}>Paste &amp; Analyze:</strong> Paste the link into the SaveZonix input bar above and hit <em>Analyze</em>. Our serverless resolver extracts available streams in seconds.</li>
          <li><strong style={{ color: '#f1f5f9' }}>Select Quality &amp; Save:</strong> Choose your preferred resolution (4K 2160p, 1080p Full HD, 720p, or 320kbps MP3) and click <em>Download</em> to save the file directly.</li>
        </ol>

        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#38bdf8', marginTop: '28px', marginBottom: '12px' }}>
          Key Features of SaveZonix YouTube Downloader
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '16px', marginBottom: '28px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} color="#38bdf8" /> 4K &amp; 60FPS Video Support
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
              Download crystal-clear 2160p 4K, 1440p 2K, and 1080p Full HD videos at silky smooth 60 frames per second.
            </p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#34d399" /> 100% Safe &amp; No Malware
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
              No deceptive popup ads, adware, or redirects. Your downloads are clean, direct, and completely safe.
            </p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} color="#818cf8" /> No Registration Required
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
              Start downloading immediately as a guest. No credit card, account creation, or email verification needed.
            </p>
          </div>
        </div>

        {/* Internal Cross-Linking Section */}
        <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#fff', marginTop: '32px', marginBottom: '14px' }}>
          Explore Other Free Media Tools by SaveZonix
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigate('/youtube-to-mp3')}
            style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '10px 18px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <span>YouTube to MP3 Converter</span> <ArrowRight size={14} />
          </button>
          <button
            onClick={() => onNavigate('/playlist-downloader')}
            style={{ background: 'rgba(129, 140, 248, 0.12)', border: '1px solid rgba(129, 140, 248, 0.3)', color: '#818cf8', padding: '10px 18px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <span>Playlist Downloader</span> <ArrowRight size={14} />
          </button>
          <button
            onClick={() => onNavigate('/instagram-reels-downloader')}
            style={{ background: 'rgba(244, 114, 182, 0.12)', border: '1px solid rgba(244, 114, 182, 0.3)', color: '#f472b6', padding: '10px 18px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <span>Instagram Reels Downloader</span> <ArrowRight size={14} />
          </button>
        </div>
      </article>
    </div>
  );
}
