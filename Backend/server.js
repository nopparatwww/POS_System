const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
// Load environment variables from .env into process.env
require("dotenv").config();

// connect to DB (file sets up mongoose connection)
require("./config/db");

// Route modules
const apiAuthRoutes = require("./routes/apiAuthRoutes");
const apiProtectRoutes = require("./routes/apiProtectRoutes");
const apiPermissionRoutes = require("./routes/apiPermissionRoutes");
const apiPublicRoutes = require("./routes/apiPublicRoutes");
const apiProductRoutes = require("./routes/apiProductRoutes");
// Deprecated legacy cashier routes module (returns 410 Gone responses) kept for backward compatibility
const apiCashierRoutes = require("./routes/apiCashierRoutes");
const apiDiscountRoutes = require("./routes/apiDiscountsRoutes");
const apiSalesRoutes = require("./routes/apiSalesRoutes");
const apiRefundRoutes = require("./routes/apiRefundRoutes");
const apiPaymentsRoutes = require("./routes/apiPaymentsRoutes");
const { stripeWebhookHandler } = require("./routes/stripeWebhook");

// Model imports for inline utility endpoints (e.g., search)
const Product = require("./models/product");

const app = express();

// Disable ETag to prevent 304 Not Modified caching on JSON API responses
// This ensures clients always receive fresh bodies (important for auth/permission checks)
app.set("etag", false);
// Hide Express signature
app.disable("x-powered-by");

// Mount Stripe webhook BEFORE JSON parser to keep raw body for signature verification
app.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

// Parse incoming JSON bodies (application/json) for all other routes
app.use(bodyParser.json());

// Enable CORS for all origins (in production restrict origin list)
app.use(cors());

// Health / default route
// Useful for simple liveness checks (e.g., container orchestration)
app.get("/", (req, res) => {
  res.send("JWT API is running");
});

// Search API
app.get("/api/products/search", async (req, res) => {
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
app.use("/api/protect/cashier", apiCashierRoutes); // returns 410 Gone, guiding clients to /sales
app.use("/api/protect/discounts", apiDiscountRoutes);
app.use("/api/protect/sales", apiSalesRoutes);
app.use("/api/protect/refunds", apiRefundRoutes);
app.use("/api/protect/payments", apiPaymentsRoutes);

// Export app for testing/importing while still starting the server below
module.exports = app;

// Start server (skip when running tests)
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
