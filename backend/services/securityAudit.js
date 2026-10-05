const crypto = require('crypto');
const SecurityEvent = require('../models/SecurityEvent');

function clientIp(req) {
  if (Number(process.env.TRUST_PROXY || 0) > 0) {
    const cloudflareIp = String(req.get('cf-connecting-ip') || '').trim();
    if (cloudflareIp) return cloudflareIp;
  }
  return String(req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
}

function requestContext(req) {
  return {
    ip: clientIp(req),
    user_agent: String(req.get('user-agent') || 'Unknown browser').slice(0, 500),
    host: String(req.get('host') || '').slice(0, 255),
  };
}

function tokenHash(value) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'local-development-secret')
    .update(String(value))
    .digest('hex');
}

function parseCookies(req) {
  return String(req.headers.cookie || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf('=');
      if (separator < 0) return cookies;
      cookies[decodeURIComponent(part.slice(0, separator))] = decodeURIComponent(part.slice(separator + 1));
      return cookies;
    }, {});
}

async function recordSecurityEvent(req, event) {
  try {
    await SecurityEvent.create({ ...requestContext(req), ...event });
  } catch (error) {
    console.error('Security audit write failed:', error.message);
  }
}

module.exports = {
  clientIp,
  parseCookies,
  recordSecurityEvent,
  requestContext,
  tokenHash,
};
