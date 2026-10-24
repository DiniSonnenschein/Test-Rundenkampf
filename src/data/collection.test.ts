import { describe, expect, it } from 'vitest';
import {
  countInFolder, createEntry, deleteFolder, duplicateEntry, folderPath, searchEntries, sortEntries,
} from './collection';
import { BAUSTEINE, type Collection, type Entry, type Folder } from './model';
import { findUsages, removeUsages } from './references';

const ally = BAUSTEINE.find((d) => d.key === 'allys')!;
const effekt = BAUSTEINE.find((d) => d.key === 'effekte')!;

function entry(id: string, title: string, extra: Partial<Entry> = {}): Entry {
  return { id, title, note: '', folderId: null, createdAt: '', updatedAt: '', ...extra };
}
function folder(id: string, parentId: string | null = null): Folder {
  return { id, name: id, parentId, updatedAt: '' };
}

describe('Einträge', () => {
  it('sichtbare Arten bekommen Form, Farbe und Größe 1', () => {
    const e = createEntry(ally, null);
    expect(e).toMatchObject({ title: 'Neuer Ally', note: '', shape: 'kreis', size: 1 });
    expect(createEntry(effekt, null)).not.toHaveProperty('shape');
  });

  it('duplizieren erzeugt eine neue ID und einen Kopie-Titel', () => {
    const e = entry('a1', 'Goblin', { werte: { lp: 10 } });
    const d = duplicateEntry(e, 'gegner');
    expect(d.id).not.toBe('a1');
    expect(d.title).toBe('Goblin (Kopie)');
    expect(d.werte).toEqual({ lp: 10 });
    expect(d.werte).not.toBe(e.werte);
  });

  it('sortiert alphabetisch und natürlich', () => {
    const sorted = sortEntries([entry('1', 'goblin 10'), entry('2', 'Ork'), entry('3', 'Goblin 2'), entry('4', 'Ähre')]);
    expect(sorted.map((e) => e.title)).toEqual(['Ähre', 'Goblin 2', 'goblin 10', 'Ork']);
  });

  it('sucht in Titel und Notiz', () => {
    const list = [entry('1', 'Goblin'), entry('2', 'Ork', { note: 'Verwandt mit goblins' }), entry('3', 'Drache')];
    expect(searchEntries(list, 'GOB').map((e) => e.id)).toEqual(['1', '2']);
  });
});

describe('Ordner', () => {
  const col: Collection = {
    folders: [folder('wald'), folder('boss', 'wald')],
    entries: [entry('1', 'A', { folderId: 'wald' }), entry('2', 'B', { folderId: 'boss' }), entry('3', 'C')],
  };

  it('ermittelt Pfad und Anzahl inkl. Unterordnern', () => {
    expect(folderPath(col.folders, 'boss').map((f) => f.id)).toEqual(['wald', 'boss']);
    expect(countInFolder(col, 'wald')).toBe(2);
  });

  it('beim Löschen wandert der Inhalt eine Ebene nach oben', () => {
    const next = deleteFolder(col, 'wald');
    expect(next.folders).toEqual([folder('boss', null)]);
    expect(next.entries.find((e) => e.id === '1')!.folderId).toBeNull();
    expect(next.entries.find((e) => e.id === '2')!.folderId).toBe('boss');
  });
});

describe('Verweise', () => {
  const all: Record<string, Collection> = {
    faehigkeiten: { folders: [], entries: [entry('f1', 'Feuerball')] },
    allys: {
      folders: [],
      entries: [
        entry('a1', 'Magier', { faehigkeiten: ['f1', 'f2'], start: { waffe: 'f1' } }),
        entry('a2', 'Krieger', { faehigkeiten: ['f2'] }),
      ],
    },
  };

  it('findet Verwendungen', () => {
    expect(findUsages(all, 'f1').map((u) => u.entry.id)).toEqual(['a1']);
  });

  it('entfernt Verweise aus Listen und Feldern', () => {
    const changed = removeUsages(all, 'f1');
    expect(Object.keys(changed)).toEqual(['allys']);
    expect(changed.allys.entries[0]).toMatchObject({ id: 'a1', faehigkeiten: ['f2'], start: { waffe: null } });
    expect(changed.allys.entries[1]).toBe(all.allys.entries[1]);
  });
});
