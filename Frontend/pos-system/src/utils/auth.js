import axios from 'axios'

// Centralized auth helpers
// - logout(): clears local auth state and notifies backend if a logout endpoint exists.
export async function logout() {
  try {
    const API_BASE = import.meta.env.VITE_API_URL || ''
    // If backend supports a logout endpoint, call it to invalidate server-side state.
    // We wrap in try/catch and don't fail the client logout if the request fails.
    try {
      await axios.post(`${API_BASE}/api/auth/logout`, null, { withCredentials: true })
    } catch (e) {
      // endpoint may not exist; ignore network error during logout call
      // console.debug('logout endpoint not available', e)
    }
  } finally {
    // Clear client-side auth state
    localStorage.removeItem('api_token')
    localStorage.removeItem('server_role')
    localStorage.removeItem('role')
    // Remove any axios default auth header
    try { delete axios.defaults.headers.common['Authorization'] } catch (e) {}
  }
}

export function setAuthToken(token) {
  if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  else delete axios.defaults.headers.common['Authorization']
}
