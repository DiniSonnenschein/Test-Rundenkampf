import type { Entry } from '../../data/model';
import {
  normalizeAbility, type AbilityBlock, type AbilityCondition, type AbilityFields, type AbilityTrigger, type Cost, type CostIncrease,
  type FinalObstacleBehavior, type LegalTargets, type ObstacleBehavior, type Targeting,
} from '../../engine/abilities';
import type { EntityKind } from '../../engine/effects';
import { FACING_LABELS, type Facing } from '../../engine/facing';
import { AreaPicker } from '../../ui/AreaPicker';
import { ColorWheel } from '../../ui/ColorWheel';
import { Choice, RefSelect, Stepper, Toggle } from '../../ui/fields';
import { MultiRefPicker, SelectionPicker, TypePicker } from '../../ui/pickers';
import { ShapePicker } from '../../ui/shapes';
import {
  ALL, CONDITIONS, ConditionFields, ENTITY_COLLECTION, KindList, TYPE_LIST,
} from './EffectEditor';
import type { EditorProps } from './index';
import { DurationPicker, Select } from './shared';

const TA = 'typen-aktionen';
const TC = 'typen-charaktere';
const TO = 'typen-objekte';

// ---------- Auslöser ----------

const TRIGGERS: { kind: AbilityTrigger['kind']; label: string; create: () => AbilityTrigger }[] = [
  ...CONDITIONS,
  { kind: 'nahe-ziel', label: 'Charakter in der Nähe wird Ziel einer Fähigkeit', create: () => ({ kind: 'nahe-ziel', entity: 'ally', area: [], typeIds: [] }) },
  { kind: 'nahe-verwendet', label: 'Charakter in der Nähe verwendet eine Fähigkeit', create: () => ({ kind: 'nahe-verwendet', entity: 'gegner', area: [], typeIds: [] }) },
];

function TriggerFields({ trigger: t, set }: { trigger: AbilityTrigger; set: (t: AbilityTrigger) => void }) {
  if (t.kind !== 'nahe-ziel' && t.kind !== 'nahe-verwendet') return <ConditionFields cond={t} set={set} />;
  return (
    <>
      <Choice<'ally' | 'gegner'>
        value={t.entity}
        options={[{ value: 'ally', label: 'Ally' }, { value: 'gegner', label: 'Gegner' }]}
        onChange={(entity) => set({ ...t, entity })}
      />
      <span className="field-label">Fähigkeit bestimmter Typen (leer = beliebig)</span>
      <TypePicker list={TA} value={t.typeIds} onChange={(typeIds) => set({ ...t, typeIds })} />
      <span className="field-label">In der Nähe (vom Anwender aus)</span>
      <AreaPicker value={t.area} onChange={(area) => set({ ...t, area })} />
    </>
  );
}

// ---------- Zielwahl ----------

function LegalTargetsFields({ legal, set }: { legal: LegalTargets; set: (l: LegalTargets) => void }) {
  return (
    <>
      <Toggle label="Allys" checked={legal.allys.on} onChange={(on) => set({ ...legal, allys: { ...legal.allys, on } })} />
      {legal.allys.on && (
        <div className="indent">
          <span className="field-label">Nur bestimmte Typen (leer = alle)</span>
          <TypePicker list={TC} value={legal.allys.typeIds} onChange={(typeIds) => set({ ...legal, allys: { ...legal.allys, typeIds } })} />
          <span className="field-label">Nur mit bestimmtem Effekt (leer = egal)</span>
          <MultiRefPicker collection="effekte" addLabel="Effekt" value={legal.allys.effectIds} onChange={(effectIds) => set({ ...legal, allys: { ...legal.allys, effectIds } })} />
        </div>
      )}
      <Toggle label="Gegner" checked={legal.gegner.on} onChange={(on) => set({ ...legal, gegner: { ...legal.gegner, on } })} />
      {legal.gegner.on && (
        <div className="indent">
          <span className="field-label">Nur bestimmte Typen (leer = alle)</span>
          <TypePicker list={TC} value={legal.gegner.typeIds} onChange={(typeIds) => set({ ...legal, gegner: { ...legal.gegner, typeIds } })} />
          <span className="field-label">Nur mit bestimmtem Effekt (leer = egal)</span>
          <MultiRefPicker collection="effekte" addLabel="Effekt" value={legal.gegner.effectIds} onChange={(effectIds) => set({ ...legal, gegner: { ...legal.gegner, effectIds } })} />
        </div>
      )}
      <Toggle label="Objekte" checked={legal.objekte.on} onChange={(on) => set({ ...legal, objekte: { ...legal.objekte, on } })} />
      {legal.objekte.on && (
        <div className="indent">
          <span className="field-label">Nur bestimmte Objekte bzw. Typen (leer = alle)</span>
          <MultiRefPicker collection="objekte" addLabel="Objekt" value={legal.objekte.ids} onChange={(ids) => set({ ...legal, objekte: { ...legal.objekte, ids } })} />
          <TypePicker list={TO} value={legal.objekte.typeIds} onChange={(typeIds) => set({ ...legal, objekte: { ...legal.objekte, typeIds } })} />
        </div>
      )}
      <Toggle label="Geländearten" checked={legal.gelaende.on} onChange={(on) => set({ ...legal, gelaende: { ...legal.gelaende, on } })} />
      {legal.gelaende.on && (
        <div className="indent">
          <span className="field-label">Nur bestimmte (leer = alle)</span>
          <MultiRefPicker collection="gelaende" addLabel="Geländeart" value={legal.gelaende.ids} onChange={(ids) => set({ ...legal, gelaende: { ...legal.gelaende, ids } })} />
        </div>
      )}
      <Toggle label="Leere Felder" checked={legal.leer} onChange={(leer) => set({ ...legal, leer })} />
      <Toggle label="Charaktere, die gerade eine Fähigkeit ausführen" checked={legal.ausfuehrend.on} onChange={(on) => set({ ...legal, ausfuehrend: { ...legal.ausfuehrend, on } })} />
      {legal.ausfuehrend.on && (
        <div className="indent">
          <TypePicker list={TA} value={legal.ausfuehrend.typeIds} onChange={(typeIds) => set({ ...legal, ausfuehrend: { ...legal.ausfuehrend, typeIds } })} />
        </div>
      )}
      <Toggle label="Charaktere, die gerade Ziel einer Fähigkeit werden" checked={legal.anvisiert.on} onChange={(on) => set({ ...legal, anvisiert: { ...legal.anvisiert, on } })} />
      {legal.anvisiert.on && (
        <div className="indent">
          <TypePicker list={TA} value={legal.anvisiert.typeIds} onChange={(typeIds) => set({ ...legal, anvisiert: { ...legal.anvisiert, typeIds } })} />
        </div>
      )}
    </>
  );
}

