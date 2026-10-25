// Auswahl mehrerer Einträge bzw. Typen als „Chips“.
import { createEntry, sortEntries } from '../data/collection';
import { getDef, type Entry } from '../data/model';
import { getCollection, saveEntry, useCollection } from '../data/store';
import type { Selection } from '../engine/effects';
import { useDialog } from './Dialog';
import { Toggle } from './fields';

function Chips({ items, onRemove }: { items: { id: string; label: string }[]; onRemove: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="chips">
      {items.map((i) => (
        <span key={i.id} className="chip">
          {i.label}
          <button aria-label={`${i.label} entfernen`} onClick={() => onRemove(i.id)}>✕</button>
        </span>
      ))}
    </div>
  );
}

/** Mehrere Einträge einer Sammlung auswählen. */
export function MultiRefPicker({
  collection, value, onChange, addLabel, filter,
}: {
  collection: string;
  value: string[];
  onChange: (ids: string[]) => void;
  addLabel: string;
  filter?: (e: Entry) => boolean;
}) {
  const col = useCollection(collection);
  const dialog = useDialog();
  const byId = new Map(col.entries.map((e) => [e.id, e]));
  const available = sortEntries(col.entries.filter((e) => !value.includes(e.id) && (!filter || filter(e))));

  async function add() {
    if (!available.length) {
      await dialog.confirm({ title: 'Nichts verfügbar', message: `Lege zuerst Einträge unter „${getDef(collection)?.label}“ an.`, confirmLabel: 'OK' });
      return;
    }
    const id = await dialog.menu({ title: addLabel, items: available.map((e) => ({ label: e.title || 'Ohne Titel', value: e.id })) });
    if (id) onChange([...value, id]);
  }

  return (
    <div className="picker">
      <Chips
        items={value.filter((id) => byId.has(id)).map((id) => ({ id, label: byId.get(id)!.title || 'Ohne Titel' }))}
        onRemove={(id) => onChange(value.filter((v) => v !== id))}
      />
      <button className="btn btn-small" onClick={add}>+ {addLabel}</button>
    </div>
  );
}

/** Typen auswählen; neue Typen lassen sich direkt anlegen. */
export function TypePicker({ list, value, onChange }: { list: string; value: string[]; onChange: (ids: string[]) => void }) {
  const col = useCollection(list);
  const dialog = useDialog();
  const byId = new Map(col.entries.map((e) => [e.id, e]));
  const NEW = '__neu__';

  async function add() {
    const items = [
      ...sortEntries(col.entries.filter((e) => !value.includes(e.id))).map((e) => ({ label: e.title, value: e.id })),
      { label: '+ Neuer Typ …', value: NEW },
    ];
    const id = await dialog.menu({ title: 'Typ hinzufügen', items });
    if (!id) return;
    if (id !== NEW) return onChange([...value, id]);
    const name = await dialog.prompt({ title: 'Neuer Typ', confirmLabel: 'Anlegen' });
    if (!name) return;
    const existing = getCollection(list).entries.find((e) => e.title.toLowerCase() === name.toLowerCase());
    if (existing) return onChange(value.includes(existing.id) ? value : [...value, existing.id]);
    const entry = { ...createEntry(getDef(list)!, null), title: name };
    saveEntry(list, entry);
    onChange([...value, entry.id]);
  }

  return (
    <div className="picker">
      <Chips
        items={value.filter((id) => byId.has(id)).map((id) => ({ id, label: byId.get(id)!.title }))}
        onRemove={(id) => onChange(value.filter((v) => v !== id))}
      />
      <button className="btn btn-small" onClick={add}>+ Typ</button>
    </div>
  );
}

/** „Alle“ oder bestimmte Einträge und/oder Typen. */
export function SelectionPicker({
  value, onChange, collection, typeList, allLabel = 'Alle',
}: {
  value: Selection;
  onChange: (s: Selection) => void;
  /** Eine oder mehrere Sammlungen, aus denen einzelne Einträge gewählt werden können. */
  collection: string | string[];
  typeList?: string;
  allLabel?: string;
}) {
  return (
    <>
      <Toggle label={allLabel} checked={value.all} onChange={(all) => onChange({ ...value, all })} />
      {!value.all && (
        <>
          {(Array.isArray(collection) ? collection : [collection]).map((c) => (
            <MultiRefPicker
              key={c}
              collection={c}
              value={value.ids}
              addLabel={getDef(c)?.singular ?? 'Eintrag'}
              onChange={(ids) => onChange({ ...value, ids })}
            />
          ))}
          {typeList && <TypePicker list={typeList} value={value.typeIds} onChange={(typeIds) => onChange({ ...value, typeIds })} />}
        </>
      )}
    </>
  );
}
