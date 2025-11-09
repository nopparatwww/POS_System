import React, { useEffect, useState } from 'react'
import NavBar from '../../components/NavBar'
import UserBadge from '../../components/UserBadge'
import TopBar from '../../components/TopBar'
import { Outlet } from 'react-router-dom'

export default function AdminLayout(){
  const username = localStorage.getItem('username') || 'User'
  const serverRole = localStorage.getItem('server_role') || ''
  const [isNarrow, setIsNarrow] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    function onResize(){ setIsNarrow(window.innerWidth < 900) }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    // NavBar is now fixed-positioned. We offset the main content by the
    // sidebar width when the viewport is wide so the TopBar and page content
    // are not covered.
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Left sidebar (collapsible on small screens) */}
      {!isNarrow && <NavBar />}

      {/* Main content area - add left margin to compensate for fixed NavBar */}
      <main style={{ background: '#f7fbfa', minHeight: '100vh', padding: 0, boxSizing: 'border-box', position: 'relative', display: 'flex', flexDirection: 'column', marginLeft: isNarrow ? 0 : 220 }}>
        {/* Top bar with hamburger on narrow screens */}
        <div style={{ position: 'relative' }}>
          <div style={{ width: '100%', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', boxSizing: 'border-box', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#fff' }}>
            {isNarrow ? (
              <button onClick={() => setMenuOpen(v => !v)} aria-label="Menu" style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>
                ☰
              </button>
            ) : (
              <div style={{ width: 1 }} />
            )}
            <div style={{ marginLeft: 'auto' }}>
              <TopBar />
            </div>
          </div>
          {/* Mobile overlay menu */}
          {isNarrow && menuOpen && (
            <div style={{ position: 'absolute', top: 64, left: 0, right: 0, zIndex: 30, background: '#0f172a' }}>
              <NavBar horizontal />
            </div>
          )}
        </div>
  {/* TopBar provides the inline user badge */}

        {/* Child content (full width) */}
        <div style={{ width: '100%', maxWidth: 'none', margin: 0, paddingTop: 24 }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
