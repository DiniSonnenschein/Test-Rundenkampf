import { describe, expect, it } from 'vitest';
import { DEFAULT_CHARACTER, newCharacterResource } from './characters';
import type { Defs } from './defs';
import { DEFAULT_EFFECT } from './effects';
import { normalizeGame } from './game';
import { allItems, buy, claimReward, moveItem, resetInterlude, rewardsLeft, sell, stockLeft, unclaimedRewards } from './interlude';
import { normalizeLevel } from './level';
import { DEFAULT_OBJECT } from './objects';
import { DEFAULT_RESOURCE, INITIATIVE_ID } from './resources';
import { DEFAULT_RULES } from './rules';
import { beginCombat, createRun, fromCtx, nextLevel, toCtx, type RunState } from './run';
import { changeResource } from './status';
import { DEFAULT_TERRAIN } from './terrain';
import type { InterludeBlock } from './dungeon';

const look = { shape: 'kreis', color: '#fff', size: 1 };

function makeDefs(interlude: InterludeBlock[], patch: (d: Defs) => void = () => {}): Defs {
  const level = (title: string) => ({
    ...normalizeLevel({ width: 4, height: 4, baseTerrainId: 'boden', lanternStart: { x: 0, y: 0 }, victory: ['3,3'], enemies: [], objects: [] }),
    title,
  });
  const d: Defs = {
    rules: DEFAULT_RULES,
    resources: {
      [INITIATIVE_ID]: { ...DEFAULT_RESOURCE, title: 'Initiative' },
      lp: { ...DEFAULT_RESOURCE, title: 'LP' },
      mana: { ...DEFAULT_RESOURCE, title: 'Mana' },
      gold: { ...DEFAULT_RESOURCE, title: 'Gold', scope: 'global', hasMax: false, start: 10 },
    },
    effects: { segen: { ...DEFAULT_EFFECT, title: 'Segen' } },
    abilities: {},
    objects: {
      trank: { ...DEFAULT_OBJECT, ...look, title: 'Trank', typeIds: ['traenke'], stack: { stackable: true, max: 5 } },
      schwert: { ...DEFAULT_OBJECT, ...look, title: 'Schwert' },
    },
    terrains: { boden: { ...DEFAULT_TERRAIN, title: 'Boden' } },
    allys: {
      ritter: {
        ...DEFAULT_CHARACTER,
        ...look,
        title: 'Ritter',
        backpackSlots: 1,
        resources: [
          { ...newCharacterResource(INITIATIVE_ID), start: 5 },
          { ...newCharacterResource('lp'), start: 10, max: 10 },
          { ...newCharacterResource('mana'), start: 2, max: 8 },
        ],
      },
      magier: { ...DEFAULT_CHARACTER, ...look, title: 'Magier', resources: [{ ...newCharacterResource('lp'), start: 6, max: 6 }] },
    },
    enemies: {},
    levels: { l1: level('Eins'), l2: level('Zwei') },
    dungeon: {
      title: 'Höhle',
      stations: [
        { id: 'a', name: 'A', levelId: 'l1', next: ['b'], interlude },
        { id: 'b', name: 'B', levelId: 'l2', next: [], interlude: [] },
      ],
    },
    typeNames: {},
  };
  patch(d);
  return d;
}

const game = (extra: object = {}) =>
  normalizeGame({
    content: { kind: 'dungeon', dungeonId: 'x' },
    team: [
      { id: 'm1', allyId: 'ritter', items: [], resources: {} },
      { id: 'm2', allyId: 'magier', items: [], resources: {} },
    ],
    lanternMemberId: 'm1',
    ...extra,
  });

/** Level 1 gewinnen (alle auf Siegfelder zu setzen ist hier unnötig – Ergebnis direkt setzen). */
function win(run: RunState, hurt = true): RunState {
  run = beginCombat(run);
  if (hurt) run = fromCtx(run, changeResource(toCtx(run), 'm1', 'lp', -6, false));
  return { ...run, result: 'level-gewonnen', choices: ['b'] };
}

const member = (run: RunState, id: string) => run.team.find((m) => m.memberId === id)!;

describe('Levelwechsel', () => {
  it('Regelwerk: Ressourcen behalten, auffüllen oder auf Start setzen', () => {
    const defs = makeDefs([], (d) => {
      d.rules = { ...DEFAULT_RULES, betweenLevels: { resources: 'max', overrides: [{ resourceId: 'mana', mode: 'start' }] } };
    });
    let run = createRun(game(), defs);
    run = win(run);
    run = { ...run, battle: { ...run.battle, units: run.battle.units.map((u) => (u.id === 'm1' ? { ...u, values: { ...u.values!, mana: 7 } } : u)) } };
    run = nextLevel(run);
    expect(run.levelId).toBe('l2');
    expect(member(run, 'm1').values.lp).toBe(10);
    expect(member(run, 'm1').values.mana).toBe(2);
  });

  it('Standard: Ressourcen bleiben; Ereignisse aus dem Spiel-Editor füllen auf', () => {
    const g = game({
      levelEvents: [
        { after: 'jedem-level', levelId: null, resourceId: 'lp', mode: 'betrag', amount: 2 },
        { after: 'level', levelId: 'l2', resourceId: 'lp', mode: 'max', amount: 0 },
        { after: 'level', levelId: 'l1', resourceId: 'gold', mode: 'betrag', amount: 5 },
      ],
    });
    let run = nextLevel(win(createRun(g, makeDefs([]))));
    expect(member(run, 'm1').values.lp).toBe(6);
    expect(run.globals.gold).toBe(15);
  });
});

