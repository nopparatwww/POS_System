/*
  Warehouse page (placeholder)

  Purpose:
  - Represents a Warehouse/settings area.
*/
import React, { useEffect, useState } from 'react'
import NavBar from '../components/NavBar'
import UserBadge from '../components/UserBadge'
import TopBar from '../components/TopBar'

// Warehouse page uses the shared left sidebar NavBar and renders a simple centered welcome card.
export default function Warehouse() {
  const [isNarrow, setIsNarrow] = useState(false)
  useEffect(() => {
    function onResize(){ setIsNarrow(window.innerWidth < 900) }
    onResize(); window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: isNarrow ? 'column' : 'row' }}>
      {!isNarrow && <NavBar mode="warehouse" />}
      {isNarrow && (
        <div style={{ position: 'relative' }}>
          <div style={{ width: '100%', height: 64, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', padding: '0 12px', background: '#fff' }}>
            <strong>Warehouse</strong>
          </div>
        </div>
      )}
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
