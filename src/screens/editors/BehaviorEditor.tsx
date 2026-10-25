// Verhalten der Gegner (KI): Hauptziel, Regel-Liste, Bewegung, eigene Events, Beute.
import type { Entry } from '../../data/model';
import type { AbilityCondition } from '../../engine/abilities';
import {
  normalizeBehavior, type Behavior, type BehaviorRule, type CharacterEvent, type CharacterEventAction, type RuleCondition,
  type RuleTarget, type TargetCriterion,
} from '../../engine/behavior';
import type { EntityKind } from '../../engine/effects';
import type { EventDirection } from '../../engine/resources';
import { useDialog } from '../../ui/Dialog';
import { Choice, RefSelect, Stepper, Toggle } from '../../ui/fields';
import { MultiRefPicker, TypePicker } from '../../ui/pickers';
import { CONDITION_KINDS, ConditionKindFields } from './AbilityEditor';
import { ENTITY_COLLECTION, ENTITY_OPTIONS, KindList } from './EffectEditor';
import type { EditorProps } from './index';
import { DurationPicker, Select, SubCard } from './shared';

// ---------- Prioritätenliste ----------

const CRITERIA: { kind: TargetCriterion['kind']; label: string; create: () => TargetCriterion }[] = [
  { kind: 'naechster', label: 'Nächster (in Schritten)', create: () => ({ kind: 'naechster' }) },
  { kind: 'ressource', label: 'Niedrigster/höchster Wert einer Ressource', create: () => ({ kind: 'ressource', resourceId: null, order: 'niedrigster' }) },
  { kind: 'laternentraeger', label: 'Laternenträger', create: () => ({ kind: 'laternentraeger' }) },
  { kind: 'letzter-angreifer', label: 'Wer zuletzt angegriffen hat', create: () => ({ kind: 'letzter-angreifer' }) },
  { kind: 'typ', label: 'Bestimmter Typ', create: () => ({ kind: 'typ', typeIds: [] }) },
  { kind: 'effekt', label: 'Mit bestimmtem Effekt', create: () => ({ kind: 'effekt', effectIds: [] }) },
];

/** Prioritätenliste (wiederverwendet im Effekt „Verhalten ändern“ und für Verbündete in Regeln). */
export function PriorityList({ value, onChange }: { value: TargetCriterion[]; onChange: (v: TargetCriterion[]) => void }) {
  const dialog = useDialog();
  const edit = (i: number, k: TargetCriterion) => onChange(value.map((x, j) => (j === i ? k : x)));
  const move = (i: number, d: number) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  async function add() {
    const kind = await dialog.menu({ title: 'Kriterium hinzufügen', items: CRITERIA.map((c) => ({ label: c.label, value: c.kind })) });
    const def = CRITERIA.find((c) => c.kind === kind);
    if (def) onChange([...value, def.create()]);
  }
  return (
    <div className="picker">
      {value.map((k, i) => (
        <div key={i} className="sub-card">
          <div className="sub-card-head">
            <span className="field-label">{i + 1}. {CRITERIA.find((c) => c.kind === k.kind)?.label}</span>
            <span>
              {i > 0 && <button className="icon-btn" aria-label="Nach oben" onClick={() => move(i, -1)}>↑</button>}
              <button className="icon-btn" aria-label="Entfernen" onClick={() => onChange(value.filter((_, j) => j !== i))}>✕</button>
            </span>
          </div>
          {k.kind === 'ressource' && (
            <>
              <RefSelect collection="ressourcen" value={k.resourceId} emptyLabel="– Ressource wählen –" onChange={(resourceId) => edit(i, { ...k, resourceId })} />
              <Choice<'niedrigster' | 'hoechster'>
                value={k.order}
                options={[{ value: 'niedrigster', label: 'Niedrigster' }, { value: 'hoechster', label: 'Höchster' }]}
                onChange={(order) => edit(i, { ...k, order })}
              />
            </>
          )}
          {k.kind === 'typ' && <TypePicker list="typen-charaktere" value={k.typeIds} onChange={(typeIds) => edit(i, { ...k, typeIds })} />}
          {k.kind === 'effekt' && <MultiRefPicker collection="effekte" addLabel="Effekt" value={k.effectIds} onChange={(effectIds) => edit(i, { ...k, effectIds })} />}
        </div>
      ))}
      <button className="btn btn-small" onClick={add}>+ Kriterium</button>
    </div>
  );
}

