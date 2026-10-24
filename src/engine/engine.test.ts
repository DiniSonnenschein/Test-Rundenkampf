import { describe, expect, it } from 'vitest';
import {
  createBattle, currentUnit, endTurn, grantExtraTurn, knockOut, moveUnit, placeUnit, placementArea,
  placementSnapshot, revive, startBattle, useActionSlot, visible, type BattleMap,
} from './battle';
import { distance, hasLineOfSight, neighbors, posKey, reachable, type Grid } from './grid';
import { initiativeOrder } from './initiative';
import { litTiles } from './light';
import { DEFAULT_RULES, normalizeRules, type Rules } from './rules';

function grid(w: number, h: number, walls: string[] = []): Grid {
  const set = new Set(walls);
  return { width: w, height: h, isPassable: (p) => !set.has(posKey(p)), blocksSight: (p) => set.has(posKey(p)) };
}

describe('Raster', () => {
  it('Nachbarn mit und ohne Diagonale', () => {
    const g = grid(5, 5);
    expect(neighbors(g, { x: 2, y: 2 }, { diagonal: true, cornerCutting: false })).toHaveLength(8);
    expect(neighbors(g, { x: 2, y: 2 }, { diagonal: false, cornerCutting: false })).toHaveLength(4);
    expect(neighbors(g, { x: 0, y: 0 }, { diagonal: true, cornerCutting: false })).toHaveLength(3);
  });

  it('keine Diagonale an Hindernis-Ecken vorbei (außer erlaubt)', () => {
    const g = grid(3, 3, ['1,0']);
    const from = { x: 0, y: 0 };
    expect(neighbors(g, from, { diagonal: true, cornerCutting: false }).map(posKey)).not.toContain('1,1');
    expect(neighbors(g, from, { diagonal: true, cornerCutting: true }).map(posKey)).toContain('1,1');
  });

  it('Entfernung und erreichbare Felder', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 2 }, true)).toBe(3);
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 2 }, false)).toBe(5);
    const r = reachable(grid(5, 5), { x: 0, y: 0 }, 2, { diagonal: true, cornerCutting: false });
    expect(r.get('2,2')).toBe(2);
    expect(r.has('3,0')).toBe(false);
  });

  it('Sichtlinie wird von Wänden blockiert', () => {
    const g = grid(5, 1, ['2,0']);
    expect(hasLineOfSight(g, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
    expect(hasLineOfSight(g, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(true);
  });
});

describe('Licht', () => {
  const light = DEFAULT_RULES.light;
  it('Laterne beleuchtet einen Kreis, Wände werfen Schatten', () => {
    const lit = litTiles(grid(9, 9, ['5,4']), [{ pos: { x: 4, y: 4 }, radius: 3 }], light);
    expect(lit.has('4,4') && lit.has('7,4') === false && lit.has('5,4')).toBe(true);
    expect(lit.has('4,7')).toBe(true);
    expect(lit.has('7,7')).toBe(false);
    const noShadow = litTiles(grid(9, 9, ['5,4']), [{ pos: { x: 4, y: 4 }, radius: 3 }], { ...light, blockedBySight: false });
    expect(noShadow.has('7,4')).toBe(true);
  });
});

describe('Initiative', () => {
  const units = [
    { id: 'a1', side: 'ally' as const, v: 5 },
    { id: 'a2', side: 'ally' as const, v: 3 },
    { id: 'g1', side: 'enemy' as const, v: 5 },
    { id: 'g2', side: 'enemy' as const, v: 3 },
  ];
  const get = (u: { v: number }) => u.v;
  const criteria = [{ resourceId: 'tempo', factor: 1 }];

  it('höchster Wert zuerst, Gleichstand nach Regel', () => {
    expect(initiativeOrder(units, { criteria, tieBreak: 'allys-zuerst' }, get)).toEqual(['a1', 'g1', 'a2', 'g2']);
    expect(initiativeOrder(units, { criteria, tieBreak: 'gegner-zuerst' }, get)).toEqual(['g1', 'a1', 'g2', 'a2']);
  });

  it('ohne Kriterien: Allys, dann Gegner bzw. abwechselnd', () => {
    expect(initiativeOrder(units, { criteria: [], tieBreak: 'allys-zuerst' }, get)).toEqual(['a1', 'a2', 'g1', 'g2']);
    expect(initiativeOrder(units, { criteria: [], tieBreak: 'abwechselnd' }, get)).toEqual(['a1', 'g1', 'a2', 'g2']);
  });
});

describe('Kampfablauf', () => {
  const map: BattleMap = {
    width: 10, height: 10, blocked: ['4,2'], opaque: ['4,2'], victory: [{ x: 9, y: 9 }, { x: 8, y: 9 }], lanternStart: { x: 2, y: 2 },
  };
  const slots = [['bewegen'], ['angriff', 'zauber']];
  const setup = (rules: Rules = DEFAULT_RULES, previous?: Record<string, { dx: number; dy: number }>) =>
    createBattle({
      rules,
      map,
      allies: [
        { id: 'laterne', name: 'Laterne', pos: null, lantern: {}, actionSlots: slots },
        { id: 'ritter', name: 'Ritter', pos: null, actionSlots: slots },
      ],
      enemies: [{ id: 'goblin', name: 'Goblin', pos: { x: 9, y: 0 }, actionSlots: slots }],
      previous,
    });

  it('Laternenträger steht fest, übrige Allys im Lichtkegel', () => {
    const s = setup();
    expect(s.phase).toBe('platzierung');
    expect(s.units[0].pos).toEqual({ x: 2, y: 2 });
    const area = placementArea(s).map(posKey);
    expect(area).toContain(posKey(s.units[1].pos!));
    expect(area).not.toContain('4,2');
    expect(() => placeUnit(s, 'laterne', { x: 1, y: 1 })).toThrow('fest');
    expect(() => placeUnit(s, 'ritter', { x: 9, y: 9 })).toThrow('Lichtkegel');
    expect(placeUnit(s, 'ritter', { x: 1, y: 1 }).units[1].pos).toEqual({ x: 1, y: 1 });
  });

  it('Platzierung wird ins nächste Level übernommen', () => {
    const s = placeUnit(setup(), 'ritter', { x: 1, y: 3 });
    const snap = placementSnapshot(s);
    expect(snap).toEqual({ ritter: { dx: -1, dy: 1 } });
    expect(setup(DEFAULT_RULES, snap).units[1].pos).toEqual({ x: 1, y: 3 });
  });

  it('Nebel: ohne Licht ist (fast) nichts sichtbar', () => {
    const s = setup();
    expect(visible(s).has('9,0')).toBe(false);
    expect(visible(s).has('2,4')).toBe(true);
  });

  it('Runden, Züge und Aktionsplätze', () => {
    let s = startBattle(setup());
    expect(s.round).toBe(1);
    expect(s.order).toEqual(['laterne', 'ritter', 'goblin']);
    expect(currentUnit(s)?.id).toBe('laterne');
    s = useActionSlot(s, 1, 'zauber');
    expect(() => useActionSlot(s, 1, 'angriff')).toThrow('schon genutzt');
    expect(() => useActionSlot(s, 0, 'zauber')).toThrow('nicht erlaubt');
    s = endTurn(s);
    expect(currentUnit(s)?.id).toBe('ritter');
    s = grantExtraTurn(s, 'ritter');
    s = endTurn(s);
    expect(currentUnit(s)?.id).toBe('ritter');
    s = endTurn(endTurn(s));
    expect(s.round).toBe(2);
    expect(currentUnit(s)?.id).toBe('laterne');
  });

  it('mehrere Züge pro Runde', () => {
    let s = startBattle(setup({ ...DEFAULT_RULES, turnsPerRound: 2 }));
    expect(s.queue).toEqual(['laterne', 'ritter', 'goblin', 'laterne', 'ritter', 'goblin']);
    s = { ...s, units: s.units.map((u) => (u.id === 'goblin' ? { ...u, turnsPerRound: 1 } : u)) };
    s = endTurn(s);
    expect(s.queue).toHaveLength(5);
  });

  it('Sieg, sobald alle Allys auf Siegfeldern stehen', () => {
    let s = startBattle(setup());
    s = moveUnit(s, 'laterne', { x: 9, y: 9 });
    expect(s.phase).toBe('kampf');
    s = moveUnit(s, 'ritter', { x: 8, y: 9 });
    expect(s.phase).toBe('sieg');
  });

  it('bewusstlose Allys zählen (einstellbar) nicht für den Sieg', () => {
    let s = startBattle(setup());
    s = knockOut(s, 'ritter');
    expect(s.units[1].status).toBe('bewusstlos');
    s = moveUnit(s, 'laterne', { x: 9, y: 9 });
    expect(s.phase).toBe('sieg');

    const strict = normalizeRules({ ko: { unconsciousExcludedFromVictory: false } });
    let t = knockOut(startBattle(setup(strict)), 'ritter');
    t = moveUnit(t, 'laterne', { x: 9, y: 9 });
    expect(t.phase).toBe('kampf');
    t = revive(t, 'ritter');
    expect(t.units[1].status).toBe('aktiv');
  });

  it('Niederlage, wenn kein Ally mehr steht oder (einstellbar) die Laterne fällt', () => {
    let s = knockOut(knockOut(startBattle(setup()), 'ritter'), 'laterne');
    expect(s.phase).toBe('niederlage');
    s = knockOut(startBattle(setup(normalizeRules({ ko: { defeatOnLanternLoss: true } }))), 'laterne');
    expect(s.phase).toBe('niederlage');
  });

  it('K.O. des aktiven Charakters beendet seinen Zug; Gegner verschwinden', () => {
    let s = startBattle(setup());
    s = knockOut(s, 'laterne');
    expect(currentUnit(s)?.id).toBe('ritter');
    s = knockOut(s, 'goblin');
    expect(s.units[2].status).toBe('tot');
    s = endTurn(s);
    expect(s.round).toBe(2);
    expect(currentUnit(s)?.id).toBe('ritter');
  });
});
