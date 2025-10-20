import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useSearchParams } from 'react-router-dom'

export default function AdminLogs() {
  const API_BASE = import.meta.env.VITE_API_URL || ''
  const [searchParams, setSearchParams] = useSearchParams()

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10))
  const [limit, setLimit] = useState(20)
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [user, setUser] = useState(searchParams.get('user') || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', String(limit))
        if (q) params.set('q', q)
        if (user) params.set('user', user)
        const res = await axios.get(`${API_BASE}/api/protect/logs?${params.toString()}`)
        setItems(res.data.items || [])
        setTotal(res.data.total || 0)
      } catch (e) {
        setError(e?.response?.data?.message || e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [API_BASE, page, limit, q, user])

  useEffect(() => {
    const params = {}
    if (q) params.q = q
    if (user) params.user = user
    if (page > 1) params.page = String(page)
    setSearchParams(params, { replace: true })
  }, [q, user, page, setSearchParams])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 'clamp(12px,2vw,24px)' }}>
      <div style={{ width: '100%', maxWidth: 1000 }}>
        <h2 style={{ margin: '4px 0 12px 0' }}>Activity Logs</h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <input
            placeholder="Search keyword (action, path, user)"
            value={q}
            onChange={e => { setPage(1); setQ(e.target.value) }}
            style={{ flex: '1 1 280px', minWidth: 200, padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }}
          />
          <input
            placeholder="Username filter"
            value={user}
            onChange={e => { setPage(1); setUser(e.target.value) }}
            style={{ width: 220, padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }}
          />
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 2fr', gap: 0, background: '#f8fafc', padding: '10px 12px', fontWeight: 600 }}>
            <div>Action</div>
            <div>Actor</div>
            <div>Target</div>
            <div>Status</div>
            <div>When</div>
          </div>
          {loading ? (
            <div style={{ padding: 12 }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 12, color: '#64748b' }}>No logs</div>
          ) : (
            items.map((it) => (
              <div key={it._id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 2fr', padding: '10px 12px', borderTop: '1px solid #f1f5f9' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{it.action}</div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>{it.method} {it.path}</div>
                </div>
                <div>{it.actorUsername} <span style={{ color: '#64748b' }}>({it.actorRole})</span></div>
                <div>{it.targetUsername || '-'}</div>
                <div>{it.status ?? '-'}</div>
                <div title={it.createdAt}>{new Date(it.createdAt).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 999, padding: '6px 8px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <button
              aria-label="Previous page"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                background: page <= 1 ? '#94a3b8' : '#0b1b2b',
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '8px 12px',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                transition: 'background-color 120ms ease, transform 120ms ease'
              }}
            >
              ← Prev
            </button>
            <div style={{ padding: '6px 10px', color: '#0b1b2b', fontWeight: 700 }}>
              Page {page} / {totalPages}
            </div>
            <button
              aria-label="Next page"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                background: page >= totalPages ? '#94a3b8' : '#0b1b2b',
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '8px 12px',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                transition: 'background-color 120ms ease, transform 120ms ease'
              }}
            >
              Next →
            </button>
          </div>
        </div>

        {error && <div style={{ marginTop: 10, color: '#dc2626' }}>{error}</div>}
      </div>
    </div>
  )
}
