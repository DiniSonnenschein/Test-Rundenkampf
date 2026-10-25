// Wiederverwendbare Eingabefelder für die Editoren.
import { useEffect, useState } from 'react';
import { sortEntries } from '../data/collection';
import type { Entry } from '../data/model';
import { useCollection } from '../data/store';

export function Stepper({
  value, onChange, min = -Infinity, max = Infinity, step = 1, bigStep = step, signed = false, id,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  bigStep?: number;
  /** Zeigt einen ±-Knopf, um das Vorzeichen umzudrehen. */
  signed?: boolean;
  id?: string;
}) {
  const decimals = (String(step).split('.')[1] ?? '').length;
  const clamp = (v: number) => Math.min(max, Math.max(min, Number(v.toFixed(decimals))));
  // Eigener Text-Zustand, damit Zwischenstände wie „-“ oder „“ beim Tippen möglich sind.
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
  }, [value]);

  return (
    <div className="stepper">
      <button className="btn" onClick={() => onChange(clamp(value - bigStep))} aria-label="Weniger">−</button>
      {signed && (
        <button className="btn btn-sign" onClick={() => onChange(clamp(-value))} aria-label="Vorzeichen umdrehen">±</button>
      )}
      <input
        id={id}
        className="input"
        type="text"
        inputMode={decimals ? 'decimal' : 'numeric'}
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(',', '.');
          setText(t);
          if (t.trim() !== '' && t !== '-' && !isNaN(Number(t))) onChange(clamp(Number(t)));
        }}
        onBlur={() => setText(String(value))}
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
  collection, value, onChange, emptyLabel, id, filter,
}: {
  collection: string;
  filter?: (e: Entry) => boolean;
  value: string | null;
  onChange: (id: string | null) => void;
  emptyLabel: string;
  id?: string;
}) {
  const col = useCollection(collection);
  return (
    <select id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{emptyLabel}</option>
      {sortEntries(filter ? col.entries.filter(filter) : col.entries).map((e) => (
        <option key={e.id} value={e.id}>{e.title || 'Ohne Titel'}</option>
      ))}
    </select>
  );
}
