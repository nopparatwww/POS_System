const mongoose = require("mongoose");

// Legacy cashier sale schema (deprecated)
// IMPORTANT: Use a distinct model name to avoid clashing with the main `Sale` model.
const CashierLegacySaleSchema = new mongoose.Schema({
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      name: String,
      qty: Number,
      price: Number,
      total: Number,
    },
  ],
  subtotal: Number,
  discount: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discount",
      required: false,
    },
    name: String,
    type: String,
    value: Number,
    amount: Number, // amount discounted
  },
  vat: Number,
  total: Number,
  paymentMethod: String,
  paymentDetails: Object, // e.g., {amountReceived, change, phone}
  createdAt: { type: Date, default: Date.now },
});

// Use a unique model name to prevent overwriting the main Sale model
module.exports =
  mongoose.models.CashierLegacySale ||
  mongoose.model("CashierLegacySale", CashierLegacySaleSchema);