import type { Entry } from '../../data/model';
import {
  normalizeResource, type Adjustment, type AutoChange, type ChangeInterval, type ChangeTiming, type EffectDuration,
  type EventAction, type EventDirection, type ResourceEvent, type ResourceFields, type ResourceScope,
} from '../../engine/resources';
import { ColorWheel } from '../../ui/ColorWheel';
import { Choice, RefSelect, Stepper, Toggle } from '../../ui/fields';
import type { EditorProps } from './index';

const isGlobal = (e: Entry) => normalizeResource(e).scope === 'global';

export function ResourceEditor({ entry, set }: EditorProps) {
  const r = normalizeResource(entry);
  const update = (fn: (r: ResourceFields) => ResourceFields | void) => {
    const copy = structuredClone(r);
    set({ ...(fn(copy) ?? copy) });
  };
  const global = r.scope === 'global';

  return (
    <>
      {entry.fixed && (
        <section className="card small muted">
          <strong>Feste Ressource.</strong> Der Wert jedes Charakters bestimmt seine Position in der Initiative-Reihe (höchster zuerst).
          Änderungen während eines Levels wirken erst ab dem nächsten Level. Kann bearbeitet, aber nicht gelöscht werden.
        </section>
      )}

      <section className="card fields">
        <h2>Art</h2>
        {entry.fixed ? (
          <p className="muted small">Individuell (an den Charakter gebunden)</p>
        ) : (
          <Choice<ResourceScope>
            value={r.scope}
            options={[{ value: 'individuell', label: 'Individuell' }, { value: 'global', label: 'Global (Pool)' }]}
            onChange={(v) =>
              update((x) => {
                x.scope = v;
                // Folgen, die es bei der anderen Art nicht gibt, anpassen.
                x.events = x.events.map((ev) =>
                  ev.action.kind === 'effekt' ? { ...ev, action: { ...ev.action, target: v === 'global' ? 'allys' : 'selbst' } }
                  : ev.action.kind === 'ressource' ? { ...ev, action: { ...ev.action, resourceId: null } }
                  : ev,
                );
              })
            }
          />
        )}
        <p className="muted small">
          {global
            ? 'Ein gemeinsamer Pool, auf den alle Allys Zugriff haben.'
            : 'Jeder Charakter hat einen eigenen Wert. Maximum, Startwert, automatische Veränderungen und Anpassungen durch Fähigkeiten werden beim jeweiligen Charakter festgelegt.'}
        </p>
      </section>

      {global ? (
        <>
          <section className="card fields">
            <h2>Menge</h2>
            <Toggle label="Hat ein Maximum" checked={r.hasMax} onChange={(v) => update((x) => void (x.hasMax = v))} />
            {r.hasMax && <Stepper id="max" value={r.max} min={0} onChange={(v) => update((x) => void (x.max = v))} />}
            <label className="field-label" htmlFor="start">Startwert (zu Beginn des Spiels)</label>
            <Stepper id="start" value={r.start} min={0} onChange={(v) => update((x) => void (x.start = v))} />
            <p className="muted small">Minimum ist immer 0.</p>
          </section>
          <ChangesCard changes={r.changes} intervals={['runde', 'level']} onChange={(c) => update((x) => void (x.changes = c))} />
          <AdjustmentsCard adjustments={r.adjustments} onChange={(a) => update((x) => void (x.adjustments = a))} />
        </>
      ) : (
        <section className="card fields">
          <h2>Anzeige</h2>
          <Toggle
            label="Beim Antippen der Figur anzeigen"
            hint="Als Balken mit Zahl, z. B. 4/10"
            checked={r.display.show}
            onChange={(v) => update((x) => void (x.display.show = v))}
          />
          {r.display.show && (
            <>
              <div className="resource-bar-preview">
                <span className="resource-bar-label">{entry.title || 'Ressource'}</span>
                <span className="resource-bar">
                  <span style={{ width: '40%', background: r.display.color }} />
                </span>
                <span className="resource-bar-value">4/10</span>
              </div>
              <span className="field-label">Farbe</span>
              <ColorWheel value={r.display.color} onChange={(c) => update((x) => void (x.display.color = c))} />
            </>
          )}
        </section>
      )}

      <EventsCard
        events={r.events}
        global={global}
        selfId={entry.id}
        onChange={(ev) => update((x) => void (x.events = ev))}
      />
    </>
  );
}

