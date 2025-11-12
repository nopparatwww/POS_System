const mongoose = require("mongoose");

const SaleItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: false,
  },
  sku: String,
  name: String,
  unitPrice: Number,
  qty: Number,
  lineTotal: Number,
});

const PaymentSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ["cash", "card", "qr", "wallet"],
    required: true,
  },
  amountReceived: Number,
  change: Number,
  details: mongoose.Schema.Types.Mixed,
});

const SaleSchema = new mongoose.Schema({
  invoiceNo: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  cashierName: String,
  items: [SaleItemSchema],
  subtotal: Number,
  discount: Number,
  vat: Number,
  total: Number,
  payment: PaymentSchema,
  status: {
    type: String,
    enum: ["completed", "refunded"],
    default: "completed",
  },
  createdAt: { type: Date, default: Date.now },
  meta: mongoose.Schema.Types.Mixed,
});

module.exports = mongoose.models.Sale || mongoose.model("Sale", SaleSchema);