const OBSTACLE_OPTIONS: { value: ObstacleBehavior; label: string }[] = [
  { value: 'abbruch', label: 'Fähigkeit bricht ab' },
  { value: 'abbruch-ziel', label: 'Bricht nur für dieses Ziel ab' },
  { value: 'hindernis', label: 'Hindernis-Feld wird zum Ziel' },
  { value: 'davor', label: 'Feld vor dem Hindernis wird zum Ziel' },
  { value: 'beide', label: 'Trifft Hindernis(-Feld davor) und Ziel' },
  { value: 'abprallen', label: 'Prallt ab' },
];

function TargetingCard({ t, set }: { t: Targeting; set: (t: Targeting) => void }) {
  return (
    <section className="card fields">
      <h2>Zielwahl</h2>
      <Choice<Targeting['kind']>
        value={t.kind}
        options={[{ value: 'ziel', label: 'Ziel' }, { value: 'zufall', label: 'Zufall' }, { value: 'aoe', label: 'AOE' }]}
        onChange={(kind) => set({ ...t, kind })}
      />
      <p className="muted small">
        {t.kind === 'ziel' && 'Die Ziele werden selbst gewählt. Jedes Ziel kann nur einmal gewählt werden.'}
        {t.kind === 'zufall' && 'Die Ziele werden zufällig unter den legalen Zielen in Reichweite gewählt (nach „Rückgängig“ neu ausgewürfelt).'}
        {t.kind === 'aoe' && 'Betrifft automatisch alle legalen Felder innerhalb der Reichweite.'}
      </p>
      {t.kind !== 'aoe' && (
        <>
          <label className="field-label">Mindestens Ziele</label>
          <Stepper value={t.minTargets} min={1} max={t.maxTargets} onChange={(minTargets) => set({ ...t, minTargets })} />
          <label className="field-label">Höchstens Ziele</label>
          <Stepper value={t.maxTargets} min={t.minTargets} onChange={(maxTargets) => set({ ...t, maxTargets })} />
        </>
      )}
      {t.kind === 'zufall' && (
        <Toggle label="Auch illegale Ziele möglich" checked={t.includeIllegal} onChange={(includeIllegal) => set({ ...t, includeIllegal })} />
      )}

      <h3>Legale Ziele</h3>
      <p className="muted small">Anvisiert werden können nur sichtbare Ziele; AOE trifft alle.</p>
      <LegalTargetsFields legal={t.legal} set={(legal) => set({ ...t, legal })} />

      <h3>Reichweite</h3>
      <p className="muted small">
        Vom Anwender aus, dreht mit seiner Blickrichtung. Ist das mittlere Feld markiert, kann er sich selbst wählen. Felder hinter
        Hindernissen sind immer wählbar.
      </p>
      <AreaPicker value={t.range} onChange={(range) => set({ ...t, range })} />
      <Toggle label="Trifft auch hinter Hindernissen" checked={t.ignoresObstacles} onChange={(ignoresObstacles) => set({ ...t, ignoresObstacles })} />
      {!t.ignoresObstacles && (
        <>
          <label className="field-label">Steht ein Hindernis im Weg</label>
          <Select<ObstacleBehavior> value={t.obstacle.behavior} options={OBSTACLE_OPTIONS} onChange={(behavior) => set({ ...t, obstacle: { ...t.obstacle, behavior } })} />
          {t.obstacle.behavior === 'abprallen' && (
            <>
              <label className="field-label">Höchstens Abpraller</label>
              <Stepper value={t.obstacle.maxBounces} min={1} onChange={(maxBounces) => set({ ...t, obstacle: { ...t.obstacle, maxBounces } })} />
              <label className="field-label">Beim letzten Hindernis</label>
              <Select<FinalObstacleBehavior>
                value={t.obstacle.final}
                options={OBSTACLE_OPTIONS.filter((o): o is { value: FinalObstacleBehavior; label: string } => o.value !== 'abprallen')}
                onChange={(final) => set({ ...t, obstacle: { ...t.obstacle, final } })}
              />
              <p className="muted small">Fliegt die Fähigkeit aus dem Spielfeld, verschwindet sie.</p>
            </>
          )}
        </>
      )}

      <h3>Radius</h3>
      <p className="muted small">
        Bereich um jedes Ziel (immer mit Blick nach oben). Legale Ziele darin werden getroffen, gelten aber nicht als Ziele (wie AOE). Leer =
        kein Radius.
      </p>
      <AreaPicker value={t.radius} onChange={(radius) => set({ ...t, radius })} />
      {t.radius.length > 0 && (
        <Toggle label="Radius ignoriert Hindernisse" checked={t.radiusIgnoresObstacles} onChange={(radiusIgnoresObstacles) => set({ ...t, radiusIgnoresObstacles })} />
      )}
    </section>
  );
}

