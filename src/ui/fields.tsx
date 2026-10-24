// Wiederverwendbare Eingabefelder für die Editoren.
import { sortEntries } from '../data/collection';
import { useCollection } from '../data/store';

export function Stepper({
  value, onChange, min = -Infinity, max = Infinity, step = 1, bigStep = step, id,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  bigStep?: number;
  id?: string;
}) {
  const decimals = (String(step).split('.')[1] ?? '').length;
  const clamp = (v: number) => Math.min(max, Math.max(min, Number(v.toFixed(decimals))));
  return (
    <div className="stepper">
      <button className="btn" onClick={() => onChange(clamp(value - bigStep))} aria-label="Weniger">−</button>
      <input
        id={id}
        className="input"
        type="number"
        inputMode="decimal"
        step={step}
        min={Number.isFinite(min) ? min : undefined}
        max={Number.isFinite(max) ? max : undefined}
        value={value}
        onChange={(e) => e.target.value !== '' && !isNaN(Number(e.target.value)) && onChange(clamp(Number(e.target.value)))}
      />
      <button className="btn" onClick={() => onChange(clamp(value + bigStep))} aria-label="Mehr">+</button>
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <span className="toggle-text">
        <span>{label}</span>
        {hint && <span className="muted toggle-hint">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-switch" aria-hidden="true" />
    </label>
  );
}

export function Choice<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="choice" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={o.value === value} className={o.value === value ? 'selected' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Auswahl eines Eintrags aus einer anderen Sammlung (Verweis per ID). */
export function RefSelect({
  collection, value, onChange, emptyLabel, id,
}: {
  collection: string;
  value: string | null;
  onChange: (id: string | null) => void;
  emptyLabel: string;
  id?: string;
}) {
  const col = useCollection(collection);
  return (
    <select id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{emptyLabel}</option>
      {sortEntries(col.entries).map((e) => (
        <option key={e.id} value={e.id}>{e.title || 'Ohne Titel'}</option>
      ))}
    </select>
  );
}
