// Gemeinsame Aktionen für Einträge: duplizieren, verschieben, löschen.
import { duplicateEntry, folderPath, sortFolders } from '../data/collection';
import { getDef, type CollectionDef, type Entry } from '../data/model';
import { findUsages } from '../data/references';
import { allCollections, deleteEntry, getCollection, patchEntry, saveEntry } from '../data/store';
import { useDialog } from '../ui/Dialog';

export function useEntryActions(def: CollectionDef) {
  const dialog = useDialog();

  function duplicate(entry: Entry): Entry {
    const copy = duplicateEntry(entry, def.key);
    saveEntry(def.key, copy);
    return copy;
  }

  async function remove(entry: Entry): Promise<boolean> {
    if (entry.fixed) return false;
    const usages = findUsages(allCollections(), entry.id);
    const ok = await dialog.confirm({
      title: `„${entry.title || 'Ohne Titel'}“ löschen?`,
      message: usages.length ? (
        <>
          <p>Wird noch verwendet in:</p>
          <ul>
            {usages.map((u) => (
              <li key={u.entry.id}>
                {getDef(u.key)?.singular ?? u.key} „{u.entry.title}“
              </li>
            ))}
          </ul>
          <p className="muted">Die Verweise werden dort entfernt.</p>
        </>
      ) : undefined,
      confirmLabel: 'Löschen',
      danger: true,
    });
    if (ok) deleteEntry(def.key, entry.id);
    return ok;
  }

  async function move(entry: Entry) {
    const folders = getCollection(def.key).folders;
    const items = [
      { label: '📂 Hauptebene', value: '' },
      ...sortFolders(folders)
        .map((f) => ({ label: '📁 ' + folderPath(folders, f.id).map((p) => p.name).join(' / '), value: f.id }))
        .sort((a, b) => a.label.localeCompare(b.label, 'de')),
    ];
    const target = await dialog.menu({ title: 'Verschieben nach …', items });
    if (target !== null) patchEntry(def.key, entry.id, { folderId: target || null });
  }

  return { duplicate, remove, move };
}
