import type { Entry } from '../../data/model';
import {
  normalizeEffect, type ChangeSource, type EffectBlock, type EffectCondition, type EffectEnding, type EffectFields,
  type EntityKind, type Selection,
} from '../../engine/effects';
import type { ChangeInterval, ChangeTiming, EventDirection } from '../../engine/resources';
import { AreaPicker } from '../../ui/AreaPicker';
import { ColorWheel } from '../../ui/ColorWheel';
import { useDialog } from '../../ui/Dialog';
import { Choice, RefSelect, Stepper, Toggle } from '../../ui/fields';
import { MultiRefPicker, SelectionPicker, TypePicker } from '../../ui/pickers';
import { ShapeIcon } from '../../ui/shapes';
import type { EditorProps } from './index';
import { DurationPicker, Select, SubCard } from './shared';

const ALL: Selection = { all: true, ids: [], typeIds: [] };
const TA = 'typen-aktionen';
const TC = 'typen-charaktere';

const ENTITY_COLLECTION: Record<EntityKind | 'gelaende', string> = { ally: 'allys', gegner: 'gegner', objekt: 'objekte', gelaende: 'gelaende' };
const ENTITY_OPTIONS: { value: EntityKind; label: string }[] = [
  { value: 'gegner', label: 'Gegner' },
  { value: 'ally', label: 'Ally' },
  { value: 'objekt', label: 'Objekt' },
];
const TIMING_OPTIONS: { value: ChangeTiming; label: string }[] = [
  { value: 'beginn', label: 'Zu Beginn' },
  { value: 'ende', label: 'Am Ende' },
];

// ---------- Bausteine ----------

const BLOCKS: { kind: EffectBlock['kind']; label: string; create: () => EffectBlock }[] = [
  { kind: 'ressource', label: 'Ressource verändern', create: () => ({ kind: 'ressource', resourceId: null, mode: 'dauerhaft', interval: 'runde', timing: 'beginn', amount: -1, mayExceedMax: false }) },
  { kind: 'effekt', label: 'Weiteren Effekt hinzufügen', create: () => ({ kind: 'effekt', effectId: null, schedule: 'runde', timing: 'beginn', rounds: 1, duration: { kind: 'bis-aufloesung' } }) },
  { kind: 'ersetzen', label: 'Fähigkeiten ersetzen', create: () => ({ kind: 'ersetzen', from: [], to: [] }) },
  { kind: 'hinzufuegen', label: 'Fähigkeiten hinzufügen', create: () => ({ kind: 'hinzufuegen', abilityIds: [] }) },
  { kind: 'reaktion', label: 'Reaktion hinzufügen', create: () => ({ kind: 'reaktion' }) },
  { kind: 'verlust', label: 'Möglichkeit verlieren', create: () => ({ kind: 'verlust', what: 'zug', typeIds: [] }) },
  { kind: 'sicht', label: 'Sicht im Nebel ersetzen', create: () => ({ kind: 'sicht', area: ['0,0'] }) },
  { kind: 'verhalten', label: 'Verhalten ändern', create: () => ({ kind: 'verhalten' }) },
  { kind: 'gelaende-ignorieren', label: 'Gelände-Effekte ignorieren', create: () => ({ kind: 'gelaende-ignorieren', terrain: { ...ALL } }) },
  { kind: 'hindernis-ignorieren', label: 'Hindernisse ignorieren', create: () => ({ kind: 'hindernis-ignorieren', category: 'objekt', selection: { ...ALL } }) },
  { kind: 'unveraenderlich', label: 'Ressource unveränderlich', create: () => ({ kind: 'unveraenderlich', resourceId: null, by: 'alle', typeIds: [] }) },
  { kind: 'unsichtbar', label: 'Nicht wahrnehmbar', create: () => ({ kind: 'unsichtbar', selection: { ...ALL } }) },
];

