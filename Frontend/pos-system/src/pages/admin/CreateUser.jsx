import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

export default function CreateUser() {
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_URL || ''

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('cashier')
  // New profile fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState('')
  const [shiftStart, setShiftStart] = useState('')
  const [shiftEnd, setShiftEnd] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [isNarrow, setIsNarrow] = useState(false)

  // Define available route keys with friendly labels (page-level only)
  const ROUTE_OPTIONS = [
    // Admin
    { key: 'admin.dashboard', label: 'Admin: Dashboard' },
    { key: 'admin.permissions', label: 'Admin: Permissions' },
    { key: 'admin.products', label: 'Admin: Products' },
    { key: 'admin.logs', label: 'Admin: Logs (all)' },
    // Sales
    { key: 'sales.home', label: 'Sales: Home' },
    { key: 'sales.cashier', label: 'Sales: Cashier' },
    { key: 'sales.view', label: 'Sales: History' },
  { key: 'sales.logs', label: 'Sales: Logs' },
  { key: 'refunds.create', label: 'Sales: Refund' },
  { key: 'refunds.view', label: 'Sales: Refund History' },
    // Warehouse
    { key: 'warehouse.home', label: 'Warehouse: Home' },
    { key: 'warehouse.products', label: 'Warehouse: Products' },
    { key: 'warehouse.stockin', label: 'Warehouse: Stock In' },
    { key: 'warehouse.stockout', label: 'Warehouse: Stock Out' },
    { key: 'warehouse.stockaudit', label: 'Warehouse: Stock Audit' },
    { key: 'warehouse.lowstock', label: 'Warehouse: Low Stock' },
    { key: 'warehouse.reports', label: 'Warehouse: Reports' },
    { key: 'warehouse.logs', label: 'Warehouse: Logs' },
  ]

  // Role baseline defaults
  const roleBaseline = useMemo(() => ({
    admin: ['admin.dashboard', 'admin.permissions', 'admin.products', 'admin.logs'],
    cashier: ['sales.home','sales.cashier','sales.view','refunds.create','refunds.view'],
    warehouse: ['warehouse.home','warehouse.products','warehouse.stockin','warehouse.stockout','warehouse.stockaudit','warehouse.lowstock','warehouse.reports','warehouse.logs'],
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
      await axios.post(`${API_BASE}/api/auth/signup`, {
        username,
        password,
        role,
        firstName,
        lastName,
        birthdate: birthdate || undefined,
        phone,
        email,
        gender: gender || undefined,
        shiftStart,
        shiftEnd,
      })
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
  <h2 style={{ margin: '4px 0 12px 0', textAlign: 'left' }}>Create new user</h2>
  <form onSubmit={handleSubmit} style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, alignItems: 'start' }}>
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

            {/* Profile */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, background: '#fff' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Profile info</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>First name</label>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Last name</label>
                  <input value={lastName} onChange={e => setLastName(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Birthdate</label>
                  <input type="date" value={birthdate} onChange={e => setBirthdate(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Gender</label>
                  <select value={gender} onChange={e => setGender(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }}>
                    <option value="">—</option>
                    <option value="male">male</option>
                    <option value="female">female</option>
                    <option value="other">other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Phone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Shift start</label>
                  <input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Shift end</label>
                  <input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }} />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom: permissions selector with role-based defaults */}
  <div style={{ border: '2px solid #0b1b2b', borderRadius: 8, padding: 12, background: '#fff', marginTop: 16 }}>
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
