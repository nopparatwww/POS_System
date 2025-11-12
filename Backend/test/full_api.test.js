const request = require("supertest");
const { expect } = require("chai");
const mongoose = require("mongoose");
const mock = require("mock-require");
const app = require("../server"); // Import Express app

// Import Models สำหรับการ setup และ cleanup
const User = require("../models/user");
const Product = require("../models/product");
const Permission = require("../models/permission");
const StockInLog = require("../models/stockInLog");
const StockOutLog = require("../models/stockOutLog");
const StockAuditLog = require("../models/stockAuditLog");
const Discount = require("../models/discount");

// =============================
// Test State (ตัวแปรเก็บสถานะการเทส)
// =============================
let adminToken = "";
let warehouseToken = "";
let cashierToken = "";

let testProductID = ""; // ID ของสินค้าที่จะใช้ทดสอบ Stock
let productToDeleteID = ""; // ID ของสินค้าที่จะใช้ทดสอบการลบ

const uniqueId = Date.now();
const adminUser = {
  username: `admin_${uniqueId}`,
  password: "password123",
  role: "admin",
};
const warehouseUser = {
  username: `warehouse_${uniqueId}`,
  password: "password123",
  role: "warehouse",
};
const cashierUser = {
  username: `cashier_${uniqueId}`,
  password: "password123",
  role: "cashier",
};

const testProductSKU = `SKU_${uniqueId}`;
const productToDeleteSKU = `SKU_DEL_${uniqueId}`;

// สิทธิ์ที่จำเป็นสำหรับแต่ละ Role (อ้างอิงจาก ensurePermission.js และ apiPermissionRoutes.js)
const ADMIN_PERMISSIONS = [
  "admin.dashboard",
  "admin.permissions",
  "admin.products",
  "admin.logs",
  "admin.logs.all",
  "admin.logs.admin",
  "admin.logs.cashier",
  "admin.logs.warehouse",
  "admin.stockin",
  "admin.stockout",
  "admin.lowstock",
  "admin.audit",
  "admin.reports",
];
const WAREHOUSE_PERMISSIONS = [
  "warehouse.home",
  "warehouse.products",
  "warehouse.stockin",
  "warehouse.stockout",
  "warehouse.stockaudit",
  "warehouse.lowstock",
  "warehouse.logs",
  "warehouse.audit",
  "warehouse.reports", // (ในโค้ดของคุณ warehouse.reports ถูกแมปไป admin.reports)
];
// เพิ่มสิทธิ์ให้ตรงกับ baseline cashier ใน ensurePermission.js
const CASHIER_PERMISSIONS = [
  "sales.home",
  "sales.logs",
  "sales.create",
  "sales.view",
  "refunds.view",
  "refunds.create",
];

