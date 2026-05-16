const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    category: { type: String },
    price: { type: Number, required: true, min: 0 },
    cost: { type: Number, default: 0, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "ชิ้น" },
    barcode: { type: String },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    reorderLevel: { type: Number, default: 5 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true }
);

// Helpful indexes for frequent queries
productSchema.index({ barcode: 1 });
productSchema.index({ createdAt: 1 });
productSchema.index({ createdBy: 1 });
productSchema.index({ name: "text", sku: "text" });

module.exports = mongoose.model("Product", productSchema);
