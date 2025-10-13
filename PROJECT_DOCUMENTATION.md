POS System — Project Documentation

Overview
--------
This repository contains a simple Point of Sale (POS) application split into Backend and Frontend directories.

- Backend — Express + MongoDB (Mongoose). Handles user signup/login and protected endpoints using JWTs.
- Frontend — React (Vite) single-page application. Handles login, role selection, and admin pages. Uses localStorage for short-term client-side state (token, username, server_role, role, role_permissions).

This document summarizes project architecture, key files, auth flow, role/permission model, and shows code excerpts to make the structure and behavior easy to understand.

Table of contents
- Quick start
- Backend
  - Architecture
  - Key files and responsibilities
  - Auth (signup/login) flow and code excerpts
  - User model and password handling
- Frontend
  - Architecture
  - Key files and responsibilities
  - Routing and protected routes
  - RoleSelect and permission model
  - Admin area & permissions editor
  - UX / layout decisions (NavBar, Logout)
- Running the project
- Next recommended improvements

Quick start
-----------
Backend
1. create a .env file with MONGO_URI and JWT_SECRET (and optional BCRYPT_ROUNDS, PASSWORD_PEPPER)
2. cd Backend
3. npm install
4. npm start (or node server.js)

Frontend
1. cd Frontend/pos-system
2. npm install
3. npm run dev (Vite)

Backend
-------
Architecture
- Express application with route groups mounted under /api/auth, /api/public, /api/protect
- MongoDB for persistence using Mongoose models
- Passwords hashed with bcrypt, optional application-level pepper
- JWT used for authentication; token returned on login and consumed by the frontend

Key files
- server.js — app bootstrap, route mounting, CORS, JSON body parsing
- config/db.js — mongoose connection
- models/user.js — Mongoose user schema with password hashing and verification methods
- routes/apiAuthRoutes.js — signup and login handlers that produce JWTs
- routes/apiProtectRoutes.js — example protected route (requires JWT middleware)
- routes/apiPublicRoutes.js — example public route

server.js (excerpt)
```js
// server.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();
require("./config/db");

app.use(bodyParser.json());
app.use(cors());

app.get("/", (req, res) => res.send("JWT API is running"));
app.use("/api/auth", apiAuthRoutes);
app.use("/api/public", apiPublicRoutes);
app.use("/api/protect", apiProtectRoutes);

app.listen(PORT);
```

User model and password handling
- `models/user.js` defines username, passwordHash, hashAlgo, role and timestamps.
- `setPassword(plain)` hashes with bcrypt (and optional PEPPER) and stores result in passwordHash.
- `comparePassword(candidate)` compares candidate password (plus PEPPER) against the stored hash.

Example (excerpt)
```js
userSchema.methods.setPassword = async function (plain) {
  const toHash = PEPPER ? PEPPER + plain : plain;
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  this.passwordHash = await bcrypt.hash(toHash, salt);
  this.hashAlgo = "bcrypt";
};

userSchema.methods.comparePassword = async function (candidatePassword) {
  const toCompare = PEPPER ? PEPPER + candidatePassword : candidatePassword;
  return bcrypt.compare(toCompare, this.passwordHash);
};
```

Auth routes
- `POST /api/auth/signup` — creates a user, calls setPassword then saves user.
- `POST /api/auth/login` — verifies credentials and returns a JWT (and the role/user for convenience).

Login handler (excerpt)
```js
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ message: "Invalid username or password" });
  const match = await user.comparePassword(password);
  if (!match) return res.status(401).json({ message: "Invalid username or password" });

  const payload = { userId: user._id, role: user.role, username: user.username };
  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: process.env.JWT_EXPIRES_IN || "1h" });
  res.json({ token, role: user.role, user: { username: user.username, role: user.role } });
});
```

Frontend
--------
Architecture
- Vite + React application in `Frontend/pos-system`.
- React Router v6 for client-side routing.
- axios used for API calls.
- Auth state stored in `localStorage` keys: `api_token` (JWT), `server_role` (backend role string), `role` (UI key mapping), `username`, `role_permissions` (admin-editable mapping saved locally).
- Components and pages are in `src/components` and `src/pages` respectively.

Key files
- `src/main.jsx` — app entry mount
- `src/App.jsx` — router config and routes
- `src/components/ProtectedRoute.jsx` — wrapper that checks `localStorage.api_token`
- `src/components/NavBar.jsx` — left sidebar menu (customizable)
- `src/components/LogoutButton.jsx` — logout action and UX
- `src/pages/Login.jsx` — login form and token storage logic
- `src/pages/RoleSelect.jsx` — role selection cards and mapping logic
- `src/pages/admin/AdminLayout.jsx` — admin layout, centers child pages and shows user badge
- `src/pages/admin/Permissions.jsx` — admin JSON editor for `role_permissions`

