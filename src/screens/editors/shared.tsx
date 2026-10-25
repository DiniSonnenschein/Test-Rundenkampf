// Gemeinsame Editor-Bausteine.
import type { ReactNode } from 'react';
import type { EffectDuration } from '../../engine/resources';
import { Choice, Stepper } from '../../ui/fields';

/** Karte für einen Eintrag in einer „+“-Liste. */
export function SubCard({ title, onRemove, children }: { title: string; onRemove: () => void; children: ReactNode }) {
  return (
    <div className="sub-card">
      <div className="sub-card-head">
        <span className="field-label">{title}</span>
        <button className="icon-btn" aria-label="Entfernen" onClick={onRemove}>✕</button>
      </div>
      {children}
    </div>
  );
}

type DurationKind = EffectDuration['kind'];

export function DurationPicker({ value, onChange }: { value: EffectDuration; onChange: (d: EffectDuration) => void }) {
  return (
    <>
      <span className="field-label">Dauer</span>
      <Choice<DurationKind>
        value={value.kind}
        options={[
          { value: 'runden', label: 'Runden' },
          { value: 'unendlich', label: 'Unendlich' },
          { value: 'bis-aufloesung', label: 'Bis Auflösung' },
        ]}
        onChange={(k) => onChange(k === 'runden' ? { kind: 'runden', rounds: 1 } : { kind: k })}
      />
      {value.kind === 'runden' && <Stepper value={value.rounds} min={1} onChange={(rounds) => onChange({ kind: 'runden', rounds })} />}
    </>
  );
}

/** Auswahlfeld mit festen Optionen. */
export function Select<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
