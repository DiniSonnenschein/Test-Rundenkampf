// Level-Einstellungen: Größe, Grundboden, Farben, Vorschau und Prüfung. Die Map selbst wird im Map-Editor bearbeitet.
import { newId, sortEntries } from '../../data/collection';
import type { Entry } from '../../data/model';
import { getCollection } from '../../data/store';
import { normalizeGame, type TeamMember } from '../../engine/game';
import { createRun } from '../../engine/run';
import { createSave } from '../../game/saves';
import { buildDefs } from '../../game/snapshot';
import { useDialog } from '../../ui/Dialog';
import { MemberCard } from './GameEditor';
import { MAX_LEVEL_SIZE, normalizeLevel, resize, validateLevel, type LevelColors, type LevelFields } from '../../engine/level';
import { navigate, routes } from '../../router';
import { ColorField } from '../../ui/ColorField';
import { RefSelect, Stepper } from '../../ui/fields';
import { MapView } from '../level/MapView';
import { useLookups } from '../level/useTemplates';
import type { EditorProps } from './index';

export function LevelEditor({ entry, set }: EditorProps) {
  const l = normalizeLevel(entry);
  const lookups = useLookups();
  const update = (next: LevelFields) => set(next as unknown as Partial<Entry>);
  const setColors = (patch: Partial<LevelColors>) => update({ ...l, colors: { ...l.colors, ...patch } });
  // „Bedingt begehbar“ zählt hier als begehbar.
  const warnings = validateLevel(l, lookups.tpl, (id) => lookups.terrain(id)?.walkable !== 'nein');

  return (
    <>
      <section className="card fields">
        <h2>Map</h2>
        <button className="map-preview" onClick={() => navigate(routes.map(entry.id))} aria-label="Map bearbeiten">
          <MapView level={l} lookups={lookups} />
        </button>
        <button className="btn btn-primary" onClick={() => navigate(routes.map(entry.id))}>Map bearbeiten</button>
      </section>

      <TestSection entry={entry} set={set} />

      <section className="card fields">
        <h2>Prüfung</h2>
        <ul className="warnings">
          {warnings.map((w) => (
            <li key={w} className={w.includes('reicht für') ? 'muted' : 'warn'}>{w}</li>
          ))}
        </ul>
      </section>

      <section className="card fields">
        <h2>Größe & Grundboden</h2>
        <label className="field-label">Breite</label>
        <Stepper value={l.width} min={1} max={MAX_LEVEL_SIZE} onChange={(w) => update(resize(l, w, l.height))} />
        <label className="field-label">Höhe</label>
        <Stepper value={l.height} min={1} max={MAX_LEVEL_SIZE} onChange={(h) => update(resize(l, l.width, h))} />
        <p className="muted small">Beim Verkleinern fällt weg, was außerhalb liegt.</p>
        <label className="field-label" htmlFor="base">Grundboden</label>
        <RefSelect id="base" collection="gelaende" value={l.baseTerrainId} emptyLabel="– Geländeart wählen –" onChange={(baseTerrainId) => update({ ...l, baseTerrainId })} />
      </section>

      <section className="card fields">
        <h2>Farben</h2>
        <p className="muted small">Hell und dunkel ordnet der Editor selbst zu. Andere Geländearten behalten ihre eigenen Farben.</p>
        <ColorField label="Standardfelder 1" value={l.colors.standard[0]} onChange={(c) => setColors({ standard: [c, l.colors.standard[1]] })} />
        <ColorField label="Standardfelder 2" value={l.colors.standard[1]} onChange={(c) => setColors({ standard: [l.colors.standard[0], c] })} />
        <ColorField label="Laternen-Startfeld" value={l.colors.lantern} onChange={(lantern) => setColors({ lantern })} />
        <ColorField label="Siegfelder 1" value={l.colors.victory[0]} onChange={(c) => setColors({ victory: [c, l.colors.victory[1]] })} />
        <ColorField label="Siegfelder 2" value={l.colors.victory[1]} onChange={(c) => setColors({ victory: [l.colors.victory[0], c] })} />
        <ColorField label="Hintergrund / kein Feld" value={l.colors.background} onChange={(background) => setColors({ background })} />
      </section>
    </>
  );
}

/** Test-Team dieses Levels (fest eingestellt) und „Level testen“. */
interface LevelTest {
  team: TeamMember[];
  lanternMemberId: string | null;
  regelwerkId: string | null;
}

function TestSection({ entry, set }: EditorProps) {
  const dialog = useDialog();
  const raw = (entry.test ?? {}) as Partial<LevelTest>;
  const t: LevelTest = { team: raw.team ?? [], lanternMemberId: raw.lanternMemberId ?? null, regelwerkId: raw.regelwerkId ?? null };
  const update = (patch: Partial<LevelTest>) => set({ test: { ...t, ...patch } } as Partial<Entry>);
  const allyExists = (id: string | null) => getCollection('allys').entries.some((a) => a.id === id);
  const team = t.team.filter((m) => allyExists(m.allyId));
  const lantern = team.some((m) => m.id === t.lanternMemberId) ? t.lanternMemberId : team[0]?.id ?? null;

  async function addMember() {
    const items = sortEntries(getCollection('allys').entries).map((a) => ({ label: a.title, value: a.id }));
    if (!items.length) return dialog.confirm({ title: 'Keine Allys', message: 'Lege zuerst Allys an.', confirmLabel: 'OK' });
    const allyId = await dialog.menu({ title: 'Ally hinzufügen', items });
    if (!allyId) return;
    const m: TeamMember = { id: newId('mitglied'), allyId, items: null, resources: {} };
    update({ team: [...t.team, m], lanternMemberId: t.lanternMemberId ?? m.id });
  }

  function move(i: number, dir: -1 | 1) {
    const next = [...t.team];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    update({ team: next });
  }

  function start() {
    const game = normalizeGame({ regelwerkId: t.regelwerkId, content: { kind: 'level', levelId: entry.id }, team, lanternMemberId: lantern });
    const run = createRun(game, buildDefs(game));
    const save = createSave(`Test: ${entry.title}`, run, { levelId: entry.id });
    navigate(routes.game(save.id));
  }

  return (
    <section className="card fields">
      <h2>Level testen</h2>
      <p className="muted small">Festes Test-Team für dieses Level. Beim Test wird ein Spielstand „Test: Name – Datum“ angelegt.</p>
      {t.team.map((m, i) => (
        <MemberCard
          key={m.id}
          m={m}
          index={i}
          count={t.team.length}
          isLantern={lantern === m.id}
          set={(n) => update({ team: t.team.map((x) => (x.id === m.id ? n : x)) })}
          onLantern={() => update({ lanternMemberId: m.id })}
          onMove={(dir) => move(i, dir)}
          onRemove={() => update({ team: t.team.filter((x) => x.id !== m.id), lanternMemberId: t.lanternMemberId === m.id ? null : t.lanternMemberId })}
        />
      ))}
      <button className="btn btn-small" onClick={addMember}>+ Ally</button>
      <label className="field-label" htmlFor="test-rules">Regelwerk</label>
      <RefSelect id="test-rules" collection="regelwerke" value={t.regelwerkId} emptyLabel="Standard-Regeln" onChange={(regelwerkId) => update({ regelwerkId })} />
      <button className="btn btn-primary" disabled={!team.length} onClick={start}>Level testen</button>
      {!team.length && <p className="muted small">Füge mindestens einen Ally hinzu.</p>}
    </section>
  );
}
