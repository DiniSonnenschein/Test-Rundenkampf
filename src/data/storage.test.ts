import { describe, expect, it } from 'vitest';
import { Storage, type KeyValueBackend } from './storage';

function memoryBackend(): KeyValueBackend {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

describe('Storage', () => {
  it('speichert und lädt Sammlungen als JSON', () => {
    const s = new Storage(memoryBackend());
    expect(s.load('allys', [])).toEqual([]);
    s.save('allys', [{ id: 'a1', name: 'Eichhorn' }]);
    expect(s.load('allys', [])).toEqual([{ id: 'a1', name: 'Eichhorn' }]);
  });

  it('ignoriert fremde Schlüssel', () => {
    const backend = memoryBackend();
    backend.setItem('anderes', 'x');
    const s = new Storage(backend);
    s.save('gegner', []);
    expect(s.collections()).toEqual(['gegner']);
  });

  it('exportiert und importiert alle Inhalte', () => {
    const a = new Storage(memoryBackend());
    a.save('allys', [{ id: 'a1' }]);
    a.save('level', [{ id: 'l1' }]);
    const backup = JSON.stringify(a.exportAll(new Date('2026-10-24T12:00:00Z')));

    const b = new Storage(memoryBackend());
    b.save('alt', [1]);
    b.importAll(backup);
    expect(b.collections()).toEqual(['allys', 'level']);
    expect(b.load('level', [])).toEqual([{ id: 'l1' }]);
  });

  it('lehnt ungültige Dateien ab', () => {
    const s = new Storage(memoryBackend());
    expect(() => s.importAll('kein json')).toThrow('kein gültiges JSON');
    expect(() => s.importAll('{"foo":1}')).toThrow('kein Backup');
    expect(() =>
      s.importAll(JSON.stringify({ app: 'test-rundenkampf', schemaVersion: 999, collections: {} })),
    ).toThrow('neueren');
  });
});
