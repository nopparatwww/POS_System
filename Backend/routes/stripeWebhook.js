const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Sale = require("../models/sale");
const Product = require("../models/product");
const PendingPayment = require("../models/pendingPayment");
require("dotenv").config();

let stripe = null;
function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY missing in environment");
    stripe = require("stripe")(key);
  }
  return stripe;
}

function genInvoiceNo() {
  const d = new Date();
  const rand = crypto.randomBytes(2).toString("hex");
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(d.getDate()).padStart(2, "0")}-${rand}`;
}

async function createSaleFromPending(intent) {
  const paymentIntentId = intent.id;
  // Idempotency: check if sale already exists for this intent
  const existing = await Sale.findOne({
    "payment.details.paymentIntentId": paymentIntentId,
  }).lean();
  if (existing) return existing;

  const pending = await PendingPayment.findOne({ paymentIntentId });
  if (
    !pending ||
    !pending.saleDraft ||
    !Array.isArray(pending.saleDraft.items) ||
    pending.saleDraft.items.length === 0
  ) {
    throw new Error(
      "Pending draft not found or invalid for intent " + paymentIntentId
    );
  }

  // Validate stock similarly to apiSalesRoutes
  for (const it of pending.saleDraft.items) {
    if (it.productId) {
      const p = await Product.findById(it.productId);
      if (!p) throw new Error(`Invalid product ${it.name}`);
      if (typeof p.stock === "number" && p.stock < (it.qty || 0)) {
        throw new Error(`Insufficient stock for ${it.name}`);
      }
      if (typeof p.stock === "number") {
        p.stock = p.stock - (it.qty || 0);
        await p.save();
      }
    }
  }

  const sale = await Sale.create({
    invoiceNo: genInvoiceNo(),
    createdBy: pending.createdBy || null,
    cashierName: pending.cashierName || "unknown",
    items: pending.saleDraft.items.map((it) => ({
      productId: it.productId || null,
      sku: it.sku || "",
      name: it.name,
      unitPrice: Number(it.unitPrice || 0),
      qty: Number(it.qty || 0),
      lineTotal: Number(it.unitPrice || 0) * Number(it.qty || 0),
    })),
    subtotal: Number(pending.saleDraft.subtotal || 0),
    discount: Number(pending.saleDraft.discount || 0),
    vat: Number(pending.saleDraft.vat || 0),
    total: Number(pending.saleDraft.total || 0),
    payment: {
      method: pending.method || "qr",
      amountReceived: Number(pending.saleDraft.total || 0),
      change: 0,
      details: {
        paymentIntentId: paymentIntentId,
        intentStatus: intent.status,
      },
    },
  });

  pending.status = "processed";
  pending.processedAt = new Date();
  await pending.save();

  return sale;
}

// This file exports a handler function to be mounted with express.raw in server.js
async function stripeWebhookHandler(req, res) {
  try {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn("STRIPE_WEBHOOK_SECRET not set; rejecting webhook");
      return res.status(400).send("webhook secret not configured");
    }

    const stripeClient = getStripe();
    let event;
    try {
      event = stripeClient.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object;
        try {
          await createSaleFromPending(intent);
          return res.json({ received: true });
        } catch (e) {
          console.error("Failed to create sale from webhook:", e);
          // Return 400 to let Stripe retry later
          return res.status(400).json({ error: e.message });
        }
      }
      case "payment_intent.processing": {
        // Optional: mark pending as processing
        try {
          const intent = event.data.object;
          await PendingPayment.updateOne(
            { paymentIntentId: intent.id },
            { $set: { status: "pending" } }
          );
        } catch (e) {
          // ignore
        }
        return res.json({ received: true });
      }
      case "payment_intent.payment_failed": {
        try {
          const intent = event.data.object;
          await PendingPayment.updateOne(
            { paymentIntentId: intent.id },
            { $set: { status: "failed" } }
          );
        } catch (e) {
          // ignore
        }
        return res.json({ received: true });
      }
      default:
        return res.json({ received: true });
    }
  } catch (err) {
    console.error("Unexpected webhook error:", err);
    return res.status(500).send("Server error");
  }
}

module.exports = { stripeWebhookHandler };