import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useSearchParams } from 'react-router-dom'
import NavBar from '../../components/NavBar'
import TopBar from '../../components/TopBar'

export default function WarehouseLogsPage() {
  const API_BASE = import.meta.env.VITE_API_URL || ''
  const [searchParams, setSearchParams] = useSearchParams()

  const [isNarrow, setIsNarrow] = useState(false)
  useEffect(() => {
    function onResize(){ setIsNarrow(window.innerWidth < 900) }
    onResize(); window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10))
  const [limit, setLimit] = useState(20)
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [productMap, setProductMap] = useState({})

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', String(limit))
        if (q) params.set('q', q)
        const url = `${API_BASE}/api/protect/logs/warehouse-activity?${params.toString()}`
        const res = await axios.get(url)
        setItems(res.data.items || [])
        setTotal(res.data.total || 0)
      } catch (e) {
        setError(e?.response?.data?.message || e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [API_BASE, page, limit, q])

  // When items change, fetch product names for any productIds mentioned in details
  useEffect(() => {
    const ids = new Set()
    const idToSku = {}
    const idToName = {}
    items.forEach(it => {
      const d = it.details || {}
      if (d.productId) {
        const id = String(d.productId)
        ids.add(id)
        if (d.sku) idToSku[id] = d.sku
        if (d.productName) idToName[id] = d.productName
      }
    })
    const isMongoId = (s) => /^[0-9a-fA-F]{24}$/.test(String(s))

    // Pre-fill map with info already present in logs to avoid unnecessary network calls (and 404 noise)
    const withLocalInfo = Array.from(ids).filter(id => (idToSku[id] || idToName[id]))
    if (withLocalInfo.length > 0) {
      setProductMap(pm => {
        const next = { ...pm }
        withLocalInfo.forEach(id => {
          if (!next[id]) next[id] = { sku: idToSku[id] || null, name: idToName[id] || null, derived: true }
        })
        return next
      })
    }

    // Only fetch true ObjectIds that we don't already know or have filled locally
    const toFetch = Array.from(ids).filter(id => !productMap[id] && !withLocalInfo.includes(id) && isMongoId(id))
    if (toFetch.length === 0) return
    let mounted = true
    ;(async () => {
      try {
        // Use allSettled so one 404/failed product doesn't abort all fetches
        const results = await Promise.allSettled(toFetch.map(id => axios.get(`${API_BASE}/api/protect/products/${encodeURIComponent(id)}`)))
        if (!mounted) return
        setProductMap(pm => {
          const next = { ...pm }
          results.forEach((res, idx) => {
              const id = toFetch[idx]
              if (res.status === 'fulfilled' && res.value && res.value.data) {
                const p = res.value.data || {}
                if (p._id) next[String(p._id)] = { name: p.name, sku: p.sku }
              } else {
                // If fetch failed (404 or other), store a sentinel so UI can show 'Deleted product'
                next[String(id)] = { missing: true, sku: idToSku[id] || null, name: idToName[id] || null }
              }
            })
          return next
        })
      } catch (e) {
        // ignore unexpected errors
      }
    })()
    return () => { mounted = false }
  }, [items, API_BASE])

  useEffect(() => {
    const params = {}
    if (q) params.q = q
    if (page > 1) params.page = String(page)
    setSearchParams(params, { replace: true })
  }, [q, page, setSearchParams])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: isNarrow ? 'column' : 'row' }}>
      {!isNarrow && <NavBar mode="warehouse" />}
      {isNarrow && (
        <div style={{ position: 'relative' }}>
          <div style={{ width: '100%', height: 64, borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', padding: '0 12px', background: '#fff' }}>
            <strong>Warehouse • Logs</strong>
          </div>
        </div>
      )}
  <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', marginLeft: isNarrow ? 0 : 220 }}>
        <TopBar />
        <div style={{ flex: 1, padding: 'clamp(16px, 3vw, 32px)' }}>
          <div style={{ width: '100%', maxWidth: 1000, margin: '0 auto' }}>
            <h2 style={{ margin: '4px 0 12px 0' }}>Warehouse Activity Logs</h2>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                placeholder="Search keyword (action, path, user)"
                value={q}
                onChange={e => { setPage(1); setQ(e.target.value) }}
                style={{ flex: '1 1 320px', padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }}
              />
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
                <thead style={{ background: '#f8fafc', fontWeight: 600 }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>Action</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', width: 220 }}>Product</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', width: 180 }}>Actor</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', width: 160 }}>Change</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', width: 100 }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', width: 220 }}>When</th>
                  </tr>
                </thead>
                {loading ? (
                  <tbody>
                    <tr>
                      <td colSpan={6} style={{ padding: 12 }}>Loading…</td>
                    </tr>
                  </tbody>
                ) : items.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={6} style={{ padding: 12, color: '#64748b' }}>No logs</td>
                    </tr>
                  </tbody>
                ) : (
                  <tbody>
                    {items.map((it) => (
                      <tr key={it._id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 600 }}>{it.action}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>{it.method} {it.path}</div>
                        </td>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                          {(() => {
                            const d = it.details || {}
                            const pid = d.productId || d.id || null
                            const sku = d.sku || null
                            const prod = pid && productMap[String(pid)]
                            // If we recorded a failed fetch sentinel, show Deleted product (and fallback sku if available)
                            if (prod && prod.missing) {
                              return (
                                <div style={{ marginTop: 6, color: '#0f172a' }}>
                                  <div style={{ fontWeight: 700 }}>Deleted product</div>
                                  {prod.sku ? <div style={{ color: '#64748b', fontSize: 12 }}>{prod.sku}</div> : (sku ? <div style={{ color: '#64748b', fontSize: 12 }}>{sku}</div> : null)}
                                </div>
                              )
                            }

                            if (prod?.name || sku || d.productName) {
                              return (
                                <div style={{ marginTop: 6, color: '#0f172a' }}>
                                  <div style={{ fontWeight: 700 }}>{prod?.name || d.productName || sku}</div>
                                  {prod?.sku ? <div style={{ color: '#64748b', fontSize: 12 }}>{prod.sku}</div> : (sku ? <div style={{ color: '#64748b', fontSize: 12 }}>{sku}</div> : null)}
                                </div>
                              )
                            }
                            return '-'
                          })()}
                        </td>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{it.actorUsername} <div style={{ color: '#64748b', fontSize: 12 }}>({it.actorRole})</div></td>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
                          {(() => {
                            const d = it.details || {}
                            // Prefer explicit delta/quantity fields then newStock/result
                            if (typeof d.quantity !== 'undefined') {
                              return (
                                <div>
                                  <div style={{ fontWeight: 600 }}>{d.quantity}</div>
                                  {typeof d.newStock !== 'undefined' && <div style={{ color: '#64748b', fontSize: 12 }}>New: {d.newStock}</div>}
                                </div>
                              )
                            }
                            if (typeof d.change !== 'undefined') {
                              return (
                                <div>
                                  <div style={{ fontWeight: 600 }}>{d.change}</div>
                                  {typeof d.newStock !== 'undefined' && <div style={{ color: '#64748b', fontSize: 12 }}>New: {d.newStock}</div>}
                                </div>
                              )
                            }
                            if (typeof d.newStock !== 'undefined') {
                              return <div style={{ fontWeight: 600 }}>New: {d.newStock}</div>
                            }
                            // fallback: show dash
                            return '-' 
                          })()}
                        </td>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>{it.status ?? '-'}</td>
                        <td style={{ padding: '10px 12px', verticalAlign: 'top' }} title={it.createdAt}>{new Date(it.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <button
                  aria-label="Previous page"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#ffffff', color: page <= 1 ? '#94a3b8' : '#0f172a', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  Prev
                </button>
                <div style={{ padding: '6px 10px', color: '#475569', fontWeight: 700 }}>Page {page} of {totalPages}</div>
                <button
                  aria-label="Next page"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ padding: '8px 14px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#ffffff', color: page >= totalPages ? '#94a3b8' : '#0f172a', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Next
                </button>
              </div>
            </div>

            {error && <div style={{ marginTop: 10, color: '#dc2626' }}>{error}</div>}
          </div>
        </div>
      </main>
    </div>
  )
}
