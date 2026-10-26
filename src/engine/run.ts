// Ein laufendes Spiel (Run): Team, globale Ressourcen, aktuelles Level, Verlauf zum Rückgängigmachen.
// Alles ist reines JSON und wird als Spielstand gespeichert.
import {
  checkOutcome, createBattle, currentUnit, mapObject, objectTiles, useAction, endTurn, getUnit, placementSnapshot, startBattle, type BattleMap, type BattleState, type MapObject,
  type Placement, type Unit,
} from './battle';
import { normalizeCharacter } from './characters';
import type { Defs } from './defs';
import { startStation } from './dungeon';
import type { ActiveEffect, TickEvent } from './effects';
import { memberItems, memberResources, type GameContent, type GameFields, type LevelEvent } from './game';
import { applyLevelEvents, carryResources, enterInterlude, type InterludeState, type Member } from './interlude';
import { posKey } from './grid';
import { isVictory, terrainAt } from './level';
import { INITIATIVE_ID } from './resources';
import { refreshDerived, tickGlobals, tickUnit, type Ctx } from './status';
import { emptyStats, recordTurn, type LevelStats } from './stats';
import { aiStep } from './ai';
import type { PendingReaction } from './events';
import { executeAbility, type ExecOptions } from './execute';
import type { Pos } from './grid';
import { aiControlled, areaPass, levelStartTriggers, markReactionUsed, processEvents, turnWorkings } from './triggers';

export type TeamState = Member;

/** Verlauf: Zustand zu Beginn jedes Ally-Zuges (bzw. der Platzierung). */
export interface Snapshot {
  battle: BattleState;
  globals: Record<string, number>;
  logLength: number;
  stats?: LevelStats[];
}

export interface RunState {
  version: 1;
  defs: Defs;
  content: GameContent;
  /** Position in einer Level-Folge. */
  levelIndex: number;
  /** Aktuelle Dungeon-Station. */
  stationId: string | null;
  levelId: string | null;
  lanternMemberId: string;
  team: TeamState[];
  globals: Record<string, number>;
  battle: BattleState;
  log: string[];
  history: Snapshot[];
  /** Zustand zu Beginn des Levels (für „Level neu starten“). */
  levelStart?: Snapshot;
  placement?: Placement;
  /** Ende des Levels bzw. des Runs. */
  result?: 'level-gewonnen' | 'run-gewonnen' | 'run-verloren';
  /** Nach einem Dungeon-Level: Folgestationen zur Auswahl. */
  choices?: string[];
  /** Ausgelöste Reaktionen von Allys, die auf eine Entscheidung warten. */
  pending?: PendingReaction[];
  /** „Startet damit ins Spiel“ wurde bereits ausgelöst. */
  gameStarted?: boolean;
  /** Ereignisse zwischen Leveln (aus dem Spiel-Editor). */
  levelEvents?: LevelEvent[];
  /** Startwerte der globalen Ressourcen in diesem Spiel. */
  globalStarts?: Record<string, number>;
  /** Zwischenstation nach einem Dungeon-Level (statt eines Kampfes). */
  interlude?: InterludeState;
  /** Spiel-Konfiguration vom Start (für „Vorlagen aktualisieren“). */
  game?: GameFields;
  /** Statistik je gespieltem Level. */
  stats?: LevelStats[];
}

const MAX_HISTORY = 60;

// ---------- Aufbau ----------

