/*
  Entry point for the frontend application.

  Purpose:
  - Mount the React app into the DOM.
  - Wrap the root with React's StrictMode for dev-time checks.

  Notes:
  - Keep this file minimal. App-level routing and app composition live in `App.jsx`.
  - Styles are imported via `index.css`.
*/
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Initialize axios auth header propagation/interceptors
import './axiosSetup'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
