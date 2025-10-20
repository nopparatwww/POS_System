import React, { useEffect, useMemo, useState } from 'react'
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
  // Mock data to render the list visually
  const MOCK_USERS = useMemo(() => {
    const rows = []
    for (let i = 0; i < 10; i++) {
      rows.push({ id: 'xxxxxxxxxx', username: 'alice', role: 'admin', created: 'create_date', updated: 'update_date' })
    }
    return rows
  }, [])

  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return MOCK_USERS
    return MOCK_USERS.filter(u => u.username.toLowerCase().includes(q))
  }, [query, MOCK_USERS])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = filtered.slice((page - 1) * pageSize, page * pageSize)

  // Inline styles to match the provided mock and adapt to viewport
  const styles = {
    wrap: { padding: 'clamp(12px, 2vw, 24px)', boxSizing: 'border-box', width: '100%' },
    topBar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexDirection: isNarrow ? 'column' : 'row', width: '100%', justifyContent: isNarrow ? 'flex-start' : 'space-between' },
    searchBox: { display: 'flex', alignItems: 'center', gap: 8, width: isNarrow ? '100%' : 'clamp(260px, 34vw, 400px)' },
    input: { flex: 1, width: '100%', height: 40, padding: '0 16px', borderRadius: 20, border: '1px solid #c7d0da', background: '#f6fafc', outline: 'none' },
  iconBtn: { width: 40, height: 40, borderRadius: 10, border: 'none', background: '#101d33', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  createBtn: { alignSelf: isNarrow ? 'stretch' : 'auto', background: '#101d33', color: '#fff', padding: '10px 16px', height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' },
    tableOuter: { width: '100%', overflowX: 'auto' },
    tableWrap: { border: '2px solid #0b1b2b', borderRadius: 8, background: '#fff', width: '100%', minWidth: 700, margin: 0 },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' },
  th: { textAlign: 'left', padding: '16px 16px', borderBottom: '2px solid #0b1b2b', color: '#0b1b2b', whiteSpace: 'nowrap' },
  thCenter: { textAlign: 'center', padding: '16px 16px', borderBottom: '2px solid #0b1b2b', color: '#0b1b2b', whiteSpace: 'nowrap' },
  td: { padding: '16px 16px', color: '#0b1b2b', whiteSpace: 'nowrap', verticalAlign: 'middle' },
  tdCenter: { padding: '16px 16px', color: '#0b1b2b', whiteSpace: 'nowrap', textAlign: 'center', verticalAlign: 'middle' },
    editBtn: { background: '#0b1b2b', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    pager: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 },
    pagerBtn: (disabled) => ({ background: '#0b1b2b', color: '#fff', border: 'none', width: 36, height: 28, borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }),
    pageNum: { fontWeight: 600, color: '#0b1b2b' },
    container: { width: '100%', maxWidth: 'none', margin: 0 }
  }

  function onSearch() {
    setPage(1)
  }

  function onCreate() {
    alert('Create user (placeholder)')
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
            <input
              placeholder="username search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }}
              style={styles.input}
            />
            <button onClick={onSearch} style={styles.iconBtn} aria-label="Search">
              <IconSearch />
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
              {current.map((row, idx) => (
                <tr key={idx}>
                  <td style={styles.td}>{row.id}</td>
                  <td style={styles.td}>{row.username}</td>
                  <td style={styles.td}>{row.role}</td>
                  <td style={styles.td}>{row.created}</td>
                  <td style={styles.td}>{row.updated}</td>
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
          <button style={styles.pagerBtn(page === 1)} disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>{'<'}</button>
          <div style={styles.pageNum}>{page}</div>
          <button style={styles.pagerBtn(page === totalPages)} disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>{'>'}</button>
        </div>
      </div>
    </div>
  )
}
