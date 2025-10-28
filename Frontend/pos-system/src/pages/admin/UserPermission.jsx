import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'

// Define available route keys with friendly labels
const ROUTE_OPTIONS = [
  { key: 'admin.dashboard', label: 'Admin: Dashboard' },
  { key: 'admin.permissions', label: 'Admin: Permissions' },
  { key: 'admin.logs', label: 'Admin: Logs' },
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
  const [newPassword, setNewPassword] = useState('')
  // Profile fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [gender, setGender] = useState('')
  const [shiftStart, setShiftStart] = useState('')
  const [shiftEnd, setShiftEnd] = useState('')
  const [allowRoutes, setAllowRoutes] = useState([])
  const [denyRoutes, setDenyRoutes] = useState([]) // kept for backward compat, but hidden from UI
  const [notes, setNotes] = useState('')
  const [initial, setInitial] = useState({ allowRoutes: [], notes: '' })
  const [initialProfile, setInitialProfile] = useState({ role: '', firstName: '', lastName: '', birthdate: '', phone: '', email: '', gender: '', shiftStart: '', shiftEnd: '' })
  const [isNarrow, setIsNarrow] = useState(false)
  

  useEffect(() => {
    let mounted = true
    async function load(){
      setError(null)
      setLoading(true)
      try {
        // fetch permissions and profile in parallel
        const [permRes, profRes] = await Promise.all([
          axios.get(`${API_BASE}/api/permissions/${username}`),
          axios.get(`${API_BASE}/api/protect/users/${username}`)
        ])
        if(!mounted) return

        setRole(permRes.data?.role || profRes.data?.role || '')
        setAllowRoutes(permRes.data?.allowRoutes || [])
        setDenyRoutes(permRes.data?.denyRoutes || [])
        setNotes(permRes.data?.notes || '')
        setInitial({ allowRoutes: permRes.data?.allowRoutes || [], notes: permRes.data?.notes || '' })

        // profile fields
        const u = profRes.data || {}
        setFirstName(u.firstName || '')
        setLastName(u.lastName || '')
        setBirthdate(u.birthdate ? new Date(u.birthdate).toISOString().slice(0,10) : '')
        setPhone(u.phone || '')
        setEmail(u.email || '')
        setGender(u.gender || '')
        setShiftStart(u.shiftStart || '')
        setShiftEnd(u.shiftEnd || '')
        setInitialProfile({
          role: u.role || '',
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          birthdate: u.birthdate ? new Date(u.birthdate).toISOString().slice(0,10) : '',
          phone: u.phone || '',
          email: u.email || '',
          gender: u.gender || '',
          shiftStart: u.shiftStart || '',
          shiftEnd: u.shiftEnd || '',
        })
      } catch (e) {
        setError(e?.response?.data?.message || e.message)
      } finally {
        if(mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [username, API_BASE])

  // Responsive: track viewport width to tweak grid layouts
  useEffect(() => {
    function onResize(){
      setIsNarrow(window.innerWidth < 900)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const allowSet = useMemo(() => new Set(allowRoutes), [allowRoutes])
  const denySet = useMemo(() => new Set(denyRoutes), [denyRoutes])

  function sameSet(a = [], b = []){
    if (a.length !== b.length) return false
    const A = new Set(a)
    for (const x of b) if (!A.has(x)) return false
    return true
  }
  const isDirty = useMemo(() => {
    return !sameSet(allowRoutes, initial.allowRoutes) || notes !== (initial.notes || '')
  }, [allowRoutes, notes, initial])

  const profileDirty = useMemo(() => {
    const np = Boolean(newPassword && newPassword.trim().length > 0)
    const changed = (
      role !== initialProfile.role ||
      firstName !== initialProfile.firstName ||
      lastName !== initialProfile.lastName ||
      birthdate !== initialProfile.birthdate ||
      phone !== initialProfile.phone ||
      email !== initialProfile.email ||
      gender !== initialProfile.gender ||
      shiftStart !== initialProfile.shiftStart ||
      shiftEnd !== initialProfile.shiftEnd
    )
    return np || changed
  }, [role, firstName, lastName, birthdate, phone, email, gender, shiftStart, shiftEnd, newPassword, initialProfile])

  function toggleAllow(key){
    const has = allowRoutes.includes(key)
    const next = has ? allowRoutes.filter(k => k !== key) : [...allowRoutes, key]
    setAllowRoutes(next)
  }

  async function handleSave(){
    setSaving(true)
    setError(null)
    try {
      // Preserve denyRoutes as-is (UI doesn't edit it) to avoid unintended changes
      await axios.put(`${API_BASE}/api/permissions/${username}`,{ allowRoutes, denyRoutes, notes })
      alert('Saved permissions')
      // Update initial snapshot after save
      setInitial({ allowRoutes: [...allowRoutes], notes })
      navigate('/admin/permissions')
    } catch (e) {
      setError(e?.response?.data?.message || e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveProfile(){
    setSaving(true)
    setError(null)
    try {
      const payload = {}
      if (role) payload.role = role
      if (newPassword && newPassword.trim().length > 0) payload.password = newPassword.trim()
      payload.firstName = firstName
      payload.lastName = lastName
      payload.birthdate = birthdate || undefined
      payload.phone = phone
      payload.email = email
      payload.gender = gender || undefined
      payload.shiftStart = shiftStart
      payload.shiftEnd = shiftEnd
      await axios.put(`${API_BASE}/api/protect/users/${username}`, payload)
      alert('Profile updated')
      setNewPassword('')
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
      {/* Basic user profile settings */}
      <div style={{ border: '2px solid #0b1b2b', borderRadius: 8, padding: 12, marginBottom: 16, background: '#fff' }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>User profile</div>
        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }}>
              <option value="admin">admin</option>
              <option value="cashier">cashier</option>
              <option value="warehouse">warehouse</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>New password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Leave blank to keep" style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d0da', borderRadius: 6 }} />
          </div>
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
        <div style={{ marginTop: 12 }}>
          <button
            disabled={!profileDirty || saving}
            onClick={handleSaveProfile}
            style={{
              background: profileDirty && !saving ? '#0b1b2b' : '#c7d0da',
              color: '#fff', padding: '10px 16px', border: 'none', borderRadius: 8,
              cursor: profileDirty && !saving ? 'pointer' : 'not-allowed'
            }}
          >Save Profile</button>
        </div>
      </div>

      {/* Single-tab allow-only selector */}
      <div style={{ border: '2px solid #0b1b2b', borderRadius: 8, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Allowed pages</div>
        <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>ติ๊กถูกเพื่อให้เห็นเมนูและเข้าใช้งานหน้า/ข้อมูลของระบบ (ไม่ติ๊ก = ไม่เห็นและใช้งานไม่ได้)</div>
        <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: 8 }}>
          {ROUTE_OPTIONS.map(opt => (
            <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={allowSet.has(opt.key)}
                onChange={() => toggleAllow(opt.key)}
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
        <button
          disabled={!isDirty || saving}
          onClick={handleSave}
          style={{
            background: isDirty && !saving ? '#0b1b2b' : '#c7d0da',
            color: '#fff',
            padding: '10px 16px',
            border: 'none',
            borderRadius: 8,
            cursor: isDirty && !saving ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
