const express = require("express");
const router = express.Router();

// Public route
router.get("/info", (req, res) => {
  res.json({ message: "This is a public API, no authentication required" });
});

module.exports = router;
