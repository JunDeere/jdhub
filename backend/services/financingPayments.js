const mongoose = require('mongoose');
const FinanceForecast = require('../models/FinanceForecast');
const Transaction = require('../models/Transaction');

function paymentError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function dueDateForMonth(reference, dueDay, monthOffset = 0) {
  const value = new Date(reference);
  const monthStart = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + monthOffset, 1));
  const lastDay = new Date(Date.UTC(
    monthStart.getUTCFullYear(),
    monthStart.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  return new Date(Date.UTC(
    monthStart.getUTCFullYear(),
    monthStart.getUTCMonth(),
    Math.min(Number(dueDay), lastDay),
  ));
}

function shiftDueDate(value, months, dueDay) {
  return dueDateForMonth(value, dueDay, Number(months));
}

function financingCycleStatus(item, now = new Date()) {
  if ((item.remaining_balance != null && Number(item.remaining_balance) <= 0)
    || (item.installments_remaining != null && Number(item.installments_remaining) <= 0)) {
    return {
      cycle_status: 'paid_off',
      next_due_date: null,
      paid_through_date: item.next_due_date && item.due_day
        ? shiftDueDate(item.next_due_date, -1, item.due_day)
        : null,
    };
  }

  if (!item.due_day) {
    return { cycle_status: 'unscheduled', next_due_date: null, paid_through_date: null };
  }

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
  const nextDue = item.next_due_date
    ? new Date(item.next_due_date)
    : dueDateForMonth(today, item.due_day);

  if (nextDue >= nextMonthStart) {
    return {
      cycle_status: 'paid',
      next_due_date: nextDue,
      paid_through_date: shiftDueDate(nextDue, -1, item.due_day),
    };
  }
  if (nextDue < currentMonthStart || nextDue < today) {
    return { cycle_status: 'overdue', next_due_date: nextDue, paid_through_date: null };
  }
  if (nextDue.getTime() === today.getTime()) {
    return { cycle_status: 'due_today', next_due_date: nextDue, paid_through_date: null };
  }
  return { cycle_status: 'upcoming', next_due_date: nextDue, paid_through_date: null };
}

function applyItemAdjustment(item, amountDelta, installmentDelta, referenceDate = new Date()) {
  let nextBalance = item.remaining_balance;
  let nextInstallments = item.installments_remaining;

  if (item.remaining_balance != null) {
    nextBalance = Number(item.remaining_balance) - Number(amountDelta || 0);
    if (nextBalance < -0.005) {
      throw paymentError(`Payment exceeds the remaining balance for ${item.name}`);
    }
  }

  if (item.installments_remaining != null && installmentDelta) {
    nextInstallments = Number(item.installments_remaining) - Number(installmentDelta);
    if (nextInstallments < 0) {
      throw paymentError(`Installments paid exceed the payments remaining for ${item.name}`);
    }
  }

  if (item.remaining_balance != null) item.remaining_balance = Number(Math.max(0, nextBalance).toFixed(2));
  if (item.installments_remaining != null && installmentDelta) item.installments_remaining = nextInstallments;

  if (item.due_day && installmentDelta) {
    const currentDue = item.next_due_date
      ? new Date(item.next_due_date)
      : dueDateForMonth(referenceDate, item.due_day);
    item.next_due_date = shiftDueDate(currentDue, installmentDelta, item.due_day);
  }
}

async function hydrateFinancingSchedules(forecast, userId) {
  const missing = (forecast?.financing || []).filter((item) => item.due_day && !item.next_due_date);
  if (!missing.length) return false;

  const missingIds = missing.map((item) => item._id);
  const payments = await Transaction.find({
    user_id: userId,
    type: 'expense',
    financing_item_id: { $in: missingIds },
  }).sort({ date: 1, createdAt: 1 });

  let changed = false;
  missing.forEach((item) => {
    const linked = payments.filter((payment) => String(payment.financing_item_id) === String(item._id));
    if (!linked.length) return;
    const installments = linked.reduce(
      (total, payment) => total + Number(payment.financing_installments_paid || 1),
      0,
    );
    const firstDue = dueDateForMonth(linked[0].date, item.due_day);
    item.next_due_date = shiftDueDate(firstDue, installments, item.due_day);
    changed = true;
  });

  if (changed) await forecast.save();
  return changed;
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
    applyItemAdjustment(
      nextItem,
      Number(nextPayment.amount) - Number(previousPayment.amount),
      Number(nextPayment.installments || 1) - Number(previousPayment.installments || 1),
      nextPayment.date || previousPayment.date,
    );
  } else {
    if (previousItem) applyItemAdjustment(
      previousItem,
      -Number(previousPayment.amount),
      -Number(previousPayment.installments || 1),
      previousPayment.date,
    );
    if (nextItem) applyItemAdjustment(
      nextItem,
      Number(nextPayment.amount),
      Number(nextPayment.installments || 1),
      nextPayment.date,
    );
  }

  await forecast.save();
  return forecast;
}

module.exports = {
  applyItemAdjustment,
  dueDateForMonth,
  financingCycleStatus,
  hydrateFinancingSchedules,
  moveFinancingPayment,
  shiftDueDate,
};
