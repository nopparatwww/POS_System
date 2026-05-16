// IP Whitelist middleware
// Usage: const ipWhitelist = require('./middleware/ipWhitelist')(allowedIpArray);
// Place early: app.use(ipWhitelist);
// Reads X-Forwarded-For when behind a proxy (Render / reverse proxy) – ensure app.set('trust proxy', true)
// If ALLOWED_IPS is empty -> allow all (fails open to prevent accidental lockout in dev)

function normalizeIp(ip) {
  if (!ip) return '';
  // For ipv6 mapped ipv4 addresses ::ffff:127.0.0.1
  return ip.replace(/^::ffff:/, '').trim();
}

module.exports = function createIpWhitelist(allowedIps = []) {
  const cleaned = allowedIps.map(i => i.trim()).filter(Boolean);
  const allowAll = cleaned.length === 0;
  const enableLogging = (process.env.LOG_IP_WHITELIST || '1') === '1';
  let logActivity;
  try {
    ({ logActivity } = require('../utils/activityLogger'));
  } catch (e) {
    // fallback: no activity logger available
    logActivity = null;
  }

  return async function ipWhitelist(req, res, next) {
    // Prefer X-Forwarded-For (may contain comma separated list). First is original client.
    const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0];
    const direct = req.ip || req.connection?.remoteAddress || '';
    const candidate = normalizeIp(forwarded) || normalizeIp(direct);
    const allowed = allowAll || cleaned.includes(candidate);

    if (enableLogging) {
      const details = {
        ip: candidate,
        allowed,
        forwardedChain: req.headers['x-forwarded-for'] || '',
        whitelist: cleaned,
      };
      if (logActivity) {
        // status 200 if allowed else 403
        logActivity(req, allowed ? 'ip.allow' : 'ip.block', allowed ? 200 : 403, details);
      } else {
        // console fallback
        console.log(`[ipWhitelist] ${allowed ? 'ALLOW' : 'BLOCK'} ip=${candidate} path=${req.originalUrl}`);
      }
    }

    if (allowed) {
      return next();
    }

    return res.status(403).json({ message: 'Forbidden: IP not allowed', ip: candidate });
  };
};
