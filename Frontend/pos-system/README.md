# POS System Frontend (pos-system)

This is a Vite + React frontend scaffold for the POS System.

Environment:

- Copy `.env.example` to `.env` and set `VITE_API_URL` to your backend URL (e.g., `http://localhost:3000`).

Install & run:

1. npm install
2. npm run dev

Notes:
- Login page at root uses `POST ${VITE_API_URL}/api/auth/login` and stores token in `localStorage` as `api_token`.
- Uses Tailwind CSS and Bootstrap for styling.

Development proxy
- The dev server proxies requests from `/api/*` to `http://localhost:3000` (configured in `vite.config.js`). This means during development you can POST to `/api/auth/login` and Vite will forward it to your backend.

After editing `vite.config.js` restart the dev server:

```cmd
npm run dev
```

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh
