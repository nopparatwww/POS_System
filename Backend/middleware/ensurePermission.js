const Permission = require('../models/permission')
const User = require('../models/user')

// role baseline mapping should match apiPermissionRoutes
const roleBaseline = {
  admin: [
    'admin.dashboard', 'admin.permissions', 'admin.products',
    'admin.logs', // legacy umbrella
    'admin.logs.all', 'admin.logs.admin', 'admin.logs.cashier', 'admin.logs.warehouse'
  ],
  cashier: ['sales.home'],
  warehouse: ['warehouse.home'],
}

module.exports = function ensurePermission(requiredKey) {
  return async function(req, res, next) {
    try {
      const me = await User.findById(req.user.userId).lean()
      if (!me) return res.status(401).json({ message: 'Unauthorized' })
      const perm = await Permission.findOne({ user: me._id }).lean()
      const allow = perm?.allowRoutes || []
      const deny = perm?.denyRoutes || []

      const required = Array.isArray(requiredKey) ? requiredKey : [requiredKey]

      let allowed
      if (allow.length > 0) {
        allowed = required.some(k => allow.includes(k))
      } else {
        const base = roleBaseline[me.role] || []
        allowed = required.some(k => base.includes(k))
      }
      if (required.some(k => deny.includes(k))) allowed = false

      if (!allowed) return res.status(403).json({ message: 'Forbidden' })
      next()
    } catch (e) {
      console.error(e)
      res.status(500).json({ message: 'Server error' })
    }
  }
}