// =============================
// Test Suite
// =============================
describe("Full API Test Suite", () => {
  // Hook: Setup ก่อนเริ่มเทสทั้งหมด
  before(async () => {
    // 1. (Optional) Clear old test data
    await User.deleteMany({
      username: { $regex: /_(test|admin|warehouse|cashier)_\d+$/ },
    });
    await Product.deleteMany({ sku: { $regex: /^SKU_(DEL_)?\d+$/ } });
    await Permission.deleteMany({ updatedBy: "test_setup" });

    // 2. Create Users
    await request(app).post("/api/auth/signup").send(adminUser).expect(201);
    await request(app).post("/api/auth/signup").send(warehouseUser).expect(201);
    await request(app).post("/api/auth/signup").send(cashierUser).expect(201);

    // 3. Login Users and get tokens
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send(adminUser)
      .expect(200);
    adminToken = adminRes.body.token;

    const warehouseRes = await request(app)
      .post("/api/auth/login")
      .send(warehouseUser)
      .expect(200);
    warehouseToken = warehouseRes.body.token;

    const cashierRes = await request(app)
      .post("/api/auth/login")
      .send(cashierUser)
      .expect(200);
    cashierToken = cashierRes.body.token;

    // 4. (CRITICAL) Set permissions using Admin token
    // (จำเป็นเพราะ middleware 'ensurePermission' ทำงานแบบ allow-only)
    await request(app)
      .put(`/api/permissions/${adminUser.username}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ allowRoutes: ADMIN_PERMISSIONS, notes: "test_setup" })
      .expect(200);

    await request(app)
      .put(`/api/permissions/${warehouseUser.username}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ allowRoutes: WAREHOUSE_PERMISSIONS, notes: "test_setup" })
      .expect(200);

    await request(app)
      .put(`/api/permissions/${cashierUser.username}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ allowRoutes: CASHIER_PERMISSIONS, notes: "test_setup" })
      .expect(200);

    // 5. Create Test Products (using warehouse token)
    const productRes = await request(app)
      .post("/api/protect/products")
      .set("Authorization", `Bearer ${warehouseToken}`)
      .send({
        sku: testProductSKU,
        name: "Test Product",
        price: 100,
        stock: 10,
        reorderLevel: 5,
      })
      .expect(201);
    testProductID = productRes.body._id; // บันทึก ID ไว้ใช้ทดสอบ Stock

    const productDelRes = await request(app)
      .post("/api/protect/products")
      .set("Authorization", `Bearer ${warehouseToken}`)
      .send({
        sku: productToDeleteSKU,
        name: "Product to Delete",
        price: 50,
        stock: 5,
      })
      .expect(201);
    productToDeleteID = productDelRes.body._id;
  });

  // Hook: Cleanup หลังเทสทั้งหมด
  after(async () => {
    // 1. Delete Test Products
    if (testProductID) await Product.findByIdAndDelete(testProductID);
    if (productToDeleteID) await Product.findByIdAndDelete(productToDeleteID);

    // 2. Delete Test Users
    await User.deleteMany({
      username: {
        $in: [adminUser.username, warehouseUser.username, cashierUser.username],
      },
    });

    // 3. Delete Permissions
    await Permission.deleteMany({ notes: "test_setup" });

    // 4. Delete Logs (Optional, แต่ช่วยให้ DB สะอาด)
    await StockInLog.deleteMany({ actorUsername: warehouseUser.username });
    await StockOutLog.deleteMany({ actorUsername: warehouseUser.username });
    await StockAuditLog.deleteMany({ actorUsername: warehouseUser.username });

    // 4.1 Delete test Discounts (names prefixed with TEST_<uniqueId>_)
    await Discount.deleteMany({ name: { $regex: `^TEST_${uniqueId}_` } });

    // 5. Disconnect Mongoose
    await mongoose.disconnect();
  });

  // =============================
  // 1. Public API (apiPublicRoutes.js)
  // =============================
  describe("GET /api/public/info", () => {
    it("ควรเข้าถึง Public API ได้โดยไม่ต้องใช้ token (200 OK)", (done) => {
      request(app)
        .get("/api/public/info")
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).to.include("public API");
          done();
        });
    });
  });

  // =============================
  // 2. Auth API (apiAuthRoutes.js)
  // =============================
  describe("POST /api/auth/login (Invalid)", () => {
    it("ควรปฏิเสธการ login ด้วยรหัสผ่านผิด (401 Unauthorized)", (done) => {
      request(app)
        .post("/api/auth/login")
        .send({ username: cashierUser.username, password: "wrongpassword" })
        .expect(401, done);
    });

    it("ควรปฏิเสธการ login ด้วย user ที่ไม่มีอยู่จริง (401 Unauthorized)", (done) => {
      request(app)
        .post("/api/auth/login")
        .send({ username: "nouser", password: "wrongpassword" })
        .expect(401, done);
    });
  });

  // =============================
  // 3. Permissions API (apiPermissionRoutes.js)
  // =============================
  describe("GET /api/permissions", () => {
    it("[Admin] ควรรู้สิทธิ์ของ Admin (200 OK)", (done) => {
      request(app)
        .get("/api/permissions/me")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.username).to.equal(adminUser.username);
          expect(res.body.allowRoutes).to.deep.equal(ADMIN_PERMISSIONS);
          done();
        });
    });

    it("[Warehouse] ควรรู้สิทธิ์ของ Warehouse (200 OK)", (done) => {
      request(app)
        .get("/api/permissions/me")
        .set("Authorization", `Bearer ${warehouseToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.username).to.equal(warehouseUser.username);
          expect(res.body.allowRoutes).to.deep.equal(WAREHOUSE_PERMISSIONS);
          done();
        });
    });

    it("[Cashier] ควรรู้สิทธิ์ของ Cashier (200 OK)", (done) => {
      request(app)
        .get("/api/permissions/me")
        .set("Authorization", `Bearer ${cashierToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.username).to.equal(cashierUser.username);
          expect(res.body.allowRoutes).to.deep.equal(CASHIER_PERMISSIONS);
          done();
        });
    });

    it("[Admin] Admin ควรอัปเดตสิทธิ์ของ Cashier ได้ (200 OK)", (done) => {
      request(app)
        .put(`/api/permissions/${cashierUser.username}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ allowRoutes: ["sales.home"] }) // ลดสิทธิ์ sales.logs ออก
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.allowRoutes).to.deep.equal(["sales.home"]);
          done();
        });
    });

    it("[Cashier] Cashier ไม่สามารถอัปเดตสิทธิ์ของ Admin ได้ (403 Forbidden)", (done) => {
      request(app)
        .put(`/api/permissions/${adminUser.username}`)
        .set("Authorization", `Bearer ${cashierToken}`) // ใช้ token ของ cashier
        .send({ allowRoutes: [] })
        .expect(403, done); // คาดหวัง 403 (ensureAdmin)
    });
  });

  // =============================
  // 4. Products API (apiProductRoutes.js)
  // =============================
  describe("GET /api/protect/products", () => {
    it("[Warehouse] ควรดึงรายการสินค้าได้ (200 OK)", (done) => {
      request(app)
        .get("/api/protect/products")
        .set("Authorization", `Bearer ${warehouseToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.items).to.be.an("array");
          expect(res.body.items.length).to.be.at.least(2); // มี 2 ชิ้นที่สร้างไว้
          done();
        });
    });

    it("[Admin] ควรดึงรายการสินค้าได้ (200 OK)", (done) => {
      request(app)
        .get("/api/protect/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.items).to.be.an("array");
          done();
        });
    });

    it("[Cashier] ไม่ควรดึงรายการสินค้าได้ (403 Forbidden)", (done) => {
      request(app)
        .get("/api/protect/products")
        .set("Authorization", `Bearer ${cashierToken}`)
        .expect(403, done);
    });

    it("[Warehouse] ควรแก้ไขสินค้า (PUT) ได้ (200 OK)", (done) => {
      request(app)
        .put(`/api/protect/products/${testProductID}`)
        .set("Authorization", `Bearer ${warehouseToken}`)
        .send({ name: "Updated Test Product", price: 150 })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.name).to.equal("Updated Test Product");
          expect(res.body.price).to.equal(150);
          done();
        });
    });

    it("[Admin] ควรลบสินค้า (DELETE) ได้ (204 No Content)", (done) => {
      request(app)
        .delete(`/api/protect/products/${productToDeleteID}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(204)
        .end((err) => {
          if (err) return done(err);
          productToDeleteID = ""; // ตั้งค่าว่าลบแล้ว จะได้ไม่ลบซ้ำใน after
          done();
        });
    });

    it("[Warehouse] ควรดึงรายการ Low Stock ได้ (200 OK)", (done) => {
      // (สินค้า testProductSKU มี stock 10, reorderLevel 5 -> ควรติด)
      request(app)
        .get("/api/protect/products/lowstock")
        .set("Authorization", `Bearer ${warehouseToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.be.an("array");
          // ตรวจสอบว่ามีสินค้าที่เราคาดหวัง
          const found = res.body.some((item) => item.sku === testProductSKU);
          expect(found).to.be.true;
          done();
        });
    });
  });

  // =============================
  // 5. Stock API (apiStockRoutes.js)
  // =============================
  describe("/api/protect/stock", () => {
    let initialStock = 10;

    it("[Warehouse] ควร Stock In ได้ (201 Created)", (done) => {
      request(app)
        .post("/api/protect/stock/in")
        .set("Authorization", `Bearer ${warehouseToken}`)
        .send({ productId: testProductID, quantity: 5 }) // จาก 10 -> 15
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.quantity).to.equal(5);
          initialStock = 15; // อัปเดต stock คาดหวัง
          done();
        });
    });

    it("[Warehouse] ควร Stock Out ได้ (201 Created)", (done) => {
      request(app)
        .post("/api/protect/stock/out")
        .set("Authorization", `Bearer ${warehouseToken}`)
        .send({ productId: testProductID, quantity: 2, reason: "Test damage" }) // จาก 15 -> 13
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.quantity).to.equal(2);
          expect(res.body.reason).to.equal("Test damage");
          initialStock = 13;
          done();
        });
    });

    it("[Warehouse] ควร Stock Audit ได้ (201 Created)", (done) => {
      request(app)
        .post("/api/protect/stock/audit")
        .set("Authorization", `Bearer ${warehouseToken}`)
        .send({ productId: testProductID, actualStock: 12 }) // จาก 13 -> 12
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.systemStock).to.equal(initialStock); // 13
          expect(res.body.actualStock).to.equal(12);
          expect(res.body.quantity).to.equal(-1); // Difference
          initialStock = 12;
          done();
        });
    });

    it("[Cashier] ไม่ควร Stock In ได้ (403 Forbidden)", (done) => {
      request(app)
        .post("/api/protect/stock/in")
        .set("Authorization", `Bearer ${cashierToken}`) // Token พนักงานขาย
        .send({ productId: testProductID, quantity: 5 })
        .expect(403, done);
    });

    it("[Warehouse] ควรดึง /in/logs ได้ (200 OK)", (done) => {
      request(app)
        .get("/api/protect/stock/in/logs")
        .set("Authorization", `Bearer ${warehouseToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.items).to.be.an("array");
          expect(res.body.items.length).to.be.at.least(1);
          done();
        });
    });
  });

  // =============================
  // 6. Reports API (apiReportRoutes.js)
  // =============================
  describe("/api/protect/reports", () => {
    it("[Warehouse] ควรดึง /stats ได้ (200 OK)", (done) => {
      request(app)
        .get("/api/protect/reports/stats")
        .set("Authorization", `Bearer ${warehouseToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property("totalProducts");
          expect(res.body).to.have.property("totalValue");
          expect(res.body).to.have.property("lowStock");
          expect(res.body).to.have.property("outOfStock");
          done();
        });
    });

    it("[Warehouse] ควรดึง /movement ได้ (200 OK)", (done) => {
      request(app)
        .get("/api/protect/reports/movement")
        .set("Authorization", `Bearer ${warehouseToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.items).to.be.an("array");
          // เราทำ 3 transaction (in, out, audit)
          expect(res.body.items.length).to.be.at.least(3);
          done();
        });
    });

    it("[Cashier] ไม่ควรดึง /stats ได้ (403 Forbidden)", (done) => {
      request(app)
        .get("/api/protect/reports/stats")
        .set("Authorization", `Bearer ${cashierToken}`)
        .expect(403, done);
    });
  });

  // =============================
  // 7. Logs API (apiProtectRoutes.js)
  // =============================
  describe("/api/protect/logs", () => {
    it("[Admin] ควรดึง /logs/all ได้ (200 OK)", (done) => {
      request(app)
        .get("/api/protect/logs/all")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.items).to.be.an("array");
          done();
        });
    });

    it("[Admin] ควรดึง /logs/cashier (กรอง role) ได้ (200 OK)", (done) => {
      request(app)
        .get("/api/protect/logs/cashier") // endpoint นี้สำหรับ admin
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200, done);
    });

    it("[Cashier] ควรดึง /logs/sales (log ตนเอง) ได้ (200 OK)", (done) => {
      request(app)
        .get("/api/protect/logs/sales") // endpoint นี้สำหรับ cashier
        .set("Authorization", `Bearer ${cashierToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          // ควรจะเจอเฉพาะ log ของตัวเอง (ถ้ามี)
          done();
        });
    });

    it("[Warehouse] ไม่ควรดึง /logs/all ของ Admin ได้ (403 Forbidden)", (done) => {
      request(app)
        .get("/api/protect/logs/all")
        .set("Authorization", `Bearer ${warehouseToken}`) // ใช้ token warehouse
        .expect(403, done);
    });
  });

  // =============================
  // 8. Sales API (apiSalesRoutes.js)
  // =============================
  describe("Sales API (apiSalesRoutes.js)", () => {
    let saleId = "";
    let invoiceNo = "";

    it("ควรปฏิเสธเมื่อไม่ส่ง token (401)", async () => {
      const res = await request(app)
        .post("/api/protect/sales")
        .send({ items: [], total: 0 });
      expect(res.status).to.equal(401);
    });

    it("[Warehouse] ควรถูกปฏิเสธ (403) เมื่อสร้าง sale", async () => {
      const res = await request(app)
        .post("/api/protect/sales")
        .set("Authorization", `Bearer ${warehouseToken}`)
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

    it("[Cashier] ควรปฏิเสธ items ว่าง (400)", async () => {
      const res = await request(app)
        .post("/api/protect/sales")
        .set("Authorization", `Bearer ${cashierToken}`)
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

    it("[Cashier] ควรสร้าง sale ได้ (201)", async () => {
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
        .set("Authorization", `Bearer ${cashierToken}`)
        .send(payload);
      expect(res.status).to.equal(201);
      expect(res.body.sale).to.have.property("invoiceNo");
      expect(res.body.sale.items).to.have.length(2);
      expect(res.body.sale.total).to.equal(60);
      saleId = res.body.sale._id;
      invoiceNo = res.body.sale.invoiceNo;
    });

    it("[Cashier] ควรดึงรายการขาย (GET /sales) ได้", async () => {
      const res = await request(app)
        .get("/api/protect/sales?page=1&limit=10")
        .set("Authorization", `Bearer ${cashierToken}`);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.keys(["rows", "total", "page", "limit"]);
      expect(res.body.total).to.be.greaterThan(0);
    });

    it("[Cashier] ควร filter ด้วย receipt (invoiceNo) ได้", async () => {
      const res = await request(app)
        .get(
          `/api/protect/sales?receipt=${encodeURIComponent(invoiceNo)}&limit=10`
        )
        .set("Authorization", `Bearer ${cashierToken}`);
      expect(res.status).to.equal(200);
      const found = res.body.rows.some((r) => r.invoiceNo === invoiceNo);
      expect(found).to.be.true;
    });

    it("[Cashier] ควร filter ด้วย product name ได้", async () => {
      const res = await request(app)
        .get("/api/protect/sales?product=Cola&limit=10")
        .set("Authorization", `Bearer ${cashierToken}`);
      expect(res.status).to.equal(200);
    });

    it("[Cashier] ควร filter ด้วย query ได้", async () => {
      const res = await request(app)
        .get("/api/protect/sales?query=Snack&limit=10")
        .set("Authorization", `Bearer ${cashierToken}`);
      expect(res.status).to.equal(200);
    });

    it("[Cashier] ควร filter ด้วยช่วงวัน (from/to) ได้", async () => {
      const day = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .get(`/api/protect/sales?from=${day}&to=${day}&limit=10`)
        .set("Authorization", `Bearer ${cashierToken}`);
      expect(res.status).to.equal(200);
    });

    it("[Cashier] ควรดึงรายละเอียด sale ตาม id ได้", async () => {
      const res = await request(app)
        .get(`/api/protect/sales/${saleId}`)
        .set("Authorization", `Bearer ${cashierToken}`);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("invoiceNo");
      expect(res.body).to.have.property("items");
    });

    it("[Cashier] ควรดึง sale ผ่าน PaymentIntent ID ได้ (by-intent)", async () => {
      const res = await request(app)
        .get("/api/protect/sales/by-intent/pi_test_find")
        .set("Authorization", `Bearer ${cashierToken}`);
      expect(res.status).to.equal(200);
      expect(res.body.invoiceNo).to.equal(invoiceNo);
    });
  });

  // =============================
  // 9. Refunds API (apiRefundRoutes.js)
  // =============================
  describe("Refunds API (apiRefundRoutes.js)", () => {
    let refundId = "";
    let saleId = "";
    let invoiceNo = "";

    before(async () => {
      // สร้าง sale สำหรับทดสอบ refund
      const payload = {
        items: [{ name: "Refund Cola", unitPrice: 20, qty: 2 }],
        subtotal: 40,
        discount: 0,
        vat: 0,
        total: 40,
        payment: { method: "cash", amountReceived: 50, change: 10 },
      };
      const res = await request(app)
        .post("/api/protect/sales")
        .set("Authorization", `Bearer ${cashierToken}`)
        .send(payload);
      saleId = res.body.sale._id;
      invoiceNo = res.body.sale.invoiceNo;
    });

    it("[Cashier] ควรสร้าง refund ได้ (201)", async () => {
      const res = await request(app)
        .post("/api/protect/refunds")
        .set("Authorization", `Bearer ${cashierToken}`)
        .send({
          saleId,
          invoiceNo,
          items: [
            {
              name: "Refund Cola",
              unitPrice: 20,
              originalQty: 2,
              returnQty: 1,
              reason: "Damaged item",
            },
          ],
        });
      expect(res.status).to.equal(201);
      refundId = res.body.refundId;
    });

    it("[Cashier] ควรดึงรายการ refunds ได้ (200)", async () => {
      const res = await request(app)
        .get("/api/protect/refunds?page=1&limit=10")
        .set("Authorization", `Bearer ${cashierToken}`);
      expect(res.status).to.equal(200);
      expect(res.body.total).to.be.greaterThan(0);
    });

    it("[Cashier] ควรดูรายละเอียด refund ได้ (200)", async () => {
      const res = await request(app)
        .get(`/api/protect/refunds/${refundId}`)
        .set("Authorization", `Bearer ${cashierToken}`);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property("invoiceNo");
      expect(res.body).to.have.property("items");
    });
  });

  // =============================
  // 10. Payments API (apiPaymentsRoutes.js) - Stripe mocked
  // =============================
  describe("Payments API (apiPaymentsRoutes.js) [Stripe mocked]", () => {
    before(() => {
      // mock Stripe เพื่อไม่ยิงจริง
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
      process.env.STRIPE_SECRET_KEY =
        process.env.STRIPE_SECRET_KEY || "sk_test_mock";
    });

    it("[Cashier] ควรสร้าง PromptPay intent ได้ (200)", async () => {
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
        .set("Authorization", `Bearer ${cashierToken}`)
        .send(payload);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.keys([
        "clientSecret",
        "paymentIntentId",
        "status",
      ]);
    });

    it("[Cashier] ควรสร้าง Card intent ได้ และดึงสถานะ intent ได้ (200)", async () => {
      const res = await request(app)
        .post("/api/protect/payments/card-intent")
        .set("Authorization", `Bearer ${cashierToken}`)
        .send({ total: 30, metadata: { source: "test" } });
      expect(res.status).to.equal(200);
      const pid = res.body.paymentIntentId;
      const res2 = await request(app)
        .get(`/api/protect/payments/intent/${pid}`)
        .set("Authorization", `Bearer ${cashierToken}`);
      expect(res2.status).to.equal(200);
      expect(res2.body).to.have.property("status");
    });
  });

  // =============================
  // 11. Discounts API (apiDiscountsRoutes.js)
  // =============================
  describe("Discounts API (apiDiscountsRoutes.js)", () => {
    const discountPercentName = `TEST_${uniqueId}_PERC`;
    const discountFixedName = `TEST_${uniqueId}_FIXED`;
    let percentId = "";
    let fixedId = "";

    it("ควรดึงรายการส่วนลดได้ (GET /discounts 200)", async () => {
      const res = await request(app).get("/api/protect/discounts");
      expect(res.status).to.equal(200);
      expect(res.body).to.be.an("array");
    });

    it("ควรสร้าง percent discount ได้ (POST 201)", async () => {
      const res = await request(app)
        .post("/api/protect/discounts")
        .send({ name: discountPercentName, type: "percent", value: 10 });
      expect(res.status).to.equal(201);
      expect(res.body.name).to.equal(discountPercentName);
      expect(res.body.type).to.equal("percent");
      percentId = res.body._id;
    });

    it("ควรสร้าง fixed discount ได้ (POST 201)", async () => {
      const res = await request(app)
        .post("/api/protect/discounts")
        .send({ name: discountFixedName, type: "fixed", value: 25 });
      expect(res.status).to.equal(201);
      expect(res.body.name).to.equal(discountFixedName);
      expect(res.body.type).to.equal("fixed");
      fixedId = res.body._id;
    });

    it("ควรปฏิเสธ payload ไม่ครบ (400)", async () => {
      const res = await request(app)
        .post("/api/protect/discounts")
        .send({ name: "", type: "percent" }); // missing value + empty name
      expect(res.status).to.equal(400);
    });

    it("ควรแสดง discount ที่สร้างเมื่อ GET อีกครั้ง", async () => {
      const res = await request(app).get("/api/protect/discounts");
      expect(res.status).to.equal(200);
      const names = res.body.map((d) => d.name);
      expect(names).to.include(discountPercentName);
      expect(names).to.include(discountFixedName);
    });
  });
});