const INTERVAL_LABELS: Record<ChangeInterval, string> = { zug: 'Pro Zug', runde: 'Pro Runde', level: 'Pro Level' };

/** Automatische Veränderungen (auch für die Charaktererstellung wiederverwendbar). */
export function ChangesCard({
  changes, intervals, onChange, embedded = false,
}: {
  changes: AutoChange[];
  intervals: ChangeInterval[];
  onChange: (c: AutoChange[]) => void;
  /** Innerhalb einer anderen Karte (kleinere Überschrift, kein eigener Rahmen). */
  embedded?: boolean;
}) {
  const edit = (i: number, patch: Partial<AutoChange>) => onChange(changes.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <section className={embedded ? 'fields embedded' : 'card fields'}>
      {embedded ? <h3>Automatische Veränderung</h3> : <h2>Automatische Veränderung</h2>}
      <p className="muted small">Erhöhungen überschreiten das Maximum nicht.</p>
      {changes.map((c, i) => (
        <div key={i} className="sub-card">
          <div className="sub-card-head">
            <span className="field-label">Veränderung {i + 1}</span>
            <button className="icon-btn" aria-label="Entfernen" onClick={() => onChange(changes.filter((_, j) => j !== i))}>✕</button>
          </div>
          <Choice<ChangeInterval> value={c.interval} options={intervals.map((v) => ({ value: v, label: INTERVAL_LABELS[v] }))} onChange={(v) => edit(i, { interval: v })} />
          <Choice<ChangeTiming>
            value={c.timing}
            options={[{ value: 'beginn', label: 'Zu Beginn' }, { value: 'ende', label: 'Am Ende' }]}
            onChange={(v) => edit(i, { timing: v })}
          />
          <Stepper value={c.amount} signed onChange={(v) => edit(i, { amount: v })} />
        </div>
      ))}
      <button className="btn" onClick={() => onChange([...changes, { interval: intervals[0], timing: 'beginn', amount: 1 }])}>
        + Veränderung
      </button>
    </section>
  );
}

/** Anpassung durch Fähigkeiten (auch für die Charaktererstellung wiederverwendbar). */
export function AdjustmentsCard({
  adjustments, onChange, embedded = false,
}: {
  adjustments: Adjustment[];
  onChange: (a: Adjustment[]) => void;
  embedded?: boolean;
}) {
  const edit = (i: number, patch: Partial<Adjustment>) => onChange(adjustments.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <section className={embedded ? 'fields embedded' : 'card fields'}>
      {embedded ? <h3>Anpassung durch Fähigkeiten</h3> : <h2>Anpassung durch Fähigkeiten</h2>}
      <p className="muted small">
        Verändert den Betrag, um den eine Fähigkeit diese Ressource verändert: −5 bei „Angriff“ wirkt wie 5 Verteidigung. Die Wirkung kippt
        nie um (endet bei 0).
      </p>
      {adjustments.map((a, i) => (
        <div key={i} className="sub-card">
          <div className="sub-card-head">
            <span className="field-label">Anpassung {i + 1}</span>
            <button className="icon-btn" aria-label="Entfernen" onClick={() => onChange(adjustments.filter((_, j) => j !== i))}>✕</button>
          </div>
          <RefSelect collection="faehigkeiten" value={a.abilityId} emptyLabel="– Fähigkeit wählen –" onChange={(id) => edit(i, { abilityId: id })} />
          <Stepper value={a.amount} signed onChange={(v) => edit(i, { amount: v })} />
        </div>
      ))}
      <button className="btn" onClick={() => onChange([...adjustments, { abilityId: null, category: null, amount: -1 }])}>
        + Anpassung
      </button>
    </section>
  );
}

type ActionKind = EventAction['kind'] | 'effekt-gegner';

function actionKind(a: EventAction): ActionKind {
  return a.kind === 'effekt' && a.target === 'gegner' ? 'effekt-gegner' : a.kind;
}

function newAction(kind: ActionKind, global: boolean): EventAction {
  switch (kind) {
    case 'sieg':
    case 'niederlage':
      return { kind };
    case 'effekt':
      return { kind: 'effekt', target: global ? 'allys' : 'selbst', effectId: null, duration: { kind: 'bis-aufloesung' } };
    case 'effekt-gegner':
      return { kind: 'effekt', target: 'gegner', effectId: null, duration: { kind: 'bis-aufloesung' } };
    case 'ressource':
      return { kind: 'ressource', resourceId: null, amount: -1 };
  }
}

