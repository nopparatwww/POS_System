const express = require("express");
const router = express.Router();
const Refund = require("../models/refund");
const authenticateToken = require("../middleware/authMiddleware");
const ensurePermission = require("../middleware/ensurePermission");

// 🔸 POST /api/protect/refunds
router.post(
  "/",
  authenticateToken,
  ensurePermission("refunds.create"),
  async (req, res) => {
    try {
      const { saleId, invoiceNo, items = [] } = req.body;

      if (!saleId || !invoiceNo || items.length === 0) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const totalRefund = items.reduce(
        (sum, it) =>
          sum + Number(it.unitPrice || 0) * Number(it.returnQty || 0),
        0
      );

      const refund = await Refund.create({
        saleId,
        invoiceNo,
        refundedBy: req.user?.userId,
        items: items
          .filter((it) => Number(it.returnQty) > 0)
          .map((it) => ({
            productId: it.productId,
            name: it.name,
            unitPrice: Number(it.unitPrice),
            originalQty: Number(it.originalQty),
            returnQty: Number(it.returnQty),
            reason: it.reason,
            lineRefund: Number(it.unitPrice || 0) * Number(it.returnQty || 0),
          })),
        totalRefund,
      });

      res.status(201).json({
        message: "Refund created successfully",
        refundId: refund._id,
        refund,
      });
    } catch (err) {
      console.error("Refund POST error:", err);
      if (err?.name === "ValidationError") {
        // Flatten Mongoose validation messages
        const details = Object.values(err.errors || {}).map((e) => e.message);
        return res.status(400).json({ message: "Validation failed", details });
      }
      res.status(500).json({ message: "Server error" });
    }
  }
);

// 🔸 GET /api/protect/refunds (history)
router.get(
  "/",
  authenticateToken,
  ensurePermission("refunds.view"),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 25,
        search = "",
        startDate,
        endDate,
      } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const query = {};

      if (search) {
        query.$or = [
          { invoiceNo: { $regex: search, $options: "i" } },
          { "items.name": { $regex: search, $options: "i" } },
        ];
      }

      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const [rows, total] = await Promise.all([
        Refund.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .select("invoiceNo totalRefund createdAt refundedBy")
          .populate("refundedBy", "username name")
          .lean(),
        Refund.countDocuments(query),
      ]);

      res.json({ rows, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
      console.error("Refund GET error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// 🔸 GET /api/protect/refunds/:id (view single refund)
router.get(
  "/:id",
  authenticateToken,
  ensurePermission("refunds.view"),
  async (req, res) => {
    try {
      const refund = await Refund.findById(req.params.id)
        .populate("refundedBy", "username name")
        .populate("items.productId", "name price")
        .populate("saleId", "invoiceNo total") // ถ้าอยากดูใบขายเดิม
        .lean();
      if (!refund) return res.status(404).json({ message: "Not found" });
      res.json(refund);
    } catch (err) {
      console.error("Refund GET/:id error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;