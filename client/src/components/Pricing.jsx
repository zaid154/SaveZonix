import React from 'react';

export default function Pricing({ appConfig, onSelectVip }) {
  const vipPrice = appConfig?.vipMonthlyPriceINR || 99;
  const freeLimit = appConfig?.freeDailyLimit || 3;

  return (
    <section className="section-container" id="pricing">
      <div className="section-header">
        <span className="section-tag">Pricing</span>
        <h2 className="section-title">Simple, Transparent Plans</h2>
        <p className="section-desc">Free downloads every day, or upgrade to VIP PRO for unlimited 4K access.</p>
      </div>

      <div className="pricing-grid">
        {/* Free Plan */}
        <div className="pricing-card">
          <div className="plan-name">Free Plan</div>
          <div className="plan-price">₹0 <span>/ forever</span></div>
          <p className="section-desc">For everyday video and audio downloads.</p>

          <ul className="plan-features">
            <li>✓ {freeLimit} Free Downloads Daily</li>
            <li>✓ Up to 1080p Full HD Video</li>
            <li>✓ Fast Stream Downloads</li>
            <li>✓ Web Video Preview</li>
            <li>✓ Chrome Companion Extension</li>
          </ul>

          <a href="#studio" className="btn-plan secondary">
            Use Web Downloader
          </a>
        </div>

        {/* VIP PRO Plan */}
        <div className="pricing-card featured">
          <div className="featured-ribbon">POPULAR</div>
          <div className="plan-name">SaveZonix VIP PRO</div>
          <div className="plan-price">₹{vipPrice} <span>/ month</span></div>
          <p className="section-desc">For heavy downloads and maximum 4K quality.</p>

          <ul className="plan-features">
            <li>✓ <strong>Unlimited Downloads</strong> (No Daily Caps)</li>
            <li>✓ <strong>4K &amp; 8K Ultra HD</strong> Video Quality</li>
            <li>✓ <strong>Full Speed Acceleration</strong></li>
            <li>✓ <strong>Batch Playlist Downloader</strong></li>
            <li>✓ <strong>320kbps High-Bitrate MP3</strong></li>
            <li>✓ <strong>Priority Support</strong></li>
          </ul>

          <button onClick={onSelectVip} className="btn-plan primary">
            Upgrade to VIP PRO
          </button>
        </div>
      </div>
    </section>
  );
}