// ---------- Bedingungen & Kosten ----------

export const CONDITION_KINDS: { kind: AbilityCondition['kind']; label: string; create: () => AbilityCondition }[] = [
  { kind: 'gegenstand', label: 'Trägt bestimmten Gegenstand', create: () => ({ kind: 'gegenstand', objectId: null }) },
  { kind: 'ressource', label: 'Ressource mindestens/höchstens', create: () => ({ kind: 'ressource', resourceId: null, bound: 'min', value: 1 }) },
  { kind: 'in-bereich', label: 'Etwas befindet sich in einem Bereich', create: () => ({ kind: 'in-bereich', entity: 'gegner', selection: { ...ALL }, area: [] }) },
];

export function ConditionKindFields({ c, set }: { c: AbilityCondition; set: (c: AbilityCondition) => void }) {
  switch (c.kind) {
    case 'gegenstand':
      return <RefSelect collection="objekte" value={c.objectId} emptyLabel="– Gegenstand wählen –" onChange={(objectId) => set({ ...c, objectId })} />;
    case 'ressource':
      return (
        <>
          <RefSelect collection="ressourcen" value={c.resourceId} emptyLabel="– Ressource wählen –" onChange={(resourceId) => set({ ...c, resourceId })} />
          <Choice<'min' | 'max'> value={c.bound} options={[{ value: 'min', label: 'Mindestens' }, { value: 'max', label: 'Höchstens' }]} onChange={(bound) => set({ ...c, bound })} />
          <Stepper value={c.value} min={0} onChange={(value) => set({ ...c, value })} />
        </>
      );
    case 'in-bereich':
      return (
        <>
          <Select<EntityKind | 'gelaende'>
            value={c.entity}
            options={[
              { value: 'ally', label: 'Ally' },
              { value: 'gegner', label: 'Gegner' },
              { value: 'objekt', label: 'Objekt' },
              { value: 'gelaende', label: 'Geländeart' },
            ]}
            onChange={(entity) => set({ ...c, entity, selection: { ...ALL } })}
          />
          <SelectionPicker value={c.selection} collection={ENTITY_COLLECTION[c.entity]} typeList={TYPE_LIST[c.entity]} allLabel="Beliebige" onChange={(selection) => set({ ...c, selection })} />
          <span className="field-label">Bereich (vom Anwender aus)</span>
          <AreaPicker value={c.area} onChange={(area) => set({ ...c, area })} />
        </>
      );
  }
}

function CostFields({ c, set }: { c: Cost; set: (c: Cost) => void }) {
  if (c.kind === 'ressource') {
    return (
      <>
        <RefSelect collection="ressourcen" value={c.resourceId} emptyLabel="– Ressource wählen –" onChange={(resourceId) => set({ ...c, resourceId })} />
        <Stepper value={c.amount} min={0} onChange={(amount) => set({ ...c, amount })} />
      </>
    );
  }
  return (
    <>
      <span className="field-label">Verbraucht (bestimmte Objekte oder Typen)</span>
      <MultiRefPicker collection="objekte" addLabel="Objekt" value={c.selection.ids} onChange={(ids) => set({ ...c, selection: { ...c.selection, all: false, ids } })} />
      <TypePicker list={TO} value={c.selection.typeIds} onChange={(typeIds) => set({ ...c, selection: { ...c.selection, all: false, typeIds } })} />
      <label className="field-label">Anzahl</label>
      <Stepper value={c.count} min={1} onChange={(count) => set({ ...c, count })} />
    </>
  );
}

