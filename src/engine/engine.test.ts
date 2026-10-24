import { describe, expect, it } from 'vitest';
import {
  createBattle, currentUnit, endTurn, grantExtraTurn, moveUnit, placeUnit, placementArea,
  placementSnapshot, removeUnit, setUnconscious, startBattle, useActionSlot, visible, type BattleMap, type BattleState,
} from './battle';
import { recordTurn, undoTurns } from './history';
import { distance, hasLineOfSight, neighbors, posKey, reachable, type Grid } from './grid';
import { initiativeOrder } from './initiative';
import { litTiles } from './light';
import { DEFAULT_RULES, normalizeRules, type Rules } from './rules';

const rulesWith = (defeat: Partial<Rules['defeat']>) => normalizeRules({ defeat: { ...DEFAULT_RULES.defeat, ...defeat } });

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
  it('Laterne beleuchtet einen Kreis, schattenwerfende Felder blockieren', () => {
    const lit = litTiles(grid(9, 9, ['5,4']), [{ pos: { x: 4, y: 4 }, radius: 3 }], 'kreis');
    expect(lit.has('4,4')).toBe(true);
    expect(lit.has('5,4')).toBe(true);
    expect(lit.has('7,4')).toBe(false);
    expect(lit.has('4,7')).toBe(true);
    expect(lit.has('7,7')).toBe(false);
    expect(litTiles(grid(9, 9), [{ pos: { x: 4, y: 4 }, radius: 3 }], 'quadrat').has('7,7')).toBe(true);
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

  it('Nebel: ohne Licht ist (fast) nichts sichtbar; Eigensicht je Charakter', () => {
    const s = setup();
    expect(visible(s).has('9,0')).toBe(false);
    expect(visible(s).has('2,4')).toBe(true);
    const far = moveUnit(startBattle(s), 'ritter', { x: 9, y: 8 });
    expect(visible(far).has('9,7')).toBe(false);
    const seeing = { ...far, units: far.units.map((u) => (u.id === 'ritter' ? { ...u, sight: 1 } : u)) };
    expect(visible(seeing).has('9,7')).toBe(true);
  });

  it('die Laterne brennt auch, wenn der Träger bewusstlos ist', () => {
    const s = setUnconscious(startBattle(setup()), 'laterne', true);
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

  it('Sieg erst, wenn alle Allys (auch bewusstlose) auf Siegfeldern stehen', () => {
    let s = startBattle(setup());
    s = moveUnit(s, 'laterne', { x: 9, y: 9 });
    expect(s.phase).toBe('kampf');
    s = moveUnit(s, 'laterne', { x: 7, y: 9 }); // Siegfelder dürfen wieder verlassen werden
    s = moveUnit(s, 'ritter', { x: 8, y: 9 });
    s = setUnconscious(s, 'ritter', true);
    expect(s.phase).toBe('kampf');
    s = moveUnit(s, 'laterne', { x: 9, y: 9 });
    expect(s.phase).toBe('sieg');
  });

  it('Run verloren nach X verpassten Zügen in Bewusstlosigkeit (auch Laternenträger)', () => {
    let s = startBattle(setup(rulesWith({ unconsciousTurns: 2 })));
    s = setUnconscious(s, 'laterne', true); // war am Zug → Zug endet sofort
    expect(currentUnit(s)?.id).toBe('ritter');
    s = endTurn(endTurn(s)); // Runde 2: Laterne verpasst 1. Zug
    expect(s.units[0].missedTurns).toBe(1);
    expect(s.phase).toBe('kampf');
    s = endTurn(endTurn(s)); // Runde 3: 2. verpasster Zug
    expect(s.phase).toBe('niederlage');
    expect(s.outcome).toContain('Laterne');
  });

  it('Aufwecken setzt den Zähler zurück; 0 = aus', () => {
    let s = startBattle(setup(rulesWith({ unconsciousTurns: 2 })));
    s = setUnconscious(s, 'laterne', true);
    s = endTurn(endTurn(s));
    s = setUnconscious(s, 'laterne', false);
    expect(s.units[0].missedTurns).toBe(0);

    let t = setUnconscious(startBattle(setup(rulesWith({ unconsciousTurns: 0 }))), 'ritter', true);
    for (let i = 0; i < 10; i++) t = endTurn(t);
    expect(t.phase).toBe('kampf');
  });

  it('Run verloren bei zu vielen gleichzeitig Bewusstlosen', () => {
    let s = setUnconscious(startBattle(setup(rulesWith({ unconsciousCount: 1 }))), 'ritter', true);
    expect(s.phase).toBe('niederlage');
    s = setUnconscious(startBattle(setup()), 'ritter', true);
    expect(s.phase).toBe('kampf');
    s = setUnconscious(s, 'laterne', true);
    expect(s.phase).toBe('niederlage');
  });

  it('entfernte Gegner verlieren ihre Züge', () => {
    let s = removeUnit(startBattle(setup()), 'goblin');
    s = endTurn(endTurn(s));
    expect(s.round).toBe(2);
    expect(currentUnit(s)?.id).toBe('laterne');
  });
});

describe('Züge rückgängig', () => {
  it('springt an den Beginn früherer Züge zurück', () => {
    const map: BattleMap = { width: 5, height: 5, blocked: [], opaque: [], victory: [], lanternStart: { x: 0, y: 0 } };
    let s = startBattle(createBattle({
      rules: DEFAULT_RULES, map,
      allies: [{ id: 'a', name: 'A', pos: null, lantern: {}, actionSlots: [] }],
      enemies: [{ id: 'g', name: 'G', pos: { x: 4, y: 4 }, actionSlots: [] }],
    }));
    let h: BattleState[] = recordTurn([], s);
    s = moveUnit(s, 'a', { x: 1, y: 1 });
    h = recordTurn(h, s);
    expect(h).toHaveLength(1);
    s = endTurn(s); h = recordTurn(h, s);
    s = endTurn(s); h = recordTurn(h, s);
    expect(h).toHaveLength(3);
    const back = undoTurns(h, 3)!;
    expect(back.state.round).toBe(1);
    expect(back.state.units[0].pos).toEqual({ x: 0, y: 0 });
    expect(back.history).toHaveLength(1);
    expect(undoTurns(h, 99)!.state).toBe(h[0]);
  });
});
