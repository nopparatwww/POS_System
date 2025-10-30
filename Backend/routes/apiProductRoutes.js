const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const authenticateToken = require('../middleware/authMiddleware');
const ensurePermission = require('../middleware/ensurePermission');
const ensureWithinShift = require('../middleware/ensureWithinShift');
const ActivityLog = require('../models/activityLog');

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

    try {
      await ActivityLog.create({
        action: 'product.create',
        actorUsername: req.user?.username, actorRole: req.user?.role,
        method: req.method, path: req.originalUrl, status: 201,
        details: { sku: doc.sku, name: doc.name }
      });
    } catch {}

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

    try {
      await ActivityLog.create({
        action: 'product.update',
        actorUsername: req.user?.username, actorRole: req.user?.role,
        method: req.method, path: req.originalUrl, status: 200,
        details: { id: String(doc._id) }
      });
    } catch {}

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

    try {
      await ActivityLog.create({
        action: 'product.delete',
        actorUsername: req.user?.username, actorRole: req.user?.role,
        method: req.method, path: req.originalUrl, status: 200,
        details: { id: String(doc._id), sku: doc.sku }
      });
    } catch {}

    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
