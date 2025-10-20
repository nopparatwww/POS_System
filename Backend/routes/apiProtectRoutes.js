const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const ensureAdmin = require("../middleware/ensureAdmin");
const User = require("../models/user");
const ActivityLog = require("../models/activityLog");
const ensurePermission = require("../middleware/ensurePermission");

// Protected route example
router.get("/dashboard", authenticateToken, (req, res) => {
  res.json({
    message: "Welcome to the protected dashboard",
    user: req.user,
  });
});

module.exports = router;

// Admin: list users with basic fields and pagination
router.get('/users', authenticateToken, ensureAdmin, async (req, res) => {
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
      .select('username role createdAt updatedAt')
      .lean();

    res.json({ page, limit, total, items: users });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: get a single user by username
router.get('/users/:username', authenticateToken, ensureAdmin, async (req, res) => {
  try {
    const { username } = req.params
    const user = await User.findOne({ username }).select('username role createdAt updatedAt').lean()
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: update user's role and/or password
router.put('/users/:username', authenticateToken, ensureAdmin, async (req, res) => {
  try {
    const { username } = req.params
    const { role, password } = req.body || {}
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
        details: { changedRole: !!role, changedPassword: typeof password === 'string' && password.trim().length > 0 }
      })
    } catch (e) { /* ignore log error */ }
    res.json({ username: user.username, role: user.role, updatedAt: user.updatedAt })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})

// Admin: fetch activity logs with optional filters
router.get('/logs', authenticateToken, ensureAdmin, ensurePermission('admin.logs'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const q = (req.query.q || '').toString().trim()
    const user = (req.query.user || '').toString().trim()

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

    const total = await ActivityLog.countDocuments(criteria)
    const items = await ActivityLog.find(criteria)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    res.json({ page, limit, total, items })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Server error' })
  }
})
