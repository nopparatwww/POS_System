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
const apiPublicRoutes = require("./routes/apiPublicRoutes");

const app = express();

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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
