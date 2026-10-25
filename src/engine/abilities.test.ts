import { describe, expect, it } from 'vitest';
import { canPay, DEFAULT_ABILITY, resourceCosts, traceProjectile, type AbilityFields } from './abilities';
import { posKey, type Pos } from './grid';

const map = { width: 10, height: 10 };
const walls = (keys: string[]) => (p: Pos) => keys.includes(posKey(p));

describe('Fähigkeiten: Kosten', () => {
  const a: AbilityFields = {
    ...DEFAULT_ABILITY,
    costs: [{ kind: 'ressource', resourceId: 'mana', amount: 2 }],
    costIncreases: [
      { per: 'ziel', resourceId: 'mana', amount: 1 },
      { per: 'entfernung', resourceId: 'ausdauer', amount: 1 },
    ],
    blocks: [{ kind: 'sammeln', extraCosts: [{ kind: 'ressource', resourceId: 'mana', amount: 3 }] }],
  };

  it('Grundkosten + Bausteine + Steigerung je zusätzlichem Ziel und Entfernung', () => {
    expect(resourceCosts(a, { targets: 1, distances: [2] })).toEqual({ mana: 5, ausdauer: 2 });
    expect(resourceCosts(a, { targets: 3, distances: [1, 2, 3] })).toEqual({ mana: 7, ausdauer: 6 });
  });

  it('nur nutzbar, wenn bezahlbar', () => {
    expect(canPay({ mana: 5 }, { mana: 5 })).toBe(true);
    expect(canPay({ mana: 5 }, { mana: 4 })).toBe(false);
  });
});

describe('Fähigkeiten: Flugbahn', () => {
  it('fliegt gerade zum Ziel', () => {
    const r = traceProjectile(map, { x: 0, y: 0 }, { x: 3, y: 0 }, () => false, () => false, 0);
    expect(r.outcome).toBe('ziel');
    expect(r.path.map(posKey)).toEqual(['1,0', '2,0', '3,0']);
  });

  it('endet am Hindernis ohne Abpraller', () => {
    const r = traceProjectile(map, { x: 0, y: 0 }, { x: 5, y: 0 }, walls(['3,0']), () => false, 0);
    expect(r.outcome).toBe('hindernis');
    expect(r.end).toEqual({ x: 3, y: 0 });
    expect(r.path.map(posKey)).toEqual(['1,0', '2,0', '3,0']);
  });

  it('prallt gerade zurück und trifft, was in Flugrichtung liegt', () => {
    const r = traceProjectile(map, { x: 2, y: 0 }, { x: 5, y: 0 }, walls(['4,0']), (p) => posKey(p) === '0,0', 1);
    expect(r.bounces.map(posKey)).toEqual(['4,0']);
    expect(r.outcome).toBe('ziel');
    expect(r.end).toEqual({ x: 0, y: 0 });
  });

  it('prallt diagonal an einer Wand ab (Einfallswinkel = Ausfallswinkel)', () => {
    // Wand in Spalte 4 – Flug nach rechts unten wird nach links unten gespiegelt.
    const wall = Array.from({ length: 10 }, (_, y) => `4,${y}`);
    const r = traceProjectile(map, { x: 1, y: 0 }, { x: 5, y: 4 }, walls(wall), (p) => posKey(p) === '1,5', 1);
    expect(r.bounces).toHaveLength(1);
    expect(r.outcome).toBe('ziel');
    expect(r.end).toEqual({ x: 1, y: 5 });
  });

  it('verschwindet, wenn sie das Spielfeld verlässt', () => {
    const r = traceProjectile(map, { x: 2, y: 0 }, { x: 5, y: 0 }, walls(['4,0']), () => false, 1);
    expect(r.outcome).toBe('verlassen');
  });
});
