const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
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
const apiStockRoutes = require("./routes/apiStockRoutes");
const apiReportRoutes = require("./routes/apiReportRoutes");

const app = express();

// Disable ETag to prevent 304 Not Modified caching on JSON API responses
// This ensures clients always receive fresh bodies (important for auth/permission checks)
app.set('etag', false);
// Hide Express signature
app.disable('x-powered-by');

// Parse incoming JSON bodies (application/json)
app.use(bodyParser.json());

// Enable CORS for all origins (in production restrict origin list)
app.use(cors());


// Health / default route
// Useful for simple liveness checks (e.g., container orchestration)
app.get("/", (req, res) => {
  res.send("JWT API is running");
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

// Debug-only routes removed from the server; use protected endpoints
// (e.g. /api/protect/products/lowstock or /api/protect/products/lowstock-robust)
// for production-safe lowstock checks.

module.exports = app;

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
