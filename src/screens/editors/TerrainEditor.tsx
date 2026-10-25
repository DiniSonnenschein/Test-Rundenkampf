// Editor für Geländearten: Schachbrett-Farben, Begehbarkeit, Rutschen, Kosten, Licht, Wirkungen.
import type { Entry } from '../../data/model';
import type { ObjectWorking } from '../../engine/objects';
import { normalizeTerrain, tileColor, type TerrainFields } from '../../engine/terrain';
import { AreaPicker } from '../../ui/AreaPicker';
import { ColorWheel } from '../../ui/ColorWheel';
import { Choice, RefSelect, Stepper, Toggle } from '../../ui/fields';
import { MultiRefPicker, TypePicker } from '../../ui/pickers';
import { ShapeIcon, ShapePicker } from '../../ui/shapes';
import { KindList } from './EffectEditor';
import type { EditorProps } from './index';
import { WorkingFields } from './ObjectEditor';
import { SubCard } from './shared';

function Preview({ t }: { t: TerrainFields }) {
  const n = 5;
  return (
    <div className="terrain-preview" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
      {Array.from({ length: n * n }, (_, i) => {
        const p = { x: i % n, y: Math.floor(i / n) };
        return (
          <span key={i} style={{ background: tileColor(t, p) }}>
            {t.pattern.on && <ShapeIcon shape={t.pattern.shape} color="rgba(255,255,255,.35)" size={22} />}
          </span>
        );
      })}
    </div>
  );
}

export function TerrainEditor({ entry, set }: EditorProps) {
  const t = normalizeTerrain(entry);
  const update = (patch: Partial<TerrainFields>) => set({ ...t, ...patch } as unknown as Partial<Entry>);
  const costs = t.costIncreases;

  return (
    <>
      <section className="card fields">
        <h2>Darstellung</h2>
        <Preview t={t} />
        <span className="field-label">Helle Felder</span>
        <ColorWheel value={t.colors.light} onChange={(light) => update({ colors: { ...t.colors, light } })} />
        <span className="field-label">Dunkle Felder</span>
        <ColorWheel value={t.colors.dark} onChange={(dark) => update({ colors: { ...t.colors, dark } })} />
        <Toggle label="Symbol auf den Feldern" checked={t.pattern.on} onChange={(on) => update({ pattern: { ...t.pattern, on } })} />
        {t.pattern.on && <ShapePicker value={t.pattern.shape} color="#c9b7a6" onChange={(shape) => update({ pattern: { ...t.pattern, shape } })} />}
      </section>

      <section className="card fields">
        <h2>Eigenschaften</h2>
        <span className="field-label">Begehbar</span>
        <Choice<TerrainFields['walkable']>
          value={t.walkable}
          options={[{ value: 'ja', label: 'Ja' }, { value: 'nein', label: 'Nein' }, { value: 'bedingt', label: 'Nur für …' }]}
          onChange={(walkable) => update({ walkable })}
        />
        {t.walkable === 'bedingt' && (
          <div className="indent">
            <span className="field-label">Charaktere mit diesen Typen</span>
            <TypePicker list="typen-charaktere" value={t.walkableFor.typeIds} onChange={(typeIds) => update({ walkableFor: { ...t.walkableFor, typeIds } })} />
            <span className="field-label">oder mit diesen Effekten</span>
            <MultiRefPicker collection="effekte" addLabel="Effekt" value={t.walkableFor.effectIds} onChange={(effectIds) => update({ walkableFor: { ...t.walkableFor, effectIds } })} />
          </div>
        )}
        <Toggle label="Hindernis" hint="Für Fähigkeiten" checked={t.obstacle} onChange={(obstacle) => update({ obstacle })} />
        <Toggle label="Wirft Schatten" checked={t.castsShadow} onChange={(castsShadow) => update({ castsShadow })} />
        <Toggle
          label="Rutschig"
          hint="Wer sich darauf bewegt, rutscht in Bewegungsrichtung weiter – bis ein Hindernis oder nicht-rutschiges Gelände kommt"
          checked={t.slippery}
          onChange={(slippery) => update({ slippery })}
        />
      </section>

      <section className="card fields">
        <h2>Kostensteigerung</h2>
        <p className="muted small">Wer auf diesem Gelände steht, zahlt für Fähigkeiten dieser Typen (leer = alle) mehr – egal, wofür.</p>
        {costs.map((c, i) => (
          <SubCard key={i} title={`Steigerung ${i + 1}`} onRemove={() => update({ costIncreases: costs.filter((_, j) => j !== i) })}>
            <TypePicker list="typen-aktionen" value={c.typeIds} onChange={(typeIds) => update({ costIncreases: costs.map((x, j) => (j === i ? { ...x, typeIds } : x)) })} />
            <RefSelect
              collection="ressourcen"
              value={c.resourceId}
              emptyLabel="– Ressource wählen –"
              onChange={(resourceId) => update({ costIncreases: costs.map((x, j) => (j === i ? { ...x, resourceId } : x)) })}
            />
            <Stepper value={c.amount} min={0} onChange={(amount) => update({ costIncreases: costs.map((x, j) => (j === i ? { ...x, amount } : x)) })} />
          </SubCard>
        ))}
        <button className="btn" onClick={() => update({ costIncreases: [...costs, { typeIds: [], resourceId: null, amount: 1 }] })}>+ Steigerung</button>
      </section>

      <section className="card fields">
        <h2>Licht</h2>
        <Toggle label="Leuchtet" checked={t.light.on} onChange={(on) => update({ light: { ...t.light, on } })} />
        {t.light.on && <AreaPicker value={t.light.area} onChange={(area) => update({ light: { ...t.light, area } })} />}
      </section>

      <KindList<ObjectWorking & { kind: 'wirkung' }>
        title="Wirkungen"
        hint="Wie bei Objekten: verteilen bei einem Auslöser die Bausteine einer Fähigkeit. Können über den Effekt-Baustein „Gelände-Effekte ignorieren“ umgangen werden."
        items={t.workings.map((w) => ({ ...w, kind: 'wirkung' as const }))}
        kinds={[
          {
            kind: 'wirkung',
            label: 'Wirkung',
            create: () => ({
              kind: 'wirkung',
              trigger: { kind: 'bereich', event: 'betritt', allys: true, gegner: true, typeIds: [], effectIds: [] },
              area: ['0,0'],
              target: 'traeger',
              ending: 'verlassen',
              blocks: [],
            }),
          },
        ]}
        addLabel="Wirkung"
        numbered
        onChange={(ws) => update({ workings: ws.map(({ kind: _k, ...w }) => w) })}
        render={(w, setW) => <WorkingFields mode="gelaende" w={w} set={(n) => setW({ ...n, kind: 'wirkung' })} />}
      />
    </>
  );
}