/** Erzeugt die Map eines Levels aus Gelände und Objekten (Hindernisse, Schatten, Licht). */
export function compileMap(defs: Defs, levelId: string, objects: MapObject[], terrain: Record<string, string>): BattleMap {
  const l = defs.levels[levelId];
  const blocked: string[] = [...l.voids];
  const opaque: string[] = [];
  const lights: BattleMap['lights'] = [];
  for (let y = 0; y < l.height; y++) {
    for (let x = 0; x < l.width; x++) {
      const k = posKey({ x, y });
      if (l.voids.includes(k)) continue;
      const t = defs.terrains[terrain[k]];
      if (!t) continue;
      if (t.walkable === 'nein') blocked.push(k);
      if (t.castsShadow) opaque.push(k);
      if (t.light.on) lights.push({ pos: { x, y }, area: t.light.area });
    }
  }
  for (const o of objects) {
    const d = defs.objects[o.objectId];
    if (!d) continue;
    for (const t of objectTiles(o)) {
      const k = posKey(t);
      if (d.collision) blocked.push(k);
      if (d.castsShadow) opaque.push(k);
      if (d.light.on) lights.push({ pos: t, area: d.light.area });
    }
  }
  return {
    width: l.width,
    height: l.height,
    blocked,
    opaque,
    voids: l.voids,
    lights,
    victory: l.victory.map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    }),
    lanternStart: l.lanternStart ?? { x: 0, y: 0 },
  };
}

/** Map nach Änderungen an Objekten oder Gelände neu berechnen. */
export function refreshMap(run: { defs: Defs; levelId: string | null; battle: BattleState }): BattleState {
  if (!run.levelId) return run.battle;
  return { ...run.battle, map: compileMap(run.defs, run.levelId, run.battle.objects ?? [], run.battle.terrain ?? {}) };
}

function allyUnit(defs: Defs, m: TeamState, lantern: boolean): Omit<Unit, 'side' | 'status'> {
  const a = defs.allys[m.allyId];
  return {
    id: m.memberId,
    name: a.title,
    pos: null,
    templateId: m.allyId,
    actions: a.actions,
    size: a.size,
    height: a.height,
    collision: a.collision,
    sightArea: a.sightArea,
    base: { sightArea: a.sightArea, collision: a.collision },
    typeIds: a.typeIds,
    values: { ...m.values },
    maxValues: { ...m.maxValues },
    items: m.items.map((i) => ({ ...i })),
    carried: (m.carried ?? []).map((i) => ({ ...i })),
    effects: m.effects,
    lantern: lantern ? {} : undefined,
    facing: 'n',
  };
}

function levelOf(run: Pick<RunState, 'content' | 'levelIndex' | 'stationId' | 'defs'>): string | null {
  const c = run.content;
  if (c.kind === 'level') return c.levelId;
  if (c.kind === 'levels') return c.levelIds[run.levelIndex] ?? null;
  return run.defs.dungeon?.stations.find((s) => s.id === run.stationId)?.levelId ?? null;
}

/** Baut den Kampf für das aktuelle Level (Platzierungsphase). */
function setupLevel(run: RunState): RunState {
  const levelId = levelOf(run);
  if (!levelId || !run.defs.levels[levelId]) return { ...run, levelId: null, result: 'run-verloren', log: [...run.log, 'Level fehlt.'] };
  const l = run.defs.levels[levelId];
  const terrain: Record<string, string> = {};
  for (let y = 0; y < l.height; y++) {
    for (let x = 0; x < l.width; x++) {
      const id = terrainAt(l, { x, y });
      if (id) terrain[posKey({ x, y })] = id;
    }
  }
  const objects: MapObject[] = l.objects
    .filter((o) => o.objectId && run.defs.objects[o.objectId])
    .map((o) => mapObject(run.defs.objects[o.objectId!], { id: o.id, objectId: o.objectId!, pos: o.pos, hidden: o.hidden ?? run.defs.objects[o.objectId!].hidden }));
  const enemies = l.enemies
    .filter((e) => e.enemyId && run.defs.enemies[e.enemyId])
    .map((e) => {
      const d = run.defs.enemies[e.enemyId!];
      return {
        id: e.id,
        name: d.title,
        pos: e.pos,
        facing: e.facing,
        templateId: e.enemyId!,
        actions: d.actions,
        size: d.size,
        height: d.height,
        collision: d.collision,
        sightArea: d.sightArea,
        base: { sightArea: d.sightArea, collision: d.collision },
        typeIds: d.typeIds,
        values: Object.fromEntries(d.resources.map((r) => [r.resourceId, r.start])),
        maxValues: Object.fromEntries(d.resources.map((r) => [r.resourceId, r.hasMax ? r.max : null])),
        items: [],
        effects: [],
        patrol: e.patrol.points.length ? { ...e.patrol, index: 0, forward: true } : undefined,
      };
    });
  let battle = createBattle({
    rules: run.defs.rules,
    map: compileMap(run.defs, levelId, objects, terrain),
    allies: run.team.map((m) => allyUnit(run.defs, m, m.memberId === run.lanternMemberId)),
    enemies,
    previous: run.placement,
  });
  battle = { ...battle, terrain, objects, revealed: [] };
  const stats = [...(run.stats ?? []), { levelId, title: l.title, stats: emptyStats() }];
  const next: RunState = { ...run, levelId, battle, stats, result: undefined, choices: undefined, log: [...run.log, `— ${l.title} —`] };
  return { ...next, history: [snapshot(next)], levelStart: snapshot(next) };
}

