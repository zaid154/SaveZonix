import React from 'react';

export default function Pricing({ appConfig, onSelectVip }) {
  const vipPrice = appConfig?.vipMonthlyPriceINR || 99;
  const freeLimit = appConfig?.freeDailyLimit || 5;

  return (
    <section className="section-container" id="pricing">
      <div className="section-header">
        <span className="section-tag">TRANSPARENT PLANS</span>
        <h2 className="section-title">Free Forever or Unleash VIP Power</h2>
        <p className="section-desc">Generous limits for everyday users, or unlimited 4K power for enthusiasts.</p>
      </div>

      <div className="pricing-grid">
        {/* Free Plan */}
        <div className="pricing-card">
          <div className="plan-name">Free Community</div>
          <div className="plan-price">₹0 <span>/ forever</span></div>
          <p className="section-desc">For casual music and social video downloads.</p>

          <ul className="plan-features">
            <li>✓ {freeLimit} Downloads Every Day</li>
            <li>✓ Up to 1080p Full HD Video</li>
            <li>✓ 32 Parallel Connection Threads</li>
            <li>✓ CleanStream Cinema Player</li>
            <li>✓ Chrome Extension Companion</li>
          </ul>

          <a href="#download" className="btn-plan secondary">
            Download Free App
          </a>
        </div>

        {/* VIP PRO Plan */}
        <div className="pricing-card featured">
          <div className="featured-ribbon">MOST POPULAR</div>
          <div className="plan-name">SaveZonix VIP PRO</div>
          <div className="plan-price">₹{vipPrice} <span>/ month</span></div>
          <p className="section-desc">For power users who need uncapped speed and 4K quality.</p>

          <ul className="plan-features">
            <li>✓ <strong>Unlimited Downloads</strong> (No Daily Limits)</li>
            <li>✓ <strong>4K &amp; 8K Ultra HD</strong> Video Unlocked</li>
            <li>✓ <strong>64 - 256 Concurrency Threads</strong></li>
            <li>✓ <strong>Batch Playlist Studio</strong></li>
            <li>✓ <strong>320kbps Studio Audio Extractor</strong></li>
            <li>✓ <strong>Priority VIP Updates</strong></li>
          </ul>

          <button onClick={onSelectVip} className="btn-plan primary">
            Upgrade to VIP PRO
          </button>
        </div>
      </div>
    </section>
  );
}
