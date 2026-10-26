// Statistik: was Allys und Gegner bewirkt haben – für das laufende Level oder den ganzen Run.
import { useState } from 'react';
import { titleOf, type Defs } from '../../engine/defs';
import { emptyStats, mergeStats, sideTotal, type LevelStats, type UnitStats } from '../../engine/stats';

const ROWS: { key: keyof UnitStats; label: string }[] = [
  { key: 'lowered', label: 'Bei der Gegenseite gesenkt' },
  { key: 'raised', label: 'Bei der eigenen Seite aufgefüllt' },
  { key: 'effects', label: 'Effekte vergeben' },
  { key: 'abilities', label: 'Fähigkeiten eingesetzt' },
  { key: 'reactions', label: 'Reaktionen' },
  { key: 'collected', label: 'Gegenstände eingesammelt' },
  { key: 'used', label: 'Gegenstände verwendet' },
];

function UnitBlock({ u, defs, open, onToggle }: { u: UnitStats; defs: Defs; open?: boolean; onToggle?: () => void }) {
  const counts = ROWS.map((r) => ({ ...r, c: u[r.key] as Record<string, number> })).filter((r) => Object.keys(r.c).length > 0);
  return (
    <div className="sub-card stats-unit">
      <button className="stats-head" onClick={onToggle} disabled={!onToggle}>
        <strong>{u.name}</strong>
        <span className="muted small">
          {u.turns} Züge · {u.moved} Felder{u.unconscious ? ` · ${u.unconscious}× bewusstlos` : ''}
        </span>
      </button>
      {(open ?? true) &&
        (counts.length ? (
          counts.map((r) => (
            <div key={r.key} className="stats-row">
              <span className="muted small">{r.label}</span>
              <span className="small">
                {Object.entries(r.c)
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, n]) => `${titleOf(defs, id.replace(/^objekt:/, ''))} ${n}`)
                  .join(' · ')}
              </span>
            </div>
          ))
        ) : (
          <span className="muted small">Noch nichts bewirkt.</span>
        ))}
    </div>
  );
}

export function StatsView({ levels, defs, onClose }: { levels: LevelStats[]; defs: Defs; onClose: () => void }) {
  const [scope, setScope] = useState<'level' | 'run'>('level');
  const [open, setOpen] = useState<string | null>(null);
  const stats = scope === 'level' ? levels.at(-1)?.stats ?? emptyStats() : mergeStats(levels.map((l) => l.stats));
  const side = (s: 'ally' | 'enemy') => Object.entries(stats.units).filter(([, u]) => u.side === s);

  return (
    <div className="game-log" onClick={onClose}>
      <div className="game-log-inner" onClick={(e) => e.stopPropagation()}>
        <h2>Statistik</h2>
        <div className="btn-row">
          <button className={`btn btn-small ${scope === 'level' ? 'btn-primary' : ''}`} onClick={() => setScope('level')}>Dieses Level</button>
          <button className={`btn btn-small ${scope === 'run' ? 'btn-primary' : ''}`} onClick={() => setScope('run')}>
            Ganzer Run ({levels.length} Level)
          </button>
        </div>
        <p className="muted small">Gezählt wird, was eine Figur selbst bewirkt hat (Fähigkeiten, Reaktionen, Gegenstände). Umgebung und Debug zählen nicht.</p>
        {(['ally', 'enemy'] as const).map((s) => (
          <section key={s} className="stats-side">
            <h3>{s === 'ally' ? 'Allys' : 'Gegner'}</h3>
            <UnitBlock u={sideTotal(stats, s)} defs={defs} />
            {side(s).map(([id, u]) => (
              <UnitBlock key={id} u={u} defs={defs} open={open === id} onToggle={() => setOpen(open === id ? null : id)} />
            ))}
          </section>
        ))}
        <button className="btn" onClick={onClose}>Schließen</button>
      </div>
    </div>
  );
}
