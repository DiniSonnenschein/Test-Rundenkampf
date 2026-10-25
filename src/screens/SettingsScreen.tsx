import { useRef, useState } from 'react';
import { downloadBackup, restoreBackup } from '../data/backup';
import { clearAllData, reloadAll } from '../data/store';
import { Header } from '../ui/Header';
import { useDialog } from '../ui/Dialog';
import { routes } from '../router';
import { TYPEN_AKTIONEN, TYPEN_CHARAKTERE } from '../data/model';
import { TypeManager } from './TypeManager';

export function SettingsScreen() {
  const dialog = useDialog();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ok = await dialog.confirm({
      title: 'Backup einspielen?',
      message: 'Alle vorhandenen Inhalte werden durch das Backup ersetzt.',
      confirmLabel: 'Einspielen',
      danger: true,
    });
    if (!ok) return;
    try {
      await restoreBackup(file);
      reloadAll();
      setMessage('Backup wurde eingespielt.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Backup konnte nicht gelesen werden.');
    }
  }

  async function clearAll() {
    const ok = await dialog.confirm({
      title: 'Alle Daten löschen?',
      message: 'Alle Bausteine, Spiele und Spielstände werden von diesem Gerät gelöscht. Erstelle vorher am besten ein Backup.',
      confirmLabel: 'Weiter',
      danger: true,
    });
    if (!ok) return;
    const sure = await dialog.confirm({
      title: 'Wirklich alles löschen?',
      message: 'Das kann nicht rückgängig gemacht werden.',
      confirmLabel: 'Endgültig löschen',
      danger: true,
    });
    if (!sure) return;
    clearAllData();
    setMessage('Alle Daten wurden gelöscht.');
  }

  return (
    <main className="screen">
      <Header title="Einstellungen" back={routes.start()} />

      <TypeManager def={TYPEN_AKTIONEN} hint="Gruppieren Fähigkeiten und Effekte (z. B. „positiv“, „Feuer“, „Bewegung“)." />
      <TypeManager def={TYPEN_CHARAKTERE} hint="Gruppieren Allys und Gegner (z. B. „Untot“, „Tier“)." />

      <section className="card">
        <h2>Daten sichern</h2>
        <p className="muted">Alle Inhalte liegen nur auf diesem Gerät. Ein Backup sichert sie als JSON-Datei.</p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={downloadBackup}>Exportieren</button>
          <button className="btn" onClick={() => fileInput.current?.click()}>Importieren</button>
        </div>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onFile} />
      </section>

      <section className="card">
        <h2>Daten löschen</h2>
        <p className="muted">Setzt die App komplett zurück.</p>
        <button className="btn btn-danger" onClick={clearAll}>Alle Daten löschen</button>
      </section>

      {message && <p className="card">{message}</p>}

      <footer className="muted start-footer">Version {__APP_VERSION__}</footer>
    </main>
  );
}
