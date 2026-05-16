const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const ipWhitelist = require("./middleware/ipWhitelist");
const authenticateToken = require("./middleware/authMiddleware");
// Load environment variables from Backend/.env regardless of CWD
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// connect to DB (file sets up mongoose connection)
require("./config/db");
const { ensureDefaultAdmin } = require("./utils/ensureDefaultAdmin");

const db = mongoose.connection;
if (db.readyState === 1) {
  ensureDefaultAdmin().catch((err) => console.error(err));
} else {
  db.once("open", () => {
    ensureDefaultAdmin().catch((err) => console.error(err));
  });
}
// Models used directly in this file
const Product = require("./models/product");

// Route modules
const apiAuthRoutes = require("./routes/apiAuthRoutes");
const apiProtectRoutes = require("./routes/apiProtectRoutes");
const apiPermissionRoutes = require("./routes/apiPermissionRoutes");
const apiPublicRoutes = require("./routes/apiPublicRoutes");
const apiProductRoutes = require("./routes/apiProductRoutes");
const apiStockRoutes = require("./routes/apiStockRoutes");
const apiReportRoutes = require("./routes/apiReportRoutes");
const apiCashierRoutes = require("./routes/apiCashierRoutes");
const apiDiscountRoutes = require("./routes/apiDiscountsRoutes");
const apiSalesRoutes = require("./routes/apiSalesRoutes");
const apiRefundRoutes = require("./routes/apiRefundRoutes");
const apiPaymentsRoutes = require("./routes/apiPaymentsRoutes");
const { stripeWebhookHandler } = require("./routes/stripeWebhook");

const app = express();
// Trust proxy to ensure req.ip reflects client IP when behind Render / reverse proxy
app.set('trust proxy', true);

// Disable ETag to prevent 304 Not Modified caching on JSON API responses
// This ensures clients always receive fresh bodies (important for auth/permission checks)
app.set('etag', false);
// Hide Express signature
app.disable('x-powered-by');

// Parse incoming JSON bodies (application/json)
app.use(express.json());

// ---- CORS Configuration ----
// Allow only origins defined in CORS_ORIGINS (comma separated). If empty => allow all.
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Non-browser or same-origin requests may have no origin; allow them.
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS: Origin not allowed"));
    },
    credentials: true,
  })
);

// ---- IP Whitelist ----
// Comma separated list of IPs. If empty => allow all.
const allowedIps = (process.env.ALLOWED_IPS || "")
  .split(",")
  .map(i => i.trim())
  .filter(Boolean);
app.use(ipWhitelist(allowedIps));

// Stripe webhook (raw body required) – still protected by whitelist & CORS above
app.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);


// Health / default route
// Useful for simple liveness checks (e.g., container orchestration)
app.get("/", (req, res) => {
  res.send("JWT API is running");
});

app.get("/api/products/search", authenticateToken, async (req, res) => {
  const term = req.query.term;
  const regex = new RegExp(term, "i");
  const results = await Product.find({
    $or: [{ name: regex }, { barcode: regex }],
  });
  res.json(results);
});


// Mount route groups
// /api/auth     -> signup, login
// /api/public   -> endpoints that don't require authentication
// /api/protect  -> endpoints protected by JWT middleware
app.use("/api/auth", apiAuthRoutes);
app.use("/api/public", apiPublicRoutes);
app.use("/api/protect", apiProtectRoutes);
app.use("/api/permissions", apiPermissionRoutes);
app.use("/api/protect/products", apiProductRoutes);
app.use("/api/protect/stock", apiStockRoutes);
app.use("/api/protect/reports", apiReportRoutes);
app.use("/api/protect/cashier", apiCashierRoutes); // returns 410 Gone, guiding clients to /sales
app.use("/api/protect/discounts", apiDiscountRoutes);
app.use("/api/protect/sales", apiSalesRoutes);
app.use("/api/protect/refunds", apiRefundRoutes);
app.use("/api/protect/payments", apiPaymentsRoutes);

// Debug-only routes removed from the server; use protected endpoints
// (e.g. /api/protect/products/lowstock or /api/protect/products/lowstock-robust)
// for production-safe lowstock checks.

module.exports = app;

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (allowedOrigins.length) {
    console.log("CORS allowed origins:", allowedOrigins.join(", "));
  } else {
    console.log("CORS allowing all origins (no CORS_ORIGINS set)");
  }
  if (allowedIps.length) {
    console.log("IP whitelist active:", allowedIps.join(", "));
  } else {
    console.log("IP whitelist disabled (no ALLOWED_IPS set)");
  }
});

// Basic error handler for CORS errors and others
// (Enhance later with centralized logging if needed)
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith("CORS")) {
    return res.status(403).json({ message: err.message });
  }
  next(err);
});
