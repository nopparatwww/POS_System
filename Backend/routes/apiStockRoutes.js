const express = require('express');
const router = express.Router();
const Product = require('../models/product'); 
const StockInLog = require('../models/stockInLog'); 
const StockOutLog = require('../models/stockOutLog');
const StockAuditLog = require('../models/stockAuditLog');
const ActivityLog = require('../models/activityLog'); 
const authenticateToken = require('../middleware/authMiddleware');
const ensurePermission = require('../middleware/ensurePermission');
const ensureWithinShift = require('../middleware/ensureWithinShift');

const STOCK_IN_PERMISSION = ['admin.stockin', 'warehouse.stockin'];
const STOCK_OUT_PERMISSION = ['admin.stockout', 'warehouse.stockout'];
const STOCK_AUDIT_PERMISSION = ['admin.audit', 'warehouse.audit'];
// --- API หลัก: บันทึกการรับสินค้าเข้า ---
// POST /api/protect/stock/in
router.post('/in', authenticateToken, ensureWithinShift, ensurePermission(STOCK_IN_PERMISSION), async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const { username, role } = req.user; // มาจาก JWT
    const numQty = parseFloat(quantity);

    if (!productId || !quantity || isNaN(numQty) || numQty <= 0) {
      return res.status(400).json({ message: 'productId และ quantity (ตัวเลข > 0) เป็นฟิลด์บังคับ' });
    }
   
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $inc: { stock: numQty } },
      { new: true, runValidators: true } 
    );
    if (!updatedProduct) {
      return res.status(404).json({ message: 'ไม่พบสินค้า (Product)' });
    }

    const stockLog = await StockInLog.create({
      product: updatedProduct._id,
      productName: updatedProduct.name, 
      sku: updatedProduct.sku,         
      quantity: numQty, // <--- (แก้ไข) บันทึก "จำนวนที่เพิ่ม" (Delta)
      actorUsername: username,
    });

    try {
      await ActivityLog.create({
        action: 'stock.in',
        actorUsername: username,
        actorRole: role,
        method: req.method,
        path: req.originalUrl,
        status: 201,
        details: {
          productId: updatedProduct._id,
          sku: updatedProduct.sku,
          quantity: numQty,
          newStock: updatedProduct.stock // สต็อกใหม่หลังบวกแล้ว
        }
      });
    } catch (logErr) {
      console.error('Failed to create activity log for stock.in:', logErr);
    }

    // 5. ตอบกลับด้วย Log ที่สร้างใหม่ (Frontend จะใช้แสดงใน 'Recent Entries')
    res.status(201).json(stockLog);

  } catch (e) {
    console.error('Stock In Error:', e);
    res.status(500).json({ message: 'Server error during stock in.' });
  }
});

// --- API ดึงประวัติล่าสุด ---
// GET /api/protect/stock/in/logs
router.get('/in/logs', authenticateToken, ensureWithinShift, ensurePermission(STOCK_IN_PERMISSION), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10)); // Default 10
    const criteria = {}; // (อนาคตสามารถเพิ่ม Filter ตรงนี้ได้)
    const total = await StockInLog.countDocuments(criteria);
    // --- AAA สิ้นสุด Logic การแบ่งหน้า ---

    const logs = await StockInLog.find(criteria) // <-- ใช้ criteria
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit) // <-- เพิ่ม .skip()
      .limit(limit)            // <-- ใช้ limit ที่รับมา
      .populate('product', 'name sku') 
      .lean();
    
    // --- VVV แก้ไขรูปแบบการตอบกลับ VVV ---
    res.json({ page, limit, total, items: logs });
  } catch (e) {
    console.error('Get Stock Logs Error:', e);
    res.status(500).json({ message: 'Server error fetching stock logs.' });
  }
});

