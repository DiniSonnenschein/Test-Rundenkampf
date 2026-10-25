// Objekt-Editor: Grundeinstellungen, Licht, Verwendung, Werfen und Wirkungen.
import type { Entry } from '../../data/model';
import type { AbilityFields } from '../../engine/abilities';
import type { EntityKind } from '../../engine/effects';
import { normalizeObject, type ObjectFields, type ObjectWorking } from '../../engine/objects';
import { AreaPicker } from '../../ui/AreaPicker';
import { Choice, RefSelect, Stepper, Toggle } from '../../ui/fields';
import { MultiRefPicker, TypePicker } from '../../ui/pickers';
import { AbilityBlocksList, AbilityEditor } from './AbilityEditor';
import { ENTITY_COLLECTION, ENTITY_OPTIONS, KindList } from './EffectEditor';
import type { EditorProps } from './index';
import { Select } from './shared';

type Trigger = ObjectWorking['trigger'];
type TriggerChoice = 'betritt' | 'verlaesst' | 'zugbeginn' | 'zugende' | 'gesammelt' | 'verwendet' | 'vergeben' | 'geworfen';

const TRIGGER_OPTIONS: { value: TriggerChoice; label: string }[] = [
  { value: 'betritt', label: 'Charakter betritt den Bereich' },
  { value: 'verlaesst', label: 'Charakter verlässt den Bereich' },
  { value: 'zugbeginn', label: 'Charakter steht zu Beginn seines Zuges darin' },
  { value: 'zugende', label: 'Charakter steht am Ende seines Zuges darin' },
  { value: 'gesammelt', label: 'Objekt wird gesammelt' },
  { value: 'verwendet', label: 'Objekt wird verwendet' },
  { value: 'vergeben', label: 'Objekt wird vergeben' },
  { value: 'geworfen', label: 'Objekt wird geworfen (Aufprall)' },
];

function makeTrigger(choice: TriggerChoice, prev: Trigger): Trigger {
  if (choice === 'gesammelt' || choice === 'verwendet' || choice === 'vergeben' || choice === 'geworfen') return { kind: 'objekt', event: choice };
  const base = prev.kind === 'bereich' ? prev : { kind: 'bereich' as const, allys: true, gegner: true, typeIds: [], effectIds: [] };
  return { ...base, event: choice };
}

function WorkingFields({ w, set }: { w: ObjectWorking; set: (w: ObjectWorking) => void }) {
  const t = w.trigger;
  return (
    <>
      <span className="field-label">Wenn</span>
      <Select<TriggerChoice> value={t.event} options={TRIGGER_OPTIONS} onChange={(c) => set({ ...w, trigger: makeTrigger(c, t) })} />
      {t.kind === 'bereich' && (
        <div className="indent">
          <Toggle label="Allys" checked={t.allys} onChange={(allys) => set({ ...w, trigger: { ...t, allys } })} />
          <Toggle label="Gegner" checked={t.gegner} onChange={(gegner) => set({ ...w, trigger: { ...t, gegner } })} />
          <span className="field-label">Nur bestimmte Typen (leer = alle)</span>
          <TypePicker list="typen-charaktere" value={t.typeIds} onChange={(typeIds) => set({ ...w, trigger: { ...t, typeIds } })} />
          <span className="field-label">Nur mit bestimmtem Effekt (leer = egal)</span>
          <MultiRefPicker collection="effekte" addLabel="Effekt" value={t.effectIds} onChange={(effectIds) => set({ ...w, trigger: { ...t, effectIds } })} />
        </div>
      )}
      <span className="field-label">Bereich (vom Objekt aus, Blick nach oben)</span>
      <AreaPicker value={w.area} onChange={(area) => set({ ...w, area })} />
      <span className="field-label">Ziel</span>
      <Choice<ObjectWorking['target']>
        value={w.target}
        options={[{ value: 'traeger', label: 'Auslöser/Träger' }, { value: 'aoe', label: 'Alle im Bereich (AOE)' }]}
        onChange={(target) => set({ ...w, target })}
      />
      <span className="field-label">Vergebene Effekte enden</span>
      <Select<ObjectWorking['ending']>
        value={w.ending}
        options={[
          { value: 'verlassen', label: 'Beim Verlassen des Bereichs' },
          { value: 'ablegen', label: 'Beim Ablegen des Objekts' },
          { value: 'nie', label: 'Durch nichts davon' },
        ]}
        onChange={(ending) => set({ ...w, ending })}
      />
      <AbilityBlocksList blocks={w.blocks} onChange={(blocks) => set({ ...w, blocks })} hint="Alle Bausteine einer Fähigkeit sind möglich, auch „Effekt auslösen“." />
    </>
  );
}

