const { configuredAllowedOrigins } = require('../config/security');

const DEFAULT_TARGETS = [
  ['JDHub', 'https://jdhub.jdeere.net'],
  ['TindaHub', 'https://tindahub.jdeere.net'],
  ['n8n', 'https://n8n.jdeere.net'],
  ['Kilos', 'https://kilos.jdeere.net'],
];

function configuredTargets() {
  const raw = String(process.env.SECURITY_MONITORED_SERVICES || '').trim();
  if (!raw) return DEFAULT_TARGETS.map(([name, url]) => ({ name, url }));
  return raw.split(',').map((entry) => {
    const [name, url] = entry.split('|').map((value) => value.trim());
    return { name, url };
  }).filter((entry) => entry.name && /^https?:\/\//i.test(entry.url));
}

function configurationChecks() {
  let corsValid = false;
  try {
    corsValid = configuredAllowedOrigins(process.env).length > 0;
  } catch {
    corsValid = false;
  }
  const jwtSecret = String(process.env.JWT_SECRET || '');
  const production = process.env.APP_ENV === 'production';
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET);
  const apiRateLimit = Number(process.env.API_RATE_LIMIT_MAX || 600);
  return [
    {
      id: 'production-mode',
      label: 'Production mode',
      status: production ? 'pass' : 'warning',
      detail: production ? 'Production security behavior is enabled.' : 'APP_ENV is not set to production.',
      recommendation: 'Set APP_ENV=production on internet-facing deployments.',
      weight: 8,
    },
    {
      id: 'jwt-secret',
      label: 'Signing secret',
      status: jwtSecret.length >= 48 && !/change|secret|example/i.test(jwtSecret) ? 'pass' : 'critical',
      detail: jwtSecret.length >= 48 && !/change|secret|example/i.test(jwtSecret)
        ? 'The authentication signing secret has adequate length.'
        : 'The authentication signing secret is weak or looks like a placeholder.',
      recommendation: 'Use a unique random JWT_SECRET of at least 48 characters.',
      weight: 25,
    },
    {
      id: 'registration',
      label: 'Public registration',
      status: process.env.ALLOW_REGISTRATION === 'true' ? 'critical' : 'pass',
      detail: process.env.ALLOW_REGISTRATION === 'true' ? 'Anyone can attempt to register an account.' : 'Public account registration is disabled.',
      recommendation: 'Keep ALLOW_REGISTRATION=false and create members from Administration.',
      weight: 20,
    },
    {
      id: 'email-verification',
      label: 'Email sign-in verification',
      status: process.env.EMAIL_AUTH_REQUIRED === 'true' ? 'pass' : 'warning',
      detail: process.env.EMAIL_AUTH_REQUIRED === 'true' ? 'Email verification is required on untrusted browsers.' : 'The server-wide email verification switch is off.',
      recommendation: 'Set EMAIL_AUTH_REQUIRED=true after SMTP is confirmed.',
      weight: 12,
    },
    {
      id: 'cors',
      label: 'Browser origin policy',
      status: corsValid ? 'pass' : 'critical',
      detail: corsValid ? 'Browser access is restricted to valid named origins.' : 'Browser access is missing a valid explicit origin allowlist.',
      recommendation: 'Set CORS_ORIGINS to the exact HTTPS application origins.',
      weight: 18,
    },
    {
      id: 'proxy',
      label: 'Reverse-proxy trust',
      status: !production || Number(process.env.TRUST_PROXY || 0) > 0 ? 'pass' : 'warning',
      detail: Number(process.env.TRUST_PROXY || 0) > 0 ? 'Proxy-aware client IP handling is enabled.' : 'Proxy trust is disabled.',
      recommendation: 'Set TRUST_PROXY only to the exact number of trusted reverse proxies.',
      weight: 7,
    },
    {
      id: 'google-token-encryption',
      label: 'Google token encryption',
      status: !googleConfigured || String(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '').length >= 32 ? 'pass' : 'critical',
      detail: !googleConfigured || String(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || '').length >= 32
        ? 'Connected Google credentials are protected at rest.'
        : 'Google OAuth is configured without an adequate encryption key.',
      recommendation: 'Set GOOGLE_TOKEN_ENCRYPTION_KEY to a strong random value.',
      weight: 20,
    },
    {
      id: 'auth-rate-limit',
      label: 'Sign-in rate limit',
      status: Number(process.env.AUTH_RATE_LIMIT_MAX || 20) <= 30 ? 'pass' : 'warning',
      detail: `Sign-in attempts are limited to ${Number(process.env.AUTH_RATE_LIMIT_MAX || 20)} per window.`,
      recommendation: 'Keep the authentication limit at 30 attempts or fewer per window.',
      weight: 8,
    },
    {
      id: 'api-rate-limit',
      label: 'API request limit',
      status: Number.isFinite(apiRateLimit) && apiRateLimit > 0 && apiRateLimit <= 2000 ? 'pass' : 'warning',
      detail: Number.isFinite(apiRateLimit) && apiRateLimit > 0
        ? `API clients are limited to ${apiRateLimit} requests per window.`
        : 'The API request limit is invalid and will use the safe default.',
      recommendation: 'Keep API_RATE_LIMIT_MAX at 2,000 requests or fewer per window.',
      weight: 6,
    },
  ];
}

function scorePosture(checks, { failures24h = 0, passwordOnlyUsers = 0, serviceRisks = 0 } = {}) {
  let score = 100;
  checks.forEach((check) => {
    if (check.status === 'critical') score -= check.weight;
    if (check.status === 'warning') score -= Math.ceil(check.weight / 2);
  });
  score -= Math.min(20, Number(failures24h || 0) * 2);
  score -= Math.min(15, Number(passwordOnlyUsers || 0) * 5);
  score -= Math.min(20, Number(serviceRisks || 0) * 5);
  score = Math.max(0, score);
  const level = score >= 85 ? 'good' : score >= 65 ? 'attention' : 'high-risk';
  return { score, level };
}

function headerState(headers, name) {
  return Boolean(headers?.get?.(name));
}

async function checkService(target) {
  const started = Date.now();
  try {
    const response = await fetch(target.url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'JDHub-Security-Monitor/1.0' },
    });
    const https = new URL(response.url || target.url).protocol === 'https:';
    const reachable = response.status > 0 && response.status < 500;
    return {
      ...target,
      reachable,
      statusCode: response.status,
      https,
      latencyMs: Date.now() - started,
      headers: {
        hsts: headerState(response.headers, 'strict-transport-security'),
        csp: headerState(response.headers, 'content-security-policy'),
        noSniff: String(response.headers.get('x-content-type-options') || '').toLowerCase() === 'nosniff',
        frameProtection: headerState(response.headers, 'x-frame-options')
          || /frame-ancestors/i.test(response.headers.get('content-security-policy') || ''),
      },
      checkedAt: new Date(),
    };
  } catch (error) {
    return {
      ...target,
      reachable: false,
      statusCode: null,
      https: target.url.startsWith('https://'),
      latencyMs: Date.now() - started,
      headers: { hsts: false, csp: false, noSniff: false, frameProtection: false },
      error: error.name === 'TimeoutError' ? 'Timed out' : 'Unreachable',
      checkedAt: new Date(),
    };
  }
}

async function checkMonitoredServices() {
  return Promise.all(configuredTargets().map(checkService));
}

module.exports = {
  checkMonitoredServices,
  configurationChecks,
  configuredTargets,
  scorePosture,
};
