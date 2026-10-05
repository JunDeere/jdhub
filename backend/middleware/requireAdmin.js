const User = require('../models/User');
const { roleForEmail } = require('../services/siteRoles');

async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.userId).select('email role').lean();
    const isAdmin = user && (user.role === 'admin' || roleForEmail(user.email) === 'admin');
    if (!isAdmin) return res.status(403).json({ error: 'Administrator access required' });
    req.isAdmin = true;
    return next();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = requireAdmin;
