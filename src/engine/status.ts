// Laufzeit: Ressourcen, Events und Effekte während eines Kampfes.
import type { Stats } from './stats';
import { getUnit, removeUnit, setSkipsTurns, setUnconscious, type BattleState, type Unit } from './battle';
export type { Source } from './events';
import type { Defs } from './defs';
import { titleOf } from './defs';
import { addEffect, hasBlock, permanentModifier, tickEffects, UNCONSCIOUS_ID, type ActiveEffect, type EffectDefs, type TickEvent } from './effects';
import { applyChange, changesAt, triggeredEvents, type EffectDuration } from './resources';
import type { GameEvent, PendingReaction, Source } from './events';

/** Teil des Spielzustands, den Ressourcen und Effekte verändern. */
export interface Ctx {
  defs: Defs;
  battle: BattleState;
  globals: Record<string, number>;
  log: string[];
  /** Ergebnis, das ein Event ausgelöst hat (Run gewonnen/verloren). */
  result?: 'sieg' | 'niederlage';
  /** Noch nicht verarbeitete Ereignisse. */
  events?: GameEvent[];
  /** Ausgelöste Reaktionen von Allys, die auf eine Entscheidung warten. */
  pending?: PendingReaction[];
  /** Wer gerade handelt (Fähigkeit) – Verursacher für die Statistik. */
  cause?: string;
  /** Statistik des laufenden Levels. */
  stats?: Stats;
}

export const emit = (ctx: Ctx, e: GameEvent): Ctx => ({ ...ctx, events: [...(ctx.events ?? []), e] });

/** Passt eine Quelle zu einer Auswahl „alle / gegnerisch / von Allys / Typen“ aus Sicht von u? */
export function sourceMatches(u: Unit, source: Source, from: 'alle' | 'gegner' | 'allys' | 'eigene' | 'typen', typeIds: string[]): boolean {
  switch (from) {
    case 'alle': return true;
    case 'gegner': return !!source.side && source.side !== u.side;
    case 'allys': return !!source.side && source.side === u.side && source.unitId !== u.id;
    case 'eigene': return source.unitId === u.id;
    case 'typen': return source.typeIds.some((t) => typeIds.includes(t));
  }
}

/** Verbraucht einen passenden Schutz; true, wenn geschützt. */
export function consumeShield(ctx: Ctx, unitId: string, against: 'faehigkeit' | 'effekt' | 'ressource', source: Source | undefined): { ctx: Ctx; blocked: boolean } {
  const u = getUnit(ctx.battle, unitId);
  if (!u?.shields?.length || !source) return { ctx, blocked: false };
  const s = u.shields.find((x) => x.against === against && sourceMatches(u, source, x.from, x.typeIds));
  if (!s) return { ctx, blocked: false };
  ctx = setUnit(ctx, unitId, { shields: u.shields.filter((x) => x.id !== s.id) });
  return { ctx: log(ctx, `${u.name} ist geschützt.`), blocked: true };
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
export function changeResource(ctx: Ctx, unitId: string, resourceId: string, amount: number, mayExceedMax: boolean, depth = 0, source?: Source): Ctx {
  const u = getUnit(ctx.battle, unitId);
  if (!u || u.values?.[resourceId] === undefined || amount === 0) return ctx;
  if (source) {
    // „Ressource unveränderlich“ und einmaliger Schutz.
    const locked = hasBlock(u.effects ?? [], 'unveraenderlich', effectDefs(ctx.defs)).some(
      (b) => b.resourceId === resourceId && sourceMatches(u, source, b.by, b.typeIds),
    );
    if (locked) return log(ctx, `${u.name}: ${titleOf(ctx.defs, resourceId)} ist unveränderlich.`);
    const shield = consumeShield(ctx, unitId, 'ressource', source);
    if (shield.blocked) return shield.ctx;
  }
  const before = valueOf(ctx.defs, u, resourceId)!;
  const mod = before - u.values[resourceId];
  const after = applyChange(before, amount, maxOf(u, resourceId), mayExceedMax);
  ctx = setUnit(ctx, unitId, { values: { ...u.values, [resourceId]: after - mod } });
  if (before !== after) ctx = log(ctx, `${u.name}: ${titleOf(ctx.defs, resourceId)} ${before} → ${after}`);
  if (before !== after) ctx = emit(ctx, { kind: 'resource', unitId, resourceId, before, after, causeId: source?.unitId ?? ctx.cause });
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
    else if (a.kind === 'zerstoert') ctx = destroyUnit(ctx, unitId);
    else if (a.kind === 'effekt' && a.effectId) ctx = giveEffect(ctx, unitId, a.effectId, a.duration, undefined, depth + 1);
    else if (a.kind === 'ersetzen' && a.into.id) ctx = replaceUnit(ctx, unitId, a.into.kind, a.into.id);
  }
  return ctx;
}