export function ObjectEditor({ entry, set }: EditorProps) {
  const o = normalizeObject(entry);
  const update = (patch: Partial<ObjectFields>) => set({ ...o, ...patch } as unknown as Partial<Entry>);

  return (
    <>
      <section className="card fields">
        <h2>Grundsätzliches</h2>
        <span className="field-label">Typen</span>
        <TypePicker list="typen-objekte" value={o.typeIds} onChange={(typeIds) => update({ typeIds })} />
        <Toggle label="Kollision" hint="Hindernis für Bewegung und Fähigkeiten" checked={o.collision} onChange={(collision) => update({ collision })} />
        <Toggle label="Wirft Schatten" hint="Blockiert Licht und Sicht" checked={o.castsShadow} onChange={(castsShadow) => update({ castsShadow })} />
        <Toggle label="Sammelbar" hint="Kann in den Rucksack" checked={o.collectible} onChange={(collectible) => update({ collectible })} />
        <Toggle label="Tragbar" checked={o.carriable} onChange={(carriable) => update({ carriable })} />
        <Toggle label="Stapelbar im Rucksack" checked={o.stack.stackable} onChange={(stackable) => update({ stack: { ...o.stack, stackable } })} />
        {o.stack.stackable && (
          <>
            <label className="field-label">Höchstens pro Platz</label>
            <Stepper value={o.stack.max} min={2} onChange={(max) => update({ stack: { ...o.stack, max } })} />
          </>
        )}
        <Toggle label="Verborgen" hint="Erst sichtbar, wenn es aufgedeckt wird (dann bis Levelende)" checked={o.hidden} onChange={(hidden) => update({ hidden })} />
      </section>

      <section className="card fields">
        <h2>Licht</h2>
        <Toggle label="Lichtquelle" checked={o.light.on} onChange={(on) => update({ light: { ...o.light, on } })} />
        {o.light.on && (
          <>
            <span className="field-label">Leuchtbereich (Blick nach oben)</span>
            <AreaPicker value={o.light.area} onChange={(area) => update({ light: { ...o.light, area } })} />
            <Toggle label="Leuchtet auch, wenn getragen oder im Rucksack" checked={o.light.whenCarried} onChange={(whenCarried) => update({ light: { ...o.light, whenCarried } })} />
          </>
        )}
      </section>

      <section className="card fields">
        <h2>Verwendung</h2>
        <p className="muted small">Z. B. trinken oder anziehen (Anlegen = Verwenden; abgelegt ist es, sobald es weder im Rucksack ist noch getragen wird).</p>
        <Toggle label="Verwendbar" checked={o.use.usable} onChange={(usable) => update({ use: { ...o.use, usable } })} />
        {o.use.usable && <Toggle label="Wird dabei verbraucht" checked={o.use.consumed} onChange={(consumed) => update({ use: { ...o.use, consumed } })} />}
      </section>
      {o.use.usable && (
        <div className="nested-editor">
          <AbilityEditor
            variant="objekt"
            entry={o.use.ability as unknown as Entry}
            set={(patch) => update({ use: { ...o.use, ability: { ...o.use.ability, ...(patch as Partial<AbilityFields>) } } })}
          />
        </div>
      )}

      <section className="card fields">
        <h2>Werfen</h2>
        <p className="muted small">Wie weit, bestimmt die Fähigkeit „Objekt werfen“. Effekte beim Aufprall über eine Wirkung „Objekt wird geworfen“.</p>
        <span className="field-label">Beim Aufprall</span>
        <Choice<ObjectFields['throw']['impact']>
          value={o.throw.impact}
          options={[{ value: 'liegen', label: 'Bleibt liegen' }, { value: 'zerstoert', label: 'Zerstört' }, { value: 'verwandelt', label: 'Verwandelt' }]}
          onChange={(impact) => update({ throw: { ...o.throw, impact } })}
        />
        {o.throw.impact === 'verwandelt' && (
          <>
            <Choice<EntityKind> value={o.throw.into.kind} options={ENTITY_OPTIONS} onChange={(kind) => update({ throw: { ...o.throw, into: { kind, id: null } } })} />
            <RefSelect collection={ENTITY_COLLECTION[o.throw.into.kind]} value={o.throw.into.id} emptyLabel="– auswählen –" onChange={(id) => update({ throw: { ...o.throw, into: { ...o.throw.into, id } } })} />
          </>
        )}
        <Toggle label="Ignoriert Hindernisse" checked={o.throw.ignoresObstacles} onChange={(ignoresObstacles) => update({ throw: { ...o.throw, ignoresObstacles } })} />
        <span className="field-label">Geländeart am Aufprallort ändern in</span>
        <RefSelect collection="gelaende" value={o.throw.terrainId} emptyLabel="– nicht ändern –" onChange={(terrainId) => update({ throw: { ...o.throw, terrainId } })} />
      </section>

      <KindList<ObjectWorking & { kind: 'wirkung' }>
        title="Wirkungen"
        hint="Das Objekt verteilt bei einem Auslöser die Bausteine einer Fähigkeit in seinem Bereich – auch, wenn es verborgen ist."
        items={o.workings.map((w) => ({ ...w, kind: 'wirkung' as const }))}
        kinds={[
          {
            kind: 'wirkung',
            label: 'Wirkung',
            create: () => ({
              kind: 'wirkung',
              trigger: { kind: 'bereich', event: 'betritt', allys: true, gegner: true, typeIds: [], effectIds: [] },
              area: ['0,0'],
              target: 'traeger',
              ending: 'nie',
              blocks: [],
            }),
          },
        ]}
        addLabel="Wirkung"
        numbered
        onChange={(ws) => update({ workings: ws.map(({ kind: _k, ...w }) => w) })}
        render={(w, setW) => <WorkingFields w={w} set={(n) => setW({ ...n, kind: 'wirkung' })} />}
      />
    </>
  );
}