function BlockFields({ block: b, set, selfId }: { block: EffectBlock; set: (b: EffectBlock) => void; selfId: string }) {
  switch (b.kind) {
    case 'ressource':
      return (
        <>
          <RefSelect collection="ressourcen" value={b.resourceId} emptyLabel="– Ressource wählen –" onChange={(resourceId) => set({ ...b, resourceId })} />
          <Choice<'dauerhaft' | 'wiederkehrend'>
            value={b.mode}
            options={[{ value: 'dauerhaft', label: 'Dauerhaft' }, { value: 'wiederkehrend', label: 'Wiederkehrend' }]}
            onChange={(mode) => set({ ...b, mode })}
          />
          {b.mode === 'dauerhaft' ? (
            <p className="muted small">Gilt, solange der Effekt aktiv ist, und wird danach zurückgenommen (z. B. Stärke −6).</p>
          ) : (
            <>
              <Choice<ChangeInterval>
                value={b.interval}
                options={[{ value: 'zug', label: 'Pro Zug' }, { value: 'runde', label: 'Pro Runde' }, { value: 'level', label: 'Pro Level' }]}
                onChange={(interval) => set({ ...b, interval })}
              />
              <Choice<ChangeTiming> value={b.timing} options={TIMING_OPTIONS} onChange={(timing) => set({ ...b, timing })} />
            </>
          )}
          <Stepper value={b.amount} signed onChange={(amount) => set({ ...b, amount })} />
          <Toggle label="Darf das Maximum überschreiten" checked={b.mayExceedMax} onChange={(mayExceedMax) => set({ ...b, mayExceedMax })} />
        </>
      );
    case 'effekt':
      return (
        <>
          <RefSelect collection="effekte" value={b.effectId} emptyLabel="– Effekt wählen –" filter={(e) => e.id !== selfId} onChange={(effectId) => set({ ...b, effectId })} />
          <Select<typeof b.schedule>
            value={b.schedule}
            options={[
              { value: 'runde', label: 'Pro Runde' },
              { value: 'level', label: 'Pro Level' },
              { value: 'nach-runden', label: 'Einmalig nach X Runden' },
            ]}
            onChange={(schedule) => set({ ...b, schedule })}
          />
          {b.schedule === 'nach-runden' ? (
            <Stepper value={b.rounds} min={1} onChange={(rounds) => set({ ...b, rounds })} />
          ) : (
            <Choice<ChangeTiming> value={b.timing} options={TIMING_OPTIONS} onChange={(timing) => set({ ...b, timing })} />
          )}
          <DurationPicker value={b.duration} onChange={(duration) => set({ ...b, duration })} />
        </>
      );
    case 'ersetzen':
      return (
        <>
          <span className="field-label">Diese Fähigkeiten …</span>
          <MultiRefPicker collection="faehigkeiten" value={b.from} addLabel="Fähigkeit" onChange={(from) => set({ ...b, from })} />
          <span className="field-label">… werden ersetzt durch</span>
          <MultiRefPicker collection="faehigkeiten" value={b.to} addLabel="Fähigkeit" onChange={(to) => set({ ...b, to })} />
        </>
      );
    case 'hinzufuegen':
      return <MultiRefPicker collection="faehigkeiten" value={b.abilityIds} addLabel="Fähigkeit" onChange={(abilityIds) => set({ ...b, abilityIds })} />;
    case 'reaktion':
      return <p className="muted small">Die Reaktion wird genauso festgelegt wie im Charakter-Editor (folgt in Abschnitt 6).</p>;
    case 'verlust':
      return (
        <>
          <Select<typeof b.what>
            value={b.what}
            options={[
              { value: 'zug', label: 'Einen Zug zu tätigen (setzt aus)' },
              { value: 'reaktion', label: 'Eine Reaktion zu tätigen' },
              { value: 'faehigkeiten', label: 'Grundsätzlich Fähigkeiten zu verwenden' },
              { value: 'typ', label: 'Fähigkeiten bestimmter Typen zu verwenden' },
            ]}
            onChange={(what) => set({ ...b, what })}
          />
          {b.what === 'typ' && <TypePicker list={TA} value={b.typeIds} onChange={(typeIds) => set({ ...b, typeIds })} />}
        </>
      );
    case 'sicht':
      return (
        <>
          <p className="muted small">Ersetzt die Sicht des Charakters im Nebel. Schattenwerfende Objekte verdecken weiterhin.</p>
          <AreaPicker value={b.area} onChange={(area) => set({ ...b, area })} />
        </>
      );
    case 'verhalten':
      return (
        <p className="muted small">
          Gegner erhalten ein neues Hauptziel; Allys werden unkontrollierbar und erhalten ein Hauptziel (wie ein Gegner). Die Wahl des
          Hauptziels folgt mit dem Gegner-Verhalten (Abschnitt 7).
        </p>
      );
    case 'gelaende-ignorieren':
      return (
        <>
          <p className="muted small">Effekte durch Betreten oder Verlassen dieser Geländearten werden ignoriert.</p>
          <SelectionPicker value={b.terrain} collection="gelaende" allLabel="Alle Geländearten" onChange={(terrain) => set({ ...b, terrain })} />
        </>
      );
    case 'hindernis-ignorieren':
      return (
        <>
          <Choice<typeof b.category>
            value={b.category}
            options={[
              { value: 'objekt', label: 'Objekte' },
              { value: 'ally', label: 'Allys' },
              { value: 'gegner', label: 'Gegner' },
              { value: 'gelaende', label: 'Gelände' },
            ]}
            onChange={(category) => set({ ...b, category, selection: { ...ALL } })}
          />
          <SelectionPicker
            value={b.selection}
            collection={ENTITY_COLLECTION[b.category]}
            typeList={b.category === 'ally' || b.category === 'gegner' ? TC : undefined}
            allLabel="Alle"
            onChange={(selection) => set({ ...b, selection })}
          />
        </>
      );
    case 'unveraenderlich':
      return (
        <>
          <RefSelect collection="ressourcen" value={b.resourceId} emptyLabel="– Ressource wählen –" onChange={(resourceId) => set({ ...b, resourceId })} />
          <span className="field-label">… kann nicht verändert werden durch</span>
          <Select<ChangeSource>
            value={b.by}
            options={[
              { value: 'alle', label: 'Alle Fähigkeiten und Effekte' },
              { value: 'gegner', label: 'Gegnerische Fähigkeiten/Effekte' },
              { value: 'allys', label: 'Fähigkeiten/Effekte von Allys' },
              { value: 'eigene', label: 'Eigene Fähigkeiten/Effekte' },
              { value: 'typen', label: 'Fähigkeiten/Effekte bestimmter Typen' },
            ]}
            onChange={(by) => set({ ...b, by })}
          />
          {b.by === 'typen' && <TypePicker list={TA} value={b.typeIds} onChange={(typeIds) => set({ ...b, typeIds })} />}
        </>
      );
    case 'unsichtbar':
      return (
        <>
          <p className="muted small">
            Kann nicht anvisiert werden von Charakteren, die ihn nicht wahrnehmen; Flächen-Fähigkeiten treffen trotzdem. Für Gegner
            existiert er nicht. Darstellung: Gegner unsichtbar, Allys transparent.
          </p>
          <SelectionPicker value={b.selection} collection={['allys', 'gegner']} typeList={TC} allLabel="Für alle Charaktere" onChange={(selection) => set({ ...b, selection })} />
        </>
      );
  }
}

