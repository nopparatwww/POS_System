const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const StockInLog = require('../models/stockInLog');
const StockOutLog = require('../models/stockOutLog');
const StockAuditLog = require('../models/stockAuditLog');
const authenticateToken = require('../middleware/authMiddleware');
const ensurePermission = require('../middleware/ensurePermission');
const ensureWithinShift = require('../middleware/ensureWithinShift');
const mongoose = require('mongoose');

const REPORT_PERMISSION = ['admin.reports', 'warehouse.reports'];

// --- API: Get Stats (สำหรับ 4 การ์ด) ---
// GET /api/protect/reports/stats
router.get('/stats', authenticateToken, ensureWithinShift, ensurePermission(REPORT_PERMISSION), async (req, res) => {
  try {
    const [totalProducts, totalValueResult, lowStock, outOfStock] = await Promise.all([
      // 1. Total Products
      Product.countDocuments(),
      
      // 2. Total Value (Stock * Cost)
      Product.aggregate([
        { $match: { stock: { $gt: 0 } } },
        { $group: {
            _id: null,
            totalValue: { $sum: { $multiply: [ "$stock", "$cost" ] } }
        }}
      ]),
      
      // 3. Low Stock Items
      Product.countDocuments({ $expr: { $lt: [ "$stock", "$reorderLevel" ] } }),
      
      // 4. Out of Stock
      Product.countDocuments({ stock: { $lte: 0 } })
    ]);

    const totalValue = totalValueResult.length > 0 ? totalValueResult[0].totalValue : 0;

    res.json({
      totalProducts,
      totalValue,
      lowStock,
      outOfStock
    });

  } catch (e) {
    console.error('Get Stats Error:', e);
    res.status(500).json({ message: 'Server error fetching stats.' });
  }
});


// --- API: Get Stock Movement (สำหรับตาราง) ---
// GET /api/protect/reports/movement
router.get('/movement', authenticateToken, ensureWithinShift, ensurePermission(REPORT_PERMISSION), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    // 1. เตรียมข้อมูลจาก StockInLog
    const inLogs = StockInLog.aggregate([
      {
        $project: {
          date: "$createdAt",
          productId: "$product",
          productName: "$productName",
          sku: "$sku",
          type: "Stock In",
          quantity: "$quantity", // นี่คือ Delta (เช่น +24)
          reference: "$reference",
          user: "$actorUsername"
        }
      }
    ]);

    // 2. ใช้ $unionWith เพื่อรวม Log อื่นๆ
    const aggregation = StockOutLog.aggregate([
      {
        $project: {
          date: "$createdAt",
          productId: "$product",
          productName: "$productName",
          sku: "$sku",
          type: "Stock Out",
          quantity: { $multiply: ["$quantity", -1] }, // <-- ทำให้เป็นค่าลบ
          reference: "$reason", // <-- ใช้ Reason เป็น Reference
          user: "$actorUsername"
        }
      },
      {
        $unionWith: {
          coll: "stockauditlogs", // ชื่อ collection ของ StockAuditLog
          pipeline: [
            {
              $project: {
                date: "$createdAt",
                productId: "$product",
                productName: "$productName",
                sku: "$sku",
                type: "Audit",
                quantity: "$quantity", // นี่คือ Delta (เช่น -3 หรือ +5)
                reference: { $concat: ["System: ", { $toString: "$systemStock" }, ", Actual: ", { $toString: "$actualStock" }] },
                user: "$actorUsername"
              }
            }
          ]
        }
      },
      // (สามารถ $unionWith: inLogs ที่นี่ได้ แต่ Mongoose V. เก่าๆ อาจมีปัญหา)
      // (เราจะรวมผลลัพธ์ใน JS เพื่อความปลอดภัย)

      // 3. เรียงลำดับ, แบ่งหน้า
      // (ย้ายไปทำใน $facet หลังจากรวม InLogs)
    ]);

    // รัน 2 aggregations พร้อมกัน
    const [inResults, outAndAuditResults] = await Promise.all([
        inLogs.exec(),
        aggregation.exec()
    ]);
    
    // 4. รวมผลลัพธ์ใน JS และเรียงลำดับ
    const allMovements = [...inResults, ...outAndAuditResults];
    allMovements.sort((a, b) => b.date.getTime() - a.date.getTime()); // เรียงใหม่สุดก่อน

    // 5. แบ่งหน้า (Manual Pagination)
    const total = allMovements.length;
    const items = allMovements.slice((page - 1) * limit, page * limit);

    // 6. (Optional) Populate ข้อมูลสินค้า (กรณี Log เก่าไม่มี productName/sku)
    // (ข้ามไปก่อนเพื่อความรวดเร็ว เนื่องจากเรา Denormalize ไว้แล้ว)

    res.json({ page, limit, total, items });

  } catch (e) {
    console.error('Get Movement Error:', e);
    res.status(500).json({ message: 'Server error fetching movement.' });
  }
});


module.exports = router;