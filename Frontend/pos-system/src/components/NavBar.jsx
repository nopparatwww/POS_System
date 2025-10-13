import React, { useState } from "react";
import { Link } from "react-router-dom";
import LogoutButton from "./LogoutButton";

// Left vertical NavBar with menu links.
export default function NavBar({ username, serverRole, showLinks = true, mode = 'admin' }) {
  const uname = username ?? localStorage.getItem("username") ?? "username account";
  const role = serverRole ?? localStorage.getItem("server_role") ?? "Role";

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

  return (
    <aside
      style={{
        width: 220,
        background: "#0f172a",
        color: "#fff",
        minHeight: "100vh",
        boxSizing: "border-box",
        paddingTop: 20,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 16 }}>POS System</div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>{role}</div>
      </div>

      <div style={{ padding: 12 }}>
        <button
          onClick={() => (window.location.href = "/role")}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 6,
            border: "none",
            background: "#111827",
            color: "#fff",
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          ← Back to Roles
        </button>
        <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Render links based on mode: admin, sales, warehouse */}
          {mode === 'admin' && (
            <>
              <MenuLink to="/admin/dashboard">Dashboard</MenuLink>
              <MenuLink to="/admin/permissions">Permissions</MenuLink>
            </>
          )}

          {mode === 'sales' && (
            <>
              <MenuLink to="/sales">Sales Home</MenuLink>
              {/* add sales-specific quick links here if needed */}
            </>
          )}

          {mode === 'warehouse' && (
            <>
              <MenuLink to="/warehouse">Warehouse Home</MenuLink>
              {/* add warehouse-specific quick links here if needed */}
            </>
          )}
        </nav>
      </div>

      <div
        style={{
          marginTop: "auto",
          padding: 12,
          borderTop: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          justifyContent: "center",
        }}
      >
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
