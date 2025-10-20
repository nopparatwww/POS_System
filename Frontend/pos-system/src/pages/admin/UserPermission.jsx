import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'

// Define available route keys with friendly labels
const ROUTE_OPTIONS = [
  { key: 'admin.dashboard', label: 'Admin: Dashboard' },
  { key: 'admin.permissions', label: 'Admin: Permissions' },
  { key: 'sales.home', label: 'Sales: Home' },
  { key: 'warehouse.home', label: 'Warehouse: Home' },
]

export default function UserPermission(){
  const { username } = useParams()
  const API_BASE = import.meta.env.VITE_API_URL || ''
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [role, setRole] = useState('')
  const [allowRoutes, setAllowRoutes] = useState([])
  const [denyRoutes, setDenyRoutes] = useState([])
  const [notes, setNotes] = useState('')

  useEffect(() => {
    let mounted = true
    async function load(){
      setError(null)
      setLoading(true)
      try {
        const res = await axios.get(`${API_BASE}/api/permissions/${username}`)
        if(!mounted) return
        setRole(res.data?.role || '')
        setAllowRoutes(res.data?.allowRoutes || [])
        setDenyRoutes(res.data?.denyRoutes || [])
      } catch (e) {
        setError(e?.response?.data?.message || e.message)
      } finally {
        if(mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [username, API_BASE])

  const allowSet = useMemo(() => new Set(allowRoutes), [allowRoutes])
  const denySet = useMemo(() => new Set(denyRoutes), [denyRoutes])

  function toggle(list, setList, key){
    const has = list.includes(key)
    const next = has ? list.filter(k => k !== key) : [...list, key]
    setList(next)
  }

  async function handleSave(){
    setSaving(true)
    setError(null)
    try {
      await axios.put(`${API_BASE}/api/permissions/${username}`,{ allowRoutes, denyRoutes, notes })
      alert('Saved permissions')
      navigate('/admin/permissions')
    } catch (e) {
      setError(e?.response?.data?.message || e.message)
    } finally {
      setSaving(false)
    }
  }

  if(loading) return <div style={{ padding: 16 }}>Loading…</div>
  if(error) return <div style={{ padding: 16, color: '#dc2626' }}>{error}</div>

  return (
    <div style={{ padding: 'clamp(12px,2vw,24px)' }}>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => navigate('/admin/permissions')} style={{ border: '1px solid #0b1b2b', background: '#fff', color: '#0b1b2b', padding: '8px 12px', borderRadius: 6 }}>{'<'} Back</button>
      </div>
      <h2 style={{ margin: '4px 0 12px 0' }}>Edit permissions: {username}</h2>
      <div style={{ marginBottom: 16, color: '#4b5563' }}>Role: <b>{role}</b></div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Allow panel */}
        <div style={{ border: '2px solid #0b1b2b', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Allow routes</div>
          {ROUTE_OPTIONS.map(opt => (
            <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={allowSet.has(opt.key)}
                onChange={() => toggle(allowRoutes, setAllowRoutes, opt.key)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>

        {/* Deny panel */}
        <div style={{ border: '2px solid #0b1b2b', borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Deny routes</div>
          {ROUTE_OPTIONS.map(opt => (
            <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={denySet.has(opt.key)}
                onChange={() => toggle(denyRoutes, setDenyRoutes, opt.key)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ width: '100%', border: '1px solid #c7d0da', borderRadius: 6, padding: 8 }} />
        </div>
        <button disabled={saving} onClick={handleSave} style={{ background: '#0b1b2b', color: '#fff', padding: '10px 16px', border: 'none', borderRadius: 8 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
