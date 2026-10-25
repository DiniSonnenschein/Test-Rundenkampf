import { describe, expect, it } from 'vitest';
import { posKey, type Pos } from './grid';
import { canWalk, normalizeTerrain, slide, terrainCosts, tileColor } from './terrain';

describe('Geländearten', () => {
  it('Begehbarkeit: ja / nein / nur mit Typ oder Effekt', () => {
    const t = normalizeTerrain({ walkable: 'bedingt', walkableFor: { typeIds: ['fisch'], effectIds: ['schwimmen'] } });
    expect(canWalk(t, [], [])).toBe(false);
    expect(canWalk(t, ['fisch'], [])).toBe(true);
    expect(canWalk(t, [], ['schwimmen'])).toBe(true);
    expect(canWalk(normalizeTerrain({ walkable: 'nein' }), ['fisch'], [])).toBe(false);
  });

  it('Schachbrett-Farben', () => {
    const t = normalizeTerrain({ colors: { light: '#fff', dark: '#000' } });
    expect(tileColor(t, { x: 0, y: 0 })).toBe('#fff');
    expect(tileColor(t, { x: 1, y: 0 })).toBe('#000');
  });

  it('erhöht Kosten für Fähigkeiten bestimmter (oder aller) Typen', () => {
    const t = normalizeTerrain({
      costIncreases: [
        { typeIds: ['bewegung'], resourceId: 'schritte', amount: 1 },
        { typeIds: [], resourceId: 'mana', amount: 2 },
      ],
    });
    expect(terrainCosts(t, ['bewegung'])).toEqual({ schritte: 1, mana: 2 });
    expect(terrainCosts(t, ['feuer'])).toEqual({ mana: 2 });
  });

  it('Weiterrutschen bis zum Hindernis oder nicht-rutschigen Feld', () => {
    const map = { width: 10, height: 3 };
    const ice = (p: Pos) => p.x >= 2 && p.x <= 6;
    const wall = (p: Pos) => posKey(p) === '5,1';
    expect(slide(map, { x: 1, y: 0 }, { x: 2, y: 0 }, ice, () => false).map(posKey)).toEqual(['3,0', '4,0', '5,0', '6,0', '7,0']);
    expect(slide(map, { x: 1, y: 1 }, { x: 2, y: 1 }, ice, wall).map(posKey)).toEqual(['3,1', '4,1']);
    expect(slide(map, { x: 0, y: 0 }, { x: 1, y: 0 }, ice, () => false)).toEqual([]);
  });
});
