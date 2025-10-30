const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../models/user");
const ActivityLog = require("../models/activityLog");
const { loginRateLimiter } = require("../middleware/rateLimiter");

const SECRET_KEY = process.env.JWT_SECRET

// Helper: parse HH:mm to minutes since midnight
function parseHHmmToMin(s) {
  if (!s || typeof s !== 'string') return null
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (Number.isNaN(h) || Number.isNaN(min)) return null
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

router.post("/signup", async (req, res) => {
  try {
    const { username: rawUsername, password, role,
      firstName, lastName, birthdate, phone, email, gender, shiftStart, shiftEnd
    } = req.body || {};
    const username = (rawUsername || "").trim();
    if (!username || !password)
      return res.status(400).json({ message: "username and password are required" });

    // validate role when provided
    if (role && !["admin", "warehouse", "cashier"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ message: "Username already exists" });

    const user = new User({
      username,
      role,
      firstName,
      lastName,
      birthdate: birthdate ? new Date(birthdate) : undefined,
      phone,
      email,
      gender,
      shiftStart,
      shiftEnd,
    });
    await user.setPassword(password);
    await user.save();
    // log action (actor may be unknown if public signup; fall back to provided username)
    try {
      await ActivityLog.create({
        action: 'user.create',
        actorUsername: req.user?.username || username,
        actorRole: req.user?.role || role || 'unknown',
        targetUsername: username,
        method: req.method,
        path: req.originalUrl,
        status: 201,
        details: { role }
      })
    } catch (e) { /* swallow logging error */ }
    res.status(201).json({ message: "User created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", loginRateLimiter, async (req, res) => {
  try {
    const { username: rawUsername, password } = req.body || {};
    const username = (rawUsername || "").trim();
    if (!username || !password)
      return res.status(400).json({ message: "username and password are required" });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "Invalid username or password" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: "Invalid username or password" });

    // Check shift window BEFORE issuing token
    const startM = parseHHmmToMin(user.shiftStart)
    const endM = parseHHmmToMin(user.shiftEnd)
    if (startM != null || endM != null) {
      const now = new Date()
      const nowM = now.getHours() * 60 + now.getMinutes()
      let inWindow = true
      if (startM == null && endM != null) {
        // Only end configured: block at and after end
        inWindow = nowM < endM
      } else if (startM != null && endM == null) {
        // Only start configured: allow all (current policy)
        inWindow = true
      } else if (startM != null && endM != null) {
        if (endM > startM) {
          // Same-day window [start, end)
          inWindow = nowM >= startM && nowM < endM
        } else if (endM < startM) {
          // Overnight window [start, 24:00) U [00:00, end)
          inWindow = (nowM >= startM) || (nowM < endM)
        } else {
          // start == end: treat as always allowed
          inWindow = true
        }
      }
      if (!inWindow) {
        return res.status(403).json({ message: 'Shift ended', code: 'SHIFT_OUTSIDE' })
      }
    }

    const payload = { userId: user._id, role: user.role, username: user.username };

  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: process.env.JWT_EXPIRES_IN || "1h" });
  // return token and include role/user so frontend can use them without decoding JWT
  res.json({ token, role: user.role, user: { username: user.username, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
