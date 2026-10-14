const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const { configurationChecks, configuredTargets, scorePosture } = require('../services/securityPosture');

const original = {
  APP_ENV: process.env.APP_ENV,
  JWT_SECRET: process.env.JWT_SECRET,
  ALLOW_REGISTRATION: process.env.ALLOW_REGISTRATION,
  EMAIL_AUTH_REQUIRED: process.env.EMAIL_AUTH_REQUIRED,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
  TRUST_PROXY: process.env.TRUST_PROXY,
  API_RATE_LIMIT_MAX: process.env.API_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_MAX: process.env.AUTH_RATE_LIMIT_MAX,
  SECURITY_MONITORED_SERVICES: process.env.SECURITY_MONITORED_SERVICES,
};

afterEach(() => {
  Object.entries(original).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
});

test('security posture rewards hardened application settings', () => {
  process.env.APP_ENV = 'production';
  process.env.JWT_SECRET = 'c'.repeat(64);
  process.env.ALLOW_REGISTRATION = 'false';
  process.env.EMAIL_AUTH_REQUIRED = 'true';
  process.env.CORS_ORIGINS = 'https://jdhub.example.com';
  process.env.TRUST_PROXY = '1';
  process.env.API_RATE_LIMIT_MAX = '600';
  process.env.AUTH_RATE_LIMIT_MAX = '20';

  const checks = configurationChecks();
  assert.equal(checks.every((check) => check.status === 'pass'), true);
  assert.deepEqual(scorePosture(checks), { score: 100, level: 'good' });
});

test('security posture rejects malformed browser origins and unsafe API limits', () => {
  process.env.CORS_ORIGINS = 'https://jdhub.example.com/api';
  process.env.API_RATE_LIMIT_MAX = '5000';

  const checks = configurationChecks();
  assert.equal(checks.find((check) => check.id === 'cors').status, 'critical');
  assert.equal(checks.find((check) => check.id === 'api-rate-limit').status, 'warning');
});

test('security posture penalizes critical settings and active risk signals', () => {
  const checks = [
    { status: 'critical', weight: 25 },
    { status: 'warning', weight: 10 },
  ];
  assert.deepEqual(
    scorePosture(checks, { failures24h: 3, passwordOnlyUsers: 1, serviceRisks: 2 }),
    { score: 49, level: 'high-risk' },
  );
});

test('monitored service targets can be configured without user input', () => {
  process.env.SECURITY_MONITORED_SERVICES = 'App|https://app.example.com,Invalid|file:///tmp/test';
  assert.deepEqual(configuredTargets(), [{ name: 'App', url: 'https://app.example.com' }]);
});
