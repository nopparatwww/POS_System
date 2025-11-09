import React, { useEffect, useState } from 'react'
import NavBar from '../../components/NavBar'
import TopBar from '../../components/TopBar'
import LogsView from '../admin/logs/LogsView'

export default function SalesLogsPage() {
  const [isNarrow, setIsNarrow] = useState(false)
  useEffect(() => {
    function onResize(){ setIsNarrow(window.innerWidth < 900) }
    onResize(); window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: isNarrow ? 'column' : 'row' }}>
      {!isNarrow && <NavBar mode="sales" />}
      {isNarrow && (
        <div style={{ position: 'relative' }}>
          <div style={{ width: '100%', height: 64, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', padding: '0 12px', background: '#fff' }}>
            <strong>Sales • Logs</strong>
          </div>
        </div>
      )}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <TopBar />
        <div style={{ flex: 1, padding: 24 }}>
          <LogsView title="Sales Logs" fixedRole="cashier" endpoint="/api/protect/logs/sales" />
        </div>
      </main>
    </div>
  )
}
