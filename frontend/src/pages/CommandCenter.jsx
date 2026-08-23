import { useEffect, useState } from 'react';
import {
  cancelCommand,
  confirmCommand,
  getCommandHistory,
  previewCommand,
} from '../api/commands.js';
import { globalSearch } from '../api/search.js';
import { formatLocalDateTime } from '../utils/dateTime.js';

const examples = [
  {
    label: 'Add note',
    command: 'add note: today I fixed nginx',
    hint: 'Saves a note after preview',
  },
  {
    label: 'Create task',
    command: 'create task: review server backups',
    hint: 'Creates a todo task',
  },
  {
    label: 'Log expense',
    command: 'log expense: 250 food lunch cash',
    hint: 'Adds a finance expense',
  },
];

function tagsToText(tags) {
  return Array.isArray(tags) ? tags.join(', ') : '';
}

function textToTags(value) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean);
}

function actionLabel(actionType) {
  if (actionType === 'create_life_log') return 'Create note';
  if (actionType === 'create_task') return 'Create task';
  if (actionType === 'create_transaction') return 'Log expense transaction';
  return 'Unknown action';
}

export default function CommandCenter({ token, onCommandSaved }) {
  const [rawText, setRawText] = useState('');
  const [preview, setPreview] = useState(null);
  const [payload, setPayload] = useState(null);
  const [history, setHistory] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [searchData, setSearchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [status, setStatus] = useState(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getCommandHistory(token);
      setHistory(data.messages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [token]);

  const updatePayload = (field, value) => {
    setPayload((current) => ({ ...current, [field]: value }));
  };

  const resetPreview = () => {
    setPreview(null);
    setPayload(null);
  };

  const handlePreview = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setStatus(null);
    resetPreview();

    try {
      const data = await previewCommand(token, rawText);
      setPreview({ message: data.message, action: data.action });
      setPayload(data.action.payload);
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview?.message?._id || !payload) return;
    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const submitPayload = {
        ...payload,
        tags: typeof payload.tags === 'string' ? textToTags(payload.tags) : payload.tags,
      };
      await confirmCommand(token, preview.message._id, submitPayload);
      setStatus('Command saved.');
      setRawText('');
      resetPreview();
      await loadHistory();
      onCommandSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!preview?.message?._id) {
      resetPreview();
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      await cancelCommand(token, preview.message._id);
      setStatus('Command cancelled.');
      resetPreview();
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    setSearching(true);
    setSearchError(null);

    try {
      const data = await globalSearch(token, searchText);
      setSearchData(data);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const renderSearchGroup = (label, items) => {
    if (!items?.length) return null;

    return (
      <div className="search-result-group">
        <h4>{label}</h4>
        <div className="compact-entry-list">
          {items.map((item) => (
            <article key={`${item.type}-${item.id}`}>
              <strong>{item.title}</strong>
              <span>{item.meta}</span>
              {item.detail && <p>{item.detail}</p>}
            </article>
          ))}
        </div>
      </div>
    );
  };

  const renderPreviewFields = () => {
    if (!preview || !payload) return null;

    if (preview.action.action_type === 'create_life_log') {
      return (
        <>
          <label>
            Title
            <input value={payload.title || ''} onChange={(event) => updatePayload('title', event.target.value)} />
          </label>
          <label>
            Content
            <textarea value={payload.content || ''} onChange={(event) => updatePayload('content', event.target.value)} rows={6} />
          </label>
          <div className="form-grid two">
            <label>
              Category
              <input value={payload.category || ''} onChange={(event) => updatePayload('category', event.target.value)} />
            </label>
            <label>
              Tags
              <input value={tagsToText(payload.tags)} onChange={(event) => updatePayload('tags', textToTags(event.target.value))} />
            </label>
          </div>
        </>
      );
    }

    if (preview.action.action_type === 'create_task') {
      return (
        <>
          <label>
            Title
            <input value={payload.title || ''} onChange={(event) => updatePayload('title', event.target.value)} />
          </label>
          <label>
            Description
            <textarea value={payload.description || ''} onChange={(event) => updatePayload('description', event.target.value)} rows={4} />
          </label>
          <div className="form-grid two">
            <label>
              Status
              <select value={payload.status || 'todo'} onChange={(event) => updatePayload('status', event.target.value)}>
                {['backlog', 'todo', 'doing', 'blocked', 'done', 'cancelled'].map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select value={payload.priority || 'medium'} onChange={(event) => updatePayload('priority', event.target.value)}>
                {['low', 'medium', 'high', 'urgent'].map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </label>
            <label>
              Category
              <input value={payload.category || ''} onChange={(event) => updatePayload('category', event.target.value)} />
            </label>
            <label>
              Tags
              <input value={tagsToText(payload.tags)} onChange={(event) => updatePayload('tags', textToTags(event.target.value))} />
            </label>
          </div>
        </>
      );
    }

    if (preview.action.action_type === 'create_transaction') {
      return (
        <>
          <div className="form-grid two">
            <label>
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={payload.amount || ''}
                onChange={(event) => updatePayload('amount', event.target.value)}
              />
            </label>
            <label>
              Currency
              <input
                maxLength={3}
                value={payload.currency || 'PHP'}
                onChange={(event) => updatePayload('currency', event.target.value.toUpperCase())}
              />
            </label>
            <label>
              Category
              <input value={payload.category || ''} onChange={(event) => updatePayload('category', event.target.value)} />
            </label>
            <label>
              Date
              <input type="date" value={payload.date || ''} onChange={(event) => updatePayload('date', event.target.value)} />
            </label>
            <label>
              Merchant / Source
              <input value={payload.merchant_or_source || ''} onChange={(event) => updatePayload('merchant_or_source', event.target.value)} />
            </label>
            <label>
              Payment method
              <input value={payload.payment_method || ''} onChange={(event) => updatePayload('payment_method', event.target.value)} />
            </label>
          </div>
          <label>
            Note
            <textarea value={payload.note || ''} onChange={(event) => updatePayload('note', event.target.value)} rows={4} />
          </label>
          <label>
            Tags
            <input value={tagsToText(payload.tags)} onChange={(event) => updatePayload('tags', textToTags(event.target.value))} />
          </label>
        </>
      );
    }

    return null;
  };

  return (
    <section className="command-center-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Rule-based actions</p>
          <h2>Command Center</h2>
        </div>
        <span className="status-pill">{history.length} recent commands</span>
      </div>

      <p className="module-description">
        Pick a command chip or type a supported prefix. JDHub always previews the record before saving.
      </p>

      <div className="command-layout">
        <div className="panel utility-form">
          <form className="utility-form" onSubmit={handlePreview}>
            <div>
              <h3>New Command</h3>
              <p className="muted">Preview is required before anything is saved.</p>
            </div>

            <label>
              Command
              <textarea
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                placeholder="add note: today I fixed nginx"
                required
                rows={4}
              />
            </label>

            <div className="example-row">
              {examples.map((example) => (
                <button className="command-chip" key={example.command} onClick={() => setRawText(example.command)} type="button">
                  <strong>{example.label}</strong>
                  <span>{example.command}</span>
                  <small>{example.hint}</small>
                </button>
              ))}
            </div>

            {error && <div className="alert-error">{error}</div>}
            {status && <div className="alert-success">{status}</div>}

            <button className="primary-button" disabled={saving} type="submit">
              {saving ? 'Working...' : 'Preview command'}
            </button>
          </form>

          {preview && (
            <div className="command-preview-panel">
              <div className="control-row">
                <div>
                  <h3>Action Preview</h3>
                  <p className="muted">{actionLabel(preview.action.action_type)}</p>
                </div>
              </div>

              <div className="utility-form">
                {renderPreviewFields()}
                <div className="entry-actions">
                  <button className="primary-button" disabled={saving} onClick={handleConfirm} type="button">
                    Save
                  </button>
                  <button className="secondary-button" disabled={saving} onClick={handleCancel} type="button">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="utility-list">
          <div className="panel">
            <form className="search-row" onSubmit={handleSearch}>
              <label>
                Global Search
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search logs, tasks, projects, finance..."
                  required
                />
              </label>
              <button className="secondary-button" disabled={searching} type="submit">
                {searching ? 'Searching...' : 'Search'}
              </button>
              {searchData && (
                <button
                  className="secondary-button"
                  onClick={() => {
                    setSearchText('');
                    setSearchData(null);
                    setSearchError(null);
                  }}
                  type="button"
                >
                  Clear
                </button>
              )}
            </form>

            {searchError && <div className="alert-error search-alert">{searchError}</div>}

            {searchData && (
              <div className="search-results">
                <div className="alert-success">{searchData.summary.text}</div>
                {renderSearchGroup('Notes', searchData.results.entries)}
                {renderSearchGroup('Knowledge Base', searchData.results.knowledge)}
                {renderSearchGroup('Tasks', searchData.results.tasks)}
                {renderSearchGroup('Projects', searchData.results.projects)}
                {renderSearchGroup('Transactions', searchData.results.transactions)}
              </div>
            )}
          </div>

          <div className="panel">
            <h3>Command History</h3>
            {loading ? (
              <p className="muted">Loading command history...</p>
            ) : history.length === 0 ? (
              <p className="muted">No commands yet.</p>
            ) : (
              <div className="utility-stack">
                {history.map((message) => (
                  <article className="utility-card" key={message._id}>
                    <div className="entry-card-header">
                      <div>
                        <span className="entry-category">{message.command_type.replace('_', ' ')}</span>
                        <h4>{message.raw_text}</h4>
                      </div>
                      <span className="status-pill">{message.status}</span>
                    </div>
                    <p>{formatLocalDateTime(message.createdAt)}</p>
                    {message.saved_record_type && (
                      <div className="task-detail-row">
                        <span>Saved as {message.saved_record_type}</span>
                      </div>
                    )}
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
