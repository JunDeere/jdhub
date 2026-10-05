import { Bot, ChevronDown, History, Maximize2, Minimize2, Search, Send, X } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import {
  askCommandAi,
  cancelCommand,
  confirmCommand,
  getAssistantConversation,
  getCommandHistory,
} from '../api/commands.js';
import { globalSearch } from '../api/search.js';
import { formatLocalDateTime } from '../utils/dateTime.js';

const assistantExamples = [
  'What needs my attention?',
  'Summarize my open tasks',
  'Remember that I fixed nginx today',
  'Create a task to review server backups tomorrow',
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
  if (actionType === 'update_task') return 'Update task';
  if (actionType === 'create_transaction') return 'Log expense transaction';
  return 'Unknown action';
}

function actionSuccessText(actionType) {
  if (actionType === 'update_task') return 'Task updated successfully.';
  return `${actionLabel(actionType)} saved successfully.`;
}

function messageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const CommandCenter = forwardRef(function CommandCenter({
  token,
  mode = 'page',
  onClose,
  onCommandSaved,
  onExpand,
  onIntegrate,
  onMinimize,
}, ref) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([{
    id: 'welcome',
    role: 'assistant',
    text: 'Ask naturally about your JDHub data, or tell me what you want to record. I will prepare a confirmation before saving anything.',
  }]);
  const [preview, setPreview] = useState(null);
  const [payload, setPayload] = useState(null);
  const [previewEditing, setPreviewEditing] = useState(false);
  const [taskCheckIn, setTaskCheckIn] = useState(null);
  const [history, setHistory] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [searchData, setSearchData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [searching, setSearching] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const composerRef = useRef(null);
  const messagesRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  const scrollMessagesToBottom = useCallback(() => {
    const messagesElement = messagesRef.current;
    if (!messagesElement) return;
    messagesElement.scrollTop = messagesElement.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    if (mode === 'minimized') return;
    shouldAutoScrollRef.current = true;
    scrollMessagesToBottom();
  }, [mode, scrollMessagesToBottom]);

  useLayoutEffect(() => {
    if (mode === 'minimized' || !shouldAutoScrollRef.current) return;
    scrollMessagesToBottom();
  }, [messages.length, mode, scrollMessagesToBottom, working]);

  useEffect(() => {
    if (mode !== 'floating' && mode !== 'integrated') return undefined;
    const focusFrame = window.requestAnimationFrame(() => composerRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [mode]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getCommandHistory(token), getAssistantConversation(token)])
      .then(([historyData, conversationData]) => {
        if (!cancelled) {
          setHistory(historyData.messages);
          if (conversationData.messages.length > 0) {
            setMessages(conversationData.messages.map((message) => ({
              id: message._id,
              role: message.role,
              text: message.content,
              meta: message.model || '',
            })));
          }
          setTaskCheckIn(conversationData.task_check_in || null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const refreshHistory = useCallback(async () => {
    const data = await getCommandHistory(token);
    setHistory(data.messages);
  }, [token]);

  const addMessage = useCallback((role, text, meta = '') => {
    setMessages((current) => [...current, { id: messageId(), role, text, meta }]);
  }, []);

  const runPrompt = useCallback(async (value) => {
    const prompt = String(value || '').trim();
    if (!prompt || working) return;

    setDraft('');
    setError(null);
    setWorking(true);
    shouldAutoScrollRef.current = true;
    addMessage('user', prompt);

    try {
      const data = await askCommandAi(token, prompt);
      if (data.kind === 'action_preview') {
        setTaskCheckIn(null);
        setPreview({ message: data.message, action: data.action });
        setPayload(data.action.payload);
        setPreviewEditing(false);
        addMessage('assistant', data.answer, data.model);
        await refreshHistory();
      } else {
        setTaskCheckIn(data.task_check_in || null);
        addMessage('assistant', data.answer, data.model);
      }
    } catch (err) {
      setError(err.message);
      addMessage('assistant', `I could not complete that request: ${err.message}`);
    } finally {
      setWorking(false);
    }
  }, [addMessage, refreshHistory, token, working]);

  useImperativeHandle(ref, () => ({
    focus() {
      composerRef.current?.focus();
    },
    submit(value) {
      void runPrompt(value);
    },
  }), [runPrompt]);

  const updatePayload = (field, value) => {
    setPayload((current) => ({ ...current, [field]: value }));
  };

  const resetPreview = () => {
    setPreview(null);
    setPayload(null);
    setPreviewEditing(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await runPrompt(draft);
  };

  const handleConfirm = async () => {
    if (!preview?.message?._id || !payload) return;
    setWorking(true);
    setError(null);

    try {
      const submitPayload = {
        ...payload,
        tags: typeof payload.tags === 'string' ? textToTags(payload.tags) : payload.tags,
      };
      await confirmCommand(token, preview.message._id, submitPayload);
      addMessage('assistant', actionSuccessText(preview.action.action_type));
      resetPreview();
      await refreshHistory();
      onCommandSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  };

  const handleCancel = async () => {
    if (!preview?.message?._id) {
      resetPreview();
      return;
    }

    setWorking(true);
    setError(null);
    try {
      await cancelCommand(token, preview.message._id);
      addMessage('assistant', 'Command preview cancelled.');
      resetPreview();
      await refreshHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
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

  const previewSummary = () => {
    if (!preview || !payload) return [];

    if (preview.action.action_type === 'create_life_log') {
      return [
        ['Title', payload.title || 'Untitled note'],
        ['Content', payload.content || 'No content'],
        ['Category', payload.category || 'Personal'],
      ];
    }

    if (preview.action.action_type === 'create_task') {
      return [
        ['Task', payload.title || 'Untitled task'],
        ['Priority', payload.priority || 'medium'],
        ['Due', payload.due_date || 'No due date'],
      ];
    }

    if (preview.action.action_type === 'update_task') {
      return [
        ['Task', payload.title || 'Task'],
        ['New status', payload.status || 'done'],
      ];
    }

    if (preview.action.action_type === 'create_transaction') {
      return [
        ['Transaction', payload.merchant_or_source || payload.category || 'Transaction'],
        ['Amount', `${payload.currency || 'PHP'} ${Number(payload.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ['Type', payload.type || 'expense'],
      ];
    }

    return [];
  };

  const renderPreviewFields = () => {
    if (!preview || !payload) return null;

    if (preview.action.action_type === 'create_life_log') {
      return (
        <>
          <label>Title<input value={payload.title || ''} onChange={(event) => updatePayload('title', event.target.value)} /></label>
          <label>Content<textarea value={payload.content || ''} onChange={(event) => updatePayload('content', event.target.value)} rows={4} /></label>
          <div className="form-grid two">
            <label>Category<input value={payload.category || ''} onChange={(event) => updatePayload('category', event.target.value)} /></label>
            <label>Tags<input value={tagsToText(payload.tags)} onChange={(event) => updatePayload('tags', textToTags(event.target.value))} /></label>
          </div>
        </>
      );
    }

    if (preview.action.action_type === 'create_task') {
      return (
        <>
          <label>Title<input value={payload.title || ''} onChange={(event) => updatePayload('title', event.target.value)} /></label>
          <label>Description<textarea value={payload.description || ''} onChange={(event) => updatePayload('description', event.target.value)} rows={3} /></label>
          <div className="form-grid two">
            <label>Status<select value={payload.status || 'todo'} onChange={(event) => updatePayload('status', event.target.value)}>{['backlog', 'todo', 'doing', 'blocked', 'done', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label>Priority<select value={payload.priority || 'medium'} onChange={(event) => updatePayload('priority', event.target.value)}>{['low', 'medium', 'high', 'urgent'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
            <label>Category<input value={payload.category || ''} onChange={(event) => updatePayload('category', event.target.value)} /></label>
            <label>Due date<input type="date" value={payload.due_date || ''} onChange={(event) => updatePayload('due_date', event.target.value)} /></label>
            <label>Tags<input value={tagsToText(payload.tags)} onChange={(event) => updatePayload('tags', textToTags(event.target.value))} /></label>
          </div>
        </>
      );
    }

    if (preview.action.action_type === 'update_task') {
      return (
        <div className="form-grid two">
          <label>Task<input disabled value={payload.title || ''} /></label>
          <label>Status<select value={payload.status || 'done'} onChange={(event) => updatePayload('status', event.target.value)}>{['backlog', 'todo', 'doing', 'blocked', 'done', 'cancelled'].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        </div>
      );
    }

    if (preview.action.action_type === 'create_transaction') {
      return (
        <>
          <div className="form-grid two">
            <label>Type<select value={payload.type || 'expense'} onChange={(event) => updatePayload('type', event.target.value)}>{['expense', 'income', 'transfer'].map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
            <label>Amount<input type="number" min="0" step="0.01" value={payload.amount || ''} onChange={(event) => updatePayload('amount', event.target.value)} /></label>
            <label>Currency<input maxLength={3} value={payload.currency || 'PHP'} onChange={(event) => updatePayload('currency', event.target.value.toUpperCase())} /></label>
            <label>Category<input value={payload.category || ''} onChange={(event) => updatePayload('category', event.target.value)} /></label>
            <label>Date<input type="date" value={payload.date || ''} onChange={(event) => updatePayload('date', event.target.value)} /></label>
            <label>Merchant / Source<input value={payload.merchant_or_source || ''} onChange={(event) => updatePayload('merchant_or_source', event.target.value)} /></label>
            <label>Payment method<input value={payload.payment_method || ''} onChange={(event) => updatePayload('payment_method', event.target.value)} /></label>
          </div>
          <label>Note<textarea value={payload.note || ''} onChange={(event) => updatePayload('note', event.target.value)} rows={3} /></label>
        </>
      );
    }

    return null;
  };

  if (mode === 'minimized') {
    return (
      <button className="assistant-launcher" onClick={onExpand} title="Open JDHub Assistant" type="button">
        <Bot aria-hidden="true" size={22} />
        <span>Ask JDHub</span>
      </button>
    );
  }

  const chatPanel = (
    <div className="assistant-chat-panel">
      <div className="assistant-header">
        <div className="assistant-identity">
          <span><Bot aria-hidden="true" size={19} /></span>
          <div><strong>JDHub Assistant</strong><small>Ask AI or run a command</small></div>
        </div>
        <div className="assistant-header-actions">
          {mode !== 'page' && <button aria-label="Show history" aria-pressed={historyOpen} onClick={() => setHistoryOpen((current) => !current)} title="History" type="button"><History size={17} /></button>}
          {mode === 'floating' && <button aria-label="Dock assistant to the right" onClick={onIntegrate} title="Dock assistant to the right" type="button"><Maximize2 size={17} /></button>}
          {mode === 'integrated' && <button aria-label="Return to floating chat" onClick={onMinimize} title="Return to floating chat" type="button"><Minimize2 size={17} /></button>}
          {mode !== 'page' && <button aria-label="Close assistant" onClick={onClose} title="Close assistant" type="button"><X size={17} /></button>}
        </div>
      </div>

      {historyOpen && mode !== 'page' && (
        <aside className="assistant-history-drawer">
          <div className="assistant-history-drawer-heading">
            <div><History size={17} /><strong>History</strong></div>
            <button aria-label="Close history" onClick={() => setHistoryOpen(false)} title="Close history" type="button"><X size={16} /></button>
          </div>
          <div className="assistant-history-drawer-list">
            <section>
              <span className="entry-category">This conversation</span>
              {messages.map((message) => (
                <article key={`drawer-${message.id}`}>
                  <div><strong>{message.role === 'assistant' ? 'JDHub' : 'You'}</strong></div>
                  <p>{message.text}</p>
                </article>
              ))}
            </section>
            <section>
              <span className="entry-category">Recent commands</span>
              {loading ? <p className="muted">Loading…</p> : history.length === 0 ? <p className="muted">No commands yet.</p> : history.slice(0, 12).map((message) => (
                <article key={`drawer-command-${message._id}`}>
                  <div><strong>{message.raw_text}</strong><span className="status-pill">{message.status}</span></div>
                  <small>{formatLocalDateTime(message.createdAt)}</small>
                </article>
              ))}
            </section>
          </div>
        </aside>
      )}

      <div
        className="assistant-messages"
        aria-live="polite"
        onScroll={(event) => {
          const messagesElement = event.currentTarget;
          const distanceFromBottom = messagesElement.scrollHeight - messagesElement.scrollTop - messagesElement.clientHeight;
          shouldAutoScrollRef.current = distanceFromBottom <= 72;
        }}
        ref={messagesRef}
      >
        {messages.map((message) => (
          <article className={`assistant-message ${message.role}`} key={message.id}>
            <span>{message.role === 'assistant' ? 'JD' : 'You'}</span>
            <div><p>{message.text}</p>{message.meta && <small>{message.meta}</small>}</div>
          </article>
        ))}
        {working && <div className="assistant-thinking">JDHub is working…</div>}
      </div>

      {taskCheckIn && !preview && (
        <section className="assistant-task-check-in" aria-label={`Task check-in for ${taskCheckIn.title}`}>
          <div>
            <span className="entry-category">Task check-in</span>
            <strong>{taskCheckIn.title}</strong>
            <small>Is this finished?</small>
          </div>
          <div className="entry-actions">
            <button className="primary-button" disabled={working} onClick={() => void runPrompt('Yes, I finished it.')} type="button">Yes, done</button>
            <button className="secondary-button" disabled={working} onClick={() => void runPrompt('Not yet.')} type="button">Not yet</button>
          </div>
        </section>
      )}

      {preview && (
        <div className="assistant-preview utility-form">
          <div className="assistant-preview-heading">
            <div><span className="entry-category">Ready for confirmation</span><strong>{actionLabel(preview.action.action_type)}</strong></div>
            <button onClick={handleCancel} title="Cancel preview" type="button"><X size={16} /></button>
          </div>
          {!previewEditing && (
            <dl className="assistant-preview-summary">
              {previewSummary().map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
          )}
          {previewEditing && <div className="assistant-preview-fields">{renderPreviewFields()}</div>}
          <div className="entry-actions">
            <button className="primary-button" disabled={working} onClick={handleConfirm} type="button">Confirm &amp; save</button>
            <button className="secondary-button" disabled={working} onClick={() => setPreviewEditing((current) => !current)} type="button">
              {previewEditing ? 'Hide details' : 'Review details'} <ChevronDown aria-hidden="true" className={previewEditing ? 'rotated' : ''} size={15} />
            </button>
          </div>
        </div>
      )}

      {error && <div className="alert-error assistant-alert">{error}</div>}

      <div className="assistant-suggestions">
        {assistantExamples.map((example) => <button key={example} onClick={() => setDraft(example)} type="button">{example}</button>)}
      </div>

      <form className="assistant-composer" onSubmit={handleSubmit}>
        <textarea ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }} placeholder="Ask JDHub or enter a command…" rows={2} />
        <button aria-label="Send" disabled={working || !draft.trim()} type="submit"><Send size={18} /></button>
      </form>
    </div>
  );

  if (mode === 'floating') {
    return <aside className="assistant-floating">{chatPanel}</aside>;
  }

  if (mode === 'integrated') {
    return <aside className="assistant-dock">{chatPanel}</aside>;
  }

  return (
    <section className="command-center-page assistant-page">
      <div className="assistant-page-heading">
        <div><p className="eyebrow">One assistant across JDHub</p><h3>Command Center</h3></div>
        <span className="status-pill">{history.length} recent commands</span>
      </div>
      <div className="assistant-page-layout">
        {chatPanel}
        <aside className="assistant-context-panel">
          <div className="assistant-context-section">
            <div className="assistant-context-heading"><Search size={17} /><strong>Search JDHub</strong></div>
            <form className="assistant-search" onSubmit={handleSearch}>
              <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search records…" required />
              <button className="secondary-button" disabled={searching} type="submit">{searching ? '…' : 'Search'}</button>
            </form>
            {searchError && <div className="alert-error">{searchError}</div>}
            {searchData && <div className="assistant-search-summary"><strong>{searchData.summary.text}</strong>{Object.values(searchData.results).flat().slice(0, 5).map((item) => <button key={`${item.type}-${item.id}`} type="button"><span>{item.title}</span><small>{item.meta}</small></button>)}</div>}
          </div>
          <div className="assistant-context-section assistant-history">
            <div className="assistant-context-heading"><strong>Recent command history</strong></div>
            {loading ? <p className="muted">Loading…</p> : history.length === 0 ? <p className="muted">No commands yet.</p> : history.slice(0, 12).map((message) => (
              <article key={message._id}>
                <div><strong>{message.raw_text}</strong><span className="status-pill">{message.status}</span></div>
                <small>{formatLocalDateTime(message.createdAt)}</small>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
});

export default CommandCenter;
