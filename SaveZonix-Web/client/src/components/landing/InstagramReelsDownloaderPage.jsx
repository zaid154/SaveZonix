import React from 'react';
import SEOHead from '../SEOHead';
import DownloadStudio from '../DownloadStudio';
import { Camera, Sparkles, Zap, ShieldCheck, Lock, ArrowRight } from 'lucide-react';

export default function InstagramReelsDownloaderPage({ user, appConfig, onOpenGatekeeper, onOpenExtensionModal, onOpenVip, onNavigate }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "SaveZonix Instagram Reels Downloader",
    "url": "https://savezonix-pro.vercel.app/instagram-reels-downloader",
    "description": "Download Instagram Reels, videos, and Stories in original Full HD quality without login or watermark.",
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
        title="Instagram Reels Downloader — Save Reels in HD Without Login | SaveZonix"
        description="Download Instagram Reels and videos in 1080p Full HD without watermark or login. Fast, private, and 100% free Instagram media saver for mobile and PC!"
        canonical="https://savezonix-pro.vercel.app/instagram-reels-downloader"
        keywords="Instagram reels downloader, save Instagram reels, Instagram video downloader, download reels without login, IG story saver"
        schema={schema}
      />

      {/* Hero Header */}
      <header className="landing-hero-header" style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', borderRadius: '20px', background: 'rgba(244, 114, 182, 0.1)', border: '1px solid rgba(244, 114, 182, 0.3)', color: '#f472b6', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
          <Camera size={14} /> INSTAGRAM REELS SAVER
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: '800', color: '#fff', lineHeight: '1.2', marginBottom: '16px' }}>
          Instagram Reels Downloader <br />
          <span style={{ background: 'linear-gradient(135deg, #f472b6 0%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Full HD • No Watermark • 100% Anonymous
          </span>
        </h1>
        <p style={{ maxWidth: '720px', margin: '0 auto', color: '#94a3b8', fontSize: '1.05rem', lineHeight: '1.6' }}>
          Save viral Instagram Reels, video posts, and creator clips in original MP4 resolution directly to your phone or computer. No Instagram account or login required.
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
          Save Instagram Reels and Videos in Original High Definition
        </h2>
        <p style={{ color: '#cbd5e1', lineHeight: '1.7', fontSize: '0.98rem', marginBottom: '20px' }}>
          Instagram is packed with incredible recipes, fitness tutorials, funny memes, and creative visual stories. However, the official Instagram app offers limited offline capabilities and often adds distracting UI elements. <strong>SaveZonix Instagram Reels Downloader</strong> enables you to capture the clean, uncompressed original video stream in 1080p MP4 format with audio perfectly synced.
        </p>

        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f472b6', marginTop: '28px', marginBottom: '12px' }}>
          Complete Anonymity: No Instagram Login Ever
        </h3>
        <p style={{ color: '#94a3b8', lineHeight: '1.7', fontSize: '0.95rem', marginBottom: '20px' }}>
          Many third-party downloader apps demand your Instagram login credentials, posing serious risks to your account security. SaveZonix operates as a direct protocol inspector and public stream extractor. We never ask for your Instagram username, password, or cookies. Your downloads remain 100% anonymous, safe, and private.
        </p>

        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f472b6', marginTop: '28px', marginBottom: '12px' }}>
          How to Download Instagram Reels on iPhone, Android &amp; PC
        </h3>
        <ol style={{ paddingLeft: '20px', color: '#94a3b8', lineHeight: '1.8', fontSize: '0.95rem', marginBottom: '24px' }}>
          <li><strong style={{ color: '#f1f5f9' }}>Copy the Reel URL:</strong> Open Instagram, tap the Share icon on the Reel or video, and select <em>Copy Link</em>.</li>
          <li><strong style={{ color: '#f1f5f9' }}>Paste Into SaveZonix:</strong> Paste the copied link into the input box above and tap <em>Analyze</em>.</li>
          <li><strong style={{ color: '#f1f5f9' }}>Save in High Quality:</strong> Click <em>Download 1080p</em> to store the MP4 video directly into your device gallery or downloads folder.</li>
        </ol>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '16px', marginBottom: '28px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={16} color="#f472b6" /> Zero Account Access Needed
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
              Protect your Instagram account. Download public Reels without providing your password or OAuth token.
            </p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} color="#a855f7" /> Original Audio &amp; Video Quality
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
              Videos are saved in native 1080x1920 vertical format with crystal-clear stereo audio.
            </p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#34d399" /> Clean Downloads (No Watermark)
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
              Unlike screen recording, your downloaded files contain zero app watermarks or overlaid icons.
            </p>
          </div>
        </div>

        {/* Cross-Linking */}
        <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#fff', marginTop: '32px', marginBottom: '14px' }}>
          Discover More Free Converters
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigate('/youtube-downloader')}
            style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '10px 18px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <span>YouTube 4K Downloader</span> <ArrowRight size={14} />
          </button>
          <button
            onClick={() => onNavigate('/youtube-to-mp3')}
            style={{ background: 'rgba(52, 211, 153, 0.12)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399', padding: '10px 18px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <span>YouTube to MP3 Converter</span> <ArrowRight size={14} />
          </button>
        </div>
      </article>
    </div>
  );
}
