// Spiel-Konfiguration: Regelwerk, Inhalt (Dungeon/Level), Team mit Laternenträger und test-eigenen Anpassungen.
import { createAndOpen, NEW, newOption } from '../../ui/createNew';
import { useState } from 'react';
import { newId, sortEntries } from '../../data/collection';
import type { Entry } from '../../data/model';
import { getCollection, useCollection } from '../../data/store';
import { createRun } from '../../engine/run';
import { createSave } from '../../game/saves';
import { buildDefs } from '../../game/snapshot';
import { navigate, routes } from '../../router';
import { normalizeCharacter } from '../../engine/characters';
import { normalizeDungeon } from '../../engine/dungeon';
import { contentLevels, memberItems, memberResources, normalizeGame, validateGame, type GameContent, type GameFields, type LevelEvent, type TeamMember } from '../../engine/game';
import { normalizeLevel } from '../../engine/level';
import { normalizeResource } from '../../engine/resources';
import { useDialog } from '../../ui/Dialog';
import { Choice, RefSelect, Stepper } from '../../ui/fields';
import { ShapeIcon } from '../../ui/shapes';
import type { EditorProps } from './index';

export function MemberCard({
  m, index, count, isLantern, set, onLantern, onMove, onRemove,
}: {
  m: TeamMember;
  index: number;
  count: number;
  isLantern: boolean;
  set: (m: TeamMember) => void;
  onLantern: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const allys = useCollection('allys').entries;
  const ressourcen = useCollection('ressourcen').entries;
  const ally = allys.find((a) => a.id === m.allyId);
  const fields = ally ? normalizeCharacter(ally) : null;
  const resName = (id: string) => ressourcen.find((r) => r.id === id)?.title ?? '?';
  const items = fields ? memberItems(m, fields) : [];
  const customized = m.items !== null || Object.keys(m.resources).length > 0;

  return (
    <div className="sub-card">
      <div className="member-head">
        {ally && <ShapeIcon shape={String(ally.shape)} color={String(ally.color)} size={30} />}
        <strong className="member-name">{ally?.title ?? '(gelöscht)'}</strong>
        {index > 0 && <button className="icon-btn" aria-label="Nach oben" onClick={() => onMove(-1)}>↑</button>}
        {index < count - 1 && <button className="icon-btn" aria-label="Nach unten" onClick={() => onMove(1)}>↓</button>}
        <button className="icon-btn" aria-label="Entfernen" onClick={onRemove}>✕</button>
      </div>
      <div className="btn-row">
        <button className={`btn btn-small ${isLantern ? 'btn-primary' : ''}`} onClick={onLantern}>
          {isLantern ? '🏮 Trägt die Laterne' : 'Laterne geben'}
        </button>
        <button className="btn btn-small" onClick={() => setOpen(!open)}>
          {open ? 'Schließen' : customized ? 'Angepasst ✎' : 'Anpassen'}
        </button>
      </div>
      {open && fields && (
        <div className="indent">
          <p className="muted small">Gilt nur für dieses Spiel – der Ally im Editor bleibt unverändert.</p>
          <span className="field-label">Ressourcen</span>
          {memberResources(m, fields).map((r) => {
            const o = m.resources[r.resourceId] ?? {};
            const setO = (patch: { start?: number; max?: number }) => set({ ...m, resources: { ...m.resources, [r.resourceId]: { ...o, ...patch } } });
            return (
              <div key={r.resourceId} className="member-resource">
                <span>{resName(r.resourceId)}</span>
                <span className="muted small">Start</span>
                <Stepper value={r.start} min={0} onChange={(start) => setO({ start })} />
                {r.hasMax && (
                  <>
                    <span />
                    <span className="muted small">Max.</span>
                    <Stepper value={r.max} min={0} onChange={(max) => setO({ max })} />
                  </>
                )}
              </div>
            );
          })}
          <span className="field-label">Start-Gegenstände</span>
          {items.map((it, i) => (
            <div key={i} className="ability-row">
              <RefSelect
                collection="objekte"
                value={it.objectId}
                emptyLabel="– Gegenstand –"
                onChange={(objectId) => set({ ...m, items: items.map((x, j) => (j === i ? { ...x, objectId } : x)) })}
              />
              <Stepper value={it.count} min={1} onChange={(c) => set({ ...m, items: items.map((x, j) => (j === i ? { ...x, count: c } : x)) })} />
              <button className="icon-btn" aria-label="Entfernen" onClick={() => set({ ...m, items: items.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button className="btn btn-small" onClick={() => set({ ...m, items: [...items, { objectId: null, count: 1 }] })}>+ Gegenstand</button>
          {customized && (
            <button className="btn btn-small" onClick={() => set({ ...m, items: null, resources: {} })}>Auf Editor-Werte zurücksetzen</button>
          )}
        </div>
      )}
    </div>
  );
}

function LevelEventCard({ e, levelIds, levelName, set, onRemove }: {
  e: LevelEvent;
  levelIds: string[];
  levelName: (id: string) => string;
  set: (e: LevelEvent) => void;
  onRemove: () => void;
}) {
  return (
    <div className="sub-card">
      <div className="ability-row">
        <RefSelect collection="ressourcen" value={e.resourceId} emptyLabel="– Ressource –" onChange={(resourceId) => set({ ...e, resourceId })} />
        <button className="icon-btn" aria-label="Entfernen" onClick={onRemove}>✕</button>
      </div>
      <Choice<LevelEvent['mode']>
        value={e.mode}
        options={[{ value: 'max', label: 'Auffüllen' }, { value: 'start', label: 'Startwert' }, { value: 'betrag', label: 'Betrag' }]}
        onChange={(mode) => set({ ...e, mode })}
      />
      {e.mode === 'betrag' && <Stepper value={e.amount} signed onChange={(amount) => set({ ...e, amount })} />}
      <span className="field-label">Wann</span>
      <select
        className="input"
        value={e.after === 'jedem-level' ? '' : e.levelId ?? ''}
        onChange={(ev) => set(ev.target.value ? { ...e, after: 'level', levelId: ev.target.value } : { ...e, after: 'jedem-level', levelId: null })}
      >
        <option value="">Nach jedem Level</option>
        {levelIds.map((id) => (
          <option key={id} value={id}>Nach „{levelName(id)}“</option>
        ))}
        {e.levelId && !levelIds.includes(e.levelId) && <option value={e.levelId}>Nach „{levelName(e.levelId)}“ (nicht im Inhalt)</option>}
      </select>
    </div>
  );
}

export function GameEditor({ entry, set }: EditorProps) {
  const g = normalizeGame(entry);
  const dialog = useDialog();
  const update = (patch: Partial<GameFields>) => set({ ...g, ...patch } as unknown as Partial<Entry>);
  const levels = useCollection('level').entries;
  const dungeons = useCollection('dungeons').entries;
  const allys = useCollection('allys').entries;
  const ressourcen = useCollection('ressourcen').entries;
  const globals = sortEntries(ressourcen.filter((r) => normalizeResource(r).scope === 'global'));
  const c = g.content;

  const warnings = validateGame(g, {
    allyExists: (id) => allys.some((a) => a.id === id),
    dungeonLevels: (id) => normalizeDungeon(dungeons.find((d) => d.id === id) ?? {}).stations.map((s) => s.levelId),
    victoryCount: (id) => {
      const l = levels.find((x) => x.id === id);
      return l ? normalizeLevel(l).victory.length : undefined;
    },
    levelName: (id) => levels.find((x) => x.id === id)?.title ?? '?',
  });

  // Zu wenige Siegfelder verhindert den Start nicht (man kann trotzdem testen).
  const blocking = warnings.filter((w) => !w.includes('Siegfelder'));

  function start() {
    const run = createRun(g, buildDefs(g));
    const save = createSave(entry.title, run, { gameId: entry.id });
    navigate(routes.game(save.id));
  }

  async function addMember() {
    const items = sortEntries(getCollection('allys').entries).map((a) => ({ label: a.title, value: a.id }));
    const picked = await dialog.menu({ title: 'Ally hinzufügen', items: [...items, newOption('allys')!] });
    if (!picked) return;
    const allyId = picked === NEW ? createAndOpen('allys') : picked;
    const m: TeamMember = { id: newId('mitglied'), allyId, items: null, resources: {} };
    update({ team: [...g.team, m], lanternMemberId: g.lanternMemberId ?? m.id });
  }

  function move(i: number, dir: -1 | 1) {
    const team = [...g.team];
    [team[i], team[i + dir]] = [team[i + dir], team[i]];
    update({ team });
  }

  const setContent = (content: GameContent) => update({ content });

  return (
    <>
      <section className="card fields">
        <h2>Prüfung</h2>
        {warnings.length ? (
          <ul className="warnings">
            {warnings.map((w) => <li key={w} className="warn">{w}</li>)}
          </ul>
        ) : (
          <p className="muted small">Bereit zum Start.</p>
        )}
        <button className="btn btn-primary" disabled={blocking.length > 0} onClick={start}>Spiel starten</button>
        <p className="muted small">Beim Start wird automatisch ein Spielstand „Name – Datum“ angelegt und laufend gespeichert.</p>
      </section>

      <section className="card fields">
        <h2>Was wird gespielt?</h2>
        <Choice<GameContent['kind']>
          value={c.kind}
          options={[{ value: 'dungeon', label: 'Dungeon' }, { value: 'level', label: 'Ein Level' }, { value: 'levels', label: 'Level-Folge' }]}
          onChange={(kind) =>
            setContent(kind === 'dungeon' ? { kind, dungeonId: null } : kind === 'level' ? { kind, levelId: null } : { kind, levelIds: [] })
          }
        />
        {c.kind === 'dungeon' && <RefSelect collection="dungeons" value={c.dungeonId} emptyLabel="– Dungeon wählen –" onChange={(dungeonId) => setContent({ ...c, dungeonId })} />}
        {c.kind === 'level' && <RefSelect collection="level" value={c.levelId} emptyLabel="– Level wählen –" onChange={(levelId) => setContent({ ...c, levelId })} />}
        {c.kind === 'levels' && (
          <>
            <p className="muted small">Eigene Reihenfolge ohne Zwischenstationen; Level dürfen mehrfach vorkommen.</p>
            {c.levelIds.map((id, i) => (
              <div key={i} className="ability-row">
                <span className="muted small">{i + 1}.</span>
                <RefSelect collection="level" value={id} emptyLabel="– Level –" onChange={(v) => setContent({ ...c, levelIds: c.levelIds.map((x, j) => (j === i ? v : x)) })} />
                <button className="icon-btn" aria-label="Entfernen" onClick={() => setContent({ ...c, levelIds: c.levelIds.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="btn btn-small" onClick={() => setContent({ ...c, levelIds: [...c.levelIds, null] })}>+ Level</button>
          </>
        )}
        <label className="field-label" htmlFor="ruleset">Regelwerk</label>
        <RefSelect id="ruleset" collection="regelwerke" value={g.regelwerkId} emptyLabel="Standard-Regeln" onChange={(regelwerkId) => update({ regelwerkId })} />
      </section>

      <section className="card fields">
        <h2>Team</h2>
        <p className="muted small">
          Beliebig groß, Allys auch mehrfach. Die Reihenfolge entscheidet bei Initiative-Gleichstand unter Allys. Genau einer trägt die Laterne.
        </p>
        {g.team.map((m, i) => (
          <MemberCard
            key={m.id}
            m={m}
            index={i}
            count={g.team.length}
            isLantern={g.lanternMemberId === m.id}
            set={(n) => update({ team: g.team.map((x) => (x.id === m.id ? n : x)) })}
            onLantern={() => update({ lanternMemberId: m.id })}
            onMove={(dir) => move(i, dir)}
            onRemove={() => update({ team: g.team.filter((x) => x.id !== m.id), lanternMemberId: g.lanternMemberId === m.id ? null : g.lanternMemberId })}
          />
        ))}
        <button className="btn" onClick={addMember}>+ Ally</button>
      </section>

      <section className="card fields">
        <h2>Ereignisse zwischen Leveln</h2>
        <p className="muted small">
          Nach einem geschafften Level (vor der Zwischenstation): eine Ressource auffüllen, auf den Startwert setzen oder um einen Betrag ändern.
          Individuelle Ressourcen gelten für alle Allys, globale für den Pool. Die Grundregel steht im Regelwerk.
        </p>
        {g.levelEvents.map((e, i) => (
          <LevelEventCard
            key={i}
            e={e}
            levelIds={[...new Set(contentLevels(c, (id) => normalizeDungeon(dungeons.find((d) => d.id === id) ?? {}).stations.map((s) => s.levelId)).filter((x): x is string => !!x))]}
            levelName={(id) => levels.find((l) => l.id === id)?.title ?? '?'}
            set={(n) => update({ levelEvents: g.levelEvents.map((x, j) => (j === i ? n : x)) })}
            onRemove={() => update({ levelEvents: g.levelEvents.filter((_, j) => j !== i) })}
          />
        ))}
        <button
          className="btn btn-small"
          onClick={() => update({ levelEvents: [...g.levelEvents, { after: 'jedem-level', levelId: null, resourceId: null, mode: 'max', amount: 5 }] })}
        >
          + Ereignis
        </button>
      </section>

      {globals.length > 0 && (
        <section className="card fields">
          <h2>Globale Ressourcen</h2>
          <p className="muted small">Startwerte nur für dieses Spiel.</p>
          {globals.map((r) => {
            const def = normalizeResource(r).start;
            const value = g.globalStarts[r.id] ?? def;
            return (
              <div key={r.id} className="member-resource">
                <span>{r.title}</span>
                <span className="muted small">Start</span>
                <Stepper value={value} min={0} onChange={(v) => update({ globalStarts: { ...g.globalStarts, [r.id]: v } })} />
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
