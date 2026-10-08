const mongoose = require('mongoose');
const FinanceForecast = require('../models/FinanceForecast');

function paymentError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function applyItemAdjustment(item, amountDelta, installmentDelta) {
  if (item.remaining_balance != null) {
    const nextBalance = Number(item.remaining_balance) - Number(amountDelta || 0);
    if (nextBalance < -0.005) {
      throw paymentError(`Payment exceeds the remaining balance for ${item.name}`);
    }
    item.remaining_balance = Number(Math.max(0, nextBalance).toFixed(2));
  }

  if (item.installments_remaining != null && installmentDelta) {
    item.installments_remaining = Math.max(
      0,
      Number(item.installments_remaining) - Number(installmentDelta),
    );
  }
}

async function moveFinancingPayment(userId, previousPayment, nextPayment) {
  const previousId = previousPayment?.financingItemId?.toString();
  const nextId = nextPayment?.financingItemId?.toString();
  if (!previousId && !nextId) return null;

  if ((previousId && !mongoose.isValidObjectId(previousId)) || (nextId && !mongoose.isValidObjectId(nextId))) {
    throw paymentError('Invalid financing account');
  }

  const forecast = await FinanceForecast.findOne({
    user_id: userId,
    archived_at: { $exists: false },
  }).sort({ as_of_date: -1, createdAt: -1 });
  if (!forecast) throw paymentError('No active finance forecast was found', 404);

  const previousItem = previousId ? forecast.financing.id(previousId) : null;
  const nextItem = nextId ? forecast.financing.id(nextId) : null;
  if (previousId && !previousItem) throw paymentError('The previous financing account no longer exists', 409);
  if (nextId && !nextItem) throw paymentError('Financing account not found', 404);

  if (previousId && previousId === nextId) {
    applyItemAdjustment(nextItem, Number(nextPayment.amount) - Number(previousPayment.amount), 0);
  } else {
    if (previousItem) applyItemAdjustment(previousItem, -Number(previousPayment.amount), -1);
    if (nextItem) applyItemAdjustment(nextItem, Number(nextPayment.amount), 1);
  }

  await forecast.save();
  return forecast;
}

module.exports = { applyItemAdjustment, moveFinancingPayment };
