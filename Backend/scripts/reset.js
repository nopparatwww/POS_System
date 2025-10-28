// Danger: resets the Mongo database referenced by MONGO_URI
// Usage (Windows cmd):
//   npm run db:reset
// Optional env flags:
//   DROP_DB=true    -> drop the whole database (default). If false, only clears known collections

const { connect, disconnect } = require('./connect')
const mongoose = require('mongoose')

async function main() {
  const dropAll = String(process.env.DROP_DB || 'true').toLowerCase() === 'true'
  await connect()
  const db = mongoose.connection.db

  if (dropAll) {
    await db.dropDatabase()
    console.log('Database dropped:', db.databaseName)
  } else {
    const toClear = ['users', 'permissions', 'activitylogs']
    for (const name of toClear) {
      try {
        await db.collection(name).deleteMany({})
        console.log('Cleared collection:', name)
      } catch (e) {
        if (e.codeName === 'NamespaceNotFound') console.log('Skip missing collection:', name)
        else console.warn('Warn clearing', name, e.message)
      }
    }
  }

  await disconnect()
}

main().catch(async (e) => { console.error(e); try { await disconnect() } catch {} ; process.exit(1) })
