// Simple Mongo connection helper for scripts
require('dotenv').config()
const mongoose = require('mongoose')

const uri = process.env.MONGO_URI
if (!uri) {
  console.error('MONGO_URI is not set in .env')
  process.exit(1)
}

async function connect() {
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  return mongoose
}

async function disconnect() {
  await mongoose.disconnect()
}

module.exports = { connect, disconnect } 
