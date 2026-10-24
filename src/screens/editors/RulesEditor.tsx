import { normalizeRules, type KoMode, type LightShape, type Rules, type TieBreak } from '../../engine/rules';
import { useCollection } from '../../data/store';
import { Choice, RefSelect, Stepper, Toggle } from '../../ui/fields';
import type { EditorProps } from './index';
import { LightPreview } from './LightPreview';

const KO_OPTIONS: { value: KoMode; label: string }[] = [
  { value: 'bewusstlos', label: 'Bewusstlos' },
  { value: 'tot', label: 'Tot (entfernt)' },
];

export function RulesEditor({ entry, set }: EditorProps) {
  const rules = normalizeRules(entry.rules);
  const ressourcen = useCollection('ressourcen');
  const update = (fn: (r: Rules) => Rules) => set({ rules: fn(structuredClone(rules)) });

  return (
    <>
      <section className="card fields">
        <h2>Spielfeld</h2>
        <p className="muted small">Quadratisches Raster (fest).</p>
        <Toggle label="Diagonale Bewegung" checked={rules.diagonal} onChange={(v) => update((r) => ({ ...r, diagonal: v }))} />
        {rules.diagonal && (
          <Toggle
            label="Ecken schneiden"
            hint="Diagonal an Hindernis-Ecken vorbeigehen"
            checked={rules.cornerCutting}
            onChange={(v) => update((r) => ({ ...r, cornerCutting: v }))}
          />
        )}
      </section>

      <section className="card fields">
        <h2>Licht & Nebel</h2>
        <p className="muted small">Ohne Licht liegt alles im Nebel. Der Laternenträger beginnt jedes Level auf einem festen Feld.</p>
        <label className="field-label" htmlFor="lantern">Laternen-Radius (Standard)</label>
        <Stepper id="lantern" value={rules.light.lanternRadius} min={0} max={20} onChange={(v) => update((r) => ({ ...r, light: { ...r.light, lanternRadius: v } }))} />
        <span className="field-label">Form des Lichtkegels</span>
        <Choice<LightShape>
          value={rules.light.shape}
          options={[{ value: 'kreis', label: 'Kreis' }, { value: 'quadrat', label: 'Quadrat' }]}
          onChange={(v) => update((r) => ({ ...r, light: { ...r.light, shape: v } }))}
        />
        <Toggle
          label="Hindernisse werfen Schatten"
          checked={rules.light.blockedBySight}
          onChange={(v) => update((r) => ({ ...r, light: { ...r.light, blockedBySight: v } }))}
        />
        <label className="field-label" htmlFor="ownsight">Eigensicht jedes Allys ohne Licht</label>
        <Stepper id="ownsight" value={rules.light.ownSight} min={0} max={10} onChange={(v) => update((r) => ({ ...r, light: { ...r.light, ownSight: v } }))} />
        <p className="muted small">0 = nur das eigene Feld</p>
        <Toggle
          label="Erkundete Felder bleiben aufgedeckt"
          hint="Gelände bleibt sichtbar, Figuren darauf nicht"
          checked={rules.light.rememberExplored}
          onChange={(v) => update((r) => ({ ...r, light: { ...r.light, rememberExplored: v } }))}
        />
        <LightPreview rules={rules} />
      </section>

      <section className="card fields">
        <h2>Initiative & Züge</h2>
        <p className="muted small">
          Die Reihenfolge wird zu Beginn jedes Levels einmal festgelegt: höchster Initiative-Wert zuerst. Alle Gegner handeln mit, auch
          unsichtbare.
        </p>
        <span className="field-label">Initiative-Wert = Summe aus</span>
        {rules.initiative.criteria.map((c, i) => (
          <div key={i} className="criterion">
            <RefSelect
              collection="ressourcen"
              value={c.resourceId}
              emptyLabel="– Wert wählen –"
              onChange={(id) => update((r) => { r.initiative.criteria[i].resourceId = id; return r; })}
            />
            <div className="criterion-row">
              <span className="muted">× Faktor</span>
              <Stepper value={c.factor} step={0.1} bigStep={1} onChange={(v) => update((r) => { r.initiative.criteria[i].factor = v; return r; })} />
              <button className="icon-btn" aria-label="Entfernen" onClick={() => update((r) => { r.initiative.criteria.splice(i, 1); return r; })}>✕</button>
            </div>
          </div>
        ))}
        {ressourcen.entries.length === 0 && <p className="muted small">Lege zuerst Ressourcen bzw. Werte an (z. B. „Initiative“), um sie hier zu nutzen.</p>}
        <button className="btn" onClick={() => update((r) => { r.initiative.criteria.push({ resourceId: null, factor: 1 }); return r; })}>
          + Wert hinzufügen
        </button>

        <span className="field-label">Bei Gleichstand</span>
        <Choice<TieBreak>
          value={rules.initiative.tieBreak}
          options={[
            { value: 'allys-zuerst', label: 'Allys zuerst' },
            { value: 'gegner-zuerst', label: 'Gegner zuerst' },
            { value: 'abwechselnd', label: 'Abwechselnd' },
          ]}
          onChange={(v) => update((r) => ({ ...r, initiative: { ...r.initiative, tieBreak: v } }))}
        />

        <label className="field-label" htmlFor="turns">Züge pro Charakter und Runde (Standard)</label>
        <Stepper id="turns" value={rules.turnsPerRound} min={1} max={5} onChange={(v) => update((r) => ({ ...r, turnsPerRound: v }))} />
        <p className="muted small">Was in einem Zug möglich ist, legen die Aktionsplätze und Fähigkeiten jedes Charakters fest.</p>
      </section>

      <section className="card fields">
        <h2>K.O.</h2>
        <label className="field-label" htmlFor="ko-res">K.O. bei 0 von</label>
        <RefSelect id="ko-res" collection="ressourcen" value={rules.ko.resourceId} emptyLabel="– keine (niemand geht K.O.) –" onChange={(id) => update((r) => ({ ...r, ko: { ...r.ko, resourceId: id } }))} />
        <span className="field-label">Allys bei K.O.</span>
        <Choice<KoMode> value={rules.ko.allies} options={KO_OPTIONS} onChange={(v) => update((r) => ({ ...r, ko: { ...r.ko, allies: v } }))} />
        <span className="field-label">Gegner bei K.O.</span>
        <Choice<KoMode> value={rules.ko.enemies} options={KO_OPTIONS} onChange={(v) => update((r) => ({ ...r, ko: { ...r.ko, enemies: v } }))} />
        <Toggle
          label="Bewusstlose Allys müssen kein Siegfeld erreichen"
          checked={rules.ko.unconsciousExcludedFromVictory}
          onChange={(v) => update((r) => ({ ...r, ko: { ...r.ko, unconsciousExcludedFromVictory: v } }))}
        />
        <Toggle
          label="Niederlage, wenn der Laternenträger K.O. geht"
          checked={rules.ko.defeatOnLanternLoss}
          onChange={(v) => update((r) => ({ ...r, ko: { ...r.ko, defeatOnLanternLoss: v } }))}
        />
        <p className="muted small">Niederlage immer, wenn kein Ally mehr kampffähig ist.</p>
      </section>

      <section className="card">
        <h2>Feste Regeln</h2>
        <ul className="fixed-rules muted">
          <li>Quadratisches Raster</li>
          <li>Nebel; Sicht nur durch Licht (Laterne & Licht-Fähigkeiten)</li>
          <li>Vor Runde 1: Laternenträger fest, übrige Allys frei im Lichtkegel platzierbar; im nächsten Level wird die Platzierung möglichst wiederholt</li>
          <li>Initiative-Reihenfolge einzelner Charaktere, festgelegt zu Beginn des Levels</li>
          <li>Ein Zug besteht aus beliebig vielen Aktionen (Fähigkeiten)</li>
          <li>Sieg, sobald alle Allys auf je einem Siegfeld stehen</li>
        </ul>
      </section>
    </>
  );
}
