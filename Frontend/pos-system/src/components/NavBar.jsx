import React, { useEffect, useMemo, useState } from "react";
import axios from 'axios'
import { Link } from "react-router-dom";
import LogoutButton from "./LogoutButton";

// Left vertical NavBar with menu links.
export default function NavBar({ username, serverRole, showLinks = true, mode = 'admin', horizontal = false }) {
  const uname = username ?? localStorage.getItem("username") ?? "username account";
  const role = serverRole ?? localStorage.getItem("server_role") ?? "Role";
  const API_BASE = import.meta.env.VITE_API_URL || ''

  const [perm, setPerm] = useState({ allowRoutes: [], denyRoutes: [], role })
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const res = await axios.get(`${API_BASE}/api/permissions/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('api_token') || ''}`, 'Cache-Control': 'no-cache' },
          params: { t: Date.now() }
        })
        if (!mounted) return
        setPerm({
          role: res.data?.role,
          allowRoutes: res.data?.allowRoutes || [],
          denyRoutes: res.data?.denyRoutes || [],
        })
      } catch (e) {
        // silently ignore; fallback to role-only
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [API_BASE])

  // Periodically revalidate permissions to detect shift end and permission changes
  useEffect(() => {
    let mounted = true
    const id = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/permissions/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('api_token') || ''}`, 'Cache-Control': 'no-cache' },
          params: { t: Date.now() }
        })
        if (!mounted) return
        setPerm(p => ({
          role: res.data?.role ?? p.role,
          allowRoutes: res.data?.allowRoutes || p.allowRoutes || [],
          denyRoutes: res.data?.denyRoutes || p.denyRoutes || [],
        }))
      } catch (e) {
        // If 403 SHIFT_OUTSIDE occurs, axios interceptor will clear token and redirect
      }
    }, 60000) // every 60 seconds
    return () => { mounted = false; clearInterval(id) }
  }, [API_BASE])

  // live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const isAllowed = useMemo(() => {
    // Allow-only policy: only items listed in allowRoutes are visible
    const allow = new Set(perm.allowRoutes || [])
    return (key) => allow.has(key)
  }, [perm.allowRoutes])

  // small helper to render menu links with hover effect
  function MenuLink({ to, children }) {
    const [hover, setHover] = useState(false);
    return (
      <Link
        to={to}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          color: "#fff",
          textDecoration: "none",
          padding: "8px 10px",
          borderRadius: 6,
          display: "inline-block",
          transform: hover ? "translateX(6px)" : "none",
          transition: "transform 120ms ease, background 120ms ease",
          background: hover ? "rgba(255,255,255,0.06)" : "transparent",
        }}
      >
        {children}
      </Link>
    );
  }

  const asideStyle = horizontal ? {
    width: '100%',
    background: '#0f172a',
    color: '#fff',
    minHeight: 0,
    boxSizing: 'border-box',
    paddingTop: 8,
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 60,
    overflowX: 'hidden',
    overflowY: 'auto'
  } : {
    width: 220,
    background: '#0f172a',
    color: '#fff',
    minHeight: '100vh',
    boxSizing: 'border-box',
    paddingTop: 20,
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    zIndex: 60,
    overflowX: 'hidden',
    overflowY: 'auto'
  }

  return (
    <aside style={asideStyle}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16 }}>POS System</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{role}</div>
        <div style={{ marginTop: 6, fontSize: 12, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', width: 8, height: 8, borderRadius: 999, background: '#22c55e' }} />
          {now.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })}
          •
          {now.toLocaleTimeString(undefined, { hour12: false })}
        </div>
      </div>

      <div style={{ padding: 12 }}>
        <nav style={{ display: 'flex', flexDirection: horizontal ? 'row' : 'column', gap: 6, flexWrap: 'wrap' }}>
          {/* Render links based on mode: admin, sales, warehouse */}
          {mode === 'admin' && (
            <>
              {isAllowed('admin.dashboard') && <MenuLink to="/admin/dashboard">Dashboard</MenuLink>}
              {isAllowed('admin.permissions') && <MenuLink to="/admin/permissions">Permissions</MenuLink>}
              {isAllowed('admin.products') && <MenuLink to="/admin/products">Products</MenuLink>}
              {/* Single unified Logs view */}
              {isAllowed('admin.logs') && <MenuLink to="/admin/logs">Logs</MenuLink>}
            </>
          )}

          {mode === 'sales' && (
            <>
              {isAllowed('sales.home') && <MenuLink to="/sales">Sales Home</MenuLink>}
              {isAllowed('sales.cashier') && <MenuLink to="/sales/cashier">Cashier</MenuLink>}
              {isAllowed('sales.view') && <MenuLink to="/sales/history">Sales History</MenuLink>}
              {isAllowed('refunds.create') && <MenuLink to="/sales/refund">Refund</MenuLink>}
              {isAllowed('refunds.view') && <MenuLink to="/sales/refund/history">Refund History</MenuLink>}
              {isAllowed('sales.logs') && <MenuLink to="/sales/logs">Logs</MenuLink>}
            </>
          )}

          {mode === 'warehouse' && (
            <>
              {isAllowed('warehouse.home') && <MenuLink to="/warehouse">Warehouse Home</MenuLink>}
              {isAllowed('warehouse.products') && <MenuLink to="/warehouse/products">Products</MenuLink>}
              {isAllowed('warehouse.stockin') && <MenuLink to="/warehouse/stockin">Stock In</MenuLink>}
              {isAllowed('warehouse.stockout') && <MenuLink to="/warehouse/stockout">Stock Out</MenuLink>}
              {isAllowed('warehouse.stockaudit') && <MenuLink to="/warehouse/stockaudit">Stock Audit</MenuLink>}
              {isAllowed('warehouse.lowstock') && <MenuLink to="/warehouse/lowstock">Low Stock Alert</MenuLink>}
              {isAllowed('warehouse.reports') && <MenuLink to="/warehouse/reports">Reports</MenuLink>}
              {isAllowed('warehouse.logs') && <MenuLink to="/warehouse/logs">Logs</MenuLink>}
            </>
          )}
        </nav>
      </div>

      <div style={{
          marginTop: 'auto',
          padding: 12,
          borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          justifyContent: horizontal ? 'flex-start' : 'center'
        }}>
        <LogoutButton
          style={{
            backgroundColor: "#DC2626",
            color: "#ffffff",
            padding: "8px 12px",
          }}
        />
      </div>
    </aside>
  );
}
