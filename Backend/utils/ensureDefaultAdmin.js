const User = require('../models/user');
const Permission = require('../models/permission');

const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin29';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin29';

async function ensureDefaultAdmin() {
  try {
    const existing = await User.findOne({ username: DEFAULT_ADMIN_USERNAME });
    if (existing) {
      return;
    }

    const user = new User({
      username: DEFAULT_ADMIN_USERNAME,
      role: 'admin',
      firstName: 'Default',
      lastName: 'Admin',
      email: 'admin@example.com',
    });
    await user.setPassword(DEFAULT_ADMIN_PASSWORD);
    await user.save();

    const existingPerm = await Permission.findOne({ user: user._id });
    if (!existingPerm) {
      await Permission.create({
        user: user._id,
        allowRoutes: [],
        denyRoutes: [],
        notes: 'default admin created on startup',
      });
    }

    console.log(`Default admin user created: ${DEFAULT_ADMIN_USERNAME}`);
  } catch (err) {
    console.error('Failed to ensure default admin user:', err);
  }
}

module.exports = { ensureDefaultAdmin };
