// Laufzeit: Ressourcen, Events und Effekte während eines Kampfes.
import { getUnit, removeUnit, setSkipsTurns, setUnconscious, type BattleState, type Unit } from './battle';
import type { Defs } from './defs';
import { titleOf } from './defs';
import { addEffect, hasBlock, permanentModifier, tickEffects, UNCONSCIOUS_ID, type ActiveEffect, type EffectDefs, type TickEvent } from './effects';
import { applyChange, changesAt, triggeredEvents, type EffectDuration } from './resources';

/** Teil des Spielzustands, den Ressourcen und Effekte verändern. */
export interface Ctx {
  defs: Defs;
  battle: BattleState;
  globals: Record<string, number>;
  log: string[];
  /** Ergebnis, das ein Event ausgelöst hat (Run gewonnen/verloren). */
  result?: 'sieg' | 'niederlage';
}

let seq = 0;
const instanceId = () => `fx-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const effectDefs = (defs: Defs): EffectDefs => defs.effects;

function setUnit(ctx: Ctx, id: string, patch: Partial<Unit>): Ctx {
  return { ...ctx, battle: { ...ctx.battle, units: ctx.battle.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) } };
}

const log = (ctx: Ctx, line: string): Ctx => ({ ...ctx, log: [...ctx.log, line] });

// ---------- Werte ----------

/** Wert inkl. dauerhafter Effekt-Veränderungen; undefined, wenn der Charakter die Ressource nicht hat. */
export function valueOf(defs: Defs, u: Unit, resourceId: string): number | undefined {
  const base = u.values?.[resourceId];
  if (base === undefined) return undefined;
  return Math.max(0, base + permanentModifier(u.effects ?? [], resourceId, effectDefs(defs)));
}

export const maxOf = (u: Unit, resourceId: string): number | null => u.maxValues?.[resourceId] ?? null;

// ---------- Ressourcen ----------

/**
 * Verändert eine individuelle Ressource. Fehlt sie dem Charakter, passiert nichts.
 * Danach werden Ressourcen-Events und eigene Events (Gegner) geprüft.
 */
export function changeResource(ctx: Ctx, unitId: string, resourceId: string, amount: number, mayExceedMax: boolean, depth = 0): Ctx {
  const u = getUnit(ctx.battle, unitId);
  if (!u || u.values?.[resourceId] === undefined || amount === 0) return ctx;
  const before = valueOf(ctx.defs, u, resourceId)!;
  const mod = before - u.values[resourceId];
  const after = applyChange(before, amount, maxOf(u, resourceId), mayExceedMax);
  ctx = setUnit(ctx, unitId, { values: { ...u.values, [resourceId]: after - mod } });
  ctx = log(ctx, `${u.name}: ${titleOf(ctx.defs, resourceId)} ${before} → ${after}`);
  return resourceEvents(ctx, unitId, resourceId, before, after, depth);
}

function resourceEvents(ctx: Ctx, unitId: string, resourceId: string, before: number, after: number, depth: number): Ctx {
  if (depth > 10 || before === after) return ctx;
  const def = ctx.defs.resources[resourceId];
  for (const ev of triggeredEvents(def?.events ?? [], before, after)) {
    const a = ev.action;
    if (a.kind === 'sieg' || a.kind === 'niederlage') ctx = { ...ctx, result: ctx.result ?? a.kind };
    else if (a.kind === 'effekt' && a.effectId) ctx = giveEffect(ctx, unitId, a.effectId, a.duration, undefined, depth + 1);
    else if (a.kind === 'ressource' && a.resourceId) ctx = changeResource(ctx, unitId, a.resourceId, a.amount, false, depth + 1);
  }
  // Eigene Events des Gegners.
  const u = getUnit(ctx.battle, unitId);
  const own = u?.side === 'enemy' && u.templateId ? ctx.defs.enemies[u.templateId]?.behavior.events ?? [] : [];
  for (const ev of own.filter((e) => e.resourceId === resourceId)) {
    const hit = ev.direction === 'faellt' ? before > ev.threshold && after <= ev.threshold : before < ev.threshold && after >= ev.threshold;
    if (!hit) continue;
    const a = ev.action;
    if (a.kind === 'sieg' || a.kind === 'niederlage') ctx = { ...ctx, result: ctx.result ?? a.kind };
    else if (a.kind === 'zerstoert') ctx = log({ ...ctx, battle: removeUnit(ctx.battle, unitId) }, `${u!.name} wird zerstört.`);
    else if (a.kind === 'effekt' && a.effectId) ctx = giveEffect(ctx, unitId, a.effectId, a.duration, undefined, depth + 1);
  }
  return ctx;
}

/** Verändert eine globale Ressource (Pool) inkl. ihrer Events. */
export function changeGlobal(ctx: Ctx, resourceId: string, amount: number, mayExceedMax: boolean, depth = 0): Ctx {
  const def = ctx.defs.resources[resourceId];
  if (!def || def.scope !== 'global' || amount === 0 || depth > 10) return ctx;
  const before = ctx.globals[resourceId] ?? def.start;
  const after = applyChange(before, amount, def.hasMax ? def.max : null, mayExceedMax);
  ctx = log({ ...ctx, globals: { ...ctx.globals, [resourceId]: after } }, `${def.title} ${before} → ${after}`);
  for (const ev of triggeredEvents(def.events, before, after)) {
    const a = ev.action;
    if (a.kind === 'sieg' || a.kind === 'niederlage') ctx = { ...ctx, result: ctx.result ?? a.kind };
    else if (a.kind === 'ressource' && a.resourceId) ctx = changeGlobal(ctx, a.resourceId, a.amount, false, depth + 1);
    else if (a.kind === 'effekt' && a.effectId) {
      const side = a.target === 'gegner' ? 'enemy' : 'ally';
      for (const u of ctx.battle.units.filter((x) => x.side === side && x.status !== 'entfernt')) {
        ctx = giveEffect(ctx, u.id, a.effectId, a.duration, undefined, depth + 1);
      }
    }
  }
  return ctx;
}

// ---------- Effekte ----------

function immune(ctx: Ctx, u: Unit, effectId: string): boolean {
  const tpl = u.templateId ? ctx.defs.allys[u.templateId] ?? ctx.defs.enemies[u.templateId] : undefined;
  if (!tpl) return false;
  const types = ctx.defs.effects[effectId]?.typeIds ?? [];
  return tpl.immunities.effectIds.includes(effectId) || types.some((t) => tpl.immunities.typeIds.includes(t));
}

/** Übernimmt, was aktive Effekte am Charakter verändern (Bewusstlos, Aussetzen, Sicht, Kollision). */
export function refreshDerived(ctx: Ctx, unitId: string): Ctx {
  const u = getUnit(ctx.battle, unitId);
  if (!u) return ctx;
  const fx = u.effects ?? [];
  const defs = effectDefs(ctx.defs);
  const unconscious = fx.some((a) => a.effectId === UNCONSCIOUS_ID);
  const skips = hasBlock(fx, 'verlust', defs).some((b) => b.what === 'zug');
  const sight = hasBlock(fx, 'sicht', defs).at(-1)?.area;
  const noCollision = hasBlock(fx, 'keine-kollision', defs).length > 0;
  let battle = setUnconscious(ctx.battle, unitId, unconscious);
  battle = {
    ...battle,
    units: battle.units.map((x) =>
      x.id === unitId
        ? { ...x, sightArea: sight ?? x.base?.sightArea ?? x.sightArea, collision: noCollision ? false : x.base?.collision ?? x.collision }
        : x,
    ),
  };
  if (!!getUnit(battle, unitId)?.skipsTurns !== skips) battle = setSkipsTurns(battle, unitId, skips);
  return { ...ctx, battle };
}

/** Effekt vergeben (Ausnahmen, Stapeln und Unverträglichkeit werden beachtet). */
export function giveEffect(ctx: Ctx, unitId: string, effectId: string, duration: EffectDuration, sourceId?: string, depth = 0): Ctx {
  const u = getUnit(ctx.battle, unitId);
  const def = ctx.defs.effects[effectId];
  if (!u || !def || u.status === 'entfernt' || depth > 10) return ctx;
  if (immune(ctx, u, effectId)) return log(ctx, `${u.name} ist immun gegen ${def.title}.`);
  const instance: ActiveEffect = { instanceId: instanceId(), effectId, sourceId, duration, counters: {} };
  const r = addEffect(u.effects ?? [], instance, effectDefs(ctx.defs));
  if (!r.added) return log(ctx, `${def.title} wirkt nicht auf ${u.name}.`);
  const before = snapshotValues(ctx, u);
  ctx = setUnit(ctx, unitId, { effects: r.active });
  ctx = log(ctx, `${u.name} erhält ${def.title}${r.ended.length ? ` (beendet: ${r.ended.map((e) => titleOf(ctx.defs, e.effectId)).join(', ')})` : ''}.`);
  return afterEffectChange(refreshDerived(ctx, unitId), unitId, before, depth);
}

/** Effekte beenden (alle, auf die die Bedingung zutrifft). */
export function endEffects(ctx: Ctx, unitId: string, match: (a: ActiveEffect) => boolean, depth = 0): Ctx {
  const u = getUnit(ctx.battle, unitId);
  if (!u?.effects?.some(match)) return ctx;
  const before = snapshotValues(ctx, u);
  const ended = u.effects.filter(match);
  ctx = setUnit(ctx, unitId, { effects: u.effects.filter((a) => !match(a)) });
  ctx = log(ctx, `${u.name}: ${ended.map((e) => titleOf(ctx.defs, e.effectId)).join(', ')} endet.`);
  return afterEffectChange(refreshDerived(ctx, unitId), unitId, before, depth);
}

function snapshotValues(ctx: Ctx, u: Unit): Record<string, number> {
  return Object.fromEntries(Object.keys(u.values ?? {}).map((k) => [k, valueOf(ctx.defs, u, k)!]));
}

/** Dauerhafte Veränderungen durch Effekte können Ressourcen-Grenzen überschreiten → Events prüfen. */
function afterEffectChange(ctx: Ctx, unitId: string, before: Record<string, number>, depth: number): Ctx {
  const u = getUnit(ctx.battle, unitId);
  if (!u) return ctx;
  for (const [k, b] of Object.entries(before)) {
    const a = valueOf(ctx.defs, u, k);
    if (a !== undefined && a !== b) ctx = resourceEvents(ctx, unitId, k, b, a, depth + 1);
  }
  return ctx;
}

// ---------- Zeitpunkte ----------

/**
 * Zeitpunkt für einen Charakter: automatische Veränderungen seiner Ressourcen, wiederkehrende
 * Effekt-Veränderungen und das Herunterzählen der Effekt-Dauern.
 */
export function tickUnit(ctx: Ctx, unitId: string, event: TickEvent): Ctx {
  let u = getUnit(ctx.battle, unitId);
  if (!u || u.status === 'entfernt') return ctx;
  const tpl = u.templateId ? ctx.defs.allys[u.templateId] ?? ctx.defs.enemies[u.templateId] : undefined;
  for (const r of tpl?.resources ?? []) {
    for (const c of changesAt(r.changes, event.unit, event.timing)) ctx = changeResource(ctx, unitId, r.resourceId, c.amount, false);
  }
  u = getUnit(ctx.battle, unitId);
  for (const b of hasBlock(u?.effects ?? [], 'ressource', effectDefs(ctx.defs))) {
    if (b.mode === 'wiederkehrend' && b.resourceId && b.interval === event.unit && b.timing === event.timing) {
      ctx = changeResource(ctx, unitId, b.resourceId, b.amount, b.mayExceedMax);
    }
  }
  u = getUnit(ctx.battle, unitId);
  if (!u?.effects?.length) return ctx;
  const r = tickEffects(u.effects, event, effectDefs(ctx.defs));
  if (!r.ended.length) return setUnit(ctx, unitId, { effects: r.active });
  const endedIds = new Set(r.ended.map((e) => e.instanceId));
  ctx = setUnit(ctx, unitId, { effects: [...r.active, ...r.ended] });
  return endEffects(ctx, unitId, (a) => endedIds.has(a.instanceId));
}

/** Automatische Veränderungen globaler Ressourcen (pro Runde/Level). */
export function tickGlobals(ctx: Ctx, event: TickEvent): Ctx {
  for (const [id, def] of Object.entries(ctx.defs.resources)) {
    if (def.scope !== 'global') continue;
    for (const c of changesAt(def.changes, event.unit, event.timing)) ctx = changeGlobal(ctx, id, c.amount, false);
  }
  return ctx;
}
