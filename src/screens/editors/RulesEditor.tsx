import { normalizeRules, type LightShape, type Rules, type TieBreak } from '../../engine/rules';
import { Choice, Stepper, Toggle } from '../../ui/fields';
import type { EditorProps } from './index';
import { LightPreview } from './LightPreview';

export function RulesEditor({ entry, set }: EditorProps) {
  const rules = normalizeRules(entry.rules);
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
        <p className="muted small">
          Ohne Licht liegt alles im Nebel. Der Laternenträger beginnt jedes Level auf einem festen Feld; seine Laterne brennt auch, wenn er
          bewusstlos ist. Welche Objekte Schatten werfen und wie weit ein Charakter ohne Licht sieht, wird beim jeweiligen Objekt bzw.
          Charakter festgelegt.
        </p>
        <label className="field-label" htmlFor="lantern">Laternen-Radius (Standard)</label>
        <Stepper id="lantern" value={rules.light.lanternRadius} min={0} max={20} onChange={(v) => update((r) => ({ ...r, light: { ...r.light, lanternRadius: v } }))} />
        <span className="field-label">Form des Lichtkegels</span>
        <Choice<LightShape>
          value={rules.light.shape}
          options={[{ value: 'kreis', label: 'Kreis' }, { value: 'quadrat', label: 'Quadrat' }]}
          onChange={(v) => update((r) => ({ ...r, light: { ...r.light, shape: v } }))}
        />
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
          Die Reihenfolge wird zu Beginn jedes Levels nach der Ressource „Initiative“ festgelegt: höchster Wert zuerst. Änderungen während
          eines Levels wirken erst ab dem nächsten Level. Alle Gegner handeln mit, auch unsichtbare.
        </p>
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
        <h2>Run verloren</h2>
        <p className="muted small">
          Niemand stirbt – die Gruppe flieht, bevor es so weit kommt. „Bewusstlos“ ist ein fester Effekt (Abschnitt 4).
        </p>
        <label className="field-label" htmlFor="unc-turns">Wenn ein Ally so viele eigene Züge am Stück bewusstlos ist</label>
        <Stepper
          id="unc-turns"
          value={rules.defeat.unconsciousTurns}
          min={0}
          max={20}
          onChange={(v) => update((r) => ({ ...r, defeat: { ...r.defeat, unconsciousTurns: v } }))}
        />
        <p className="muted small">0 = aus. Gilt auch für den Laternenträger.</p>
        <span className="field-label">Oder wenn gleichzeitig bewusstlos sind</span>
        <Choice<'alle' | 'anzahl'>
          value={rules.defeat.unconsciousCount === 'alle' ? 'alle' : 'anzahl'}
          options={[{ value: 'alle', label: 'Alle Allys' }, { value: 'anzahl', label: 'Bestimmte Anzahl' }]}
          onChange={(v) => update((r) => ({ ...r, defeat: { ...r.defeat, unconsciousCount: v === 'alle' ? 'alle' : 2 } }))}
        />
        {rules.defeat.unconsciousCount !== 'alle' && (
          <Stepper
            value={rules.defeat.unconsciousCount}
            min={1}
            max={20}
            onChange={(v) => update((r) => ({ ...r, defeat: { ...r.defeat, unconsciousCount: v } }))}
          />
        )}
      </section>

      <section className="card">
        <h2>Feste Regeln</h2>
        <ul className="fixed-rules muted">
          <li>Quadratisches Raster</li>
          <li>Nebel; Sicht nur durch Licht (Laterne & Licht-Fähigkeiten) und die Eigensicht der Charaktere</li>
          <li>Vor Runde 1: Laternenträger fest, übrige Allys frei im Lichtkegel platzierbar; im nächsten Level wird die Platzierung möglichst wiederholt</li>
          <li>Initiative-Reihenfolge einzelner Charaktere, festgelegt zu Beginn des Levels</li>
          <li>Ein Zug besteht aus beliebig vielen Aktionen (Fähigkeiten)</li>
          <li>Sieg, sobald alle Allys (auch bewusstlose – keiner wird zurückgelassen) auf je einem Siegfeld stehen; bis dahin sind Siegfelder gewöhnliche Felder</li>
          <li>Run verloren, wenn alle Allys bewusstlos sind; danach: Züge rückgängig machen, Level neu starten oder zurück zum Menü</li>
        </ul>
      </section>
    </>
  );
}
