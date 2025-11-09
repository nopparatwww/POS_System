const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const authenticateToken = require('../middleware/authMiddleware');
const ensurePermission = require('../middleware/ensurePermission');
const ensureWithinShift = require('../middleware/ensureWithinShift');
const ActivityLog = require('../models/activityLog');
const User = require('../models/user');
const Permission = require('../models/permission');

// role baseline mapping (same as middleware/ensurePermission)
const roleBaseline = {
  admin: [
    'admin.dashboard', 'admin.permissions', 'admin.products',
    'admin.logs', 'admin.logs.all', 'admin.logs.admin', 'admin.logs.cashier', 'admin.logs.warehouse',
    'admin.stockin', 'admin.stockout', 'admin.lowstock', 'admin.audit','admin.reports'
  ],
  cashier: ['sales.home'],
  warehouse: ['warehouse.home', 'warehouse.products', 'warehouse.stockin', 'warehouse.stockout', 'warehouse.stockaudit', 'warehouse.lowstock', 'warehouse.logs','warehouse.audit','admin.reports'],
}

function escapeRegExp(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Normalize and validate incoming product payload
// IMPORTANT: Only include fields actually provided to avoid wiping values on partial updates.
function pickBody(b = {}) {
  const body = {};
  if (b.sku != null) body.sku = b.sku.toString().trim();
  if (b.name != null) body.name = b.name.toString().trim();
  if (b.description != null) body.description = b.description.toString();
  if (b.category != null) body.category = b.category.toString();
  if (b.price != null) body.price = Number(b.price);
  if (b.cost != null) body.cost = Math.max(0, Number(b.cost));
  if (b.stock != null) body.stock = Number(b.stock);
  if (b.unit != null) body.unit = b.unit.toString();
  if (b.barcode != null) body.barcode = b.barcode.toString();
  if (b.status != null) body.status = b.status.toString();
  if (b.reorderLevel != null) body.reorderLevel = Math.max(0, Number(b.reorderLevel));
  return body;
}

// GET /api/protect/products
// Supports pagination, text search (by name/sku), status filter and simple sort
router.get('/', authenticateToken, ensureWithinShift, ensurePermission(['admin.products', 'warehouse.products']), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const q = (req.query.q || '').toString().trim();
    const status = (req.query.status || '').toString().trim();
    const sortRaw = (req.query.sort || '-createdAt').toString();

    const criteria = {};
    if (q) {
      const qr = new RegExp(escapeRegExp(q), 'i');
      criteria.$or = [
        { sku: qr },
        { name: qr },
        { category: qr },
        { barcode: qr },
      ];
    }
    if (status === 'active' || status === 'inactive') criteria.status = status;

    const sort = {};
    sortRaw.split(',').forEach(k => {
      k = k.trim();
      if (!k) return;
      if (k.startsWith('-')) sort[k.slice(1)] = -1; else sort[k] = 1;
    });

    const total = await Product.countDocuments(criteria);
    const items = await Product.find(criteria)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ page, limit, total, items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// (debug-only routes removed) - lowstock debug endpoints were removed to avoid
// exposing internal debug logic in production. Use the protected
// '/lowstock' or '/lowstock-robust' routes instead.

// GET /api/protect/products/lowstock
// Protected lowstock route — placed before the dynamic ':id' route so it doesn't get captured.
router.get('/lowstock', authenticateToken, ensureWithinShift, ensurePermission(['admin.lowstock', 'warehouse.lowstock']), async (req, res) => {
  try {
    let items;
    try {
      // Preferred: use $expr to let MongoDB compare two fields server-side
      items = await Product.find({ $expr: { $lt: ["$stock", "$reorderLevel"] } }).sort({ name: 1 }).lean();
    } catch (dbExprErr) {
      // Some older MongoDB servers don't support $expr — fallback to client-side filter
      console.warn('Product lowstock: $expr query failed, falling back to in-memory filter:', dbExprErr && dbExprErr.message);
      const all = await Product.find().sort({ name: 1 }).lean();
      items = all.filter(p => {
        const s = typeof p.stock === 'number' ? p.stock : Number(p.stock || 0);
        const r = typeof p.reorderLevel === 'number' ? p.reorderLevel : Number(p.reorderLevel || 0);
        return s < r;
      });
    }

    res.json(items);
  } catch (e) {
    console.error('Get Low Stock Error:', e);
    res.status(500).json({ message: 'Server error fetching low stock items.' });
  }
});

// Robust lowstock endpoint: authenticates, then performs permission check and returns lowstock items.
// This route duplicates the permission logic but traps internal errors and returns clear 4xx codes
// instead of a 500 when permission/shift checks fail due to unexpected data.
router.get('/lowstock-robust', authenticateToken, async (req, res) => {
  try {
    console.log('[lowstock-robust] Incoming request:', { authHeader: !!req.headers.authorization, user: req.user })
    // 1) basic auth: req.user must exist
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })

    // 2) lookup user
    const me = await User.findById(userId).lean()
    if (!me) return res.status(401).json({ message: 'Unauthorized' })

    // 3) permission resolution (allow/deny overrides)
    let permDoc = null
    try { permDoc = await Permission.findOne({ user: me._id }).lean() } catch (e) { /* ignore, fallback to baseline */ }
    const allow = permDoc?.allowRoutes || []
    const deny = permDoc?.denyRoutes || []

    const requiredKeys = ['admin.lowstock', 'warehouse.lowstock']
    let allowed
    if (allow.length > 0) {
      allowed = requiredKeys.some(k => allow.includes(k))
    } else {
      const base = roleBaseline[me.role] || []
      allowed = requiredKeys.some(k => base.includes(k))
    }
    if (requiredKeys.some(k => deny.includes(k))) allowed = false
    if (!allowed) return res.status(403).json({ message: 'Forbidden' })

    // 4) perform lowstock query (same logic as main route)
    let items;
    try {
      items = await Product.find({ $expr: { $lt: ["$stock", "$reorderLevel"] } }).sort({ name: 1 }).lean();
    } catch (dbExprErr) {
      console.warn('lowstock-robust: $expr failed, falling back to in-memory filter:', dbExprErr && dbExprErr.message);
      const all = await Product.find().sort({ name: 1 }).lean();
      items = all.filter(p => {
        const s = typeof p.stock === 'number' ? p.stock : Number(p.stock || 0);
        const r = typeof p.reorderLevel === 'number' ? p.reorderLevel : Number(p.reorderLevel || 0);
        return s < r;
      });
    }

    return res.json(items)
  } catch (e) {
    console.error('lowstock-robust error:', e && e.stack ? e.stack : e)
    return res.status(500).json({ message: 'Server error fetching low stock items (robust).' })
  }
})

