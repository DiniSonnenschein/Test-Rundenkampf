// Spielstand: fortsetzen und Überblick.
import type { RunState } from '../../engine/run';
import { titleOf } from '../../engine/defs';
import { navigate, routes } from '../../router';
import type { EditorProps } from './index';

export function SaveEditor({ entry }: EditorProps) {
  const run = entry.run as RunState | undefined;
  if (!run) return <section className="card muted">Dieser Spielstand enthält kein Spiel.</section>;
  const b = run.battle;
  const status = run.result === 'run-gewonnen' ? 'Gewonnen' : run.result === 'run-verloren' ? 'Verloren' : b.phase === 'platzierung' ? 'Platzierung' : `Runde ${b.round}`;
  return (
    <section className="card fields">
      <h2>Spielstand</h2>
      <p className="small">
        Level: <strong>{titleOf(run.defs, run.levelId)}</strong> · {status}
      </p>
      <p className="muted small">Das Spiel nutzt die Vorlagen von seinem Start – spätere Änderungen in den Editoren wirken erst in einem neuen Spiel.</p>
      <button className="btn btn-primary" onClick={() => navigate(routes.game(entry.id))}>Fortsetzen</button>
    </section>
  );
}
