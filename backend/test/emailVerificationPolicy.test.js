const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const {
  emailAuthEnabled,
  emailVerificationRequired,
} = require('../services/securityEmail');

const originalSetting = process.env.EMAIL_AUTH_REQUIRED;

after(() => {
  if (originalSetting === undefined) delete process.env.EMAIL_AUTH_REQUIRED;
  else process.env.EMAIL_AUTH_REQUIRED = originalSetting;
});

test('global email verification setting acts as the master switch', () => {
  process.env.EMAIL_AUTH_REQUIRED = 'false';
  assert.equal(emailAuthEnabled(), false);
  assert.equal(emailVerificationRequired({ is_demo: false }), false);

  process.env.EMAIL_AUTH_REQUIRED = 'true';
  assert.equal(emailAuthEnabled(), true);
  assert.equal(emailVerificationRequired({ is_demo: false }), true);
});

test('per-account policy can disable verification while demo remains exempt', () => {
  process.env.EMAIL_AUTH_REQUIRED = 'true';

  assert.equal(
    emailVerificationRequired({
      is_demo: false,
      email_verification_required: false,
    }),
    false,
  );
  assert.equal(
    emailVerificationRequired({
      is_demo: false,
      email_verification_required: true,
    }),
    true,
  );
  assert.equal(
    emailVerificationRequired({
      is_demo: true,
      email_verification_required: true,
    }),
    false,
  );
});