// GET /api/protect/products/:id
// Return single product by id
router.get('/:id', authenticateToken, ensureWithinShift, ensurePermission(['admin.products', 'warehouse.products']), async (req, res) => {
  try {
    const prod = await Product.findById(req.params.id).lean()
    if (!prod) return res.status(404).json({ message: 'Not found' })
    res.json(prod)
  } catch (e) {
    console.error('Get product by id error:', e)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/protect/products
router.post('/', authenticateToken, ensureWithinShift, ensurePermission(['admin.products', 'warehouse.products']), async (req, res) => {
  try {
    const body = pickBody(req.body);
    if (!body.sku || !body.name) return res.status(400).json({ message: 'sku and name are required' });
    if (body.price == null || !Number.isFinite(body.price) || body.price < 0) return res.status(400).json({ message: 'invalid price' });
    if (body.stock == null || !Number.isFinite(body.stock) || body.stock < 0) return res.status(400).json({ message: 'invalid stock' });

    const exists = await Product.findOne({ sku: body.sku });
    if (exists) return res.status(409).json({ message: 'SKU already exists' });

    const doc = await Product.create({ ...body, createdBy: req.user?.userId || undefined });

    // create activity log (non-blocking)
    try { const { logActivity } = require('../utils/activityLogger'); await logActivity(req, 'product.create', 201, { sku: doc.sku, name: doc.name }) } catch {}

    res.status(201).json(doc.toObject());
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/protect/products/:id
router.put('/:id', authenticateToken, ensureWithinShift, ensurePermission(['admin.products', 'warehouse.products']), async (req, res) => {
  try {
    const body = pickBody(req.body);

    if (body.price != null && (!Number.isFinite(body.price) || body.price < 0))
      return res.status(400).json({ message: 'invalid price' });
    if (body.stock != null && (!Number.isFinite(body.stock) || body.stock < 0))
      return res.status(400).json({ message: 'invalid stock' });

    if (body.sku) {
      const dup = await Product.findOne({ sku: body.sku, _id: { $ne: req.params.id } });
      if (dup) return res.status(409).json({ message: 'SKU already exists' });
    }

    const doc = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: 'Not found' });

  try { const { logActivity } = require('../utils/activityLogger'); await logActivity(req, 'product.update', 200, { id: String(doc._id) }) } catch {}

    res.json(doc.toObject());
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/protect/products/:id
router.delete('/:id', authenticateToken, ensureWithinShift, ensurePermission(['admin.products', 'warehouse.products']), async (req, res) => {
  try {
    const doc = await Product.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    try { const { logActivity } = require('../utils/activityLogger'); await logActivity(req, 'product.delete', 200, { id: String(doc._id), sku: doc.sku }) } catch {}

    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});
 

module.exports = router;
