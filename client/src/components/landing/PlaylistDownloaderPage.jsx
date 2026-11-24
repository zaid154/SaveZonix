import React from 'react';
import SEOHead from '../SEOHead';
import DownloadStudio from '../DownloadStudio';
import { ListMusic, Sparkles, Zap, ShieldCheck, CheckSquare, ArrowRight } from 'lucide-react';

export default function PlaylistDownloaderPage({ user, appConfig, onOpenGatekeeper, onOpenExtensionModal, onOpenVip, onNavigate }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "SaveZonix YouTube Playlist Downloader",
    "url": "https://savezonix-pro.vercel.app/playlist-downloader",
    "description": "Download entire YouTube playlists, full albums, and music mixes online in bulk with one click.",
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
        title="YouTube Playlist Downloader — Bulk Download Full Playlists | SaveZonix"
        description="Download full YouTube playlists and mixes in batch online for free. Select multiple videos, download in 1080p MP4 or 320kbps MP3 audio with one click!"
        canonical="https://savezonix-pro.vercel.app/playlist-downloader"
        keywords="playlist downloader, download YouTube playlist, batch video downloader, YouTube album downloader, download full playlist MP3"
        schema={schema}
      />

      {/* Hero Header */}
      <header className="landing-hero-header" style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', borderRadius: '20px', background: 'rgba(129, 140, 248, 0.1)', border: '1px solid rgba(129, 140, 248, 0.3)', color: '#818cf8', fontSize: '12px', fontWeight: '700', marginBottom: '14px' }}>
          <ListMusic size={14} /> BATCH PLAYLIST STUDIO
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: '800', color: '#fff', lineHeight: '1.2', marginBottom: '16px' }}>
          YouTube Playlist Downloader <br />
          <span style={{ background: 'linear-gradient(135deg, #818cf8 0%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Batch Download Complete Playlists &amp; Mixes
          </span>
        </h1>
        <p style={{ maxWidth: '720px', margin: '0 auto', color: '#94a3b8', fontSize: '1.05rem', lineHeight: '1.6' }}>
          Save entire music albums, course tutorials, podcast series, and YouTube video mixes in one queue. Select all videos or cherry-pick your favorite tracks.
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
          Batch Download Complete YouTube Playlists Without Tedious Repetition
        </h2>
        <p style={{ color: '#cbd5e1', lineHeight: '1.7', fontSize: '0.98rem', marginBottom: '20px' }}>
          Downloading an educational playlist or music discography video-by-video is painfully slow and frustrating. <strong>SaveZonix Playlist Downloader</strong> streamlines your workflow by resolving the entire playlist catalog in one scan. You can select all tracks or pick specific clips, choose between 1080p MP4 video or 320kbps MP3 audio, and initiate high-speed batch downloads simultaneously.
        </p>

        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#818cf8', marginTop: '28px', marginBottom: '12px' }}>
          Smart Progressive Loading for Massive Playlists
        </h3>
        <p style={{ color: '#94a3b8', lineHeight: '1.7', fontSize: '0.95rem', marginBottom: '20px' }}>
          Whether your playlist has 10 videos or 500 tracks, SaveZonix's smart pagination engine loads the first 25 videos instantly so you never have to wait. You can expand the queue dynamically with <em>Load Next 25</em> or click <em>Load All</em> to process the full discography.
        </p>

        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#818cf8', marginTop: '28px', marginBottom: '12px' }}>
          How to Download YouTube Playlists in 3 Steps
        </h3>
        <ol style={{ paddingLeft: '20px', color: '#94a3b8', lineHeight: '1.8', fontSize: '0.95rem', marginBottom: '24px' }}>
          <li><strong style={{ color: '#f1f5f9' }}>Copy the Playlist URL:</strong> Copy any YouTube playlist link (containing <code>list=...</code>) from your browser address bar.</li>
          <li><strong style={{ color: '#f1f5f9' }}>Paste in Playlist Studio:</strong> Switch to the <strong>Playlist Studio</strong> tab above, paste your link, and click <em>Load Playlist</em>.</li>
          <li><strong style={{ color: '#f1f5f9' }}>Choose Format &amp; Download:</strong> Select your desired format (1080p Full HD, 720p, or MP3 Audio) and click <em>Download Selected</em>.</li>
        </ol>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '16px', marginBottom: '28px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckSquare size={16} color="#818cf8" /> Granular Video Selection
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
              Select all videos with one click, or check/uncheck individual videos to download only the tracks you want.
            </p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} color="#38bdf8" /> Parallel Multi-Thread Muxing
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
              Our cloud engine queues and transfers files simultaneously without blocking your browser thread.
            </p>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#34d399" /> Original Video &amp; Audio Fidelity
            </h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
              Every item retains its native bitrate, stereo soundtrack, and high-definition video track.
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
            <span>Single YouTube Video Downloader</span> <ArrowRight size={14} />
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
