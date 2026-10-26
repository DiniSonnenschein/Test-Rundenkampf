import { describe, expect, it } from 'vitest';
import { DEFAULT_ABILITY, type AbilityFields } from './abilities';
import { currentUnit, getUnit, placeUnit } from './battle';
import { DEFAULT_BEHAVIOR } from './behavior';
import { DEFAULT_CHARACTER, newCharacterResource } from './characters';
import type { Defs } from './defs';
import { DEFAULT_EFFECT, UNCONSCIOUS_ID } from './effects';
import { affordable, executeAbility, legalTargets } from './execute';
import { changeResource } from './status';
import { normalizeGame } from './game';
import { normalizeLevel } from './level';
import { DEFAULT_OBJECT } from './objects';
import { DEFAULT_RESOURCE, INITIATIVE_ID } from './resources';
import { DEFAULT_RULES } from './rules';
import { beginCombat, canUndo, createRun, finishTurn, nextLevel, refreshTemplates, runSummary, toCtx, fromCtx, undo, type RunState } from './run';
import { DEFAULT_TERRAIN } from './terrain';

const look = { shape: 'kreis', color: '#fff', size: 1 };

function ability(title: string, patch: Partial<AbilityFields>): AbilityFields & { title: string } {
  return { ...DEFAULT_ABILITY, ...patch, title, targeting: { ...DEFAULT_ABILITY.targeting, ...patch.targeting } };
}

function makeDefs(): Defs {
  const big: string[] = [];
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) big.push(`${x},${y}`);
  return {
    rules: DEFAULT_RULES,
    resources: {
      [INITIATIVE_ID]: { ...DEFAULT_RESOURCE, title: 'Initiative' },
      lp: { ...DEFAULT_RESOURCE, title: 'LP', events: [{ direction: 'faellt', threshold: 0, action: { kind: 'effekt', target: 'selbst', effectId: UNCONSCIOUS_ID, duration: { kind: 'bis-aufloesung' } } }] },
      mana: { ...DEFAULT_RESOURCE, title: 'Mana' },
    },
    effects: { [UNCONSCIOUS_ID]: { ...DEFAULT_EFFECT, title: 'Bewusstlos', blocks: [{ kind: 'verlust', what: 'zug', typeIds: [] }] } },
    abilities: {
      schlag: ability('Schlag', { costs: [{ kind: 'ressource', resourceId: 'mana', amount: 2 }], blocks: [{ kind: 'ressource', resourceId: 'lp', amount: -4, mayExceedMax: false, extraCosts: [] }] }),
      laufen: ability('Laufen', {
        targeting: { ...DEFAULT_ABILITY.targeting, range: big, legal: { ...DEFAULT_ABILITY.targeting.legal, gegner: { on: false, typeIds: [], effectIds: [] }, leer: true } },
        blocks: [{ kind: 'anwender-bewegen', area: big, ignoresObstacles: false, extraCosts: [] }],
      }),
    },
    objects: { fels: { ...DEFAULT_OBJECT, ...look, title: 'Fels', collision: true } },
    terrains: {
      boden: { ...DEFAULT_TERRAIN, title: 'Boden' },
      eis: { ...DEFAULT_TERRAIN, title: 'Eis', slippery: true },
    },
    allys: {
      ritter: {
        ...DEFAULT_CHARACTER,
        ...look,
        title: 'Ritter',
        sightArea: ['0,0'],
        resources: [
          { ...newCharacterResource(INITIATIVE_ID), start: 5 },
          { ...newCharacterResource('lp'), start: 10, max: 10 },
          { ...newCharacterResource('mana'), start: 3, max: 10 },
        ],
        actions: [
          { name: 'Bewegen', abilities: [{ abilityId: 'laufen', maxUses: 2 }] },
          { name: 'Angriff', abilities: [{ abilityId: 'schlag', maxUses: 1 }] },
        ],
      },
    },
    enemies: {
      goblin: {
        ...DEFAULT_CHARACTER,
        ...look,
        title: 'Goblin',
        resources: [{ ...newCharacterResource(INITIATIVE_ID), start: 1 }, { ...newCharacterResource('lp'), start: 4, max: 4 }],
        behavior: { ...DEFAULT_BEHAVIOR, events: [{ resourceId: 'lp', direction: 'faellt', threshold: 0, action: { kind: 'zerstoert' } }] },
      },
    },
    levels: {
      l1: {
        ...normalizeLevel({
          width: 8,
          height: 8,
          baseTerrainId: 'boden',
          terrain: { '4,6': 'eis', '5,6': 'eis' },
          lanternStart: { x: 1, y: 6 },
          victory: ['7,6'],
          enemies: [{ id: 'g1', enemyId: 'goblin', pos: { x: 2, y: 5 }, facing: 's', patrol: { points: [], mode: 'rundweg' } }],
          objects: [{ id: 'o1', objectId: 'fels', pos: { x: 3, y: 1 }, hidden: null }],
        }),
        title: 'Gang',
      },
    },
    dungeon: null,
    typeNames: {},
  };
}

