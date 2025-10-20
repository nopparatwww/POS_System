const mongoose = require('mongoose');

// Per-user permission document
// Strategy: allowRoutes is a whitelist of route keys the user may access in addition to their base role.
// denyRoutes explicitly forbids some route keys even if role would allow them (deny wins).
// Route keys are app-defined strings like: 'admin.dashboard', 'admin.permissions', 'sales.home', 'warehouse.home'
const permissionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
    allowRoutes: { type: [String], default: [] },
    denyRoutes: { type: [String], default: [] },
    notes: { type: String },
    updatedBy: { type: String }, // store username of admin who last updated
  },
  { timestamps: true }
);

module.exports = mongoose.model('Permission', permissionSchema);
