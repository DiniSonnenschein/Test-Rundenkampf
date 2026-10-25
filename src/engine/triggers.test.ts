import { describe, expect, it } from 'vitest';
import { DEFAULT_ABILITY, type AbilityFields } from './abilities';
import { currentUnit, getUnit } from './battle';
import { DEFAULT_BEHAVIOR } from './behavior';
import { DEFAULT_CHARACTER, newCharacterResource } from './characters';
import type { Defs } from './defs';
import { DEFAULT_EFFECT, UNCONSCIOUS_ID } from './effects';
import { executeAbility } from './execute';
import { normalizeGame } from './game';
import { normalizeLevel } from './level';
import { DEFAULT_OBJECT } from './objects';
import { DEFAULT_RESOURCE, INITIATIVE_ID } from './resources';
import { DEFAULT_RULES } from './rules';
import { aiTurnStep, beginCombat, createRun, finishTurn, fromCtx, isAllyTurn, resolveReaction, toCtx, type RunState } from './run';
import { DEFAULT_TERRAIN } from './terrain';

const look = { shape: 'kreis', color: '#fff', size: 1 };
const big: string[] = [];
for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) big.push(`${x},${y}`);

function ability(title: string, patch: Partial<AbilityFields>): AbilityFields & { title: string } {
  return { ...DEFAULT_ABILITY, ...patch, title, targeting: { ...DEFAULT_ABILITY.targeting, ...patch.targeting } };
}
const damage = (amount: number) => [{ kind: 'ressource' as const, resourceId: 'lp', amount, mayExceedMax: false, extraCosts: [] }];
const laufen = ability('Laufen', {
  targeting: { ...DEFAULT_ABILITY.targeting, range: big, legal: { ...DEFAULT_ABILITY.targeting.legal, gegner: { on: false, typeIds: [], effectIds: [] }, leer: true } },
  blocks: [{ kind: 'anwender-bewegen', area: big, ignoresObstacles: false, extraCosts: [] }],
});

function makeDefs(patch: (d: Defs) => void = () => {}): Defs {
  const d: Defs = {
    rules: DEFAULT_RULES,
    resources: {
      [INITIATIVE_ID]: { ...DEFAULT_RESOURCE, title: 'Initiative' },
      lp: { ...DEFAULT_RESOURCE, title: 'LP' },
    },
    effects: {
      [UNCONSCIOUS_ID]: { ...DEFAULT_EFFECT, title: 'Bewusstlos', blocks: [{ kind: 'verlust', what: 'zug', typeIds: [] }] },
      wut: { ...DEFAULT_EFFECT, title: 'Wut', triggers: [{ kind: 'ressource-aenderung', resourceId: 'lp', change: 'negativ', min: 0 }] },
    },
    abilities: {
      laufen,
      schlag: ability('Schlag', { blocks: damage(-2) }),
      konter: ability('Konter', {
        targeting: { ...DEFAULT_ABILITY.targeting, legal: { ...DEFAULT_ABILITY.targeting.legal, gegner: { on: false, typeIds: [], effectIds: [] }, ausfuehrend: { on: true, typeIds: [] } } },
        triggers: [{ kind: 'ziel', from: 'gegner', typeIds: [] }],
        blocks: damage(-1),
      }),
    },
    objects: {
      falle: {
        ...DEFAULT_OBJECT,
        ...look,
        title: 'Falle',
        collectible: false,
        workings: [{ trigger: { kind: 'bereich', event: 'betritt', allys: true, gegner: false, typeIds: [], effectIds: [] }, area: ['0,0'], target: 'traeger', ending: 'nie', blocks: damage(-3) }],
      },
    },
    terrains: { boden: { ...DEFAULT_TERRAIN, title: 'Boden' } },
    allys: {
      ritter: {
        ...DEFAULT_CHARACTER,
        ...look,
        title: 'Ritter',
        sightArea: big,
        resources: [{ ...newCharacterResource(INITIATIVE_ID), start: 5 }, { ...newCharacterResource('lp'), start: 10, max: 10 }],
        actions: [
          { name: 'Bewegen', abilities: [{ abilityId: 'laufen', maxUses: 1 }] },
          { name: 'Angriff', abilities: [{ abilityId: 'schlag', maxUses: 1 }] },
        ],
        reactions: [{ name: 'Konter', abilityIds: ['konter'], limit: 'runde', count: 1 }],
      },
    },
    enemies: {
      goblin: {
        ...DEFAULT_CHARACTER,
        ...look,
        title: 'Goblin',
        sightArea: big,
        resources: [{ ...newCharacterResource(INITIATIVE_ID), start: 1 }, { ...newCharacterResource('lp'), start: 6, max: 6 }],
        actions: [
          { name: 'Bewegen', abilities: [{ abilityId: 'laufen', maxUses: 1 }] },
          { name: 'Angriff', abilities: [{ abilityId: 'schlag', maxUses: 1 }] },
        ],
        behavior: { ...DEFAULT_BEHAVIOR },
      },
    },
    levels: {
      l1: {
        ...normalizeLevel({
          width: 9,
          height: 9,
          baseTerrainId: 'boden',
          lanternStart: { x: 1, y: 7 },
          victory: ['8,0'],
          enemies: [{ id: 'g1', enemyId: 'goblin', pos: { x: 5, y: 7 }, facing: 'w', patrol: { points: [], mode: 'rundweg' } }],
          objects: [{ id: 'o1', objectId: 'falle', pos: { x: 1, y: 5 }, hidden: null }],
        }),
        title: 'Halle',
      },
    },
    dungeon: null,
    typeNames: {},
  };
  patch(d);
  return d;
}