const COST_KINDS: { kind: Cost['kind']; label: string; create: () => Cost }[] = [
  { kind: 'ressource', label: 'Ressource', create: () => ({ kind: 'ressource', resourceId: null, amount: 1 }) },
  { kind: 'objekt', label: 'Objekt verbrauchen', create: () => ({ kind: 'objekt', selection: { all: false, ids: [], typeIds: [] }, count: 1 }) },
];

/** Kompakte Kosten-Liste innerhalb eines Bausteins. */
function InlineCosts({ costs, set }: { costs: Cost[]; set: (c: Cost[]) => void }) {
  return (
    <div className="inline-costs">
      <span className="field-label">Zusatzkosten dieses Bausteins</span>
      {costs.map((c, i) => (
        <div key={i} className="sub-card">
          <div className="sub-card-head">
            <span className="field-label">{COST_KINDS.find((k) => k.kind === c.kind)!.label}</span>
            <button className="icon-btn" aria-label="Entfernen" onClick={() => set(costs.filter((_, j) => j !== i))}>✕</button>
          </div>
          <CostFields c={c} set={(n) => set(costs.map((x, j) => (j === i ? n : x)))} />
        </div>
      ))}
      <div className="btn-row">
        {COST_KINDS.map((k) => (
          <button key={k.kind} className="btn btn-small" onClick={() => set([...costs, k.create()])}>+ {k.label}</button>
        ))}
      </div>
    </div>
  );
}

// ---------- Bausteine ----------

const BLOCKS: { kind: AbilityBlock['kind']; label: string; create: () => AbilityBlock }[] = [
  { kind: 'ressource', label: 'Ressource der Ziele verändern', create: () => ({ kind: 'ressource', resourceId: null, amount: -1, mayExceedMax: false, extraCosts: [] }) },
  { kind: 'effekt', label: 'Effekt auslösen/beenden', create: () => ({ kind: 'effekt', action: 'ausloesen', effectId: null, typeIds: [], duration: { kind: 'runden', rounds: 1 }, extraCosts: [] }) },
  { kind: 'faehigkeit', label: 'Fähigkeit auslösen/unterbrechen', create: () => ({ kind: 'faehigkeit', action: 'ausloesen', abilityId: null, typeIds: [], extraCosts: [] }) },
  { kind: 'schutz', label: 'Einmaliger Schutz', create: () => ({ kind: 'schutz', against: 'faehigkeit', from: 'alle', typeIds: [], duration: { kind: 'bis-aufloesung' }, extraCosts: [] }) },
  { kind: 'ziel-bewegen', label: 'Ziel bewegen', create: () => ({ kind: 'ziel-bewegen', mode: 'weg', area: [], distance: 1, ignoresObstacles: false, extraCosts: [] }) },
  { kind: 'anwender-bewegen', label: 'Anwender bewegen', create: () => ({ kind: 'anwender-bewegen', area: [], ignoresObstacles: false, extraCosts: [] }) },
  { kind: 'gelaende', label: 'Feld in Geländeart umwandeln', create: () => ({ kind: 'gelaende', terrainId: null, extraCosts: [] }) },
  { kind: 'zerstoeren', label: 'Ziel zerstören', create: () => ({ kind: 'zerstoeren', extraCosts: [] }) },
  { kind: 'ersetzen', label: 'Ziel ersetzen', create: () => ({ kind: 'ersetzen', into: { kind: 'objekt', id: null }, extraCosts: [] }) },
  { kind: 'sammeln', label: 'Sammeln (in den Rucksack)', create: () => ({ kind: 'sammeln', extraCosts: [] }) },
  { kind: 'tragen', label: 'Tragen', create: () => ({ kind: 'tragen', extraCosts: [] }) },
  { kind: 'platzieren', label: 'Platzieren', create: () => ({ kind: 'platzieren', what: 'getragenes', selection: { ...ALL }, area: [], ignoresObstacles: false, extraCosts: [] }) },
  { kind: 'objekt-verwenden', label: 'Objekt verwenden', create: () => ({ kind: 'objekt-verwenden', selection: { ...ALL }, extraCosts: [] }) },
  { kind: 'objekt-geben', label: 'Objekt geben', create: () => ({ kind: 'objekt-geben', selection: { ...ALL }, extraCosts: [] }) },
  { kind: 'objekt-werfen', label: 'Objekt werfen', create: () => ({ kind: 'objekt-werfen', selection: { ...ALL }, extraCosts: [] }) },
  {
    kind: 'aufdecken', label: 'Verborgenes aufdecken',
    create: () => ({ kind: 'aufdecken', objekte: { on: true, typeIds: [] }, gegner: { on: true, typeIds: [] }, showRange: true, extraCosts: [] }),
  },
  { kind: 'blickrichtung', label: 'Blickrichtung ändern', create: () => ({ kind: 'blickrichtung', who: 'ziel', mode: 'zu', direction: 'n', extraCosts: [] }) },
];