/** Gegner zerstören: aus dem Level entfernen, Beute fällt auf sein Feld. */
export function destroyUnit(ctx: Ctx, unitId: string, reason: 'zerstoert' | 'flucht' = 'zerstoert'): Ctx {
  const u = getUnit(ctx.battle, unitId);
  if (!u || u.status === 'entfernt') return ctx;
  const tpl = u.side === 'enemy' && u.templateId ? ctx.defs.enemies[u.templateId] : undefined;
  const loot = tpl && (tpl.behavior.loot.when === 'beides' || tpl.behavior.loot.when === reason) ? tpl.behavior.loot.items : [];
  let objects = ctx.battle.objects ?? [];
  if (u.pos) {
    for (const it of loot) {
      if (!it.objectId || !ctx.defs.objects[it.objectId]) continue;
      for (let i = 0; i < it.count; i++) objects = [...objects, { id: `beute-${unitId}-${it.objectId}-${i}`, objectId: it.objectId, pos: u.pos, hidden: false }];
    }
  }
  ctx = { ...ctx, battle: { ...removeUnit(ctx.battle, unitId), objects } };
  return log(ctx, `${u.name} ${reason === 'flucht' ? 'flieht' : 'wird zerstört'}${loot.length ? ' und hinterlässt Beute' : ''}.`);
}

/** Dauerhaft ersetzen (Gegner → anderer Gegner/Objekt). */
export function replaceUnit(ctx: Ctx, unitId: string, kind: 'ally' | 'gegner' | 'objekt', id: string): Ctx {
  const u = getUnit(ctx.battle, unitId);
  if (!u?.pos) return ctx;
  if (kind === 'objekt') {
    if (!ctx.defs.objects[id]) return ctx;
    ctx = { ...ctx, battle: { ...removeUnit(ctx.battle, unitId), objects: [...(ctx.battle.objects ?? []), { id: `ersetzt-${unitId}`, objectId: id, pos: u.pos, hidden: false }] } };
    return log(ctx, `${u.name} wird zu ${titleOf(ctx.defs, id)}.`);
  }
  const d = ctx.defs.enemies[id] ?? ctx.defs.allys[id];
  if (!d) return ctx;
  ctx = setUnit(ctx, unitId, {
    name: d.title,
    templateId: id,
    actions: d.actions,
    size: d.size,
    typeIds: d.typeIds,
    sightArea: d.sightArea,
    base: { sightArea: d.sightArea, collision: d.collision },
    collision: d.collision,
    values: Object.fromEntries(d.resources.map((r) => [r.resourceId, r.start])),
    maxValues: Object.fromEntries(d.resources.map((r) => [r.resourceId, r.hasMax ? r.max : null])),
  });
  return log(ctx, `${u.name} wird zu ${d.title}.`);
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
  const transform = hasBlock(fx, 'verwandeln', defs).filter((b) => b.into.id).at(-1);
  const skips = hasBlock(fx, 'verlust', defs).some((b) => b.what === 'zug') || transform?.into.kind === 'objekt';
  const sight = hasBlock(fx, 'sicht', defs).at(-1)?.area;
  const noCollision = hasBlock(fx, 'keine-kollision', defs).length > 0;
  let battle = setUnconscious(ctx.battle, unitId, unconscious);
  battle = {
    ...battle,
    units: battle.units.map((x) =>
      x.id === unitId
        ? {
            ...x,
            actions: effectiveActions(ctx.defs, x, transform?.into.id ? { kind: transform.into.kind, id: transform.into.id } : undefined),
            sightArea: sight ?? x.base?.sightArea ?? x.sightArea,
            collision: noCollision ? false : x.base?.collision ?? x.collision,
            transform: transform?.into.id ? { kind: transform.into.kind, id: transform.into.id } : undefined,
          }
        : x,
    ),
  };
  if (!!getUnit(battle, unitId)?.skipsTurns !== skips) battle = setSkipsTurns(battle, unitId, skips);
  return { ...ctx, battle };
}

/**
 * Aktionen unter Berücksichtigung der Effekte: Verwandlung (Vorlage), Fähigkeiten ersetzen/hinzufügen,
 * Möglichkeit verlieren (alle Fähigkeiten bzw. bestimmte Typen).
 */
