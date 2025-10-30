const User = require('../models/user')

function parseHHmm(s) {
  if (!s || typeof s !== 'string') return null
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (Number.isNaN(h) || Number.isNaN(min)) return null
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

module.exports = async function ensureWithinShift(req, res, next) {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })
    const u = await User.findById(userId).select('shiftStart shiftEnd username role').lean()
    if (!u) return res.status(401).json({ message: 'Unauthorized' })

    const startM = parseHHmm(u.shiftStart)
    const endM = parseHHmm(u.shiftEnd)
    // If not configured, allow
    if (startM == null && endM == null) return next()

    const now = new Date()
    const nowM = now.getHours() * 60 + now.getMinutes()

    // If only end is configured, block at end and after on the same day
    if (startM == null && endM != null) {
      if (nowM >= endM) {
        return res.status(403).json({ message: 'Shift ended', code: 'SHIFT_OUTSIDE', now: nowM, shiftEnd: u.shiftEnd })
      }
      return next()
    }
    // If only start is configured, allow all (can extend to block before start if needed)
    if (startM != null && endM == null) return next()

    // Both start and end configured
    let inWindow
    if (endM > startM) {
      // Same-day window: [start, end) — kick at the exact end minute
      inWindow = nowM >= startM && nowM < endM
    } else if (endM < startM) {
      // Overnight window: [start, 24:00) U [00:00, end) — kick at the exact end minute
      inWindow = (nowM >= startM) || (nowM < endM)
    } else {
      // start == end: treat as always allowed (no window)
      inWindow = true
    }

    if (!inWindow) {
      return res.status(403).json({ message: 'Shift ended', code: 'SHIFT_OUTSIDE', now: nowM, shiftStart: u.shiftStart, shiftEnd: u.shiftEnd })
    }
    return next()
  } catch (e) {
    console.error(e)
    return res.status(500).json({ message: 'Server error' })
  }
}