// ---------- Auslöser & Beendigung ----------

const CONDITIONS: { kind: EffectCondition['kind']; label: string; create: () => EffectCondition }[] = [
  { kind: 'spielstart', label: 'Startet mit dem Effekt ins Spiel', create: () => ({ kind: 'spielstart' }) },
  { kind: 'level-enthaelt', label: 'Level enthält bestimmtes Objekt/Gegner/Ally', create: () => ({ kind: 'level-enthaelt', entity: 'gegner', id: null }) },
  { kind: 'bereich', label: 'Etwas betritt/verlässt einen Bereich', create: () => ({ kind: 'bereich', event: 'betritt', entity: 'gegner', selection: { ...ALL }, area: [] }) },
  { kind: 'ziel', label: 'Wird Ziel einer Fähigkeit/eines Effekts', create: () => ({ kind: 'ziel', from: 'alle', typeIds: [] }) },
  { kind: 'ressource-aenderung', label: 'Ressource verändert sich', create: () => ({ kind: 'ressource-aenderung', resourceId: null, change: 'generell', min: 1 }) },
  { kind: 'ressource-grenze', label: 'Ressource erreicht eine Grenze', create: () => ({ kind: 'ressource-grenze', resourceId: null, direction: 'faellt', threshold: 0 }) },
  { kind: 'gegenstand', label: 'Gegenstand sammeln/verwenden/platzieren', create: () => ({ kind: 'gegenstand', action: 'sammelt', objectId: null }) },
];