// ---------- Regeln ----------

// Als Funktion, weil die Editor-Module sich gegenseitig importieren.
const ruleConditions = (): { kind: RuleCondition['kind']; label: string; create: () => RuleCondition }[] => [
  { kind: 'ziel-in-reichweite', label: 'Ziel in Reichweite der Fähigkeit', create: () => ({ kind: 'ziel-in-reichweite' }) },
  { kind: 'hat-effekt', label: 'Hat Effekt (selbst/Hauptziel)', create: () => ({ kind: 'hat-effekt', who: 'selbst', effectId: null }) },
  ...CONDITION_KINDS,
];

function RuleConditionFields({ c, set }: { c: RuleCondition; set: (c: RuleCondition) => void }) {
  if (c.kind === 'ziel-in-reichweite') return null;
  if (c.kind === 'hat-effekt') {
    return (
      <>
        <Choice<'selbst' | 'hauptziel'> value={c.who} options={[{ value: 'selbst', label: 'Selbst' }, { value: 'hauptziel', label: 'Hauptziel' }]} onChange={(who) => set({ ...c, who })} />
        <RefSelect collection="effekte" value={c.effectId} emptyLabel="– Effekt wählen –" onChange={(effectId) => set({ ...c, effectId })} />
      </>
    );
  }
  return <ConditionKindFields c={c as AbilityCondition} set={set} />;
}

function RuleCard({ rule: r, set }: { rule: BehaviorRule; set: (r: BehaviorRule) => void }) {
  const dialog = useDialog();
  async function addCondition() {
    const kind = await dialog.menu({ title: 'Bedingung hinzufügen', items: ruleConditions().map((c) => ({ label: c.label, value: c.kind })) });
    const def = ruleConditions().find((c) => c.kind === kind);
    if (def) set({ ...r, conditions: [...r.conditions, def.create()] });
  }
  return (
    <>
      <div className="btn-row">
        <Toggle label="Im Zug" checked={r.zug} onChange={(zug) => set({ ...r, zug })} />
        <Toggle label="Als Reaktion" checked={r.reaktion} onChange={(reaktion) => set({ ...r, reaktion })} />
      </div>
      <span className="field-label">Wenn (alle erfüllt; leer = immer)</span>
      {r.conditions.map((c, i) => (
        <SubCard key={i} title={ruleConditions().find((k) => k.kind === c.kind)?.label ?? ''} onRemove={() => set({ ...r, conditions: r.conditions.filter((_, j) => j !== i) })}>
          <RuleConditionFields c={c} set={(n) => set({ ...r, conditions: r.conditions.map((x, j) => (j === i ? n : x)) })} />
        </SubCard>
      ))}
      <button className="btn btn-small" onClick={addCondition}>+ Bedingung</button>
      <span className="field-label">dann Fähigkeit</span>
      <RefSelect collection="faehigkeiten" value={r.abilityId} emptyLabel="– Fähigkeit wählen –" onChange={(abilityId) => set({ ...r, abilityId })} />
      <span className="field-label">auf</span>
      <Choice<RuleTarget['kind']>
        value={r.target.kind}
        options={[{ value: 'hauptziel', label: 'Hauptziel' }, { value: 'selbst', label: 'Sich selbst' }, { value: 'verbuendeter', label: 'Verbündeten' }]}
        onChange={(kind) => set({ ...r, target: kind === 'verbuendeter' ? { kind, criteria: [{ kind: 'naechster' }] } : { kind } })}
      />
      {r.target.kind === 'verbuendeter' && (
        <PriorityList value={r.target.criteria} onChange={(criteria) => set({ ...r, target: { kind: 'verbuendeter', criteria } })} />
      )}
    </>
  );
}

