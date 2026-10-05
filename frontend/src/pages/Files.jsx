import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
  Copy,
  Download,
  File,
  FileArchive,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  FolderKanban,
  Grid2X2,
  HardDrive,
  LayoutList,
  Link2,
  Pencil,
  Plus,
  Search,
  Server,
  Share2,
  ShieldCheck,
  TriangleAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { createFileShare, createFolder, deleteFileItem, downloadFile, getFiles, getFileShare, moveFileItems, revokeFileShare, updateFileItem, uploadFile } from '../api/files.js';
import { formatLocalDate } from '../utils/dateTime.js';

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${units[index]}`;
}

function FileTypeIcon({ item, size = 22 }) {
  if (item.kind === 'folder') return <Folder size={size} />;
  if (item.mime_type?.startsWith('image/')) return <FileImage size={size} />;
  if (item.mime_type?.includes('zip') || item.mime_type?.includes('compressed')) return <FileArchive size={size} />;
  if (item.mime_type?.startsWith('text/') || item.mime_type?.includes('pdf')) return <FileText size={size} />;
  return <File size={size} />;
}

export default function Files({ token }) {
  const [items, setItems] = useState([]);
  const [parentId, setParentId] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [summary, setSummary] = useState({ file: { count: 0, bytes: 0 }, folder: { count: 0, bytes: 0 } });
  const [storage, setStorage] = useState({
    label: 'JDHub Cloud',
    maxSizeMb: null,
    userQuotaBytes: 10 * (1024 ** 3),
    userUsedBytes: 0,
  });
  const [displayMode, setDisplayMode] = useState('grid');
  const [libraryView, setLibraryView] = useState('files');
  const [query, setQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [inlineFolder, setInlineFolder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workspaceDragActive, setWorkspaceDragActive] = useState(false);
  const [folderDropTargetId, setFolderDropTargetId] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);
  const [downloadingId, setDownloadingId] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [draggingItemIds, setDraggingItemIds] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [sharingItem, setSharingItem] = useState(null);
  const [shareData, setShareData] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [editForm, setEditForm] = useState({ name: '' });
  const fileInputRef = useRef(null);
  const inlineFolderInputRef = useRef(null);
  const inlineFolderCommitRef = useRef(false);
  const renameCommitRef = useRef(false);
  const noticeTimerRef = useRef(null);
  const usagePercent = storage.userQuotaBytes
    ? Math.min(100, Math.round((storage.userUsedBytes / storage.userQuotaBytes) * 100))
    : 0;
  const isSystemStorage = storage.scope === 'system';
  const storageTitle = isSystemStorage ? 'Combined storage' : 'My storage';
  const selectOnly = (id) => setSelectedItemIds(id ? [id] : []);

  const loadFiles = async ({ folderId = parentId, search = activeSearch, view = libraryView } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFiles(token, { parentId: folderId, search, view });
      setItems(data.items || []);
      setBreadcrumbs(data.breadcrumbs || []);
      setSummary(data.summary || summary);
      setStorage(data.storage || storage);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getFiles(token)
      .then((fileData) => {
        if (cancelled) return;
        setItems(fileData.items || []);
        setBreadcrumbs(fileData.breadcrumbs || []);
        setSummary(fileData.summary || { file: { count: 0, bytes: 0 }, folder: { count: 0, bytes: 0 } });
        setStorage(fileData.storage || {
          label: 'JDHub Cloud',
          maxSizeMb: null,
          userQuotaBytes: 10 * (1024 ** 3),
          userUsedBytes: 0,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!error && !status) return undefined;
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setError(null);
      setStatus(null);
    }, 3000);
    return () => clearTimeout(noticeTimerRef.current);
  }, [error, status]);

  useEffect(() => {
    const dismissMenu = () => setContextMenu(null);
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') dismissMenu();
    };
    window.addEventListener('click', dismissMenu);
    window.addEventListener('blur', dismissMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', dismissMenu, true);
    return () => {
      window.removeEventListener('click', dismissMenu);
      window.removeEventListener('blur', dismissMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', dismissMenu, true);
    };
  }, []);

  const enterFolder = async (folder) => {
    setInlineFolder(null);
    setParentId(folder?._id || '');
    setLibraryView('files');
    setActiveSearch('');
    setQuery('');
    await loadFiles({ folderId: folder?._id || '', search: '', view: 'files' });
  };

  const changeLibraryView = async (view) => {
    setInlineFolder(null);
    setLibraryView(view);
    setParentId('');
    setActiveSearch('');
    setQuery('');
    await loadFiles({ folderId: '', search: '', view });
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    const nextSearch = query.trim();
    setActiveSearch(nextSearch);
    await loadFiles({ folderId: parentId, search: nextSearch, view: libraryView });
  };

  const clearSearch = async () => {
    setQuery('');
    setActiveSearch('');
    await loadFiles({ folderId: parentId, search: '', view: libraryView });
  };

  const commitInlineFolder = async () => {
    if (!inlineFolder || inlineFolderCommitRef.current) return;
    const name = inlineFolder.name.trim();
    if (!name) {
      setInlineFolder(null);
      return;
    }
    inlineFolderCommitRef.current = true;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const data = await createFolder(token, { name, parentId: inlineFolder.parentId });
      selectOnly(data.item?._id || '');
      setInlineFolder(null);
      setLibraryView('files');
      setStatus('Folder created.');
      await loadFiles({ folderId: inlineFolder.parentId, search: '', view: 'files' });
    } catch (err) {
      setError(err.message);
      requestAnimationFrame(() => inlineFolderInputRef.current?.select());
    } finally {
      inlineFolderCommitRef.current = false;
      setSaving(false);
    }
  };

  const uploadDirectly = async (fileList, options = {}) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const hasExplicitTarget = Object.hasOwn(options, 'targetParentId');
    let targetParentId = hasExplicitTarget ? options.targetParentId : parentId;
    if (!hasExplicitTarget && (libraryView !== 'files' || activeSearch)) targetParentId = '';
    setSaving(true);
    setError(null);
    setStatus(null);
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    let completedBytes = 0;
    setUploadProgress({
      fileName: files[0].name,
      current: 1,
      total: files.length,
      loadedBytes: 0,
      totalBytes,
      percent: 0,
      targetName: options.targetName || '',
    });
    try {
      let latestItemId = '';
      for (const [index, file] of files.entries()) {
        setUploadProgress((current) => ({
          ...current,
          fileName: file.name,
          current: index + 1,
        }));
        const data = await uploadFile(token, {
          file,
          parentId: targetParentId,
          relatedProjectId: '',
          description: '',
          onProgress: ({ loaded }) => {
            const overallLoaded = completedBytes + Math.min(loaded, file.size);
            const percent = totalBytes
              ? Math.min(99, Math.round((overallLoaded / totalBytes) * 100))
              : Math.round(((index + 0.9) / files.length) * 100);
            setUploadProgress((current) => ({
              ...current,
              fileName: file.name,
              current: index + 1,
              loadedBytes: overallLoaded,
              percent,
            }));
          },
        });
        completedBytes += file.size;
        latestItemId = data.item?._id || latestItemId;
      }
      setUploadProgress((current) => ({
        ...current,
        loadedBytes: totalBytes,
        percent: 100,
      }));
      if (options.keepCurrentView) {
        selectOnly(options.targetParentId || '');
        setStatus(files.length === 1
          ? `${files[0].name} uploaded to ${options.targetName}.`
          : `${files.length} files uploaded to ${options.targetName}.`);
        await loadFiles({ folderId: parentId, search: activeSearch, view: libraryView });
      } else {
        selectOnly(latestItemId);
        setLibraryView('files');
        setParentId(targetParentId);
        setActiveSearch('');
        setQuery('');
        setStatus(files.length === 1 ? `${files[0].name} uploaded.` : `${files.length} files uploaded.`);
        await loadFiles({ folderId: targetParentId, search: '', view: 'files' });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (item) => {
    setDownloadingId(item._id);
    setError(null);
    try {
      await downloadFile(token, item);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingId('');
    }
  };

  const isFileDrag = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');
  const internalDragType = 'application/x-jdhub-file-items';
  const isInternalItemDrag = (event) => Array.from(event.dataTransfer?.types || []).includes(internalDragType);

  const handleWorkspaceDrag = (event) => {
    if ((!isFileDrag(event) && !isInternalItemDrag(event)) || saving) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = isInternalItemDrag(event) ? 'move' : 'copy';
    setWorkspaceDragActive(true);
  };

  const leaveWorkspaceDrag = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setWorkspaceDragActive(false);
    setFolderDropTargetId('');
  };

  const handleFolderDrag = (event, folder) => {
    if ((!isFileDrag(event) && !isInternalItemDrag(event)) || saving) return;
    if (isInternalItemDrag(event) && draggingItemIds.includes(folder._id)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = isInternalItemDrag(event) ? 'move' : 'copy';
    setWorkspaceDragActive(true);
    setFolderDropTargetId(folder._id);
  };

  const leaveFolderDrag = (event, folder) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setFolderDropTargetId((current) => current === folder._id ? '' : current);
  };

  const acceptDroppedFile = async (event, folder = null) => {
    event.preventDefault();
    event.stopPropagation();
    setWorkspaceDragActive(false);
    setFolderDropTargetId('');
    if (saving) return;

    if (isInternalItemDrag(event)) {
      const ids = draggingItemIds.length
        ? draggingItemIds
        : JSON.parse(event.dataTransfer.getData(internalDragType) || '[]');
      if (!folder || !ids.length || ids.includes(folder._id)) return;
      setSaving(true);
      setError(null);
      setStatus(null);
      try {
        const result = await moveFileItems(token, ids, folder._id);
        setStatus(`${result.movedCount} ${result.movedCount === 1 ? 'item' : 'items'} moved to ${folder.name}.`);
        setSelectedItemIds([]);
        await loadFiles({ folderId: parentId, search: activeSearch, view: libraryView });
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
        setDraggingItemIds([]);
      }
      return;
    }

    if (!isFileDrag(event)) return;
    uploadDirectly(event.dataTransfer.files, folder ? {
      targetParentId: folder._id,
      targetName: folder.name,
      keepCurrentView: true,
    } : {});
  };

  const closePanels = () => {
    setInlineFolder(null);
    setEditingItem(null);
    setEditForm({ name: '' });
    setError(null);
  };

  const openUpload = () => {
    closePanels();
    setContextMenu(null);
    fileInputRef.current?.click();
  };

  const openFolder = async () => {
    closePanels();
    setContextMenu(null);
    let targetParentId = parentId;
    if (libraryView !== 'files' || activeSearch) {
      targetParentId = '';
      setLibraryView('files');
      setParentId('');
      setActiveSearch('');
      setQuery('');
      await loadFiles({ folderId: '', search: '', view: 'files' });
    }
    setInlineFolder({ name: 'New folder', parentId: targetParentId });
    selectOnly('__new-folder__');
  };

  const openItemEditor = (item) => {
    closePanels();
    setEditingItem(item);
    setEditForm({ name: item.name || '' });
    selectOnly(item._id);
    setContextMenu(null);
  };

  const openShare = async (item) => {
    setContextMenu(null);
    setSharingItem(item);
    setShareData(null);
    setShareCopied(false);
    setShareBusy(true);
    setError(null);
    try {
      const data = await getFileShare(token, item._id);
      setShareData(data.share ? { share: data.share } : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setShareBusy(false);
    }
  };

  const handleCreateShare = async () => {
    if (!sharingItem) return;
    setShareBusy(true);
    setShareCopied(false);
    setError(null);
    try {
      setShareData(await createFileShare(token, sharingItem._id));
    } catch (err) {
      setError(err.message);
    } finally {
      setShareBusy(false);
    }
  };

  const handleCopyShare = async () => {
    if (!shareData?.url) return;
    await navigator.clipboard.writeText(shareData.url);
    setShareCopied(true);
  };

  const handleRevokeShare = async () => {
    const shareId = shareData?.share?._id;
    if (!shareId) return;
    setShareBusy(true);
    setError(null);
    try {
      await revokeFileShare(token, shareId);
      setShareData(null);
      setStatus('Share link revoked and deleted.');
    } catch (err) {
      setError(err.message);
    } finally {
      setShareBusy(false);
    }
  };

  const handleItemUpdate = async () => {
    if (!editingItem || renameCommitRef.current) return;
    const nextName = editForm.name.trim();
    if (!nextName || nextName === editingItem.name) {
      setEditingItem(null);
      setEditForm({ name: '' });
      return;
    }
    renameCommitRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await updateFileItem(token, editingItem._id, { name: nextName });
      setStatus(`${editingItem.kind === 'folder' ? 'Folder' : 'File'} renamed.`);
      setEditingItem(null);
      setEditForm({ name: '' });
      await loadFiles({ folderId: parentId, search: activeSearch, view: libraryView });
    } catch (err) {
      setError(err.message);
    } finally {
      renameCommitRef.current = false;
      setSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    setSaving(true);
    setError(null);
    try {
      await deleteFileItem(token, deletingItem._id);
      setStatus(`${deletingItem.kind === 'folder' ? 'Folder' : 'File'} deleted.`);
      setDeletingItem(null);
      selectOnly('');
      await loadFiles({ folderId: parentId, search: activeSearch, view: libraryView });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const pauseNotice = () => clearTimeout(noticeTimerRef.current);
  const resumeNotice = () => {
    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setError(null);
      setStatus(null);
    }, 3000);
  };

  const openItem = async (item) => {
    if (item.kind === 'folder') await enterFolder(item);
    else await handleDownload(item);
  };

  const openContextMenu = (event, item = null) => {
    if (!item && (libraryView !== 'files' || event.target.closest?.('.file-item'))) return;
    event.preventDefault();
    event.stopPropagation();
    if (item && !selectedItemIds.includes(item._id)) selectOnly(item._id);
    setContextMenu({
      x: Math.min(event.clientX, window.innerWidth - 220),
      y: Math.min(event.clientY, window.innerHeight - 130),
      item,
    });
  };

  const selectItem = (event, item) => {
    if (event.ctrlKey || event.metaKey) {
      setSelectedItemIds((current) => current.includes(item._id)
        ? current.filter((id) => id !== item._id)
        : [...current, item._id]);
      return;
    }
    selectOnly(item._id);
  };

  const startItemDrag = (event, item) => {
    if (editingItem?._id === item._id || saving) {
      event.preventDefault();
      return;
    }
    const ids = selectedItemIds.includes(item._id) ? selectedItemIds : [item._id];
    if (!selectedItemIds.includes(item._id)) setSelectedItemIds(ids);
    setDraggingItemIds(ids);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(internalDragType, JSON.stringify(ids));
    event.dataTransfer.setData('text/plain', ids.join(','));
  };

  const finishItemDrag = () => {
    setDraggingItemIds([]);
    setWorkspaceDragActive(false);
    setFolderDropTargetId('');
  };

  return (
    <section className="files-page">
      <input className="visually-hidden" multiple onChange={(event) => uploadDirectly(event.target.files)} ref={fileInputRef} type="file" />

      <div className="file-storage-strip">
        <div className="file-storage-location"><span><Server size={17} /></span><div><strong>JDHub Cloud</strong><small>Your private file storage</small></div></div>
        <div className="file-storage-quota">
          <div><span>{storageTitle}</span><strong>{formatBytes(storage.userUsedBytes)} of {formatBytes(storage.userQuotaBytes)}</strong></div>
          <div className="file-storage-progress" aria-label={`${usagePercent}% of storage used`}><span style={{ width: `${usagePercent}%` }} /></div>
        </div>
        <div className="file-storage-facts">
          <span><File size={14} /><strong>{summary.file.count}</strong> files</span>
          <span><ShieldCheck size={14} />Protected uploads</span>
        </div>
      </div>

      <div className={`file-workspace-shell ${sidebarExpanded ? 'has-expanded-sidebar' : ''}`}>
      <div
        className={`panel file-browser files-primary-browser ${workspaceDragActive ? 'is-dragging-files' : ''}`}
        onContextMenu={openContextMenu}
        onDragEnter={handleWorkspaceDrag}
        onDragLeave={leaveWorkspaceDrag}
        onDragOver={handleWorkspaceDrag}
        onDrop={acceptDroppedFile}
      >
        {workspaceDragActive && (
          <div className="file-workspace-drop-hint" role="status">
            <span>{draggingItemIds.length ? <Folder size={24} /> : <Upload size={24} />}</span>
            <strong>
              {draggingItemIds.length
                ? folderDropTargetId
                  ? `Move ${draggingItemIds.length} ${draggingItemIds.length === 1 ? 'item' : 'items'} to ${items.find((item) => item._id === folderDropTargetId)?.name || 'folder'}`
                  : 'Drag over a folder to move selected items'
                : folderDropTargetId
                  ? `Upload to ${items.find((item) => item._id === folderDropTargetId)?.name || 'folder'}`
                  : 'Upload to this folder'}
            </strong>
            <small>
              {draggingItemIds.length
                ? folderDropTargetId ? 'Release to move the selected items' : 'Choose a destination folder'
                : `Release to add ${folderDropTargetId ? 'the files inside this folder' : 'the files here'}`}
            </small>
          </div>
        )}
        {uploadProgress && (
          <div className="file-upload-progress" role="status" aria-live="polite">
            <div className="file-upload-progress-copy">
              <span><Upload size={17} /></span>
              <div>
                <strong>{uploadProgress.total > 1 ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}` : 'Uploading file'}</strong>
                <small title={uploadProgress.fileName}>{uploadProgress.fileName}{uploadProgress.targetName ? ` · ${uploadProgress.targetName}` : ''}</small>
              </div>
              <b>{uploadProgress.percent}%</b>
            </div>
            <div className="file-upload-progress-track" aria-label={`${uploadProgress.percent}% uploaded`}>
              <span style={{ width: `${uploadProgress.percent}%` }} />
            </div>
          </div>
        )}
        <nav className="file-library-tabs" aria-label="File library views">
          <button className={libraryView === 'files' ? 'is-active' : ''} onClick={() => changeLibraryView('files')} type="button"><FolderOpen size={16} /><span>My files</span></button>
          <button className={libraryView === 'recent' ? 'is-active' : ''} onClick={() => changeLibraryView('recent')} type="button"><Clock3 size={16} /><span>Recent</span></button>
          <button className={libraryView === 'project' ? 'is-active' : ''} onClick={() => changeLibraryView('project')} type="button"><FolderKanban size={16} /><span>Project files</span></button>
        </nav>
        <div className="file-browser-toolbar">
          {libraryView === 'files' ? (
            <nav className="file-breadcrumbs" aria-label="File location">
              <button onClick={() => enterFolder(null)} type="button"><FolderOpen size={16} />My files</button>
              {breadcrumbs.map((crumb) => <span key={crumb._id}><ChevronRight size={14} /><button onClick={() => enterFolder(crumb)} type="button">{crumb.name}</button></span>)}
            </nav>
          ) : (
            <div className="file-collection-heading"><strong>{libraryView === 'recent' ? 'Recent files' : 'Project files'}</strong><small>{libraryView === 'recent' ? 'Most recently updated across all folders' : 'Files connected to JDHub projects'}</small></div>
          )}
          <div className="file-browser-controls">
            <form className="file-search" onSubmit={handleSearch}><Search size={16} /><input aria-label="Search files" onChange={(event) => setQuery(event.target.value)} placeholder="Search all files..." value={query} />{activeSearch && <button aria-label="Clear search" onClick={clearSearch} type="button"><X size={14} /></button>}</form>
            <div className="file-view-toggle" aria-label="File layout"><button className={displayMode === 'grid' ? 'is-active' : ''} onClick={() => setDisplayMode('grid')} title="Grid view" type="button"><Grid2X2 size={16} /></button><button className={displayMode === 'list' ? 'is-active' : ''} onClick={() => setDisplayMode('list')} title="List view" type="button"><LayoutList size={16} /></button></div>
          </div>
        </div>

        {activeSearch && <div className="file-search-context">Search results for <strong>“{activeSearch}”</strong><button className="text-button" onClick={clearSearch} type="button">Return to folder</button></div>}

        {loading ? (
          <div className="file-empty-state"><Cloud size={30} /><p>Loading files from {storage.label}...</p></div>
        ) : items.length === 0 && !inlineFolder ? (
          <div className="file-empty-state file-empty-workspace">
            <span><Cloud size={28} /></span>
            <h3>{activeSearch ? 'No matching files' : 'Your cloud workspace is ready'}</h3>
            <p>{activeSearch ? 'Try a different search term.' : 'Upload documents or create a folder to start organizing your files.'}</p>
            {!activeSearch && <div className="file-empty-actions"><button className="primary-button" onClick={openUpload} type="button"><Upload size={15} />Upload files</button><button className="secondary-button" onClick={openFolder} type="button"><Plus size={15} />New folder</button></div>}
          </div>
        ) : (
          <div className={`file-items ${displayMode}`}>
            {inlineFolder && (
              <article aria-selected="true" className="file-item folder is-selected is-inline-folder">
                <div className="file-item-open">
                  <span className="file-item-icon"><Folder size={22} /></span>
                  <span className="file-item-copy">
                    <input
                      aria-label="New folder name"
                      autoFocus
                      disabled={saving}
                      onBlur={commitInlineFolder}
                      onChange={(event) => setInlineFolder((current) => ({ ...current, name: event.target.value }))}
                      onFocus={(event) => event.currentTarget.select()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitInlineFolder();
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setInlineFolder(null);
                          selectOnly('');
                        }
                      }}
                      ref={inlineFolderInputRef}
                      value={inlineFolder.name}
                    />
                  </span>
                </div>
              </article>
            )}
            {items.map((item) => (
              <article
                aria-selected={selectedItemIds.includes(item._id)}
                className={`file-item ${item.kind} ${selectedItemIds.includes(item._id) ? 'is-selected' : ''} ${draggingItemIds.includes(item._id) ? 'is-dragging' : ''} ${folderDropTargetId === item._id ? 'is-drop-target' : ''}`}
                draggable={editingItem?._id !== item._id && !saving}
                key={item._id}
                onClick={(event) => selectItem(event, item)}
                onContextMenu={(event) => openContextMenu(event, item)}
                onDragEnd={finishItemDrag}
                onDragEnter={item.kind === 'folder' ? (event) => handleFolderDrag(event, item) : undefined}
                onDragLeave={item.kind === 'folder' ? (event) => leaveFolderDrag(event, item) : undefined}
                onDragOver={item.kind === 'folder' ? (event) => handleFolderDrag(event, item) : undefined}
                onDragStart={(event) => startItemDrag(event, item)}
                onDrop={item.kind === 'folder' ? (event) => acceptDroppedFile(event, item) : undefined}
              >
                {editingItem?._id === item._id ? (
                  <div className="file-item-open is-inline-rename" onClick={(event) => event.stopPropagation()}>
                    <span className="file-item-icon"><FileTypeIcon item={item} /></span>
                    <span className="file-item-copy">
                      <input
                        aria-label={`Rename ${item.name}`}
                        autoFocus
                        disabled={saving}
                        onBlur={handleItemUpdate}
                        onChange={(event) => setEditForm({ name: event.target.value })}
                        onFocus={(event) => event.currentTarget.select()}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') { event.preventDefault(); handleItemUpdate(); }
                          if (event.key === 'Escape') { event.preventDefault(); setEditingItem(null); setEditForm({ name: '' }); }
                        }}
                        value={editForm.name}
                      />
                      <small>{item.kind === 'folder' ? 'Folder' : `${formatBytes(item.size)} · ${formatLocalDate(item.updatedAt)}`}</small>
                    </span>
                  </div>
                ) : (
                  <button aria-label={item.name} className="file-item-open" data-file-name={item.name} onClick={(event) => { event.stopPropagation(); selectItem(event, item); }} onDoubleClick={(event) => { event.stopPropagation(); openItem(item); }} onKeyDown={(event) => { if (event.key === 'Enter') openItem(item); }} type="button">
                    <span className="file-item-icon"><FileTypeIcon item={item} /></span>
                    <span className="file-item-copy"><strong>{item.name}</strong><small>{item.kind === 'folder' ? 'Folder' : `${formatBytes(item.size)} · ${formatLocalDate(item.updatedAt)}`}</small></span>
                  </button>
                )}
                {(item.related_project_id?.name || item.security_status === 'review' || item.description) && (
                  <div className="file-item-details">
                    {item.related_project_id?.name && <span><Link2 size={12} />{item.related_project_id.name}</span>}
                    {item.security_status === 'review' && <span className="file-security-status needs-review"><TriangleAlert size={12} />Review recommended</span>}
                    {item.description && <p>{item.description}</p>}
                  </div>
                )}
                {item.kind === 'file' && <button className="icon-button file-download-button" disabled={downloadingId === item._id} onClick={(event) => { event.stopPropagation(); handleDownload(item); }} title={`Download ${item.name}`} type="button"><Download size={16} /></button>}
              </article>
            ))}
          </div>
        )}
      </div>
        <aside className={`file-side-rail ${sidebarExpanded ? 'is-expanded' : ''}`} aria-label="File actions">
          <button className="file-rail-toggle" onClick={() => setSidebarExpanded((current) => !current)} title={sidebarExpanded ? 'Collapse file actions' : 'Expand file actions'} type="button">
            {sidebarExpanded ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            {sidebarExpanded && <span>File actions</span>}
          </button>
          <button onClick={openUpload} title="Upload files to the current folder" type="button"><Upload size={18} />{sidebarExpanded && <span>Upload files</span>}</button>
          <button className={inlineFolder ? 'is-active' : ''} onClick={openFolder} title="Create folder" type="button"><Plus size={18} />{sidebarExpanded && <span>New folder</span>}</button>
          <button onClick={() => { closePanels(); setSidebarExpanded(true); }} title="Storage details" type="button"><HardDrive size={18} />{sidebarExpanded && <span>Storage details</span>}</button>

          {sidebarExpanded && (
            <div className="file-side-content">
              <div className="file-side-summary">
                <strong>{isSystemStorage ? 'Storage pool' : 'Storage'}</strong>
                <div><span>{formatBytes(storage.userUsedBytes)} used</span><span>{formatBytes(Math.max(0, storage.userQuotaBytes - storage.userUsedBytes))} available</span></div>
                <div className="file-storage-progress"><span style={{ width: `${usagePercent}%` }} /></div>
                {isSystemStorage && (
                  <small>Combined usage across all accounts. Members retain {formatBytes(storage.memberQuotaBytes)} personal allowances.</small>
                )}
                <p><ShieldCheck size={14} />Uploads are checked before being added to your files.</p>
                <small>Tip: right-click My files or any blank area for quick actions.</small>
              </div>
            </div>
          )}
        </aside>
      </div>

      {contextMenu && (
        <div className="file-context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.item ? (
            <>
              <button onClick={() => openItem(contextMenu.item)} role="menuitem" type="button">{contextMenu.item.kind === 'folder' ? <FolderOpen size={16} /> : <Download size={16} />}<span>{contextMenu.item.kind === 'folder' ? 'Open folder' : 'Download file'}</span></button>
              <button onClick={() => openShare(contextMenu.item)} role="menuitem" type="button"><Share2 size={16} /><span>Share</span></button>
              <button onClick={() => openItemEditor(contextMenu.item)} role="menuitem" type="button"><Pencil size={16} /><span>Rename</span></button>
              <button className="is-danger" onClick={() => { setDeletingItem(contextMenu.item); setContextMenu(null); }} role="menuitem" type="button"><Trash2 size={16} /><span>Delete</span></button>
            </>
          ) : (
            <>
              <button onClick={openUpload} role="menuitem" type="button"><Upload size={16} /><span>Upload files</span></button>
              <button onClick={openFolder} role="menuitem" type="button"><Plus size={16} /><span>New folder</span></button>
            </>
          )}
        </div>
      )}

      {sharingItem && (
        <div className="modal-backdrop file-share-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSharingItem(null); }}>
          <section aria-labelledby="file-share-title" aria-modal="true" className="modal-card file-share-modal" role="dialog">
            <header className="file-share-modal-header">
              <div><p className="eyebrow">Temporary access</p><h3 id="file-share-title">Share “{sharingItem.name}”</h3></div>
              <button aria-label="Close sharing" className="icon-only-button" onClick={() => setSharingItem(null)} type="button"><X size={18} /></button>
            </header>

            <div className="file-share-access-row">
              <span><Share2 size={19} /></span>
              <div><strong>Anyone with the link</strong><small>Can open and download this {sharingItem.kind}. The link expires automatically after 24 hours.</small></div>
            </div>

            {shareBusy ? <div className="file-share-status">Checking sharing status…</div> : shareData?.share ? (
              <div className="file-share-active">
                <div><Clock3 size={17} /><span>Active until <strong>{new Date(shareData.share.expiresAt).toLocaleString()}</strong></span></div>
                {shareData.url ? <label>Share link<div className="file-share-link"><input readOnly value={shareData.url} /><button className="secondary-button" onClick={handleCopyShare} type="button"><Copy size={15} />{shareCopied ? 'Copied' : 'Copy link'}</button></div></label> : <p>This item already has an active link. Create a new link to replace it if you need to copy it again.</p>}
              </div>
            ) : <div className="file-share-status">This item is currently restricted to you.</div>}

            <footer className="file-share-modal-actions">
              {shareData?.share && <button className="danger-button" disabled={shareBusy} onClick={handleRevokeShare} type="button">Revoke now</button>}
              <button className="secondary-button" onClick={() => setSharingItem(null)} type="button">Done</button>
              {!shareData?.share && <button className="primary-button" disabled={shareBusy} onClick={handleCreateShare} type="button">Create 24-hour link</button>}
              {shareData?.share && !shareData.url && <button className="primary-button" disabled={shareBusy} onClick={handleCreateShare} type="button">Replace link</button>}
            </footer>
          </section>
        </div>
      )}

      {deletingItem && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeletingItem(null); }}>
          <section aria-labelledby="delete-file-title" aria-modal="true" className="modal-card file-delete-modal" role="dialog">
            <div className="file-delete-icon"><Trash2 size={22} /></div>
            <div><h3 id="delete-file-title">Delete “{deletingItem.name}”?</h3><p>{deletingItem.kind === 'folder' ? 'This permanently removes the folder and everything inside it.' : 'This permanently removes the file.'} Any active share link will also stop working.</p></div>
            <footer><button className="secondary-button" onClick={() => setDeletingItem(null)} type="button">Cancel</button><button className="danger-button" disabled={saving} onClick={handleDeleteItem} type="button">{saving ? 'Deleting…' : 'Delete permanently'}</button></footer>
          </section>
        </div>
      )}

      {(error || status) && (
        <div
          aria-live="polite"
          className={`file-toast ${error ? 'is-error' : 'is-success'}`}
          onMouseEnter={pauseNotice}
          onMouseLeave={resumeNotice}
          role="status"
        >
          {error ? <TriangleAlert size={17} /> : <ShieldCheck size={17} />}
          <span>{error || status}</span>
          <button aria-label="Dismiss notification" onClick={() => { setError(null); setStatus(null); }} type="button"><X size={15} /></button>
        </div>
      )}
    </section>
  );
}