/** Neues Spiel aus einer Konfiguration. */
export function createRun(game: GameFields, defs: Defs): RunState {
  const team: TeamState[] = game.team
    .filter((m) => m.allyId && defs.allys[m.allyId])
    .map((m) => {
      const ally = normalizeCharacter(defs.allys[m.allyId!]);
      const res = memberResources(m, ally);
      return {
        memberId: m.id,
        allyId: m.allyId!,
        values: Object.fromEntries(res.map((r) => [r.resourceId, r.start])),
        startValues: Object.fromEntries(res.map((r) => [r.resourceId, r.start])),
        maxValues: Object.fromEntries(res.map((r) => [r.resourceId, r.hasMax ? r.max : null])),
        items: memberItems(m, ally).filter((i): i is { objectId: string; count: number } => !!i.objectId),
        effects: [],
      };
    });
  const globals = Object.fromEntries(
    Object.entries(defs.resources)
      .filter(([, r]) => r.scope === 'global')
      .map(([id, r]) => [id, game.globalStarts[id] ?? r.start]),
  );
  const content = game.content;
  const stationId = content.kind === 'dungeon' && defs.dungeon ? startStation(defs.dungeon)?.id ?? null : null;
  const run: RunState = {
    version: 1,
    defs,
    content,
    levelIndex: 0,
    stationId,
    levelId: null,
    lanternMemberId: game.lanternMemberId ?? team[0]?.memberId ?? '',
    team,
    globals,
    battle: null as unknown as BattleState,
    log: [],
    history: [],
    levelEvents: game.levelEvents,
    globalStarts: globals,
    game,
  };
  // Start-Effekte der Allys.
  let r = setupLevel(run);
  let ctx = toCtx(r);
  for (const m of team) {
    for (const fx of defs.allys[m.allyId].startEffects) {
      if (fx.effectId) ctx = applyStartEffect(ctx, m.memberId, fx.effectId, fx.duration);
    }
  }
  r = fromCtx(r, ctx);
  return { ...r, history: [snapshot(r)], levelStart: snapshot(r) };
}

function applyStartEffect(ctx: Ctx, unitId: string, effectId: string, duration: ActiveEffect['duration']): Ctx {
  const u = getUnit(ctx.battle, unitId);
  if (!u) return ctx;
  const instance: ActiveEffect = { instanceId: `start-${unitId}-${effectId}`, effectId, duration, counters: {} };
  ctx = { ...ctx, battle: { ...ctx.battle, units: ctx.battle.units.map((x) => (x.id === unitId ? { ...x, effects: [...(x.effects ?? []), instance] } : x)) } };
  return refreshDerived(ctx, unitId);
}

// ---------- Ablauf ----------