Routing and protection
- `App.jsx` defines routes:
  - `/` -> Login (public)
  - `/role` -> RoleSelect (protected)
  - `/warehouse`, `/sales` -> protected pages
  - `/admin` -> AdminLayout (protected), nested children: index -> Dashboard, `/admin/permissions` -> Permissions
- `ProtectedRoute` is a minimal wrapper that checks `localStorage.api_token` and redirects to `/` if missing.

ProtectedRoute (excerpt)
```jsx
export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('api_token')
  if (!token) return <Navigate to="/" replace />
  return children
}
```

Login flow (frontend)
- `Login.jsx` posts credentials to `/api/auth/login`.
- If token received, it
  - saves token to `localStorage.api_token` and calls `setAuthToken(token)` to add axios default Authorization header
  - saves `server_role` to localStorage and maps server role to `role` (UI key) for RoleSelect
  - persists `username` to `localStorage.username` for display in the NavBar
  - navigates to `/role`

Login snippet (excerpt)
```jsx
const res = await axios.post(`${API_BASE}/api/auth/login`, { username, password })
const token = res.data?.token
localStorage.setItem('api_token', token)
setAuthToken(token)
localStorage.setItem('server_role', serverRole)
localStorage.setItem('username', usernameFromResp)
navigate('/role')
```

RoleSelect & permissions
- `RoleSelect.jsx` shows cards for available UI entry points: 'sales', 'admin', 'warehouse'.
- The visible cards are determined by `role_permissions` (localStorage) or a built-in `DEFAULT_ROLE_PERMISSIONS` mapping.
- Admin can edit `role_permissions` via `Admin -> Permissions` page. The Permissions page stores the JSON string in localStorage.

Permissions format (example)
```json
{
  "admin": ["admin","warehouse","sales"],
  "sales": ["sales"],
  "manager": ["warehouse","sales"]
}
```

Admin area
- `AdminLayout.jsx` places a left sidebar (`NavBar`) and centers the main content with a max width. It also renders a top-right user badge using `localStorage.username` and `localStorage.server_role`.
- `Permissions.jsx` is a simple textarea + Save button to edit `role_permissions` (client-only persistence).

NavBar and Logout UX
- `NavBar.jsx` is a left vertical sidebar. Current customized behavior:
  - Shows only Dashboard and Permissions links (project request)
  - Has a Back button that navigates to `/role`
  - Logout button centered at bottom
  - Menu items have small hover animation (translate + background)
- `LogoutButton.jsx` clears local storage (and calls `/api/auth/logout` if present), removes axios Authorization header, and navigates to `/`.

Code snippets (selected)
- NavBar menu link with hover:
```jsx
function MenuLink({ to, children }) {
  const [hover, setHover] = useState(false)
  return (
    <Link to={to} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ transform: hover ? 'translateX(6px)' : 'none', background: hover ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
      {children}
    </Link>
  )
}
```

- Permissions editor (saving to localStorage):
```jsx
function handleSave(){
  try{
    const parsed = JSON.parse(jsonText)
    localStorage.setItem('role_permissions', JSON.stringify(parsed))
    setSaved(true)
  } catch(e){ alert('Invalid JSON') }
}
```

How auth state is used on the client
- `localStorage.api_token` — presence means the user is considered "authenticated" by `ProtectedRoute` (basic check)
- `localStorage.server_role` — raw role string returned by backend (e.g., 'admin') used for display and for permission lookups
- `localStorage.role` — a UI role key mapped from server role (e.g., 'admin' -> 'admin') used by RoleSelect for highlighting and default selection
- `localStorage.username` — used to display the user's name in NavBar and the admin badge
- `localStorage.role_permissions` — admin-configurable mapping between server roles and UI keys

Running the project
- Backend: set environment variables then run node server.js. Ensure MongoDB is accessible via MONGO_URI.
- Frontend: `npm install` then `npm run dev` in `Frontend/pos-system`.

Security notes & recommendations
- Storing JWT in localStorage is convenient but vulnerable to XSS. For production move to HttpOnly secure cookies and a `/me` endpoint to validate session.
- Consider server-side storage for role_permissions and an admin API rather than localStorage.
- Hardening: rate limit login, require strong BCRYPT_ROUNDS, store a pepper securely (KMS), enable HTTPS, and validate inputs thoroughly.

Next recommended improvements
- Implement server-side API for permissions and persist in DB
- Use HttpOnly cookies for auth and create `/api/auth/me` to return current user profile
- Improve ProtectedRoute to refresh/validate token periodically and handle token expiry gracefully
- Add unit/integration tests for backend endpoints and frontend components

---

If you'd like, I can also:
- generate a README.md from this content (with run steps and environment variable examples)
- create API docs (OpenAPI/Swagger) for the backend routes
- implement server-side permissions persistence and an admin endpoint to update them

Tell me which of the extras you want and I'll add them next.