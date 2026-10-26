// Dungeon-Editor: Stationen (Level) als Liste mit Verzweigungen und Zwischenstationen.
import { createEntry, newId, sortEntries } from '../../data/collection';
import { getDef, type Entry } from '../../data/model';
import { getCollection, saveEntry, useCollection } from '../../data/store';
import { normalizeDungeon, validateDungeon, type DungeonFields, type DungeonStation, type InterludeBlock } from '../../engine/dungeon';
import { normalizeLevel } from '../../engine/level';
import { navigate, routes } from '../../router';
import { useDialog } from '../../ui/Dialog';
import { Choice, RefSelect, Stepper, Toggle } from '../../ui/fields';
import { TypePicker } from '../../ui/pickers';
import { KindList } from './EffectEditor';
import type { EditorProps } from './index';
import { DurationPicker } from './shared';

// ---------- Zwischenstation ----------

const INTERLUDE: { kind: InterludeBlock['kind']; label: string; create: () => InterludeBlock }[] = [
  { kind: 'rast', label: 'Rast', create: () => ({ kind: 'rast', changes: [] }) },
  { kind: 'belohnung', label: 'Belohnung', create: () => ({ kind: 'belohnung', items: [], choose: { on: false, count: 1 } }) },
  { kind: 'effekte', label: 'Effekte vergeben/beenden', create: () => ({ kind: 'effekte', action: 'vergeben', effectId: null, typeIds: [], duration: { kind: 'bis-aufloesung' } }) },
  { kind: 'rucksack', label: 'Rucksäcke ordnen & tauschen', create: () => ({ kind: 'rucksack' }) },
  { kind: 'haendler', label: 'Händler', create: () => ({ kind: 'haendler', currencyId: null, typePrices: [], objectPrices: [], offers: [], selling: true }) },
  { kind: 'text', label: 'Ereignis mit Text', create: () => ({ kind: 'text', title: '', text: '' }) },
];

