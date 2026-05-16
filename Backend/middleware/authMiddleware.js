const jwt = require("jsonwebtoken");
const User = require("../models/user");

const SECRET_KEY = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
  if (!SECRET_KEY) {
    // Fail fast with clear error when server not configured
    console.error("[authMiddleware] JWT_SECRET is not set in environment");
    return res.status(500).json({ message: 'Server misconfiguration: JWT secret not set' });
  }
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
    req.user = user; // attach decoded payload

    // Async update lastActive (don't block response)
    if (user?.userId) {
      User.findByIdAndUpdate(user.userId, { lastActive: new Date() }).catch(() => {});
    }
    next();
  });
}

module.exports = authenticateToken;
