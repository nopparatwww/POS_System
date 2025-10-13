import React from 'react'
import UserBadge from './UserBadge'
import { useNavigate } from 'react-router-dom'

const ROLE_OPTIONS = [
  { key: 'sales', label: 'Cashier', to: '/sales' },
  { key: 'admin', label: 'Admin', to: '/admin/dashboard' },
  { key: 'warehouse', label: 'Warehouse', to: '/warehouse' }
]

export default function TopBar(){
  const navigate = useNavigate()
  const current = localStorage.getItem('role') || ''

  function handleChange(e){
    const val = e.target.value
    localStorage.setItem('role', val)
    // navigate to the role's entry point
    const opt = ROLE_OPTIONS.find(o => o.key === val)
    if(opt?.to) navigate(opt.to)
  }

  return (
       <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', boxSizing: 'border-box', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#fff' }}>
         {/* left spacer to keep content centered/aligned with page */}
         <div style={{ width: 1 }} />

         {/* right group: role selector immediately left of the user badge */}
         <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
           <label style={{ fontSize: 13, color: '#111827', marginRight: 6 }}>Role:</label>
           <select value={current} onChange={handleChange} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb' }}>
             <option value="">-- select role --</option>
             {ROLE_OPTIONS.map(r => (
               <option key={r.key} value={r.key}>{r.label}</option>
             ))}
           </select>
           <UserBadge inline />
         </div>
    </div>
  )
}