function BlockFields({ b, set }: { b: AbilityBlock; set: (b: AbilityBlock) => void }) {
  switch (b.kind) {
    case 'ressource':
      return (
        <>
          <RefSelect collection="ressourcen" value={b.resourceId} emptyLabel="– Ressource wählen –" onChange={(resourceId) => set({ ...b, resourceId })} />
          <Stepper value={b.amount} signed onChange={(amount) => set({ ...b, amount })} />
          <Toggle label="Darf das Maximum überschreiten" checked={b.mayExceedMax} onChange={(mayExceedMax) => set({ ...b, mayExceedMax })} />
        </>
      );
    case 'effekt':
      return (
        <>
          <Choice<'ausloesen' | 'beenden'> value={b.action} options={[{ value: 'ausloesen', label: 'Auslösen' }, { value: 'beenden', label: 'Beenden' }]} onChange={(action) => set({ ...b, action })} />
          <RefSelect collection="effekte" value={b.effectId} emptyLabel={b.action === 'beenden' ? '– Effekt (oder Typen unten) –' : '– Effekt wählen –'} onChange={(effectId) => set({ ...b, effectId })} />
          {b.action === 'beenden' ? (
            <>
              <span className="field-label">Oder alle Effekte dieser Typen</span>
              <TypePicker list={TA} value={b.typeIds} onChange={(typeIds) => set({ ...b, typeIds })} />
            </>
          ) : (
            <DurationPicker value={b.duration} onChange={(duration) => set({ ...b, duration })} />
          )}
          <p className="muted small">Ist kein passender Effekt vorhanden, passiert nichts.</p>
        </>
      );
    case 'faehigkeit':
      return (
        <>
          <Choice<'ausloesen' | 'unterbrechen'>
            value={b.action}
            options={[{ value: 'ausloesen', label: 'Auslösen' }, { value: 'unterbrechen', label: 'Unterbrechen' }]}
            onChange={(action) => set({ ...b, action })}
          />
          <RefSelect collection="faehigkeiten" value={b.abilityId} emptyLabel="– Fähigkeit (oder Typen unten) –" onChange={(abilityId) => set({ ...b, abilityId })} />
          <span className="field-label">Oder Fähigkeiten dieser Typen</span>
          <TypePicker list={TA} value={b.typeIds} onChange={(typeIds) => set({ ...b, typeIds })} />
          <p className="muted small">
            {b.action === 'ausloesen' ? 'Das Ziel führt die Fähigkeit aus, sofern es sie hat.' : 'Bricht eine Fähigkeit ab, die das Ziel gerade ausführt.'}
          </p>
        </>
      );
    case 'schutz':
      return (
        <>
          <span className="field-label">Schützt einmalig vor der nächsten eingehenden</span>
          <Choice<typeof b.against>
            value={b.against}
            options={[{ value: 'faehigkeit', label: 'Fähigkeit' }, { value: 'effekt', label: 'Effekt' }, { value: 'ressource', label: 'Ressourcen-Änderung' }]}
            onChange={(against) => set({ ...b, against })}
          />
          <Select<typeof b.from>
            value={b.from}
            options={[
              { value: 'alle', label: 'Von beliebiger Quelle' },
              { value: 'gegner', label: 'Von Gegnern' },
              { value: 'allys', label: 'Von Allys' },
              { value: 'typen', label: 'Bestimmter Typen' },
            ]}
            onChange={(from) => set({ ...b, from })}
          />
          {b.from === 'typen' && <TypePicker list={TA} value={b.typeIds} onChange={(typeIds) => set({ ...b, typeIds })} />}
          <DurationPicker value={b.duration} onChange={(duration) => set({ ...b, duration })} />
        </>
      );
    case 'ziel-bewegen':
      return (
        <>
          <Choice<typeof b.mode>
            value={b.mode}
            options={[{ value: 'richtung', label: 'In Richtung' }, { value: 'weg', label: 'Vom Anwender weg' }, { value: 'hin', label: 'Zum Anwender hin' }]}
            onChange={(mode) => set({ ...b, mode })}
          />
          {b.mode === 'richtung' ? (
            <>
              <span className="field-label">Mögliche Zielfelder (vom Ziel aus, oben = Norden)</span>
              <AreaPicker value={b.area} onChange={(area) => set({ ...b, area })} />
            </>
          ) : (
            <>
              <label className="field-label">Um Felder</label>
              <Stepper value={b.distance} min={1} onChange={(distance) => set({ ...b, distance })} />
            </>
          )}
          <Toggle label="Hindernisse ignorieren" hint="Sonst stoppt die Bewegung am Hindernis" checked={b.ignoresObstacles} onChange={(ignoresObstacles) => set({ ...b, ignoresObstacles })} />
        </>
      );
    case 'anwender-bewegen': {
      const mode = b.mode ?? 'feld';
      return (
        <>
          <Choice<'feld' | 'hin' | 'weg'>
            value={mode}
            options={[{ value: 'feld', label: 'Auf ein Feld' }, { value: 'hin', label: 'In Richtung Ziel' }, { value: 'weg', label: 'Vom Ziel weg' }]}
            onChange={(m) => set({ ...b, mode: m, distance: b.distance ?? 3, stop: b.stop ?? 'davor' })}
          />
          {mode === 'feld' ? (
            <>
              <span className="field-label">Mögliche Zielfelder (oben = Norden, unabhängig von der Blickrichtung)</span>
              <AreaPicker value={b.area} onChange={(area) => set({ ...b, area })} />
            </>
          ) : (
            <>
              <p className="muted small">
                Gerade Linie {mode === 'hin' ? 'auf das gewählte Ziel zu' : 'vom gewählten Ziel weg'}. Bei Hindernissen gilt die Einstellung oben unter
                „Hindernisse“ (z. B. Abprallen).
              </p>
              <label className="field-label">Höchstens Felder</label>
              <Stepper value={b.distance ?? 3} min={1} onChange={(distance) => set({ ...b, distance })} />
              {mode === 'hin' && (
                <>
                  <span className="field-label">Bewegung endet</span>
                  <Choice<'davor' | 'auf' | 'darueber'>
                    value={b.stop ?? 'davor'}
                    options={[{ value: 'davor', label: 'Ein Feld davor' }, { value: 'auf', label: 'Auf dem Ziel' }, { value: 'darueber', label: 'Darüber hinaus' }]}
                    onChange={(stop) => set({ ...b, stop })}
                  />
                </>
              )}
            </>
          )}
          <Toggle
            label="Hindernisse ignorieren"
            hint={b.ignoresObstacles ? (mode === 'feld' ? 'Sprung auf das Zielfeld' : 'Sprung auf das letzte freie Feld') : mode === 'feld' ? 'Läuft einen Weg ohne Blockade' : 'Hindernisse wie oben eingestellt'}
            checked={b.ignoresObstacles}
            onChange={(ignoresObstacles) => set({ ...b, ignoresObstacles })}
          />
        </>
      );
    }
    case 'gelaende':
      return (
        <>
          <RefSelect collection="gelaende" value={b.terrainId} emptyLabel="– Geländeart wählen –" onChange={(terrainId) => set({ ...b, terrainId })} />
          <p className="muted small">Gilt bis zum Ende des Levels.</p>
        </>
      );
    case 'zerstoeren':
      return <p className="muted small">Nur Objekte und Gegner: werden aus dem Level entfernt.</p>;
    case 'ersetzen':
      return (
        <>
          <p className="muted small">Nur Objekte und Gegner: werden dauerhaft in etwas anderes verwandelt (Position und Blickrichtung bleiben, Werte starten neu).</p>
          <Choice<'objekt' | 'gegner'>
            value={b.into.kind}
            options={[{ value: 'objekt', label: 'In ein Objekt' }, { value: 'gegner', label: 'In einen Gegner' }]}
            onChange={(kind) => set({ ...b, into: { kind, id: null } })}
          />
          <RefSelect collection={ENTITY_COLLECTION[b.into.kind]} value={b.into.id} emptyLabel="– auswählen –" onChange={(id) => set({ ...b, into: { ...b.into, id } })} />
        </>
      );
    case 'sammeln':
      return <p className="muted small">Das Ziel (nur Objekte) wandert in den Rucksack des Anwenders.</p>;
    case 'tragen':
      return <p className="muted small">Das Ziel (alles ist tragbar, beliebig viel) bleibt auf dem Feld des Anwenders und bewegt sich mit ihm.</p>;
    case 'platzieren':
      return (
        <>
          <Choice<typeof b.what>
            value={b.what}
            options={[{ value: 'getragenes', label: 'Getragenes' }, { value: 'rucksack', label: 'Aus dem Rucksack' }]}
            onChange={(what) => set({ ...b, what })}
          />
          {b.what === 'rucksack' && (
            <SelectionPicker value={b.selection} collection="objekte" typeList={TO} allLabel="Beliebiger Gegenstand" onChange={(selection) => set({ ...b, selection })} />
          )}
          <span className="field-label">Zielort (vom Anwender aus)</span>
          <AreaPicker value={b.area} onChange={(area) => set({ ...b, area })} />
          <Toggle label="Hindernisse ignorieren" checked={b.ignoresObstacles} onChange={(ignoresObstacles) => set({ ...b, ignoresObstacles })} />
        </>
      );
    case 'objekt-verwenden':
    case 'objekt-geben':
    case 'objekt-werfen':
      return (
        <>
          <p className="muted small">
            {b.kind === 'objekt-verwenden' && 'Der Spieler wählt ein Objekt aus dem Rucksack bzw. Getragenes; es wirkt wie im Objekt unter „Verwendung“ festgelegt.'}
            {b.kind === 'objekt-geben' && 'Das gewählte Objekt geht an das Ziel. Ist dessen Rucksack voll, trägt es das Objekt.'}
            {b.kind === 'objekt-werfen' && 'Wie weit geworfen wird, bestimmt die Reichweite dieser Fähigkeit; was beim Aufprall passiert, legt das Objekt fest.'}
          </p>
          <SelectionPicker value={b.selection} collection="objekte" typeList={TO} allLabel="Jedes passende Objekt" onChange={(selection) => set({ ...b, selection })} />
        </>
      );
    case 'aufdecken':
      return (
        <>
          <p className="muted small">
            Verborgene (durch Nebel, Effekt oder Einstellung) werden bis zum Ende des Levels mit ihrer echten Form angezeigt.
          </p>
          <Toggle label="Objekte" checked={b.objekte.on} onChange={(on) => set({ ...b, objekte: { ...b.objekte, on } })} />
          {b.objekte.on && (
            <div className="indent">
              <span className="field-label">Nur bestimmte Typen (leer = alle)</span>
              <TypePicker list={TO} value={b.objekte.typeIds} onChange={(typeIds) => set({ ...b, objekte: { ...b.objekte, typeIds } })} />
              <Toggle label="Bereich ihrer Wirkungen mit aufdecken" checked={b.showRange} onChange={(showRange) => set({ ...b, showRange })} />
            </div>
          )}
          <Toggle label="Gegner" checked={b.gegner.on} onChange={(on) => set({ ...b, gegner: { ...b.gegner, on } })} />
          {b.gegner.on && (
            <div className="indent">
              <span className="field-label">Nur bestimmte Typen (leer = alle)</span>
              <TypePicker list={TC} value={b.gegner.typeIds} onChange={(typeIds) => set({ ...b, gegner: { ...b.gegner, typeIds } })} />
            </div>
          )}
        </>
      );
    case 'blickrichtung':
      return (
        <>
          <span className="field-label">Wer dreht sich?</span>
          <Choice<typeof b.who> value={b.who} options={[{ value: 'ziel', label: 'Das Ziel' }, { value: 'anwender', label: 'Der Anwender' }]} onChange={(who) => set({ ...b, who })} />
          <Choice<typeof b.mode>
            value={b.mode}
            options={[
              { value: 'zu', label: b.who === 'ziel' ? 'Zum Anwender' : 'Zum Ziel' },
              { value: 'weg', label: b.who === 'ziel' ? 'Vom Anwender weg' : 'Vom Ziel weg' },
              { value: 'richtung', label: 'Feste Richtung' },
            ]}
            onChange={(mode) => set({ ...b, mode })}
          />
          {b.mode === 'richtung' && (
            <Choice<Facing>
              value={b.direction}
              options={(['n', 'o', 's', 'w'] as Facing[]).map((f) => ({ value: f, label: FACING_LABELS[f] }))}
              onChange={(direction) => set({ ...b, direction })}
            />
          )}
        </>
      );
  }
}

