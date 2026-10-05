const assert = require('node:assert/strict');
const { test } = require('node:test');
const { quotaViolation, storageView } = require('../services/fileQuotaPolicy');

const GB = 1024 ** 3;

test('administrators see combined usage against the full storage pool', () => {
  const result = storageView({
    isAdmin: true,
    totalUsedBytes: 42 * GB,
    userUsedBytes: 2 * GB,
    totalQuotaBytes: 300 * GB,
    userQuotaBytes: 10 * GB,
  });
  assert.equal(result.scope, 'system');
  assert.equal(result.usedBytes, 42 * GB);
  assert.equal(result.quotaBytes, 300 * GB);
  assert.equal(result.personalUsedBytes, 2 * GB);
});

test('members see only their personal usage and allowance', () => {
  const result = storageView({
    isAdmin: false,
    totalUsedBytes: 42 * GB,
    userUsedBytes: 2 * GB,
    totalQuotaBytes: 300 * GB,
    userQuotaBytes: 10 * GB,
  });
  assert.equal(result.scope, 'personal');
  assert.equal(result.usedBytes, 2 * GB);
  assert.equal(result.quotaBytes, 10 * GB);
  assert.equal(result.totalUsedBytes, undefined);
});

test('administrator bypasses the member allowance but not the hard pool limit', () => {
  assert.equal(quotaViolation({
    isAdmin: true,
    totalUsedBytes: 20 * GB,
    userUsedBytes: 10 * GB,
    uploadBytes: 1,
    totalQuotaBytes: 300 * GB,
    userQuotaBytes: 10 * GB,
  }), null);

  const violation = quotaViolation({
    isAdmin: true,
    totalUsedBytes: 300 * GB,
    userUsedBytes: 10 * GB,
    uploadBytes: 1,
    totalQuotaBytes: 300 * GB,
    userQuotaBytes: 10 * GB,
  });
  assert.equal(violation.status, 507);
});

test('member uploads remain constrained by the personal allowance', () => {
  const violation = quotaViolation({
    isAdmin: false,
    totalUsedBytes: 20 * GB,
    userUsedBytes: 10 * GB,
    uploadBytes: 1,
    totalQuotaBytes: 300 * GB,
    userQuotaBytes: 10 * GB,
  });
  assert.equal(violation.status, 413);
});
