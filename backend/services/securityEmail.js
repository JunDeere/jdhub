const nodemailer = require('nodemailer');

function emailAuthEnabled() {
  return process.env.EMAIL_AUTH_REQUIRED === 'true';
}

function emailVerificationRequired(user) {
  return emailAuthEnabled()
    && !user?.is_demo
    && user?.email_verification_required !== false;
}

function createTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
}

async function sendLoginCode({ email, code, ip, userAgent }) {
  const transport = createTransport();
  if (!transport) {
    throw new Error('Email verification is enabled, but SMTP is not configured');
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transport.sendMail({
    from,
    to: email,
    subject: 'Your JDHub sign-in code',
    text: [
      `Your JDHub sign-in code is ${code}.`,
      '',
      'It expires in 10 minutes and can only be used once.',
      `Request IP: ${ip}`,
      `Browser: ${userAgent}`,
      '',
      'If this was not you, do not share this code and contact the administrator.',
    ].join('\n'),
  });
}

module.exports = { emailAuthEnabled, emailVerificationRequired, sendLoginCode };
