import React, { useEffect, useState } from 'react'
import NavBar from '../../components/NavBar'
import TopBar from '../../components/TopBar'
import LogsView from '../admin/logs/LogsView'

export default function SalesLogsPage() {
  const [isNarrow, setIsNarrow] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    function onResize(){ setIsNarrow(window.innerWidth < 900) }
    onResize(); window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: isNarrow ? 'column' : 'row', background: '#f7fbfa' }}>
      {!isNarrow && <NavBar mode="sales" />}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', marginLeft: isNarrow ? 0 : 220 }}>
        {/* Header with menu button (mobile) + TopBar */}
        <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#fff' }}>
          {isNarrow ? (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff' }}
              aria-label="Toggle menu"
            >
              ☰
            </button>
          ) : (
            <div style={{ width: 1 }} />
          )}
          <TopBar />
        </div>

        {isNarrow && menuOpen && (
          <div style={{ background: '#0f172a' }}>
            <NavBar horizontal mode="sales" />
          </div>
        )}

        {/* Content centered */}
        <div style={{ flex: 1, padding: 24, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 1000 }}>
            <LogsView title="Sales Logs" fixedRole="cashier" endpoint="/api/protect/logs/sales" />
          </div>
        </div>
      </main>
    </div>
  )
}