function ConditionFields({ cond: c, set }: { cond: EffectCondition; set: (c: EffectCondition) => void }) {
  switch (c.kind) {
    case 'spielstart':
      return null;
    case 'level-enthaelt':
      return (
        <>
          <Choice<EntityKind> value={c.entity} options={ENTITY_OPTIONS} onChange={(entity) => set({ ...c, entity, id: null })} />
          <RefSelect collection={ENTITY_COLLECTION[c.entity]} value={c.id} emptyLabel="– auswählen –" onChange={(id) => set({ ...c, id })} />
          <p className="muted small">Geprüft zu Beginn jedes Levels.</p>
        </>
      );
    case 'bereich':
      return (
        <>
          <Choice<EntityKind> value={c.entity} options={ENTITY_OPTIONS} onChange={(entity) => set({ ...c, entity, selection: { ...ALL } })} />
          <SelectionPicker
            value={c.selection}
            collection={ENTITY_COLLECTION[c.entity]}
            typeList={c.entity === 'objekt' ? undefined : TC}
            allLabel="Beliebige"
            onChange={(selection) => set({ ...c, selection })}
          />
          <Choice<'betritt' | 'verlaesst'>
            value={c.event}
            options={[{ value: 'betritt', label: 'Erscheint im Bereich' }, { value: 'verlaesst', label: 'Verlässt den Bereich' }]}
            onChange={(event) => set({ ...c, event })}
          />
          <AreaPicker value={c.area} onChange={(area) => set({ ...c, area })} />
        </>
      );
    case 'ziel':
      return (
        <>
          <Select<typeof c.from>
            value={c.from}
            options={[
              { value: 'alle', label: 'Von beliebiger Quelle' },
              { value: 'allys', label: 'Von Allys' },
              { value: 'gegner', label: 'Von Gegnern' },
              { value: 'typen', label: 'Fähigkeit/Effekt bestimmter Typen' },
            ]}
            onChange={(from) => set({ ...c, from })}
          />
          {c.from === 'typen' && <TypePicker list={TA} value={c.typeIds} onChange={(typeIds) => set({ ...c, typeIds })} />}
        </>
      );
    case 'ressource-aenderung':
      return (
        <>
          <RefSelect collection="ressourcen" value={c.resourceId} emptyLabel="– Ressource wählen –" onChange={(resourceId) => set({ ...c, resourceId })} />
          <Select<typeof c.change>
            value={c.change}
            options={[
              { value: 'generell', label: 'Generell' },
              { value: 'positiv', label: 'Positiv' },
              { value: 'negativ', label: 'Negativ' },
              { value: 'mindestens', label: 'Um einen Mindestwert' },
            ]}
            onChange={(change) => set({ ...c, change })}
          />
          {c.change === 'mindestens' && <Stepper value={c.min} min={1} onChange={(min) => set({ ...c, min })} />}
        </>
      );
    case 'ressource-grenze':
      return (
        <>
          <RefSelect collection="ressourcen" value={c.resourceId} emptyLabel="– Ressource wählen –" onChange={(resourceId) => set({ ...c, resourceId })} />
          <Choice<EventDirection>
            value={c.direction}
            options={[{ value: 'faellt', label: 'auf/unter … fällt' }, { value: 'steigt', label: 'auf/über … steigt' }]}
            onChange={(direction) => set({ ...c, direction })}
          />
          <Stepper value={c.threshold} min={0} onChange={(threshold) => set({ ...c, threshold })} />
        </>
      );
    case 'gegenstand':
      return (
        <>
          <Choice<typeof c.action>
            value={c.action}
            options={[{ value: 'sammelt', label: 'Sammelt' }, { value: 'verwendet', label: 'Verwendet' }, { value: 'platziert', label: 'Platziert' }]}
            onChange={(action) => set({ ...c, action })}
          />
          <RefSelect collection="objekte" value={c.objectId} emptyLabel="– Gegenstand wählen –" onChange={(objectId) => set({ ...c, objectId })} />
        </>
      );
  }
}

