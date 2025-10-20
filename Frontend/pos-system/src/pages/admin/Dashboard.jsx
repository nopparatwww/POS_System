import React from 'react'

export default function Dashboard(){
  return (
    <div style={{ padding: 'clamp(12px,2vw,24px)' }}>
      <div style={{ border: '2px solid #0b1b2b', borderRadius: 8, background: '#fff', padding: 16 }}>
        <h1 style={{ margin: '0 0 8px 0' }}>Admin Dashboard</h1>
        <p style={{ margin: 0, color: '#475569' }}>Welcome to the admin area. Use the left menu to navigate.</p>
      </div>
    </div>
  )
}
