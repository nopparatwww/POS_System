import { useEffect, useState } from 'react'
import axios from 'axios'
import { Navigate, useLocation } from 'react-router-dom'
import { canAccessRoute, pathToKey } from '../utils/access'

const ROLE_HOME = {
  admin: '/admin/dashboard',
  cashier: '/sales',
  sales: '/sales',
  warehouse: '/warehouse',
  manager: '/warehouse',
  owner: '/admin/dashboard',
}

// eslint-disable-next-line react/prop-types
export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const token = localStorage.getItem('api_token')
  const routeKey = pathToKey(location.pathname)
  const API_BASE = import.meta.env.VITE_API_URL || ''
  const [access, setAccess] = useState({ path: '', status: 'checking' })

  // Hooks must run on every render, including after a denied request clears the token.
  useEffect(() => {
    if (!token || !routeKey) return
    let active = true
    setAccess({ path: location.pathname, status: 'checking' })

    axios.get(`${API_BASE}/api/permissions/me`, {
      headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
      params: { t: Date.now() },
    }).then(({ data }) => {
      if (!active) return
      setAccess({
        path: location.pathname,
        status: canAccessRoute(data || {}, routeKey) ? 'allowed' : 'denied',
      })
    }).catch(() => {
      if (active) setAccess({ path: location.pathname, status: 'error' })
    })

    return () => { active = false }
  }, [API_BASE, location.pathname, routeKey, token])

  if (!token) return <Navigate to="/" replace />
  // An unrecognized protected path must not be permitted by default.
  if (!routeKey) return <Navigate to="/" replace />
  if (access.path !== location.pathname || access.status === 'checking') {
    return <div style={{ padding: 16 }}>Checking access…</div>
  }
  if (access.status === 'error') return <Navigate to="/" replace />
  if (access.status === 'denied') {
    const fallback = ROLE_HOME[localStorage.getItem('server_role')] || '/'
    return <Navigate to={fallback === location.pathname ? '/' : fallback} replace />
  }
  return children
}