const game = normalizeGame({
  content: { kind: 'levels', levelIds: ['l1', 'l1'] },
  team: [{ id: 'm1', allyId: 'ritter', items: null, resources: {} }],
  lanternMemberId: 'm1',
});

const act = (run: RunState, abilityId: string, targets: { x: number; y: number }[]) =>
  fromCtx(run, executeAbility(toCtx(run), 'm1', abilityId, targets));

describe('Spielablauf', () => {
  it('Platzierung → Kampf → Angriff mit Kosten → Gegner wird zerstört', () => {
    let run = createRun(game, makeDefs());
    expect(run.battle.phase).toBe('platzierung');
    expect(getUnit(run.battle, 'm1')!.pos).toEqual({ x: 1, y: 6 });
    run = beginCombat(run);
    expect(currentUnit(run.battle)?.id).toBe('m1');
    const ctx = toCtx(run);
    const schlag = run.defs.abilities.schlag;
    expect(legalTargets(ctx, 'm1', schlag)).toEqual([{ x: 2, y: 5 }]);
    expect(affordable(ctx, 'm1', schlag)).toBe(true);
    run = act(run, 'schlag', [{ x: 2, y: 5 }]);
    expect(getUnit(run.battle, 'm1')!.values!.mana).toBe(1);
    expect(getUnit(run.battle, 'g1')!.status).toBe('entfernt');
    expect(affordable(toCtx(run), 'm1', schlag)).toBe(false);
  });

  it('Laufen auf kürzestem Weg, Rutschen auf Eis, Sieg und nächstes Level', () => {
    let run = beginCombat(createRun(game, makeDefs()));
    run = act(run, 'laufen', [{ x: 4, y: 6 }]);
    // Eis bei (4,6) und (5,6): rutscht weiter bis (6,6)
    expect(getUnit(run.battle, 'm1')!.pos).toEqual({ x: 6, y: 6 });
    expect(getUnit(run.battle, 'm1')!.facing).toBe('o');
    run = act(run, 'laufen', [{ x: 7, y: 6 }]);
    expect(run.result).toBe('level-gewonnen');
    run = nextLevel(run);
    expect(run.battle.phase).toBe('platzierung');
    expect(run.levelIndex).toBe(1);
  });

  it('Ressourcen-Event: LP auf 0 → Bewusstlos (setzt aus) → Run verloren', () => {
    const run = beginCombat(createRun(game, makeDefs()));
    const ctx = changeResource(toCtx(run), 'm1', 'lp', -20, false);
    const u = getUnit(ctx.battle, 'm1')!;
    expect(u.values!.lp).toBe(0);
    expect(u.effects!.map((e) => e.effectId)).toEqual([UNCONSCIOUS_ID]);
    expect(u.status).toBe('bewusstlos');
    expect(u.skipsTurns).toBe(true);
    expect(fromCtx(run, ctx).result).toBe('run-verloren');
  });

  it('Rückgängig: zum Beginn des eigenen Zuges', () => {
    let run = beginCombat(createRun(game, makeDefs()));
    expect(canUndo(run)).toBe(true); // Platzierung → Kampfbeginn
    run = act(run, 'laufen', [{ x: 1, y: 4 }]);
    expect(getUnit(run.battle, 'm1')!.pos).toEqual({ x: 1, y: 4 });
    run = undo(run);
    expect(getUnit(run.battle, 'm1')!.pos).toEqual({ x: 1, y: 6 });
    expect(run.battle.phase).toBe('kampf');
  });

  it('Runden laufen weiter; Gegnerzug wird übersprungen', () => {
    let run = beginCombat(createRun(game, makeDefs()));
    run = finishTurn(run); // → Goblin
    expect(currentUnit(run.battle)?.id).toBe('g1');
    run = finishTurn(run); // → Runde 2, Ritter
    expect(run.battle.round).toBe(2);
    expect(currentUnit(run.battle)?.id).toBe('m1');
  });

  it('Platzierung im Lichtkegel', () => {
    const run = createRun(game, makeDefs());
    expect(() => placeUnit(run.battle, 'm1', { x: 0, y: 0 })).toThrow();
  });

  it('Vorlagen aktualisieren: neue Werte aus den Editoren, Spielwerte bleiben', () => {
    let run = beginCombat(createRun(game, makeDefs()));
    run = act(run, 'laufen', [{ x: 1, y: 4 }]);
    run = fromCtx(run, changeResource(toCtx(run), 'm1', 'lp', -3, false));
    const fresh = makeDefs();
    fresh.abilities.schlag = { ...fresh.abilities.schlag, title: 'Hieb' };
    fresh.allys.ritter = { ...fresh.allys.ritter, title: 'Paladin', sightArea: ['0,0', '0,-1'], actions: [{ name: 'Angriff', abilities: [{ abilityId: 'schlag', maxUses: 1 }] }] };
    delete (fresh.enemies as Record<string, unknown>).goblin;
    const next = refreshTemplates(run, fresh);
    const u = getUnit(next.battle, 'm1')!;
    expect(next.defs.abilities.schlag.title).toBe('Hieb');
    expect(u.name).toBe('Paladin');
    expect(u.actions.map((a) => a.name)).toEqual(['Angriff']);
    expect(u.sightArea).toEqual(['0,0', '0,-1']);
    expect(u.values!.lp).toBe(7);
    expect(u.pos).toEqual({ x: 1, y: 4 });
    expect(next.defs.enemies.goblin.title).toBe('Goblin'); // gelöscht → alte Fassung bleibt
    expect(runSummary(next)).toEqual({ dungeon: null, level: 'Gang', status: 'Runde 1', allys: ['Paladin'] });
  });
});

