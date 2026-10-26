// Spielstand: Überblick, fortsetzen und Vorlagen aktualisieren.
import type { Entry } from '../../data/model';
import { getCollection } from '../../data/store';
import { titleOf } from '../../engine/defs';
import { normalizeGame } from '../../engine/game';
import { getUnit } from '../../engine/battle';
import { refreshTemplates, runSummary, type RunState } from '../../engine/run';
import { buildDefs } from '../../game/snapshot';
import { navigate, routes } from '../../router';
import { useDialog } from '../../ui/Dialog';
import type { EditorProps } from './index';

export function SaveEditor({ entry, set }: EditorProps) {
  const dialog = useDialog();
  const run = entry.run as RunState | undefined;
  if (!run) return <section className="card muted">Dieser Spielstand enthält kein Spiel.</section>;
  const s = runSummary(run);
  const defs = run.defs;

  async function refresh() {
    const ok = await dialog.confirm({
      title: 'Vorlagen aktualisieren?',
      message:
        'Das Spiel übernimmt die aktuellen Werte aus den Editoren (Fähigkeiten, Effekte, Charaktere, Regelwerk …). Was im Spiel entstanden ist – Werte, Effekte, Gegenstände, Positionen – bleibt. Das laufende Level behält seine Map.',
      confirmLabel: 'Aktualisieren',
    });
    if (!ok || !run) return;
    const current = entry.gameId ? getCollection('spiele').entries.find((e) => e.id === entry.gameId) : undefined;
    const game = run.game ?? normalizeGame({ ...(current ?? {}), content: run.content });
    set({ run: refreshTemplates(run, buildDefs(game)) } as Partial<Entry>);
  }

  return (
    <>
      <section className="card fields">
        <h2>Spielstand</h2>
        {s.dungeon && <p className="small">Dungeon: <strong>{s.dungeon}</strong></p>}
        <p className="small">
          Level: <strong>{s.level}</strong> · {s.status}
        </p>
        <button className="btn btn-primary" onClick={() => navigate(routes.game(entry.id))}>Fortsetzen</button>
      </section>

      <section className="card fields">
        <h2>Allys</h2>
        {run.team.map((m) => {
          const u = run.interlude ? undefined : getUnit(run.battle, m.memberId);
          const values = u?.values ?? m.values;
          const max = u?.maxValues ?? m.maxValues;
          const shown = Object.keys(values).filter((k) => defs.resources[k]?.display.show);
          return (
            <p key={m.memberId} className="small">
              <strong>{titleOf(defs, m.allyId)}</strong>
              {shown.length > 0 && ' · '}
              {shown.map((k) => `${defs.resources[k].title} ${values[k]}${typeof max[k] === 'number' ? `/${max[k]}` : ''}`).join(' · ')}
              {u?.status === 'bewusstlos' && ' · bewusstlos'}
            </p>
          );
        })}
      </section>

      <section className="card fields">
        <h2>Vorlagen</h2>
        <p className="muted small">
          Das Spiel nutzt die Vorlagen von seinem Start. „Vorlagen aktualisieren“ übernimmt die aktuellen Editor-Werte; Spielwerte bleiben erhalten.
          Gelöschte Vorlagen bleiben in der alten Fassung. Zum Sichern eines Zwischenstands den Spielstand duplizieren.
        </p>
        <button className="btn" onClick={refresh}>↻ Vorlagen aktualisieren</button>
      </section>
    </>
  );
}
