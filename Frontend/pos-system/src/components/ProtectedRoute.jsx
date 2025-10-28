/*
  ProtectedRoute component

  Purpose:
  - Gate access to routes that require authentication.
  - Currently checks for an `api_token` in localStorage.

  Notes / Improvement ideas:
  - Storing tokens in localStorage is simple but has security trade-offs (XSS risk).
    For production, prefer HttpOnly secure cookies and server-side session verification
    (also provide a `/me` endpoint to verify session and fetch user info).
*/
import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Navigate, useLocation } from 'react-router-dom'

// Local mirror of backend mapping logic
const PATH_TO_KEY = [
  { path: /^\/admin\/dashboard$/, key: 'admin.dashboard' },
  { path: /^\/admin\/permissions(?:\/.*)?$/, key: 'admin.permissions' },
  { path: /^\/admin\/logs(?:\/.*)?$/, key: 'admin.logs' },
  { path: /^\/admin\/products(?:\/.*)?$/, key: 'admin.products' },
  { path: /^\/sales(?:\/.*)?$/, key: 'sales.home' },
  { path: /^\/warehouse(?:\/.*)?$/, key: 'warehouse.home' },
]

function pathToKey(pathname) {
  for (const m of PATH_TO_KEY) {
    if (m.path.test(pathname)) return m.key
  }
  return null
}

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('api_token')
  const location = useLocation()
  const API_BASE = import.meta.env.VITE_API_URL || ''
  const [allowed, setAllowed] = useState(null) // null=loading, true/false final
  const [error, setError] = useState(null)

  // If no token, redirect to login immediately
  if (!token) return <Navigate to="/" replace />

  const routeKey = useMemo(() => pathToKey(location.pathname), [location.pathname])

  useEffect(() => {
    let mounted = true
    async function check() {
      // For unmapped paths, allow by default
      if (!routeKey) {
        setAllowed(true)
        return
      }
      setError(null)
      setAllowed(null)
      try {
        const res = await axios.get(`${API_BASE}/api/permissions/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('api_token') || ''}`, 'Cache-Control': 'no-cache' },
          params: { t: Date.now() }
        })
  const me = res.data || {}
  // Fallback to persisted role if API returns empty (e.g., cached 304 without body)
  const role = me.role || localStorage.getItem('server_role') || ''
  const allowRoutes = Array.isArray(me.allowRoutes) ? me.allowRoutes : []
  const denyRoutes = Array.isArray(me.denyRoutes) ? me.denyRoutes : []

        const roleBaseline = {
          admin: ['admin.dashboard', 'admin.permissions', 'admin.logs', 'admin.products'],
          cashier: ['sales.home'],
          warehouse: ['warehouse.home'],
        }
        // New policy: baseline ∪ allowRoutes, with deny overriding
        const combined = new Set([...(roleBaseline[role] || []), ...allowRoutes])
        let can = combined.has(routeKey)
        if (denyRoutes.includes(routeKey)) can = false
        if (!mounted) return
        setAllowed(Boolean(can))
      } catch (e) {
        if (!mounted) return
        // On error (e.g., 401), push back to login
        setError(e?.response?.data?.message || e.message)
        setAllowed(false)
      }
    }
    check()
    return () => { mounted = false }
  }, [API_BASE, routeKey])

  if (allowed === null) {
    return <div style={{ padding: 16 }}>Checking access…</div>
  }
  if (!allowed) {
    // If unauthorized, send to a safe role-based home or login if error
    if (error) return <Navigate to="/" replace />
    const serverRole = localStorage.getItem('server_role') || ''
    const SERVER_TO_PATH = { admin: '/admin', cashier: '/sales', sales: '/sales', warehouse: '/warehouse', manager: '/warehouse', owner: '/admin' }
    const fallback = SERVER_TO_PATH[serverRole] || '/'
    // Prevent redirect loop if fallback equals current path
    if (fallback === location.pathname) return <Navigate to="/" replace />
    return <Navigate to={fallback} replace />
  }
  return children
}
