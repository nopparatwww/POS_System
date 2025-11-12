const express = require('express');
const router = express.Router();
const Discount = require('../models/discount');

router.get('/', async (req, res) => {
  try {
    const discounts = await Discount.find();
    res.json(discounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// add discount
router.post('/', async (req, res) => {
  try {
    const d = new Discount(req.body);
    await d.save();
    res.status(201).json(d);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
