import { useEffect, useState } from 'react';
import { createTransaction, getTransactions, updateTransaction } from '../api/transactions.js';
import { dateInputToUtcIso, formatLocalDate, toUtcDateInput } from '../utils/dateTime.js';

const transactionTypes = ['expense', 'income', 'transfer'];
const categories = ['Food', 'Transport', 'Bills', 'Utilities', 'Health', 'Work', 'Server', 'Shopping', 'Savings', 'Other'];
const paymentMethods = ['Cash', 'GCash', 'Maya', 'Debit Card', 'Credit Card', 'Bank Transfer', 'Other'];

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

export default function Finance({ token, onTransactionsChanged }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, transfer: 0, net: 0 });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getTransactions(token);
      setTransactions(data.transactions);
      setSummary(data.summary);
      onTransactionsChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [token]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setStatusMessage(null);

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
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (transaction) => {
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

  return (
    <section className="finance-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Manual finance</p>
          <h2>Finance</h2>
        </div>
        <span className="status-pill">{transactions.length} transactions</span>
      </div>

      <p className="module-description">
        Track manual income and expense transactions. Receipts, OCR, bank CSV imports, and SQL-backed accounting are later phases.
      </p>

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

      <div className="finance-layout">
        <form className="panel finance-form" onSubmit={handleSubmit}>
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
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => updateForm('amount', event.target.value)}
                placeholder="250"
                required
              />
            </label>

            <label>
              Currency
              <input
                value={form.currency}
                onChange={(event) => updateForm('currency', event.target.value.toUpperCase())}
                maxLength={3}
              />
            </label>

            <label>
              Date
              <input
                type="date"
                value={form.date}
                onChange={(event) => updateForm('date', event.target.value)}
                required
              />
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

          {error && <div className="alert-error">{error}</div>}
          {statusMessage && <div className="alert-success">{statusMessage}</div>}

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
    </section>
  );
}
