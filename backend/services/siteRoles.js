const User = require('../models/User');

const DEFAULT_ADMIN_EMAIL = 'jundell.ggare@gmail.com';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function adminEmail() {
  return normalizeEmail(process.env.SITE_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL);
}

function roleForEmail(email) {
  return normalizeEmail(email) === adminEmail() ? 'admin' : 'member';
}

async function ensureUserRole(user) {
  if (!user) return user;
  const desiredRole = roleForEmail(user.email);
  if (desiredRole === 'admin' && user.role !== 'admin') {
    user.role = 'admin';
    await user.save();
  } else if (!user.role) {
    user.role = 'member';
    await user.save();
  }
  return user;
}

async function syncSiteRoles() {
  await User.updateMany(
    { $or: [{ role: { $exists: false } }, { role: null }] },
    { $set: { role: 'member' } },
  );
  await User.updateOne(
    { email: adminEmail() },
    { $set: { role: 'admin' } },
  );
}

module.exports = {
  DEFAULT_ADMIN_EMAIL,
  adminEmail,
  ensureUserRole,
  normalizeEmail,
  roleForEmail,
  syncSiteRoles,
};
