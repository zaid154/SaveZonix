import React from 'react';

export default function Hero({ appConfig }) {
  const downloadUrl = appConfig?.appDownloadUrl || 'https://github.com/zaid154/SaveZonix/releases/latest';
  const version = appConfig?.latestAppVersion || '2.5.0';

  return (
    <section className="hero-section" id="download">
      <div className="hero-container">
        <div className="hero-pill">
          <span className="pill-dot"></span>
          <span>Turbo Engine • 64-Thread Acceleration Active</span>
        </div>

        <h1 className="hero-title">
          The World's Fastest<br />
          <span className="gradient-text-hero">Universal Video Downloader</span>
        </h1>

        <p className="hero-subtitle">
          Engineered in native C# .NET. Download YouTube, Instagram, HLS Streams, Fragmented MP4, and Cinema videos at up to 64x parallel speed.
        </p>

        <div className="hero-cta-group">
          <a href={downloadUrl} className="btn-hero-primary">
            <div className="btn-text-wrap">
              <span className="btn-main-label">Download for Windows (.exe)</span>
              <span className="btn-sub-label">v{version} • 64-bit • 100% Clean &amp; Free</span>
            </div>
          </a>

          <a href="#features" className="btn-hero-secondary">
            Explore Features
          </a>
        </div>
      </div>
    </section>
  );
}