export const toCtx = (run: RunState): Ctx => ({
  defs: run.defs, battle: run.battle, globals: run.globals, log: run.log, pending: run.pending ?? [], stats: run.stats?.at(-1)?.stats ?? emptyStats(),
});

/** Übernimmt einen veränderten Kontext und prüft Sieg/Niederlage. */
export function fromCtx(run: RunState, ctx: Ctx): RunState {
  if (run.battle.phase === 'kampf') ctx = processEvents(ctx);
  const stats = run.stats?.length && ctx.stats ? [...run.stats.slice(0, -1), { ...run.stats[run.stats.length - 1], stats: ctx.stats }] : run.stats;
  let next: RunState = { ...run, battle: ctx.battle, globals: ctx.globals, log: ctx.log, pending: ctx.pending ?? [], stats };
  next = { ...next, battle: checkOutcome(refreshMap(next)) };
  if (ctx.result === 'niederlage' || next.battle.phase === 'niederlage') {
    return { ...next, result: 'run-verloren', log: [...next.log, `Run verloren${next.battle.outcome ? `: ${next.battle.outcome}` : '.'}`] };
  }
  if (ctx.result === 'sieg') return { ...next, result: 'run-gewonnen', log: [...next.log, 'Run gewonnen!'] };
  if (next.battle.phase === 'sieg' && !next.result) return finishLevel(next);
  return next;
}

/** Zeitpunkt für alle bzw. einen Charakter und die globalen Ressourcen. */
function tick(ctx: Ctx, event: TickEvent, unitId?: string): Ctx {
  if (unitId) {
    if (event.unit === 'zug' && event.timing === 'beginn') {
      const u = ctx.battle.units.find((x) => x.id === unitId);
      ctx = { ...ctx, log: [...ctx.log, `▶ ${u?.name ?? '?'} ist am Zug`], stats: ctx.stats && recordTurn(ctx.stats, ctx.battle, unitId) };
    }
    ctx = tickUnit(ctx, unitId, event);
    return event.unit === 'zug' ? turnWorkings(ctx, unitId, event.timing) : ctx;
  }
  for (const u of ctx.battle.units) if (u.status !== 'entfernt') ctx = tickUnit(ctx, u.id, event);
  return tickGlobals(ctx, event);
}

/** Bestätigt die Platzierung: Initiative festlegen, Level- und Runden-Beginn, erster Zug. */
export function beginCombat(run: RunState): RunState {
  let ctx = toCtx(run);
  ctx = { ...ctx, battle: startBattle(ctx.battle), log: [...ctx.log, 'Runde 1'] };
  ctx = areaPass(ctx, false);
  const level = run.levelId ? run.defs.levels[run.levelId] : undefined;
  ctx = levelStartTriggers(ctx, !run.gameStarted, {
    enemies: (level?.enemies ?? []).map((e) => e.enemyId ?? ''),
    objects: (level?.objects ?? []).map((o) => o.objectId ?? ''),
    allys: run.team.map((m) => m.allyId),
  });
  ctx = tick(ctx, { unit: 'level', timing: 'beginn' });
  ctx = tick(ctx, { unit: 'runde', timing: 'beginn' });
  const first = currentUnit(ctx.battle);
  if (first) ctx = tick(ctx, { unit: 'zug', timing: 'beginn' }, first.id);
  const next = fromCtx({ ...run, placement: placementSnapshot(run.battle), gameStarted: true }, { ...ctx, battle: { ...ctx.battle, phase: 'kampf' } });
  return recordIfAllyTurn(next);
}

