const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../models/user");
const ActivityLog = require("../models/activityLog");

const SECRET_KEY = process.env.JWT_SECRET

router.post("/signup", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "username and password are required" });

    const existing = await User.findOne({ username });
    if (existing) return res.status(409).json({ message: "Username already exists" });

    const user = new User({ username, role });
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

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "username and password are required" });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "Invalid username or password" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: "Invalid username or password" });

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
