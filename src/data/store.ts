// Zentraler Speicher im Arbeitsspeicher. Jede Änderung wird sofort auf dem Gerät gesichert.
import { useSyncExternalStore } from 'react';
import { storage } from './localStore';
import { ALL_DEFS, getDef, type Collection, type Entry } from './model';
import { removeUsages } from './references';

const cache = new Map<string, Collection>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCollection(key: string): Collection {
  let col = cache.get(key);
  if (!col) {
    const loaded = storage.load<Partial<Collection>>(key, {});
    col = { entries: loaded.entries ?? [], folders: loaded.folders ?? [] };
    const missing = (getDef(key)?.fixedEntries?.() ?? []).filter((f) => !col!.entries.some((e) => e.id === f.id));
    if (missing.length) {
      col = { ...col, entries: [...missing, ...col.entries] };
      storage.save(key, col);
    }
    cache.set(key, col);
  }
  return col;
}

export function setCollection(key: string, col: Collection) {
  cache.set(key, col);
  storage.save(key, col);
  emit();
}

export function updateCollection(key: string, fn: (col: Collection) => Collection) {
  setCollection(key, fn(getCollection(key)));
}

/** Alle Sammlungen, in denen Verweise gepflegt werden. Spielstände sind eingefrorene Momentaufnahmen und bleiben unberührt. */
export function allCollections(): Record<string, Collection> {
  return Object.fromEntries(ALL_DEFS.filter((d) => d.key !== 'spielstaende').map((d) => [d.key, getCollection(d.key)]));
}

export function useCollection(key: string): Collection {
  return useSyncExternalStore(subscribe, () => getCollection(key));
}

/** Neu zeichnen bei jeder Änderung irgendeiner Sammlung. */
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribe, () => version);
}

/** Nach Import oder Löschen aller Daten neu vom Gerät lesen. */
export function reloadAll() {
  cache.clear();
  emit();
}

export function clearAllData() {
  storage.clearAll();
  reloadAll();
}

export function saveEntry(key: string, entry: Entry) {
  updateCollection(key, (col) => ({
    ...col,
    entries: col.entries.some((e) => e.id === entry.id)
      ? col.entries.map((e) => (e.id === entry.id ? entry : e))
      : [...col.entries, entry],
  }));
}

/** Ändert Felder eines Eintrags und setzt das Änderungsdatum. */
export function patchEntry(key: string, id: string, patch: Partial<Entry>) {
  updateCollection(key, (col) => ({
    ...col,
    entries: col.entries.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e)),
  }));
}

/** Löscht einen Eintrag und entfernt alle Verweise darauf. */
export function deleteEntry(key: string, id: string) {
  if (getCollection(key).entries.find((e) => e.id === id)?.fixed) return;
  for (const [k, col] of Object.entries(removeUsages(allCollections(), id))) setCollection(k, col);
  updateCollection(key, (col) => ({ ...col, entries: col.entries.filter((e) => e.id !== id) }));
}
