module.exports = function ensureAdmin(req, res, next) {
  try {
    const role = req.user?.role;
    if (role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    next();
  } catch (e) {
    return res.status(403).json({ message: 'Forbidden' });
  }
}
