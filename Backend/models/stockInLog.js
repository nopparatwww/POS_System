const mongoose = require('mongoose');

const stockInLogSchema = new mongoose.Schema(
  {
    // อ้างอิงไปยังสินค้าหลัก
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    
    // คัดลอกข้อมูลสินค้ามาเก็บไว้ (Denormalized)
    // เพื่อให้ประวัติคงเดิม แม้สินค้าหลักจะเปลี่ยนชื่อ/SKU ในอนาคต
    productName: { type: String, required: true },
    sku: { type: String },
    
    // รายละเอียดการรับเข้า
    quantity: { type: Number, required: true, min: 0 },
    // costPerUnit: { type: Number, required: true, min: 0 },
    // reference: { type: String }, // เช่น เลขที่ PO
    
    // ผู้ที่ทำการรับเข้า
    actorUsername: { type: String, required: true },
  },
  { timestamps: true } // 'createdAt' จะถูกใช้เป็น 'Date' ของการรับเข้า
);

// Index เพื่อเร่งความเร็วในการดึงข้อมูลล่าสุด
stockInLogSchema.index({ createdAt: -1 });
stockInLogSchema.index({ product: 1 });

module.exports = mongoose.model('StockInLog', stockInLogSchema);