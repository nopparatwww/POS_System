const mongoose = require('mongoose')

const ActivityLogSchema = new mongoose.Schema({
  action: { type: String, required: true }, // e.g., 'user.create', 'user.update', 'permissions.update'
  actorUsername: { type: String, required: true },
  actorRole: { type: String, required: true },
  targetUsername: { type: String },
  method: { type: String },
  path: { type: String },
  status: { type: Number },
  details: { type: Object },
}, { timestamps: true })

module.exports = mongoose.model('ActivityLog', ActivityLogSchema)
