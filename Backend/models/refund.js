const mongoose = require("mongoose");

const RefundItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    // Some legacy sales do not have productId recorded; allow null in refunds
    required: false,
    default: null,
  },
  name: { type: String, required: true },
  unitPrice: { type: Number, required: true },
  originalQty: { type: Number, required: true },
  returnQty: { type: Number, required: true },
  reason: { type: String, required: true },
  // Store computed refund per line for convenience
  lineRefund: { type: Number, default: 0 },
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