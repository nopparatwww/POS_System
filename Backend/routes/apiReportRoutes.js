const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const Sale = require('../models/sale');
const User = require('../models/user');
const Refund = require('../models/refund');
const StockInLog = require('../models/stockInLog');
const StockOutLog = require('../models/stockOutLog');
const StockAuditLog = require('../models/stockAuditLog');
const authenticateToken = require('../middleware/authMiddleware');
const ensurePermission = require('../middleware/ensurePermission');
const ensureWithinShift = require('../middleware/ensureWithinShift');
const mongoose = require('mongoose');

const REPORT_PERMISSION = ['admin.reports', 'warehouse.reports'];
const ADMIN_REPORT_PERMISSION = ['admin.reports', 'admin.dashboard'];

// --- API: Get Stats (สำหรับ 4 การ์ด) ---
// GET /api/protect/reports/stats
router.get('/stats', authenticateToken, ensureWithinShift, ensurePermission(REPORT_PERMISSION), async (req, res) => {
  try {
    const [totalProducts, totalValueResult, lowStock, outOfStock] = await Promise.all([
      // 1. Total Products
      Product.countDocuments(),
      
      // 2. Total Value of Inventory
      Product.aggregate([
        { $match: { stock: { $gt: 0 } } },
        { $group: {
            _id: null,
            totalValue: { $sum: { $multiply: [ "$stock", "$price" ] } }
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

router.get('/sales-summary', authenticateToken, ensureWithinShift, ensurePermission(ADMIN_REPORT_PERMISSION), async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const salesData = await Sale.aggregate([
      {
        $facet: {
          // คำนวณยอดรวมวันนี้
          daily: [
            { $match: { createdAt: { $gte: todayStart } } },
            { $group: { _id: 'daily', total: { $sum: '$total' } } }
          ],
          // คำนวณยอดรวมเดือนนี้
          monthly: [
            { $match: { createdAt: { $gte: monthStart } } },
            { $group: { _id: 'monthly', total: { $sum: '$total' } } }
          ],
          // คำนวณยอดรวมปีนี้
          yearly: [
            { $match: { createdAt: { $gte: yearStart } } },
            { $group: { _id: 'yearly', total: { $sum: '$total' } } }
          ]
        }
      }
    ]);

    res.json({
      daily: salesData[0]?.daily[0]?.total || 0,
      monthly: salesData[0]?.monthly[0]?.total || 0,
      yearly: salesData[0]?.yearly[0]?.total || 0
    });

  } catch (e) {
    console.error('Get Sales Summary Error:', e);
    res.status(500).json({ message: 'Server error fetching sales summary.' });
  }
});

// GET /api/protect/reports/popular-products
router.get('/popular-products', authenticateToken, ensureWithinShift, ensurePermission(ADMIN_REPORT_PERMISSION), async (req, res) => {
  try {
    const popular = await Sale.aggregate([
      { $unwind: '$items' }, // แตก array items ออกมาเป็นแถวละ 1 item
      { $group: {
          _id: '$items.productId', // จัดกลุ่มตาม ID สินค้า
          name: { $first: '$items.name' }, // เอาชื่อแรกที่เจอ
          totalQty: { $sum: '$items.qty' } // สรุปยอดขาย (จำนวนชิ้น)
      }},
      { $sort: { totalQty: -1 } }, // เรียงจากมากไปน้อย
      { $limit: 5 }, // เอาแค่ 5 อันดับแรก
      { $lookup: { // Join กลับไปที่ collection 'products' เพื่อเอาข้อมูลล่าสุด
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productData'
      }},
      { $unwind: { path: '$productData', preserveNullAndEmptyArrays: true } }, // แตก array ที่ join มา
      { $project: {
          _id: 1,
          name: '$name', // ใช้ชื่อจาก Sale item (เผื่อสินค้าถูกลบ)
          totalQty: 1,
          status: '$productData.status', // สถานะปัจจุบัน
          price: '$productData.price', // ราคาปัจจุบัน
          stock: '$productData.stock' // สต็อกปัจจุบัน
      }}
    ]);
    
    res.json(popular);

  } catch (e) {
    console.error('Get Popular Products Error:', e);
    res.status(500).json({ message: 'Server error fetching popular products.' });
  }
});

// GET /api/protect/reports/sales-series
// Returns time series totals of sales for a given range: day|week|month|year
router.get('/sales-series', authenticateToken, ensureWithinShift, ensurePermission(ADMIN_REPORT_PERMISSION), async (req, res) => {
  try {
    const range = String(req.query.range || 'day').toLowerCase();
    const now = new Date();

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    function startOfWeek(date) {
      const d = new Date(date);
      const day = (d.getDay() + 6) % 7; // Monday=0
      d.setHours(0,0,0,0);
      d.setDate(d.getDate() - day);
      return d;
    }

    let matchStart;
    let groupStage;
    let labels = [];

    if (range === 'year') {
      matchStart = yearStart;
      groupStage = { $group: { _id: { $month: '$createdAt' }, total: { $sum: '$total' } } };
      labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    } else if (range === 'month') {
      matchStart = monthStart;
      groupStage = { $group: { _id: { $dayOfMonth: '$createdAt' }, total: { $sum: '$total' } } };
      const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
      labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
    } else if (range === 'week') {
      matchStart = startOfWeek(now);
      groupStage = { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$total' } } };
      const d0 = new Date(matchStart);
      labels = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(d0);
        d.setDate(d0.getDate() + i);
        const dd = String(d.getDate()).padStart(2,'0');
        const mm = String(d.getMonth()+1).padStart(2,'0');
        return `${dd}/${mm}`;
      });
    } else { // day
      matchStart = todayStart;
      groupStage = { $group: { _id: { $hour: '$createdAt' }, total: { $sum: '$total' } } };
      labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    }

    // Aggregate
    const raw = await Sale.aggregate([
      { $match: { createdAt: { $gte: matchStart } } },
      groupStage,
      { $sort: { _id: 1 } }
    ]);

    // Map to array aligned with labels
    let values;
    if (range === 'week') {
      // build map by YYYY-MM-DD
      const map = new Map();
      for (const r of raw) map.set(r._id, r.total || 0);
      const d0 = new Date(matchStart);
      values = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(d0);
        d.setDate(d0.getDate() + i);
        const key = d.toISOString().slice(0,10);
        return Number(map.get(key) || 0);
      });
    } else if (range === 'month') {
      const map = new Map();
      for (const r of raw) map.set(String(r._id), r.total || 0);
      values = labels.map((_, idx) => Number(map.get(String(idx+1)) || 0));
    } else if (range === 'year') {
      const map = new Map();
      for (const r of raw) map.set(Number(r._id), r.total || 0);
      values = Array.from({ length: 12 }, (_, i) => Number(map.get(i+1) || 0));
    } else {
      const map = new Map();
      for (const r of raw) map.set(Number(r._id), r.total || 0);
      values = Array.from({ length: 24 }, (_, i) => Number(map.get(i) || 0));
    }

    res.json({ range, labels, values });
  } catch (e) {
    console.error('Get Sales Series Error:', e);
    res.status(500).json({ message: 'Server error fetching sales series.' });
  }
});

// GET /api/protect/reports/staff-stats
// Returns counts of users and role distribution, and quick today metrics
router.get('/staff-stats', authenticateToken, ensureWithinShift, ensurePermission(ADMIN_REPORT_PERMISSION), async (req, res) => {
  try {
    const now = new Date();
    const range = String(req.query.range || 'day').toLowerCase(); // day|week|month|year
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    function startOfWeek(date) {
      // Treat Monday as first day of week
      const d = new Date(date);
      const day = (d.getDay() + 6) % 7; // 0..6 with Monday=0
      d.setHours(0,0,0,0);
      d.setDate(d.getDate() - day);
      return d;
    }
    let activityStart;
    if (range === 'week') activityStart = startOfWeek(now);
    else if (range === 'month') activityStart = monthStart;
    else if (range === 'year') activityStart = yearStart;
    else activityStart = todayStart; // default day

    const [totalUsers, byRoleAgg, newUsersToday, newUsersMonth, salesCount, refundsCount, shiftUsers] = await Promise.all([
      User.countDocuments(),
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      User.countDocuments({ createdAt: { $gte: monthStart } }),
      Sale.countDocuments({ createdAt: { $gte: activityStart } }),
      Refund.countDocuments({ createdAt: { $gte: activityStart } }),
      User.find({ shiftStart: { $ne: null }, shiftEnd: { $ne: null } }).select('shiftStart shiftEnd').lean(),
    ]);

    const roles = { admin: 0, cashier: 0, warehouse: 0 };
    for (const r of byRoleAgg) {
      if (r && typeof r._id === 'string') {
        roles[r._id] = r.count;
      }
    }

    // Compute current active within shift based on HH:mm strings vs local time
    const nowMinutes = (() => {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    })();
    function toMinutes(hhmm) {
      if (!hhmm || typeof hhmm !== 'string') return null;
      const m = hhmm.trim().split(':');
      const h = Number(m[0]);
      const mi = Number(m[1] || 0);
      if (Number.isNaN(h) || Number.isNaN(mi)) return null;
      return h * 60 + mi;
    }
    let activeWithinShiftNow = 0;
    for (const u of shiftUsers) {
      const s = toMinutes(u.shiftStart);
      const e = toMinutes(u.shiftEnd);
      if (s == null || e == null) continue;
      if (s <= e) {
        // normal same-day shift window
        if (nowMinutes >= s && nowMinutes <= e) activeWithinShiftNow++;
      } else {
        // overnight window (e.g., 22:00 -> 06:00)
        if (nowMinutes >= s || nowMinutes <= e) activeWithinShiftNow++;
      }
    }

    res.json({
      totalUsers,
      roles,
      newUsersToday,
      newUsersThisMonth: newUsersMonth,
      // Activity counts for the selected range
      range,
      salesCount,
      refundsCount,
      activeWithinShiftNow,
    });
  } catch (e) {
    console.error('Get Staff Stats Error:', e);
    res.status(500).json({ message: 'Server error fetching staff stats.' });
  }
});

router.get('/movement', authenticateToken, ensureWithinShift, ensurePermission(REPORT_PERMISSION), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    // เตรียมข้อมูลจาก StockInLog
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

    //ใช้ $unionWith เพื่อรวม Log อื่นๆ
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
    ]);

    const [inResults, outAndAuditResults] = await Promise.all([
        inLogs.exec(),
        aggregation.exec()
    ]);
    
    const allMovements = [...inResults, ...outAndAuditResults];
    allMovements.sort((a, b) => b.date.getTime() - a.date.getTime()); // เรียงใหม่สุดก่อน

    const total = allMovements.length;
    const items = allMovements.slice((page - 1) * limit, page * limit);

    res.json({ page, limit, total, items });

  } catch (e) {
    console.error('Get Movement Error:', e);
    res.status(500).json({ message: 'Server error fetching movement.' });
  }
});


module.exports = router;