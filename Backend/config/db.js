// const mongoose = require("mongoose");

// // Database connection
// // Prefer env MONGO_URI, fallback to local Mongo for dev to avoid "undefined uri" crash
// const DEFAULT_LOCAL_URI = "mongodb://127.0.0.1:27017/pos_system";
// const MONGO_URI = process.env.MONGO_URI || DEFAULT_LOCAL_URI;

// if (!process.env.MONGO_URI) {
//   console.warn(
//     "[DB] MONGO_URI not set in environment. Falling back to local:",
//     DEFAULT_LOCAL_URI
//   );
// }

// mongoose
//   .connect(MONGO_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => console.log("Connected to MongoDB"))
//   .catch((err) => console.error("MongoDB connection error:", err));

const mongoose = require("mongoose");

// Resolve connection string with Atlas-first preference
// 1) MONGODB_URI (commonly used by Atlas)
// 2) MONGO_URI (existing env in this project)
// 3) local fallback for development
const DEFAULT_LOCAL_URI = "mongodb://127.0.0.1:27017/pos";
const MONGO_CONN_URI =
  process.env.MONGODB_URI || process.env.MONGO_URI || DEFAULT_LOCAL_URI;

if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
  console.warn("[DB] Using local Mongo fallback:", DEFAULT_LOCAL_URI);
}

mongoose
  .connect(MONGO_CONN_URI, {
    // These options are safe defaults for Atlas and local
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000, // faster fail when URI/whitelist is wrong
  })
  .then(() => {
    const dbName = mongoose.connection?.name || "unknown";
    console.log(`Connected to MongoDB (${dbName})`);
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err?.message || err);
  });