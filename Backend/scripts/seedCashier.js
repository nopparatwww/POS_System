require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/product.js');
const Discount = require('../models/discount.js');

const MONGO = process.env.MONGO_URI;

const products = [
  { sku: '0001', name: 'Coca Cola 330ml', barcode: '0001', price: 1.5, stock: 100 },
  { sku: '0002', name: 'Pepsi 330ml', barcode: '0002', price: 1.4, stock: 80 },
  { sku: '0003', name: 'Bottled Water 500ml', barcode: '0003', price: 0.9, stock: 200 },
  { sku: '1001', name: 'Sandwich Ham', barcode: '1001', price: 2.5, stock: 40 }
];

const discounts = [
  { name: 'No Discount', type: 'fixed', value: 0 },
  { name: 'Member 10% off', type: 'percent', value: 10 },
  { name: 'Promo $0.50 off', type: 'fixed', value: 0.5 }
];

mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected, seeding..');
    await Product.deleteMany({});
    await Discount.deleteMany({});
    await Product.insertMany(products);
    await Discount.insertMany(discounts);
    console.log('Seed finished');
    process.exit(0);
  })
  .catch(err => {
    console.error('Seed error', err);
    process.exit(1);
  });