function EventsCard({
  events, global, selfId, onChange,
}: {
  events: ResourceEvent[];
  global: boolean;
  selfId: string;
  onChange: (e: ResourceEvent[]) => void;
}) {
  const edit = (i: number, patch: Partial<ResourceEvent>) => onChange(events.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const actionOptions: { value: ActionKind; label: string }[] = global
    ? [
        { value: 'sieg', label: 'Run gewonnen' },
        { value: 'niederlage', label: 'Run verloren' },
        { value: 'effekt', label: 'Effekt auf alle Allys' },
        { value: 'effekt-gegner', label: 'Effekt auf alle Gegner' },
        { value: 'ressource', label: 'Andere globale Ressource verändern' },
      ]
    : [
        { value: 'sieg', label: 'Run gewonnen' },
        { value: 'niederlage', label: 'Run verloren' },
        { value: 'effekt', label: 'Charakter erhält Effekt' },
        { value: 'ressource', label: 'Andere Ressource des Charakters verändern' },
      ];

  return (
    <section className="card fields">
      <h2>Events</h2>
      <p className="muted small">Lösen jedes Mal aus, wenn der Wert die Grenze (erneut) erreicht bzw. überschreitet.</p>
      {events.map((ev, i) => (
        <div key={i} className="sub-card">
          <div className="sub-card-head">
            <span className="field-label">Event {i + 1}</span>
            <button className="icon-btn" aria-label="Entfernen" onClick={() => onChange(events.filter((_, j) => j !== i))}>✕</button>
          </div>
          <span className="field-label">Wenn der Wert</span>
          <Choice<EventDirection>
            value={ev.direction}
            options={[{ value: 'faellt', label: 'auf/unter … fällt' }, { value: 'steigt', label: 'auf/über … steigt' }]}
            onChange={(v) => edit(i, { direction: v })}
          />
          <Stepper value={ev.threshold} min={0} onChange={(v) => edit(i, { threshold: v })} />
          <span className="field-label">dann</span>
          <select className="input" value={actionKind(ev.action)} onChange={(e) => edit(i, { action: newAction(e.target.value as ActionKind, global) })}>
            {actionOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {ev.action.kind === 'effekt' && <EffectFields action={ev.action} onChange={(a) => edit(i, { action: a })} />}
          {ev.action.kind === 'ressource' && (
            <>
              <RefSelect
                collection="ressourcen"
                value={ev.action.resourceId}
                emptyLabel="– Ressource wählen –"
                filter={(e) => e.id !== selfId && isGlobal(e) === global}
                onChange={(id) => edit(i, { action: { ...(ev.action as Extract<EventAction, { kind: 'ressource' }>), resourceId: id } })}
              />
              <Stepper
                value={ev.action.amount}
                signed
                onChange={(v) => edit(i, { action: { ...(ev.action as Extract<EventAction, { kind: 'ressource' }>), amount: v } })}
              />
            </>
          )}
        </div>
      ))}
      <button className="btn" onClick={() => onChange([...events, { direction: 'faellt', threshold: 0, action: newAction('effekt', global) }])}>
        + Event
      </button>
    </section>
  );
}

type DurationKind = EffectDuration['kind'];

function EffectFields({
  action, onChange,
}: {
  action: Extract<EventAction, { kind: 'effekt' }>;
  onChange: (a: EventAction) => void;
}) {
  const d = action.duration;
  return (
    <>
      <RefSelect collection="effekte" value={action.effectId} emptyLabel="– Effekt wählen –" onChange={(id) => onChange({ ...action, effectId: id })} />
      <span className="field-label">Dauer</span>
      <Choice<DurationKind>
        value={d.kind}
        options={[
          { value: 'runden', label: 'Runden' },
          { value: 'unendlich', label: 'Unendlich' },
          { value: 'bis-aufloesung', label: 'Bis Auflösung' },
        ]}
        onChange={(k) => onChange({ ...action, duration: k === 'runden' ? { kind: 'runden', rounds: 1 } : { kind: k } })}
      />
      {d.kind === 'runden' && (
        <Stepper value={d.rounds} min={1} onChange={(v) => onChange({ ...action, duration: { kind: 'runden', rounds: v } })} />
      )}
    </>
  );
}
