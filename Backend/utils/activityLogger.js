const ActivityLog = require('../models/activityLog')

/**
 * Central helper to create activity logs.
 * Keeps logging behavior consistent across routes.
 *
 * @param {object} req - Express request (used to read req.user, method, originalUrl)
 * @param {string} action - action key (e.g., 'product.create')
 * @param {number} status - HTTP status code to record
 * @param {object} details - additional details to store
 */
async function logActivity(req, action, status = 200, details = {}) {
  try {
    const actorUsername = req.user?.username || 'unknown'
    const actorRole = req.user?.role || 'unknown'
    await ActivityLog.create({
      action,
      actorUsername,
      actorRole,
      method: req.method,
      path: req.originalUrl,
      status,
      details,
    })
  } catch (e) {
    // don't throw to avoid breaking main flow; log for server operators
    console.error('activityLogger.logActivity error:', e)
  }
}

module.exports = { logActivity }
