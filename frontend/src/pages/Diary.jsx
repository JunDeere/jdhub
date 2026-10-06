import {
  BookLock,
  CalendarDays,
  ChevronRight,
  Eye,
  EyeOff,
  Lightbulb,
  LockKeyhole,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDiaryEntry,
  createDiaryVault,
  deleteDiaryEntry,
  getDiary,
  updateDiaryEntry,
  updateDiarySettings,
} from '../api/diary.js';
import StatusToast from '../components/StatusToast.jsx';
import {
  createDiaryKeyMaterial,
  decryptDiaryPayload,
  encryptDiaryPayload,
  unlockDiaryKey,
} from '../utils/diaryCrypto.js';

const EMPTY_DRAFT = {
  title: '',
  content: '',
  mood: 'neutral',
  entryDate: new Date().toISOString().slice(0, 10),
};

function dateLabel(value) {
  if (!value) return 'Recent entry';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'Recent entry';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function memoryPrompt(entry) {
  if (!entry) return null;
  const cleanContent = String(entry.content || '').replace(/\s+/g, ' ').trim();
  const subject = (entry.title || cleanContent.split(/[.!?]/)[0] || 'your last entry').slice(0, 110);
  const entryDay = entry.entryDate ? new Date(`${entry.entryDate}T12:00:00`) : null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const age = entryDay && !Number.isNaN(entryDay.getTime())
    ? Math.round((today.getTime() - entryDay.getTime()) / 86_400_000)
    : null;

  if (age === 1) return `Yesterday you wrote about “${subject}.” What happened next?`;
  if (age === 0) return `Earlier today you wrote about “${subject}.” Is there anything you want to add?`;
  return `Last time you wrote about “${subject}.” What has happened since then?`;
}

export default function Diary({ token }) {
  const [vault, setVault] = useState(null);
  const [encryptedEntries, setEncryptedEntries] = useState([]);
  const [entries, setEntries] = useState([]);
  const [diaryKey, setDiaryKey] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [setupPrompts, setSetupPrompts] = useState(true);
  const [promptOffset, setPromptOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const lastActivityRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getDiary(token)
      .then((data) => {
        if (cancelled) return;
        setVault(data.vault || null);
        setEncryptedEntries(data.entries || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  const lockDiary = useCallback(() => {
    setDiaryKey(null);
    setEntries([]);
    setActiveId(null);
    setDraft({ ...EMPTY_DRAFT, entryDate: new Date().toISOString().slice(0, 10) });
    setPassword('');
    setConfirmation('');
    setStatus('Diary locked.');
  }, []);

  useEffect(() => {
    if (!diaryKey) return undefined;
    const noteActivity = () => { lastActivityRef.current = Date.now(); };
    const checkIdleTime = () => {
      if (Date.now() - lastActivityRef.current >= 15 * 60 * 1000) lockDiary();
    };
    lastActivityRef.current = Date.now();
    window.addEventListener('keydown', noteActivity);
    window.addEventListener('pointerdown', noteActivity);
    const timer = window.setInterval(checkIdleTime, 30_000);
    return () => {
      window.removeEventListener('keydown', noteActivity);
      window.removeEventListener('pointerdown', noteActivity);
      window.clearInterval(timer);
    };
  }, [diaryKey, lockDiary]);

  const activeEntry = useMemo(
    () => entries.find((entry) => entry._id === activeId) || null,
    [activeId, entries],
  );
  const promptEntries = useMemo(
    () => entries.filter((entry) => entry.content?.trim() || entry.title?.trim()),
    [entries],
  );
  const currentPrompt = vault?.memory_prompts_enabled && promptEntries.length
    ? memoryPrompt(promptEntries[promptOffset % promptEntries.length])
    : null;

  const decryptEntries = async (key) => {
    const unlocked = await Promise.all(encryptedEntries.map(async (entry) => ({
      ...entry,
      ...await decryptDiaryPayload(key, entry),
    })));
    setEntries(unlocked);
    if (unlocked[0]) {
      setActiveId(unlocked[0]._id);
      setDraft({
        title: unlocked[0].title || '',
        content: unlocked[0].content || '',
        mood: unlocked[0].mood || 'neutral',
        entryDate: unlocked[0].entryDate || new Date(unlocked[0].createdAt).toISOString().slice(0, 10),
      });
    }
  };

  const handleSetup = async (event) => {
    event.preventDefault();
    setError(null);
    if (password.length < 10) return setError('Use at least 10 characters for your diary password.');
    if (password !== confirmation) return setError('The diary passwords do not match.');

    setSaving(true);
    try {
      const material = await createDiaryKeyMaterial(password);
      const data = await createDiaryVault(token, {
        ...material.vault,
        memory_prompts_enabled: setupPrompts,
      });
      setVault(data.vault);
      setDiaryKey(material.diaryKey);
      setPassword('');
      setConfirmation('');
      setStatus('Encrypted diary created.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUnlock = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const key = await unlockDiaryKey(password, vault);
      await decryptEntries(key);
      setDiaryKey(key);
      setPassword('');
      setStatus('Diary unlocked on this device.');
    } catch {
      setError('That diary password is incorrect, or the encrypted vault is damaged.');
    } finally {
      setSaving(false);
    }
  };

  const startEntry = () => {
    setActiveId(null);
    setDraft({ ...EMPTY_DRAFT, entryDate: new Date().toISOString().slice(0, 10) });
  };

  const selectEntry = (entry) => {
    setActiveId(entry._id);
    setDraft({
      title: entry.title || '',
      content: entry.content || '',
      mood: entry.mood || 'neutral',
      entryDate: entry.entryDate || new Date(entry.createdAt).toISOString().slice(0, 10),
    });
  };

  const handleSave = async () => {
    if (!draft.title.trim() && !draft.content.trim()) return setError('Write something before saving the entry.');
    setSaving(true);
    setError(null);
    try {
      const privatePayload = {
        title: draft.title.trim() || 'Untitled entry',
        content: draft.content,
        mood: draft.mood,
        entryDate: draft.entryDate,
      };
      const encrypted = await encryptDiaryPayload(diaryKey, privatePayload);
      if (activeEntry) {
        const data = await updateDiaryEntry(token, activeEntry._id, encrypted);
        setEncryptedEntries((current) => current.map((entry) => (
          entry._id === activeEntry._id ? data.entry : entry
        )));
        setEntries((current) => current.map((entry) => (
          entry._id === activeEntry._id ? { ...entry, ...data.entry, ...privatePayload } : entry
        )));
      } else {
        const data = await createDiaryEntry(token, encrypted);
        const created = { ...data.entry, ...privatePayload };
        setEncryptedEntries((current) => [data.entry, ...current]);
        setEntries((current) => [created, ...current]);
        setActiveId(created._id);
      }
      setStatus('Diary entry encrypted and saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeEntry) return;
    if (!window.confirm('Permanently delete this encrypted diary entry?')) return;
    setSaving(true);
    setError(null);
    try {
      await deleteDiaryEntry(token, activeEntry._id);
      const remaining = entries.filter((entry) => entry._id !== activeEntry._id);
      setEntries(remaining);
      setEncryptedEntries((current) => current.filter((entry) => entry._id !== activeEntry._id));
      if (remaining[0]) selectEntry(remaining[0]);
      else startEntry();
      setStatus('Diary entry permanently deleted.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleMemoryPrompts = async () => {
    const enabled = !vault.memory_prompts_enabled;
    setError(null);
    try {
      const data = await updateDiarySettings(token, { memory_prompts_enabled: enabled });
      setVault(data.vault);
      setStatus(enabled ? 'Memory prompts enabled.' : 'Memory prompts disabled.');
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <section className="diary-page"><div className="diary-gate panel">Loading your encrypted diary…</div></section>;
  }

  if (!vault) {
    return (
      <section className="diary-page">
        <div className="diary-gate panel">
          <div className="diary-gate-icon"><BookLock size={28} /></div>
          <div><span className="eyebrow">Personal diary</span><h2>Create your private diary</h2></div>
          <p>Your entries are encrypted in this browser before they are saved. JDHub stores ciphertext and cannot read the title or text.</p>
          <form className="diary-password-form" onSubmit={handleSetup}>
            <label>
              Diary password
              <div className="diary-password-field">
                <input autoComplete="new-password" minLength="10" onChange={(event) => setPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} value={password} />
                <button aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((current) => !current)} type="button">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </label>
            <label>
              Confirm diary password
              <input autoComplete="new-password" minLength="10" onChange={(event) => setConfirmation(event.target.value)} required type={showPassword ? 'text' : 'password'} value={confirmation} />
            </label>
            <label className="diary-check-row"><input checked={setupPrompts} onChange={(event) => setSetupPrompts(event.target.checked)} type="checkbox" /><span><strong>Memory prompts</strong><small>After unlocking, use a recent entry to help you continue your story.</small></span></label>
            <div className="diary-security-note"><ShieldCheck size={17} /><span>There is no administrator reset. If you lose this password, the diary cannot be recovered.</span></div>
            <button className="primary-button" disabled={saving} type="submit"><LockKeyhole size={17} />{saving ? 'Creating encrypted diary…' : 'Create encrypted diary'}</button>
          </form>
        </div>
        <StatusToast error={error} success={status} onDismiss={() => { setError(null); setStatus(null); }} />
      </section>
    );
  }

  if (!diaryKey) {
    return (
      <section className="diary-page">
        <div className="diary-gate panel">
          <div className="diary-gate-icon"><LockKeyhole size={28} /></div>
          <div><span className="eyebrow">Personal diary</span><h2>Unlock your diary</h2></div>
          <p>Your password and decrypted entries remain in this browser. The diary locks automatically after 15 minutes of inactivity.</p>
          <form className="diary-password-form" onSubmit={handleUnlock}>
            <label>
              Diary password
              <div className="diary-password-field">
                <input autoFocus autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} value={password} />
                <button aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((current) => !current)} type="button">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </label>
            <button className="primary-button" disabled={saving} type="submit">{saving ? 'Unlocking…' : 'Unlock diary'}</button>
          </form>
        </div>
        <StatusToast error={error} success={status} onDismiss={() => { setError(null); setStatus(null); }} />
      </section>
    );
  }

  return (
    <section className="diary-page">
      <div className="diary-toolbar">
        <div className="diary-privacy-state"><ShieldCheck size={16} /><span>Unlocked locally</span></div>
        <div className="diary-toolbar-actions">
          <label className="diary-prompt-toggle"><input checked={Boolean(vault.memory_prompts_enabled)} onChange={toggleMemoryPrompts} type="checkbox" /><span>Memory prompts</span></label>
          <button className="secondary-button" onClick={lockDiary} type="button"><LockKeyhole size={16} />Lock</button>
          <button className="primary-button" onClick={startEntry} type="button"><Plus size={17} />New entry</button>
        </div>
      </div>

      {currentPrompt && (
        <div className="diary-memory-prompt">
          <Lightbulb size={19} />
          <div><span>Continue the memory</span><strong>{currentPrompt}</strong></div>
          {promptEntries.length > 1 && <button className="text-button" onClick={() => setPromptOffset((current) => current + 1)} type="button">Another prompt</button>}
        </div>
      )}

      <div className="diary-workspace">
        <aside className="diary-entry-list" aria-label="Diary entries">
          <div className="diary-list-heading"><strong>Entries</strong><span>{entries.length}</span></div>
          {entries.length ? entries.map((entry) => (
            <button className={entry._id === activeId ? 'diary-entry-row active' : 'diary-entry-row'} key={entry._id} onClick={() => selectEntry(entry)} type="button">
              <div><strong>{entry.title || 'Untitled entry'}</strong><span>{dateLabel(entry.entryDate)}</span></div><ChevronRight size={16} />
            </button>
          )) : <div className="diary-empty-list"><BookLock size={24} /><span>Your first entry will appear here.</span></div>}
        </aside>

        <article className="diary-editor">
          <div className="diary-editor-fields">
            <input aria-label="Diary entry title" className="diary-title-input" onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Give today a title…" value={draft.title} />
            <div className="diary-entry-meta">
              <label><CalendarDays size={15} /><input aria-label="Entry date" onChange={(event) => setDraft((current) => ({ ...current, entryDate: event.target.value }))} type="date" value={draft.entryDate} /></label>
              <select aria-label="Mood" onChange={(event) => setDraft((current) => ({ ...current, mood: event.target.value }))} value={draft.mood}>
                <option value="great">Great</option><option value="good">Good</option><option value="neutral">Neutral</option><option value="low">Low</option><option value="difficult">Difficult</option>
              </select>
            </div>
            <textarea aria-label="Diary entry" onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))} placeholder="What happened today? Write it as it comes to you…" spellCheck="true" value={draft.content} />
          </div>
          <footer className="diary-editor-footer">
            <span><LockKeyhole size={14} />Encrypted before upload</span>
            <div>{activeEntry && <button className="secondary-button danger-button" disabled={saving} onClick={handleDelete} type="button"><Trash2 size={16} />Delete</button>}<button className="primary-button" disabled={saving} onClick={handleSave} type="button"><Save size={16} />{saving ? 'Encrypting…' : 'Save entry'}</button></div>
          </footer>
        </article>
      </div>
      <StatusToast error={error} success={status} onDismiss={() => { setError(null); setStatus(null); }} />
    </section>
  );
}
