import { storage } from './localStore';

/** Lädt alle Inhalte als JSON-Datei herunter. */
export function downloadBackup(): void {
  const data = storage.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rundenkampf-backup-${data.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Liest eine Backup-Datei ein und ersetzt alle Inhalte. */
export async function restoreBackup(file: File): Promise<void> {
  storage.importAll(await file.text());
}
