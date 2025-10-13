import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { logout } from '../utils/auth'

export default function LogoutButton({ className, style }) {
  const navigate = useNavigate()
  const [hover, setHover] = useState(false)

  async function handleLogout() {
    const ok = window.confirm('Are you sure you want to logout?')
    if (!ok) return
    await logout()
    // navigate to login page and replace history so Back can't reuse previous pages
    navigate('/', { replace: true })
  }

  // default inline style to ensure color/shape even if CSS classes conflict
  const defaultStyle = {
    backgroundColor: '#DC2626',
    color: '#ffffff',
    padding: '8px 14px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 700,
    transition: 'transform 120ms ease, filter 120ms ease',
  }

  const hoverStyle = hover
    ? { transform: 'translateY(-2px)', filter: 'brightness(1.05)' }
    : { transform: 'none' }

  const mergedStyle = { ...defaultStyle, ...(style || {}), ...hoverStyle }

  return (
    <button
      onClick={handleLogout}
      className={className}
      style={mergedStyle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      Logout
    </button>
  )
}