// ---------- Events ----------

const EVENT_ACTIONS: { value: CharacterEventAction['kind']; label: string }[] = [
  { value: 'zerstoert', label: 'Wird zerstört' },
  { value: 'effekt', label: 'Erhält Effekt (z. B. Flucht)' },
  { value: 'ersetzen', label: 'Wird ersetzt durch' },
  { value: 'sieg', label: 'Run gewonnen' },
  { value: 'niederlage', label: 'Run verloren' },
];

function newEventAction(kind: CharacterEventAction['kind']): CharacterEventAction {
  if (kind === 'effekt') return { kind, effectId: null, duration: { kind: 'bis-aufloesung' } };
  if (kind === 'ersetzen') return { kind, into: { kind: 'objekt', id: null } };
  return { kind };
}

function EventFields({ ev, set }: { ev: CharacterEvent; set: (e: CharacterEvent) => void }) {
  const a = ev.action;
  return (
    <>
      <RefSelect collection="ressourcen" value={ev.resourceId} emptyLabel="– Ressource wählen –" onChange={(resourceId) => set({ ...ev, resourceId })} />
      <Choice<EventDirection>
        value={ev.direction}
        options={[{ value: 'faellt', label: 'auf/unter … fällt' }, { value: 'steigt', label: 'auf/über … steigt' }]}
        onChange={(direction) => set({ ...ev, direction })}
      />
      <Stepper value={ev.threshold} min={0} onChange={(threshold) => set({ ...ev, threshold })} />
      <span className="field-label">dann</span>
      <Select<CharacterEventAction['kind']> value={a.kind} options={EVENT_ACTIONS} onChange={(kind) => set({ ...ev, action: newEventAction(kind) })} />
      {a.kind === 'effekt' && (
        <>
          <RefSelect collection="effekte" value={a.effectId} emptyLabel="– Effekt wählen –" onChange={(effectId) => set({ ...ev, action: { ...a, effectId } })} />
          <DurationPicker value={a.duration} onChange={(duration) => set({ ...ev, action: { ...a, duration } })} />
        </>
      )}
      {a.kind === 'ersetzen' && (
        <>
          <Choice<EntityKind> value={a.into.kind} options={ENTITY_OPTIONS} onChange={(kind) => set({ ...ev, action: { ...a, into: { kind, id: null } } })} />
          <RefSelect collection={ENTITY_COLLECTION[a.into.kind]} value={a.into.id} emptyLabel="– auswählen –" onChange={(id) => set({ ...ev, action: { ...a, into: { ...a.into, id } } })} />
        </>
      )}
    </>
  );
}

// ---------- Editor ----------

