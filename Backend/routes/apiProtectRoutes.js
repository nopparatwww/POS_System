const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const ensureWithinShift = require("../middleware/ensureWithinShift");
const ensureAdmin = require("../middleware/ensureAdmin");
const User = require("../models/user");
const ActivityLog = require("../models/activityLog");
const ensurePermission = require("../middleware/ensurePermission");
const Permission = require("../models/permission");

// Protected route example
router.get("/dashboard", authenticateToken, ensureWithinShift, (req, res) => {
  res.json({
    message: "Welcome to the protected dashboard",
    user: req.user,
  });
});

module.exports = router;

// Admin: list users with basic fields and pagination
router.get('/users', authenticateToken, ensureWithinShift, ensureAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const q = (req.query.query || '').toString().trim();

    const criteria = q ? { username: { $regex: q, $options: 'i' } } : {};
    const total = await User.countDocuments(criteria);
    const users = await User.find(criteria)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('username role firstName lastName phone email createdAt updatedAt')
      .lean();

    res.json({ page, limit, total, items: users });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: get a single user by username
router.get('/users/:username', authenticateToken, ensureWithinShift, ensureAdmin, async (req, res) => {
  try {
    const { username } = req.params
  const user = await User.findOne({ username }).select('username role firstName lastName birthdate phone email gender shiftStart shiftEnd createdAt updatedAt').lean()
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: update user's role and/or password
router.put('/users/:username', authenticateToken, ensureWithinShift, ensureAdmin, async (req, res) => {
  try {
    const { username } = req.params
  const { role, password, firstName, lastName, birthdate, phone, email, gender, shiftStart, shiftEnd } = req.body || {}
    const user = await User.findOne({ username })
    if (!user) return res.status(404).json({ message: 'User not found' })

    // update role if provided
    if (role) {
      const valid = ['admin', 'warehouse', 'cashier']
      if (!valid.includes(role)) return res.status(400).json({ message: 'Invalid role' })
      user.role = role
    }
    // update password if provided and non-empty
    if (typeof password === 'string' && password.trim().length > 0) {
      await user.setPassword(password.trim())
    }
    // update profile fields if provided
    if (typeof firstName !== 'undefined') user.firstName = firstName
    if (typeof lastName !== 'undefined') user.lastName = lastName
    if (typeof birthdate !== 'undefined') user.birthdate = birthdate ? new Date(birthdate) : undefined
    if (typeof phone !== 'undefined') user.phone = phone
    if (typeof email !== 'undefined') user.email = email
    if (typeof gender !== 'undefined') user.gender = gender
    if (typeof shiftStart !== 'undefined') user.shiftStart = shiftStart
    if (typeof shiftEnd !== 'undefined') user.shiftEnd = shiftEnd

    await user.save()
    // log action
    try {
      await ActivityLog.create({
        action: 'user.update',
        actorUsername: req.user?.username || 'unknown',
        actorRole: req.user?.role || 'unknown',
        targetUsername: username,
        method: req.method,
        path: req.originalUrl,
        status: 200,
        details: {
          changedRole: !!role,
          changedPassword: typeof password === 'string' && password.trim().length > 0,
          profileUpdated: Boolean(
            typeof firstName !== 'undefined' || typeof lastName !== 'undefined' || typeof birthdate !== 'undefined' ||
            typeof phone !== 'undefined' || typeof email !== 'undefined' || typeof gender !== 'undefined' ||
            typeof shiftStart !== 'undefined' || typeof shiftEnd !== 'undefined'
          )
        }
      })
    } catch (e) { /* ignore log error */ }
    res.json({
      username: user.username,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      birthdate: user.birthdate,
      phone: user.phone,
      email: user.email,
      gender: user.gender,
      shiftStart: user.shiftStart,
      shiftEnd: user.shiftEnd,
      updatedAt: user.updatedAt
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Helper to build criteria and respond with paginated logs
async function respondLogs(req, res, fixedRole = null) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
  const q = (req.query.q || '').toString().trim()
  const user = (req.query.user || '').toString().trim()
  const roleFromQuery = (req.query.role || '').toString().trim().toLowerCase()

  const criteria = {}
  if (q) {
    criteria.$or = [
      { action: { $regex: q, $options: 'i' } },
      { path: { $regex: q, $options: 'i' } },
      { actorUsername: { $regex: q, $options: 'i' } },
      { targetUsername: { $regex: q, $options: 'i' } },
    ]
  }
  if (user) {
    criteria.$and = (criteria.$and || [])
    criteria.$and.push({ $or: [ { actorUsername: user }, { targetUsername: user } ] })
  }
  const roleToUse = fixedRole || roleFromQuery
  if (roleToUse && ['admin','cashier','warehouse'].includes(roleToUse)) {
    criteria.actorRole = roleToUse
  }

  const total = await ActivityLog.countDocuments(criteria)
  const items = await ActivityLog.find(criteria)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()

  res.json({ page, limit, total, items })
}

// Admin: fetch activity logs with optional filters (all roles)
// Allow access if user has any of the fine-grained logs permissions (or legacy 'admin.logs')
router.get('/logs', authenticateToken, ensureWithinShift, ensureAdmin, ensurePermission(['admin.logs','admin.logs.all','admin.logs.admin','admin.logs.cashier','admin.logs.warehouse']), async (req, res) => {
  try { await respondLogs(req, res, null) } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// Admin: logs by fixed role paths
router.get('/logs/all', authenticateToken, ensureWithinShift, ensureAdmin, ensurePermission('admin.logs'), async (req, res) => {
  try { await respondLogs(req, res, null) } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})
router.get('/logs/admin', authenticateToken, ensureWithinShift, ensureAdmin, ensurePermission('admin.logs'), async (req, res) => {
  try { await respondLogs(req, res, 'admin') } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})
router.get('/logs/cashier', authenticateToken, ensureWithinShift, ensureAdmin, ensurePermission('admin.logs'), async (req, res) => {
  try { await respondLogs(req, res, 'cashier') } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})
router.get('/logs/warehouse', authenticateToken, ensureWithinShift, ensureAdmin, ensurePermission('admin.logs'), async (req, res) => {
  try { await respondLogs(req, res, 'warehouse') } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// Sales: own logs (cashier) without admin requirement
router.get('/logs/sales', authenticateToken, ensureWithinShift, ensurePermission('sales.logs'), async (req, res) => {
  try { await respondLogs(req, res, 'cashier') } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// Warehouse: own logs without admin requirement
router.get('/logs/warehouse-self', authenticateToken, ensureWithinShift, ensurePermission('warehouse.logs'), async (req, res) => {
  try { await respondLogs(req, res, 'warehouse') } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }) }
})

// Removed profile picture upload feature as per request
