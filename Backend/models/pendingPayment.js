const mongoose = require("mongoose");

const PendingPaymentSchema = new mongoose.Schema({
  paymentIntentId: { type: String, index: true, unique: true },
  method: { type: String, enum: ["qr", "card"], default: "qr" },
  saleDraft: {
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        sku: String,
        name: String,
        unitPrice: Number,
        qty: Number,
      },
    ],
    subtotal: Number,
    discount: Number,
    vat: Number,
    total: Number,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  cashierName: String,
  status: {
    type: String,
    enum: ["pending", "processed", "failed"],
    default: "pending",
  },
  meta: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
  processedAt: Date,
});

module.exports =
  mongoose.models.PendingPayment ||
  mongoose.model("PendingPayment", PendingPaymentSchema);