/** Beendet den aktuellen Zug (mit allen Zeitpunkten) und beginnt den nächsten. */
export function finishTurn(run: RunState): RunState {
  if (run.result || run.battle.phase !== 'kampf') return run;
  let ctx = toCtx(run);
  const before = currentUnit(ctx.battle);
  if (before) ctx = tick(ctx, { unit: 'zug', timing: 'ende' }, before.id);
  const round = ctx.battle.round;
  ctx = { ...ctx, battle: endTurn(ctx.battle) };
  if (ctx.battle.round > round) {
    ctx = tick({ ...ctx, battle: { ...ctx.battle, round } }, { unit: 'runde', timing: 'ende' });
    ctx = { ...ctx, battle: { ...ctx.battle, round: round + 1 }, log: [...ctx.log, `Runde ${round + 1}`] };
    ctx = tick(ctx, { unit: 'runde', timing: 'beginn' });
  }
  const now = currentUnit(ctx.battle);
  if (now) ctx = tick(ctx, { unit: 'zug', timing: 'beginn' }, now.id);
  return recordIfAllyTurn(fromCtx(run, ctx));
}

function snapshot(run: RunState): Snapshot {
  return { battle: run.battle, globals: run.globals, logLength: run.log.length, stats: run.stats };
}

function recordIfAllyTurn(run: RunState): RunState {
  if (run.result || !isAllyTurn(run)) return run;
  return { ...run, history: [...run.history, snapshot(run)].slice(-MAX_HISTORY) };
}

/** Wird gerade ein Ally-Zug (bzw. die Platzierung) ausgeführt, der seit dem letzten Stand verändert wurde? */
const changedSince = (run: RunState, s: Snapshot) => JSON.stringify(s.battle) !== JSON.stringify(run.battle) || JSON.stringify(s.globals) !== JSON.stringify(run.globals);

/** Einen Zug zurück: zum Beginn des aktuellen Ally-Zuges bzw. – falls unverändert – des vorherigen. */
export function undo(run: RunState): RunState {
  const h = run.history;
  if (!h.length) return run;
  let target = h[h.length - 1];
  let history = h;
  if (!changedSince(run, target) && h.length > 1) {
    history = h.slice(0, -1);
    target = history[history.length - 1];
  }
  return {
    ...run, battle: target.battle, globals: target.globals, stats: target.stats ?? run.stats,
    log: [...run.log.slice(0, target.logLength), '↶ Zug zurückgenommen'], history, result: undefined, choices: undefined, pending: [],
  };
}

export const canUndo = (run: RunState) => run.history.length > 1 || (run.history.length === 1 && changedSince(run, run.history[0]));

// ---------- Levelwechsel ----------

/** Werte, Gegenstände und (laut Regelwerk) Effekte der Allys ins nächste Level übernehmen. */
function carryTeam(run: RunState): TeamState[] {
  return run.team.map((m) => {
    const u = getUnit(run.battle, m.memberId);
    if (!u) return m;
    return {
      ...m,
      values: { ...(u.values ?? m.values) },
      maxValues: { ...(u.maxValues ?? m.maxValues) },
      items: (u.items ?? m.items).map((i) => ({ ...i })),
      carried: (u.carried ?? []).map((i) => ({ ...i })),
      effects: run.defs.rules.effectsPersistAcrossLevels ? (u.effects ?? []) : [],
    };
  });
}

export function finishLevel(run: RunState): RunState {
  let ctx = tick(toCtx(run), { unit: 'level', timing: 'ende' });
  const done = { ...run, battle: ctx.battle, globals: ctx.globals, log: [...ctx.log, 'Level geschafft!'] };
  const c = run.content;
  if (c.kind === 'level' || (c.kind === 'levels' && run.levelIndex >= c.levelIds.length - 1)) return { ...done, result: 'run-gewonnen', log: [...done.log, 'Run gewonnen!'] };
  if (c.kind === 'levels') return { ...done, result: 'level-gewonnen' };
  const station = run.defs.dungeon?.stations.find((s) => s.id === run.stationId);
  if (!station || station.next.length === 0) return { ...done, result: 'run-gewonnen', log: [...done.log, 'Run gewonnen!'] };
  return { ...done, result: 'level-gewonnen', choices: station.next };
}