describe('Zwischenstation', () => {
  it('Rast und Effekte wirken beim Betreten; danach geht es ins nächste Level', () => {
    const defs = makeDefs([
      { kind: 'rast', changes: [{ resourceId: 'lp', amount: 3 }, { resourceId: 'gold', amount: 4 }] },
      { kind: 'effekte', action: 'vergeben', effectId: 'segen', typeIds: [], duration: { kind: 'unendlich' } },
      { kind: 'text', title: 'Lagerfeuer', text: 'Es ist warm.' },
    ]);
    let run = nextLevel(win(createRun(game(), defs)));
    expect(run.interlude?.stationId).toBe('a');
    expect(run.result).toBeUndefined();
    expect(member(run, 'm1').values.lp).toBe(7);
    expect(member(run, 'm2').values.lp).toBe(6);
    expect(run.globals.gold).toBe(14);
    expect(member(run, 'm1').effects.map((e) => e.effectId)).toEqual(['segen']);
    run = nextLevel(run);
    expect(run.interlude).toBeUndefined();
    expect(run.levelId).toBe('l2');
    expect(run.battle.units.find((u) => u.id === 'm1')!.effects!.map((e) => e.effectId)).toEqual(['segen']);
  });

  it('Belohnung: „wähle 1“, der Spieler bestimmt den Ally', () => {
    const defs = makeDefs([{ kind: 'belohnung', items: [{ objectId: 'trank', count: 2 }, { objectId: 'schwert', count: 1 }], choose: { on: true, count: 1 } }]);
    let run = nextLevel(win(createRun(game(), defs), false));
    expect(rewardsLeft(run, 0)).toBe(1);
    run = claimReward(run, 0, 0, 'm2');
    expect(allItems(member(run, 'm2'))).toEqual([{ objectId: 'trank', count: 2 }]);
    expect(claimReward(run, 0, 1, 'm1')).toBe(run);
    expect(unclaimedRewards(run)).toBe(0);
  });

  it('Händler: kaufen mit Vorrat, verkaufen, Rucksack voll → tragen; zurücksetzen', () => {
    const defs = makeDefs([
      {
        kind: 'haendler',
        currencyId: 'gold',
        typePrices: [{ typeId: 'traenke', buy: 3, sell: 1 }],
        objectPrices: [{ objectId: 'schwert', buy: 6, sell: 4 }],
        offers: [{ objectId: 'trank', stock: 1 }, { objectId: 'schwert', stock: null }],
        selling: true,
      },
    ]);
    let run = nextLevel(win(createRun(game(), defs), false));
    run = buy(run, 0, 0, 'm1');
    expect(run.globals.gold).toBe(7);
    expect(stockLeft(run, 0, 0)).toBe(0);
    expect(buy(run, 0, 0, 'm1')).toBe(run); // ausverkauft
    run = buy(run, 0, 1, 'm1'); // Rucksack (1 Platz) voll → wird getragen
    expect(run.globals.gold).toBe(1);
    expect(member(run, 'm1').carried).toEqual([{ objectId: 'schwert', count: 1 }]);
    expect(buy(run, 0, 1, 'm1')).toBe(run); // zu wenig Gold
    run = sell(run, 0, 'm1', 'schwert');
    expect(run.globals.gold).toBe(5);
    run = moveItem(run, 'm1', 'm2', 'trank');
    expect(allItems(member(run, 'm2'))).toEqual([{ objectId: 'trank', count: 1 }]);
    run = resetInterlude(run);
    expect(run.globals.gold).toBe(10);
    expect(stockLeft(run, 0, 0)).toBe(1);
    expect(allItems(member(run, 'm2'))).toEqual([]);
  });

  it('Händler ohne Ankauf: verkaufen nicht möglich', () => {
    const defs = makeDefs([{ kind: 'haendler', currencyId: 'gold', typePrices: [{ typeId: 'traenke', buy: 3, sell: 1 }], objectPrices: [], offers: [], selling: false }]);
    const run = nextLevel(win(createRun(game({ team: [{ id: 'm1', allyId: 'ritter', items: [{ objectId: 'trank', count: 1 }], resources: {} }] }), defs), false));
    expect(sell(run, 0, 'm1', 'trank')).toBe(run);
  });
});