router.post('/out', authenticateToken, ensureWithinShift, ensurePermission(STOCK_OUT_PERMISSION), async (req, res) => {
  try {
    const { productId, quantity, reason } = req.body;
    const { username, role } = req.user;

    // 1. Validate input
    if (!productId || !quantity || !reason) {
      return res.status(400).json({ message: 'productId, quantity, และ reason เป็นฟิลด์บังคับ' });
    }
    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      return res.status(400).json({ message: 'Quantity (จำนวน) ต้องเป็นบวก' });
    }
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ message: 'Reason (เหตุผล) ห้ามว่าง' });
    }

    // 2. ค้นหาสินค้า
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'ไม่พบสินค้า (Product) ที่ระบุ' });
    }

    // 3. ตรวจสอบสต็อกคงเหลือ (สำคัญมาก!)
    if (product.stock < numQty) {
      return res.status(400).json({
        message: `ไม่สามารถเบิกออกได้ สต็อกไม่พอ (มี ${product.stock} เบิก ${numQty})`,
        code: 'INSUFFICIENT_STOCK'
      });
    }

    // 4. อัปเดต Product stock (ลดสต็อก)
    // เราใช้ $inc กับค่าลบ เพื่อความปลอดภัย (Atomic)
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $inc: { stock: -numQty } }, // <-- ลดสต็อก
      { new: true, runValidators: true }
    );

    // 5. สร้าง StockOutLog
    const stockLog = await StockOutLog.create({
      product: updatedProduct._id,
      productName: updatedProduct.name, // คัดลอกชื่อ
      sku: updatedProduct.sku,         // คัดลอก SKU
      quantity: numQty,
      reason: reason.trim(),
      actorUsername: username,
    });

    // 6. (Optional) สร้าง ActivityLog กลาง
    try {
      await ActivityLog.create({
        action: 'stock.out',
        actorUsername: username,
        actorRole: role,
        method: req.method,
        path: req.originalUrl,
        status: 201,
        details: {
          productId: updatedProduct._id,
          sku: updatedProduct.sku,
          quantity: numQty,
          reason: reason.trim(),
          newStock: updatedProduct.stock
        }
      });
    } catch (logErr) {
      console.error('Failed to create activity log for stock.out:', logErr);
    }

    res.status(201).json(stockLog);

  } catch (e) {
    console.error('Stock Out Error:', e);
    res.status(500).json({ message: 'Server error during stock out.' });
  }
});

// GET /api/protect/stock/out/logs
// ดึงประวัติการเบิกออกล่าสุด
router.get('/out/logs', authenticateToken, ensureWithinShift, ensurePermission(STOCK_OUT_PERMISSION), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const criteria = {};
    const total = await StockOutLog.countDocuments(criteria);

    const logs = await StockOutLog.find(criteria)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit) 
      .limit(limit)          
      .populate('product', 'name sku')
      .lean();
    
    res.json({ page, limit, total, items: logs });
  } catch (e) {
    console.error('Get Stock Out Logs Error:', e);
    res.status(500).json({ message: 'Server error fetching stock out logs.' });
  }
});

router.post('/audit', authenticateToken, ensureWithinShift, ensurePermission(STOCK_AUDIT_PERMISSION), async (req, res) => {
  try {
    const { productId, actualStock } = req.body;
    const { username, role } = req.user;
    const numActual = parseFloat(actualStock);
    if (!productId || isNaN(numActual) || numActual < 0) {
      return res.status(400).json({ message: 'productId และ actualStock (ตัวเลข >= 0) เป็นฟิลด์บังคับ' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'ไม่พบสินค้า (Product)' });
    }
    const systemStock = product.stock;
    const difference = numActual - systemStock; // ผลต่าง (Delta)

    product.stock = numActual; // Set สต็อกใหม่
    await product.save();

    const auditLog = await StockAuditLog.create({
      product: product._id,
      productName: product.name,
      sku: product.sku,
      systemStock: systemStock,
      actualStock: numActual,
      quantity: difference, // <--- (แก้ไข) บันทึก "ผลต่าง" (Delta)
      actorUsername: username,
    });

    // (ActivityLog ... ไม่ต้องแก้)
    try {
      await ActivityLog.create({
        action: 'stock.audit', actorUsername: username, actorRole: role,
        method: req.method, path: req.originalUrl, status: 201,
        details: { productId: product._id, sku: product.sku, systemStock, actualStock: numActual, difference }
      });
    } catch (logErr) { console.error('Failed to create activity log for stock.audit:', logErr); }

    res.status(201).json(auditLog);

  } catch (e) {
    console.error('Stock Audit Error:', e);
    res.status(500).json({ message: 'Server error during stock audit.' });
  }
});

module.exports = router;