/** Liste mit Zeilen, „+“ und ✕ (kompakt). */
function Rows<T>({ items, onChange, create, addLabel, render }: {
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  addLabel: string;
  render: (item: T, set: (item: T) => void) => React.ReactNode;
}) {
  return (
    <>
      {items.map((it, i) => (
        <div key={i} className="ability-row wrap-row">
          {render(it, (n) => onChange(items.map((x, j) => (j === i ? n : x))))}
          <button className="icon-btn" aria-label="Entfernen" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn btn-small" onClick={() => onChange([...items, create()])}>+ {addLabel}</button>
    </>
  );
}

function PriceFields({ buy, sell, set }: { buy: number; sell: number; set: (p: { buy: number; sell: number }) => void }) {
  return (
    <div className="price-fields">
      <span className="muted small">Kauf</span>
      <Stepper value={buy} min={0} onChange={(b) => set({ buy: b, sell })} />
      <span className="muted small">Verkauf</span>
      <Stepper value={sell} min={0} onChange={(s) => set({ buy, sell: s })} />
    </div>
  );
}

function InterludeFields({ b, set }: { b: InterludeBlock; set: (b: InterludeBlock) => void }) {
  switch (b.kind) {
    case 'rast':
      return (
        <>
          <p className="muted small">Individuelle Ressourcen gelten für alle Allys, globale für den Pool.</p>
          <Rows
            items={b.changes}
            onChange={(changes) => set({ ...b, changes })}
            create={() => ({ resourceId: null, amount: 5 })}
            addLabel="Ressource"
            render={(c, setC) => (
              <>
                <RefSelect collection="ressourcen" value={c.resourceId} emptyLabel="– Ressource –" onChange={(resourceId) => setC({ ...c, resourceId })} />
                <Stepper value={c.amount} signed onChange={(amount) => setC({ ...c, amount })} />
              </>
            )}
          />
        </>
      );
    case 'belohnung':
      return (
        <>
          <p className="muted small">Der Spieler wählt, welcher Ally die Gegenstände bekommt.</p>
          <Rows
            items={b.items}
            onChange={(items) => set({ ...b, items })}
            create={() => ({ objectId: null, count: 1 })}
            addLabel="Gegenstand"
            render={(it, setIt) => (
              <>
                <RefSelect collection="objekte" value={it.objectId} emptyLabel="– Gegenstand –" onChange={(objectId) => setIt({ ...it, objectId })} />
                <Stepper value={it.count} min={1} onChange={(count) => setIt({ ...it, count })} />
              </>
            )}
          />
          <Toggle label="Auswahl: nur einige davon" checked={b.choose.on} onChange={(on) => set({ ...b, choose: { ...b.choose, on } })} />
          {b.choose.on && (
            <>
              <label className="field-label">Wähle so viele aus</label>
              <Stepper value={b.choose.count} min={1} onChange={(count) => set({ ...b, choose: { ...b.choose, count } })} />
            </>
          )}
        </>
      );
    case 'effekte':
      return (
        <>
          <Choice<'vergeben' | 'beenden'> value={b.action} options={[{ value: 'vergeben', label: 'Vergeben' }, { value: 'beenden', label: 'Beenden' }]} onChange={(action) => set({ ...b, action })} />
          <p className="muted small">Gilt für alle Allys.</p>
          <RefSelect collection="effekte" value={b.effectId} emptyLabel={b.action === 'beenden' ? '– Effekt (oder Typen unten) –' : '– Effekt wählen –'} onChange={(effectId) => set({ ...b, effectId })} />
          {b.action === 'beenden' ? (
            <TypePicker list="typen-aktionen" value={b.typeIds} onChange={(typeIds) => set({ ...b, typeIds })} />
          ) : (
            <DurationPicker value={b.duration} onChange={(duration) => set({ ...b, duration })} />
          )}
        </>
      );
    case 'rucksack':
      return <p className="muted small">Die Allys können ihre Rucksäcke ordnen und Gegenstände untereinander tauschen.</p>;
    case 'haendler':
      return (
        <>
          <label className="field-label">Bezahlt wird mit (globale Ressource)</label>
          <RefSelect
            collection="ressourcen"
            value={b.currencyId}
            emptyLabel="– Ressource wählen –"
            filter={(e) => (e as Entry & { scope?: string }).scope === 'global'}
            onChange={(currencyId) => set({ ...b, currencyId })}
          />
          <span className="field-label">Grundpreise je Objekt-Typ</span>
          <Rows
            items={b.typePrices}
            onChange={(typePrices) => set({ ...b, typePrices })}
            create={() => ({ typeId: null, buy: 5, sell: 2 })}
            addLabel="Typ-Preis"
            render={(p, setP) => (
              <>
                <RefSelect collection="typen-objekte" value={p.typeId} emptyLabel="– Typ –" onChange={(typeId) => setP({ ...p, typeId })} />
                <PriceFields buy={p.buy} sell={p.sell} set={(x) => setP({ ...p, ...x })} />
              </>
            )}
          />
          <span className="field-label">Sonderpreise je Objekt (gehen vor)</span>
          <Rows
            items={b.objectPrices}
            onChange={(objectPrices) => set({ ...b, objectPrices })}
            create={() => ({ objectId: null, buy: 5, sell: 2 })}
            addLabel="Sonderpreis"
            render={(p, setP) => (
              <>
                <RefSelect collection="objekte" value={p.objectId} emptyLabel="– Objekt –" onChange={(objectId) => setP({ ...p, objectId })} />
                <PriceFields buy={p.buy} sell={p.sell} set={(x) => setP({ ...p, ...x })} />
              </>
            )}
          />
          <span className="field-label">Angebot (Vorrat 0 = unbegrenzt)</span>
          <Rows
            items={b.offers}
            onChange={(offers) => set({ ...b, offers })}
            create={() => ({ objectId: null, stock: null })}
            addLabel="Angebot"
            render={(o, setO) => (
              <>
                <RefSelect collection="objekte" value={o.objectId} emptyLabel="– Objekt –" onChange={(objectId) => setO({ ...o, objectId })} />
                <Stepper value={o.stock ?? 0} min={0} onChange={(n) => setO({ ...o, stock: n === 0 ? null : n })} />
              </>
            )}
          />
          <Toggle label="Kauft auch an (Allys können verkaufen)" checked={b.selling} onChange={(selling) => set({ ...b, selling })} />
          {b.selling && <p className="muted small">Verkaufen kann man alles, wofür der Händler einen Preis hat.</p>}
        </>
      );
    case 'text':
      return (
        <>
          <label className="field-label">Überschrift</label>
          <input className="input" value={b.title} onChange={(e) => set({ ...b, title: e.target.value })} />
          <label className="field-label">Text</label>
          <textarea className="input" rows={4} value={b.text} onChange={(e) => set({ ...b, text: e.target.value })} />
        </>
      );
  }
}

// ---------- Stationen ----------

function StationCard({
  station: s, index, d, set, levels, onMove, onRemove,
}: {
  station: DungeonStation;
  index: number;
  d: DungeonFields;
  set: (s: DungeonStation) => void;
  levels: Entry[];
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const dialog = useDialog();
  const level = levels.find((l) => l.id === s.levelId);
  const stats = level ? normalizeLevel(level) : null;
  const name = (id: string) => d.stations.find((x) => x.id === id)?.name || 'Ohne Namen';

  async function addNext() {
    const options = d.stations.filter((x) => x.id !== s.id && !s.next.includes(x.id));
    if (!options.length) return;
    const id = await dialog.menu({ title: 'Weiter zu …', items: options.map((x) => ({ label: x.name || 'Ohne Namen', value: x.id })) });
    if (id) set({ ...s, next: [...s.next, id] });
  }

  return (
    <div className="sub-card station">
      <div className="sub-card-head">
        <span className="field-label">{index === 0 ? 'Start' : `Station ${index + 1}`}</span>
        <span>
          {index > 0 && <button className="icon-btn" aria-label="Nach oben" onClick={() => onMove(-1)}>↑</button>}
          {index < d.stations.length - 1 && <button className="icon-btn" aria-label="Nach unten" onClick={() => onMove(1)}>↓</button>}
          <button className="icon-btn" aria-label="Entfernen" onClick={onRemove}>✕</button>
        </span>
      </div>
      <input className="input" value={s.name} aria-label="Name der Station" onChange={(e) => set({ ...s, name: e.target.value })} />
      <div className="ability-row">
        <RefSelect collection="level" value={s.levelId} emptyLabel="– Level wählen –" onChange={(levelId) => set({ ...s, levelId })} />
        {level && <button className="btn btn-small station-open" onClick={() => navigate(routes.entry('level', level.id))}>Öffnen</button>}
      </div>
      {stats && (
        <p className="muted small">
          {stats.enemies.length} Gegner · {stats.objects.length} Gegenstände · {stats.width}×{stats.height}
        </p>
      )}
      <span className="field-label">Weiter zu</span>
      <div className="chips">
        {s.next.map((n) => (
          <span key={n} className="chip">
            {name(n)}
            <button aria-label="Entfernen" onClick={() => set({ ...s, next: s.next.filter((x) => x !== n) })}>✕</button>
          </span>
        ))}
        {s.next.length === 0 && <span className="muted small">Ende – Run gewonnen</span>}
      </div>
      {d.stations.length > 1 && <button className="btn btn-small" onClick={addNext}>+ Weiter zu …</button>}
      {s.next.length > 1 && <p className="muted small">Der Spieler wählt, wie es weitergeht.</p>}
      <KindList<InterludeBlock>
        title="Zwischenstation"
        hint="Optional, nach diesem Level."
        items={s.interlude}
        kinds={INTERLUDE}
        addLabel="Baustein"
        onChange={(interlude) => set({ ...s, interlude })}
        render={(b, setB) => <InterludeFields b={b} set={setB} />}
      />
    </div>
  );
}

export function DungeonEditor({ entry, set }: EditorProps) {
  const d = normalizeDungeon(entry);
  const levels = useCollection('level').entries;
  const dialog = useDialog();
  const update = (next: DungeonFields) => set(next as unknown as Partial<Entry>);
  const warnings = validateDungeon(d);

  /** Neue Station anhängen; die bisher letzte führt automatisch zu ihr, wenn sie noch ein Ende war. */
  function append(levelId: string | null, name: string) {
    const station: DungeonStation = { id: newId('station'), name, levelId, next: [], interlude: [] };
    const last = d.stations[d.stations.length - 1];
    const stations = d.stations.map((s) => (s === last && s.next.length === 0 ? { ...s, next: [station.id] } : s));
    update({ stations: [...stations, station] });
    return station;
  }

  async function add() {
    const items = [
      ...sortEntries(getCollection('level').entries).map((l) => ({ label: l.title, value: l.id })),
      { label: '+ Neues Level bauen …', value: '__neu__' },
    ];
    const picked = await dialog.menu({ title: 'Level hinzufügen', items });
    if (!picked) return;
    if (picked !== '__neu__') {
      append(picked, levels.find((l) => l.id === picked)?.title ?? '');
      return;
    }
    const level = createEntry(getDef('level')!, null);
    saveEntry('level', level);
    append(level.id, level.title);
    navigate(routes.entry('level', level.id));
  }

  function move(i: number, dir: -1 | 1) {
    const stations = [...d.stations];
    [stations[i], stations[i + dir]] = [stations[i + dir], stations[i]];
    update({ stations });
  }

  return (
    <>
      <section className="card fields">
        <h2>Prüfung</h2>
        {warnings.length ? (
          <ul className="warnings">
            {warnings.map((w) => <li key={w} className="warn">{w}</li>)}
          </ul>
        ) : (
          <p className="muted small">Alles in Ordnung.</p>
        )}
      </section>

      <section className="card fields">
        <h2>Level</h2>
        <p className="muted small">
          Die erste Station ist der Start. Stationen ohne „Weiter zu“ sind ein Ende (Run gewonnen). Wege können sich verzweigen und wieder
          zusammenführen; dasselbe Level darf mehrfach vorkommen.
        </p>
        {d.stations.map((s, i) => (
          <StationCard
            key={s.id}
            station={s}
            index={i}
            d={d}
            levels={levels}
            set={(n) => update({ stations: d.stations.map((x) => (x.id === s.id ? n : x)) })}
            onMove={(dir) => move(i, dir)}
            onRemove={() => update(normalizeDungeon({ stations: d.stations.filter((x) => x.id !== s.id) }))}
          />
        ))}
        <button className="btn btn-primary" onClick={add}>+ Level</button>
      </section>
    </>
  );
}
