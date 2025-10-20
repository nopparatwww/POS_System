import React from 'react'
import NavBar from '../../components/NavBar'
import UserBadge from '../../components/UserBadge'
import TopBar from '../../components/TopBar'
import { Outlet } from 'react-router-dom'

export default function AdminLayout(){
  const username = localStorage.getItem('username') || 'User'
  const serverRole = localStorage.getItem('server_role') || ''

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '220px 1fr', gap: 0 }}>
      {/* Left sidebar */}
      <NavBar />

      {/* Main content area */}
      <main style={{ background: '#f7fbfa', minHeight: '100vh', padding: 0, boxSizing: 'border-box', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <TopBar />
  {/* TopBar provides the inline user badge */}

        {/* Child content (full width) */}
        <div style={{ width: '100%', maxWidth: 'none', margin: 0, paddingTop: 24 }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
