const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

function csv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function configuredAllowedOrigins(env = process.env) {
  const configured = csv(env.CORS_ORIGINS || env.CORS_ORIGIN);

  if (!configured.length) {
    if (env.APP_ENV === 'production') {
      throw new Error('CORS_ORIGINS must contain at least one exact origin in production');
    }
    return [];
  }

  return [...new Set(configured.map((origin) => {
    if (origin === '*') {
      throw new Error('CORS_ORIGINS cannot contain a wildcard');
    }

    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }

    const hasUnexpectedParts = parsed.username
      || parsed.password
      || (parsed.pathname && parsed.pathname !== '/')
      || parsed.search
      || parsed.hash;
    if (!['http:', 'https:'].includes(parsed.protocol) || hasUnexpectedParts) {
      throw new Error(`CORS origin must be an exact HTTP(S) origin: ${origin}`);
    }

    return parsed.origin;
  }))];
}

function corsOptions(env = process.env) {
  const allowedOrigins = configuredAllowedOrigins(env);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      const error = new Error('Origin is not allowed by JDHub CORS policy');
      error.code = 'CORS_ORIGIN_DENIED';
      error.status = 403;
      callback(error);
    },
    credentials: true,
  };
}

function createCorsMiddleware(env = process.env) {
  return cors(corsOptions(env));
}

function corsErrorHandler(error, req, res, next) {
  if (error?.code !== 'CORS_ORIGIN_DENIED') {
    next(error);
    return;
  }

  res.status(403).json({ error: 'Browser origin is not allowed' });
}

function securityHeaders() {
  return helmet({
    crossOriginEmbedderPolicy: false,
  });
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function apiRateLimit(env = process.env) {
  return rateLimit({
    windowMs: positiveInteger(env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    limit: positiveInteger(env.API_RATE_LIMIT_MAX, 600),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS',
    message: {
      error: 'Too many API requests. Please wait and try again.',
    },
  });
}

function authRateLimit(env = process.env) {
  return rateLimit({
    windowMs: positiveInteger(env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    limit: positiveInteger(env.AUTH_RATE_LIMIT_MAX, 20),
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
  apiRateLimit,
  authRateLimit,
  configuredAllowedOrigins,
  corsErrorHandler,
  corsOptions,
  createCorsMiddleware,
  demoAiRateLimit,
  corsMiddleware: createCorsMiddleware(),
  securityHeaders,
};
