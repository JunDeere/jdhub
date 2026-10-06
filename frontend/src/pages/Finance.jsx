import { useEffect, useState } from 'react';
import { getFinanceForecast, updateForecastItemStatus } from '../api/financeForecasts.js';
import { createTransaction, getTransactions, updateTransaction } from '../api/transactions.js';
import StatusToast from '../components/StatusToast.jsx';
import { dateInputToUtcIso, formatLocalDate, toUtcDateInput } from '../utils/dateTime.js';
import { exactLength, hasValidationErrors, positiveNumber, requiredText } from '../utils/formValidation.js';

const transactionTypes = ['expense', 'income', 'transfer'];
const categories = ['Food', 'Transport', 'Bills', 'Utilities', 'Health', 'Work', 'Server', 'Shopping', 'Savings', 'Other'];
const paymentMethods = ['Cash', 'GCash', 'Maya', 'Debit Card', 'Credit Card', 'Bank Transfer', 'Other'];
const financeViews = [
  { id: 'overview', label: 'Overview' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'financing', label: 'Financing' },
  { id: 'transactions', label: 'Transactions' },
];

const emptyForm = {
  type: 'expense',
  amount: '',
  currency: 'PHP',
  category: 'Food',
  date: toUtcDateInput(new Date()),
  merchant_or_source: '',
  payment_method: 'Cash',
  note: '',
  tags: '',
};

