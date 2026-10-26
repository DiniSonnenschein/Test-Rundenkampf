// Debug-Menü: Eingriffe während des Spiels zum Austesten. Alles wird im Protokoll mit 🛠 markiert
// und zählt nicht in der Statistik (kein Verursacher).
import { getUnit, removeUnit } from './battle';
import { titleOf } from './defs';
import { objectsAt, spawnEnemy } from './execute';
import type { Pos } from './grid';
import { finishLevel, fromCtx, toCtx, type RunState } from './run';
import { changeResource, endEffects, giveEffect, refreshDerived, valueOf, type Ctx } from './status';

const mark = (ctx: Ctx, text: string): Ctx => ({ ...ctx, log: [...ctx.log, `🛠 ${text}`] });
const apply = (run: RunState, fn: (ctx: Ctx) => Ctx) => fromCtx(run, fn({ ...toCtx(run), cause: undefined }));
let seq = 0;

export function debugSetResource(run: RunState, unitId: string, resourceId: string, value: number): RunState {
  return apply(run, (ctx) => {
    const u = getUnit(ctx.battle, unitId);
    const cur = u ? valueOf(ctx.defs, u, resourceId) : undefined;
    if (!u || cur === undefined) return ctx;
    ctx = mark(ctx, `${u.name}: ${titleOf(ctx.defs, resourceId)} auf ${value} gesetzt`);
    return changeResource(ctx, unitId, resourceId, Math.max(0, value) - cur, true);
  });
}

export function debugGiveEffect(run: RunState, unitId: string, effectId: string): RunState {
  return apply(run, (ctx) => giveEffect(mark(ctx, `Effekt ${titleOf(ctx.defs, effectId)} vergeben`), unitId, effectId, { kind: 'bis-aufloesung' }));
}

export function debugRemoveEffect(run: RunState, unitId: string, instanceId: string): RunState {
  return apply(run, (ctx) => endEffects(mark(ctx, 'Effekt entfernt'), unitId, (a) => a.instanceId === instanceId));
}

/** Figur versetzen (ohne Bewegung – löst keine Bereichs-Auslöser aus). */
export function debugMoveUnit(run: RunState, unitId: string, to: Pos): RunState {
  return apply(run, (ctx) => {
    const u = getUnit(ctx.battle, unitId);
    if (!u) return ctx;
    const units = ctx.battle.units.map((x) => (x.id === unitId || x.carriedBy === unitId ? { ...x, pos: to } : x));
    return refreshDerived(mark({ ...ctx, battle: { ...ctx.battle, units } }, `${u.name} versetzt`), unitId);
  });
}

export function debugRemoveUnit(run: RunState, unitId: string): RunState {
  return apply(run, (ctx) => {
    const u = getUnit(ctx.battle, unitId);
    return u ? mark({ ...ctx, battle: removeUnit(ctx.battle, unitId) }, `${u.name} entfernt`) : ctx;
  });
}

export function debugAddEnemy(run: RunState, enemyId: string, at: Pos): RunState {
  return apply(run, (ctx) => spawnEnemy(mark(ctx, `${titleOf(ctx.defs, enemyId)} hinzugefügt`), enemyId, at));
}

export function debugAddObject(run: RunState, objectId: string, at: Pos): RunState {
  return apply(run, (ctx) => {
    const o = { id: `debug-${Date.now().toString(36)}-${seq++}`, objectId, pos: at, hidden: false };
    return mark({ ...ctx, battle: { ...ctx.battle, objects: [...(ctx.battle.objects ?? []), o] } }, `${titleOf(ctx.defs, objectId)} hinzugefügt`);
  });
}

export function debugRemoveObjects(run: RunState, at: Pos): RunState {
  return apply(run, (ctx) => {
    const here = objectsAt(ctx.battle, at);
    if (!here.length) return ctx;
    const ids = new Set(here.map((o) => o.id));
    return mark(
      { ...ctx, battle: { ...ctx.battle, objects: (ctx.battle.objects ?? []).filter((o) => !ids.has(o.id)) } },
      `${here.map((o) => titleOf(ctx.defs, o.objectId)).join(', ')} entfernt`,
    );
  });
}

export function debugWinLevel(run: RunState): RunState {
  if (run.result || run.battle.phase !== 'kampf') return run;
  return finishLevel({ ...run, log: [...run.log, '🛠 Level sofort gewonnen'], pending: [] });
}
