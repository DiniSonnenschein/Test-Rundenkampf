// Einheitliche Liste für alle Bausteine, Spiele und Spielstände: Ordner, Suche, Anlegen, Duplizieren, Löschen.
import { useState } from 'react';
import {
  countInFolder, createEntry, deleteFolder, folderPath, newId, searchEntries, sortEntries, sortFolders,
} from '../data/collection';
import type { CollectionDef, Entry, Folder } from '../data/model';
import { saveEntry, updateCollection, useCollection } from '../data/store';
import { navigate, routes } from '../router';
import { useDialog } from '../ui/Dialog';
import { formatDate } from '../ui/format';
import { Header } from '../ui/Header';
import { ShapeIcon } from '../ui/shapes';
import { useEntryActions } from './useEntryActions';

export function ListScreen({ def, folderId }: { def: CollectionDef; folderId: string | null }) {
  const col = useCollection(def.key);
  const dialog = useDialog();
  const actions = useEntryActions(def);
  const [query, setQuery] = useState('');

  const folder = col.folders.find((f) => f.id === folderId) ?? null;
  const path = folderPath(col.folders, folder?.id ?? null);
  const isGame = def.key === 'spiele' || def.key === 'spielstaende';
  const back = folder ? routes.list(def.key, folder.parentId) : isGame ? routes.start() : routes.create();
  const searching = query.trim() !== '';

  const folders = sortFolders(col.folders.filter((f) => f.parentId === (folder?.id ?? null)));
  const entries = searching ? searchEntries(col.entries, query) : sortEntries(col.entries.filter((e) => e.folderId === (folder?.id ?? null)));

  function newEntry() {
    const entry = createEntry(def, folder?.id ?? null);
    saveEntry(def.key, entry);
    navigate(routes.entry(def.key, entry.id));
  }

  async function newFolder() {
    const name = await dialog.prompt({ title: 'Neuer Ordner', initial: 'Neuer Ordner', confirmLabel: 'Anlegen' });
    if (!name) return;
    const f: Folder = { id: newId('ordner'), name, parentId: folder?.id ?? null, updatedAt: new Date().toISOString() };
    updateCollection(def.key, (c) => ({ ...c, folders: [...c.folders, f] }));
  }

  async function folderMenu(f: Folder) {
    const action = await dialog.menu({
      title: f.name,
      items: [
        { label: 'Umbenennen', value: 'rename' },
        { label: 'Löschen', value: 'delete', danger: true },
      ],
    });
    if (action === 'rename') {
      const name = await dialog.prompt({ title: 'Ordner umbenennen', initial: f.name, confirmLabel: 'Speichern' });
      if (name) {
        updateCollection(def.key, (c) => ({
          ...c,
          folders: c.folders.map((x) => (x.id === f.id ? { ...x, name, updatedAt: new Date().toISOString() } : x)),
        }));
      }
    } else if (action === 'delete') {
      const ok = await dialog.confirm({
        title: `Ordner „${f.name}“ löschen?`,
        message: 'Der Inhalt bleibt erhalten und wandert eine Ebene nach oben.',
        confirmLabel: 'Löschen',
        danger: true,
      });
      if (ok) updateCollection(def.key, (c) => deleteFolder(c, f.id));
    }
  }

  async function entryMenu(e: Entry) {
    const action = await dialog.menu({
      title: e.title || 'Ohne Titel',
      items: [
        { label: 'Duplizieren', value: 'dup' },
        { label: 'Verschieben …', value: 'move' },
        ...(e.fixed ? [] : [{ label: 'Löschen', value: 'delete', danger: true }]),
      ],
    });
    if (action === 'dup') actions.duplicate(e);
    else if (action === 'move') actions.move(e);
    else if (action === 'delete') actions.remove(e);
  }

  return (
    <main className="screen screen-with-bar">
      <Header title={folder ? folder.name : def.label} back={back} />

      {path.length > 0 && (
        <nav className="breadcrumb muted">
          <button onClick={() => navigate(routes.list(def.key), true)}>{def.label}</button>
          {path.map((p) => (
            <span key={p.id}>
              {' / '}
              <button onClick={() => navigate(routes.list(def.key, p.id), true)}>{p.name}</button>
            </span>
          ))}
        </nav>
      )}

      <input
        className="input"
        type="search"
        placeholder="Durchsuchen …"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <ul className="list">
        {!searching &&
          folders.map((f) => (
            <li key={f.id} className="row">
              <button className="row-main" onClick={() => navigate(routes.list(def.key, f.id))}>
                <span className="row-icon">📁</span>
                <span className="row-text">
                  <span className="row-title">{f.name}</span>
                  <span className="row-sub muted">{countInFolder(col, f.id) === 1 ? "1 Eintrag" : `${countInFolder(col, f.id)} Einträge`}</span>
                </span>
              </button>
              <button className="icon-btn" aria-label="Ordner-Menü" onClick={() => folderMenu(f)}>⋮</button>
            </li>
          ))}
        {entries.map((e) => (
          <li key={e.id} className="row">
            <button className="row-main" onClick={() => navigate(routes.entry(def.key, e.id))}>
              <span className="row-icon">
                {def.visible ? <ShapeIcon shape={String(e.shape)} color={String(e.color)} size={28} /> : def.icon}
              </span>
              <span className="row-text">
                <span className="row-title">{e.title || 'Ohne Titel'}</span>
                <span className="row-sub muted">
                  {searching && e.folderId && `📁 ${folderPath(col.folders, e.folderId).map((p) => p.name).join(' / ')} · `}
                  {def.subtitle && `${def.subtitle(e)} · `}
                  {formatDate(e.updatedAt)}
                </span>
              </span>
            </button>
            <button className="icon-btn" aria-label="Eintrag-Menü" onClick={() => entryMenu(e)}>⋮</button>
          </li>
        ))}
      </ul>

      {entries.length === 0 && (searching || folders.length === 0) && (
        <p className="muted empty">
          {searching
            ? 'Nichts gefunden.'
            : def.creatable
              ? 'Noch keine Einträge vorhanden.'
              : 'Noch keine Spielstände vorhanden. Spielstände entstehen beim Speichern im Spiel.'}
        </p>
      )}

      <div className="bottom-bar">
        <button className="btn" onClick={newFolder}>+ Ordner</button>
        {def.creatable && (
          <button className="btn btn-primary" onClick={newEntry}>+ {def.singular}</button>
        )}
      </div>
    </main>
  );
}
