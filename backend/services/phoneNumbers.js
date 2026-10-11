const { parsePhoneNumberFromString } = require('libphonenumber-js/min');

function normalizePhoneNumber(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  if (!input.startsWith('+')) {
    throw new Error('Phone number must include an international country calling code');
  }

  const phone = parsePhoneNumberFromString(input);
  if (!phone?.country || !phone.isValid()) {
    throw new Error('Enter a valid phone number for the selected country');
  }
  return phone.number;
}

module.exports = { normalizePhoneNumber };
