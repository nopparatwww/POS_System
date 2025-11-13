import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

// Simple, self-contained Product Management UI (scaffold)
// Notes:
// - This UI attempts to fetch from `/api/protect/products` which is not yet implemented.
// - It will fail gracefully and allow local (client-only) mock edits until backend is added.
// - Once backend endpoints exist, the same UI will work with minimal changes.

const card = {
  background: 'var(--card-bg)',
  border: '1px solid var(--card-border)',
  borderRadius: 12,
  padding: 16,
  boxShadow: '0 8px 16px rgba(2,6,23,0.03)'
}
// Small search icon for inputs
function IconSearch({ size = 18, color = '#64748b' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function ProductManagement() {
  const API_BASE = import.meta.env.VITE_API_URL || ''
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('') // '', 'active', 'inactive'
  const [sort, setSort] = useState('-createdAt') // '-createdAt' | 'createdAt' | 'name' | 'price' | '-price'
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [total, setTotal] = useState(0)
  const [togglingId, setTogglingId] = useState(null)

  const [draft, setDraft] = useState({
    _id: '',
    sku: '',
    name: '',
    description: '',
    category: '',
    price: '',
    cost: '',
    stock: '',
    unit: 'ชิ้น',
    barcode: '',
    status: 'active',
    reorderLevel: '5',
  })
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true); setError('')
      try {
        const res = await axios.get(`${API_BASE}/api/protect/products`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('api_token') || ''}` },
          params: { t: Date.now(), q, page, limit, sort, status: statusFilter }
        })
        if (!mounted) return
        const data = res.data || {}
        setItems(Array.isArray(data.items) ? data.items : [])
        setTotal(Number(data.total || 0))
      } catch (e) {
        if (!mounted) return
        setError(e?.response?.data?.message || e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [API_BASE, q, page, limit, sort, statusFilter])

  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / (limit || 10))), [total, limit])

  function resetDraft() {
    setDraft({
      _id: '', sku: '', name: '', description: '', category: '', price: '', cost: '', stock: '', unit: 'ชิ้น', barcode: '', status: 'active', reorderLevel: '5'
    })
    setIsEditing(false)
  }

  function onEdit(item) {
    setDraft({
      _id: item._id || '',
      sku: item.sku || '',
      name: item.name || '',
      description: item.description || '',
      category: item.category || '',
      price: String(item.price ?? ''),
      cost: String(item.cost ?? ''),
      stock: String(item.stock ?? ''),
      unit: item.unit || 'ชิ้น',
      barcode: item.barcode || '',
      status: item.status || 'active',
      reorderLevel: String(item.reorderLevel ?? '5'),
    })
    setIsEditing(true)
  }

  async function onSave(e) {
    e?.preventDefault?.()
    const body = {
      sku: draft.sku.trim(),
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      category: draft.category.trim() || undefined,
      price: Number(draft.price),
      cost: draft.cost === '' ? undefined : Number(draft.cost),
      stock: Number(draft.stock),
      unit: draft.unit.trim() || undefined,
      barcode: draft.barcode.trim() || undefined,
      status: draft.status || undefined,
      reorderLevel: draft.reorderLevel === '' ? undefined : Number(draft.reorderLevel),
    }

    try {
      if (isEditing && draft._id) {
        const res = await axios.put(`${API_BASE}/api/protect/products/${encodeURIComponent(String(draft._id))}`, body, {
          headers: { Authorization: `Bearer ${localStorage.getItem('api_token') || ''}` }
        })
        const updated = res.data
        setItems(prev => prev.map(it => it._id === updated._id ? updated : it))
      } else {
        const res = await axios.post(`${API_BASE}/api/protect/products`, body, {
          headers: { Authorization: `Bearer ${localStorage.getItem('api_token') || ''}` }
        })
        const created = res.data
        // reload first page to reflect backend sort/pagination
        setPage(1)
        setItems(prev => [created, ...prev])
      }
      resetDraft()
    } catch (e) {
      setError(e?.response?.data?.message || e.message)
    }
  }

  async function onDelete(id) {
    if (!id) return
    if (!confirm('Delete this product?')) return
    try {
      await axios.delete(`${API_BASE}/api/protect/products/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('api_token') || ''}` }
      })
      setItems(prev => prev.filter(it => it._id !== id))
    } catch (e) {
      setError(e?.response?.data?.message || e.message)
    }
  }

  async function toggleStatus(item) {
    if (!item?._id || togglingId) return
    const newStatus = item.status === 'active' ? 'inactive' : 'active'
    setTogglingId(item._id)
    // optimistic update
    setItems(prev => prev.map(it => it._id === item._id ? { ...it, status: newStatus } : it))
    try {
      const res = await axios.put(`${API_BASE}/api/protect/products/${encodeURIComponent(item._id)}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('api_token') || ''}` }
      })
      const updated = res.data
      setItems(prev => prev.map(it => it._id === updated._id ? updated : it))
    } catch (e) {
      // revert on error
      setItems(prev => prev.map(it => it._id === item._id ? { ...it, status: item.status } : it))
      setError(e?.response?.data?.message || e.message)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 'none', margin: '0 auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Product Management</h1>

      {!!error && (
        <div style={{ ...card, borderColor: '#fde68a', background: '#fffbeb', color: '#92400e', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Search, filters, and create form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ ...card }}>
          <form onSubmit={onSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            <input placeholder="SKU" value={draft.sku} onChange={e => setDraft(d => ({ ...d, sku: e.target.value }))} style={{ padding: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', borderRadius: 8 }} />
            <input placeholder="Name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} style={{ padding: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', borderRadius: 8 }} />
            <input placeholder="Category" value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} style={{ padding: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', borderRadius: 8 }} />
            <input placeholder="Barcode" value={draft.barcode} onChange={e => setDraft(d => ({ ...d, barcode: e.target.value }))} style={{ padding: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', borderRadius: 8 }} />
            <input placeholder="Unit" value={draft.unit} onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))} style={{ padding: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', borderRadius: 8 }} />

            <input placeholder="Price" value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} style={{ padding: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', borderRadius: 8 }} />
            <input placeholder="Cost" value={draft.cost} onChange={e => setDraft(d => ({ ...d, cost: e.target.value }))} style={{ padding: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', borderRadius: 8 }} />
            <input placeholder="Stock" value={draft.stock} onChange={e => setDraft(d => ({ ...d, stock: e.target.value }))} style={{ padding: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', borderRadius: 8 }} />
            <input placeholder="Reorder Level" value={draft.reorderLevel} onChange={e => setDraft(d => ({ ...d, reorderLevel: e.target.value }))} style={{ padding: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', borderRadius: 8 }} />
            <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))} style={{ padding: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', borderRadius: 8 }}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>

            <textarea placeholder="Description" value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} style={{ gridColumn: '1 / -1', padding: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', borderRadius: 8, minHeight: 64 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700 }}>{isEditing ? 'Update' : 'Create'}</button>
              {isEditing && (
                <button type="button" onClick={resetDraft} style={{ background: '#e5e7eb', border: 'none', borderRadius: 8, padding: '8px 12px' }}>Cancel</button>
              )}
            </div>
          </form>
        </div>

  <div style={{ ...card, display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <IconSearch />
            </span>
            <input
              placeholder="Search by name or SKU"
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1); }}
              style={{ padding: '8px 10px 8px 36px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', borderRadius: 8, width: '100%' }}
            />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', borderRadius: 8 }}>
            <option value="">All statuses</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} style={{ padding: 8, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text)', borderRadius: 8 }}>
            <option value="-createdAt">Newest</option>
            <option value="createdAt">Oldest</option>
            <option value="name">Name A-Z</option>
            <option value="price">Price Low-High</option>
            <option value="-price">Price High-Low</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div style={{ ...card }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>{[
            '12%',   // SKU
            null,    // Name (flex)
            '14%',   // Category
            '10%',   // Price
            '8%',    // Stock
            '10%',   // Status
            '12%',   // Actions
          ].map((w, i) => (
            <col key={i} style={w ? { width: w } : undefined} />
          ))}</colgroup>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #eef2f7' }}>
              <th style={{ padding: 8 }}>SKU</th>
              <th style={{ padding: '8px 8px 8px 14px' }}>Name</th>
              <th style={{ padding: 8 }}>Category</th>
              <th style={{ padding: 8 }}>Price</th>
              <th style={{ padding: 8 }}>Stock</th>
              <th style={{ padding: 8 }}>Status</th>
              <th style={{ padding: 8, width: 140 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{it.sku}</td>
                <td style={{ padding: '8px 8px 8px 14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</td>
                <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{it.category}</td>
                <td style={{ padding: 8 }}>{typeof it.price === 'number' ? it.price.toFixed(2) : it.price}</td>
                <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{it.stock}</td>
                <td style={{ padding: 8 }}>
                  <button
                    type="button"
                    aria-label={`Toggle status for ${it.name}`}
                    aria-pressed={it.status === 'active'}
                    onClick={() => toggleStatus(it)}
                    disabled={togglingId === it._id}
                    style={{
                      position: 'relative',
                      width: 44,
                      height: 24,
                      borderRadius: 999,
                      border: '1px solid #e5e7eb',
                      background: it.status === 'active' ? '#059669' : '#f1f5f9',
                      boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.03)',
                      cursor: togglingId === it._id ? 'not-allowed' : 'pointer',
                      opacity: togglingId === it._id ? 0.7 : 1,
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: it.status === 'active' ? 22 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                        transition: 'left 150ms ease'
                      }}
                    />
                  </button>
                </td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => onEdit(it)} style={{ marginRight: 8, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px' }}>Edit</button>
                  <button onClick={() => onDelete(it._id)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px' }}>Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 16, color: '#64748b' }}>No products</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div
          onClick={(e) => {
            // close when clicking backdrop only
            if (e.target === e.currentTarget) {
              resetDraft()
            }
          }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div style={{
            width: 'min(700px, 92vw)',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            padding: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Edit product</h3>
              <button onClick={resetDraft} aria-label="Close" style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '6px 10px' }}>Close</button>
            </div>
            <form onSubmit={onSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>SKU</label>
                <input value={draft.sku} onChange={e => setDraft(d => ({ ...d, sku: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Name</label>
                <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Category</label>
                <input value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Barcode</label>
                <input value={draft.barcode} onChange={e => setDraft(d => ({ ...d, barcode: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Unit</label>
                <input value={draft.unit} onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Status</label>
                <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Price</label>
                <input value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Cost</label>
                <input value={draft.cost} onChange={e => setDraft(d => ({ ...d, cost: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Stock</label>
                <input value={draft.stock} onChange={e => setDraft(d => ({ ...d, stock: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Reorder Level</label>
                <input value={draft.reorderLevel} onChange={e => setDraft(d => ({ ...d, reorderLevel: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
              </div>
              <div />
              <div />

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Description</label>
                <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 8, minHeight: 80 }} />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={resetDraft} style={{ background: '#e5e7eb', border: 'none', borderRadius: 8, padding: '8px 12px' }}>Cancel</button>
                <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700 }}>Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom pagination controls */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              color: page <= 1 ? '#94a3b8' : '#0f172a',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 14px rgba(0,0,0,0.06)',
              transition: 'transform 100ms ease, background 120ms ease',
            }}
            onMouseEnter={e => { if (page > 1) e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.transform = 'none'; }}
            onMouseDown={e => { if (page > 1) e.currentTarget.style.transform = 'translateY(1px)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'none'; }}
          >
            Prev
          </button>
          <span style={{ color: '#475569', fontWeight: 600 }}>Page {page} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              color: page >= totalPages ? '#94a3b8' : '#0f172a',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 14px rgba(0,0,0,0.06)',
              transition: 'transform 100ms ease, background 120ms ease',
            }}
            onMouseEnter={e => { if (page < totalPages) e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.transform = 'none'; }}
            onMouseDown={e => { if (page < totalPages) e.currentTarget.style.transform = 'translateY(1px)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'none'; }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}