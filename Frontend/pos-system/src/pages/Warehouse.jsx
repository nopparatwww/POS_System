/*
  Warehouse page (placeholder)

  Purpose:
  - Represents a Warehouse/settings area. Back button returns to RoleSelect.
*/
import React from 'react'
import NavBar from '../components/NavBar'
import UserBadge from '../components/UserBadge'
import TopBar from '../components/TopBar'

// Warehouse page uses the shared left sidebar NavBar and renders a simple centered welcome card.
export default function Warehouse() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
  <NavBar mode="warehouse" />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <TopBar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 780, width: '100%', textAlign: 'center' }}>
            <div style={{ background: '#fff', padding: 28, borderRadius: 10, boxShadow: '0 6px 18px rgba(2,6,23,0.12)' }}>
              <h1 style={{ margin: 0, fontSize: 28 }}>Welcome, Warehouse</h1>
              <p style={{ marginTop: 12, color: '#475569' }}>This is the Warehouse landing area. Use the sidebar to access admin tools where permitted.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
