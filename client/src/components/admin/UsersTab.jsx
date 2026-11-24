import React, { useState } from 'react';
import { IconCrown, IconSearch, IconTrash } from './AdminIcons';

export default function UsersTab({
  users,
  freeDailyLimit,
  actionLoadingId,
  onToggleVip,
  onToggleActive,
  onInspectUser,
  onDeleteUser
}) {
  const [searchUser, setSearchUser] = useState('');
  const [statusFilterUser, setStatusFilterUser] = useState('');

  // Monogram helper
  function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  const filteredUsers = (users || []).filter((u) => {
    if (searchUser.trim()) {
      const q = searchUser.toLowerCase().trim();
      const nameMatch = (u.name || u.FullName || '').toLowerCase().includes(q);
      const emailMatch = (u.email || u.Email || '').toLowerCase().includes(q);
      if (!nameMatch && !emailMatch) return false;
    }
    if (statusFilterUser === 'Active') return u.isActive !== false;
    if (statusFilterUser === 'Inactive') return u.isActive === false;
    if (statusFilterUser === 'VIP') return !!u.isVip;
    return true;
  });

  const thStyle = { padding: '12px', whiteSpace: 'nowrap', fontWeight: 600 };
  const tdStyle = { padding: '12px', whiteSpace: 'nowrap', verticalAlign: 'middle' };
  const badgeBase = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 9px',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontWeight: 600,
    lineHeight: 1.2,
    whiteSpace: 'nowrap'
  };
  const actionBtnBase = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    height: '28px',
    padding: '0 9px',
    background: '#131b2c',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    fontSize: '11.5px',
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    cursor: 'pointer'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              placeholder="Filter users by name or email..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              style={{ width: '100%', padding: '9px 12px 9px 34px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '8px', color: '#f8fafc', fontSize: '13px', outline: 'none' }}
            />
            <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', pointerEvents: 'none' }}>
              <IconSearch size={14} color="#64748b" />
            </span>
          </div>

          <select
            value={statusFilterUser}
            onChange={(e) => setStatusFilterUser(e.target.value)}
            style={{ padding: '9px 12px', background: '#0d131f', border: '1px solid #1a2333', borderRadius: '8px', color: '#cbd5e1', fontSize: '13px', outline: 'none' }}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Suspended Only</option>
            <option value="VIP">VIP Members Only</option>
          </select>
        </div>
      </div>

      {/* User Fleet Table */}
      <div style={{ background: '#0d131f', border: '1px solid #1a2333', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#060a12', borderBottom: '1px solid #1a2333', color: '#64748b', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ ...thStyle, paddingLeft: '16px' }}>User</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Membership</th>
                <th style={thStyle}>Daily Used</th>
                <th style={thStyle}>Account Status</th>
                <th style={{ ...thStyle, paddingRight: '16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isUpdatingVip = actionLoadingId === `vip-${u._id}`;
                const isUpdatingActive = actionLoadingId === `active-${u._id}`;
                const isDeleting = actionLoadingId === `del-${u._id}`;
                const isAdminRow = (u.role || '').toLowerCase() === 'admin' || u.email?.toLowerCase() === 'zaidm1323@gmail.com';

                return (
                  <tr key={u._id} style={{ borderBottom: '1px solid #131b2c', color: '#cbd5e1' }}>
                    {/* Name & Email with monogram */}
                    <td style={{ ...tdStyle, paddingLeft: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '185px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: u.isVip ? 'rgba(251, 191, 36, 0.15)' : '#131b2c',
                          border: `1px solid ${u.isVip ? 'rgba(251, 191, 36, 0.4)' : '#1e293b'}`,
                          color: u.isVip ? '#fbbf24' : '#94a3b8',
                          fontWeight: 700,
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {getInitials(u.name)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{u.name || 'Member'}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td style={tdStyle}>
                      <span style={{
                        ...badgeBase,
                        padding: '3px 8px',
                        fontSize: '11px',
                        background: isAdminRow ? 'rgba(56, 189, 248, 0.12)' : '#131b2c',
                        color: isAdminRow ? '#38bdf8' : '#94a3b8',
                        border: `1px solid ${isAdminRow ? 'rgba(56, 189, 248, 0.3)' : '#1e293b'}`
                      }}>
                        {isAdminRow ? 'Admin' : (u.role || 'User')}
                      </span>
                    </td>

                    {/* Membership */}
                    <td style={tdStyle}>
                      {u.isVip ? (
                        <span style={{ ...badgeBase, background: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                          <IconCrown size={12} color="#fbbf24" />
                          <span>{u.vipPlan === 'lifetime' ? 'VIP Lifetime' : (u.vipPlan === 'annual' ? 'VIP Annual' : 'VIP Pass')}</span>
                        </span>
                      ) : (
                        <span style={{ ...badgeBase, color: '#64748b', background: '#060a12', border: '1px solid #1a2333', fontWeight: 500 }}>
                          Free Tier
                        </span>
                      )}
                    </td>

                    {/* Daily Used */}
                    <td style={{ ...tdStyle, color: '#94a3b8', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                      {u.dailyDownloads || 0} / {u.isVip ? '∞' : (freeDailyLimit || 3)}
                    </td>

                    {/* Account Status */}
                    <td style={tdStyle}>
                      <span style={{
                        ...badgeBase,
                        background: u.isActive !== false ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: u.isActive !== false ? '#34d399' : '#f87171',
                        border: `1px solid ${u.isActive !== false ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                      }}>
                        {u.isActive !== false ? 'Active' : 'Suspended'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ ...tdStyle, paddingRight: '16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <button
                          onClick={() => onInspectUser(u._id, u.email)}
                          style={{ ...actionBtnBase, color: '#38bdf8' }}
                        >
                          History
                        </button>

                        {u.isVip ? (
                          <button
                            onClick={() => onToggleVip(u._id, u.email, null)}
                            disabled={isUpdatingVip}
                            style={{
                              ...actionBtnBase,
                              borderColor: '#334155',
                              color: '#fbbf24',
                              opacity: isUpdatingVip ? 0.6 : 1
                            }}
                          >
                            {isUpdatingVip ? 'Updating...' : 'Revoke VIP'}
                          </button>
                        ) : (
                          <div style={{ display: 'inline-flex', gap: '5px', flexShrink: 0 }}>
                            <button
                              onClick={() => onToggleVip(u._id, u.email, 'monthly')}
                              disabled={isUpdatingVip}
                              title="Grant 30-Day VIP Pass"
                              style={{
                                ...actionBtnBase,
                                background: '#2563eb',
                                borderColor: '#2563eb',
                                color: '#ffffff',
                                opacity: isUpdatingVip ? 0.6 : 1
                              }}
                            >
                              {isUpdatingVip ? '...' : 'Grant VIP'}
                            </button>
                            <button
                              onClick={() => onToggleVip(u._id, u.email, 'lifetime')}
                              disabled={isUpdatingVip}
                              title="Grant Lifetime / Founder VIP Pass (Never Expires)"
                              style={{
                                ...actionBtnBase,
                                background: 'rgba(245, 158, 11, 0.15)',
                                borderColor: 'rgba(245, 158, 11, 0.4)',
                                color: '#fbbf24',
                                fontWeight: 700,
                                opacity: isUpdatingVip ? 0.6 : 1
                              }}
                            >
                              ∞ Lifetime
                            </button>
                          </div>
                        )}

                        <button
                          onClick={async () => {
                            if (!confirm(`Reset today's download count to 0 for ${u.email}?`)) return;
                            const t = localStorage.getItem('savezonix_token') || localStorage.getItem('savezonix_admin_token');
                            try {
                              const res = await fetch(`/api/admin/users/${u._id}/reset-usage`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${t}` }
                              });
                              const d = await res.json();
                              alert(d.message || 'Usage reset');
                            } catch (e) {
                              alert('Error resetting usage');
                            }
                          }}
                          title="Reset today's download counter"
                          style={{ ...actionBtnBase, color: '#a78bfa' }}
                        >
                          Reset Usage
                        </button>

                        <button
                          onClick={async () => {
                            const newLimit = prompt(`Enter custom daily download limit for ${u.email} (-1 for unlimited, blank to inherit plan):`, u.customDailyLimit !== null && u.customDailyLimit !== undefined ? u.customDailyLimit : '');
                            if (newLimit === null) return;
                            const newQuality = prompt(`Enter custom max video quality (e.g. 720p, 1080p, 4K, blank to inherit plan):`, u.customMaxQuality || '');
                            const t = localStorage.getItem('savezonix_token') || localStorage.getItem('savezonix_admin_token');
                            try {
                              const res = await fetch(`/api/admin/users/${u._id}/limits`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
                                body: JSON.stringify({
                                  customDailyLimit: newLimit === '' ? null : Number(newLimit),
                                  customMaxQuality: newQuality ? newQuality.trim() : null
                                })
                              });
                              const d = await res.json();
                              alert(d.message || 'Limits updated');
                            } catch (e) {
                              alert('Error setting custom limits');
                            }
                          }}
                          title="Set custom download limit override"
                          style={{ ...actionBtnBase, color: '#38bdf8' }}
                        >
                          Custom Limits
                        </button>

                        <button
                          onClick={() => onToggleActive(u._id, u.email)}
                          disabled={isUpdatingActive}
                          style={{
                            ...actionBtnBase,
                            borderColor: u.isActive !== false ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                            color: u.isActive !== false ? '#f87171' : '#34d399',
                            opacity: isUpdatingActive ? 0.6 : 1
                          }}
                        >
                          {isUpdatingActive ? '...' : u.isActive !== false ? 'Suspend' : 'Activate'}
                        </button>

                        {!isAdminRow && (
                          <button
                            onClick={() => onDeleteUser(u._id, u.email)}
                            disabled={isDeleting}
                            title="Delete account"
                            style={{ ...actionBtnBase, width: '28px', padding: 0, borderColor: 'rgba(239, 68, 68, 0.25)', color: '#f87171' }}
                          >
                            <IconTrash size={12} color="#f87171" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    No matching user accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
