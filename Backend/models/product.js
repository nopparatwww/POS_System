const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sku:   { type: String, required: true, unique: true, index: true },
  name:  { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0 },
  barcode:  { type: String },
  category: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);