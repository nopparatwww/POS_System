// Deprecated legacy cashier routes.
// Kept only to avoid 404 if old frontend calls them.
// Recommend using /api/protect/sales instead.
const express = require("express");
const router = express.Router();

router.post("/checkout", (req, res) => {
  return res.status(410).json({
    message: "Legacy endpoint removed. Use POST /api/protect/sales",
  });
});

router.get("/", (req, res) => {
  return res.status(410).json({
    message: "Legacy endpoint removed. Use GET /api/protect/sales",
  });
});

module.exports = router;
