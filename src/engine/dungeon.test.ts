import { describe, expect, it } from 'vitest';
import { hasEnding, normalizeDungeon, priceFor, unreachable, validateDungeon, type DungeonStation } from './dungeon';

const st = (id: string, next: string[], levelId: string | null = 'l'): DungeonStation => ({ id, name: id.toUpperCase(), levelId, next, interlude: [] });

describe('Dungeon', () => {
  it('Verzweigung und Zusammenführung: alles erreichbar, Ende vorhanden', () => {
    const d = normalizeDungeon({ stations: [st('a', ['b', 'c']), st('b', ['d']), st('c', ['d']), st('d', [])] });
    expect(unreachable(d)).toEqual([]);
    expect(hasEnding(d)).toBe(true);
    expect(validateDungeon(d)).toEqual([]);
  });

  it('meldet Unerreichbares, fehlende Level und endlose Dungeons', () => {
    const d = normalizeDungeon({ stations: [st('a', ['b']), st('b', ['a']), st('c', [], null)] });
    const w = validateDungeon(d);
    expect(w).toContain('1 Station ohne Level.');
    expect(w).toContain('Nicht erreichbar: C.');
    expect(w).toContain('Kein Ende erreichbar – der Dungeon endet nie.');
  });

  it('entfernt Verweise auf gelöschte Stationen', () => {
    expect(normalizeDungeon({ stations: [st('a', ['weg'])] }).stations[0].next).toEqual([]);
  });

  it('Händler: Sonderpreis vor Typ-Preis', () => {
    const m = {
      kind: 'haendler' as const,
      currencyId: 'gold',
      typePrices: [{ typeId: 'trank', buy: 5, sell: 2 }],
      objectPrices: [{ objectId: 'elixier', buy: 20, sell: 10 }],
      offers: [],
      selling: true,
    };
    expect(priceFor(m, 'heiltrank', ['trank'])).toEqual({ buy: 5, sell: 2 });
    expect(priceFor(m, 'elixier', ['trank'])).toEqual({ buy: 20, sell: 10 });
    expect(priceFor(m, 'stein', ['muell'])).toBeNull();
  });
});
