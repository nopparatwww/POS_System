// Frontend/pos-system/src/pages/warehouse/InventoryReports.jsx
import React, { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import NavBar from '../../components/NavBar'
import TopBar from '../../components/TopBar'

// --- (1) Component การ์ดสรุป ---
function StatCard({ title, value, bgColor = '#6ee7b7' }) {
  return (
    <div style={{
      background: bgColor,
      color: '#064e3b',
      padding: '20px 24px',
      borderRadius: 12,
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: 16, fontWeight: 600, opacity: 0.8 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  )
}

// --- (2) Component หลัก ---
export default function InventoryReports() {
  const API_BASE = import.meta.env.VITE_API_URL || ''
  const [isNarrow, setIsNarrow] = useState(false)

  // State for Stats
  const [stats, setStats] = useState({ totalProducts: 0, totalValue: 0, lowStock: 0, outOfStock: 0 })
  const [loadingStats, setLoadingStats] = useState(true)

  // State for Movement History (with pagination)
  const [movements, setMovements] = useState([])
  const [loadingMovements, setLoadingMovements] = useState(true)
  const [movePage, setMovePage] = useState(1);
  const [moveLimit, setMoveLimit] = useState(20);
  const [moveTotal, setMoveTotal] = useState(0);

  // General state
  const [error, setError] = useState(null)

  useEffect(() => {
    function onResize(){ setIsNarrow(window.innerWidth < 900) }
    onResize(); window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Fetch Stats on mount
  useEffect(() => {
    async function fetchStats() {
      setLoadingStats(true)
      try {
        const res = await axios.get(`${API_BASE}/api/protect/reports/stats`)
        setStats(res.data)
      } catch (e) {
        setError(e?.response?.data?.message || e.message)
      } finally {
        setLoadingStats(false)
      }
    }
    fetchStats()
  }, [API_BASE])

  // Fetch Movements (when page changes)
  useEffect(() => {
    async function fetchMovements() {
      setLoadingMovements(true)
      try {
        const res = await axios.get(`${API_BASE}/api/protect/reports/movement`, {
          params: { page: movePage, limit: moveLimit }
        })
        setMovements(res.data.items || [])
        setMoveTotal(res.data.total || 0)
      } catch (e) {
        setError(e?.response?.data?.message || e.message)
      } finally {
        setLoadingMovements(false)
      }
    }
    fetchMovements()
  }, [API_BASE, movePage, moveLimit])

  // (Styles...)
  const cardStyle = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 'clamp(16px, 3vw, 24px)',
    boxShadow: '0 8px 16px rgba(0,0,0,0.04)'
  }
  const thStyle = {
    textAlign: 'left',
    padding: '12px 16px',
    borderBottom: '2px solid #e5e7eb',
    color: '#1f2937',
    fontSize: 14
  }
  const tdStyle = {
    padding: '12px 16px',
    borderBottom: '1px solid #f3f4f6',
    color: '#374151',
    verticalAlign: 'middle'
  }
  const pagerBtnStyle = (disabled) => ({
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid #e5e7eb',
    background: '#ffffff',
    color: disabled ? '#94a3b8' : '#0f172a',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: '0 6px 14px rgba(0,0,0,0.06)',
  });
  const exportBtnStyle = (primary = false) => ({
    background: primary ? '#1f2937' : '#fff',
    color: primary ? '#fff' : '#1f2937',
    border: '1px solid #1f2937',
    padding: '8px 14px',
    borderRadius: 8,
    cursor: 'not-allowed', // (Stubbed)
    opacity: 0.7
  });

  const moveTotalPages = useMemo(() => Math.max(1, Math.ceil(moveTotal / moveLimit)), [moveTotal, moveLimit]);

  const formatCurrency = (val) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: isNarrow ? 'column' : 'row' }}>
      {!isNarrow && <NavBar mode="warehouse" />}
      {isNarrow && (
        <div style={{ position: 'relative' }}>
          <div style={{ width: '100%', height: 64, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', padding: '0 12px', background: '#fff' }}>
            <strong>Warehouse • Inventory Reports</strong>
          </div>
        </div>
      )}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', background: '#f9fafb' }}>
        {!isNarrow && <TopBar />}
        <div style={{ flex: 1, padding: 'clamp(16px, 3vw, 32px)', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
          
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24, color: '#111827' }}>Inventory Reports</h1>

          {/* --- Stat Cards --- */}
          <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: 20, marginBottom: 32 }}>
            <StatCard title="Total Products" value={loadingStats ? '...' : stats.totalProducts} />
            <StatCard title="Total Value" value={loadingStats ? '...' : `$${formatCurrency(stats.totalValue)}`} />
            <StatCard title="Low Stock Items" value={loadingStats ? '...' : stats.lowStock} bgColor="#fde68a" />
            <StatCard title="Out of Stock" value={loadingStats ? '...' : stats.outOfStock} bgColor="#fecaca" />
          </div>

          {/* --- Movement History Card --- */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: '#111827', margin: 0 }}>Stock Movement History</h2>
              <div style={{ display: 'flex', gap: 12 }}>
                <button style={exportBtnStyle(false)} title="Function not implemented">Export to Excel</button>
                <button style={exportBtnStyle(true)} title="Function not implemented">Export to PDF</button>
              </div>
            </div>
            
            {error && (
              <div style={{ color: '#dc2626', marginBottom: 16 }}>Error: {error}</div>
            )}

            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Product</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Quantity</th>
                    <th style={thStyle}>Reference</th>
                    <th style={thStyle}>User</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingMovements ? (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>Loading history...</td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>No stock movements found.</td>
                    </tr>
                  ) : (
                    movements.map(m => (
                      <tr key={m._id}>
                        <td style={tdStyle}>{new Date(m.date).toLocaleString()}</td>
                        <td style={tdStyle}>{m.productName} <span style={{ color: '#6b7280', fontSize: 12 }}>({m.sku})</span></td>
                        <td style={tdStyle}>
                          <span style={{
                            background: m.type === 'Stock In' ? '#dcfce7' : (m.type === 'Stock Out' ? '#fee2e2' : '#eef2ff'),
                            color: m.type === 'Stock In' ? '#166534' : (m.type === 'Stock Out' ? '#991b1b' : '#3730a3'),
                            padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600
                          }}>
                            {m.type}
                          </span>
                        </td>
                        <td style={{...tdStyle, color: m.quantity > 0 ? '#059669' : '#dc2626', fontWeight: 600}}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </td>
                        <td style={tdStyle}>{m.reference || 'N/A'}</td>
                        <td style={tdStyle}>{m.user}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* --- Pagination Controls --- */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <button
                  aria-label="Previous page"
                  onClick={() => setMovePage(p => Math.max(1, p - 1))}
                  disabled={movePage <= 1}
                  style={pagerBtnStyle(movePage <= 1)}
                >
                  Prev
                </button>
                <div style={{ padding: '6px 10px', color: '#475569', fontWeight: 700 }}>
                  Page {movePage} of {moveTotalPages}
                </div>
                <button
                  aria-label="Next page"
                  onClick={() => setMovePage(p => Math.min(moveTotalPages, p + 1))}
                  disabled={movePage >= moveTotalPages}
                  style={pagerBtnStyle(movePage >= moveTotalPages)}
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}