export function BehaviorEditor({ entry, set }: EditorProps) {
  const b = normalizeBehavior(entry.behavior);
  const update = (patch: Partial<Behavior>) => set({ behavior: { ...b, ...patch } } as Partial<Entry>);
  const loot = b.loot.items;

  return (
    <>
      <section className="card fields">
        <h2>Hauptziel</h2>
        <p className="muted small">Prioritätenliste: das erste Kriterium entscheidet, die weiteren brechen Gleichstände. Gibt es zum Ziel keinen Weg, geht es in der Liste weiter.</p>
        <PriorityList value={b.targetPriority} onChange={(targetPriority) => update({ targetPriority })} />
        <span className="field-label">Zielwechsel</span>
        <Choice<Behavior['retarget']>
          value={b.retarget}
          options={[{ value: 'jeder-zug', label: 'Jeden Zug neu' }, { value: 'bis-ungueltig', label: 'Bis ungültig' }]}
          onChange={(retarget) => update({ retarget })}
        />
        <span className="field-label">Ohne sichtbares Ziel</span>
        <Select<Behavior['idle']>
          value={b.idle}
          options={[
            { value: 'stehen', label: 'Stehen bleiben' },
            { value: 'patrouille', label: 'Patrouille laufen (Weg im Level-Editor)' },
            { value: 'letzte-position', label: 'Zur letzten bekannten Position' },
            { value: 'licht', label: 'Zum Licht gehen' },
          ]}
          onChange={(idle) => update({ idle })}
        />
        <Toggle label="Abstand halten" hint="Sonst kürzester Weg zum Ziel" checked={b.keepDistance.on} onChange={(on) => update({ keepDistance: { ...b.keepDistance, on } })} />
        {b.keepDistance.on && <Stepper value={b.keepDistance.distance} min={1} onChange={(distance) => update({ keepDistance: { ...b.keepDistance, distance } })} />}
      </section>

      <KindList<BehaviorRule & { kind: 'regel' }>
        title="Regeln"
        hint="Von oben nach unten: die erste passende Regel wird ausgeführt, dann geht es von vorn los, bis nichts mehr möglich ist. Reaktionen nur über Regeln mit „Als Reaktion“. Ein Verhaltens-Effekt (z. B. Flucht) ersetzt die Regeln."
        items={b.rules.map((r) => ({ ...r, kind: 'regel' as const }))}
        kinds={[{ kind: 'regel', label: 'Regel', create: () => ({ kind: 'regel', zug: true, reaktion: false, conditions: [], abilityId: null, target: { kind: 'hauptziel' } }) }]}
        addLabel="Regel"
        numbered
        onChange={(rules) => update({ rules: rules.map(({ kind: _k, ...r }) => r) })}
        render={(r, setR) => <RuleCard rule={r} set={(n) => setR({ ...n, kind: 'regel' })} />}
      />

      <KindList<CharacterEvent & { kind: 'event' }>
        title="Eigene Events"
        hint="Wie Ressourcen-Events, gelten aber nur für diesen Gegner (z. B. „LP fällt auf 0 → erhält Effekt Flucht“)."
        items={b.events.map((e) => ({ ...e, kind: 'event' as const }))}
        kinds={[{ kind: 'event', label: 'Event', create: () => ({ kind: 'event', resourceId: null, direction: 'faellt', threshold: 0, action: { kind: 'zerstoert' } }) }]}
        addLabel="Event"
        numbered
        onChange={(events) => update({ events: events.map(({ kind: _k, ...e }) => e) })}
        render={(e, setE) => <EventFields ev={e} set={(n) => setE({ ...n, kind: 'event' })} />}
      />

      <section className="card fields">
        <h2>Beute</h2>
        <p className="muted small">Landet auf dem Feld des Gegners.</p>
        <Choice<Behavior['loot']['when']>
          value={b.loot.when}
          options={[{ value: 'zerstoert', label: 'Bei Zerstörung' }, { value: 'flucht', label: 'Bei Flucht' }, { value: 'beides', label: 'Beides' }]}
          onChange={(when) => update({ loot: { ...b.loot, when } })}
        />
        {loot.map((it, i) => (
          <div key={i} className="ability-row">
            <RefSelect collection="objekte" value={it.objectId} emptyLabel="– Gegenstand –" onChange={(objectId) => update({ loot: { ...b.loot, items: loot.map((x, j) => (j === i ? { ...x, objectId } : x)) } })} />
            <Stepper value={it.count} min={1} onChange={(count) => update({ loot: { ...b.loot, items: loot.map((x, j) => (j === i ? { ...x, count } : x)) } })} />
            <button className="icon-btn" aria-label="Entfernen" onClick={() => update({ loot: { ...b.loot, items: loot.filter((_, j) => j !== i) } })}>✕</button>
          </div>
        ))}
        <button className="btn btn-small" onClick={() => update({ loot: { ...b.loot, items: [...loot, { objectId: null, count: 1 }] } })}>+ Gegenstand</button>
      </section>
    </>
  );
}
