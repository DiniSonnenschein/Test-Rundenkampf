// Einträge verweisen über ihre ID aufeinander (z. B. ein Ally auf seine Fähigkeiten).
// IDs sind eindeutig, daher genügt es, alle Felder nach der ID zu durchsuchen.
import type { Collection, Entry } from './model';

export function containsRef(value: unknown, id: string): boolean {
  if (value === id) return true;
  if (Array.isArray(value)) return value.some((v) => containsRef(v, id));
  if (value && typeof value === 'object') return Object.values(value).some((v) => containsRef(v, id));
  return false;
}

/** Entfernt den Verweis: aus Listen wird er gelöscht, sonst durch null ersetzt. */
export function removeRef<T>(value: T, id: string): T {
  if (Array.isArray(value)) return value.filter((v) => v !== id).map((v) => removeRef(v, id)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, v === id ? null : removeRef(v, id)]),
    ) as T;
  }
  return value;
}

function entryFields(entry: Entry): unknown[] {
  return Object.entries(entry)
    .filter(([k]) => k !== 'id')
    .map(([, v]) => v);
}

export interface Usage {
  key: string;
  entry: Entry;
}

export function findUsages(collections: Record<string, Collection>, id: string): Usage[] {
  const usages: Usage[] = [];
  for (const [key, col] of Object.entries(collections)) {
    for (const entry of col.entries) {
      if (entry.id !== id && containsRef(entryFields(entry), id)) usages.push({ key, entry });
    }
  }
  return usages;
}

/** Liefert nur die Sammlungen, in denen sich etwas geändert hat. */
export function removeUsages(collections: Record<string, Collection>, id: string): Record<string, Collection> {
  const changed: Record<string, Collection> = {};
  for (const [key, col] of Object.entries(collections)) {
    if (!col.entries.some((e) => e.id !== id && containsRef(entryFields(e), id))) continue;
    changed[key] = {
      ...col,
      entries: col.entries.map((e) => {
        if (e.id === id || !containsRef(entryFields(e), id)) return e;
        const { id: ownId, ...rest } = e;
        return { ...removeRef(rest, id), id: ownId } as Entry;
      }),
    };
  }
  return changed;
}
