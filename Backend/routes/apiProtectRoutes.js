const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");

// Protected route example
router.get("/dashboard", authenticateToken, (req, res) => {
  res.json({
    message: "Welcome to the protected dashboard",
    user: req.user,
  });
});

module.exports = router;
