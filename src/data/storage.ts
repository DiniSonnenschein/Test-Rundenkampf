// Lokale Datenhaltung: Alle Inhalte liegen als JSON im Speicher des Geräts.
// Jede Sammlung (z. B. "allys", "gegner", "spielstaende") wird unter einem eigenen Schlüssel abgelegt.

export const SCHEMA_VERSION = 1;
const PREFIX = 'rundenkampf:';

/** Minimale Schnittstelle, die localStorage erfüllt – austauschbar für Tests. */
export interface KeyValueBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export interface BackupFile {
  app: 'test-rundenkampf';
  schemaVersion: number;
  exportedAt: string;
  collections: Record<string, unknown>;
}

export class Storage {
  constructor(private backend: KeyValueBackend) {}

  load<T>(collection: string, fallback: T): T {
    const raw = this.backend.getItem(PREFIX + collection);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  save(collection: string, data: unknown): void {
    this.backend.setItem(PREFIX + collection, JSON.stringify(data));
  }

  collections(): string[] {
    const names: string[] = [];
    for (let i = 0; i < this.backend.length; i++) {
      const key = this.backend.key(i);
      if (key?.startsWith(PREFIX)) names.push(key.slice(PREFIX.length));
    }
    return names.sort();
  }

  exportAll(now = new Date()): BackupFile {
    const collections: Record<string, unknown> = {};
    for (const name of this.collections()) collections[name] = this.load(name, null);
    return { app: 'test-rundenkampf', schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), collections };
  }

  /** Ersetzt alle vorhandenen Inhalte durch die aus dem Backup. */
  importAll(json: string): void {
    let file: BackupFile;
    try {
      file = JSON.parse(json);
    } catch {
      throw new Error('Die Datei ist kein gültiges JSON.');
    }
    if (file?.app !== 'test-rundenkampf' || typeof file.collections !== 'object' || file.collections === null) {
      throw new Error('Die Datei ist kein Backup dieser App.');
    }
    if (file.schemaVersion > SCHEMA_VERSION) {
      throw new Error('Das Backup stammt aus einer neueren App-Version.');
    }
    for (const name of this.collections()) this.backend.removeItem(PREFIX + name);
    for (const [name, data] of Object.entries(file.collections)) this.save(name, data);
  }
}
