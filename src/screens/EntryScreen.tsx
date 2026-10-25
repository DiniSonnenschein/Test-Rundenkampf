// Bearbeiten eines Eintrags. Jede Änderung wird sofort gespeichert.
import { useEffect, useRef } from 'react';
import { folderPath, sortFolders } from '../data/collection';
import { DEFAULT_LOOK, SPIELSTAENDE, type CollectionDef, type Entry } from '../data/model';
import { patchEntry, useCollection } from '../data/store';
import { navigate, routes } from '../router';
import { ColorWheel } from '../ui/ColorWheel';
import { useDialog } from '../ui/Dialog';
import { formatDate } from '../ui/format';
import { Header } from '../ui/Header';
import { ShapeIcon, ShapePicker } from '../ui/shapes';
import { EDITORS } from './editors';
import { useEntryActions } from './useEntryActions';
import { Stepper } from '../ui/fields';
import { tileSize } from '../engine/characters';

export function EntryScreen({ def, id }: { def: CollectionDef; id: string }) {
  const col = useCollection(def.key);
  const entry = col.entries.find((e) => e.id === id);
  const dialog = useDialog();
  const actions = useEntryActions(def);
  const titleInput = useRef<HTMLInputElement>(null);

  // Neu angelegte Einträge: Titel direkt zum Überschreiben markieren.
  useEffect(() => {
    if (entry && entry.title === def.newTitle && entry.createdAt === entry.updatedAt) {
      titleInput.current?.focus();
      titleInput.current?.select();
    }
  }, [id]);

  if (!entry) {
    return (
      <main className="screen">
        <Header title={def.singular} back={routes.list(def.key)} />
        <p className="muted empty">Dieser Eintrag existiert nicht (mehr).</p>
      </main>
    );
  }

  const set = (patch: Partial<Entry>) => patchEntry(def.key, entry.id, patch);
  const Editor = EDITORS[def.key];
  const back = routes.list(def.key, entry.folderId);

  async function menu() {
    const action = await dialog.menu({
      items: [
        { label: 'Duplizieren', value: 'dup' },
        ...(entry!.fixed ? [] : [{ label: 'Löschen', value: 'delete', danger: true }]),
      ],
    });
    if (action === 'dup') navigate(routes.entry(def.key, actions.duplicate(entry!).id), true);
    else if (action === 'delete' && (await actions.remove(entry!))) navigate(back, true);
  }

  const folders = sortFolders(col.folders)
    .map((f) => ({ id: f.id, label: folderPath(col.folders, f.id).map((p) => p.name).join(' / ') }))
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));

  return (
    <main className="screen">
      <Header
        title={def.singular}
        back={back}
        actions={<button className="icon-btn" aria-label="Menü" onClick={menu}>⋮</button>}
      />

      <section className="card fields">
        <label className="field-label" htmlFor="title">Titel</label>
        <input id="title" ref={titleInput} className="input" value={entry.title} onChange={(e) => set({ title: e.target.value })} />

        <label className="field-label" htmlFor="note">Notiz</label>
        <textarea id="note" className="input textarea" rows={3} value={entry.note} onChange={(e) => set({ note: e.target.value })} />

        <label className="field-label" htmlFor="folder">Ordner</label>
        <select id="folder" className="input" value={entry.folderId ?? ''} onChange={(e) => set({ folderId: e.target.value || null })}>
          <option value="">Hauptebene</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </section>

      {def.visible && <LookFields entry={entry} set={set} />}

      {Editor ? (
        <Editor entry={entry} set={set} />
      ) : (
        <section className="card placeholder muted">
          {def.key === SPIELSTAENDE.key
            ? 'Spielstand-Details folgen in Abschnitt 14.'
            : `Weitere Felder für ${def.label} folgen in Abschnitt ${def.section}.`}
        </section>
      )}

      <p className="muted saved-hint">Automatisch gespeichert · zuletzt geändert {formatDate(entry.updatedAt)}</p>
    </main>
  );
}

function LookFields({ entry, set }: { entry: Entry; set: (patch: Partial<Entry>) => void }) {
  const shape = typeof entry.shape === 'string' ? entry.shape : DEFAULT_LOOK.shape;
  const color = typeof entry.color === 'string' ? entry.color : DEFAULT_LOOK.color;
  const size = tileSize(entry.size ?? DEFAULT_LOOK.size);

  return (
    <section className="card fields">
      <h2>Darstellung im Spiel</h2>
      <div className="look-preview">
        <ShapeIcon shape={shape} color={color} size={Math.min(140, 40 + 25 * size)} />
      </div>

      <span className="field-label">Form</span>
      <ShapePicker value={shape} color={color} onChange={(key) => set({ shape: key })} />

      <span className="field-label">Farbe</span>
      <ColorWheel value={color} onChange={(c) => set({ color: c })} />

      <label className="field-label" htmlFor="size">Größe</label>
      <Stepper id="size" value={size} min={1} max={5} onChange={(v) => set({ size: v })} />
      <p className="muted small">Größe 2 belegt 2×2 Felder (die Kollision wächst mit).</p>
    </section>
  );
}