describe('Statistik & Debug', () => {
  it('zählt Züge, Felder, Fähigkeiten und gesenkte Ressourcen; Undo setzt zurück', async () => {
    const { mergeStats, sideTotal } = await import('./stats');
    let run = beginCombat(createRun(game, makeDefs()));
    run = act(run, 'laufen', [{ x: 1, y: 5 }]);
    run = act(run, 'schlag', [{ x: 2, y: 5 }]);
    const st = run.stats!.at(-1)!.stats;
    const r = st.units.m1;
    expect(r.turns).toBe(1);
    expect(r.moved).toBe(1);
    expect(r.abilities).toEqual({ laufen: 1, schlag: 1 });
    expect(r.lowered).toEqual({ lp: 4 });
    expect(sideTotal(st, 'ally').lowered).toEqual({ lp: 4 });
    expect(mergeStats([st, st]).units.m1.lowered).toEqual({ lp: 8 });
    expect(run.log).toContain('▶ Ritter ist am Zug');
    run = undo(run);
    expect(run.stats!.at(-1)!.stats.units.m1.abilities).toEqual({});
  });

  it('Debug: Ressource setzen, Gegner hinzufügen, Level gewinnen – zählt nicht in der Statistik', async () => {
    const { debugAddEnemy, debugSetResource, debugWinLevel } = await import('./debug');
    let run = beginCombat(createRun(game, makeDefs()));
    run = debugSetResource(run, 'g1', 'lp', 1);
    expect(getUnit(run.battle, 'g1')!.values!.lp).toBe(1);
    expect(run.log.some((l) => l.startsWith('🛠'))).toBe(true);
    run = debugAddEnemy(run, 'goblin', { x: 5, y: 5 });
    expect(run.battle.units.filter((u) => u.side === 'enemy' && u.status !== 'entfernt')).toHaveLength(2);
    expect(run.stats!.at(-1)!.stats.units.m1?.lowered ?? {}).toEqual({});
    run = debugWinLevel(run);
    expect(run.result).toBe('level-gewonnen');
  });

  it('KI-Absicht: Hauptziel und nächste Fähigkeit', async () => {
    const { aiIntent } = await import('./ai');
    const defs = makeDefs();
    defs.enemies.goblin = { ...defs.enemies.goblin, sightArea: ['0,0', '-1,1', '0,1', '1,1'], actions: [{ name: 'Angriff', abilities: [{ abilityId: 'schlag', maxUses: 1 }] }] };
    defs.enemies.goblin.resources = [...defs.enemies.goblin.resources, { ...newCharacterResource('mana'), start: 5, max: 5 }];
    const run = beginCombat(createRun(game, defs));
    expect(aiIntent(toCtx(run), 'g1')).toEqual({ targetId: 'm1', abilityId: 'schlag' });
  });
});