// ---------- Editor ----------

function GlowFields({ label, value, set }: { label: string; value: { on: boolean; color: string }; set: (v: { on: boolean; color: string }) => void }) {
  return (
    <>
      <Toggle label={label} checked={value.on} onChange={(on) => set({ ...value, on })} />
      {value.on && <ColorWheel value={value.color} onChange={(color) => set({ ...value, color })} />}
    </>
  );
}

/** Bausteine-Liste (auch für Objekt-Wirkungen). */
export function AbilityBlocksList({ blocks, onChange, hint }: { blocks: AbilityBlock[]; onChange: (b: AbilityBlock[]) => void; hint?: string }) {
  return (
    <KindList<AbilityBlock>
      title="Bausteine"
      hint={hint ?? 'Wirken auf jedes Ziel (und alles im Radius). Zusatzkosten eines Bausteins werden zu den Grundkosten addiert.'}
      items={blocks}
      kinds={BLOCKS}
      addLabel="Baustein"
      onChange={onChange}
      render={(b, setB) => (
        <>
          <BlockFields b={b} set={setB} />
          <InlineCosts costs={b.extraCosts} set={(extraCosts) => setB({ ...b, extraCosts })} />
        </>
      )}
    />
  );
}

export function AbilityEditor({ entry, set, variant = 'faehigkeit' }: EditorProps & { variant?: 'faehigkeit' | 'objekt' }) {
  const a = normalizeAbility(entry);
  const isAbility = variant === 'faehigkeit';
  const update = (patch: Partial<AbilityFields>) => set({ ...a, ...patch } as unknown as Partial<Entry>);
  const d = a.display;

  return (
    <>
      {isAbility && (
        <section className="card fields">
          <h2>Einsatz</h2>
          <Choice<'wahl' | 'zwang'>
            value={a.mode}
            options={[{ value: 'wahl', label: 'Wahl-Fähigkeit' }, { value: 'zwang', label: 'Zwang-Fähigkeit' }]}
            onChange={(mode) => update({ mode })}
          />
          <p className="muted small">
            {a.mode === 'wahl'
              ? 'Wird als Möglichkeit angezeigt, sobald sie einsetzbar ist; man kann sich dafür oder dagegen entscheiden.'
              : 'Muss eingesetzt werden, sobald sie einsetzbar ist; nur die Ziele dürfen noch gewählt werden.'}
          </p>
          <span className="field-label">Typen</span>
          <TypePicker list={TA} value={a.typeIds} onChange={(typeIds) => update({ typeIds })} />
        </section>
      )}

      <section className="card fields">
        <h2>Darstellung</h2>
        <Toggle label="Objekt fliegt zum Ziel" checked={d.projectile.on} onChange={(on) => update({ display: { ...d, projectile: { ...d.projectile, on } } })} />
        {d.projectile.on && (
          <>
            <ShapePicker
              value={d.projectile.shape}
              color={d.projectile.color}
              onChange={(shape) => update({ display: { ...d, projectile: { ...d.projectile, shape } } })}
            />
            <ColorWheel value={d.projectile.color} onChange={(color) => update({ display: { ...d, projectile: { ...d.projectile, color } } })} />
          </>
        )}
        <GlowFields label="Anwender leuchtet kurz" value={d.casterGlow} set={(casterGlow) => update({ display: { ...d, casterGlow } })} />
        <GlowFields label="Ziele leuchten kurz" value={d.targetGlow} set={(targetGlow) => update({ display: { ...d, targetGlow } })} />
      </section>

      {isAbility && (
        <KindList<AbilityTrigger>
          title="Auslöser"
          hint="Optional. Ausgelöste Fähigkeiten laufen als Reaktion (ohne Aktionsplatz). Ziele wählt weiterhin der Spieler; Wahl-Fähigkeiten können abgelehnt werden."
          items={a.triggers}
          kinds={TRIGGERS}
          addLabel="Auslöser"
          onChange={(triggers) => update({ triggers })}
          render={(t, setT) => <TriggerFields trigger={t} set={setT} />}
        />
      )}

      <TargetingCard t={a.targeting} set={(targeting) => update({ targeting })} />

      <KindList<AbilityCondition>
        title="Bedingungen"
        hint="Alle Bedingungen müssen erfüllt sein. Bereiche werden vom Anwender aus gemessen."
        items={a.conditions}
        kinds={CONDITION_KINDS}
        addLabel="Bedingung"
        onChange={(conditions) => update({ conditions })}
        render={(c, setC) => <ConditionKindFields c={c} set={setC} />}
      />

      <KindList<Cost>
        title="Kosten"
        hint="Können die Kosten nicht bezahlt werden, kann die Fähigkeit nicht gewirkt werden."
        items={a.costs}
        kinds={COST_KINDS}
        addLabel="Kosten"
        onChange={(costs) => update({ costs })}
        render={(c, setC) => <CostFields c={c} set={setC} />}
      />

      <section className="card fields">
        <h2>Kostensteigerung</h2>
        <p className="muted small">Zusätzliche Ziele bzw. weiter entfernte Ziele sind nur wählbar, wenn die Mehrkosten bezahlt werden können.</p>
        {a.costIncreases.map((inc, i) => {
          const setInc = (n: CostIncrease) => update({ costIncreases: a.costIncreases.map((x, j) => (j === i ? n : x)) });
          return (
            <div key={i} className="sub-card">
              <div className="sub-card-head">
                <span className="field-label">Steigerung {i + 1}</span>
                <button className="icon-btn" aria-label="Entfernen" onClick={() => update({ costIncreases: a.costIncreases.filter((_, j) => j !== i) })}>✕</button>
              </div>
              <Choice<CostIncrease['per']>
                value={inc.per}
                options={[{ value: 'ziel', label: 'Pro zusätzlichem Ziel' }, { value: 'entfernung', label: 'Pro Feld Entfernung' }]}
                onChange={(per) => setInc({ ...inc, per })}
              />
              <RefSelect collection="ressourcen" value={inc.resourceId} emptyLabel="– Ressource wählen –" onChange={(resourceId) => setInc({ ...inc, resourceId })} />
              <Stepper value={inc.amount} min={0} onChange={(amount) => setInc({ ...inc, amount })} />
            </div>
          );
        })}
        <button className="btn" onClick={() => update({ costIncreases: [...a.costIncreases, { per: 'ziel', resourceId: null, amount: 1 }] })}>+ Steigerung</button>
      </section>

      <AbilityBlocksList blocks={a.blocks} onChange={(blocks) => update({ blocks })} />
    </>
  );
}
