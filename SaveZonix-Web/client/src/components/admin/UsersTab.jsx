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
            <span style={{ position: 'absolute', left: '11px', top: '10px', color: '#64748b' }}>
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
                <th style={{ padding: '12px 16px' }}>User</th>
                <th style={{ padding: '12px 16px' }}>Role</th>
                <th style={{ padding: '12px 16px' }}>Membership</th>
                <th style={{ padding: '12px 16px' }}>Daily Used</th>
                <th style={{ padding: '12px 16px' }}>Account Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isUpdatingVip = actionLoadingId === `vip-${u._id}`;
                const isUpdatingActive = actionLoadingId === `active-${u._id}`;
                const isDeleting = actionLoadingId === `del-${u._id}`;

                return (
                  <tr key={u._id} style={{ borderBottom: '1px solid #131b2c', color: '#cbd5e1' }}>
                    {/* Name & Email with monogram */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
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
                        <div>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{u.name || 'Member'}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: u.role === 'Admin' ? 'rgba(56, 189, 248, 0.12)' : '#131b2c',
                        color: u.role === 'Admin' ? '#38bdf8' : '#94a3b8',
                        border: `1px solid ${u.role === 'Admin' ? 'rgba(56, 189, 248, 0.3)' : '#1e293b'}`
                      }}>
                        {u.role || 'User'}
                      </span>
                    </td>

                    {/* Membership */}
                    <td style={{ padding: '14px 16px' }}>
                      {u.isVip ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, background: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                          <IconCrown size={12} color="#fbbf24" />
                          VIP Pass
                        </span>
                      ) : (
                        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', color: '#64748b', background: '#060a12', border: '1px solid #1a2333' }}>
                          Free Tier
                        </span>
                      )}
                    </td>

                    {/* Daily Used */}
                    <td style={{ padding: '14px 16px', color: '#94a3b8', fontWeight: 500 }}>
                      {u.dailyDownloads || 0} / {u.isVip ? '∞' : (freeDailyLimit || 10)}
                    </td>

                    {/* Account Status */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        background: u.isActive !== false ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: u.isActive !== false ? '#34d399' : '#f87171',
                        border: `1px solid ${u.isActive !== false ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                      }}>
                        {u.isActive !== false ? 'Active' : 'Suspended'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => onInspectUser(u._id)}
                          style={{ padding: '5px 10px', background: '#131b2c', border: '1px solid #1e293b', borderRadius: '6px', color: '#38bdf8', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          History
                        </button>

                        <button
                          onClick={() => onToggleVip(u._id)}
                          disabled={isUpdatingVip}
                          style={{
                            padding: '5px 10px',
                            background: u.isVip ? '#131b2c' : '#2563eb',
                            border: `1px solid ${u.isVip ? '#334155' : '#2563eb'}`,
                            borderRadius: '6px',
                            color: u.isVip ? '#fbbf24' : '#ffffff',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            opacity: isUpdatingVip ? 0.6 : 1
                          }}
                        >
                          {isUpdatingVip ? 'Updating...' : u.isVip ? 'Revoke VIP' : 'Grant VIP'}
                        </button>

                        <button
                          onClick={() => onToggleActive(u._id)}
                          disabled={isUpdatingActive}
                          style={{
                            padding: '5px 10px',
                            background: '#131b2c',
                            border: `1px solid ${u.isActive !== false ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                            borderRadius: '6px',
                            color: u.isActive !== false ? '#f87171' : '#34d399',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            opacity: isUpdatingActive ? 0.6 : 1
                          }}
                        >
                          {isUpdatingActive ? '...' : u.isActive !== false ? 'Suspend' : 'Activate'}
                        </button>

                        {u.role !== 'Admin' && u.email !== 'zaidm1323@gmail.com' && (
                          <button
                            onClick={() => onDeleteUser(u._id, u.email)}
                            disabled={isDeleting}
                            title="Delete account"
                            style={{ padding: '5px 8px', background: '#131b2c', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', color: '#f87171', fontSize: '11.5px', cursor: 'pointer' }}
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
