import { describe, expect, it } from 'vitest';
import {
  checker, floodTiles, normalizeLevel, paint, paintMany, placementError, rectTiles, resize, terrainAt, toggleVictory, upsertThing,
  validateLevel, type Templates,
} from './level';

const tpl: Templates = {
  enemy: (id) => ({ size: id === 'riese' ? 2 : 1, collision: id !== 'geist' }),
  object: (id) => ({ collision: id === 'fels' }),
};
const base = () => normalizeLevel({ width: 6, height: 6, baseTerrainId: 'boden' });

describe('Level', () => {
  it('malen, Rechteck, „kein Feld“ und Farbeimer', () => {
    let l = paint(base(), { x: 1, y: 1 }, 'wasser');
    expect(terrainAt(l, { x: 1, y: 1 })).toBe('wasser');
    l = paint(l, { x: 1, y: 1 }, 'boden');
    expect(l.terrain).toEqual({});
    l = paintMany(l, rectTiles({ x: 0, y: 0 }, { x: 2, y: 1 }), 'wasser');
    expect(Object.keys(l.terrain)).toHaveLength(6);
    expect(floodTiles(l, { x: 0, y: 0 })).toHaveLength(6);
    l = paint(l, { x: 5, y: 5 }, null);
    expect(l.voids).toEqual(['5,5']);
    expect(floodTiles(l, { x: 5, y: 5 })).toHaveLength(1);
  });

  it('Schachbrett: hellere Farbe automatisch auf geraden Feldern', () => {
    expect(checker(['#000000', '#ffffff'], { x: 0, y: 0 })).toBe('#ffffff');
    expect(checker(['#000000', '#ffffff'], { x: 1, y: 0 })).toBe('#000000');
  });

  it('pro Feld höchstens ein Ding mit Kollision, beliebig viele ohne', () => {
    let l = base();
    const fels = { kind: 'objekt' as const, item: { id: 'o1', objectId: 'fels', pos: { x: 2, y: 2 }, hidden: null } };
    l = upsertThing(l, fels);
    const ork = { kind: 'gegner' as const, item: { id: 'g1', enemyId: 'ork', pos: { x: 0, y: 0 }, facing: 's' as const, patrol: { points: [], mode: 'rundweg' as const } } };
    expect(placementError(l, ork, { x: 2, y: 2 }, tpl)).toContain('nur ein Ding');
    expect(placementError(l, { ...ork, item: { ...ork.item, enemyId: 'geist' } }, { x: 2, y: 2 }, tpl)).toBeNull();
    expect(placementError(l, { kind: 'objekt', item: { id: 'o2', objectId: 'schluessel', pos: { x: 0, y: 0 }, hidden: true } }, { x: 2, y: 2 }, tpl)).toBeNull();
    expect(placementError(l, { ...ork, item: { ...ork.item, enemyId: 'riese' } }, { x: 1, y: 1 }, tpl)).toContain('nur ein Ding');
    expect(placementError(l, { ...ork, item: { ...ork.item, enemyId: 'riese' } }, { x: 5, y: 0 }, tpl)).toContain('Passt nicht');
    expect(placementError(paint(l, { x: 4, y: 4 }, null), ork, { x: 4, y: 4 }, tpl)).toContain('kein Feld');
  });

  it('verkleinern entfernt, was außerhalb liegt', () => {
    let l = toggleVictory(paint(base(), { x: 5, y: 5 }, 'wasser'), { x: 5, y: 0 });
    l = { ...l, lanternStart: { x: 5, y: 5 } };
    l = resize(l, 4, 4);
    expect(l.terrain).toEqual({});
    expect(l.victory).toEqual([]);
    expect(l.lanternStart).toBeNull();
  });

  it('Prüfung', () => {
    const w = validateLevel(base(), tpl, () => true);
    expect(w).toContain('Kein Laternen-Startfeld.');
    expect(w).toContain('Keine Siegfelder.');
    const ok = toggleVictory({ ...base(), lanternStart: { x: 0, y: 0 } }, { x: 5, y: 5 });
    expect(validateLevel(ok, tpl, () => true)).toEqual(['1 Siegfeld – reicht für höchstens 1 Ally.']);
  });
});
