import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, Check, RefreshCw, X } from 'lucide-react';

export default function CouponsTab({ token }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: 20,
    maxUses: 100,
    expiresAt: ''
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    fetchCoupons();
  }, []);

  async function fetchCoupons() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.coupons)) {
        setCoupons(data.coupons);
      }
    } catch (err) {
      console.error('Failed to load coupons:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCoupon(e) {
    e.preventDefault();
    setSaveLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newCoupon)
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setNewCoupon({ code: '', discountType: 'percentage', discountValue: 20, maxUses: 100, expiresAt: '' });
        fetchCoupons();
      } else {
        setErrorMsg(data.message || 'Failed to create coupon');
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleDeleteCoupon(id, code) {
    if (!confirm(`Delete coupon ${code}?`)) return;

    try {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchCoupons();
      } else {
        alert(data.message || 'Failed to delete coupon');
      }
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', margin: '0 0 4px 0' }}>
            Coupons &amp; Promotional Discounts
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: 0 }}>
            Create discount codes (e.g. 20% off or ₹50 off) for user checkout on the pricing page.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={fetchCoupons}
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
            onClick={() => setIsModalOpen(true)}
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
            <Plus size={16} /> Create Coupon
          </button>
        </div>
      </div>

      {coupons.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '16px', color: '#94a3b8' }}>
          <Tag size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ margin: 0 }}>No active coupons found. Click "Create Coupon" to add one.</p>
        </div>
      ) : (
        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', fontSize: '12.5px' }}>
                <th style={{ padding: '14px 18px' }}>CODE</th>
                <th style={{ padding: '14px 18px' }}>DISCOUNT</th>
                <th style={{ padding: '14px 18px' }}>USAGE</th>
                <th style={{ padding: '14px 18px' }}>EXPIRES</th>
                <th style={{ padding: '14px 18px' }}>STATUS</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody style={{ color: '#f8fafc', fontSize: '13.5px' }}>
              {coupons.map((c) => (
                <tr key={c._id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '14px 18px', fontWeight: 700, color: '#38bdf8' }}>
                    {c.code}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    {c.discountType === 'percentage' ? `${c.discountValue}% OFF` : `₹${c.discountValue} OFF`}
                  </td>
                  <td style={{ padding: '14px 18px', color: '#cbd5e1' }}>
                    {c.usedCount} / {c.maxUses} used
                  </td>
                  <td style={{ padding: '14px 18px', color: '#94a3b8', fontSize: '12.5px' }}>
                    {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: c.isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: c.isActive ? '#34d399' : '#f87171'
                    }}>
                      {c.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDeleteCoupon(c._id, c.code)}
                      title="Delete Coupon"
                      style={{
                        padding: '6px 10px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        color: '#f87171',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Coupon Modal */}
      {isModalOpen && (
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
            maxWidth: '460px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                Create Coupon Code
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleCreateCoupon}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', color: '#cbd5e1', marginBottom: '4px' }}>Coupon Code (e.g. SAVE20)</label>
                <input
                  type="text"
                  required
                  placeholder="SAVE20"
                  value={newCoupon.code}
                  onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                  style={{ width: '100%', padding: '9px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', color: '#cbd5e1', marginBottom: '4px' }}>Discount Type</label>
                  <select
                    value={newCoupon.discountType}
                    onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value })}
                    style={{ width: '100%', padding: '9px', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc' }}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Flat (₹)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', color: '#cbd5e1', marginBottom: '4px' }}>
                    {newCoupon.discountType === 'percentage' ? 'Percentage Value (%)' : 'Discount (₹)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={newCoupon.discountType === 'percentage' ? 100 : 10000}
                    required
                    value={newCoupon.discountValue}
                    onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: Number(e.target.value) })}
                    style={{ width: '100%', padding: '9px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', color: '#cbd5e1', marginBottom: '4px' }}>Max Total Redemptions</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newCoupon.maxUses}
                  onChange={(e) => setNewCoupon({ ...newCoupon, maxUses: Number(e.target.value) })}
                  style={{ width: '100%', padding: '9px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', color: '#f8fafc' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '9px 16px', background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  style={{ padding: '9px 20px', background: '#0284c7', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                  {saveLoading ? 'Creating...' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
