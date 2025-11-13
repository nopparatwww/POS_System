const request = require('supertest');
const { expect } = require('chai');
const mongoose = require('mongoose');
const app = require('../server'); // Import Express app

// Import Models สำหรับการ setup และ cleanup
const User = require('../models/user');
const Product = require('../models/product');
const Permission = require('../models/permission');
const StockInLog = require('../models/stockInLog');
const StockOutLog = require('../models/stockOutLog');
const StockAuditLog = require('../models/stockAuditLog');

// =============================
// Test State (ตัวแปรเก็บสถานะการเทส)
// =============================
let adminToken = '';
let warehouseToken = '';
let cashierToken = '';

let testProductID = ''; // ID ของสินค้าที่จะใช้ทดสอบ Stock
let productToDeleteID = ''; // ID ของสินค้าที่จะใช้ทดสอบการลบ

const uniqueId = Date.now();
const adminUser = { username: `admin_${uniqueId}`, password: 'password123', role: 'admin' };
const warehouseUser = { username: `warehouse_${uniqueId}`, password: 'password123', role: 'warehouse' };
const cashierUser = { username: `cashier_${uniqueId}`, password: 'password123', role: 'cashier' };

const testProductSKU = `SKU_${uniqueId}`;
const productToDeleteSKU = `SKU_DEL_${uniqueId}`;

// สิทธิ์ที่จำเป็นสำหรับแต่ละ Role (อ้างอิงจาก ensurePermission.js และ apiPermissionRoutes.js)
const ADMIN_PERMISSIONS = [
  'admin.dashboard', 'admin.permissions', 'admin.products', 'admin.logs',
  'admin.logs.all', 'admin.logs.admin', 'admin.logs.cashier', 'admin.logs.warehouse',
  'admin.stockin', 'admin.stockout', 'admin.lowstock', 'admin.audit', 'admin.reports'
];
const WAREHOUSE_PERMISSIONS = [
  'warehouse.home', 'warehouse.products', 'warehouse.stockin', 'warehouse.stockout',
  'warehouse.stockaudit', 'warehouse.lowstock', 'warehouse.logs', 'warehouse.audit', 
  'warehouse.reports' // (ในโค้ดของคุณ warehouse.reports ถูกแมปไป admin.reports)
];
const CASHIER_PERMISSIONS = ['sales.home', 'sales.logs'];


