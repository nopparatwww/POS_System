const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Configuration for hashing: rounds (cost) and optional application-level pepper
// - BCRYPT_ROUNDS: controls computational cost (higher = slower but more secure)
// - PASSWORD_PEPPER: optional secret added to password before hashing (stored in env)
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
const PEPPER = process.env.PASSWORD_PEPPER

if (BCRYPT_ROUNDS < 10) {
  console.warn(`Warning: BCRYPT_ROUNDS is set to ${BCRYPT_ROUNDS}. Consider using >= 10 for production.`);
}

/**
 * User schema
 * - username: unique identifier for login
 * - passwordHash: the hashed password (do NOT store plain password)
 * - hashAlgo: metadata describing which algorithm produced the hash (useful for migrations)
 * - role: simple RBAC indicator (expand as needed)
 * - timestamps: createdAt and updatedAt (automatically maintained by mongoose)
 */
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    hashAlgo: { type: String, default: "bcrypt" },
    role: {
      type: String,
      enum: ["admin", "warehouse", "cashier"],
      default: "cashier",
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

/**
 * setPassword(plain)
 * - Hashes `plain` and stores result in `this.passwordHash`.
 * - Uses optional application-level PEPPER (configurable via env) in addition to bcrypt salt.
 * - Updates `hashAlgo` metadata so we can migrate later if switching algorithms.
 * - Call this from signup flow or when user changes password.
 */
userSchema.methods.setPassword = async function (plain) {
  // Combine pepper with plain password if pepper is configured
  const toHash = PEPPER ? PEPPER + plain : plain;
  // Generate salt with configured cost factor
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  // Compute hash and store
  this.passwordHash = await bcrypt.hash(toHash, salt);
  // Record algorithm for future migration/compatibility
  this.hashAlgo = "bcrypt";
};

/**
 * comparePassword(candidatePassword)
 * - Verifies candidate password against stored hash
 * - Applies the same PEPPER if configured before comparing
 * - Returns boolean
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  const toCompare = PEPPER ? PEPPER + candidatePassword : candidatePassword;
  if (!this.passwordHash) return false;
  return bcrypt.compare(toCompare, this.passwordHash);
};

module.exports = mongoose.model("User", userSchema);
