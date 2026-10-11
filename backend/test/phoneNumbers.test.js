const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalizePhoneNumber } = require('../services/phoneNumbers');

test('phone numbers are normalized and validated by country metadata', () => {
  assert.equal(normalizePhoneNumber('+63 917 123 4567'), '+639171234567');
  assert.equal(normalizePhoneNumber('+1 (416) 555-0123'), '+14165550123');
  assert.equal(normalizePhoneNumber(''), '');
  assert.throws(() => normalizePhoneNumber('+63 123'), /valid phone number/);
  assert.throws(() => normalizePhoneNumber('09171234567'), /country calling code/);
});
