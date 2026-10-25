// Verwaltung einer Typen-Liste: hinzufügen, umbenennen, löschen.
import { createEntry, sortEntries } from '../data/collection';
import type { CollectionDef } from '../data/model';
import { patchEntry, saveEntry, useCollection } from '../data/store';
import { useDialog } from '../ui/Dialog';
import { useEntryActions } from './useEntryActions';

export function TypeManager({ def, hint }: { def: CollectionDef; hint: string }) {
  const col = useCollection(def.key);
  const dialog = useDialog();
  const actions = useEntryActions(def);

  async function add() {
    const name = await dialog.prompt({ title: 'Neuer Typ', confirmLabel: 'Anlegen' });
    if (name) saveEntry(def.key, { ...createEntry(def, null), title: name });
  }

  async function rename(id: string, current: string) {
    const name = await dialog.prompt({ title: 'Typ umbenennen', initial: current, confirmLabel: 'Speichern' });
    if (name) patchEntry(def.key, id, { title: name });
  }

  return (
    <section className="card fields">
      <h2>{def.label}</h2>
      <p className="muted small">{hint}</p>
      {col.entries.length === 0 && <p className="muted small">Noch keine Typen.</p>}
      <ul className="type-list">
        {sortEntries(col.entries).map((t) => (
          <li key={t.id}>
            <span>{t.title}</span>
            <button className="link-btn" onClick={() => rename(t.id, t.title)}>Umbenennen</button>
            <button className="link-btn danger" onClick={() => actions.remove(t)}>Löschen</button>
          </li>
        ))}
      </ul>
      <button className="btn" onClick={add}>+ Typ</button>
    </section>
  );
}