const ENDINGS: { kind: EffectEnding['kind']; label: string; create: () => EffectEnding }[] = [
  { kind: 'nach', label: 'Nach einer Anzahl Züge/Runden/Level', create: () => ({ kind: 'nach', count: 1, unit: 'runden', timing: 'ende' }) },
  ...CONDITIONS.filter((c) => c.kind !== 'spielstart'),
];

function EndingFields({ ending: e, set }: { ending: EffectEnding; set: (e: EffectEnding) => void }) {
  if (e.kind !== 'nach') return <ConditionFields cond={e} set={set} />;
  return (
    <>
      <Stepper value={e.count} min={1} onChange={(count) => set({ ...e, count })} />
      <Choice<typeof e.unit>
        value={e.unit}
        options={[{ value: 'zuege', label: 'Eigene Züge' }, { value: 'runden', label: 'Runden' }, { value: 'level', label: 'Level' }]}
        onChange={(unit) => set({ ...e, unit })}
      />
      <span className="field-label">Gezählt</span>
      <Choice<ChangeTiming> value={e.timing} options={TIMING_OPTIONS} onChange={(timing) => set({ ...e, timing })} />
    </>
  );
}

// ---------- Editor ----------

function labelOf<T extends { kind: string; label: string }>(list: T[], kind: string) {
  return list.find((x) => x.kind === kind)?.label ?? kind;
}

/** Liste mit „+“-Knopf, der ein Menü der möglichen Arten öffnet. */
function KindList<T extends { kind: string }>({
  title, hint, items, kinds, addLabel, onChange, render,
}: {
  title: string;
  hint?: string;
  items: T[];
  kinds: { kind: string; label: string; create: () => T }[];
  addLabel: string;
  onChange: (items: T[]) => void;
  render: (item: T, set: (item: T) => void) => React.ReactNode;
}) {
  const dialog = useDialog();
  async function add() {
    const kind = await dialog.menu({ title: addLabel, items: kinds.map((k) => ({ label: k.label, value: k.kind })) });
    const def = kinds.find((k) => k.kind === kind);
    if (def) onChange([...items, def.create()]);
  }
  return (
    <section className="card fields">
      <h2>{title}</h2>
      {hint && <p className="muted small">{hint}</p>}
      {items.map((item, i) => (
        <SubCard key={i} title={labelOf(kinds, item.kind)} onRemove={() => onChange(items.filter((_, j) => j !== i))}>
          {render(item, (next) => onChange(items.map((x, j) => (j === i ? next : x))))}
        </SubCard>
      ))}
      <button className="btn" onClick={add}>+ {addLabel}</button>
    </section>
  );
}