// =============================
// Test Suite
// =============================
describe('Full API Test Suite', () => {

  // Hook: Setup ก่อนเริ่มเทสทั้งหมด
  before(async () => {
    // 1. (Optional) Clear old test data
    await User.deleteMany({ username: { $regex: /_(test|admin|warehouse|cashier)_\d+$/ } });
    await Product.deleteMany({ sku: { $regex: /^SKU_(DEL_)?\d+$/ } });
    await Permission.deleteMany({ updatedBy: 'test_setup' });

    // 2. Create Users
    await request(app).post('/api/auth/signup').send(adminUser).expect(201);
    await request(app).post('/api/auth/signup').send(warehouseUser).expect(201);
    await request(app).post('/api/auth/signup').send(cashierUser).expect(201);

    // 3. Login Users and get tokens
    const adminRes = await request(app).post('/api/auth/login').send(adminUser).expect(200);
    adminToken = adminRes.body.token;
    
    const warehouseRes = await request(app).post('/api/auth/login').send(warehouseUser).expect(200);
    warehouseToken = warehouseRes.body.token;

    const cashierRes = await request(app).post('/api/auth/login').send(cashierUser).expect(200);
    cashierToken = cashierRes.body.token;

    // 4. (CRITICAL) Set permissions using Admin token
    // (จำเป็นเพราะ middleware 'ensurePermission' ทำงานแบบ allow-only)
    await request(app).put(`/api/permissions/${adminUser.username}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ allowRoutes: ADMIN_PERMISSIONS, notes: 'test_setup' })
      .expect(200);
      
    await request(app).put(`/api/permissions/${warehouseUser.username}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ allowRoutes: WAREHOUSE_PERMISSIONS, notes: 'test_setup' })
      .expect(200);

    await request(app).put(`/api/permissions/${cashierUser.username}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ allowRoutes: CASHIER_PERMISSIONS, notes: 'test_setup' })
      .expect(200);

    // 5. Create Test Products (using warehouse token)
    const productRes = await request(app).post('/api/protect/products')
      .set('Authorization', `Bearer ${warehouseToken}`)
      .send({
        sku: testProductSKU,
        name: 'Test Product',
        price: 100,
        stock: 10,
        reorderLevel: 15
      })
      .expect(201);
    testProductID = productRes.body._id; // บันทึก ID ไว้ใช้ทดสอบ Stock

    const productDelRes = await request(app).post('/api/protect/products')
      .set('Authorization', `Bearer ${warehouseToken}`)
      .send({
        sku: productToDeleteSKU,
        name: 'Product to Delete',
        price: 50,
        stock: 5
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
    await User.deleteMany({ username: { $in: [adminUser.username, warehouseUser.username, cashierUser.username] } });
    
    // 3. Delete Permissions
    await Permission.deleteMany({ notes: 'test_setup' });

    // 4. Delete Logs (Optional, แต่ช่วยให้ DB สะอาด)
    await StockInLog.deleteMany({ actorUsername: warehouseUser.username });
    await StockOutLog.deleteMany({ actorUsername: warehouseUser.username });
    await StockAuditLog.deleteMany({ actorUsername: warehouseUser.username });
    
    // 5. Disconnect Mongoose
    await mongoose.disconnect();
  });

  // =============================
  // 1. Public API (apiPublicRoutes.js)
  // =============================
  describe('GET /api/public/info', () => {
    it('ควรเข้าถึง Public API ได้โดยไม่ต้องใช้ token (200 OK)', (done) => {
      request(app)
        .get('/api/public/info')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.message).to.include('public API');
          done();
        });
    });
  });

  // =============================
  // 2. Auth API (apiAuthRoutes.js)
  // =============================
  describe('POST /api/auth/login (Invalid)', () => {
    it('ควรปฏิเสธการ login ด้วยรหัสผ่านผิด (401 Unauthorized)', (done) => {
      request(app)
        .post('/api/auth/login')
        .send({ username: cashierUser.username, password: 'wrongpassword' })
        .expect(401, done);
    });

    it('ควรปฏิเสธการ login ด้วย user ที่ไม่มีอยู่จริง (401 Unauthorized)', (done) => {
      request(app)
        .post('/api/auth/login')
        .send({ username: 'nouser', password: 'wrongpassword' })
        .expect(401, done);
    });
  });

  // =============================
  // 3. Permissions API (apiPermissionRoutes.js)
  // =============================
  describe('GET /api/permissions', () => {
    it('[Admin] ควรรู้สิทธิ์ของ Admin (200 OK)', (done) => {
      request(app)
        .get('/api/permissions/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.username).to.equal(adminUser.username);
          expect(res.body.allowRoutes).to.deep.equal(ADMIN_PERMISSIONS);
          done();
        });
    });

    it('[Warehouse] ควรรู้สิทธิ์ของ Warehouse (200 OK)', (done) => {
      request(app)
        .get('/api/permissions/me')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.username).to.equal(warehouseUser.username);
          expect(res.body.allowRoutes).to.deep.equal(WAREHOUSE_PERMISSIONS);
          done();
        });
    });

    it('[Cashier] ควรรู้สิทธิ์ของ Cashier (200 OK)', (done) => {
      request(app)
        .get('/api/permissions/me')
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.username).to.equal(cashierUser.username);
          expect(res.body.allowRoutes).to.deep.equal(CASHIER_PERMISSIONS);
          done();
        });
    });

    it('[Admin] Admin ควรอัปเดตสิทธิ์ของ Cashier ได้ (200 OK)', (done) => {
      request(app)
        .put(`/api/permissions/${cashierUser.username}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ allowRoutes: ['sales.home'] }) // ลดสิทธิ์ sales.logs ออก
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.allowRoutes).to.deep.equal(['sales.home']);
          done();
        });
    });

    it('[Cashier] Cashier ไม่สามารถอัปเดตสิทธิ์ของ Admin ได้ (403 Forbidden)', (done) => {
      request(app)
        .put(`/api/permissions/${adminUser.username}`)
        .set('Authorization', `Bearer ${cashierToken}`) // ใช้ token ของ cashier
        .send({ allowRoutes: [] })
        .expect(403, done); // คาดหวัง 403 (ensureAdmin)
    });
  });
  
  // =============================
  // 4. Products API (apiProductRoutes.js)
  // =============================
  describe('GET /api/protect/products', () => {
    it('[Warehouse] ควรดึงรายการสินค้าได้ (200 OK)', (done) => {
      request(app)
        .get('/api/protect/products')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.items).to.be.an('array');
          expect(res.body.items.length).to.be.at.least(2); // มี 2 ชิ้นที่สร้างไว้
          done();
        });
    });

    it('[Admin] ควรดึงรายการสินค้าได้ (200 OK)', (done) => {
      request(app)
        .get('/api/protect/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.items).to.be.an('array');
          done();
        });
    });

    it('[Cashier] ไม่ควรดึงรายการสินค้าได้ (403 Forbidden)', (done) => {
      request(app)
        .get('/api/protect/products')
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(403, done);
    });

    it('[Warehouse] ควรแก้ไขสินค้า (PUT) ได้ (200 OK)', (done) => {
      request(app)
        .put(`/api/protect/products/${testProductID}`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ name: 'Updated Test Product', price: 150 })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.name).to.equal('Updated Test Product');
          expect(res.body.price).to.equal(150);
          done();
        });
    });
    
    it('[Admin] ควรลบสินค้า (DELETE) ได้ (204 No Content)', (done) => {
      request(app)
        .delete(`/api/protect/products/${productToDeleteID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204)
        .end(err => {
            if (err) return done(err);
            productToDeleteID = ''; // ตั้งค่าว่าลบแล้ว จะได้ไม่ลบซ้ำใน after
            done();
        });
    });

    it('[Warehouse] ควรดึงรายการ Low Stock ได้ (200 OK)', (done) => {
        // (สินค้า testProductSKU มี stock 10, reorderLevel 5 -> ควรติด)
        request(app)
          .get('/api/protect/products/lowstock')
          .set('Authorization', `Bearer ${warehouseToken}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body).to.be.an('array');
            // ตรวจสอบว่ามีสินค้าที่เราคาดหวัง
            const found = res.body.some(item => item.sku === testProductSKU);
            expect(found).to.be.true;
            done();
          });
      });
  });

  // =============================
  // 5. Stock API (apiStockRoutes.js)
  // =============================
  describe('/api/protect/stock', () => {
    let initialStock = 10;

    it('[Warehouse] ควร Stock In ได้ (201 Created)', (done) => {
      request(app)
        .post('/api/protect/stock/in')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ productId: testProductID, quantity: 5 }) // จาก 10 -> 15
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.quantity).to.equal(5);
          initialStock = 15; // อัปเดต stock คาดหวัง
          done();
        });
    });

    it('[Warehouse] ควร Stock Out ได้ (201 Created)', (done) => {
      request(app)
        .post('/api/protect/stock/out')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ productId: testProductID, quantity: 2, reason: 'Test damage' }) // จาก 15 -> 13
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.quantity).to.equal(2);
          expect(res.body.reason).to.equal('Test damage');
          initialStock = 13;
          done();
        });
    });

    it('[Warehouse] ควร Stock Audit ได้ (201 Created)', (done) => {
      request(app)
        .post('/api/protect/stock/audit')
        .set('Authorization', `Bearer ${warehouseToken}`)
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

    it('[Cashier] ไม่ควร Stock In ได้ (403 Forbidden)', (done) => {
      request(app)
        .post('/api/protect/stock/in')
        .set('Authorization', `Bearer ${cashierToken}`) // Token พนักงานขาย
        .send({ productId: testProductID, quantity: 5 })
        .expect(403, done);
    });

    it('[Warehouse] ควรดึง /in/logs ได้ (200 OK)', (done) => {
        request(app)
          .get('/api/protect/stock/in/logs')
          .set('Authorization', `Bearer ${warehouseToken}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body.items).to.be.an('array');
            expect(res.body.items.length).to.be.at.least(1);
            done();
          });
      });
  });

  // =============================
  // 6. Reports API (apiReportRoutes.js)
  // =============================
  describe('/api/protect/reports', () => {
    it('[Warehouse] ควรดึง /stats ได้ (200 OK)', (done) => {
      request(app)
        .get('/api/protect/reports/stats')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('totalProducts');
          expect(res.body).to.have.property('totalValue');
          expect(res.body).to.have.property('lowStock');
          expect(res.body).to.have.property('outOfStock');
          done();
        });
    });

    it('[Warehouse] ควรดึง /movement ได้ (200 OK)', (done) => {
        request(app)
          .get('/api/protect/reports/movement')
          .set('Authorization', `Bearer ${warehouseToken}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body.items).to.be.an('array');
            // เราทำ 3 transaction (in, out, audit)
            expect(res.body.items.length).to.be.at.least(3); 
            done();
          });
      });

    it('[Cashier] ไม่ควรดึง /stats ได้ (403 Forbidden)', (done) => {
      request(app)
        .get('/api/protect/reports/stats')
        .set('Authorization', `Bearer ${cashierToken}`)
        .expect(403, done);
    });
  });

  // =============================
  // 7. Logs API (apiProtectRoutes.js)
  // =============================
  describe('/api/protect/logs', () => {
    // Restore cashier permission for sales.logs, because an earlier test reduced it.
    before(async () => {
      await request(app)
        .put(`/api/permissions/${cashierUser.username}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ allowRoutes: ['sales.home', 'sales.logs'] })
        .expect(200);
    });
    it('[Admin] ควรดึง /logs/all ได้ (200 OK)', (done) => {
        request(app)
          .get('/api/protect/logs/all')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            expect(res.body.items).to.be.an('array');
            done();
          });
    });

    it('[Admin] ควรดึง /logs/cashier (กรอง role) ได้ (200 OK)', (done) => {
        request(app)
          .get('/api/protect/logs/cashier') // endpoint นี้สำหรับ admin
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200, done);
    });

    it('[Cashier] ควรดึง /logs/sales (log ตนเอง) ได้ (200 OK)', (done) => {
        request(app)
          .get('/api/protect/logs/sales') // endpoint นี้สำหรับ cashier
          .set('Authorization', `Bearer ${cashierToken}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err);
            // ควรจะเจอเฉพาะ log ของตัวเอง (ถ้ามี)
            done();
          });
    });

    it('[Warehouse] ไม่ควรดึง /logs/all ของ Admin ได้ (403 Forbidden)', (done) => {
        request(app)
          .get('/api/protect/logs/all')
          .set('Authorization', `Bearer ${warehouseToken}`) // ใช้ token warehouse
          .expect(403, done);
    });
  });

  // =============================
  // 8. Validation 400 cases (Auth/Permissions/Products/Stock)
  // =============================
  describe('Validation 400 cases', () => {
    // Auth
    it('POST /api/auth/signup -> 400 when missing username/password', async () => {
      await request(app).post('/api/auth/signup').send({ username: '', password: '' }).expect(400);
    });
    it('POST /api/auth/signup -> 400 invalid role', async () => {
      await request(app).post('/api/auth/signup').send({ username: `x_${uniqueId}`, password: 'a', role: 'hacker' }).expect(400);
    });
    it('POST /api/auth/login -> 400 when missing fields', async () => {
      await request(app).post('/api/auth/login').send({ username: '', password: '' }).expect(400);
    });

    // Permission check helper
    it('POST /api/permissions/check -> 400 when path missing', async () => {
      await request(app)
        .post('/api/permissions/check')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });

    // Products
    it('POST /api/protect/products -> 400 when missing required fields', async () => {
      await request(app)
        .post('/api/protect/products')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ sku: `VAL_${uniqueId}_BAD` })
        .expect(400);
    });
    it('POST /api/protect/products -> 400 when invalid price/stock', async () => {
      await request(app)
        .post('/api/protect/products')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ sku: `VAL_${uniqueId}_BAD2`, name: 'Bad', price: -1, stock: -5 })
        .expect(400);
    });
    it('PUT /api/protect/products/:id -> 400 invalid price', async () => {
      await request(app)
        .put(`/api/protect/products/${testProductID}`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ price: -10 })
        .expect(400);
    });

    // Stock In
    it('POST /api/protect/stock/in -> 400 invalid productId format', async () => {
      await request(app)
        .post('/api/protect/stock/in')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ productId: 'bad', quantity: 1 })
        .expect(400);
    });
    it('POST /api/protect/stock/in -> 400 zero/negative quantity', async () => {
      await request(app)
        .post('/api/protect/stock/in')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ productId: testProductID, quantity: 0 })
        .expect(400);
    });

    // Stock Out
    it('POST /api/protect/stock/out -> 400 missing reason', async () => {
      await request(app)
        .post('/api/protect/stock/out')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ productId: testProductID, quantity: 1 })
        .expect(400);
    });
    it('POST /api/protect/stock/out -> 400 invalid productId format', async () => {
      await request(app)
        .post('/api/protect/stock/out')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ productId: 'bad', quantity: 1, reason: 'x' })
        .expect(400);
    });
    it('POST /api/protect/stock/out -> 400 insufficient stock', async () => {
      await request(app)
        .post('/api/protect/stock/out')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ productId: testProductID, quantity: 9999, reason: 'test' })
        .expect(400);
    });

    // Stock Audit
    it('POST /api/protect/stock/audit -> 400 invalid productId', async () => {
      await request(app)
        .post('/api/protect/stock/audit')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ productId: 'bad', actualStock: 5 })
        .expect(400);
    });
    it('POST /api/protect/stock/audit -> 400 negative actualStock', async () => {
      await request(app)
        .post('/api/protect/stock/audit')
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ productId: testProductID, actualStock: -1 })
        .expect(400);
    });
  });

});