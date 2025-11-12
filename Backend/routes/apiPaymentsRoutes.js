const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const ensurePermission = require("../middleware/ensurePermission");
require("dotenv").config();

// Lazy init stripe; allow backend to run even if key missing (will error when endpoint used)
let stripe = null;
function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY missing in environment");
    stripe = require("stripe")(key);
  }
  return stripe;
}

// Helper to parse amount (expect decimal THB) -> integer satangs
function parseAmountToSatang(amount) {
  const num = Number(amount || 0);
  return Math.round(num * 100);
}

// POST /api/protect/payments/promptpay-intent
// Creates a PaymentIntent for PromptPay (Stripe QR)
router.post(
  "/promptpay-intent",
  authenticateToken,
  ensurePermission("sales.create"),
  async (req, res) => {
    try {
      const { total, invoiceNo, metadata = {}, draft } = req.body;
      console.log("[payments] promptpay-intent body:", req.body);
      const amt = Number(total);
      if (!Number.isFinite(amt) || amt <= 0) {
        return res
          .status(400)
          .json({ message: "total must be a positive number" });
      }
      const stripeClient = getStripe();
      const intent = await stripeClient.paymentIntents.create({
        amount: parseAmountToSatang(amt),
        currency: "thb",
        payment_method_types: ["promptpay"],
        description: `POS Sale ${invoiceNo || ""}`,
        metadata: {
          invoiceNo: invoiceNo || "",
          userId: req.user?.userId || "",
          ...metadata,
        },
      });

      // Persist draft sale data for webhook processing (optional / webhook mode)
      // Guard length of draft JSON to avoid huge metadata usage.
      if (draft && typeof draft === "object") {
        try {
          const PendingPayment = require("../models/pendingPayment");
          await PendingPayment.create({
            paymentIntentId: intent.id,
            method: "qr",
            saleDraft: {
              items: Array.isArray(draft.items) ? draft.items : [],
              subtotal: draft.subtotal,
              discount: draft.discount,
              vat: draft.vat,
              total: draft.total,
            },
            createdBy: req.user?.userId,
            cashierName: req.user?.username || req.user?.name || "unknown",
            meta: { invoiceNo: invoiceNo || "" },
          });
        } catch (persistErr) {
          console.error("Failed to persist PendingPayment draft", persistErr);
        }
      }
      res.json({
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        status: intent.status,
      });
    } catch (err) {
      console.error(
        "[payments] PromptPay intent error:",
        err?.message,
        err?.type || "",
        err
      );
      const code = err?.raw?.code || err?.code;
      const type = err?.type || err?.rawType;
      res
        .status(500)
        .json({ message: "Stripe error", error: err.message, code, type });
    }
  }
);

// POST /api/protect/payments/card-intent
// Creates a PaymentIntent for card; front-end will confirm with Elements
router.post(
  "/card-intent",
  authenticateToken,
  ensurePermission("sales.create"),
  async (req, res) => {
    try {
      const { total, invoiceNo, metadata = {}, draft } = req.body;
      console.log("[payments] card-intent body:", req.body);
      const amt = Number(total);
      if (!Number.isFinite(amt) || amt <= 0) {
        return res
          .status(400)
          .json({ message: "total must be a positive number" });
      }
      const stripeClient = getStripe();
      const intent = await stripeClient.paymentIntents.create({
        amount: parseAmountToSatang(amt),
        currency: "thb",
        payment_method_types: ["card"],
        description: `POS Sale ${invoiceNo || ""}`,
        metadata: {
          invoiceNo: invoiceNo || "",
          userId: req.user?.userId || "",
          ...metadata,
        },
      });

      if (draft && typeof draft === "object") {
        try {
          const PendingPayment = require("../models/pendingPayment");
          await PendingPayment.create({
            paymentIntentId: intent.id,
            method: "card",
            saleDraft: {
              items: Array.isArray(draft.items) ? draft.items : [],
              subtotal: draft.subtotal,
              discount: draft.discount,
              vat: draft.vat,
              total: draft.total,
            },
            createdBy: req.user?.userId,
            cashierName: req.user?.username || req.user?.name || "unknown",
            meta: { invoiceNo: invoiceNo || "" },
          });
        } catch (persistErr) {
          console.error(
            "Failed to persist PendingPayment draft (card)",
            persistErr
          );
        }
      }
      res.json({
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        status: intent.status,
      });
    } catch (err) {
      console.error(
        "[payments] Card intent error:",
        err?.message,
        err?.type || "",
        err
      );
      const code = err?.raw?.code || err?.code;
      const type = err?.type || err?.rawType;
      res
        .status(500)
        .json({ message: "Stripe error", error: err.message, code, type });
    }
  }
);

// GET /api/protect/payments/intent/:id  -> fetch latest status (polling fallback)
router.get(
  "/intent/:id",
  authenticateToken,
  ensurePermission("sales.view"),
  async (req, res) => {
    try {
      const stripeClient = getStripe();
      const intent = await stripeClient.paymentIntents.retrieve(req.params.id);
      res.json({
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        metadata: intent.metadata,
      });
    } catch (err) {
      console.error("Retrieve intent error:", err);
      res.status(500).json({ message: "Stripe error", error: err.message });
    }
  }
);

// (Future) Webhook endpoint placeholder - implement when moving to webhook-driven sale creation
// router.post('/stripe-webhook', express.raw({ type: 'application/json' }), (req, res) => { /* handle events */ });

module.exports = router;