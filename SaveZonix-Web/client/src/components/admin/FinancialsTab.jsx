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
  const [isEditingKeys, setIsEditingKeys] = useState(false);
  const [rzpKeyId, setRzpKeyId] = useState(settings?.razorpayKeyId || '');
  const [rzpKeySecret, setRzpKeySecret] = useState(settings?.razorpayKeySecret || '');
  const [showSecret, setShowSecret] = useState(false);
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

  function handleStartEditing() {
    setIsEditingKeys(true);
    setRzpKeyId(settings?.razorpayKeyId || '');
    setRzpKeySecret(settings?.razorpayKeySecret || '');
  }

  function handleCancelEdit() {
    setIsEditingKeys(false);
    setShowSecret(false);
    setRzpKeyId(settings?.razorpayKeyId || '');
    setRzpKeySecret(settings?.razorpayKeySecret || '');
  }

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
    if (e && e.preventDefault) e.preventDefault();
    setFeedback('');

    const cleanId = rzpKeyId.trim();
    const cleanSecret = rzpKeySecret.trim();

    // If clearing both to fallback to environment
    if (!cleanId && !cleanSecret) {
      if (!window.confirm('Clearing both fields will revert to server environment variables. Continue?')) {
        return;
      }
    } else {
      // Strict Key ID validation
      if (!cleanId.startsWith('rzp_test_') && !cleanId.startsWith('rzp_live_')) {
        alert('Validation Error: Key ID must start with "rzp_test_" or "rzp_live_". You cannot enter an email or arbitrary string.');
        return;
      }
      if (cleanId.includes('@') || cleanId.length < 15) {
        alert('Validation Error: Invalid Key ID format. Email addresses are strictly rejected.');
        return;
      }

      // Strict Key Secret validation
      if (!cleanSecret || cleanSecret.length < 14) {
        alert('Validation Error: Key Secret is required and must be at least 14 characters.');
        return;
      }

      // Explicit Confirmation
      const mode = cleanId.startsWith('rzp_live_') ? 'LIVE PRODUCTION' : 'TEST SANDBOX';
      const ok = window.confirm(
        `Confirm updating Razorpay credentials?\n\nGateway Mode: ${mode}\nKey ID: ${cleanId}\n\nAll client checkout requests will process through this gateway.`
      );
      if (!ok) return;
    }

    setSavingKeys(true);
    try {
      const token = localStorage.getItem('savezonix_token') || localStorage.getItem('savezonix_admin_token') || '';
      const updated = {
        ...settings,
        razorpayKeyId: cleanId,
        razorpayKeySecret: cleanSecret
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
        setIsEditingKeys(false);
        setShowSecret(false);
        setFeedback('Razorpay credentials validated, saved, and locked successfully.');
      } else {
        const d = await res.json().catch(() => ({}));
        setFeedback('Error: ' + (d.error || 'Server validation failed'));
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
        {/* Razorpay Gateway Credentials Container */}
        <div style={{ padding: '18px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Razorpay Gateway Configuration
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '4px',
                background: (settings?.razorpayKeyId || '').startsWith('rzp_live_')
                  ? 'rgba(16, 185, 129, 0.15)'
                  : (settings?.razorpayKeyId || '').startsWith('rzp_test_')
                  ? 'rgba(56, 189, 248, 0.15)'
                  : 'rgba(100, 116, 139, 0.15)',
                color: (settings?.razorpayKeyId || '').startsWith('rzp_live_')
                  ? '#34d399'
                  : (settings?.razorpayKeyId || '').startsWith('rzp_test_')
                  ? '#38bdf8'
                  : '#94a3b8',
                border: `1px solid ${(settings?.razorpayKeyId || '').startsWith('rzp_live_') ? 'rgba(16, 185, 129, 0.3)' : (settings?.razorpayKeyId || '').startsWith('rzp_test_') ? 'rgba(56, 189, 248, 0.3)' : '#334155'}`
              }}
            >
              {(settings?.razorpayKeyId || '').startsWith('rzp_live_')
                ? 'Mode: Live Production'
                : (settings?.razorpayKeyId || '').startsWith('rzp_test_')
                ? 'Mode: Sandbox Test'
                : 'Mode: Environment Default'}
            </span>
          </div>
          <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 14px 0' }}>
            Credentials are locked by default to prevent accidental edits and browser auto-fill. Click unlock to update.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#94a3b8', marginBottom: '4px' }}>
                Razorpay Key ID
              </label>
              <input
                type="text"
                readOnly={!isEditingKeys}
                disabled={!isEditingKeys}
                autoComplete="off"
                value={isEditingKeys ? rzpKeyId : (settings?.razorpayKeyId || '')}
                onChange={(e) => setRzpKeyId(e.target.value)}
                placeholder={isEditingKeys ? 'e.g. rzp_test_T3SdtTPSdbsaUg' : '(Not Configured - Using Default .env)'}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: isEditingKeys ? '#060a12' : '#0a0f1a',
                  border: `1px solid ${isEditingKeys ? '#2563eb' : '#1e293b'}`,
                  borderRadius: '6px',
                  color: isEditingKeys ? '#f8fafc' : '#94a3b8',
                  fontSize: '12.5px',
                  cursor: isEditingKeys ? 'text' : 'not-allowed',
                  opacity: isEditingKeys ? 1 : 0.8
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#94a3b8' }}>
                  Razorpay Key Secret
                </label>
                {isEditingKeys && (
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                  >
                    {showSecret ? 'Hide Secret' : 'Show Secret'}
                  </button>
                )}
              </div>
              <input
                type={showSecret ? 'text' : 'password'}
                readOnly={!isEditingKeys}
                disabled={!isEditingKeys}
                autoComplete="off"
                value={isEditingKeys ? rzpKeySecret : (settings?.razorpayKeySecret ? '••••••••••••••••' : '')}
                onChange={(e) => setRzpKeySecret(e.target.value)}
                placeholder={isEditingKeys ? 'e.g. vUvYJ7aPC4v2igWG2Hx5elDL' : '(Not Configured - Using Default .env)'}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: isEditingKeys ? '#060a12' : '#0a0f1a',
                  border: `1px solid ${isEditingKeys ? '#2563eb' : '#1e293b'}`,
                  borderRadius: '6px',
                  color: isEditingKeys ? '#f8fafc' : '#94a3b8',
                  fontSize: '12.5px',
                  cursor: isEditingKeys ? 'text' : 'not-allowed',
                  opacity: isEditingKeys ? 1 : 0.8
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              {!isEditingKeys ? (
                <button
                  type="button"
                  onClick={handleStartEditing}
                  style={{
                    padding: '8px 16px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Unlock to Change Keys
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSaveKeys}
                    disabled={savingKeys}
                    style={{
                      padding: '8px 18px',
                      background: '#2563eb',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {savingKeys ? 'Saving...' : 'Save & Update Keys'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={savingKeys}
                    style={{
                      padding: '8px 14px',
                      background: 'transparent',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#94a3b8',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

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
