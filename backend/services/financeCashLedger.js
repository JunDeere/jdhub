const Transaction = require('../models/Transaction');

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function summarizeCashTransactions(forecast, transactions = []) {
  const baseline = Number(forecast?.starting_balance || 0);
  const currency = String(forecast?.currency || 'PHP').toUpperCase();
  let income = 0;
  let expense = 0;
  let transactionCount = 0;

  transactions.forEach((transaction) => {
    if (String(transaction.currency || 'PHP').toUpperCase() !== currency) return;
    if (transaction.type === 'income') income += Number(transaction.amount || 0);
    if (transaction.type === 'expense') expense += Number(transaction.amount || 0);
    if (transaction.type === 'income' || transaction.type === 'expense') transactionCount += 1;
  });

  const netChange = income - expense;
  return {
    baseline_balance: roundMoney(baseline),
    anchor_at: forecast?.cash_anchor_at || forecast?.as_of_date || null,
    income: roundMoney(income),
    expense: roundMoney(expense),
    net_change: roundMoney(netChange),
    current_balance: roundMoney(baseline + netChange),
    transaction_count: transactionCount,
  };
}

async function ensureCashAnchor(forecast) {
  if (!forecast || forecast.cash_anchor_at) return false;

  // Existing forecasts used starting_balance as a current snapshot. Anchoring at
  // migration time preserves that visible balance and lets new ledger entries
  // move it without replaying historical transactions that may already be included.
  forecast.cash_anchor_at = new Date();
  await forecast.save();
  return true;
}

async function getCashPosition(forecast, userId) {
  if (!forecast) return null;
  await ensureCashAnchor(forecast);

  const transactions = await Transaction.find({
    user_id: userId,
    createdAt: { $gt: forecast.cash_anchor_at },
    currency: String(forecast.currency || 'PHP').toUpperCase(),
    type: { $in: ['income', 'expense'] },
  }).select('type amount currency').lean();

  return summarizeCashTransactions(forecast, transactions);
}

module.exports = { ensureCashAnchor, getCashPosition, roundMoney, summarizeCashTransactions };
