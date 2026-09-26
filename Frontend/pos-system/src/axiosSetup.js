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

// A normal 403 means this account lacks a permission, not that its login expired.
axios.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    const code = error?.response?.data?.code
    const url = error?.config?.url || ''
    if (status === 401 || (status === 403 && code === 'SHIFT_OUTSIDE')) {
      try { localStorage.removeItem('api_token') } catch {}
      // If shift ended
      if (code === 'SHIFT_OUTSIDE') {
        try {
          if (url.includes('/api/auth/login')) {
            // Login attempt outside shift: show specific alert, stay on login page
            window.alert('ไม่สามารถเข้าสู่ระบบได้ เนื่องจากคุณอยู่นอกเวลางานแล้ว')
          } else {
            // When kicked out while using the app: alert then redirect to login
            window.alert('คุณอยู่นอกเวลางานแล้ว ไม่สามารถใช้งานระบบได้')
            window.location.replace('/')
          }
        } catch {}
      }
    }
    return Promise.reject(error)
  }
)
