const mongoose = require('mongoose');

const stockAuditLogSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String },
    sku: { type: String },
    systemStock: { type: Number, required: true },
    actualStock: { type: Number, required: true },
    quantity: { type: Number, required: true },  // <-- เปลี่ยนจาก difference
    actorUsername: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockAuditLog', stockAuditLogSchema);