export function effectiveActions(defs: Defs, u: Unit, transform?: Unit['transform']): Unit['actions'] {
  if (transform?.kind === 'objekt') return [];
  const tplId = transform?.id ?? u.templateId;
  const tpl = tplId ? defs.allys[tplId] ?? defs.enemies[tplId] : undefined;
  const fx = u.effects ?? [];
  const ed = effectDefs(defs);
  const replace = hasBlock(fx, 'ersetzen', ed);
  const loss = hasBlock(fx, 'verlust', ed);
  const noAbilities = loss.some((b) => b.what === 'faehigkeiten');
  const lostTypes = loss.filter((b) => b.what === 'typ').flatMap((b) => b.typeIds);
  const allowed = (id: string | null) => !!id && !noAbilities && !(defs.abilities[id]?.typeIds ?? []).some((t) => lostTypes.includes(t));
  const actions = (tpl?.actions ?? u.actions).map((a) => ({
    ...a,
    abilities: a.abilities
      .flatMap((x) => {
        const r = replace.find((b) => x.abilityId && b.from.includes(x.abilityId));
        return r ? r.to.map((id) => ({ abilityId: id, maxUses: x.maxUses })) : [x];
      })
      .filter((x) => allowed(x.abilityId)),
  }));
  const added = hasBlock(fx, 'hinzufuegen', ed).flatMap((b) => b.abilityIds).filter(allowed);
  return added.length ? [...actions, { name: 'Durch Effekte', abilities: added.map((id) => ({ abilityId: id, maxUses: 1 })) }] : actions;
}

/** Effekt vergeben (Ausnahmen, Stapeln und Unverträglichkeit werden beachtet). */
export function giveEffect(
  ctx: Ctx, unitId: string, effectId: string, duration: EffectDuration, sourceId?: string, depth = 0, origin?: ActiveEffect['origin'],
): Ctx {
  const u = getUnit(ctx.battle, unitId);
  const def = ctx.defs.effects[effectId];
  if (!u || !def || u.status === 'entfernt' || depth > 10) return ctx;
  if (immune(ctx, u, effectId)) return log(ctx, `${u.name} ist immun gegen ${def.title}.`);
  if (sourceId && sourceId !== unitId) {
    const src = getUnit(ctx.battle, sourceId);
    const shield = consumeShield(ctx, unitId, 'effekt', { unitId: sourceId, side: src?.side, typeIds: def.typeIds, kind: 'effekt' });
    if (shield.blocked) return shield.ctx;
    ctx = shield.ctx;
  }
  const instance: ActiveEffect = { instanceId: instanceId(), effectId, sourceId, duration, counters: {}, origin };
  const r = addEffect(u.effects ?? [], instance, effectDefs(ctx.defs));
  if (!r.added) return log(ctx, `${def.title} wirkt nicht auf ${u.name}.`);
  const before = snapshotValues(ctx, u);
  ctx = setUnit(ctx, unitId, { effects: r.active });
  ctx = emit(ctx, { kind: 'effect', unitId, effectId, causeId: sourceId ?? ctx.cause });
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
  // Effekte, die weitere Effekte hinzufügen (pro Runde/Level oder einmalig nach X Runden).
  u = getUnit(ctx.battle, unitId);
  for (const a of u?.effects ?? []) {
    (ctx.defs.effects[a.effectId]?.blocks ?? []).forEach((b, i) => {
      if (b.kind !== 'effekt' || !b.effectId) return;
      if (b.schedule === 'nach-runden') {
        if (event.unit !== 'runde' || event.timing !== 'ende') return;
        const key = 1000 + i;
        const n = (a.counters[key] ?? 0) + 1;
        const cur = getUnit(ctx.battle, unitId)!;
        ctx = setUnit(ctx, unitId, { effects: (cur.effects ?? []).map((x) => (x.instanceId === a.instanceId ? { ...x, counters: { ...x.counters, [key]: n } } : x)) });
        if (n === b.rounds) ctx = giveEffect(ctx, unitId, b.effectId, b.duration, unitId);
      } else if (b.schedule === event.unit && b.timing === event.timing) {
        ctx = giveEffect(ctx, unitId, b.effectId, b.duration, unitId);
      }
    });
  }
  // Schutz mit begrenzter Dauer läuft am Rundenende ab.
  u = getUnit(ctx.battle, unitId);
  if (event.unit === 'runde' && event.timing === 'ende' && u?.shields?.length) {
    const shields = u.shields.map((s) => (s.roundsLeft === null ? s : { ...s, roundsLeft: s.roundsLeft - 1 })).filter((s) => s.roundsLeft === null || s.roundsLeft > 0);
    ctx = setUnit(ctx, unitId, { shields });
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
