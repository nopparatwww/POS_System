// Seed initial data: admin accounts and sample users with permissions
// Usage (Windows cmd):
//   npm run db:seed

require('dotenv').config()
const { connect, disconnect } = require('./connect')
const User = require('../models/user')
const Permission = require('../models/permission')

const ALL_KEYS = ['admin.dashboard','admin.permissions','admin.logs','sales.home','warehouse.home']

async function upsertUser({ username, password, role, allowKeys = [], denyKeys = [], notes }) {
  let u = await User.findOne({ username })
  if (!u) u = new User({ username, role })
  else u.role = role
  await u.setPassword(password)
  await u.save()

  await Permission.findOneAndUpdate(
    { user: u._id },
    { $set: { allowRoutes: allowKeys, denyRoutes: denyKeys, notes, updatedBy: 'seed' } },
    { upsert: true }
  )
  return u
}

async function main(){
  await connect()

  // Admins with full access
  await upsertUser({ username: 'admin', password: process.env.ADMIN_DEFAULT_PASS || '123456', role: 'admin', allowKeys: ALL_KEYS, notes: 'seed: full access' })
  await upsertUser({ username: 'admin_2', password: process.env.ADMIN2_DEFAULT_PASS || '123456', role: 'admin', allowKeys: ALL_KEYS, notes: 'seed: full access' })

  // Sample cashier (baseline + explicit allow to be safe)
  await upsertUser({ username: 'jubs', password: '123456', role: 'cashier', allowKeys: ['sales.home'], notes: 'seed: cashier' })

  console.log('Seed completed.')
  await disconnect()
}

main().catch(async (e) => { console.error(e); try { await disconnect() } catch {} ; process.exit(1) })
