export function requiredText(value, label) {
  return String(value || '').trim() ? '' : `${label} is required.`;
}

export function positiveNumber(value, label) {
  const number = Number(value);
  if (value === '' || value === null || value === undefined) return `${label} is required.`;
  if (!Number.isFinite(number) || number <= 0) return `${label} must be greater than zero.`;
  return '';
}

export function exactLength(value, length, label) {
  return String(value || '').trim().length === length ? '' : `${label} must be ${length} characters.`;
}

export function dateOrder(startValue, endValue, label) {
  if (!startValue || !endValue) return '';
  return new Date(endValue).getTime() >= new Date(startValue).getTime()
    ? ''
    : `${label} must be after the start time.`;
}

export function hasValidationErrors(errors) {
  return Object.values(errors).some(Boolean);
}
