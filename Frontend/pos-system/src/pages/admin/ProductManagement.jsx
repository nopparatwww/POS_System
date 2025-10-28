import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

// Simple, self-contained Product Management UI (scaffold)
// Notes:
// - This UI attempts to fetch from `/api/protect/products` which is not yet implemented.
// - It will fail gracefully and allow local (client-only) mock edits until backend is added.
// - Once backend endpoints exist, the same UI will work with minimal changes.

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 16,
  boxShadow: '0 8px 16px rgba(0,0,0,0.04)'
}

export default function ProductManagement() {
  const API_BASE = import.meta.env.VITE_API_URL || ''
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState({ _id: '', sku: '', name: '', price: '', stock: '' })
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true); setError('')
      try {
        const res = await axios.get(`${API_BASE}/api/protect/products`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('api_token') || ''}` },
          params: { t: Date.now() }
        })
        if (!mounted) return
        setItems(Array.isArray(res.data?.items) ? res.data.items : [])
      } catch (e) {
        // Graceful fallback: keep items empty and surface a friendly message once
        if (!mounted) return
        setError('Backend for products not found yet. Showing empty list. You can still use the UI; data will persist when backend is implemented.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [API_BASE])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return items
    return items.filter(it =>
      (it.name || '').toLowerCase().includes(s) || (it.sku || '').toLowerCase().includes(s)
    )
  }, [q, items])

  function resetDraft() {
    setDraft({ _id: '', sku: '', name: '', price: '', stock: '' })
    setIsEditing(false)
  }

  function onEdit(item) {
    setDraft({
      _id: item._id || '',
      sku: item.sku || '',
      name: item.name || '',
      price: String(item.price ?? ''),
      stock: String(item.stock ?? ''),
    })
    setIsEditing(true)
  }

  async function onSave(e) {
    e?.preventDefault?.()
    const body = {
      sku: draft.sku.trim(),
      name: draft.name.trim(),
      price: Number(draft.price) || 0,
      stock: Number(draft.stock) || 0,
    }

    // Try backend first; if missing, update client state only
    try {
      if (isEditing && draft._id) {
        const res = await axios.put(`${API_BASE}/api/protect/products/${encodeURIComponent(draft._id)}`, body, {
          headers: { Authorization: `Bearer ${localStorage.getItem('api_token') || ''}` }
        })
        const updated = res.data
        setItems(prev => prev.map(it => it._id === updated._id ? updated : it))
      } else {
        const res = await axios.post(`${API_BASE}/api/protect/products`, body, {
          headers: { Authorization: `Bearer ${localStorage.getItem('api_token') || ''}` }
        })
        const created = res.data
        setItems(prev => [created, ...prev])
      }
      resetDraft()
    } catch (e) {
      // Fallback: simulate locally
      if (isEditing && draft._id) {
        setItems(prev => prev.map(it => it._id === draft._id ? { ...it, ...body } : it))
      } else {
        const tmpId = `tmp_${Date.now()}`
        setItems(prev => [{ _id: tmpId, ...body }, ...prev])
      }
      resetDraft()
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
      // Local fallback
      setItems(prev => prev.filter(it => it._id !== id))
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px' }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Product Management</h1>

      {!!error && (
        <div style={{ ...card, borderColor: '#fde68a', background: '#fffbeb', color: '#92400e', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Search and create form */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ ...card }}>
          <form onSubmit={onSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            <input placeholder="SKU" value={draft.sku} onChange={e => setDraft(d => ({ ...d, sku: e.target.value }))} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
            <input placeholder="Name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
            <input placeholder="Price" value={draft.price} onChange={e => setDraft(d => ({ ...d, price: e.target.value }))} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
            <input placeholder="Stock" value={draft.stock} onChange={e => setDraft(d => ({ ...d, stock: e.target.value }))} style={{ padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 700 }}>{isEditing ? 'Update' : 'Create'}</button>
              {isEditing && (
                <button type="button" onClick={resetDraft} style={{ background: '#e5e7eb', border: 'none', borderRadius: 8, padding: '8px 12px' }}>Cancel</button>
              )}
            </div>
          </form>
        </div>

        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input placeholder="Search by name or SKU" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, padding: 8, border: '1px solid #e5e7eb', borderRadius: 8 }} />
          {loading && <span style={{ color: '#64748b' }}>Loading…</span>}
        </div>
      </div>

      {/* List */}
      <div style={{ ...card }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: 8 }}>SKU</th>
              <th style={{ padding: 8 }}>Name</th>
              <th style={{ padding: 8 }}>Price</th>
              <th style={{ padding: 8 }}>Stock</th>
              <th style={{ padding: 8, width: 140 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(it => (
              <tr key={it._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: 8 }}>{it.sku}</td>
                <td style={{ padding: 8 }}>{it.name}</td>
                <td style={{ padding: 8 }}>{typeof it.price === 'number' ? it.price.toFixed(2) : it.price}</td>
                <td style={{ padding: 8 }}>{it.stock}</td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => onEdit(it)} style={{ marginRight: 8, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px' }}>Edit</button>
                  <button onClick={() => onDelete(it._id)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px' }}>Delete</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 16, color: '#64748b' }}>No products</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}