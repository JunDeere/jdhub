import {
  ArrowLeft,
  ArrowRight,
  BookLock,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Save,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getReview, saveReview } from '../api/reviews.js';

const emptyDraft = { wins: '', reflection: '', next_focus: '', energy: '' };

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value, days) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function periodFor(type, anchor) {
  const day = startOfDay(anchor);
  const start = type === 'weekly' ? addDays(day, -((day.getDay() + 6) % 7)) : day;
  return { type, start, end: addDays(start, type === 'weekly' ? 7 : 1) };
}

function dateLabel(period) {
  const end = addDays(period.end, -1);
  if (period.type === 'daily') {
    return period.start.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  return `${period.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function shortDate(value, withTime = false) {
  if (!value) return 'No date';
  const options = withTime
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric' };
  return new Date(value).toLocaleString(undefined, options);
}

function money(value, currency = 'PHP') {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function ReviewList({ empty, items, renderItem }) {
  if (!items?.length) return <p className="review-empty">{empty}</p>;
  return <div className="review-list">{items.map(renderItem)}</div>;
}

export default function Reviews({ token, onNavigate }) {
  const [type, setType] = useState('daily');
  const [anchor, setAnchor] = useState(() => new Date());
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const period = useMemo(() => periodFor(type, anchor), [type, anchor]);

  useEffect(() => {
    let active = true;
    getReview(token, period)
      .then((response) => {
        if (!active) return;
        setData(response);
        setDraft(response.review ? {
          wins: response.review.wins || '',
          reflection: response.review.reflection || '',
          next_focus: response.review.next_focus || '',
          energy: response.review.energy || '',
        } : emptyDraft);
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token, period]);

  const preparePeriodChange = () => {
    setLoading(true);
    setError('');
    setSaved(false);
  };

  const movePeriod = (direction) => {
    preparePeriodChange();
    setAnchor((current) => addDays(current, direction * (type === 'weekly' ? 7 : 1)));
  };

  const selectType = (nextType) => {
    preparePeriodChange();
    setType(nextType);
    setAnchor(new Date());
  };

  const resetToCurrent = () => {
    preparePeriodChange();
    setAnchor(new Date());
  };

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setSaved(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await saveReview(token, {
        period_type: period.type,
        period_start: period.start.toISOString(),
        period_end: period.end.toISOString(),
        ...draft,
      });
      setData((current) => ({ ...current, review: response.review }));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="reviews-page">
      <div className="review-toolbar panel">
        <div>
          <span className="eyebrow">Guided review</span>
          <strong>{dateLabel(period)}</strong>
          <small>Built from your actual JDHub activity.</small>
        </div>
        <div className="review-period-controls">
          <div className="segmented-control" aria-label="Review period">
            <button className={type === 'daily' ? 'selected' : ''} onClick={() => selectType('daily')} type="button">Daily</button>
            <button className={type === 'weekly' ? 'selected' : ''} onClick={() => selectType('weekly')} type="button">Weekly</button>
          </div>
          <button aria-label="Previous period" className="icon-button" onClick={() => movePeriod(-1)} type="button"><ArrowLeft size={16} /></button>
          <button className="secondary-button" onClick={resetToCurrent} type="button">Current</button>
          <button aria-label="Next period" className="icon-button" onClick={() => movePeriod(1)} type="button"><ArrowRight size={16} /></button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {loading || !data ? <div className="panel review-loading">Preparing your review…</div> : (
        <>
          <div className="review-metrics">
            <article><CheckCircle2 size={18} /><span>Completed</span><strong>{data.completed.count}</strong></article>
            <article><CircleDollarSign size={18} /><span>Spent</span><strong>{money(data.finances.expense, data.finances.currency)}</strong></article>
            <article><ClipboardList size={18} /><span>Unfinished</span><strong>{data.unfinished_tasks.length}</strong></article>
            <article><CalendarDays size={18} /><span>Coming up</span><strong>{data.upcoming.count}</strong></article>
          </div>

          <div className="review-summary-grid">
            <article className="panel review-section">
              <header><div><span className="eyebrow">Progress</span><h3>Completed work</h3></div><CheckCircle2 size={20} /></header>
              <ReviewList
                empty={`No completed tasks or schedule items recorded for this ${type === 'daily' ? 'day' : 'week'}.`}
                items={[...data.completed.tasks.map((item) => ({ ...item, reviewKind: 'task' })), ...data.completed.schedule.map((item) => ({ ...item, reviewKind: 'schedule' }))]}
                renderItem={(item) => (
                  <button key={`${item.reviewKind}-${item._id}`} onClick={() => onNavigate(item.reviewKind === 'task' ? 'tasks' : 'scheduling')} type="button">
                    <span>{item.title}</span><small>{item.reviewKind === 'task' ? `Completed ${shortDate(item.completed_at, true)}` : `Schedule · ${shortDate(item.start_at, true)}`}</small>
                  </button>
                )}
              />
            </article>

            <article className="panel review-section">
              <header><div><span className="eyebrow">Money</span><h3>Cash movement</h3></div><CircleDollarSign size={20} /></header>
              <div className="review-money-summary">
                <div><span>Income</span><strong>{money(data.finances.income, data.finances.currency)}</strong></div>
                <div><span>Expenses</span><strong>{money(data.finances.expense, data.finances.currency)}</strong></div>
                <div><span>Net</span><strong>{money(data.finances.net, data.finances.currency)}</strong></div>
              </div>
              {data.finances.expense_categories.length ? (
                <div className="review-category-list">
                  {data.finances.expense_categories.slice(0, 5).map((item) => <div key={item.category}><span>{item.category}</span><strong>{money(item.amount, data.finances.currency)}</strong></div>)}
                </div>
              ) : <p className="review-empty">No expenses recorded in this period.</p>}
              <button className="text-button" onClick={() => onNavigate('finance')} type="button">Open Finance</button>
            </article>

            <article className="panel review-section">
              <header><div><span className="eyebrow">Carry over</span><h3>Unfinished tasks</h3></div><ClipboardList size={20} /></header>
              <ReviewList
                empty="Nothing is waiting in your task board."
                items={data.unfinished_tasks.slice(0, 8)}
                renderItem={(item) => (
                  <button key={item._id} onClick={() => onNavigate('tasks')} type="button">
                    <span>{item.title}</span><small>{item.due_date ? `Due ${shortDate(item.due_date)}` : `${item.status.replace('_', ' ')} · no due date`}</small>
                  </button>
                )}
              />
            </article>

            <article className="panel review-section">
              <header><div><span className="eyebrow">Next {type === 'daily' ? 'day' : 'week'}</span><h3>Upcoming obligations</h3></div><CalendarDays size={20} /></header>
              <ReviewList
                empty={`No schedules, reminders, or planned money items in the next ${type === 'daily' ? 'day' : 'week'}.`}
                items={[
                  ...data.upcoming.schedule.map((item) => ({ _id: `schedule-${item._id}`, title: item.title, detail: shortDate(item.start_at, true), page: 'scheduling' })),
                  ...data.upcoming.reminders.map((item) => ({ _id: `reminder-${item._id}`, title: item.title, detail: `Reminder · ${shortDate(item.remind_at, true)}`, page: 'scheduling' })),
                  ...data.upcoming.finances.map((item) => ({ _id: `finance-${item._id}`, title: item.title, detail: `${item.overdue ? 'Overdue · ' : ''}${money(item.amount, data.finances.currency)} · ${shortDate(item.date)}`, page: 'finance' })),
                ]}
                renderItem={(item) => <button key={item._id} onClick={() => onNavigate(item.page)} type="button"><span>{item.title}</span><small>{item.detail}</small></button>}
              />
            </article>
          </div>

          <form className="panel review-reflection" onSubmit={handleSave}>
            <header>
              <div><span className="eyebrow">Make it useful</span><h3>Your reflection</h3><p>Keep the part that only you can provide. You can return and edit it anytime.</p></div>
              <Sparkles size={22} />
            </header>
            <div className="review-prompt-grid">
              <label><span>What went well?</span><textarea onChange={(event) => updateDraft('wins', event.target.value)} placeholder="Wins, progress, or something worth remembering…" value={draft.wins} /></label>
              <label><span>What needs attention?</span><textarea onChange={(event) => updateDraft('reflection', event.target.value)} placeholder="What felt difficult, unfinished, or surprising?" value={draft.reflection} /></label>
              <label><span>What is the next focus?</span><textarea onChange={(event) => updateDraft('next_focus', event.target.value)} placeholder={type === 'daily' ? 'The most important thing for tomorrow…' : 'The main priority for next week…'} value={draft.next_focus} /></label>
            </div>
            <footer>
              <label className="review-energy"><span>Energy</span><select onChange={(event) => updateDraft('energy', event.target.value)} value={draft.energy}><option value="">Not set</option><option value="low">Low</option><option value="steady">Steady</option><option value="high">High</option></select></label>
              <div className="review-save-actions">
                {saved && <span className="review-saved-state"><CheckCircle2 size={15} />Saved</span>}
                <button className="primary-button" disabled={saving} type="submit"><Save size={16} />{saving ? 'Saving…' : 'Save review'}</button>
              </div>
            </footer>
          </form>

          <div className="review-diary-note panel">
            <BookLock size={20} />
            <div><strong>Your diary remains private</strong><p>{data.privacy.message} If you want deeper reflection, open it separately after this review.</p></div>
            <button className="secondary-button" onClick={() => onNavigate('diary')} type="button">Open diary</button>
          </div>
        </>
      )}
    </section>
  );
}
