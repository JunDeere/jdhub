import { useEffect, useMemo, useState } from 'react';
import {
  getFinanceForecast,
  saveFinancingItem,
  saveForecast,
  saveForecastItem,
  updateForecastItemStatus,
} from '../api/financeForecasts.js';
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
  { id: 'financing', label: 'Loans & installments' },
  { id: 'transactions', label: 'Transactions' },
];

const forecastRanges = [
  { id: 'week', label: '1 week' },
  { id: 'month', label: '1 month' },
  { id: 'quarter', label: '3 months' },
  { id: 'year', label: '1 year' },
  { id: 'all', label: 'All' },
];

const emptyForm = {
  type: 'expense',
  amount: '',
  currency: 'PHP',
  category: 'Food',
  date: toUtcDateInput(new Date()),
  merchant_or_source: '',
  payment_method: 'Cash',
  financing_item_id: '',
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
  const [financingSearch, setFinancingSearch] = useState('');
  const [financingProvider, setFinancingProvider] = useState('all');
  const [financingDueDay, setFinancingDueDay] = useState('all');
  const [financeEditor, setFinanceEditor] = useState(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState(null);
  const [forecastRange, setForecastRange] = useState('month');

  const financingProviders = useMemo(() => (
    [...new Set((forecast?.financing || []).map((item) => item.provider || 'Financing'))]
      .sort((left, right) => left.localeCompare(right))
  ), [forecast]);

  const financingDueDays = useMemo(() => (
    [...new Set((forecast?.financing || []).map((item) => item.due_day).filter(Boolean))]
      .sort((left, right) => left - right)
  ), [forecast]);

  const filteredFinancing = useMemo(() => {
    const query = financingSearch.trim().toLowerCase();

    return (forecast?.financing || []).filter((item) => {
      const provider = item.provider || 'Financing';
      const matchesSearch = !query || [item.name, provider, item.notes]
        .some((value) => value?.toLowerCase().includes(query));
      const matchesProvider = financingProvider === 'all' || provider === financingProvider;
      const matchesDueDay = financingDueDay === 'all'
        || (financingDueDay === 'variable' && !item.due_day)
        || String(item.due_day) === financingDueDay;

      return matchesSearch && matchesProvider && matchesDueDay;
    });
  }, [forecast, financingDueDay, financingProvider, financingSearch]);

  const financingSnapshot = useMemo(() => {
    const records = forecast?.financing || [];
    const knownBalances = records.filter((item) => Number.isFinite(Number(item.remaining_balance)));
    const knownPayments = records.filter((item) => Number.isFinite(Number(item.estimated_monthly)));

    return {
      outstanding: knownBalances.reduce((total, item) => total + Number(item.remaining_balance), 0),
      monthlyCommitment: knownPayments.reduce((total, item) => total + Number(item.estimated_monthly), 0),
      knownBalanceCount: knownBalances.length,
      knownPaymentCount: knownPayments.length,
    };
  }, [forecast]);

  const financingById = useMemo(() => new Map(
    (forecast?.financing || []).map((item) => [String(item._id), item]),
  ), [forecast]);

  const forecastWindow = useMemo(() => {
    if (!forecast) return null;
    const start = new Date(forecast.as_of_date);
    const end = new Date(start);
    if (forecastRange === 'week') end.setUTCDate(end.getUTCDate() + 7);
    if (forecastRange === 'month') end.setUTCMonth(end.getUTCMonth() + 1);
    if (forecastRange === 'quarter') end.setUTCMonth(end.getUTCMonth() + 3);
    if (forecastRange === 'year') end.setUTCFullYear(end.getUTCFullYear() + 1);

    const items = forecastRange === 'all'
      ? forecast.items
      : forecast.items.filter((item) => new Date(item.date_start) <= end);
    const included = items.filter((item) => item.status !== 'skipped');
    const totalIncome = included
      .filter((item) => item.kind === 'income')
      .reduce((total, item) => total + Number(item.amount || 0), 0);
    const totalExpense = included
      .filter((item) => item.kind === 'expense')
      .reduce((total, item) => total + Number(item.amount || 0), 0);
    const resolution = items.reduce((counts, item) => {
      const status = item.resolution_status || 'upcoming';
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, { completed: 0, overdue: 0, due_today: 0, upcoming: 0, skipped: 0 });
    const endingBalance = items.length
      ? items[items.length - 1].projected_balance
      : forecast.starting_balance;

    return {
      items,
      resolution,
      totalIncome,
      totalExpense,
      endingBalance,
      label: forecastRanges.find((range) => range.id === forecastRange)?.label || 'All',
    };
  }, [forecast, forecastRange]);

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
      financing_item_id: transaction.financing_item_id || '',
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

  const openForecastEditor = () => {
    setEditorError(null);
    setFinanceEditor({
      type: 'forecast',
      id: forecast?._id || null,
      values: {
        name: forecast?.name || 'Personal cash-flow forecast',
        account_name: forecast?.account_name || 'Available cash',
        currency: forecast?.currency || 'PHP',
        as_of_date: forecast?.as_of_date ? toUtcDateInput(forecast.as_of_date) : toUtcDateInput(new Date()),
        starting_balance: forecast?.starting_balance ?? '',
      },
    });
  };

  const openForecastItemEditor = (item = null) => {
    setEditorError(null);
    setFinanceEditor({
      type: 'forecast-item',
      id: item?._id || null,
      values: {
        label: item?.label || '',
        kind: item?.kind || 'expense',
        amount: item?.amount ?? '',
        date_start: item?.date_start ? toUtcDateInput(item.date_start) : toUtcDateInput(new Date()),
        date_end: item?.date_end ? toUtcDateInput(item.date_end) : '',
        category: item?.category || '',
        notes: item?.notes || '',
        is_group: Boolean(item?.is_group),
        status: item?.status || 'planned',
      },
    });
  };

  const openFinancingEditor = (item = null) => {
    setEditorError(null);
    setFinanceEditor({
      type: 'financing',
      id: item?._id || null,
      values: {
        name: item?.name || '',
        provider: item?.provider || '',
        remaining_balance: item?.remaining_balance ?? '',
        installments_remaining: item?.installments_remaining ?? '',
        estimated_monthly: item?.estimated_monthly ?? '',
        due_day: item?.due_day ?? '',
        notes: item?.notes || '',
      },
    });
  };

  const updateEditor = (field, value) => {
    setFinanceEditor((current) => ({
      ...current,
      values: { ...current.values, [field]: value },
    }));
    setEditorError(null);
  };

  const handleEditorSubmit = async (event) => {
    event.preventDefault();
    if (!financeEditor) return;
    setEditorSaving(true);
    setEditorError(null);
    try {
      let data;
      if (financeEditor.type === 'forecast') {
        data = await saveForecast(token, financeEditor.values, financeEditor.id);
      } else if (financeEditor.type === 'forecast-item') {
        data = await saveForecastItem(token, forecast._id, financeEditor.values, financeEditor.id);
      } else {
        data = await saveFinancingItem(token, forecast._id, financeEditor.values, financeEditor.id);
      }
      setForecast(data.forecast);
      setFinanceEditor(null);
      setStatusMessage(financeEditor.id ? 'Finance data updated.' : 'Finance data added.');
    } catch (err) {
      setEditorError(err.message);
    } finally {
      setEditorSaving(false);
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

      {forecast && (
        <section aria-label="Finance dashboard summary" className="finance-dashboard-strip">
          <div className="finance-dashboard-card primary">
            <span>Current cash</span>
            <strong>{money(forecast.starting_balance, forecast.currency)}</strong>
            <small>Snapshot {formatLocalDate(forecast.as_of_date)}</small>
          </div>
          <div className="finance-dashboard-card expense">
            <span>Planned payments</span>
            <strong>{money(forecast.summary.total_expense, forecast.currency)}</strong>
            <small>Across this forecast</small>
          </div>
          <div className="finance-dashboard-card">
            <span>Outstanding financing</span>
            <strong>{money(financingSnapshot.outstanding, forecast.currency)}</strong>
            <small>{financingSnapshot.knownBalanceCount} of {forecast.financing?.length || 0} balances supplied</small>
          </div>
          <div className="finance-dashboard-card">
            <span>Monthly installments</span>
            <strong>{money(financingSnapshot.monthlyCommitment, forecast.currency)}</strong>
            <small>{financingSnapshot.knownPaymentCount} known payment amounts</small>
          </div>
          <div className="finance-dashboard-card projected">
            <span>Projected cash</span>
            <strong>{money(forecast.summary.ending_balance, forecast.currency)}</strong>
            <small>After planned cash flow</small>
          </div>
        </section>
      )}

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

          <section className="finance-flow-guide" aria-label="How finance tracking works">
            <div><span>1</span><p><strong>Record reality</strong><small>Transactions are money that actually moved.</small></p></div>
            <div><span>2</span><p><strong>Plan ahead</strong><small>Forecast lists income and bills you expect later.</small></p></div>
            <div><span>3</span><p><strong>Track debt</strong><small>Loans and installments show what you still owe.</small></p></div>
            <div><span>4</span><p><strong>Link payments</strong><small>A linked expense lowers both cash and debt.</small></p></div>
          </section>

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
                {forecast && (
                  <div className="finance-heading-actions">
                    <span className="status-pill">{forecastWindow.label}: {money(forecastWindow.endingBalance, forecast.currency)}</span>
                    <button className="secondary-button" onClick={openForecastEditor} type="button">Edit current cash</button>
                    <button className="primary-button" onClick={() => openForecastItemEditor()} type="button">Add planned item</button>
                  </div>
                )}
              </div>

          {forecastLoading ? (
            <p className="muted">Loading forecast…</p>
          ) : forecastError ? (
            <div className="alert-error">{forecastError}</div>
          ) : !forecast ? (
            <div className="finance-empty-state"><strong>No forecast yet</strong><p className="muted">Start with the cash you have today, then add expected income and bills.</p><button className="primary-button" onClick={openForecastEditor} type="button">Create forecast</button></div>
          ) : (
            <>
              <div className="forecast-range-control" aria-label="Forecast time range" role="group">
                <span>Show forecast for</span>
                <div>
                  {forecastRanges.map((range) => (
                    <button aria-pressed={forecastRange === range.id} className={forecastRange === range.id ? 'active' : ''} key={range.id} onClick={() => setForecastRange(range.id)} type="button">{range.label}</button>
                  ))}
                </div>
              </div>
              <div className="forecast-resolver-summary" role="status">
                <div>
                  <span className="eyebrow">Auto resolver</span>
                  <strong>{forecastWindow.resolution.completed || 0} resolved</strong>
                </div>
                <span>{forecastWindow.resolution.overdue || 0} need review</span>
                <span>{forecastWindow.resolution.due_today || 0} due today</span>
                <span>{forecastWindow.resolution.upcoming || 0} upcoming</span>
                <small>Counts and totals reflect the selected {forecastWindow.label.toLowerCase()} window. Exact dated transactions are matched automatically.</small>
              </div>
              <div className="forecast-summary-grid">
                <div><span>Starting balance</span><strong>{money(forecast.starting_balance, forecast.currency)}</strong></div>
                <div><span>Planned income · {forecastWindow.label}</span><strong className="forecast-income">+{money(forecastWindow.totalIncome, forecast.currency)}</strong></div>
                <div><span>Planned payments · {forecastWindow.label}</span><strong className="forecast-expense">−{money(forecastWindow.totalExpense, forecast.currency)}</strong></div>
                <div><span>Projected cash · {forecastWindow.label}</span><strong>{money(forecastWindow.endingBalance, forecast.currency)}</strong></div>
              </div>

              <div className="forecast-table-wrap">
                <table className="forecast-table">
                  <thead><tr><th>Date</th><th>Planned item</th><th>Amount</th><th>Projected cash</th><th>Status & action</th></tr></thead>
                  <tbody>
                    <tr className="forecast-start-row">
                      <td data-label="Date">Now</td><td data-label="Transaction">Current {forecast.account_name}</td><td data-label="Amount">—</td><td data-label="Projected balance">{money(forecast.starting_balance, forecast.currency)}</td><td data-label="Status">Snapshot</td>
                    </tr>
                    {forecastWindow.items.map((item) => (
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
                          <button className="table-action-button" onClick={() => openForecastItemEditor(item)} type="button">Edit</button>
                        </td>
                      </tr>
                    ))}
                    {!forecastWindow.items.length && (
                      <tr><td className="forecast-window-empty" colSpan="5">No planned items fall within this time window.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {activeView === 'financing' && (
        <section aria-labelledby="finance-tab-financing" className="panel financing-panel finance-view" id="finance-view-financing" role="tabpanel">
          <div className="financing-heading">
            <div>
            <p className="eyebrow">Debt tracking</p>
            <h3>Loans and installments</h3>
            <p className="muted">Track money still owed on loans and pay-later plans. Link an expense transaction when you make a payment so its balance decreases.</p>
            </div>
            {forecast && (
              <div className="financing-heading-actions">
                {forecast.financing?.length > 0 && <div className="financing-heading-summary"><span>Total known debt</span><strong>{money(financingSnapshot.outstanding, forecast.currency)}</strong></div>}
                <button className="primary-button" onClick={() => openFinancingEditor()} type="button">Add loan or installment</button>
              </div>
            )}
          </div>
          {forecastLoading ? (
            <p className="muted">Loading financing records…</p>
          ) : forecastError ? (
            <div className="alert-error">{forecastError}</div>
          ) : !forecast?.financing?.length ? (
            <div className="finance-empty-state"><strong>No financing records</strong><p className="muted">Loan and installment details will appear here when they are added to the forecast.</p></div>
          ) : (
            <>
              <div className="financing-toolbar">
                <label className="financing-search">
                  <span className="sr-only">Search financing</span>
                  <input
                    onChange={(event) => setFinancingSearch(event.target.value)}
                    placeholder="Search financing, provider, or notes…"
                    type="search"
                    value={financingSearch}
                  />
                </label>
                <label>
                  <span className="sr-only">Filter by provider</span>
                  <select onChange={(event) => setFinancingProvider(event.target.value)} value={financingProvider}>
                    <option value="all">All providers</option>
                    {financingProviders.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Filter by due day</span>
                  <select onChange={(event) => setFinancingDueDay(event.target.value)} value={financingDueDay}>
                    <option value="all">All due dates</option>
                    {financingDueDays.map((day) => <option key={day} value={day}>Due day {day}</option>)}
                    <option value="variable">Variable due date</option>
                  </select>
                </label>
                <span className="financing-result-count">{filteredFinancing.length} of {forecast.financing.length}</span>
              </div>

              {!filteredFinancing.length ? (
                <div className="finance-empty-state financing-filter-empty">
                  <strong>No matching financing records</strong>
                  <p className="muted">Try a different search term or filter.</p>
                  <button className="secondary-button" onClick={() => { setFinancingSearch(''); setFinancingProvider('all'); setFinancingDueDay('all'); }} type="button">Clear filters</button>
                </div>
              ) : <>
              <div className="financing-table-wrap financing-desktop">
                <table className="financing-table">
                  <thead>
                    <tr>
                      <th scope="col">Financing</th>
                      <th scope="col">Remaining</th>
                      <th scope="col">Payments left</th>
                      <th scope="col">Expected payment</th>
                      <th scope="col">Due</th>
                      <th scope="col">Notes</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFinancing.map((item) => (
                      <tr key={item._id}>
                        <td><strong>{item.name}</strong><small>{item.provider || 'Financing'}</small></td>
                        <td>{item.remaining_balance == null ? 'Not provided' : money(item.remaining_balance, forecast.currency)}</td>
                        <td>{item.installments_remaining == null ? 'Variable' : item.installments_remaining}</td>
                        <td>{item.estimated_monthly == null ? 'Variable' : money(item.estimated_monthly, forecast.currency)}</td>
                        <td>{item.due_day ? `Day ${item.due_day}` : 'Varies'}</td>
                        <td className="financing-notes">{item.notes || '—'}</td>
                        <td><button className="table-action-button" onClick={() => openFinancingEditor(item)} type="button">Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="financing-grid financing-mobile">
                {filteredFinancing.map((item) => (
                  <article key={item._id}>
                    <div><strong>{item.name}</strong><span>{item.provider || 'Financing'}</span></div>
                    <dl>
                      <div><dt>Remaining</dt><dd>{item.remaining_balance == null ? 'Not provided' : money(item.remaining_balance, forecast.currency)}</dd></div>
                      <div><dt>Payments left</dt><dd>{item.installments_remaining == null ? 'Variable' : item.installments_remaining}</dd></div>
                      <div><dt>Expected payment</dt><dd>{item.estimated_monthly == null ? 'Variable' : money(item.estimated_monthly, forecast.currency)}</dd></div>
                      <div><dt>Due</dt><dd>{item.due_day ? `Day ${item.due_day}` : 'Varies'}</dd></div>
                    </dl>
                    {item.notes && <p>{item.notes}</p>}
                    <button className="secondary-button" onClick={() => openFinancingEditor(item)} type="button">Edit financing</button>
                  </article>
                ))}
              </div>
              </>}
            </>
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

            {form.type === 'expense' && (
              <label>
                Apply to financing
                <select value={form.financing_item_id} onChange={(event) => updateForm('financing_item_id', event.target.value)}>
                  <option value="">Not a financing payment</option>
                  {(forecast?.financing || []).map((item) => (
                    <option key={item._id} value={item._id}>{item.name} · {item.provider || 'Financing'}</option>
                  ))}
                </select>
                <small className="field-help">Linked payments reduce the balance and payments remaining.</small>
              </label>
            )}
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
                    {transaction.financing_item_id && (
                      <p className="transaction-financing-link">Financing: {financingById.get(String(transaction.financing_item_id))?.name || 'Linked account'}</p>
                    )}
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

      {financeEditor && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !editorSaving) setFinanceEditor(null); }}>
          <form aria-labelledby="finance-editor-title" aria-modal="true" className="modal-card finance-editor-modal utility-form" noValidate onSubmit={handleEditorSubmit} role="dialog">
            <div className="finance-editor-heading">
              <div>
                <p className="eyebrow">
                  {financeEditor.type === 'forecast' ? 'Cash starting point' : financeEditor.type === 'forecast-item' ? 'Expected cash flow' : 'Debt account'}
                </p>
                <h3 id="finance-editor-title">
                  {financeEditor.type === 'forecast'
                    ? `${financeEditor.id ? 'Edit' : 'Create'} forecast`
                    : financeEditor.type === 'forecast-item'
                      ? `${financeEditor.id ? 'Edit' : 'Add'} planned item`
                      : `${financeEditor.id ? 'Edit' : 'Add'} loan or installment`}
                </h3>
              </div>
              <button aria-label="Close finance editor" className="icon-button" disabled={editorSaving} onClick={() => setFinanceEditor(null)} type="button">×</button>
            </div>

            {financeEditor.type === 'forecast' && (
              <>
                <p className="muted">Enter the cash you have on the snapshot date. Future planned items will be calculated from this amount.</p>
                <div className="form-grid two">
                  <label>Forecast name<input required value={financeEditor.values.name} onChange={(event) => updateEditor('name', event.target.value)} /></label>
                  <label>Cash account name<input required value={financeEditor.values.account_name} onChange={(event) => updateEditor('account_name', event.target.value)} placeholder="Available cash" /></label>
                  <label>Current cash<input min="0" required step="0.01" type="number" value={financeEditor.values.starting_balance} onChange={(event) => updateEditor('starting_balance', event.target.value)} /></label>
                  <label>Snapshot date<input required type="date" value={financeEditor.values.as_of_date} onChange={(event) => updateEditor('as_of_date', event.target.value)} /></label>
                  <label>Currency<input maxLength="3" required value={financeEditor.values.currency} onChange={(event) => updateEditor('currency', event.target.value.toUpperCase())} /></label>
                </div>
              </>
            )}

            {financeEditor.type === 'forecast-item' && (
              <>
                <p className="muted">Add money you expect to receive or pay. This changes projected cash, not the actual transaction ledger.</p>
                <div className="form-grid two">
                  <label>Item name<input required value={financeEditor.values.label} onChange={(event) => updateEditor('label', event.target.value)} placeholder="Salary, subscription, installment" /></label>
                  <label>Type<select value={financeEditor.values.kind} onChange={(event) => updateEditor('kind', event.target.value)}><option value="income">Expected income</option><option value="expense">Expected payment</option></select></label>
                  <label>Amount<input min="0.01" required step="0.01" type="number" value={financeEditor.values.amount} onChange={(event) => updateEditor('amount', event.target.value)} /></label>
                  <label>Planned date<input required type="date" value={financeEditor.values.date_start} onChange={(event) => updateEditor('date_start', event.target.value)} /></label>
                  <label>Optional end date<input type="date" value={financeEditor.values.date_end} onChange={(event) => updateEditor('date_end', event.target.value)} /></label>
                  <label>Category<input value={financeEditor.values.category} onChange={(event) => updateEditor('category', event.target.value)} placeholder="Bills, salary, shopping" /></label>
                  <label>Status<select value={financeEditor.values.status} onChange={(event) => updateEditor('status', event.target.value)}><option value="planned">Planned</option><option value="completed">Completed</option><option value="skipped">Skipped</option></select></label>
                  <label className="checkbox-row"><input checked={financeEditor.values.is_group} onChange={(event) => updateEditor('is_group', event.target.checked)} type="checkbox" /> Combined payment</label>
                </div>
                <label>Notes<textarea rows={3} value={financeEditor.values.notes} onChange={(event) => updateEditor('notes', event.target.value)} /></label>
              </>
            )}

            {financeEditor.type === 'financing' && (
              <>
                <p className="muted">Use this for a loan, credit installment, or pay-later balance—not an ordinary one-time bill.</p>
                <div className="form-grid two">
                  <label>Name<input required value={financeEditor.values.name} onChange={(event) => updateEditor('name', event.target.value)} placeholder="Laptop installment" /></label>
                  <label>Provider<input value={financeEditor.values.provider} onChange={(event) => updateEditor('provider', event.target.value)} placeholder="Bank or service" /></label>
                  <label>Remaining balance<input min="0" step="0.01" type="number" value={financeEditor.values.remaining_balance} onChange={(event) => updateEditor('remaining_balance', event.target.value)} /></label>
                  <label>Payments left<input min="0" step="1" type="number" value={financeEditor.values.installments_remaining} onChange={(event) => updateEditor('installments_remaining', event.target.value)} /></label>
                  <label>Expected payment<input min="0" step="0.01" type="number" value={financeEditor.values.estimated_monthly} onChange={(event) => updateEditor('estimated_monthly', event.target.value)} /></label>
                  <label>Due day<input max="31" min="1" step="1" type="number" value={financeEditor.values.due_day} onChange={(event) => updateEditor('due_day', event.target.value)} placeholder="15" /></label>
                </div>
                <label>Notes<textarea rows={3} value={financeEditor.values.notes} onChange={(event) => updateEditor('notes', event.target.value)} /></label>
              </>
            )}

            {editorError && <div className="alert-error">{editorError}</div>}
            <div className="finance-editor-actions">
              <button className="secondary-button" disabled={editorSaving} onClick={() => setFinanceEditor(null)} type="button">Cancel</button>
              <button className="primary-button" disabled={editorSaving} type="submit">{editorSaving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
      <StatusToast error={error} success={statusMessage} onDismiss={() => { setError(null); setStatusMessage(null); }} />
    </section>
  );
}
