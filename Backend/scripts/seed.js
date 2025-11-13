// Seed realistic mock data across the app for demos
// Usage (Windows cmd):
//   npm run db:seed            # normal seed (non-destructive upserts)
//   npm run db:reseed          # reset then seed
// Optional flags:
//   SEED_CLEAR=true            # clears key collections before seeding
//   node ./scripts/seed.js --clear

require('dotenv').config()
const { connect, disconnect } = require('./connect')

// Models
const User = require('../models/user')
const Permission = require('../models/permission')
const Product = require('../models/product')
const Discount = require('../models/discount')
const Sale = require('../models/sale')
const Refund = require('../models/refund')
const StockInLog = require('../models/stockInLog')
const StockOutLog = require('../models/stockOutLog')
const StockAuditLog = require('../models/stockAuditLog')
const ActivityLog = require('../models/activityLog')
const PendingPayment = require('../models/pendingPayment')
const DashboardStat = require('../models/dashboardStat')

const CLEAR = process.argv.includes('--clear') || String(process.env.SEED_CLEAR || 'false').toLowerCase() === 'true'

function genInvoiceNo() {
  const d = new Date();
  const rand = Math.random().toString(16).slice(2, 6)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${rand}`
}

async function upsertUser({ username, password, role, allowKeys = [], denyKeys = [], notes, profile = {} }) {
  let u = await User.findOne({ username })
  if (!u) u = new User({ username, role, ...profile })
  else {
    u.role = role
    Object.assign(u, profile)
  }
  await u.setPassword(password)
  // Ensure no shift window to avoid demo blocks
  u.shiftStart = undefined
  u.shiftEnd = undefined
  await u.save()

  await Permission.findOneAndUpdate(
    { user: u._id },
    { $set: { allowRoutes: allowKeys, denyRoutes: denyKeys, notes, updatedBy: 'seed' } },
    { upsert: true }
  )
  return u
}

async function ensureProduct(sku, data) {
  const existing = await Product.findOne({ sku })
  if (existing) {
    Object.assign(existing, data)
    await existing.save()
    return existing
  }
  const created = await Product.create({ sku, ...data })
  return created
}

async function clearCollections() {
  const collections = [
    Product, Discount, Sale, Refund, StockInLog, StockOutLog, StockAuditLog,
    ActivityLog, PendingPayment, DashboardStat,
  ]
  for (const M of collections) {
    try { await M.deleteMany({}) } catch (e) { console.warn('Clear warn:', M.modelName, e.message) }
  }
}

async function main(){
  await connect()

  if (CLEAR) {
    console.log('Clearing collections...')
    await clearCollections()
  }

  // USERS & PERMISSIONS
  // Leave allowRoutes empty for baseline permissions per role (see ensurePermission)
  const admin = await upsertUser({
    username: 'admin',
    password: process.env.ADMIN_DEFAULT_PASS || '123456',
    role: 'admin',
    notes: 'seed: admin baseline',
    profile: { firstName: 'System', lastName: 'Admin', email: 'admin@example.com' }
  })

  const admin2 = await upsertUser({
    username: 'admin_2',
    password: process.env.ADMIN2_DEFAULT_PASS || '123456',
    role: 'admin',
    notes: 'seed: admin baseline 2',
    profile: { firstName: 'Backup', lastName: 'Admin' }
  })

  const cashier1 = await upsertUser({
    username: 'jubs',
    password: '123456',
    role: 'cashier',
    notes: 'seed: cashier',
    profile: { firstName: 'Jubs', lastName: 'Cashier' }
  })

  const cashier2 = await upsertUser({
    username: 'cash1',
    password: '123456',
    role: 'cashier',
    notes: 'seed: cashier #2',
    profile: { firstName: 'Cash', lastName: 'One' }
  })

  const warehouse1 = await upsertUser({
    username: 'wh1',
    password: '123456',
    role: 'warehouse',
    notes: 'seed: warehouse',
    profile: { firstName: 'Ware', lastName: 'House' }
  })

  // PRODUCTS
  const productDefs = [
    { sku: 'P1001', name: 'Coke 325ml', category: 'Beverage', price: 18, cost: 10, stock: 120, unit: 'กระป๋อง', barcode: '8851234567890', reorderLevel: 30 },
    { sku: 'P1002', name: 'Pepsi 325ml', category: 'Beverage', price: 18, cost: 10, stock: 15, unit: 'กระป๋อง', barcode: '8850987654321', reorderLevel: 20 }, // low stock
    { sku: 'P1003', name: 'Drinking Water 600ml', category: 'Beverage', price: 12, cost: 5, stock: 200, unit: 'ขวด', barcode: '8851112223334', reorderLevel: 40 },
    { sku: 'P2001', name: 'Lays Classic 50g', category: 'Snack', price: 20, cost: 12, stock: 8, unit: 'ถุง', barcode: '012345678905', reorderLevel: 15 }, // low stock
    { sku: 'P2002', name: 'Lays Seaweed 50g', category: 'Snack', price: 20, cost: 12, stock: 50, unit: 'ถุง', barcode: '5901234123457', reorderLevel: 15 },
    { sku: 'P3001', name: 'Instant Noodles (Pork)', category: 'Grocery', price: 7, cost: 4, stock: 500, unit: 'ซอง', barcode: '9551234567890', reorderLevel: 100 },
    { sku: 'P3002', name: 'Instant Noodles (Chicken)', category: 'Grocery', price: 7, cost: 4, stock: 60, unit: 'ซอง', barcode: '4901234567894', reorderLevel: 50 },
    { sku: 'P4001', name: 'Tissue Box', category: 'Household', price: 35, cost: 20, stock: 25, unit: 'กล่อง', barcode: '12345670', reorderLevel: 10 },
    { sku: 'P4002', name: 'Dish Soap 500ml', category: 'Household', price: 45, cost: 28, stock: 12, unit: 'ขวด', barcode: '036000291452', reorderLevel: 10 },
    { sku: 'P5001', name: 'Shampoo 300ml', category: 'Personal Care', price: 89, cost: 55, stock: 9, unit: 'ขวด', barcode: '0085000987654', reorderLevel: 12 }, // low stock
    { sku: 'P5002', name: 'Toothpaste 150g', category: 'Personal Care', price: 59, cost: 30, stock: 35, unit: 'หลอด', barcode: '4006381333931', reorderLevel: 10 },
    { sku: 'P6001', name: 'AA Battery (2pcs)', category: 'Electronics', price: 49, cost: 30, stock: 18, unit: 'แพ็ค', barcode: '7312771112345', reorderLevel: 10 },
  ]

  const products = {} // map by sku
  for (const def of productDefs) {
    const p = await ensureProduct(def.sku, { ...def, createdBy: admin._id })
    products[def.sku] = p
  }

  // DISCOUNTS
  const disc10 = await Discount.create({ name: 'Summer Sale 10%', type: 'percent', value: 10 })
  const discFix20 = await Discount.create({ name: 'Member 20 THB', type: 'fixed', value: 20 })

  // STOCK LOGS (historical)
  const sIn = await StockInLog.create({
    product: products['P1001']._id, productName: products['P1001'].name, sku: 'P1001', quantity: 300,
    actorUsername: 'wh1'
  })
  const sOut = await StockOutLog.create({
    product: products['P2001']._id, productName: products['P2001'].name, sku: 'P2001', quantity: 5,
    reason: 'ของเสีย', actorUsername: 'wh1'
  })
  const sAudit = await StockAuditLog.create({
    product: products['P4002']._id, productName: products['P4002'].name, sku: 'P4002',
    systemStock: 12, actualStock: 10, quantity: -2, actorUsername: 'wh1'
  })

  // SALES (reduce stock accordingly)
  async function createSale({ byUser, items, payment }) {
    // reduce stock
    for (const it of items) {
      if (it.productId) {
        const p = await Product.findById(it.productId)
        if (p && typeof p.stock === 'number') { p.stock = Math.max(0, p.stock - (it.qty || 0)); await p.save() }
      }
    }
    const subtotal = items.reduce((sum, it) => sum + Number(it.unitPrice) * Number(it.qty), 0)
    // simple: apply no automatic VAT; discount: if provided in payment?.details?.discountAmount
    const discount = Number(payment?.details?.discountAmount || 0)
    const vat = 0
    const total = Math.max(0, subtotal - discount)
    const sale = await Sale.create({
      invoiceNo: genInvoiceNo(),
      createdBy: byUser._id,
      cashierName: byUser.username,
      items: items.map(it => ({
        productId: it.productId,
        sku: it.sku,
        name: it.name,
        unitPrice: it.unitPrice,
        qty: it.qty,
        lineTotal: it.unitPrice * it.qty,
      })),
      subtotal, discount, vat, total,
      payment: {
        method: payment.method,
        amountReceived: payment.amountReceived ?? total,
        change: (payment.amountReceived ?? total) - total,
        details: payment.details || {}
      }
    })
    return sale
  }

  const sale1 = await createSale({
    byUser: cashier1,
    items: [
      { productId: products['P1001']._id, sku: 'P1001', name: products['P1001'].name, unitPrice: products['P1001'].price, qty: 2 },
      { productId: products['P2001']._id, sku: 'P2001', name: products['P2001'].name, unitPrice: products['P2001'].price, qty: 1 },
    ],
    payment: { method: 'cash', amountReceived: 100, details: { discountName: disc10.name, discountAmount: 5 } }
  })

  const sale2 = await createSale({
    byUser: cashier2,
    items: [
      { productId: products['P3001']._id, sku: 'P3001', name: products['P3001'].name, unitPrice: products['P3001'].price, qty: 5 },
      { productId: products['P5002']._id, sku: 'P5002', name: products['P5002'].name, unitPrice: products['P5002'].price, qty: 1 },
    ],
    payment: { method: 'qr', details: { provider: 'PromptPay', ref: 'PP-001' } }
  })

  // REFUND (partial)
  const refundedItem = sale1.items[0]
  const refund = await Refund.create({
    saleId: sale1._id,
    invoiceNo: sale1.invoiceNo,
    refundedBy: admin._id,
    items: [{
      productId: refundedItem.productId || null,
      name: refundedItem.name,
      unitPrice: refundedItem.unitPrice,
      originalQty: refundedItem.qty,
      returnQty: 1,
      reason: 'Damaged product',
      lineRefund: refundedItem.unitPrice * 1,
    }],
    totalRefund: refundedItem.unitPrice * 1,
  })
  // Mark sale as refunded for demo visibility
  sale1.status = 'refunded'
  await sale1.save()

  // PENDING PAYMENT (example draft)
  await PendingPayment.create({
    paymentIntentId: 'mock_intent_001',
    method: 'qr',
    saleDraft: {
      items: [
        { productId: products['P1003']._id, sku: 'P1003', name: products['P1003'].name, unitPrice: products['P1003'].price, qty: 2 },
      ],
      subtotal: products['P1003'].price * 2,
      discount: 0,
      vat: 0,
      total: products['P1003'].price * 2,
    },
    createdBy: cashier1._id,
    cashierName: cashier1.username,
    status: 'pending',
  })

  // ACTIVITY LOGS (samples)
  await ActivityLog.create([
    { action: 'user.create', actorUsername: 'admin', actorRole: 'admin', targetUsername: 'jubs', method: 'POST', path: '/api/protect/users', status: 201 },
    { action: 'product.create', actorUsername: 'admin', actorRole: 'admin', method: 'POST', path: '/api/protect/products', status: 201, details: { sku: 'P1001' } },
    { action: 'sales.create', actorUsername: cashier1.username, actorRole: 'cashier', method: 'POST', path: '/api/protect/sales', status: 201, details: { invoiceNo: sale1.invoiceNo } },
    { action: 'refund.create', actorUsername: 'admin', actorRole: 'admin', method: 'POST', path: '/api/protect/refunds', status: 201, details: { invoiceNo: sale1.invoiceNo } },
  ])

  // DASHBOARD STATS (mock)
  const todayTotal = Number(sale1.total || 0) + Number(sale2.total || 0)
  await DashboardStat.findOneAndUpdate(
    { statKey: 'main_dashboard' },
    {
      $set: {
        dailySales: todayTotal,
        monthlySales: Math.round(todayTotal * 22),
        yearlySales: Math.round(todayTotal * 12 * 10 / 2),
        popularProducts: [
          { sku: 'P1001', name: products['P1001'].name, sold: 2 },
          { sku: 'P3001', name: products['P3001'].name, sold: 5 },
        ],
        lowStockProducts: await Product.find({ $expr: { $lt: ["$stock", "$reorderLevel"] } }).select('sku name stock reorderLevel').lean(),
        lastUpdatedAt: new Date(),
      }
    },
    { upsert: true }
  )

  console.log('Seed completed:')
  console.log('- Users:', await User.countDocuments())
  console.log('- Products:', await Product.countDocuments())
  console.log('- Sales:', await Sale.countDocuments())
  console.log('- Refunds:', await Refund.countDocuments())
  console.log('- StockIn/Out/Audit:', await StockInLog.countDocuments(), await StockOutLog.countDocuments(), await StockAuditLog.countDocuments())
  console.log('- Discounts:', await Discount.countDocuments())
  console.log('- PendingPayments:', await PendingPayment.countDocuments())

  await disconnect()
}

main().catch(async (e) => { console.error(e); try { await disconnect() } catch {} ; process.exit(1) })
