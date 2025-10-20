const Permission = require('../models/permission')
const User = require('../models/user')

// role baseline mapping should match apiPermissionRoutes
const roleBaseline = {
  admin: ['admin.dashboard', 'admin.permissions', 'admin.logs'],
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

      let allowed
      if (allow.length > 0) {
        allowed = allow.includes(requiredKey)
      } else {
        allowed = (roleBaseline[me.role] || []).includes(requiredKey)
      }
      if (deny.includes(requiredKey)) allowed = false

      if (!allowed) return res.status(403).json({ message: 'Forbidden' })
      next()
    } catch (e) {
      console.error(e)
      res.status(500).json({ message: 'Server error' })
    }
  }
}