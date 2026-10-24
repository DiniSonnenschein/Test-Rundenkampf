import { useRef, useState } from 'react';
import { downloadBackup, restoreBackup } from './data/backup';
import { Leaves } from './ui/Leaves';

// Platzhalter-Startseite aus Abschnitt 0. Der eigentliche Startbildschirm folgt in Abschnitt 1.
export function App() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm('Alle vorhandenen Inhalte werden durch das Backup ersetzt. Fortfahren?')) return;
    try {
      await restoreBackup(file);
      setMessage('Backup wurde eingespielt.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Backup konnte nicht gelesen werden.');
    }
  }

  return (
    <>
      <Leaves />
      <main className="screen">
        <header>
          <h1>Test-Rundenkampf</h1>
          <p className="muted">Testumgebung für rundenbasierte Dungeon-Kämpfe</p>
        </header>

        <section className="card">
          <h2>Grundgerüst steht 🍂</h2>
          <p className="muted">Der Startbildschirm mit „Erstellen“, „Neues Spiel“ und „Spielstand laden“ folgt in Abschnitt 1.</p>
        </section>

        <section className="card">
          <h2>Daten sichern</h2>
          <p className="muted">Alle Inhalte liegen nur auf diesem Gerät. Ein Backup sichert sie als JSON-Datei.</p>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={downloadBackup}>Exportieren</button>
            <button className="btn" onClick={() => fileInput.current?.click()}>Importieren</button>
          </div>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onFile} />
          {message && <p style={{ marginTop: 12 }}>{message}</p>}
        </section>

        <footer className="muted" style={{ marginTop: 'auto', fontSize: '.85rem', textAlign: 'center' }}>
          Version {__APP_VERSION__}
        </footer>
      </main>
    </>
  );
}
