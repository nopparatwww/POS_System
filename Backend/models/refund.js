const mongoose = require("mongoose");

const RefundItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: { type: String, required: true },
  unitPrice: { type: Number, required: true },
  originalQty: { type: Number, required: true },
  returnQty: { type: Number, required: true },
  reason: { type: String, required: true },
});

const RefundSchema = new mongoose.Schema({
  saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
  invoiceNo: { type: String, required: true },
  refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  items: [RefundItemSchema],
  totalRefund: Number,
  createdAt: { type: Date, default: Date.now },
});

RefundSchema.index({ invoiceNo: 1 });

module.exports =
  mongoose.models.Refund || mongoose.model("Refund", RefundSchema);