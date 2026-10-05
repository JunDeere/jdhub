import { Clock3, Cloud, Download, File, Folder, FolderOpen, MoreVertical, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { downloadPublicShareFile, downloadPublicShareFolder, getPublicShare } from '../api/files.js';

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${units[index]}`;
}

function localExpiry(value) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
  const formatted = new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(value));
  return { formatted, timezone };
}

export default function PublicShare({ shareToken }) {
  const [data, setData] = useState(null);
  const [folderHistory, setFolderHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [contextMenu, setContextMenu] = useState(null);

  const load = async (parentId = '') => {
    setLoading(true);
    setError('');
    try { setData(await getPublicShare(shareToken, parentId)); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const previousTitle = document.title;
    const favicon = document.querySelector('link[rel~="icon"]');
    const previousFavicon = favicon?.getAttribute('href');
    document.title = 'Shared files';
    if (favicon) favicon.setAttribute('href', '/share-icon.svg');

    let cancelled = false;
    getPublicShare(shareToken)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      document.title = previousTitle;
      if (favicon && previousFavicon) favicon.setAttribute('href', previousFavicon);
    };
  }, [shareToken]);

  useEffect(() => {
    const dismiss = () => setContextMenu(null);
    const dismissOnEscape = (event) => { if (event.key === 'Escape') dismiss(); };
    window.addEventListener('click', dismiss);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('keydown', dismissOnEscape);
    return () => {
      window.removeEventListener('click', dismiss);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('keydown', dismissOnEscape);
    };
  }, []);

  const openFolder = async (item) => {
    setContextMenu(null);
    setFolderHistory((current) => [...current, { _id: data.currentFolder?._id, name: data.currentFolder?.name }].filter((entry) => entry._id));
    await load(item._id);
  };

  const goBack = async () => {
    const previous = folderHistory[folderHistory.length - 1];
    setFolderHistory((current) => current.slice(0, -1));
    await load(previous?._id || '');
  };

  const downloadFile = async (item) => {
    setContextMenu(null);
    setDownloadingId(item._id);
    setError('');
    try { await downloadPublicShareFile(shareToken, item); }
    catch (err) { setError(err.message); }
    finally { setDownloadingId(''); }
  };

  const downloadFolder = (item) => {
    setContextMenu(null);
    downloadPublicShareFolder(shareToken, item);
  };

  const openContextMenu = (event, item) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ item, x: Math.min(event.clientX, window.innerWidth - 220), y: Math.min(event.clientY, window.innerHeight - 130) });
  };

  const openMoreMenu = (event, item) => {
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    setContextMenu({ item, x: Math.min(bounds.right - 200, window.innerWidth - 220), y: Math.min(bounds.bottom + 6, window.innerHeight - 130) });
  };

  const expiry = data?.expiresAt ? localExpiry(data.expiresAt) : null;

  return (
    <main className="public-share-page">
      <section className="public-share-shell">
        <header className="public-share-header">
          <div className="public-share-brand"><span><Cloud size={22} /></span><div><strong>Shared files</strong><small>Temporary access</small></div></div>
          {expiry && <div className="public-share-expiry"><Clock3 size={16} /><div><strong>Expires {expiry.formatted}</strong><small>{expiry.timezone}</small></div></div>}
        </header>

        {loading ? <div className="public-share-state"><FolderOpen size={32} /><p>Opening shared item…</p></div>
          : error ? <div className="public-share-state error"><TriangleAlert size={32} /><h1>Link unavailable</h1><p>{error}</p></div>
            : data.resource.kind === 'file' ? (
              <div className="public-share-file-card" onContextMenu={(event) => openContextMenu(event, data.resource)}>
                <span><File size={34} /></span><div><h1>{data.resource.name}</h1><p>{formatBytes(data.resource.size)}</p></div><button className="primary-button" disabled={downloadingId === data.resource._id} onClick={() => downloadFile(data.resource)} type="button"><Download size={16} />Download</button>
              </div>
            ) : (
              <>
                <div className="public-share-title">
                  <div><p className="eyebrow">Shared folder</p><h1>{data.currentFolder?.name || data.resource.name}</h1></div>
                  <div className="public-share-title-actions">{folderHistory.length > 0 && <button className="secondary-button" onClick={goBack} type="button">Back</button>}<button className="primary-button" onClick={() => downloadFolder(data.currentFolder || data.resource)} type="button"><Download size={16} />Download folder</button></div>
                </div>
                <div className="public-share-items">
                  {data.items.length === 0 ? <div className="public-share-state"><FolderOpen size={30} /><p>This folder is empty.</p></div> : data.items.map((item) => (
                    <article className="public-share-item" key={item._id} onContextMenu={(event) => openContextMenu(event, item)}>
                      <button className="public-share-item-main" onDoubleClick={() => item.kind === 'folder' ? openFolder(item) : downloadFile(item)} type="button"><span>{item.kind === 'folder' ? <Folder size={24} /> : <File size={24} />}</span><div><strong>{item.name}</strong><small>{item.kind === 'folder' ? 'Folder' : formatBytes(item.size)}</small></div></button>
                      <button aria-label={`More actions for ${item.name}`} className="icon-button" onClick={(event) => openMoreMenu(event, item)} type="button"><MoreVertical size={17} /></button>
                    </article>
                  ))}
                </div>
              </>
            )}
        <footer className="public-share-footer"><Clock3 size={15} />This temporary link stops working automatically at the expiration time shown above.</footer>
      </section>

      {contextMenu && (
        <div className="public-share-context-menu" role="menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.item.kind === 'folder' && <button onClick={() => openFolder(contextMenu.item)} role="menuitem" type="button"><FolderOpen size={16} />Open folder</button>}
          <button onClick={() => contextMenu.item.kind === 'folder' ? downloadFolder(contextMenu.item) : downloadFile(contextMenu.item)} role="menuitem" type="button"><Download size={16} />Download{contextMenu.item.kind === 'folder' ? ' folder' : ''}</button>
        </div>
      )}
    </main>
  );
}
