/*
  Login page — redesigned

  UX goals:
  - Modern two-column layout with brand/benefits on the left and a focused login card on the right
  - Show/Hide password, Remember me, clear error messaging
  - Keep existing auth flow and role mapping logic intact

  Security note:
  - Token persists in localStorage for now (easy). Consider migrating to HttpOnly cookie for higher security later.
*/
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { setAuthToken } from '../utils/auth'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Support both env keys to match existing deployments
  const API_BASE = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || '').trim()

  // Prefill username if "remember me" was used previously
  useEffect(() => {
    try {
      const saved = localStorage.getItem('remember_username')
      if (saved) {
        setUsername(saved)
        setRemember(true)
      }
    } catch {}
  }, [])

  // Removed dynamic stats fetch to keep login light and simple

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!username || !password) return setError('Please enter username and password')
    setLoading(true)
    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, { username, password })
      const token = res.data?.token || res.data?.accessToken || null
      if (!token) throw new Error('No token returned')

      // store token
      localStorage.setItem('api_token', token)
      // set axios default Authorization header for the running session
      setAuthToken(token)

      // decode JWT payload (try once) to use as fallback for role/username
      let payload = null
      try {
        const parts = token.split('.')
        if (parts.length === 3) {
          payload = JSON.parse(decodeURIComponent(escape(window.atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))))
        }
      } catch {}

      // read server role (various possible shapes). Prefer explicit response fields, then payload.
      let serverRole = res.data?.role || res.data?.user?.role || res.data?.data?.role || payload?.role || payload?.user?.role || ''
      if (serverRole) {
        localStorage.setItem('server_role', serverRole)
        const SERVER_TO_UI = {
          cashier: 'sales',
          sales: 'sales',
          admin: 'admin',
          user: 'admin',
          manager: 'warehouse',
          owner: 'warehouse',
        }
        const mapped = SERVER_TO_UI[serverRole]
        if (mapped) localStorage.setItem('role', mapped)
        else localStorage.removeItem('role')
      }

      const usernameFromResp = res.data?.user?.username || res.data?.username || res.data?.data?.user?.username || payload?.username || username || ''
      if (usernameFromResp) localStorage.setItem('username', usernameFromResp)

      // remember me
      try {
        if (remember) localStorage.setItem('remember_username', username)
        else localStorage.removeItem('remember_username')
      } catch {}

      const SERVER_TO_PATH = {
        admin: '/admin',
        cashier: '/sales',
        sales: '/sales',
        warehouse: '/warehouse',
        manager: '/warehouse',
        owner: '/admin',
      }
      const goTo = SERVER_TO_PATH[serverRole] || '/admin'
      navigate(goTo)
    } catch (err) {
      console.error(err)
      if (err?.response) setError(err.response?.data?.message || 'Server error')
      else if (err?.request) setError('No response from server')
      else setError(err?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-gray-50">
      {/* Left: Visual hero with decorative background */}
  <div className="hidden md:flex relative items-center justify-center p-10 bg-gradient-to-tr from-emerald-500 via-emerald-600 to-teal-600 text-white overflow-hidden">
        {/* subtle blurred blobs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-white/10 rounded-full blur-3xl" aria-hidden></div>
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-teal-300/20 rounded-full blur-3xl" aria-hidden></div>
        {/* dotted pattern overlay */}
        <div
          className="absolute inset-0 opacity-15"
          aria-hidden
          style={{
            backgroundImage: 'radial-gradient(#ffffff 0.75px, transparent 0.75px)',
            backgroundSize: '16px 16px',
          }}
        />

        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold">POS</div>
            <span className="text-lg font-semibold tracking-wide">POS System</span>
          </div>

          <h2 className="mt-6 text-3xl font-bold leading-tight">ขายสะดวก จัดการสต็อกง่าย</h2>
          <p className="mt-3 text-emerald-50/90">ระบบ POS สำหรับร้านค้าของคุณ เร็ว เสถียร พร้อมสแกนบาร์โค้ด</p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-white/15">Barcode Scan</span>
            <span className="px-3 py-1 rounded-full bg-white/15">Stock Reports</span>
            <span className="px-3 py-1 rounded-full bg-white/15">Stripe / QR</span>
          </div>

          {/* Replace stat cards with concise feature list */}
          <ul className="mt-8 space-y-2 text-emerald-50/95">
            <li className="flex items-start gap-3"><span className="mt-1">✓</span> เข้าสู่ระบบได้รวดเร็ว ปลอดภัย</li>
            <li className="flex items-start gap-3"><span className="mt-1">✓</span> รองรับการใช้งานบนมือถือและแท็บเล็ต</li>
            <li className="flex items-start gap-3"><span className="mt-1">✓</span> สแกนบาร์โค้ดได้ ไม่ต้องพิมพ์ค้นหา</li>
          </ul>

          <div className="mt-10 text-sm opacity-80">© {new Date().getFullYear()} POS System</div>
        </div>
      </div>

      {/* Right: Login Card */}
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="h-1.5 w-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full mb-3" />
              <h1 className="text-2xl font-semibold text-gray-900">เข้าสู่ระบบ</h1>
              <p className="text-gray-500 mt-1">กรุณากรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งาน</p>
            </div>
            <div className="hidden sm:flex h-10 w-10 rounded-full bg-emerald-600/10 text-emerald-700 border border-emerald-500/20 items-center justify-center font-bold">
              POS
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm text-gray-700">ชื่อผู้ใช้</label>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm text-gray-700">รหัสผ่าน</label>
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 px-3 text-sm text-emerald-700 hover:text-emerald-900"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-start">
              <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-emerald-600"
                />
                จำชื่อผู้ใช้ (Remember me)
              </label>
            </div>

            <button
              disabled={loading || !username || !password}
              className={`w-full rounded-lg bg-emerald-600 text-white py-2.5 font-medium hover:bg-emerald-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 ${ (loading || !username || !password) ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <div className="mt-6 text-xs text-gray-500">
            เคล็ดลับความปลอดภัย: หลีกเลี่ยงการใช้อุปกรณ์สาธารณะ และออกจากระบบเมื่อใช้งานเสร็จ
          </div>
        </div>
      </div>
    </div>
  )
}