const game = normalizeGame({
  content: { kind: 'level', levelId: 'l1' },
  team: [{ id: 'm1', allyId: 'ritter', items: null, resources: {} }],
  lanternMemberId: 'm1',
});

const act = (run: RunState, casterId: string, abilityId: string, targets: { x: number; y: number }[]) =>
  fromCtx(run, executeAbility(toCtx(run), casterId, abilityId, targets));
const lp = (run: RunState, id: string) => getUnit(run.battle, id)!.values!.lp;

function aiTurn(run: RunState): RunState {
  for (let i = 0; i < 40; i++) {
    const next = aiTurnStep(run);
    if (!next || next === run) return next ? run : finishTurn(run);
    run = next;
  }
  return finishTurn(run);
}

describe('Objekt-Wirkungen', () => {
  it('Betreten einer Falle kostet den Betretenden LP', () => {
    let run = beginCombat(createRun(game, makeDefs()));
    run = act(run, 'm1', 'laufen', [{ x: 1, y: 4 }]);
    expect(getUnit(run.battle, 'm1')!.pos).toEqual({ x: 1, y: 4 });
    expect(lp(run, 'm1')).toBe(7);
  });
});

describe('Effekt-Auslöser', () => {
  it('Wut kommt hinzu, sobald LP sinken', () => {
    let run = beginCombat(createRun(game, makeDefs()));
    run = act(run, 'm1', 'laufen', [{ x: 1, y: 4 }]);
    expect(getUnit(run.battle, 'm1')!.effects!.map((e) => e.effectId)).toContain('wut');
  });
});

describe('Gegner-KI', () => {
  it('Goblin läuft zum Ritter und schlägt zu', () => {
    let run = beginCombat(createRun(game, makeDefs()));
    run = finishTurn(run);
    expect(currentUnit(run.battle)?.id).toBe('g1');
    expect(isAllyTurn(run)).toBe(false);
    run = aiTurn(run);
    const g = getUnit(run.battle, 'g1')!;
    expect(Math.max(Math.abs(g.pos!.x - 1), Math.abs(g.pos!.y - 7))).toBe(1);
    expect(lp(run, 'm1')).toBe(8);
  });
});

describe('Reaktionen', () => {
  it('Ally darf kontern, wenn ein Gegner ihn anvisiert – einmal pro Runde', () => {
    let run = beginCombat(createRun(game, makeDefs()));
    run = act(run, 'm1', 'laufen', [{ x: 4, y: 7 }]);
    run = finishTurn(run);
    run = aiTurnStep(run)!; // Goblin schlägt (steht schon daneben)
    expect(lp(run, 'm1')).toBe(8);
    expect(run.pending?.[0]).toMatchObject({ unitId: 'm1', abilityIds: ['konter'], sourceId: 'g1' });
    // Während die Reaktion offen ist, wartet die KI.
    expect(aiTurnStep(run)).toBe(run);
    run = resolveReaction(run, 'konter', [{ x: 5, y: 7 }]);
    expect(run.pending).toEqual([]);
    expect(lp(run, 'g1')).toBe(5);
    expect(getUnit(run.battle, 'm1')!.reactionUses?.[0]?.count).toBe(1);
  });

  it('Überspringen verbraucht die Reaktion nicht', () => {
    let run = beginCombat(createRun(game, makeDefs()));
    run = act(run, 'm1', 'laufen', [{ x: 4, y: 7 }]);
    run = finishTurn(run);
    run = aiTurnStep(run)!;
    run = resolveReaction(run, null);
    expect(run.pending).toEqual([]);
    expect(getUnit(run.battle, 'm1')!.reactionUses?.[0]).toBeUndefined();
  });

  it('Gegner reagieren über Regeln „Als Reaktion“', () => {
    const defs = makeDefs((d) => {
      d.enemies.goblin.reactions = [{ name: 'Konter', abilityIds: ['konter'], limit: 'runde', count: 1 }];
      d.enemies.goblin.behavior = {
        ...DEFAULT_BEHAVIOR,
        rules: [{ zug: false, reaktion: true, conditions: [], abilityId: 'konter', target: { kind: 'hauptziel' } }],
      };
      d.abilities.konter.triggers = [{ kind: 'ziel', from: 'allys', typeIds: [] }];
    });
    let run = beginCombat(createRun(game, defs));
    run = act(run, 'm1', 'laufen', [{ x: 4, y: 7 }]);
    run = act(run, 'm1', 'schlag', [{ x: 5, y: 7 }]);
    expect(lp(run, 'g1')).toBe(4);
    expect(lp(run, 'm1')).toBe(9);
  });
});

describe('Patrouille', () => {
  it('Gegner ohne Ziel laufen ihre Patrouille ab', () => {
    const defs = makeDefs((d) => {
      d.enemies.goblin.sightArea = ['0,0'];
      d.enemies.goblin.behavior = { ...DEFAULT_BEHAVIOR, idle: 'patrouille' };
      d.levels.l1 = {
        ...d.levels.l1,
        enemies: [{ id: 'g1', enemyId: 'goblin', pos: { x: 7, y: 1 }, facing: 's', patrol: { points: [{ x: 7, y: 1 }, { x: 7, y: 4 }], mode: 'hin-zurueck' } }],
      };
    });
    let run = beginCombat(createRun(game, defs));
    expect(getUnit(run.battle, 'g1')!.patrol?.points).toHaveLength(2);
    run = aiTurn(finishTurn(run));
    expect(getUnit(run.battle, 'g1')!.pos).toEqual({ x: 7, y: 4 });
  });
});
