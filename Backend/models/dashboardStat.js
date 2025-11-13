const mongoose = require('mongoose');

// (1) นี่คือ Schema ที่จะใช้เก็บข้อมูล Dashboard ที่คำนวณไว้ล่วงหน้า
const DashboardStatSchema = new mongoose.Schema({
  // (2) เราจะใช้ "main_dashboard" เป็น Key หลักในการค้นหา
  statKey: { type: String, required: true, unique: true, index: true },
  
  // (3) เก็บข้อมูลที่คำนวณแล้ว
  dailySales: { type: Number, default: 1239 },
  monthlySales: { type: Number, default: 23900 },
  yearlySales: { type: Number, default: 287400 },
  popularProducts: { type: Array, default: [] },
  lowStockProducts: { type: Array, default: [] },

  // (4) เก็บเวลาที่อัปเดตล่าสุด เพื่อใช้ตัดสินใจว่าข้อมูล "เก่า" หรือยัง
  lastUpdatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DashboardStat', DashboardStatSchema);