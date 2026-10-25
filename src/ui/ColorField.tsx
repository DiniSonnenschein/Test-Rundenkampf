// Kompaktes Farbfeld: Farbfeld + Hex; antippen klappt das Farbrad auf.
import { useState } from 'react';
import { ColorWheel } from './ColorWheel';

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="color-field">
      <button className="color-field-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="color-preview" style={{ background: value }} />
        <span className="color-field-label">{label}</span>
        <span className="muted small">{value}</span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && <ColorWheel value={value} onChange={onChange} />}
    </div>
  );
}
