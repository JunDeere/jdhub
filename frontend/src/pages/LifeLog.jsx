import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { archiveEntry, createEntry, getEntries, updateEntry } from '../api/entries.js';

function newDraftTab() {
  return {
    tabId: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    entryId: null,
    content: '',
    category: 'Note',
    tags: 'notes',
    dirty: false,
  };
}

function firstLineTitle(content) {
  const firstLine = String(content || '').split(/\r?\n/)[0] || '';
  return firstLine.trim();
}

function tabLabel(tab) {
  return firstLineTitle(tab.content) || 'Untitled';
}

function payloadFromTab(tab) {
  return {
    title: firstLineTitle(tab.content) || 'Untitled note',
    content: tab.content,
    category: tab.category || 'Note',
    related_project_id: null,
    tags: String(tab.tags || 'notes')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

function tabFromEntry(entry) {
  return {
    tabId: entry._id,
    entryId: entry._id,
    content: entry.content || '',
    category: entry.category || 'Note',
    tags: (entry.tags || []).join(', ') || 'notes',
    dirty: false,
  };
}

export default function LifeLog({ token, onEntriesChanged }) {
  const [tabs, setTabs] = useState([newDraftTab()]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.tabId === activeTabId) || tabs[0] || null,
    [tabs, activeTabId],
  );

  const savedCount = tabs.filter((tab) => tab.entryId).length;

  const loadEntries = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getEntries(token);
      const savedTabs = (data.entries || []).map(tabFromEntry);

      setTabs((currentTabs) => {
        const localDrafts = currentTabs.filter((tab) => !tab.entryId);
        const editedSavedTabs = currentTabs.filter((tab) => tab.entryId && tab.dirty);
        const editedIds = new Set(editedSavedTabs.map((tab) => tab.entryId));
        const mergedSavedTabs = savedTabs.map((tab) => (
          editedIds.has(tab.entryId)
            ? editedSavedTabs.find((edited) => edited.entryId === tab.entryId)
            : tab
        ));
        const nextTabs = [...localDrafts, ...mergedSavedTabs];
        return nextTabs.length ? nextTabs : [newDraftTab()];
      });

      setActiveTabId((currentId) => currentId || null);
      onEntriesChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [token]);

  useEffect(() => {
    if (!activeTabId && tabs.length) {
      setActiveTabId(tabs[0].tabId);
    }
  }, [activeTabId, tabs]);

  useEffect(() => {
    if (!activeTab?.dirty || loading) return undefined;
    if (!activeTab.entryId && !activeTab.content.trim()) return undefined;

    const saveTimer = window.setTimeout(async () => {
      setSaving(true);
      setError(null);

      try {
        const payload = payloadFromTab(activeTab);

        if (activeTab.entryId) {
          await updateEntry(token, activeTab.entryId, payload);
          setTabs((currentTabs) => currentTabs.map((tab) => (
            tab.tabId === activeTab.tabId ? { ...tab, ...payload, dirty: false } : tab
          )));
        } else {
          const data = await createEntry(token, payload);
          const entry = data.entry;
          if (entry?._id) {
            setTabs((currentTabs) => currentTabs.map((tab) => (
              tab.tabId === activeTab.tabId
                ? { ...tabFromEntry(entry), content: payload.content }
                : tab
            )));
            setActiveTabId(entry._id);
          }
        }

        setStatus('Autosaved.');
        onEntriesChanged?.();
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    }, 800);

    return () => window.clearTimeout(saveTimer);
  }, [activeTab, loading, onEntriesChanged, token]);

  const startNewNote = () => {
    const draftTab = newDraftTab();
    setTabs((currentTabs) => [draftTab, ...currentTabs]);
    setActiveTabId(draftTab.tabId);
    setStatus(null);
    setError(null);
  };

  const updateActiveContent = (content) => {
    if (!activeTab) return;

    setTabs((currentTabs) => currentTabs.map((tab) => (
      tab.tabId === activeTab.tabId ? { ...tab, content, dirty: true } : tab
    )));
    setStatus(null);
    setError(null);
  };

  const handleClear = async () => {
    if (!activeTab) return;
    setError(null);
    setStatus(null);

    if (!activeTab.entryId) {
      setTabs((currentTabs) => currentTabs.map((tab) => (
        tab.tabId === activeTab.tabId ? { ...tab, content: '', dirty: false } : tab
      )));
      return;
    }

    setSaving(true);
    try {
      const clearedTab = { ...activeTab, content: '', dirty: false };
      await updateEntry(token, activeTab.entryId, payloadFromTab(clearedTab));
      setTabs((currentTabs) => currentTabs.map((tab) => (
        tab.tabId === activeTab.tabId ? clearedTab : tab
      )));
      setStatus('Cleared.');
      onEntriesChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (tab) => {
    if (!tab.entryId) {
      setTabs((currentTabs) => {
        const nextTabs = currentTabs.filter((item) => item.tabId !== tab.tabId);
        return nextTabs.length ? nextTabs : [newDraftTab()];
      });
      setActiveTabId((currentId) => (currentId === tab.tabId ? null : currentId));
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      await archiveEntry(token, tab.entryId);
      setTabs((currentTabs) => {
        const nextTabs = currentTabs.filter((item) => item.tabId !== tab.tabId);
        return nextTabs.length ? nextTabs : [newDraftTab()];
      });
      setActiveTabId((currentId) => (currentId === tab.tabId ? null : currentId));
      setStatus('Archived.');
      onEntriesChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="notes-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Notepad</p>
          <h2>Notes</h2>
        </div>
        <span className="status-pill">{saving ? 'Autosaving...' : `${savedCount} saved notes`}</span>
      </div>

      <div className="notepad-shell">
        <div className="notepad-tabs" aria-label="Open notes">
          {tabs.map((tab) => {
            const label = tabLabel(tab);

            return (
              <button
                className={tab.tabId === activeTab?.tabId ? 'note-tab active' : 'note-tab'}
                key={tab.tabId}
                onClick={() => setActiveTabId(tab.tabId)}
                title={label}
                type="button"
              >
                <span className="note-tab-title">{label}</span>
              </button>
            );
          })}

          <button
            aria-label="New note"
            className="note-tab-add"
            onClick={startNewNote}
            title="New note"
            type="button"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="notepad-toolbar">
          <div>
            <strong>{activeTab?.entryId ? 'Saved note' : 'New note'}</strong>
            <span>{loading ? 'Loading notes...' : 'Autosaves after typing. Empty new tabs stay local until they have content.'}</span>
          </div>
          <div className="notepad-actions">
            <button className="secondary-button" disabled={saving} onClick={handleClear} type="button">
              <Trash2 size={16} />
              Clear
            </button>
            {activeTab?.entryId && (
              <button className="secondary-button danger-button" disabled={saving} onClick={() => handleArchive(activeTab)} type="button">
                Archive
              </button>
            )}
          </div>
        </div>

        <textarea
          aria-label="Note content"
          className="notepad-editor"
          onChange={(event) => updateActiveContent(event.target.value)}
          placeholder="Start typing..."
          spellCheck="true"
          value={activeTab?.content || ''}
        />

        {(error || status) && (
          <div className="notepad-status">
            {error && <div className="alert-error">{error}</div>}
            {status && <div className="alert-success">{status}</div>}
          </div>
        )}
      </div>
    </section>
  );
}
