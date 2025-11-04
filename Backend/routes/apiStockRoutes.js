const express = require('express');
const router = express.Router();
const Product = require('../models/product'); // <--- ดึงข้อมูล Product มาใช้
const StockInLog = require('../models/stockInLog'); // <--- ดึง Log ที่สร้างใหม่มาใช้
const StockOutLog = require('../models/stockOutLog');
const ActivityLog = require('../models/activityLog'); // <--- Log กลางของระบบ
const authenticateToken = require('../middleware/authMiddleware');
const ensurePermission = require('../middleware/ensurePermission');
const ensureWithinShift = require('../middleware/ensureWithinShift');

// กำหนดสิทธิ์สำหรับฟีเจอร์นี้
const STOCK_IN_PERMISSION = ['admin.stockin', 'warehouse.stockin'];
const STOCK_OUT_PERMISSION = ['admin.stockout', 'warehouse.stockout'];
// --- API หลัก: บันทึกการรับสินค้าเข้า ---
// POST /api/protect/stock/in
router.post('/in', authenticateToken, ensureWithinShift, ensurePermission(STOCK_IN_PERMISSION), async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const { username, role } = req.user; // มาจาก JWT

    // 1. ตรวจสอบข้อมูลเข้า
    if (!productId || !quantity) {
      return res.status(400).json({ message: 'productId, quantity เป็นฟิลด์บังคับ' });
    }
    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      return res.status(400).json({ message: 'Quantity (จำนวน) ต้องเป็นบวก' });
    }

    // 2. อัปเดตสต็อกสินค้าหลัก (Product)
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        $inc: { stock: numQty },   // <-- เพิ่มสต็อก (Increment)
      },
      { new: true, runValidators: true } // `new: true` เพื่อรับเอกสาร Product ที่อัปเดตแล้วกลับมา
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'ไม่พบสินค้า (Product) ที่ระบุ' });
    }

    // 3. สร้าง Log การรับเข้า (StockInLog)
    const stockLog = await StockInLog.create({
      product: updatedProduct._id,
      productName: updatedProduct.name, // คัดลอกชื่อมาเก็บ
      sku: updatedProduct.sku,         // คัดลอก SKU มาเก็บ
      quantity: updatedProduct.stock,
      actorUsername: username,
    });

    // 4. (Optional) สร้าง Log กลาง (ActivityLog)
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
    const logs = await StockInLog.find()
      .sort({ createdAt: -1 }) // เรียงใหม่สุดก่อน
      .limit(20) // เอาแค่ 20 รายการล่าสุด
      .populate('product', 'name sku')
      .lean(); // .lean() เพื่อให้อ่านข้อมูลเร็วขึ้น
    
    res.json(logs);
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
    const logs = await StockOutLog.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('product', 'name sku') // <-- ใช้ .populate() เพื่อดึงชื่อสด
      .lean();
    
    res.json(logs);
  } catch (e) {
    console.error('Get Stock Out Logs Error:', e);
    res.status(500).json({ message: 'Server error fetching stock out logs.' });
  }
});

module.exports = router;