function money(value, currency = 'PHP') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function forecastDateLabel(startValue, endValue) {
  const format = (value) => new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));

  if (!endValue) return format(startValue);
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${format(startValue)}–${end.getUTCDate()}`;
  }
  return `${format(startValue)}–${format(endValue)}`;
}

function resolutionLabel(status) {
  return {
    completed: 'Resolved',
    overdue: 'Needs review',
    due_today: 'Due today',
    upcoming: 'Upcoming',
    skipped: 'Skipped',
  }[status] || 'Planned';
}

export default function Finance({ token, refreshKey, onTransactionsChanged }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, transfer: 0, net: 0 });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [forecastError, setForecastError] = useState(null);
  const [updatingForecastItem, setUpdatingForecastItem] = useState(null);
  const [activeView, setActiveView] = useState('overview');

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);

    try {
      const [data, forecastData] = await Promise.all([
        getTransactions(token),
        getFinanceForecast(token),
      ]);
      setTransactions(data.transactions);
      setSummary(data.summary);
      setForecast(forecastData.forecast);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    Promise.all([getTransactions(token), getFinanceForecast(token)])
      .then(([data, forecastData]) => {
        if (cancelled) return;
        setTransactions(data.transactions);
        setSummary(data.summary);
        setForecast(forecastData.forecast);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setForecastError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setForecastLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, refreshKey]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: '' }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFieldErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);

    const nextFieldErrors = {
      amount: positiveNumber(form.amount, 'Amount'),
      currency: exactLength(form.currency, 3, 'Currency code'),
      date: requiredText(form.date, 'Transaction date'),
    };

    if (hasValidationErrors(nextFieldErrors)) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        date: dateInputToUtcIso(form.date),
        tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      };

      if (editingId) {
        await updateTransaction(token, editingId, payload);
        setStatusMessage('Transaction updated.');
      } else {
        await createTransaction(token, payload);
        setStatusMessage('Transaction saved.');
      }

      resetForm();
      await loadTransactions();
      onTransactionsChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (transaction) => {
    setActiveView('transactions');
    setEditingId(transaction._id);
    setForm({
      type: transaction.type || 'expense',
      amount: String(transaction.amount || ''),
      currency: transaction.currency || 'PHP',
      category: transaction.category || 'Other',
      date: transaction.date ? toUtcDateInput(transaction.date) : emptyForm.date,
      merchant_or_source: transaction.merchant_or_source || '',
      payment_method: transaction.payment_method || 'Cash',
      note: transaction.note || '',
      tags: (transaction.tags || []).join(', '),
    });
    setError(null);
    setStatusMessage(null);
  };

  const handleForecastStatus = async (itemId, status) => {
    if (!forecast?._id) return;
    setUpdatingForecastItem(itemId);
    setForecastError(null);
    try {
      const data = await updateForecastItemStatus(token, forecast._id, itemId, status);
      setForecast(data.forecast);
    } catch (err) {
      setForecastError(err.message);
    } finally {
      setUpdatingForecastItem(null);
    }
  };

  return (
    <section className="finance-page">
      <div className="finance-view-tabs" role="tablist" aria-label="Finance views">
        {financeViews.map((view) => (
          <button
            aria-controls={`finance-view-${view.id}`}
            aria-selected={activeView === view.id}
            className={activeView === view.id ? 'active' : ''}
            id={`finance-tab-${view.id}`}
            key={view.id}
            onClick={() => setActiveView(view.id)}
            role="tab"
            type="button"
          >
            {view.label}
          </button>
        ))}
      </div>

      {activeView === 'overview' && (
        <div aria-labelledby="finance-tab-overview" className="finance-view" id="finance-view-overview" role="tabpanel">
          <div className="finance-summary-grid">
            <div className="metric-card">
              <span>Monthly income</span>
              <strong>{money(summary?.income)}</strong>
            </div>
            <div className="metric-card">
              <span>Monthly expense</span>
              <strong>{money(summary?.expense)}</strong>
            </div>
            <div className="metric-card">
              <span>Monthly net</span>
              <strong>{money(summary?.net)}</strong>
            </div>
          </div>

          <div className="finance-overview-grid">
            <section className="panel finance-overview-card">
              <div className="finance-overview-heading">
                <div>
                  <p className="eyebrow">Cash-flow outlook</p>
                  <h3>{forecast?.name || 'Forecast'}</h3>
                </div>
                <button className="secondary-button" onClick={() => setActiveView('forecast')} type="button">View forecast</button>
              </div>
              {forecastLoading ? (
                <p className="muted">Loading forecast…</p>
              ) : forecastError ? (
                <div className="alert-error">{forecastError}</div>
              ) : !forecast ? (
                <p className="muted">No finance forecast has been added yet.</p>
              ) : (
                <div className="forecast-summary-grid finance-overview-summary">
                  <div><span>Current balance</span><strong>{money(forecast.starting_balance, forecast.currency)}</strong></div>
                  <div><span>Planned income</span><strong className="forecast-income">+{money(forecast.summary.total_income, forecast.currency)}</strong></div>
                  <div><span>Planned payments</span><strong className="forecast-expense">−{money(forecast.summary.total_expense, forecast.currency)}</strong></div>
                  <div><span>Projected balance</span><strong>{money(forecast.summary.ending_balance, forecast.currency)}</strong></div>
                </div>
              )}
            </section>

            <section className="panel finance-overview-card">
              <div className="finance-overview-heading">
                <div>
                  <p className="eyebrow">Activity</p>
                  <h3>Recent transactions</h3>
                </div>
                <button className="secondary-button" onClick={() => setActiveView('transactions')} type="button">Open transactions</button>
              </div>
              {loading ? (
                <p className="muted">Loading transactions...</p>
              ) : transactions.length === 0 ? (
                <div className="finance-empty-state">
                  <strong>No transactions yet</strong>
                  <p className="muted">Add your first income or expense to start tracking actual cash flow.</p>
                  <button className="primary-button" onClick={() => setActiveView('transactions')} type="button">Add transaction</button>
                </div>
              ) : (
                <div className="finance-overview-list">
                  {transactions.slice(0, 4).map((transaction) => (
                    <button key={transaction._id} onClick={() => handleEdit(transaction)} type="button">
                      <span><strong>{transaction.merchant_or_source || transaction.note || 'Transaction'}</strong><small>{formatLocalDate(transaction.date)} · {transaction.category}</small></span>
                      <strong className={transaction.type === 'income' ? 'forecast-income' : transaction.type === 'expense' ? 'forecast-expense' : ''}>{money(transaction.amount, transaction.currency)}</strong>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="panel finance-financing-preview">
            <div>
              <p className="eyebrow">Financing</p>
              <h3>Loans and installments</h3>
              <p className="muted">{forecast?.financing?.length || 0} financing records in the current forecast.</p>
            </div>
            <button className="secondary-button" onClick={() => setActiveView('financing')} type="button">View financing</button>
          </section>
        </div>
      )}

      {activeView === 'forecast' && (
        <section aria-labelledby="finance-tab-forecast" className="panel finance-forecast-panel finance-view" id="finance-view-forecast" role="tabpanel">
              <div className="finance-forecast-heading">
            <div>
              <p className="eyebrow">Planned cash flow</p>
              <h3>{forecast?.name || 'Cash-flow Forecast'}</h3>
              {forecast && <p className="muted">{forecast.account_name} snapshot from {formatLocalDate(forecast.as_of_date)}. Forecast entries do not affect actual transaction totals.</p>}
            </div>
                {forecast && <span className="status-pill">Ends at {money(forecast.summary.ending_balance, forecast.currency)}</span>}
              </div>

          {forecastLoading ? (
            <p className="muted">Loading forecast…</p>
          ) : forecastError ? (
            <div className="alert-error">{forecastError}</div>
          ) : !forecast ? (
            <div className="finance-empty-state"><strong>No forecast yet</strong><p className="muted">Add a cash-flow forecast to see upcoming income, payments, and projected balances.</p></div>
          ) : (
            <>
              <div className="forecast-resolver-summary" role="status">
                <div>
                  <span className="eyebrow">Auto resolver</span>
                  <strong>{forecast.resolution?.completed || 0} resolved</strong>
                </div>
                <span>{forecast.resolution?.overdue || 0} need review</span>
                <span>{forecast.resolution?.due_today || 0} due today</span>
                <span>{forecast.resolution?.upcoming || 0} upcoming</span>
                <small>Exact dated transactions are matched automatically. Past items without proof remain unresolved.</small>
              </div>
              <div className="forecast-summary-grid">
                <div><span>Starting balance</span><strong>{money(forecast.starting_balance, forecast.currency)}</strong></div>
                <div><span>Planned income</span><strong className="forecast-income">+{money(forecast.summary.total_income, forecast.currency)}</strong></div>
                <div><span>Planned payments</span><strong className="forecast-expense">−{money(forecast.summary.total_expense, forecast.currency)}</strong></div>
                <div><span>Projected balance</span><strong>{money(forecast.summary.ending_balance, forecast.currency)}</strong></div>
              </div>

              <div className="forecast-table-wrap">
                <table className="forecast-table">
                  <thead><tr><th>Date</th><th>Transaction</th><th>Amount</th><th>Projected balance</th><th>Status</th></tr></thead>
                  <tbody>
                    <tr className="forecast-start-row">
                      <td data-label="Date">Now</td><td data-label="Transaction">Current {forecast.account_name}</td><td data-label="Amount">—</td><td data-label="Projected balance">{money(forecast.starting_balance, forecast.currency)}</td><td data-label="Status">Snapshot</td>
                    </tr>
                    {forecast.items.map((item) => (
                      <tr className={`${item.kind} ${item.resolution_status}`} key={item._id}>
                        <td data-label="Date">{forecastDateLabel(item.date_start, item.date_end)}</td>
                        <td data-label="Transaction"><strong>{item.label}</strong>{item.is_group && <small>Combined payment</small>}</td>
                        <td data-label="Amount">{item.kind === 'income' ? '+' : '−'}{money(item.amount, forecast.currency)}</td>
                        <td data-label="Projected balance">{money(item.projected_balance, forecast.currency)}</td>
                        <td data-label="Status">
                          <span className={`forecast-resolution-badge ${item.resolution_status}`}>{resolutionLabel(item.resolution_status)}</span>
                          <select aria-label={`Status for ${item.label}`} disabled={updatingForecastItem === item._id} onChange={(event) => handleForecastStatus(item._id, event.target.value)} value={item.status}>
                            <option value="planned">Planned</option>
                            <option value="completed">Completed</option>
                            <option value="skipped">Skipped</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {activeView === 'financing' && (
        <section aria-labelledby="finance-tab-financing" className="panel financing-panel finance-view" id="finance-view-financing" role="tabpanel">
          <div>
            <p className="eyebrow">Financing</p>
            <h3>Loan and installment overview</h3>
            <p className="muted">Balances are based on the supplied September 2026 statements.</p>
          </div>
          {forecastLoading ? (
            <p className="muted">Loading financing records…</p>
          ) : forecastError ? (
            <div className="alert-error">{forecastError}</div>
          ) : !forecast?.financing?.length ? (
            <div className="finance-empty-state"><strong>No financing records</strong><p className="muted">Loan and installment details will appear here when they are added to the forecast.</p></div>
          ) : (
            <div className="financing-grid">
              {forecast.financing.map((item) => (
                <article key={item._id}>
                  <div><strong>{item.name}</strong><span>{item.provider || 'Financing'}</span></div>
                  <dl>
                    <div><dt>Remaining</dt><dd>{item.remaining_balance == null ? 'Not provided' : money(item.remaining_balance, forecast.currency)}</dd></div>
                    <div><dt>Payments left</dt><dd>{item.installments_remaining == null ? 'Variable' : item.installments_remaining}</dd></div>
                    <div><dt>Expected payment</dt><dd>{item.estimated_monthly == null ? 'Variable' : money(item.estimated_monthly, forecast.currency)}</dd></div>
                    <div><dt>Due</dt><dd>{item.due_day ? `Day ${item.due_day}` : 'Varies'}</dd></div>
                  </dl>
                  {item.notes && <p>{item.notes}</p>}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeView === 'transactions' && (
      <div aria-labelledby="finance-tab-transactions" className="finance-layout finance-view" id="finance-view-transactions" role="tabpanel">
        <form className="panel finance-form" noValidate onSubmit={handleSubmit}>
          <div className="control-row">
            <div>
              <h3>{editingId ? 'Edit Transaction' : 'Add Transaction'}</h3>
              <p className="muted">Manual finance tracking only for this MVP.</p>
            </div>
            {editingId && (
              <button className="secondary-button" onClick={resetForm} type="button">
                Cancel edit
              </button>
            )}
          </div>

          <div className="form-grid two">
            <label>
              Type
              <select value={form.type} onChange={(event) => updateForm('type', event.target.value)}>
                {transactionTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>

            <label>
              Amount
              <input
                className={fieldErrors.amount ? 'field-invalid' : ''}
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => updateForm('amount', event.target.value)}
                placeholder="250"
              />
              {fieldErrors.amount && <span className="field-error">{fieldErrors.amount}</span>}
            </label>

            <label>
              Currency
              <input
                className={fieldErrors.currency ? 'field-invalid' : ''}
                value={form.currency}
                onChange={(event) => updateForm('currency', event.target.value.toUpperCase())}
                maxLength={3}
              />
              {fieldErrors.currency && <span className="field-error">{fieldErrors.currency}</span>}
            </label>

            <label>
              Date
              <input
                className={fieldErrors.date ? 'field-invalid' : ''}
                type="date"
                value={form.date}
                onChange={(event) => updateForm('date', event.target.value)}
              />
              {fieldErrors.date && <span className="field-error">{fieldErrors.date}</span>}
            </label>

            <label>
              Category
              <select value={form.category} onChange={(event) => updateForm('category', event.target.value)}>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>

            <label>
              Payment method
              <select value={form.payment_method} onChange={(event) => updateForm('payment_method', event.target.value)}>
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Merchant / Source
            <input
              value={form.merchant_or_source}
              onChange={(event) => updateForm('merchant_or_source', event.target.value)}
              placeholder="Lunch place, salary, client, bank"
            />
          </label>

          <label>
            Note
            <textarea
              value={form.note}
              onChange={(event) => updateForm('note', event.target.value)}
              placeholder="Optional transaction notes..."
              rows={4}
            />
          </label>

          <label>
            Tags
            <input
              value={form.tags}
              onChange={(event) => updateForm('tags', event.target.value)}
              placeholder="food, lunch, cash"
            />
          </label>

          <button className="primary-button" disabled={saving} type="submit">
            {saving ? 'Saving...' : editingId ? 'Update transaction' : 'Save transaction'}
          </button>
        </form>

        <div className="transaction-list">
          <div className="panel">
            <h3>Recent Transactions</h3>
            {loading ? (
              <p className="muted">Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p className="muted">No transactions yet.</p>
            ) : (
              <div className="transaction-stack">
                {transactions.map((transaction) => (
                  <article className={`transaction-card ${transaction.type}`} key={transaction._id}>
                    <div className="transaction-card-header">
                      <div>
                        <span className="task-meta">{transaction.category} / {transaction.type}</span>
                        <h4>{transaction.merchant_or_source || transaction.note || 'Transaction'}</h4>
                      </div>
                      <strong>{money(transaction.amount, transaction.currency)}</strong>
                    </div>

                    <p>{formatLocalDate(transaction.date)} / {transaction.payment_method || 'No payment method'}</p>
                    {transaction.note && <p>{transaction.note}</p>}

                    {transaction.tags?.length > 0 && (
                      <div className="tag-row">
                        {transaction.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}

                    <div className="entry-actions">
                      <button className="secondary-button" onClick={() => handleEdit(transaction)} type="button">
                        Edit
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}
      <StatusToast error={error} success={statusMessage} onDismiss={() => { setError(null); setStatusMessage(null); }} />
    </section>
  );
}
