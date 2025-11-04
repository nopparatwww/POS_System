// Backend/models/stockOutLog.js
const mongoose = require('mongoose');

const stockOutLogSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    
    // Denormalized data
    productName: { type: String, required: true },
    sku: { type: String },
    
    // Stock Out details
    quantity: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true }, // เหตุผลการเบิก (ของเสีย, ใช้ภายใน)
    
    actorUsername: { type: String, required: true },
  },
  { timestamps: true }
);

stockOutLogSchema.index({ createdAt: -1 });
stockOutLogSchema.index({ product: 1 });

module.exports = mongoose.model('stockOutLog', stockOutLogSchema);