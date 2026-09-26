import { useEffect, useState } from 'react'
import axios from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import UserBadge from './UserBadge'
import { availableRoleOptions } from '../utils/access'

const ROLE_LABELS = { sales: 'Cashier', admin: 'Admin', warehouse: 'Warehouse' }

export default function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const serverRole = localStorage.getItem('server_role') || ''
  const current = location.pathname.startsWith('/admin') ? 'admin'
    : location.pathname.startsWith('/warehouse') ? 'warehouse' : 'sales'
  const [options, setOptions] = useState([])
  const selected = options.some(({ key }) => key === current) ? current : options[0]?.key

  useEffect(() => {
    const token = localStorage.getItem('api_token')
    if (!token) return
    let active = true
    const API_BASE = import.meta.env.VITE_API_URL || ''

    axios.get(`${API_BASE}/api/permissions/me`, {
      headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
      params: { t: Date.now() },
    }).then(({ data }) => {
      if (active) setOptions(availableRoleOptions(data || {}, data?.role || serverRole))
    }).catch(() => {
      // Keep the current role label, but do not offer unverified destinations.
      if (active) setOptions([])
    })

    return () => { active = false }
  }, [serverRole])

  function handleChange(event) {
    const option = options.find(({ key }) => key === event.target.value)
    if (option) navigate(option.to)
  }

  return (
    <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', boxSizing: 'border-box', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#fff' }}>
      <div style={{ width: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: '#111827' }}>Role:</span>
        {options.length > 1 ? (
          <select aria-label="Role" value={selected} onChange={handleChange} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            {options.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
          </select>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{ROLE_LABELS[current] || serverRole}</span>
        )}
        <UserBadge inline />
      </div>
    </div>
  )
}