export function EffectEditor({ entry, set }: EditorProps) {
  const fx = normalizeEffect(entry);
  const update = (patch: Partial<EffectFields>) => set({ ...fx, ...patch } as unknown as Partial<Entry>);

  return (
    <>
      {entry.fixed && (
        <section className="card small muted">
          <strong>Fester Effekt.</strong> Kann bearbeitet, aber nicht gelöscht werden. Wann ein Run wegen Bewusstlosigkeit verloren ist, legt
          das Regelwerk fest. Ob ein bewusstloser Charakter seine Züge aussetzt, bestimmst du hier über den Baustein „Möglichkeit verlieren“.
        </section>
      )}

      <section className="card fields">
        <h2>Darstellung</h2>
        <Toggle
          label="Farbigen Kreis um den Charakter zeigen"
          checked={fx.display.show}
          onChange={(show) => update({ display: { ...fx.display, show } })}
        />
        {fx.display.show && (
          <>
            <div className="effect-preview">
              <span className="effect-ring" style={{ borderColor: fx.display.color }}>
                <ShapeIcon shape="kreis" color="#d9772b" size={40} />
              </span>
            </div>
            <ColorWheel value={fx.display.color} onChange={(color) => update({ display: { ...fx.display, color } })} />
          </>
        )}
      </section>

      <section className="card fields">
        <h2>Typen</h2>
        <p className="muted small">Gruppieren Effekte und Fähigkeiten, damit andere gezielt darauf zugreifen können.</p>
        <TypePicker list={TA} value={fx.typeIds} onChange={(typeIds) => update({ typeIds })} />
      </section>

      <section className="card fields">
        <h2>Stapeln & Unverträglichkeit</h2>
        <Toggle label="Stapelbar" hint="Die Dauer jedes Stapels wird einzeln berechnet" checked={fx.stack.stackable} onChange={(stackable) => update({ stack: { ...fx.stack, stackable } })} />
        {fx.stack.stackable && (
          <>
            <label className="field-label">Höchstens so oft gleichzeitig</label>
            <Stepper value={fx.stack.max} min={2} onChange={(max) => update({ stack: { ...fx.stack, max } })} />
          </>
        )}
        <span className="field-label">Beendet und verhindert diese Effekte</span>
        <MultiRefPicker collection="effekte" value={fx.excludes} addLabel="Effekt" filter={(e) => e.id !== entry.id} onChange={(excludes) => update({ excludes })} />
      </section>

      <KindList<EffectBlock>
        title="Bausteine"
        hint="Wirken, solange der Effekt aktiv ist. Danach wird alles Dauerhafte zurückgesetzt."
        items={fx.blocks}
        kinds={BLOCKS}
        addLabel="Baustein"
        onChange={(blocks) => update({ blocks })}
        render={(b, setB) => <BlockFields block={b} set={setB} selfId={entry.id} />}
      />

      <KindList<EffectCondition>
        title="Auslöser"
        hint="Jeder Charakter, der eine Bedingung erfüllt, erhält den Effekt (Ausnahmen legt die Charaktererstellung fest). Auslösen durch Fähigkeiten oder andere Effekte wird dort festgelegt."
        items={fx.triggers}
        kinds={CONDITIONS}
        addLabel="Auslöser"
        onChange={(triggers) => update({ triggers })}
        render={(c, setC) => <ConditionFields cond={c} set={setC} />}
      />

      <KindList<EffectEnding>
        title="Beendigung"
        hint="Gibt die Quelle eine Dauer vor, endet der Effekt bei dem, was zuerst eintritt. Beenden durch Fähigkeiten oder andere Effekte wird dort festgelegt."
        items={fx.endings}
        kinds={ENDINGS}
        addLabel="Beendigung"
        onChange={(endings) => update({ endings })}
        render={(e, setE) => <EndingFields ending={e} set={setE} />}
      />
    </>
  );
}
