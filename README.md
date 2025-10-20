# POS System

A simple POS-style full-stack app with authentication, role-based access, and fine-grained per-user permissions.

## Overview

Tech stack:
- Backend: Node.js, Express, MongoDB (Mongoose), JWT
- Frontend: React (Vite), React Router, Axios, Tailwind (optional)

Key features:
- Login with JWT
- Role-based landing (admin, sales/cashier, warehouse)
- Per-user permissions with allow-only model (+ deny override)
- Admin pages to list users, edit permissions, create users
- Protected API and route-guard aligned with the same permission logic

## Project Structure

Backend/
- server.js — Express app, routes mounted
- routes/
	- apiAuthRoutes.js — /api/auth (signup, login)
	- apiPublicRoutes.js — /api/public (no auth required)
	- apiProtectRoutes.js — /api/protect (admin user list, user get/update)
	- apiPermissionRoutes.js — /api/permissions (me, get/put by username, check)
- middleware/
	- authMiddleware.js — JWT auth
	- ensureAdmin.js — require admin role
	- ensurePermission.js — require a permission key
- models/
	- user.js — user with username/passwordHash/role
	- permission.js — per-user allow/deny/notes
- config/db.js — Mongo connection

Frontend/
- src/App.jsx — routes and protected pages
- src/components/ — NavBar, TopBar, ProtectedRoute, etc.
- src/pages/ — Login, Sales, Warehouse, Admin pages

## Getting Started

Prerequisites:
- Node.js 18+
- MongoDB running (local or remote)

Environment variables (Backend):
- JWT_SECRET (required)
- JWT_EXPIRES_IN (default 1h)
- BCRYPT_ROUNDS (default 12)
- PASSWORD_PEPPER (optional)
- MONGODB_URI (your Mongo connection string; set in Backend/config/db.js or .env)

### Quick Start (Windows cmd.exe)

1) Clone and open the workspace

```cmd
git clone <your-fork-or-repo-url>
cd POS_System
```

2) Backend setup

```cmd
cd Backend
npm install
copy .env.example .env
:: edit .env to set MONGODB_URI and JWT_SECRET
node server.js
```

Backend will start at http://localhost:3000

3) Frontend setup (new terminal)

```cmd
cd Frontend\pos-system
npm install
:: create .env (optional if you use Vite proxy):
:: echo VITE_API_URL=http://localhost:3000 > .env
npm run dev
```

Frontend will start at http://localhost:5173

Login using a user you created via API or create one (see API below).

### Install dependencies (manual)

Backend:
- cd Backend
- npm install

Frontend:
- cd Frontend/pos-system
- npm install

### Run

Backend:
- cd Backend
- npm start (or node server.js)

Frontend:
- cd Frontend/pos-system
- npm run dev

Default dev URLs:
- Backend: http://localhost:3000
- Frontend: http://localhost:5173

Set VITE_API_URL in Frontend/.env (e.g., VITE_API_URL=http://localhost:3000)

## Authentication & Authorization

- Auth: JWT issued by POST /api/auth/login. Frontend stores token in localStorage as api_token and sets Authorization: Bearer <token> in axios.
- Roles: admin, cashier(sales), warehouse.
- Permissions model (keys): admin.dashboard, admin.permissions, sales.home, warehouse.home.
- Allow-only rule: If a user’s permission doc has allowRoutes (length > 0), only those keys are allowed. If no allowRoutes, fallback to role baseline. denyRoutes always override to block.

Role baselines:
- admin: [admin.dashboard, admin.permissions]
- cashier: [sales.home]
- warehouse: [warehouse.home]

ProtectedRoute and NavBar use GET /api/permissions/me to enforce visibility and access.

## API Reference

Base URL: http://localhost:3000

### Auth

POST /api/auth/signup
- Body: { username: string, password: string, role?: 'admin'|'warehouse'|'cashier' }
- Response: 201 { message: 'User created' }

POST /api/auth/login
- Body: { username: string, password: string }
- Response: 200 { token: string, role: string, user: { username, role } }

### Public

GET /api/public/info
- Response: 200 { message }

### Protected Examples

GET /api/protect/dashboard
- Auth: Bearer token
- Response: 200 { message, user }

### Admin: Users

GET /api/protect/users
- Auth: Bearer token (admin only)
- Query: page?: number, limit?: number (default 10), query?: string (username contains)
- Response: { page, limit, total, items: [{ username, role, createdAt, updatedAt }] }

GET /api/protect/users/:username
- Auth: Bearer token (admin only)
- Response: { username, role, createdAt, updatedAt }

PUT /api/protect/users/:username
- Auth: Bearer token (admin only)
- Body: { role?: 'admin'|'warehouse'|'cashier', password?: string }
- Response: { username, role, updatedAt }

### Permissions

GET /api/permissions/me
- Auth: Bearer token
- Response: { username, role, allowRoutes: string[], denyRoutes: string[] }
- Behavior: returns allowRoutes if set, otherwise role baseline; denyRoutes present but only used to override.

GET /api/permissions/:username
- Auth: Bearer token (admin + permission 'admin.permissions')
- Response: { username, role, allowRoutes, denyRoutes, updatedAt?, updatedBy? }

PUT /api/permissions/:username
- Auth: Bearer token (admin + permission 'admin.permissions')
- Body: { allowRoutes?: string[], denyRoutes?: string[], notes?: string }
- Response: { username, allowRoutes, denyRoutes, notes, updatedBy, updatedAt }

POST /api/permissions/check
- Auth: Bearer token
- Body: { path: string }
- Response: { allowed: boolean, key: string, role: string, allowRoutes: string[], denyRoutes: string[] }

### Permission Keys
- admin.dashboard — access Admin Dashboard
- admin.permissions — access Admin Permissions pages and APIs
- sales.home — access Sales area
- warehouse.home — access Warehouse area

## Frontend Notes

- Login sets api_token, server_role, and optionally role (UI key). App now redirects directly to a role-based landing (no RoleSelect screen).
- Admin pages:
	- Permissions list: search, paginate; edit opens per-user permission editor
	- UserPermission editor: allow-only checklist, notes; profile section to change user role/password
	- CreateUser: create user and set permissions immediately with role defaults

## Security Notes
- For production, prefer HttpOnly secure cookies over localStorage for tokens.
- Restrict CORS origins in production.
- Validate all inputs server-side.

## Development Tips
- PATH_TO_KEY must match frontend and backend if new pages are added.
- Extend role baselines when new areas are introduced.
- Use ensurePermission('some.key') middleware to protect sensitive admin APIs.

## License
MIT (see repository)