/*
  Login page

  Responsibilities:
  - Present a simple username/password form and call the backend `/api/auth/login`.
  - Persist an auth token (stored in localStorage as `api_token`) and a `server_role` value for display.
  - Map server-side roles to UI keys (used by `RoleSelect` to highlight and control visible cards).

  Important details:
  - The current implementation stores the JWT in `localStorage` which is easy but susceptible to XSS.
    For higher security, switch to HttpOnly cookies and server-side session validation.
  - The server may return the role inside different response shapes (res.data.role, res.data.user.role, etc.).
    This code tries several shapes and falls back to decoding the JWT payload if necessary.
  - After a successful login we save:
      localStorage.api_token    = token
      localStorage.server_role  = raw role string from server (for display)
      localStorage.role         = mapped UI key (e.g. 'admin'/'warehouse'/'sales') — used by RoleSelect

  Inputs:
  - username, password

  Outputs (side-effects):
  - localStorage updated, navigate to role-based home (e.g., /admin, /sales, /warehouse).

  Edge cases handled:
  - Missing token from API (throws an error)
  - Role not returned by the API — try decode; if still missing, clear `role` mapping to avoid mismatch.
*/
import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { setAuthToken } from "../utils/auth";
import { logger } from "../utils/logger";

// Embedded per-page CSS to avoid separate files and keep selectors namespaced
const loginStyles = `
.pg-login { display: flex; min-height: 100vh; align-items: center; }
.pg-login .left-hero { flex: 1 1 50%; background: linear-gradient(180deg,#34d399,#10b981); }
.pg-login .form-area { flex: 1 1 50%; padding: 3rem; }
.pg-login h1 { font-size: 2rem; margin-bottom: 0.5rem; }
.pg-login p.lead { color: #6b7280; margin-bottom: 1.25rem; }
.pg-login .input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 6px; }
.pg-login .btn-primary { background: #059669; color: white; padding: 0.5rem 1rem; border-radius: 6px; border: none; }
`;

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || "";

  useEffect(() => {
    function onResize() {
      setIsNarrow(window.innerWidth < 900);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!username || !password)
      return setError("Please enter username and password");
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, {
        username,
        password,
      });
      const token = res.data?.token || res.data?.accessToken || null;
      if (!token) throw new Error("No token returned");

      // store token
      localStorage.setItem("api_token", token);
      // set axios default Authorization header for the running session
      setAuthToken(token);

      // decode JWT payload (try once) to use as fallback for role/username
      let payload = null;
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          payload = JSON.parse(
            decodeURIComponent(
              escape(
                window.atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
              )
            )
          );
        }
      } catch (decodeErr) {
        // silent - payload may not be parseable
      }

      // read server role (various possible shapes). Prefer explicit response fields, then payload.
      let serverRole =
        res.data?.role ||
        res.data?.user?.role ||
        res.data?.data?.role ||
        payload?.role ||
        payload?.user?.role ||
        "";
      if (serverRole) {
        // persist raw server role for display
        localStorage.setItem("server_role", serverRole);
        // Map common backend role names to UI keys (used to highlight cards)
        const SERVER_TO_UI = {
          cashier: "sales",
          sales: "sales",
          admin: "admin",
          user: "admin",
          manager: "warehouse",
          owner: "warehouse",
        };
        const mapped = SERVER_TO_UI[serverRole];
        if (mapped) {
          localStorage.setItem("role", mapped);
        } else {
          // if no mapping, clear to avoid mismatch
          localStorage.removeItem("role");
        }
      }

      // Persist username for NavBar: prefer response->user, then payload, then the input username
      const usernameFromResp =
        res.data?.user?.username ||
        res.data?.username ||
        res.data?.data?.user?.username ||
        payload?.username ||
        username ||
        "";
      if (usernameFromResp) localStorage.setItem("username", usernameFromResp);

      // Login response received (sensitive data suppressed from console)

      // Redirect directly to role-based landing page
      const SERVER_TO_PATH = {
        admin: "/admin",
        cashier: "/sales",
        sales: "/sales",
        warehouse: "/warehouse",
        manager: "/warehouse",
        owner: "/admin",
      };
      const goTo = SERVER_TO_PATH[serverRole] || "/admin";
      navigate(goTo);
    } catch (err) {
      logger.error(err);
      if (err?.response)
        setError(err.response?.data?.message || "Server error");
      else if (err?.request) setError("No response from server");
      else setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "stretch",
        flexDirection: isNarrow ? "column" : "row",
      }}
    >
      {!isNarrow && (
        <div
          style={{
            flex: "1 1 50%",
            background: "linear-gradient(180deg,#34d399,#10b981)",
          }}
        />
      )}
      <div style={{ flex: "1 1 50%", padding: isNarrow ? "1.5rem" : "3rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Login</h1>
        <p style={{ color: "#6b7280", marginBottom: "1.25rem" }}>
          Login to access your account
        </p>

        <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
          <div style={{ marginBottom: 16 }}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
              }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 16, color: "#dc2626" }}>{error}</div>
          )}

          <div style={{ marginBottom: 16, textAlign: "center" }}>
            <button
              disabled={loading}
              style={{
                background: "#059669",
                color: "#fff",
                padding: "0.5rem 1rem",
                borderRadius: 6,
                border: "none",
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
