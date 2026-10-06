import { Copy, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { archiveEntry, createEntry, getEntries, updateEntry } from '../api/entries.js';
import { getNotepadSyncStatus } from '../api/notepadSync.js';
import StatusToast from '../components/StatusToast.jsx';

function newDraftTab() {
  return {
    tabId: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    entryId: null,
    content: '',
    category: 'Note',
    tags: 'notes',
    dirty: false,
    readOnly: false,
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
  const isDesktopBackup = entry.metadata?.source === 'windows_notepad';
  return {
    tabId: entry._id,
    entryId: entry._id,
    content: entry.content || '',
    category: entry.category || 'Note',
    tags: (entry.tags || []).join(', ') || 'notes',
    dirty: false,
    readOnly: isDesktopBackup && entry.metadata?.desktop_read_only !== false,
    source: isDesktopBackup ? 'windows_notepad' : 'web',
    sourceName: entry.metadata?.source_name || null,
    syncedAt: entry.metadata?.synced_at || null,
  };
}

export default function LifeLog({ token, refreshKey, onEntriesChanged }) {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.tabId === activeTabId) || tabs[0] || null,
    [tabs, activeTabId],
  );

  useEffect(() => {
    let cancelled = false;

    Promise.all([getEntries(token), getNotepadSyncStatus(token)])
      .then(([data, desktopStatus]) => {
        if (cancelled) return;
        setSyncStatus(desktopStatus);
        const savedTabs = (data.entries || []).map(tabFromEntry);
        const emptyStateDraft = savedTabs.length ? null : newDraftTab();

        setTabs((currentTabs) => {
          const localDrafts = currentTabs.filter((tab) => !tab.entryId && (tab.dirty || tab.content.trim()));
          const editedSavedTabs = currentTabs.filter((tab) => tab.entryId && tab.dirty);
          const editedIds = new Set(editedSavedTabs.map((tab) => tab.entryId));
          const mergedSavedTabs = savedTabs.map((tab) => (
            editedIds.has(tab.entryId)
              ? editedSavedTabs.find((edited) => edited.entryId === tab.entryId)
              : tab
          ));
          const nextTabs = [...localDrafts, ...mergedSavedTabs];
          return nextTabs.length ? nextTabs : [emptyStateDraft || newDraftTab()];
        });
        setActiveTabId((currentId) => currentId || savedTabs[0]?.tabId || emptyStateDraft?.tabId || null);
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
  }, [token, refreshKey]);

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

  const closeTab = (tabToClose) => {
    setStatus(null);
    setError(null);
    const closingIndex = tabs.findIndex((tab) => tab.tabId === tabToClose.tabId);
    const remainingTabs = tabs.filter((tab) => tab.tabId !== tabToClose.tabId);
    const nextTabs = remainingTabs.length ? remainingTabs : [newDraftTab()];

    if (activeTabId === tabToClose.tabId) {
      const nextActiveTab = nextTabs[Math.min(Math.max(closingIndex, 0), nextTabs.length - 1)];
      setActiveTabId(nextActiveTab.tabId);
    }

    setTabs(nextTabs);
  };

  const updateActiveContent = (content) => {
    if (!activeTab || activeTab.readOnly) return;

    setTabs((currentTabs) => currentTabs.map((tab) => (
      tab.tabId === activeTab.tabId ? { ...tab, content, dirty: true } : tab
    )));
    setStatus(null);
    setError(null);
  };

  const handleClear = async () => {
    if (!activeTab || activeTab.readOnly) return;
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
    if (tab.readOnly) return;
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

  const makeEditableCopy = async () => {
    if (!activeTab?.readOnly) return;
    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const data = await createEntry(token, {
        title: firstLineTitle(activeTab.content) || activeTab.sourceName || 'Notepad copy',
        content: activeTab.content,
        category: 'Note',
        related_project_id: null,
        tags: ['notes', 'desktop-copy'],
      });
      const copy = tabFromEntry(data.entry);
      setTabs((currentTabs) => [copy, ...currentTabs]);
      setActiveTabId(copy.tabId);
      setStatus('Editable web copy created. The Windows backup remains unchanged.');
      onEntriesChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="notes-page">
      <div className={syncStatus?.connected ? 'notepad-backup-banner connected' : 'notepad-backup-banner'}>
        <div>
          <strong>{syncStatus?.connected ? 'Windows Notepad backup connected' : 'Windows Notepad backup not connected yet'}</strong>
          <span>
            {syncStatus?.connected
              ? `${syncStatus.desktopNoteCount} desktop notes backed up. Last snapshot ${new Date(syncStatus.latest.captured_at).toLocaleString()}.`
              : 'Web notes still autosave normally. Start the desktop bridge to add read-only Notepad backups.'}
          </span>
        </div>
        <span className="note-source-badge">Desktop → JDHub</span>
      </div>

      <div className="notepad-shell">
        <div className="notepad-tabs" aria-label="Open notes">
          {tabs.map((tab) => {
            const label = tabLabel(tab);
            const isActive = tab.tabId === activeTab?.tabId;

            return (
              <div className={isActive ? 'note-tab active' : 'note-tab'} key={tab.tabId}>
                <button
                  className="note-tab-select"
                  onClick={() => setActiveTabId(tab.tabId)}
                  title={label}
                  type="button"
                >
                  <span className="note-tab-title">{label}</span>
                </button>
                <button
                  aria-label={`Close ${label}`}
                  className="note-tab-close"
                  onClick={() => closeTab(tab)}
                  title="Close tab"
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
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
            <strong>{activeTab?.readOnly ? 'Windows Notepad backup' : (activeTab?.entryId ? 'Saved web note' : 'New web note')}</strong>
            <span>
              {loading
                ? 'Loading notes...'
                : (activeTab?.readOnly
                  ? `${activeTab.sourceName || 'Notepad tab'} is read-only here. Keep editing it in Windows Notepad.`
                  : 'Autosaves after typing. Empty new tabs stay local until they have content.')}
            </span>
          </div>
          <div className="notepad-actions">
            {activeTab?.readOnly ? (
              <button className="secondary-button" disabled={saving} onClick={makeEditableCopy} type="button">
                <Copy size={16} />
                Make editable web copy
              </button>
            ) : (
              <button className="secondary-button" disabled={saving} onClick={handleClear} type="button">
                <Trash2 size={16} />
                Clear
              </button>
            )}
            {activeTab?.entryId && !activeTab.readOnly && (
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
          placeholder={activeTab?.readOnly ? 'This Windows Notepad backup is read-only.' : 'Start typing...'}
          readOnly={Boolean(activeTab?.readOnly)}
          spellCheck="true"
          value={activeTab?.content || ''}
        />

      </div>
      <StatusToast error={error} success={status} onDismiss={() => { setError(null); setStatus(null); }} />
    </section>
  );
}
