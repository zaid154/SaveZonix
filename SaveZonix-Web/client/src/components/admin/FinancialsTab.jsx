import React, { useState, useEffect } from 'react';
import { IconCreditCard, IconRefresh, IconCheck, IconAlertCircle } from './AdminIcons';

export default function FinancialsTab({ settings, setSettings, onSaveSettings }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    stats: { totalRevenue: 0, monthRevenue: 0, activeVipCount: 0, totalOrders: 0 },
    transactions: []
  });
  const [filterQuery, setFilterQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Key generator state
  const [keyPlan, setKeyPlan] = useState('monthly');
  const [generatedKey, setGeneratedKey] = useState('');

  // Razorpay keys edit state
  const [rzpKeyId, setRzpKeyId] = useState(settings?.razorpayKeyId || '');
  const [rzpKeySecret, setRzpKeySecret] = useState(settings?.razorpayKeySecret || '');
  const [savingKeys, setSavingKeys] = useState(false);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  useEffect(() => {
    if (settings) {
      setRzpKeyId(settings.razorpayKeyId || '');
      setRzpKeySecret(settings.razorpayKeySecret || '');
    }
  }, [settings]);

  async function fetchFinancialData() {
    setLoading(true);
    try {
      const token = localStorage.getItem('savezonix_token') || localStorage.getItem('savezonix_admin_token') || '';
      const res = await fetch('/api/admin/financials', {
        headers: {
          'x-admin-key': 'savezonix_admin_2026',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const json = await res.json();
        setData({
          stats: json.stats || { totalRevenue: 0, monthRevenue: 0, activeVipCount: 0, totalOrders: 0 },
          transactions: json.transactions || []
        });
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }

  async function handleRefund(paymentId, orderId) {
    if (!window.confirm('Are you sure you want to refund this payment and revoke VIP access?')) {
      return;
    }
    setActionLoading(true);
    setFeedback('');
    try {
      const token = localStorage.getItem('savezonix_token') || localStorage.getItem('savezonix_admin_token') || '';
      const res = await fetch('/api/admin/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'savezonix_admin_2026',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ paymentId, orderId })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Refund request failed');

      setFeedback('Payment refunded and VIP access revoked successfully.');
      fetchFinancialData();
    } catch (err) {
      setFeedback('Refund error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleGenerateKey() {
    try {
      const token = localStorage.getItem('savezonix_token') || localStorage.getItem('savezonix_admin_token') || '';
      const res = await fetch('/api/admin/generate-license-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'savezonix_admin_2026',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ plan: keyPlan })
      });
      const json = await res.json();
      if (res.ok && json.licenseKey) {
        setGeneratedKey(json.licenseKey);
      }
    } catch {
      // Error handling
    }
  }

  async function handleSaveKeys(e) {
    e.preventDefault();
    setSavingKeys(true);
    setFeedback('');
    try {
      const token = localStorage.getItem('savezonix_token') || localStorage.getItem('savezonix_admin_token') || '';
      const updated = {
        ...settings,
        razorpayKeyId: rzpKeyId.trim(),
        razorpayKeySecret: rzpKeySecret.trim()
      };
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'savezonix_admin_2026',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        setSettings(updated);
        setFeedback('Razorpay configuration updated successfully.');
      }
    } catch (err) {
      setFeedback('Failed to save keys: ' + err.message);
    } finally {
      setSavingKeys(false);
    }
  }

  const filteredTransactions = data.transactions.filter((tx) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      (tx.userEmail && tx.userEmail.toLowerCase().includes(q)) ||
      (tx.userName && tx.userName.toLowerCase().includes(q)) ||
      (tx.orderId && tx.orderId.toLowerCase().includes(q)) ||
      (tx.paymentId && tx.paymentId.toLowerCase().includes(q)) ||
      (tx.plan && tx.plan.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: '0 0 4px 0' }}>
            Financials & VIP Transactions
          </h2>
          <p style={{ color: '#64748b', fontSize: '12.5px', margin: 0 }}>
            Audit payments, manage Razorpay gateway credentials, issue refunds, and generate offline license keys.
          </p>
        </div>
        <button
          onClick={fetchFinancialData}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            background: '#131b2c',
            border: '1px solid #1e293b',
            borderRadius: '6px',
            color: '#94a3b8',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <IconRefresh size={14} spinning={loading} />
          Refresh
        </button>
      </div>

      {feedback && (
        <div style={{ padding: '10px 14px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#38bdf8', fontSize: '12.5px' }}>
          {feedback}
        </div>
      )}

      {/* 4 Financial Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div style={{ padding: '16px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '10px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Gross Revenue</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '6px' }}>
            INR {Number(data.stats.totalRevenue || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>All-time completed sales</div>
        </div>

        <div style={{ padding: '16px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '10px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Month (MTD)</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>
            INR {Number(data.stats.monthRevenue || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>Revenue in current calendar month</div>
        </div>

        <div style={{ padding: '16px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '10px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active VIP Members</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#fbbf24', marginTop: '6px' }}>
            {data.stats.activeVipCount || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>Subscribers with active access</div>
        </div>

        <div style={{ padding: '16px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '10px' }}>
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Completed Orders</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
            {data.stats.totalOrders || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>Successful verified payments</div>
        </div>
      </div>

      {/* Gateway Configuration & License Generator Split */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Razorpay Gateway Credentials */}
        <form onSubmit={handleSaveKeys} style={{ padding: '18px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '10px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px 0' }}>
            Razorpay Gateway Configuration
          </h3>
          <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 14px 0' }}>
            Set or update active credentials directly. Leave blank to fallback to environment variables.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                Key ID
              </label>
              <input
                type="text"
                value={rzpKeyId}
                onChange={(e) => setRzpKeyId(e.target.value)}
                placeholder="rzp_test_... or rzp_live_..."
                style={{ width: '100%', padding: '8px 10px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '6px', color: '#f8fafc', fontSize: '12.5px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                Key Secret
              </label>
              <input
                type="password"
                value={rzpKeySecret}
                onChange={(e) => setRzpKeySecret(e.target.value)}
                placeholder="Key Secret"
                style={{ width: '100%', padding: '8px 10px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '6px', color: '#f8fafc', fontSize: '12.5px' }}
              />
            </div>

            <button
              type="submit"
              disabled={savingKeys}
              style={{
                alignSelf: 'flex-start',
                padding: '8px 16px',
                background: '#2563eb',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {savingKeys ? 'Saving...' : 'Update Razorpay Keys'}
            </button>
          </div>
        </form>

        {/* Offline License Key Generator */}
        <div style={{ padding: '18px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '10px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px 0' }}>
            Offline License Key Generator
          </h3>
          <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 14px 0' }}>
            Issue offline activation keys for manual sales or promotional giveaways.
          </p>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
            <select
              value={keyPlan}
              onChange={(e) => setKeyPlan(e.target.value)}
              style={{ padding: '8px 10px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '6px', color: '#f8fafc', fontSize: '12.5px' }}
            >
              <option value="monthly">Monthly VIP (30 Days)</option>
              <option value="annual">Annual Pro (365 Days)</option>
              <option value="lifetime">Lifetime Founder Pass</option>
            </select>
            <button
              type="button"
              onClick={handleGenerateKey}
              style={{
                padding: '8px 14px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Generate Key
            </button>
          </div>

          {generatedKey && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: '#060a12', border: '1px dashed #38bdf8', borderRadius: '6px' }}>
              <code style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', flex: 1 }}>{generatedKey}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedKey);
                  alert('Key copied to clipboard: ' + generatedKey);
                }}
                style={{ padding: '4px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', fontSize: '11px', cursor: 'pointer' }}
              >
                Copy
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Transactions Ledger Table */}
      <div style={{ padding: '18px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Recent Payment Ledger ({filteredTransactions.length})
          </h3>
          <input
            type="text"
            placeholder="Search by customer, email, order, or ID..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{ width: '280px', padding: '6px 12px', background: '#060a12', border: '1px solid #1e293b', borderRadius: '6px', color: '#f8fafc', fontSize: '12px' }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b' }}>
                <th style={{ padding: '10px 8px' }}>Date</th>
                <th style={{ padding: '10px 8px' }}>Customer</th>
                <th style={{ padding: '10px 8px' }}>Plan</th>
                <th style={{ padding: '10px 8px' }}>Amount</th>
                <th style={{ padding: '10px 8px' }}>Method</th>
                <th style={{ padding: '10px 8px' }}>Payment ID</th>
                <th style={{ padding: '10px 8px' }}>Status</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '24px 8px', textAlign: 'center', color: '#64748b' }}>
                    No payment records found.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isSuccess = tx.status === 'completed';
                  const isRefunded = tx.status === 'refunded';
                  const dateStr = tx.createdAt ? new Date(tx.createdAt).toLocaleString('en-IN') : 'N/A';

                  return (
                    <tr key={tx._id || tx.orderId} style={{ borderBottom: '1px solid #141c2d' }}>
                      <td style={{ padding: '10px 8px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{dateStr}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <div style={{ color: '#f8fafc', fontWeight: 600 }}>{tx.userName || 'Customer'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{tx.userEmail}</div>
                      </td>
                      <td style={{ padding: '10px 8px', color: '#e2e8f0', textTransform: 'capitalize' }}>
                        {tx.plan || 'monthly'}
                      </td>
                      <td style={{ padding: '10px 8px', fontWeight: 700, color: '#f8fafc' }}>
                        INR {tx.amount}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#94a3b8' }}>
                        {tx.paymentMethod || 'Online'}
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <code style={{ fontSize: '11px', color: '#38bdf8' }}>{tx.paymentId || tx.orderId}</code>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: isSuccess ? 'rgba(16, 185, 129, 0.15)' : isRefunded ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                            color: isSuccess ? '#34d399' : isRefunded ? '#f87171' : '#94a3b8',
                            border: `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.3)' : isRefunded ? 'rgba(239, 68, 68, 0.3)' : '#334155'}`
                          }}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        {isSuccess && !tx.isLicenseKey && (
                          <button
                            type="button"
                            onClick={() => handleRefund(tx.paymentId, tx.orderId)}
                            disabled={actionLoading}
                            style={{
                              padding: '4px 10px',
                              background: '#1e293b',
                              border: '1px solid #334155',
                              borderRadius: '4px',
                              color: '#f87171',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