describe('Größen & Sicht im Licht', () => {
  it('Breite × Höhe: Figuren und Objekte belegen alle ihre Felder', async () => {
    const { unitTiles } = await import('./battle');
    const { canEnter, objectsAt } = await import('./execute');
    const defs = makeDefs();
    defs.allys.ritter = { ...defs.allys.ritter, size: 1, height: 2 };
    defs.objects.fels = { ...defs.objects.fels, size: 2, height: 1 };
    const run = beginCombat(createRun(game, defs));
    const r = getUnit(run.battle, 'm1')!;
    expect(unitTiles(r)).toHaveLength(2);
    expect(objectsAt(run.battle, { x: 4, y: 1 })).toHaveLength(1);
    expect(run.battle.map.blocked).toContain('4,1');
    expect(canEnter(toCtx(run), { ...r, height: 1 }, { x: 4, y: 1 })).toBe(false);
  });

  it('Gegner im Fackellicht sieht nur das zusammenhängende Licht, nicht den Laternenbereich', async () => {
    const { perception } = await import('./execute');
    const defs = makeDefs();
    defs.objects.fackel = { ...defs.objects.fels, title: 'Fackel', collision: false, light: { on: true, area: ['-1,-1', '0,-1', '1,-1', '-1,0', '0,0', '1,0', '-1,1', '0,1', '1,1'], whenCarried: true } };
    defs.levels.l1 = { ...defs.levels.l1, objects: [{ id: 'f1', objectId: 'fackel', pos: { x: 6, y: 1 }, hidden: null }], enemies: [{ ...defs.levels.l1.enemies[0], pos: { x: 6, y: 2 } }] };
    defs.enemies.goblin = { ...defs.enemies.goblin, sightArea: ['0,0'] };
    const run = beginCombat(createRun(game, defs));
    const seen = perception(toCtx(run), getUnit(run.battle, 'g1')!);
    expect(seen.has('7,0')).toBe(true); // Fackellicht
    expect(seen.has('1,5')).toBe(false); // Laternenlicht, durch Dunkelheit getrennt
    // Steht die Fackel so, dass sich die Lichtbereiche berühren, sieht er auch den Laternenbereich.
    const near = makeDefs();
    near.objects.fackel = defs.objects.fackel;
    near.enemies.goblin = defs.enemies.goblin;
    near.levels.l1 = { ...near.levels.l1, objects: [{ id: 'f1', objectId: 'fackel', pos: { x: 5, y: 4 }, hidden: null }], enemies: [{ ...near.levels.l1.enemies[0], pos: { x: 5, y: 3 } }] };
    const run2 = beginCombat(createRun(game, near));
    expect(perception(toCtx(run2), getUnit(run2.battle, 'g1')!).has('1,5')).toBe(true);
  });
});
