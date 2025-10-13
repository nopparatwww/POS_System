/*
  Admin page (placeholder)

  Purpose:
  - Entry point for admin users. Use this page for admin dashboards and links.
*/
import React from 'react'
import NavBar from '../components/NavBar'

const adminStyles = `
.pg-admin { display:flex; min-height:100vh; box-sizing:border-box; }
.pg-admin .main-area { flex:1; background:#f6fbf9; padding:1.5rem; }
.pg-admin .title { font-size:1.5rem; margin-bottom:1rem }
`

export default function Admin() {
  return (
    <div className="pg-admin">
      <style>{adminStyles}</style>
      <NavBar />
    </div>
  )
}
