const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const crypto = require("crypto");
const Sale = require("../models/sale");
const Product = require("../models/product");
const authenticateToken = require("../middleware/authMiddleware");
const ensurePermission = require("../middleware/ensurePermission");

// 🔹 robust invoice generator
function genInvoiceNo() {
  const d = new Date();
  const rand = crypto.randomBytes(2).toString("hex"); // 4-char hex
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(d.getDate()).padStart(2, "0")}-${rand}`;
}

// 🔸 POST /api/protect/sales
router.post(
  "/",
  authenticateToken,
  ensurePermission("sales.create"),
  async (req, res) => {
    console.log("Sale POST req.body:", JSON.stringify(req.body, null, 2));
    try {
      const {
        items = [],
        subtotal = 0,
        discount = 0,
        vat = 0,
        total = 0,
        payment = {},
        paymentIntentId, // optional: allow direct mapping for webhook-created sales lookup
      } = req.body;

      if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ message: "No items" });

      // 🔹 validate and reduce stock
      for (const it of items) {
        if (it.productId) {
          const p = await Product.findById(it.productId);
          if (!p)
            return res
              .status(400)
              .json({ message: `Invalid product ${it.name}` });
          if (typeof p.stock === "number" && p.stock < (it.qty || 0)) {
            return res
              .status(400)
              .json({ message: `Insufficient stock for ${it.name}` });
          }
          if (typeof p.stock === "number") {
            p.stock = p.stock - (it.qty || 0);
            await p.save();
          }
        }
      }

      const normalizedPayment = {
        method: String(req.body.payment?.method || "cash").toLowerCase(),
        amountReceived: Number(req.body.payment?.amountReceived ?? 0),
        change: Number(req.body.payment?.change ?? 0),
        details: req.body.payment?.details || {},
      };
      console.log(
        "Normalized payment:",
        JSON.stringify(normalizedPayment, null, 2)
      );

      // validate items
      if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ message: "No items" });

      if (
        !items.every((it) => it.name && it.qty != null && it.unitPrice != null)
      ) {
        return res
          .status(400)
          .json({ message: "Invalid items: missing name/qty/unitPrice" });
      }
      console.log("Creating sale with:", normalizedPayment);
      const sale = await Sale.create({
        invoiceNo: genInvoiceNo(), // ต้องมี
        createdBy: req.user?.userId,
        cashierName: req.user?.username || req.user?.name || "unknown",
        items: items.map((it) => ({
          productId: it.productId || null,
          sku: it.sku || "",
          name: it.name,
          unitPrice: Number(it.unitPrice),
          qty: Number(it.qty),
          lineTotal: Number(it.unitPrice || 0) * Number(it.qty || 0),
        })),
        subtotal: Number(subtotal),
        discount: Number(discount),
        vat: Number(vat),
        total: Number(total),
        payment: normalizedPayment, // ต้องมี
        meta: paymentIntentId ? { paymentIntentId } : undefined,
      });

      res.status(201).json({
        saleId: sale._id,
        invoiceNo: sale.invoiceNo,
        payment: sale.payment,
        sale,
      });
    } catch (err) {
      console.error(err);
      if (err.code === 11000) {
        return res.status(409).json({ message: "Duplicate invoice number" });
      }
      res.status(500).json({ message: "Server error" });
    }
  }
);

// 🔸 GET /api/protect/sales/:id
router.get(
  "/:id",
  authenticateToken,
  ensurePermission("sales.view"),
  async (req, res) => {
    try {
      let sale = await Sale.findById(req.params.id)
        .select("invoiceNo createdAt items subtotal discount vat total payment")
        .lean();
      if (!sale) return res.status(404).json({ message: "Not found" });
      // Enrich legacy items that lack unitPrice/lineTotal using Product.price as fallback
      if (Array.isArray(sale.items) && sale.items.length > 0) {
        const enriched = await Promise.all(
          sale.items.map(async (it) => {
            const qty = Number(it.qty) || 0;
            // try existing fields first
            let unit = undefined;
            if (it.unitPrice != null && !isNaN(it.unitPrice))
              unit = Number(it.unitPrice);
            else if (it.lineTotal != null && qty > 0)
              unit = Number(it.lineTotal) / qty;
            // fallback by fetching product.price
            if ((unit == null || isNaN(unit)) && it.productId) {
              try {
                const p = await Product.findById(it.productId)
                  .select("price")
                  .lean();
                if (p && p.price != null && !isNaN(p.price))
                  unit = Number(p.price);
              } catch (e) {
                // ignore
              }
            }
            if (unit == null || isNaN(unit)) unit = 0;
            const lineTotal = unit * qty;
            return { ...it, unitPrice: unit, lineTotal };
          })
        );
        sale = { ...sale, items: enriched };
      }
      res.json(sale);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// 🔸 GET /api/protect/sales (search + pagination)
router.get(
  "/",
  authenticateToken,
  ensurePermission("sales.view"),
  async (req, res) => {
    try {
      const {
        receipt,
        product,
        from,
        to,
        query: q,
        page = 1,
        limit = 25,
      } = req.query;
      const query = {};

      // 🔹 receipt: match invoiceNo or _id
      if (receipt) {
        if (mongoose.isValidObjectId(receipt)) {
          query.$or = [
            { invoiceNo: { $regex: receipt, $options: "i" } },
            { _id: mongoose.Types.ObjectId(receipt) },
          ];
        } else {
          query.invoiceNo = { $regex: receipt, $options: "i" };
        }
      }

      // 🔹 product name
      if (product) {
        query.items = {
          $elemMatch: { name: { $regex: product, $options: "i" } },
        };
      }

      // 🔹 general search (query)
      if (q) {
        query.$or = [
          { invoiceNo: { $regex: q, $options: "i" } },
          { "payment.method": { $regex: q, $options: "i" } },
          { "items.name": { $regex: q, $options: "i" } },
        ];
      }

      // 🔹 date range
      if (from || to) {
        query.createdAt = {};
        if (from) query.createdAt.$gte = new Date(from);
        if (to) {
          const toDate = new Date(to);
          toDate.setHours(23, 59, 59, 999);
          query.createdAt.$lte = toDate;
        }
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [rows, total] = await Promise.all([
        Sale.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .select("invoiceNo createdAt total payment cashierName")
          .lean(),
        Sale.countDocuments(query),
      ]);

      res.json({ rows, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;

// Extra endpoint: lookup sale by Stripe PaymentIntent ID
// GET /api/protect/sales/by-intent/:id
router.get(
  "/by-intent/:id",
  authenticateToken,
  ensurePermission("sales.view"),
  async (req, res) => {
    try {
      const pid = req.params.id;
      if (!pid) return res.status(400).json({ message: "Missing intent id" });
      const sale = await Sale.findOne({
        "payment.details.paymentIntentId": pid,
      })
        .select("invoiceNo createdAt items subtotal discount vat total payment")
        .lean();
      if (!sale) return res.status(404).json({ message: "Not found" });
      return res.json(sale);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Server error" });
    }
  }
);