/**
 * Weiter: nach einem geschafften Level zur Zwischenstation (falls vorhanden) bzw. ins nächste Level;
 * aus einer Zwischenstation ins nächste Level (bei Verzweigung mit gewählter Station).
 */
export function nextLevel(run: RunState, stationId?: string): RunState {
  if (run.interlude) {
    const choices = run.interlude.choices;
    return setupLevel({ ...run, interlude: undefined, stationId: stationId ?? choices[0] ?? null });
  }
  if (run.result !== 'level-gewonnen') return run;
  // Levelwechsel: Werte übernehmen, Regelwerk (Ressourcen) und Ereignisse aus dem Spiel-Editor anwenden.
  const party = applyLevelEvents(
    run.defs,
    { team: carryResources(run.defs, carryTeam(run)), globals: run.globals, log: run.log },
    run.levelEvents ?? [],
    run.levelId,
    run.globalStarts ?? {},
  );
  const base: RunState = { ...run, ...party, placement: placementSnapshot(run.battle) };
  if (run.content.kind === 'levels') return setupLevel({ ...base, levelIndex: run.levelIndex + 1 });
  const station = run.defs.dungeon?.stations.find((s) => s.id === run.stationId);
  if (station?.interlude.length) {
    return { ...enterInterlude(base, station.id, run.choices ?? station.next), result: undefined, choices: undefined, pending: [] };
  }
  return setupLevel({ ...base, stationId: stationId ?? run.choices?.[0] ?? null });
}

/** Level neu starten (Zustand wie zu Beginn der Platzierung). */
export function restartLevel(run: RunState): RunState {
  const first = run.levelStart;
  if (!first) return run;
  return { ...run, battle: first.battle, globals: first.globals, stats: first.stats ?? run.stats, pending: [], log: [...run.log.slice(0, first.logLength), '↺ Level neu gestartet'], history: [first], result: undefined, choices: undefined };
}

/** Ist ein vom Spieler gesteuerter Ally am Zug? (Allys mit Verhaltens-Effekt steuert die KI.) */
export const isAllyTurn = (run: RunState) => {
  const u = currentUnit(run.battle);
  return !run.result && !run.interlude && run.battle.phase === 'kampf' && u?.side === 'ally' && !aiControlled(toCtx(run), u);
};

/** Führt eine Fähigkeit aus der Oberfläche heraus aus (Aktion wird verbraucht). */
export function performAbility(run: RunState, action: number, abilityId: string, targets: Pos[], opts: ExecOptions = {}): RunState {
  const unit = currentUnit(run.battle);
  if (!unit) return run;
  const next: RunState = { ...run, battle: useAction(run.battle, action, abilityId) };
  return fromCtx(next, executeAbility(toCtx(next), unit.id, abilityId, targets, opts));
}

/** Eine ausgelöste Reaktion nutzen (abilityId) oder überspringen (null). */
export function resolveReaction(run: RunState, abilityId: string | null, targets: Pos[] = [], opts: ExecOptions = {}): RunState {
  const [p, ...rest] = run.pending ?? [];
  if (!p) return run;
  let ctx: Ctx = { ...toCtx(run), pending: rest };
  if (abilityId) {
    ctx = markReactionUsed(ctx, p.unitId, p.reaction);
    ctx = executeAbility(ctx, p.unitId, abilityId, targets, { ...opts, reaction: { sourceId: p.sourceId, targetIds: p.targetIds } });
  }
  return fromCtx(run, ctx);
}

/** Ein KI-Schritt; null = Zug ist zu Ende. */
export function aiTurnStep(run: RunState): RunState | null {
  if (run.result || run.interlude || run.battle.phase !== 'kampf') return null;
  if (run.pending?.length) return run; // erst die Reaktionen der Allys abwarten
  const ctx = aiStep(toCtx(run));
  return ctx ? fromCtx(run, ctx) : null;
}
export const victoryTile = (run: RunState, x: number, y: number) => !!run.levelId && isVictory(run.defs.levels[run.levelId], { x, y });
export const initiativeOf = (u: Unit) => u.values?.[INITIATIVE_ID] ?? 0;

