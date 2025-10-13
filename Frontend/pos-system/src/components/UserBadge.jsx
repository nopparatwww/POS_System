import React from 'react'

export default function UserBadge({ username, serverRole, inline = false }) {
  const uname = username ?? localStorage.getItem('username') ?? 'User'
  const role = serverRole ?? localStorage.getItem('server_role') ?? ''

  if (inline) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 6, background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#042124', fontWeight: 700 }}>{(uname[0] || 'U').toUpperCase()}</div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 700 }}>{uname}</div>
          <div style={{ fontSize: 12, color: '#475569' }}>{role}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#042124', fontWeight: 700 }}>{(uname[0] || 'U').toUpperCase()}</div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700 }}>{uname}</div>
        <div style={{ fontSize: 12, color: '#475569' }}>{role}</div>
      </div>
    </div>
  )
}
