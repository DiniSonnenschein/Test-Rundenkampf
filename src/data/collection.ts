import { DEFAULT_LOOK, type Collection, type CollectionDef, type Entry, type Folder } from './model';

export const emptyCollection = (): Collection => ({ entries: [], folders: [] });

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function createEntry(def: CollectionDef, folderId: string | null, now = new Date()): Entry {
  const ts = now.toISOString();
  return {
    id: newId(def.key),
    title: def.newTitle,
    note: '',
    folderId,
    createdAt: ts,
    updatedAt: ts,
    ...(def.visible ? { ...DEFAULT_LOOK } : {}),
  };
}

export function duplicateEntry(entry: Entry, prefix: string, now = new Date()): Entry {
  const ts = now.toISOString();
  return { ...structuredClone(entry), id: newId(prefix), title: `${entry.title} (Kopie)`, createdAt: ts, updatedAt: ts };
}

export function compareTitles(a: string, b: string): number {
  return a.localeCompare(b, 'de', { sensitivity: 'base', numeric: true });
}

export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => compareTitles(a.title, b.title));
}

export function sortFolders(folders: Folder[]): Folder[] {
  return [...folders].sort((a, b) => compareTitles(a.name, b.name));
}

/** Sucht in Titel und Notiz, unabhängig von Groß-/Kleinschreibung. */
export function searchEntries(entries: Entry[], query: string): Entry[] {
  const q = query.trim().toLocaleLowerCase('de');
  if (!q) return sortEntries(entries);
  return sortEntries(
    entries.filter((e) => e.title.toLocaleLowerCase('de').includes(q) || e.note.toLocaleLowerCase('de').includes(q)),
  );
}

/** Ordnerpfad von der Hauptebene bis einschließlich des Ordners. */
export function folderPath(folders: Folder[], id: string | null): Folder[] {
  const path: Folder[] = [];
  const seen = new Set<string>();
  let current = folders.find((f) => f.id === id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = folders.find((f) => f.id === current!.parentId);
  }
  return path;
}

/** Ordner und alle Unterordner. */
export function folderWithDescendants(folders: Folder[], id: string): Set<string> {
  const result = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && result.has(f.parentId) && !result.has(f.id)) {
        result.add(f.id);
        grew = true;
      }
    }
  }
  return result;
}

/** Zahl der Einträge in einem Ordner inklusive Unterordnern. */
export function countInFolder(col: Collection, id: string): number {
  const ids = folderWithDescendants(col.folders, id);
  return col.entries.filter((e) => e.folderId && ids.has(e.folderId)).length;
}

/** Löscht einen Ordner; sein Inhalt wandert eine Ebene nach oben. */
export function deleteFolder(col: Collection, id: string): Collection {
  const folder = col.folders.find((f) => f.id === id);
  if (!folder) return col;
  const parent = folder.parentId;
  return {
    folders: col.folders.filter((f) => f.id !== id).map((f) => (f.parentId === id ? { ...f, parentId: parent } : f)),
    entries: col.entries.map((e) => (e.folderId === id ? { ...e, folderId: parent } : e)),
  };
}
