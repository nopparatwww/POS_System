/*
  Sales API tests (Mocha + Chai + Supertest + mongodb-memory-server)
  - Runs against an in-memory MongoDB
  - Creates test users and exercises core Sales endpoints
*/

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "testsecret";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_mock";

const { expect } = require("chai");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mock = require("mock-require");

let mongod; // memory server
let app; // express app

// Models we interact with directly in tests
const User = require("../models/user");
const Sale = require("../models/sale");
const Refund = require("../models/refund");

// Helper: issue JWT for a given payload
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
}

describe("Sales API", function () {
  this.timeout(20000);

  let cashierUser;
  let warehouseUser;
  let cashierToken;
  let warehouseToken;
  let createdSaleId;
  let createdInvoiceNo;

  before(async () => {
    // Spin up in-memory MongoDB and point app to it BEFORE requiring server.js
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGO_URI = uri;

    // Mock Stripe SDK before loading the app/routes
    mock("stripe", function stripeFactory() {
      return {
        paymentIntents: {
          create: async (data) => ({
            id: "pi_test_" + Math.random().toString(36).slice(2, 10),
            client_secret: "cs_test_" + Date.now(),
            status: "requires_action",
            ...data,
          }),
          retrieve: async (id) => ({
            id,
            amount: 2000,
            currency: "thb",
            status: "processing",
            metadata: {},
          }),
        },
      };
    });

    // Now require the app (it will connect using MONGO_URI)
    app = require("../server");

    // Wait for mongoose to be connected
    await mongoose.connection.asPromise();

    // Seed minimal users
    cashierUser = await User.create({
      username: "cashier_test",
      passwordHash: "x", // bypass compare in these tests; not using login route
      role: "cashier",
    });
    warehouseUser = await User.create({
      username: "warehouse_test",
      passwordHash: "x",
      role: "warehouse",
    });

    cashierToken =
      "Bearer " +
      signToken({
        userId: cashierUser._id.toString(),
        role: "cashier",
        username: "cashier_test",
      });
    warehouseToken =
      "Bearer " +
      signToken({
        userId: warehouseUser._id.toString(),
        role: "warehouse",
        username: "warehouse_test",
      });
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (mongod) await mongod.stop();
  });

  describe("POST /api/protect/sales", () => {
    it("should reject without token (401)", async () => {
      const res = await request(app)
        .post("/api/protect/sales")
        .send({ items: [], total: 0 });
      expect(res.status).to.equal(401);
    });

    it("should reject empty items (400)", async () => {
      const res = await request(app)
        .post("/api/protect/sales")
        .set("Authorization", cashierToken)
        .send({
          items: [],
          subtotal: 0,
          discount: 0,
          vat: 0,
          total: 0,
          payment: { method: "cash" },
        });
      expect(res.status).to.equal(400);
      expect(res.body.message).to.match(/No items/i);
    });

    it("should forbid user without permission (403)", async () => {
      const res = await request(app)
        .post("/api/protect/sales")
        .set("Authorization", warehouseToken)
        .send({
          items: [{ name: "Item A", unitPrice: 10, qty: 1 }],
          subtotal: 10,
          discount: 0,
          vat: 0,
          total: 10,
          payment: { method: "cash", amountReceived: 10, change: 0 },
        });
      expect(res.status).to.equal(403);
    });

    it("should create a sale (201) for cashier with valid payload", async () => {
      const payload = {
        items: [
          { name: "Cola", unitPrice: 25, qty: 2 },
          { name: "Snack", unitPrice: 15, qty: 1 },
        ],
        subtotal: 65,
        discount: 5,
        vat: 0,
        total: 60,
        payment: {
          method: "cash",
          amountReceived: 100,
          change: 40,
          details: { paymentIntentId: "pi_test_find" },
        },
      };

      const res = await request(app)
        .post("/api/protect/sales")
        .set("Authorization", cashierToken)
        .send(payload);

      expect(res.status).to.equal(201);
      expect(res.body).to.have.property("sale");
      expect(res.body.sale).to.have.property("invoiceNo");
      expect(res.body.sale.items).to.have.length(2);
      expect(res.body.sale.total).to.equal(60);

      createdSaleId = res.body.sale._id;
      createdInvoiceNo = res.body.sale.invoiceNo;

      // Verify DB side
      const count = await Sale.countDocuments();
      expect(count).to.equal(1);
    });
  });

  describe("GET /api/protect/sales", () => {
    it("should list sales (200)", async () => {
      const res = await request(app)
        .get("/api/protect/sales?page=1&limit=10")
        .set("Authorization", cashierToken);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.keys(["rows", "total", "page", "limit"]);
      expect(res.body.total).to.be.greaterThan(0);
      expect(res.body.rows).to.be.an("array");
    });

    it("should filter by receipt (invoiceNo)", async () => {
      const res = await request(app)
        .get(
          `/api/protect/sales?receipt=${encodeURIComponent(
            createdInvoiceNo
          )}&limit=10`
        )
        .set("Authorization", cashierToken);
      expect(res.status).to.equal(200);
      expect(res.body.total).to.be.greaterThan(0);
      expect(res.body.rows.some((r) => r.invoiceNo === createdInvoiceNo)).to.be
        .true;
    });

    it("should filter by product name", async () => {
      const res = await request(app)
        .get(`/api/protect/sales?product=Cola&limit=10`)
        .set("Authorization", cashierToken);
      expect(res.status).to.equal(200);
      expect(res.body.total).to.be.greaterThan(0);
    });

    it("should filter by query (free text)", async () => {
      const res = await request(app)
        .get(`/api/protect/sales?query=Cola&limit=10`)
        .set("Authorization", cashierToken);
      expect(res.status).to.equal(200);
      expect(res.body.total).to.be.greaterThan(0);
    });

    it("should filter by date range (from/to)", async () => {
      const day = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .get(`/api/protect/sales?from=${day}&to=${day}&limit=10`)
        .set("Authorization", cashierToken);
      expect(res.status).to.equal(200);
      expect(res.body.total).to.be.greaterThan(0);
    });
  });

  describe("GET /api/protect/sales/:id", () => {
    it("should fetch a sale by id (200)", async () => {
      const sale = await Sale.findById(createdSaleId);
      const res = await request(app)
        .get(`/api/protect/sales/${sale._id}`)
        .set("Authorization", cashierToken);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("invoiceNo");
      expect(res.body).to.have.property("items");
    });
  });

  describe("GET /api/protect/sales/by-intent/:id", () => {
    it("should fetch sale by PaymentIntent ID", async () => {
      const res = await request(app)
        .get(`/api/protect/sales/by-intent/pi_test_find`)
        .set("Authorization", cashierToken);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("invoiceNo");
      expect(res.body.invoiceNo).to.equal(createdInvoiceNo);
    });
  });

  describe("Refunds API", () => {
    let refundId;

    it("should create a refund (201)", async () => {
      // Build refund for one item of the created sale
      const sale = await Sale.findById(createdSaleId).lean();
      const item = sale.items[0];
      const payload = {
        saleId: createdSaleId.toString(),
        invoiceNo: createdInvoiceNo,
        items: [
          {
            productId: item.productId || undefined,
            name: item.name,
            unitPrice: item.unitPrice,
            originalQty: item.qty,
            returnQty: 1,
            reason: "Damaged item",
          },
        ],
      };

      const res = await request(app)
        .post("/api/protect/refunds")
        .set("Authorization", cashierToken)
        .send(payload);

      expect(res.status).to.equal(201);
      expect(res.body).to.have.property("refundId");
      refundId = res.body.refundId;
    });

    it("should list refunds (200)", async () => {
      const res = await request(app)
        .get("/api/protect/refunds?page=1&limit=10")
        .set("Authorization", cashierToken);
      expect(res.status).to.equal(200);
      expect(res.body.total).to.be.greaterThan(0);
    });

    it("should get refund detail (200)", async () => {
      const res = await request(app)
        .get(`/api/protect/refunds/${refundId}`)
        .set("Authorization", cashierToken);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("invoiceNo");
      expect(res.body).to.have.property("items");
    });
  });

  describe("Payments API (mocked Stripe)", () => {
    it("should create promptpay intent (200)", async () => {
      const payload = {
        total: 20,
        metadata: { source: "test" },
        draft: {
          items: [{ name: "Test", unitPrice: 20, qty: 1 }],
          subtotal: 20,
          discount: 0,
          vat: 0,
          total: 20,
        },
      };
      const res = await request(app)
        .post("/api/protect/payments/promptpay-intent")
        .set("Authorization", cashierToken)
        .send(payload);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.keys([
        "clientSecret",
        "paymentIntentId",
        "status",
      ]);
    });

    it("should create card intent (200)", async () => {
      const payload = { total: 30, metadata: { source: "test" } };
      const res = await request(app)
        .post("/api/protect/payments/card-intent")
        .set("Authorization", cashierToken)
        .send(payload);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.keys([
        "clientSecret",
        "paymentIntentId",
        "status",
      ]);
      // fetch intent status
      const pid = res.body.paymentIntentId;
      const res2 = await request(app)
        .get(`/api/protect/payments/intent/${pid}`)
        .set("Authorization", cashierToken);
      expect(res2.status).to.equal(200);
      expect(res2.body).to.have.property("status");
    });
  });
});
