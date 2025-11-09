const express = require("express");
const router = express.Router();
const Product = require('../models/product');

// Public route
router.get("/info", (req, res) => {
  res.json({ message: "This is a public API, no authentication required" });
});

// (debug-only public endpoints removed)
// Public debug endpoints removed to avoid exposing internal debug logic. The
// protected product lowstock endpoints remain in the protected product routes.

module.exports = router;
