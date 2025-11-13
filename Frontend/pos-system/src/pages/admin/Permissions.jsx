import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

// Inline SVG icons
function IconSearch({ size = 20, color = '#0b1b2b' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconPencil({ size = 18, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill={color} />
      <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" fill={color} />
    </svg>
  )
}

export default function Permissions() {
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_URL || ''

  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    function onResize() {
      setIsNarrow(window.innerWidth < 900)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const pageSize = 10

  useEffect(() => {
    let mounted = true
    async function fetchUsers() {
      setLoading(true)
      setError(null)
      try {
        const res = await axios.get(`${API_BASE}/api/protect/users`, {
          params: { page, limit: pageSize, query }
        })
        if (!mounted) return
        setItems(res.data?.items || [])
        setTotal(res.data?.total || 0)
      } catch (e) {
        if (!mounted) return
        setError(e?.response?.data?.message || e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchUsers()
    return () => { mounted = false }
  }, [API_BASE, page, query])

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize))
  const current = items

  // Inline styles to match the provided mock and adapt to viewport
  const styles = {
    wrap: { padding: 'clamp(12px, 2vw, 24px)', boxSizing: 'border-box', width: '100%' },
    container: { width: '100%', maxWidth: 'none', margin: 0 },
    topBar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexDirection: isNarrow ? 'column' : 'row', width: '100%', justifyContent: isNarrow ? 'flex-start' : 'space-between' },
    searchBox: { display: 'flex', alignItems: 'center', gap: 8, width: isNarrow ? '100%' : 'clamp(260px, 34vw, 420px)' },
    inputWrap: { position: 'relative', flex: 1 },
    inputIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' },
    input: { flex: 1, width: '100%', height: 40, padding: '0 16px 0 40px', borderRadius: 20, border: '1px solid #e5e7eb', background: '#ffffff', outline: 'none', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' },
    iconBtn: { width: 40, height: 40, borderRadius: 10, border: 'none', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    createBtn: { alignSelf: isNarrow ? 'stretch' : 'auto', background: '#10b981', color: '#fff', padding: '10px 16px', height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 6px 14px rgba(16,185,129,0.25)' },
    tableOuter: { width: '100%', overflowX: 'auto' },
    tableWrap: { border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', width: '100%', minWidth: 700, margin: 0, boxShadow: '0 6px 14px rgba(0,0,0,0.06)' },
    table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' },
    th: { textAlign: 'left', padding: '16px 16px', borderBottom: '1px solid #e5e7eb', color: '#0b1b2b', whiteSpace: 'nowrap', background: '#f9fafb' },
    thCenter: { textAlign: 'center', padding: '16px 16px', borderBottom: '1px solid #e5e7eb', color: '#0b1b2b', whiteSpace: 'nowrap', background: '#f9fafb' },
    td: { padding: '16px 16px', color: '#0b1b2b', whiteSpace: 'nowrap', verticalAlign: 'middle' },
    tdCenter: { padding: '16px 16px', color: '#0b1b2b', whiteSpace: 'nowrap', textAlign: 'center', verticalAlign: 'middle' },
    editBtn: { background: '#10b981', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 6px 14px rgba(16,185,129,0.25)' },
    pager: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16 },
    pagerBtn: (disabled) => ({
      padding: '8px 14px',
      borderRadius: 999,
      border: '1px solid #e5e7eb',
      background: '#ffffff',
      color: disabled ? '#94a3b8' : '#0f172a',
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
    }),
    pageNum: { fontWeight: 700, color: '#475569' }
  }

  function onSearch() {
    setPage(1)
  }

  function onCreate() {
    navigate('/admin/permissions/create')
  }

  function onEdit(row) {
    navigate(`/admin/permissions/${row.username}`)
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.container}>
        {/* Search + Create row */}
        <div style={styles.topBar}>
          <div style={styles.searchBox}>
            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}><IconSearch size={18} color="#94a3b8" /></span>
              <input
                placeholder="username search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }}
                style={styles.input}
              />
            </div>
            <button onClick={onSearch} style={styles.iconBtn} aria-label="Search">
              <IconSearch color="#ffffff" />
            </button>
          </div>
          <button onClick={onCreate} style={styles.createBtn}>Create</button>
        </div>

        {/* Table */}
        <div style={styles.tableOuter}>
          <div style={styles.tableWrap}>
          <table style={styles.table}>
            <colgroup>
              <col />
              <col />
              <col />
              <col />
              <col />
              <col style={{ width: 80 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>Username</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}>Updated</th>
                <th style={styles.thCenter}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={styles.td}>Loading…</td></tr>
              )}
              {error && !loading && (
                <tr><td colSpan={6} style={{ ...styles.td, color: '#dc2626' }}>{error}</td></tr>
              )}
              {!loading && !error && current.length === 0 && (
                <tr><td colSpan={6} style={styles.td}>No data</td></tr>
              )}
              {!loading && !error && current.map((row, idx) => (
                <tr key={row._id || idx}>
                  <td style={styles.td}>{row._id ? String(row._id).slice(-10) : '—'}</td>
                  <td style={styles.td}>{row.username}</td>
                  <td style={styles.td}>{row.role}</td>
                  <td style={styles.td}>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</td>
                  <td style={styles.td}>{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}</td>
                  <td style={styles.tdCenter}>
                    <button onClick={() => onEdit(row)} style={styles.editBtn} aria-label="Edit">
                      <IconPencil />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Pagination */}
        <div style={styles.pager}>
          <button
            style={styles.pagerBtn(page === 1)}
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            onMouseEnter={e => { if (page > 1) e.currentTarget.style.background = '#f8fafc' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.transform = 'none' }}
            onMouseDown={e => { if (page > 1) e.currentTarget.style.transform = 'translateY(1px)' }}
            onMouseUp={e => { e.currentTarget.style.transform = 'none' }}
          >
            Prev
          </button>
          <div style={styles.pageNum}>Page {page} of {totalPages}</div>
          <button
            style={styles.pagerBtn(page === totalPages)}
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            onMouseEnter={e => { if (page < totalPages) e.currentTarget.style.background = '#f8fafc' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.transform = 'none' }}
            onMouseDown={e => { if (page < totalPages) e.currentTarget.style.transform = 'translateY(1px)' }}
            onMouseUp={e => { e.currentTarget.style.transform = 'none' }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
