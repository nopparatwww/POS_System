// Simple in-memory rate limiter for login endpoint
// Limits each IP to N attempts per time window
// Note: This is per-process and resets on server restart. For production, use a shared store.

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes default
const MAX_ATTEMPTS = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '10', 10); // 10 attempts per window

const buckets = new Map(); // key: ip, value: { count, resetAt }

function now() { return Date.now(); }

function getBucket(ip) {
  const b = buckets.get(ip);
  if (!b || b.resetAt <= now()) {
    const nb = { count: 0, resetAt: now() + WINDOW_MS };
    buckets.set(ip, nb);
    return nb;
  }
  return b;
}

function loginRateLimiter(req, res, next) {
  try {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const b = getBucket(ip);
    b.count += 1;
    if (b.count > MAX_ATTEMPTS) {
      const retryAfter = Math.max(1, Math.ceil((b.resetAt - now()) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
    }
    return next();
  } catch (e) {
    // On error, do not block the request
    return next();
  }
}

module.exports = { loginRateLimiter };
