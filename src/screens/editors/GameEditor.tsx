import { RefSelect } from '../../ui/fields';
import type { EditorProps } from './index';

export function GameEditor({ entry, set }: EditorProps) {
  return (
    <>
      <section className="card fields">
        <label className="field-label" htmlFor="ruleset">Regelwerk</label>
        <RefSelect
          id="ruleset"
          collection="regelwerke"
          value={(entry.regelwerkId as string | null) ?? null}
          emptyLabel="Standard-Regeln"
          onChange={(id) => set({ regelwerkId: id })}
        />
      </section>
      <section className="card placeholder muted">Auswahl von Dungeon/Leveln, Team und Startgegenständen folgt in Abschnitt 12.</section>
      <button className="btn btn-primary" disabled>Spiel starten</button>
    </>
  );
}
