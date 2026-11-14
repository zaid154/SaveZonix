import React, { useState } from 'react';
import { IconCpu, IconRefresh } from './AdminIcons';

export default function AiAdvisorTab({ adminToken }) {
  const [probeUrl, setProbeUrl] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [probeResult, setProbeResult] = useState(null);
  const [probing, setProbing] = useState(false);
  const [allSitesScan, setAllSitesScan] = useState(null);
  const [scanningSites, setScanningSites] = useState(false);

  function getHeaders() {
    return {
      'x-admin-key': 'savezonix_admin_2026',
      ...(adminToken ? { 'Authorization': `Bearer ${adminToken}` } : {})
    };
  }

  async function handleProbeCdn(urlToProbe = probeUrl) {
    if (!urlToProbe.trim()) return;
    setProbing(true);
    setProbeResult(null);
    try {
      const res = await fetch(`/api/admin/probe-cdn?target=${encodeURIComponent(urlToProbe.trim())}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        setProbeResult(data);
      } else {
        alert(data.error || 'Failed to probe CDN.');
      }
    } catch (err) {
      alert('Probe error: ' + err.message);
    } finally {
      setProbing(false);
    }
  }

  async function handleScanAllSites() {
    setScanningSites(true);
    try {
      const res = await fetch('/api/admin/scan-all-sites', {
        headers: getHeaders()
      });
      if (res.ok) {
        setAllSitesScan(await res.json());
      }
    } catch (err) {
      alert('Scan error: ' + err.message);
    } finally {
      setScanningSites(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Prober Input Card */}
      <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
            <IconCpu size={16} color="#38bdf8" />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
            AI CDN Edge Prober &amp; Concurrency Advisor
          </h3>
        </div>
        <p style={{ color: '#64748b', fontSize: '12.5px', marginBottom: '18px' }}>
          Real-time Autonomous System (ASN) edge mapping, latency detection, and dynamic socket calculation to prevent IP throttling.
        </p>

        {/* Quick Test Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {[
            { label: 'YouTube (Google BBR)', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { label: 'Instagram CDN (Meta Edge)', url: 'https://www.instagram.com/reel/C8' },
            { label: 'Reddit Video (Fastly CDN)', url: 'https://v.redd.it/sample_stream.mp4' },
            { label: 'Twitch TV (Amazon CloudFront)', url: 'https://www.twitch.tv/videos/sample' },
            { label: 'PixelFlix Cinema (Direct CDN)', url: 'https://pixelflix.video/watch' }
          ].map((pill) => (
            <button
              key={pill.label}
              type="button"
              onClick={() => {
                setProbeUrl(pill.url);
                handleProbeCdn(pill.url);
              }}
              style={{
                padding: '5px 10px',
                background: '#060a12',
                border: '1px solid #1a2333',
                borderRadius: '6px',
                color: '#94a3b8',
                fontSize: '11.5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* URL Input Form */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Enter any media stream URL or CDN domain to probe (e.g., https://vimeo.com/...)"
            value={probeUrl}
            onChange={(e) => setProbeUrl(e.target.value)}
            style={{ flex: 1, minWidth: '280px', padding: '11px 14px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', outline: 'none' }}
          />
          <button
            type="button"
            onClick={() => handleProbeCdn(probeUrl)}
            disabled={probing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 22px',
              background: '#2563eb',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: probing ? 'wait' : 'pointer',
              opacity: probing ? 0.7 : 1
            }}
          >
            <IconCpu size={14} color="#ffffff" />
            {probing ? 'Probing Edge CDN...' : 'Probe & Run AI Advisor'}
          </button>
        </div>
      </div>

      {/* Real-Time Telemetry & Recommendation Card */}
      {probeResult && (
        <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'gap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Edge Host Assessment</div>
              <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: '2px 0 0 0' }}>{probeResult.targetHost}</h4>
            </div>
            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              {probeResult.status}
            </span>
          </div>

          {/* Edge Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ background: '#060a12', padding: '14px', borderRadius: '8px', border: '1px solid #1a2333' }}>
              <div style={{ color: '#64748b', fontSize: '11.5px' }}>Resolved IP &amp; ASN</div>
              <div style={{ color: '#38bdf8', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>{probeResult.resolvedIp}</div>
              <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>{probeResult.asnOrg}</div>
            </div>

            <div style={{ background: '#060a12', padding: '14px', borderRadius: '8px', border: '1px solid #1a2333' }}>
              <div style={{ color: '#64748b', fontSize: '11.5px' }}>Edge Latency (TTFB)</div>
              <div style={{ color: '#34d399', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>{probeResult.edgeLatencyMs} ms</div>
              <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>{probeResult.cdnProvider}</div>
            </div>

            <div style={{ background: '#060a12', padding: '14px', borderRadius: '8px', border: '1px solid #1a2333' }}>
              <div style={{ color: '#64748b', fontSize: '11.5px' }}>Observed Wire Speed</div>
              <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>{probeResult.liveWireSpeedMBps} MB/s</div>
              <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>{probeResult.streamProtocol}</div>
            </div>

            <div style={{ background: '#060a12', padding: '14px', borderRadius: '8px', border: '1px solid #1a2333' }}>
              <div style={{ color: '#64748b', fontSize: '11.5px' }}>Risk Assessment</div>
              <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>{probeResult.riskFactor}</div>
              <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>Anti-Hotlink Guard Active</div>
            </div>
          </div>

          {/* AI Engine Recommendation Box */}
          <div style={{ background: 'linear-gradient(180deg, rgba(37, 99, 235, 0.08) 0%, rgba(13, 19, 31, 0.5) 100%)', padding: '20px', borderRadius: '10px', border: '1px solid rgba(37, 99, 235, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>
              <IconCpu size={15} color="#38bdf8" />
              AI Thread Concurrency Calculation
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
              <div style={{ background: '#060a12', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <div style={{ color: '#64748b', fontSize: '11.5px' }}>Recommended Threads</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                  {probeResult.recommendedThreads} Parallel Sockets
                </div>
              </div>

              <div style={{ background: '#060a12', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <div style={{ color: '#64748b', fontSize: '11.5px' }}>Safe Throttling Cap</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#fbbf24', marginTop: '4px' }}>
                  {probeResult.safeCap} Max Sockets
                </div>
              </div>

              <div style={{ background: '#060a12', padding: '12px 14px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                <div style={{ color: '#64748b', fontSize: '11.5px' }}>Max Turbo Burst</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>
                  {probeResult.maxTurbo} Extreme
                </div>
              </div>
            </div>

            <div style={{ color: '#94a3b8', fontSize: '12.5px', lineHeight: '1.6' }}>
              <strong>Strategy:</strong> {probeResult.antiHotlinkStrategy}
            </div>
          </div>
        </div>
      )}

      {/* 1-Click Scan All Sites Health */}
      <div style={{ padding: '24px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Fleet CDN Health Scanner</h3>
            <p style={{ color: '#64748b', fontSize: '12.5px', margin: '4px 0 0 0' }}>Probe all 16+ supported sites simultaneously for edge latency and socket thresholds.</p>
          </div>

          <button
            type="button"
            onClick={handleScanAllSites}
            disabled={scanningSites}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              background: '#131b2c',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              color: '#38bdf8',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: scanningSites ? 'wait' : 'pointer'
            }}
          >
            <IconRefresh size={13} color="#38bdf8" spinning={scanningSites} />
            {scanningSites ? 'Probing 16+ Platforms...' : '1-Click Scan All Sites'}
          </button>
        </div>

        {allSitesScan && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#060a12', borderBottom: '1px solid #1a2333', color: '#64748b' }}>
                  <th style={{ padding: '10px 14px' }}>Platform Name</th>
                  <th style={{ padding: '10px 14px' }}>CDN Provider</th>
                  <th style={{ padding: '10px 14px' }}>Edge Latency</th>
                  <th style={{ padding: '10px 14px' }}>Recommended Threads</th>
                  <th style={{ padding: '10px 14px' }}>Health Status</th>
                </tr>
              </thead>
              <tbody>
                {allSitesScan.sites.map((s) => (
                  <tr key={s.name} style={{ borderBottom: '1px solid #131b2c', color: '#cbd5e1' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#f8fafc' }}>{s.name}</td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{s.cdn}</td>
                    <td style={{ padding: '10px 14px', color: '#34d399' }}>{s.latencyMs} ms</td>
                    <td style={{ padding: '10px 14px', color: '#38bdf8', fontWeight: 600 }}>{s.recommendedThreads} sockets</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', fontSize: '11px', fontWeight: 600 }}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
