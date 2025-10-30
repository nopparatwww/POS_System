const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const ensureWithinShift = require('../middleware/ensureWithinShift');
const ensureAdmin = require('../middleware/ensureAdmin');
const ensurePermission = require('../middleware/ensurePermission');
const User = require('../models/user');
const Permission = require('../models/permission');
const ActivityLog = require('../models/activityLog');

// Map pathname to a route key. Adjust this mapping to your frontend routes.
// Example keys: 'admin.dashboard', 'admin.permissions', 'sales.home', 'warehouse.home'
const PATH_TO_KEY = [
  { path: /^\/admin\/dashboard$/, key: 'admin.dashboard' },
  { path: /^\/admin\/permissions(?:\/.*)?$/, key: 'admin.permissions' },
  // Fine-grained logs mapping
  { path: /^\/admin\/logs\/all$/, key: 'admin.logs.all' },
  { path: /^\/admin\/logs\/admin$/, key: 'admin.logs.admin' },
  { path: /^\/admin\/logs\/cashier$/, key: 'admin.logs.cashier' },
  { path: /^\/admin\/logs\/warehouse$/, key: 'admin.logs.warehouse' },
  { path: /^\/admin\/products(?:\/.*)?$/, key: 'admin.products' },
  { path: /^\/sales\/logs(?:\/.*)?$/, key: 'sales.logs' },
  { path: /^\/sales(?:\/.*)?$/, key: 'sales.home' },
  { path: /^\/warehouse\/logs(?:\/.*)?$/, key: 'warehouse.logs' },
  { path: /^\/warehouse\/products(?:\/.*)?$/, key: 'warehouse.products' },
  { path: /^\/warehouse(?:\/.*)?$/, key: 'warehouse.home' },
];

function pathToKey(pathname) {
  for (const m of PATH_TO_KEY) {
    if (m.path.test(pathname)) return m.key;
  }
  return null;
}

// Get own permissions (for route guard)
router.get('/me', authenticateToken, ensureWithinShift, async (req, res) => {
  try {
    // Prevent caching of permission payloads
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const user = await User.findById(req.user.userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const perm = await Permission.findOne({ user: user._id }).lean();
    // baseline by role used as default when no explicit permissions set
    const roleBaseline = {
      admin: [
        'admin.dashboard', 'admin.permissions', 'admin.products',
        // grant all logs by default for admins
        'admin.logs',
        'admin.logs.all', 'admin.logs.admin', 'admin.logs.cashier', 'admin.logs.warehouse'
      ],
      cashier: ['sales.home'],
      warehouse: ['warehouse.home'],
    };
    const allowRoutes = (perm?.allowRoutes && perm.allowRoutes.length > 0)
      ? perm.allowRoutes
      : (roleBaseline[user.role] || []);
    const denyRoutes = perm?.denyRoutes || [];

    res.json({ username: user.username, role: user.role, allowRoutes, denyRoutes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get permissions for a username
router.get('/:username', authenticateToken, ensureWithinShift, ensureAdmin, ensurePermission('admin.permissions'), async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    const perm = await Permission.findOne({ user: user._id }).lean();
    res.json({
      username,
      role: user.role,
      allowRoutes: perm?.allowRoutes || [],
      denyRoutes: perm?.denyRoutes || [],
      updatedAt: perm?.updatedAt || null,
      updatedBy: perm?.updatedBy || null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Update permissions for a username
router.put('/:username', authenticateToken, ensureWithinShift, ensureAdmin, ensurePermission('admin.permissions'), async (req, res) => {
  try {
    const { username } = req.params;
    const { allowRoutes = [], denyRoutes = [], notes } = req.body || {};
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const doc = await Permission.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          allowRoutes: Array.isArray(allowRoutes) ? allowRoutes : [],
          denyRoutes: Array.isArray(denyRoutes) ? denyRoutes : [],
          notes: notes || undefined,
          updatedBy: req.user?.username || 'admin',
        },
      },
      { new: true, upsert: true }
    );

    // log action
    try {
      await ActivityLog.create({
        action: 'permissions.update',
        actorUsername: req.user?.username || 'unknown',
        actorRole: req.user?.role || 'unknown',
        targetUsername: username,
        method: req.method,
        path: req.originalUrl,
        status: 200,
        details: { allowRoutes: doc.allowRoutes, denyRoutes: doc.denyRoutes }
      })
    } catch (e) { /* ignore */ }

    res.json({
      username: user.username,
      allowRoutes: doc.allowRoutes,
      denyRoutes: doc.denyRoutes,
      notes: doc.notes,
      updatedBy: doc.updatedBy,
      updatedAt: doc.updatedAt,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Optional: quick check access for a given path
router.post('/check', authenticateToken, ensureWithinShift, async (req, res) => {
  try {
    const { path } = req.body || {};
    if (!path) return res.status(400).json({ message: 'path required' });
    const key = pathToKey(path);
    if (!key) return res.json({ allowed: true, reason: 'unmapped-path' });

    const me = await User.findById(req.user.userId).lean();
    const perm = await Permission.findOne({ user: me._id }).lean();
    const allowRoutes = perm?.allowRoutes || [];
    const denyRoutes = perm?.denyRoutes || [];

    // baseline by role: admins can access admin routes, sales to sales, etc.
    const roleBaseline = {
      admin: [
        'admin.dashboard', 'admin.permissions', 'admin.products',
        'admin.logs', 'admin.logs.all', 'admin.logs.admin', 'admin.logs.cashier', 'admin.logs.warehouse'
      ],
      cashier: ['sales.home'],
      warehouse: ['warehouse.home'],
    };

    let allowed;
    if (allowRoutes.length > 0) {
      // Explicit allow list present: only allowed when listed
      allowed = allowRoutes.includes(key);
    } else {
      // No explicit allow list: fall back to role baseline
      allowed = (roleBaseline[me.role] || []).includes(key);
    }
    if (denyRoutes.includes(key)) allowed = false; // deny still overrides

    res.json({ allowed, key, role: me.role, allowRoutes, denyRoutes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