// ---------- Vorlagen aktualisieren ----------

/**
 * Übernimmt die aktuellen Vorlagen aus den Editoren in ein laufendes Spiel. Was im Spiel entstanden ist
 * (Werte, Effekte, Gegenstände, Positionen), bleibt. Gelöschte Vorlagen bleiben in der alten Fassung erhalten.
 * Das gerade laufende Level behält seine Map; Änderungen an Leveln wirken ab dem nächsten Level.
 */
export function refreshTemplates(run: RunState, fresh: Defs): RunState {
  const old = run.defs;
  const merge = <T>(a: Record<string, T>, b: Record<string, T>) => ({ ...a, ...b });
  const levels = merge(old.levels, fresh.levels);
  if (run.levelId && !run.interlude && old.levels[run.levelId]) levels[run.levelId] = old.levels[run.levelId];
  const defs: Defs = {
    rules: fresh.rules,
    resources: merge(old.resources, fresh.resources),
    effects: merge(old.effects, fresh.effects),
    abilities: merge(old.abilities, fresh.abilities),
    objects: merge(old.objects, fresh.objects),
    terrains: merge(old.terrains, fresh.terrains),
    allys: merge(old.allys, fresh.allys),
    enemies: merge(old.enemies, fresh.enemies),
    levels,
    dungeon: fresh.dungeon ?? old.dungeon,
    typeNames: merge(old.typeNames, fresh.typeNames),
  };
  const update = (b: BattleState): BattleState => {
    if (!b) return b;
    let ctx: Ctx = { defs, battle: { ...b, rules: defs.rules }, globals: run.globals, log: [] };
    ctx = {
      ...ctx,
      battle: {
        ...ctx.battle,
        units: ctx.battle.units.map((u) => {
          const t = u.templateId ? (u.side === 'ally' ? defs.allys[u.templateId] : defs.enemies[u.templateId]) : undefined;
          if (!t) return u;
          return { ...u, name: t.title, size: t.size, height: t.height, typeIds: t.typeIds, base: { sightArea: t.sightArea, collision: t.collision } };
        }),
      },
    };
    for (const u of ctx.battle.units) ctx = refreshDerived(ctx, u.id);
    return refreshMap({ defs, levelId: run.levelId, battle: ctx.battle });
  };
  const snap = (s: Snapshot): Snapshot => ({ ...s, battle: update(s.battle) });
  return {
    ...run,
    defs,
    battle: run.interlude ? run.battle : update(run.battle),
    history: run.interlude ? run.history : run.history.map(snap),
    levelStart: run.levelStart && !run.interlude ? snap(run.levelStart) : run.levelStart,
    log: [...run.log, '↻ Vorlagen aktualisiert'],
  };
}

// ---------- Übersicht ----------

/** Kurzinfo für die Spielstand-Liste: Dungeon, Level, Runde bzw. Stand, Allys. */
export function runSummary(run: RunState): { dungeon: string | null; level: string; status: string; allys: string[] } {
  const d = run.defs;
  const status = run.interlude
    ? 'Zwischenstation'
    : run.result === 'run-gewonnen'
      ? 'gewonnen'
      : run.result === 'run-verloren'
        ? 'verloren'
        : run.result === 'level-gewonnen'
          ? 'Level geschafft'
          : run.battle?.phase === 'platzierung'
            ? 'Platzierung'
            : `Runde ${run.battle?.round ?? 1}`;
  return {
    dungeon: run.content.kind === 'dungeon' ? d.dungeon?.title ?? null : null,
    level: run.levelId ? d.levels[run.levelId]?.title ?? '?' : '?',
    status,
    allys: run.team.map((m) => d.allys[m.allyId]?.title ?? '?'),
  };
}
