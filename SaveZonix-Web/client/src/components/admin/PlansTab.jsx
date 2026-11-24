import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X, Shield, Sparkles, RefreshCw } from 'lucide-react';

export default function PlansTab({ token }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState(null); // null = modal closed, {} = new plan, planObj = editing
  const [saveLoading, setSaveLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const defaultPlanState = {
    name: '',
    slug: '',
    priceINR: 99,
    priceUSD: 1.99,
    billingPeriod: 'monthly',
    dailyDownloadLimit: 50,
    monthlyDownloadLimit: 1000,
    maxVideoQuality: '1080p',
    maxAudioQuality: 320,
    allowedFormats: ['mp4', 'webm', 'mp3', 'm4a'],
    playlistDownload: true,
    maxPlaylistItems: 25,
    concurrentDownloads: 3,
    maxFileSizeMB: 2048,
    speedPriority: 'high',
    ads: false,
    isActive: true,
    isPopular: false,
    sortOrder: 1
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/plans', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.plans)) {
        setPlans(data.plans);
      }
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePlan(e) {
    e.preventDefault();
    setSaveLoading(true);
    setErrorMsg(null);

    const isEdit = Boolean(editingPlan._id);
    const url = isEdit ? `/api/admin/plans/${editingPlan._id}` : '/api/admin/plans';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editingPlan)
      });
      const data = await res.json();
      if (data.success) {
        setEditingPlan(null);
        fetchPlans();
      } else {
        setErrorMsg(data.message || 'Failed to save plan');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleDeletePlan(id, slug) {
    if (slug === 'free') {
      alert('The default Free plan cannot be deleted.');
      return;
    }
    if (!confirm('Are you sure you want to permanently delete this plan?')) return;

    try {
      const res = await fetch(`/api/admin/plans/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchPlans();
      } else {
        alert(data.message || 'Failed to delete plan');
      }
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      {/* Header & Add Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', margin: '0 0 4px 0' }}>
            Subscription Plans Management
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: 0 }}>
            Every plan is DB-driven. Configure daily limits, max video quality (up to 4K), audio bitrates, and playlists.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchPlans}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#cbd5e1',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => setEditingPlan({ ...defaultPlanState })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 16px',
              background: '#0284c7',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Plus size={16} /> Create New Plan
          </button>
        </div>
      </div>

      {/* Plans Table / Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px',
        marginBottom: '40px'
      }}>
        {plans.map((p) => (
          <div
            key={p._id}
            style={{
              background: 'rgba(15, 23, 42, 0.7)',
              border: p.isPopular ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>{p.name}</span>
                  <span style={{ fontSize: '11px', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: '4px', color: '#94a3b8' }}>
                    {p.slug}
                  </span>
                  {p.isPopular && (
                    <span style={{ fontSize: '10px', background: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      POPULAR
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: '#38bdf8', marginTop: '4px' }}>
                  ₹{p.priceINR} <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 400 }}>/ {p.billingPeriod}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setEditingPlan({ ...p })}
                  title="Edit Plan"
                  style={{
                    padding: '6px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    color: '#38bdf8',
                    cursor: 'pointer'
                  }}
                >
                  <Edit2 size={14} />
                </button>
                {p.slug !== 'free' && (
                  <button
                    onClick={() => handleDeletePlan(p._id, p.slug)}
                    title="Delete Plan"
                    style={{
                      padding: '6px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px',
                      color: '#f87171',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Limits Specs */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '10px',
              padding: '12px',
              fontSize: '12.5px',
              color: '#cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              margin: '10px 0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Daily Download Limit:</span>
                <strong style={{ color: '#f8fafc' }}>{p.dailyDownloadLimit === -1 ? 'Unlimited (∞)' : `${p.dailyDownloadLimit} / day`}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Max Video Quality:</span>
                <strong style={{ color: '#38bdf8' }}>{p.maxVideoQuality}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Max Audio Quality:</span>
                <strong>{p.maxAudioQuality || 128} kbps MP3</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Playlist Downloads:</span>
                <span>{p.playlistDownload ? `✓ Enabled (${p.maxPlaylistItems || 50} items)` : '✗ Disabled'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Concurrency:</span>
                <span>{p.concurrentDownloads || 1} parallel streams</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Speed Priority:</span>
                <span style={{ textTransform: 'capitalize' }}>{p.speedPriority || 'standard'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Ad-Free:</span>
                <span>{p.ads ? 'No (With Ads)' : '✓ 100% Ad-Free'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Plan Edit / Create Modal */}
      {editingPlan && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            maxWidth: '620px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                {editingPlan._id ? `Edit Plan: ${editingPlan.name}` : 'Create New Plan'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSavePlan} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: '#cbd5e1', marginBottom: '4px' }}>Plan Name</label>
                <input
                  type="text"
                  required
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  style={{ width: '100%', padding: '9px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: '#cbd5e1', marginBottom: '4px' }}>Slug (lowercase)</label>
                <input
                  type="text"
                  required
                  value={editingPlan.slug}
                  disabled={editingPlan.slug === 'free'}
                  onChange={(e) => setEditingPlan({ ...editingPlan, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  style={{ width: '100%', padding: '9px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: '#cbd5e1', marginBottom: '4px' }}>Price (INR ₹)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editingPlan.priceINR}
                  onChange={(e) => setEditingPlan({ ...editingPlan, priceINR: Number(e.target.value) })}
                  style={{ width: '100%', padding: '9px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: '#cbd5e1', marginBottom: '4px' }}>Billing Period</label>
                <select
                  value={editingPlan.billingPeriod}
                  onChange={(e) => setEditingPlan({ ...editingPlan, billingPeriod: e.target.value })}
                  style={{ width: '100%', padding: '9px', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc' }}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: '#cbd5e1', marginBottom: '4px' }}>Daily Download Limit (-1 = Unlimited)</label>
                <input
                  type="number"
                  min="-1"
                  required
                  value={editingPlan.dailyDownloadLimit}
                  onChange={(e) => setEditingPlan({ ...editingPlan, dailyDownloadLimit: Number(e.target.value) })}
                  style={{ width: '100%', padding: '9px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: '#cbd5e1', marginBottom: '4px' }}>Max Video Quality</label>
                <select
                  value={editingPlan.maxVideoQuality}
                  onChange={(e) => setEditingPlan({ ...editingPlan, maxVideoQuality: e.target.value })}
                  style={{ width: '100%', padding: '9px', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc' }}
                >
                  <option value="360p">360p</option>
                  <option value="480p">480p</option>
                  <option value="720p">720p HD</option>
                  <option value="1080p">1080p Full HD</option>
                  <option value="1440p">1440p 2K</option>
                  <option value="4K">4K Ultra HD</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: '#cbd5e1', marginBottom: '4px' }}>Max Audio Quality</label>
                <select
                  value={editingPlan.maxAudioQuality}
                  onChange={(e) => setEditingPlan({ ...editingPlan, maxAudioQuality: Number(e.target.value) })}
                  style={{ width: '100%', padding: '9px', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc' }}
                >
                  <option value="128">128 kbps</option>
                  <option value="192">192 kbps</option>
                  <option value="320">320 kbps High</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', color: '#cbd5e1', marginBottom: '4px' }}>Concurrent Downloads</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={editingPlan.concurrentDownloads}
                  onChange={(e) => setEditingPlan({ ...editingPlan, concurrentDownloads: Number(e.target.value) })}
                  style={{ width: '100%', padding: '9px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc' }}
                />
              </div>

              {/* Toggles */}
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '20px', flexWrap: 'wrap', padding: '10px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingPlan.playlistDownload}
                    onChange={(e) => setEditingPlan({ ...editingPlan, playlistDownload: e.target.checked })}
                  />
                  Allow Playlist Downloads
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingPlan.ads}
                    onChange={(e) => setEditingPlan({ ...editingPlan, ads: e.target.checked })}
                  />
                  Display Ads
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingPlan.isPopular}
                    onChange={(e) => setEditingPlan({ ...editingPlan, isPopular: e.target.checked })}
                  />
                  Mark as Popular
                </label>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  style={{ padding: '10px 18px', background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  style={{ padding: '10px 24px', background: '#0284c7', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  {saveLoading ? 'Saving Plan...' : 'Save Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
