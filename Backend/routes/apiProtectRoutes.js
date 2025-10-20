const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const ensureAdmin = require("../middleware/ensureAdmin");
const User = require("../models/user");

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
