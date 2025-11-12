const mongoose = require('mongoose');

const DiscountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['percent','fixed'], default: 'percent' },
  value: { type: Number, required: true }, // percent (e.g., 10 means 10%) or fixed amount
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Discount', DiscountSchema);
