/*
  RoleSelect page

  Purpose:
  - Show available UI entry points (cards) to the user based on their server role.
  - Allow an authenticated user to select a role (UI key) and navigate to the corresponding page.

  Important data keys (localStorage):
  - `api_token`      : JWT token (present if logged-in)
  - `server_role`    : raw role string returned from backend (e.g. 'admin', 'cashier')
  - `role`           : UI key used to highlight/remember a selection (e.g. 'admin','warehouse','sales')
  - `role_permissions`: optional admin-editable JSON mapping stored in localStorage for testing

  Behavior:
  - DEFAULT_ROLE_PERMISSIONS provides defaults for which UI cards each server role sees.
  - Admin can override `role_permissions` in localStorage (temporary local admin UI).
*/
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LogoutButton from "../components/LogoutButton";
import TopBar from "../components/TopBar";

const rolesStyles = `
.pg-roles { background: #f0fdf4; min-height: 100vh; padding: clamp(1rem, 4vw, 2rem); box-sizing: border-box; }
.pg-roles .header-row { width: 100%; max-width: 1100px; margin: 0 auto 1rem; display:flex; justify-content:space-between; align-items:center; gap: 12px; flex-wrap: wrap; }
.pg-roles h1.role-title { font-size: clamp(28px, 5vw, 56px); font-weight: 300; color:#0f172a; margin:24px 0 24px; }
.pg-roles .cards-row { max-width:1100px; margin:0 auto; display:flex; gap:24px; justify-content:center; flex-wrap:wrap; }
.pg-roles .card-wrap { display:flex; flex-direction:column; align-items:center; }
.pg-roles .card { width: clamp(180px, 28vw, 240px); height: clamp(180px, 28vw, 240px); min-width:160px; min-height:160px; border-radius:16px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition: transform 150ms ease; box-shadow: 0 8px 20px rgba(0,0,0,0.08); }
.pg-roles .card-label { margin-top:12px; font-size:18px; color:#0f172a; }
.pg-roles .card.selected { transform: scale(1.05); background-color: #059669; }
.pg-roles .card:not(.selected) { background-color: #34d399; }
`

const ROLE_CONFIG = [
  {
    key: "sales",
    label: "Cashier",
    to: "/sales",
    svg: (
      <svg
        width="120"
        height="120"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        style={{ color: "#ffffff" }}
      >
        <path d="M3 3h2l1 5h11l2-4h-16z" />
      </svg>
    ),
  },
  {
    key: "admin",
    label: "Admin",
    to: "/admin",
    svg: (
      <svg
        width="120"
        height="120"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        style={{ color: "#ffffff" }}
      >
        <circle cx="12" cy="8" r="3" />
        <path d="M6 20c0-3 3-5 6-5s6 2 6 5" />
      </svg>
    ),
  },
  {
    key: "warehouse",
    label: "Warehouse",
    to: "/warehouse",
    svg: (
      <svg
        width="120"
        height="120"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        style={{ color: "#ffffff" }}
      >
        <path d="M3 11l9-7 9 7" />
        <path d="M21 22H3v-9h18z" />
      </svg>
    ),
  },
];

// Default UI permissions mapping (can be overridden by admin via localStorage 'role_permissions')
const DEFAULT_ROLE_PERMISSIONS = {
  cashier: ["sales"],
  sales: ["sales"],
  admin: ["admin", "warehouse", "sales"],
  user: ["admin"],
  manager: ["warehouse", "sales"],
  owner: ["admin", "warehouse", "sales"],
};

export default function RoleSelect() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(
    () => localStorage.getItem("role") || ""
  );
  const [serverRole, setServerRole] = useState(
    () => localStorage.getItem("server_role") || ""
  );
  const [permissions, setPermissions] = useState(DEFAULT_ROLE_PERMISSIONS);

  useEffect(() => {
    if (selected) localStorage.setItem("role", selected);
  }, [selected]);

  // keep server role in sync with localStorage
  useEffect(() => {
    const s = localStorage.getItem("server_role") || "";
    setServerRole(s);
    // load admin-overridden permissions from localStorage if present
    try {
      const raw = localStorage.getItem("role_permissions");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") setPermissions(parsed);
      }
    } catch (e) {
      console.warn("Invalid role_permissions in localStorage", e);
    }
  }, []);

  function handleSelect(roleKey, to) {
    setSelected(roleKey);
    // small delay to allow highlight feedback; navigate immediately is also fine
    setTimeout(() => navigate(to), 120);
  }

  return (
    <div className="pg-roles">
      <style>{rolesStyles}</style>
      <TopBar />
      <div className="header-row">
        <h1 className="role-title">Role : {(() => {
          if (serverRole) {
            const MAP = {
              cashier: "Cashier",
              admin: "Admin",
              manager: "Manager",
              owner: "Owner",
              warehouse: "Warehouse",
            };
            return MAP[serverRole] || serverRole;
          }
          return selected || "---";
        })()}</h1>
        <div style={{ marginLeft: 12 }}>
          <LogoutButton style={{ backgroundColor: '#DC2626', color: '#ffffff', padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700 }} />
        </div>
      </div>
      <div className="cards-row">
        {(() => {
          // decide which cards to show based on serverRole
          const map = permissions || DEFAULT_ROLE_PERMISSIONS;
          // if serverRole exists but no mapping, fall back to showing ALL cards instead of nothing
          const allowed = serverRole
            ? map[serverRole] ?? ROLE_CONFIG.map((c) => c.key)
            : ROLE_CONFIG.map((c) => c.key);
          const visible = ROLE_CONFIG.filter((c) => allowed.includes(c.key));
          // if still empty (shouldn't happen), show a helpful message and link to Admin
          if (!visible.length) {
            return (
              <div className="w-full text-center py-16">
                <p className="mb-4">
                  You don't have any configured role permissions yet.
                </p>
                <button
                  className="bg-emerald-400 text-white px-4 py-2 rounded"
                  onClick={() => navigate("/admin/roles")}
                >
                  Go to Admin Roles
                </button>
              </div>
            );
          }

          return visible.map((r) => {
            const isSelected = selected === r.key;
            const cardInlineStyle = {
              width: 240,
              minWidth: 200,
              height: 240,
              minHeight: 200,
              borderRadius: 16,
              boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "transform 150ms ease",
              transform: isSelected ? "scale(1.05)" : "none",
              backgroundColor: isSelected ? "#059669" : "#34d399",
            };

            const labelStyle = {
              marginTop: 16,
              fontSize: 20,
              color: "#0f172a",
            };

            // ensure svg strokes are visible by wrapping in a container that sets color
            const svgWrapperStyle = { color: "#ffffff" };

            return (
              <div key={r.key} className="card-wrap">
                <div
                  onClick={() => handleSelect(r.key, r.to)}
                  className={`card ${isSelected ? 'selected' : ''}`}
                  title={r.label}
                  style={{}}
                >
                  <div style={svgWrapperStyle}>{r.svg}</div>
                </div>
                <div className="card-label">{r.label}</div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  )
}
