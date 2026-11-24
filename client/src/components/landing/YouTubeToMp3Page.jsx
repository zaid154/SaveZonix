import React from 'react';
import SEOHead from '../SEOHead';
import DownloadStudio from '../DownloadStudio';
import { Music, Sparkles, Zap, ShieldCheck, Headphones, ArrowRight } from 'lucide-react';

export default function YouTubeToMp3Page({ user, appConfig, onOpenGatekeeper, onOpenExtensionModal, onOpenVip, onNavigate }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "SaveZonix YouTube to MP3 Converter",
    "url": "https://savezonix-pro.vercel.app/youtube-to-mp3",
    "description": "Convert and download YouTube videos to crystal-clear 320kbps MP3 audio online for free.",
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
        title="YouTube to MP3 Converter — Fast 320kbps Audio Downloader | SaveZonix"
        description="Convert YouTube videos to high-bitrate 320kbps MP3 audio online for free. Fast, unlimited, and crystal-clear audio extraction with no software installation!"
        canonical="https://savezonix-pro.vercel.app/youtube-to-mp3"
        keywords="YouTube to MP3, convert YouTube to MP3, 320kbps MP3 downloader, extract audio from YouTube, online audio converter"
        schema={schema}
      />

      {/* Hero Header */}
      <header className="landing-hero-header" style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', borderRadius: '20px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
          <Music size={14} /> HI-FI AUDIO EXTRACTION
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: '800', color: '#fff', lineHeight: '1.2', marginBottom: '16px' }}>
          YouTube to MP3 Converter <br />
          <span style={{ background: 'linear-gradient(135deg, #34d399 0%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Original Bitrate &amp; 320kbps Audio
          </span>
        </h1>
        <p style={{ maxWidth: '720px', margin: '0 auto', color: '#94a3b8', fontSize: '1.05rem', lineHeight: '1.6' }}>
          Extract pristine audio from music videos, DJ sets, lectures, podcasts, and soundscapes in standard MP3 format compatible with every phone, car audio system, and media player.
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
          Convert YouTube Videos to MP3 Online with Studio-Grade Sound
        </h2>
        <p style={{ color: '#cbd5e1', lineHeight: '1.7', fontSize: '0.98rem', marginBottom: '20px' }}>
          Standard online audio converters frequently compress sound files down to 64kbps or 128kbps, leading to muffled vocals, flattened bass, and distortion. <strong>SaveZonix</strong> uses direct digital audio demuxing technology that extracts the original opus and AAC audio stream straight from YouTube’s CDN without lossy re-encoding, preserving full dynamic range up to 320kbps.
        </p>

        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#34d399', marginTop: '28px', marginBottom: '12px' }}>
          Why Choose 320kbps MP3 Format?
        </h3>
        <p style={{ color: '#94a3b8', lineHeight: '1.7', fontSize: '0.95rem', marginBottom: '20px' }}>
          320kbps is the maximum bitrate specification supported by the MP3 codec and is widely regarded as indistinguishable from uncompressed CD-quality audio by acoustic engineers. When you download music mixes, podcasts, or audiobook recordings using SaveZonix, your files retain complete high-frequency detail and rich low-end punch.
        </p>

        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#34d399', marginTop: '28px', marginBottom: '12px' }}>
          How to Convert YouTube to MP3 in Seconds
        </h3>
        <ol style={{ paddingLeft: '20px', color: '#94a3b8', lineHeight: '1.8', fontSize: '0.95rem', marginBottom: '24px' }}>
          <li><strong style={{ color: '#f1f5f9' }}>Paste the YouTube Link:</strong> Copy the URL of your chosen YouTube video or music track and paste it into the converter bar above.</li>
          <li><strong style={{ color: '#f1f5f9' }}>Select MP3 Audio Quality:</strong> Hit <em>Analyze</em>, then click the <strong>MP3 (320k Audio)</strong> quality pill.</li>
          <li><strong style={{ color: '#f1f5f9' }}>Download Your Audio:</strong> Tap <em>Download MP3</em> to save the audio file directly to your device storage.</li>
        </ol>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '16px', marginBottom: '28px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Headphones size={16} color="#34d399" /> Universal Device Compatibility
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
              Plays seamlessly on iPhone, Android, Mac, Windows, car infotainment systems, and portable MP3 players.
            </p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} color="#38bdf8" /> Instant Serverless Extraction
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
              No long queues or waiting in conversion line. Audio streams are resolved and delivered instantaneously.
            </p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#818cf8" /> No Tracking or Cookies
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
              SaveZonix respects your digital privacy. We never log your search history or downloaded media URLs.
            </p>
          </div>
        </div>

        {/* Cross-Linking */}
        <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: '#fff', marginTop: '32px', marginBottom: '14px' }}>
          Explore Related Media Tools
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigate('/youtube-downloader')}
            style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '10px 18px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <span>YouTube 4K Video Downloader</span> <ArrowRight size={14} />
          </button>
          <button
            onClick={() => onNavigate('/playlist-downloader')}
            style={{ background: 'rgba(129, 140, 248, 0.12)', border: '1px solid rgba(129, 140, 248, 0.3)', color: '#818cf8', padding: '10px 18px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <span>Batch Playlist Downloader</span> <ArrowRight size={14} />
          </button>
        </div>
      </article>
    </div>
  );
}
