Frontend README (short)
=======================

Overview
--------
This is the small React frontend for the POS_System project. It is a Vite + React app.

Key pages
- `/`        : Login
- `/role`    : RoleSelect (choose UI entry)
- `/sales`   : Sales dashboard (placeholder)
- `/warehouse`: Warehouse/settings (placeholder)
- `/admin`   : Admin dashboard (placeholder)
- `/admin/roles`: Admin role-permissions editor (stored in localStorage)

Important localStorage keys
- `api_token`       : JWT token stored after login (consider moving to HttpOnly cookie)
- `server_role`     : raw role string returned by backend (used for display)
- `role`            : UI key used to highlight cards in RoleSelect
- `role_permissions`: optional JSON to override UI card visibility per server role

Security notes
- Avoid storing sensitive tokens in localStorage for production. Use HttpOnly cookies and server-side verification.

Dev
- Run `npm install` (if you haven't) then `npm run dev` inside the `pos-system` folder to start Vite.
