// Bereichs-Auswahl: 9×9-Raster, Charakter in der Mitte mit Blick nach oben.
// Die gewählten Felder drehen sich im Spiel mit der Blickrichtung des Charakters.
import { AREA_RADIUS, type Area } from '../engine/facing';

export function AreaPicker({ value, onChange }: { value: Area; onChange: (a: Area) => void }) {
  const set = new Set(value);
  const size = AREA_RADIUS * 2 + 1;
  const toggle = (k: string) => onChange(set.has(k) ? value.filter((v) => v !== k) : [...value, k]);

  return (
    <div className="area-picker">
      <div className="area-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {Array.from({ length: size * size }, (_, i) => {
          const dx = (i % size) - AREA_RADIUS;
          const dy = Math.floor(i / size) - AREA_RADIUS;
          const k = `${dx},${dy}`;
          const center = dx === 0 && dy === 0;
          return (
            <button
              key={k}
              className={`area-cell ${set.has(k) ? 'on' : ''} ${center ? 'center' : ''}`}
              aria-label={center ? 'Charakter' : `Feld ${dx}, ${-dy}`}
              aria-pressed={set.has(k)}
              onClick={() => toggle(k)}
            >
              {center && '▲'}
            </button>
          );
        })}
      </div>
      <div className="area-footer">
        <span className="muted small">{value.length} Felder · ▲ = Charakter mit Blick nach oben</span>
        {value.length > 0 && <button className="link-btn" onClick={() => onChange([])}>Leeren</button>}
      </div>
    </div>
  );
}
