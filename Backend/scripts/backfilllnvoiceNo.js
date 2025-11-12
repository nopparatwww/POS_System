/*
 Backfill missing invoiceNo for legacy Sale documents.

 Usage (Windows cmd.exe):
   node scripts\backfillInvoiceNo.js --dry-run    # preview changes, no writes
   node scripts\backfillInvoiceNo.js              # perform updates

 Requirements:
   - MONGO_URI must be set in .env (same as server.js)
   - Script is idempotent: will only update docs missing/empty invoiceNo
*/

require("dotenv").config();
// Initialize mongoose connection
require("../config/db");

const mongoose = require("mongoose");
const crypto = require("crypto");
const Sale = require("../models/sale");

const isDryRun = process.argv.includes("--dry-run");

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Generate invoice number similar to API: YYYYMMDD-<4-hex>
function genInvoiceNo(date = new Date()) {
  const d = new Date(date);
  const rand = crypto.randomBytes(2).toString("hex"); // 4 hex chars
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(
    d.getDate()
  )}-${rand}`;
}

async function uniqueInvoiceNo(preferDate) {
  let tries = 0;
  while (tries < 10) {
    const inv = genInvoiceNo(preferDate);
    // ensure uniqueness before write to avoid duplicate key errors
    const exists = await Sale.exists({ invoiceNo: inv }).lean?.();
    if (!exists) return inv;
    tries++;
  }
  // Fallback with larger randomness if collisions persist
  const d = preferDate || new Date();
  const longRand = crypto.randomBytes(4).toString("hex"); // 8 hex
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(
    d.getDate()
  )}-${longRand}`;
}

async function run() {
  try {
    console.log("Backfill invoiceNo started", { dryRun: isDryRun });

    // Build query to find docs with missing/empty invoiceNo
    const query = {
      $or: [
        { invoiceNo: { $exists: false } },
        { invoiceNo: null },
        { invoiceNo: "" },
      ],
    };

    const totalMissing = await Sale.countDocuments(query);
    console.log(`Found ${totalMissing} sale(s) missing invoiceNo.`);
    if (totalMissing === 0) {
      return;
    }

    // Stream with cursor to avoid loading everything into memory
    const cursor = Sale.find(query).cursor();
    let processed = 0;
    let updated = 0;
    for await (const sale of cursor) {
      processed++;
      const preferDate = sale.createdAt || new Date();
      const newInv = await uniqueInvoiceNo(preferDate);

      console.log(
        `[${processed}/${totalMissing}] _id=${sale._id} createdAt=${
          preferDate?.toISOString?.() || "-"
        } -> invoiceNo=${newInv}`
      );

      if (!isDryRun) {
        // Use updateOne to avoid triggering schema validation issues for legacy docs
        const result = await Sale.updateOne(
          { _id: sale._id },
          { $set: { invoiceNo: newInv } }
        );
        if (result.modifiedCount === 1) updated++;
      }
    }

    console.log(
      `Backfill complete. Processed=${processed}, Updated=${updated}, DryRun=${isDryRun}`
    );
  } catch (err) {
    console.error("Backfill error:", err);
    process.exitCode = 1;
  } finally {
    // Close mongoose connection gracefully
    try {
      await mongoose.connection.close();
    } catch (e) {}
  }
}

run();