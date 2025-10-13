/*
  ProtectedRoute component

  Purpose:
  - Gate access to routes that require authentication.
  - Currently checks for an `api_token` in localStorage.

  Notes / Improvement ideas:
  - Storing tokens in localStorage is simple but has security trade-offs (XSS risk).
    For production, prefer HttpOnly secure cookies and server-side session verification
    (also provide a `/me` endpoint to verify session and fetch user info).
*/
import React from 'react'
import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('api_token')
  if (!token) return <Navigate to="/" replace />
  return children
}
