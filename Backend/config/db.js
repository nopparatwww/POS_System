const mongoose = require("mongoose");

// Database connection
// Prefer env MONGO_URI, fallback to local Mongo for dev to avoid "undefined uri" crash
const DEFAULT_LOCAL_URI = "mongodb://127.0.0.1:27017/pos_system";
const MONGO_URI = process.env.MONGO_URI || DEFAULT_LOCAL_URI;

if (!process.env.MONGO_URI) {
  console.warn(
    "[DB] MONGO_URI not set in environment. Falling back to local:",
    DEFAULT_LOCAL_URI
  );
}

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));
