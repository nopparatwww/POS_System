import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

export default function CreateUser() {
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_URL || ''

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('cashier')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)

  // Define available route keys with friendly labels (same as other pages)
  const ROUTE_OPTIONS = [
    { key: 'admin.dashboard', label: 'Admin: Dashboard' },
    { key: 'admin.permissions', label: 'Admin: Permissions' },
    { key: 'admin.logs', label: 'Admin: Logs' },
    { key: 'sales.home', label: 'Sales: Home' },
    { key: 'warehouse.home', label: 'Warehouse: Home' },
  ]

  // Role baseline defaults
  const roleBaseline = useMemo(() => ({
    admin: ['admin.dashboard', 'admin.permissions', 'admin.logs'],
    cashier: ['sales.home'],
    warehouse: ['warehouse.home'],
  }), [])

  const [allowRoutes, setAllowRoutes] = useState(roleBaseline['cashier'])

  // When role changes, reset allowed routes to baseline for that role
  useEffect(() => {
    setAllowRoutes(roleBaseline[role] || [])
  }, [role, roleBaseline])

  // Responsive toggle
  useEffect(() => {
    function onResize() {
      setIsNarrow(window.innerWidth < 900)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function toggleAllow(key) {
    setAllowRoutes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!username || !password) {
      setError('Please provide username and password')
      return
    }
    setSaving(true)
    try {
      await axios.post(`${API_BASE}/api/auth/signup`, { username, password, role })
      // Immediately set permissions for the new user
      try {
        await axios.put(`${API_BASE}/api/permissions/${encodeURIComponent(username)}`, { allowRoutes, denyRoutes: [], notes: '' })
      } catch (permErr) {
        // If permissions update fails, report but still allow navigation
        console.error('Failed to set permissions for new user:', permErr)
      }
      alert('User created')
      navigate('/admin/permissions')
    } catch (e) {
      setError(e?.response?.data?.message || e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 'clamp(12px,2vw,24px)' }}>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => navigate('/admin/permissions')} style={{ border: '1px solid #0b1b2b', background: '#fff', color: '#0b1b2b', padding: '8px 12px', borderRadius: 6 }}>{'<'} Back</button>
      </div>
      <h2 style={{ margin: '4px 0 12px 0' }}>Create new user</h2>
      <form onSubmit={handleSubmit} style={{ maxWidth: 900 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 16, alignItems: 'start' }}>
          {/* Left: account fields */}
          <div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }}>
                <option value="admin">admin</option>
                <option value="cashier">cashier</option>
                <option value="warehouse">warehouse</option>
              </select>
            </div>
          </div>

          {/* Right: permissions selector with role-based defaults */}
          <div style={{ border: '2px solid #0b1b2b', borderRadius: 8, padding: 12, background: '#fff' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Allowed pages</div>
            <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>เมื่อเลือก Role ระบบจะตั้งค่าเริ่มต้นให้อัตโนมัติ สามารถปรับติ๊กเพิ่ม/ลดได้</div>
            <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 8 }}>
              {ROUTE_OPTIONS.map(opt => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={allowRoutes.includes(opt.key)}
                    onChange={() => toggleAllow(opt.key)}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {error && <div style={{ color: '#dc2626', marginTop: 12 }}>{error}</div>}
        <div style={{ marginTop: 12 }}>
          <button disabled={saving} style={{ background: '#0b1b2b', color: '#fff', padding: '10px 16px', border: 'none', borderRadius: 8 }}>
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  )
}
