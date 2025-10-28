import axios from 'axios'

// Attach Authorization header from localStorage automatically
axios.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('api_token')
    if (token && !config.headers?.Authorization) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch {}
  return config
})

// Optional: Handle 401 by clearing token to avoid loops and allow clean login
axios.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    if (status === 401 || status === 403) {
      try { localStorage.removeItem('api_token') } catch {}
    }
    return Promise.reject(error)
  }
)
