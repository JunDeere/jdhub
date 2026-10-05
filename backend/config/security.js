const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

function csv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function corsOptions() {
  const allowedOrigins = csv(process.env.CORS_ORIGIN || process.env.CORS_ORIGINS);

  if (!allowedOrigins.length) {
    return {
      origin: true,
      credentials: true,
    };
  }

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by JDHub CORS policy'));
    },
    credentials: true,
  };
}

function securityHeaders() {
  return helmet({
    crossOriginEmbedderPolicy: false,
  });
}

function authRateLimit() {
  return rateLimit({
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: 'Too many auth attempts. Please wait and try again.',
    },
  });
}

function demoAiRateLimit() {
  return rateLimit({
    windowMs: Number(process.env.DEMO_AI_RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000),
    limit: Number(process.env.DEMO_AI_RATE_LIMIT_MAX || 20),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => !req.isDemo,
    keyGenerator: (req) => `demo:${req.userId}`,
    message: {
      error: 'The public demo AI limit has been reached. Please try again later.',
    },
  });
}

module.exports = {
  authRateLimit,
  demoAiRateLimit,
  corsMiddleware: cors(corsOptions()),
  securityHeaders,
};
