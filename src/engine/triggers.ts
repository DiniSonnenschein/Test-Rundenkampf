// Verarbeitung von Ereignissen: Effekt-Auslöser/-Beendigungen, Reaktionen, Objekt- und Gelände-Wirkungen.
import { DEFAULT_ABILITY, type AbilityFields, type AbilityTrigger } from './abilities';
import { facingOf, getUnit, unitTiles, type Unit } from './battle';
import { pickRule } from './behavior';
import { hasBlock, type EffectCondition, type EffectEnding } from './effects';
import type { GameEvent, PendingReaction } from './events';
import { applyBlock, executeAbility, legalTargets, objectsAt, type Hit } from './execute';
import { areaTiles } from './facing';
import { posKey, samePos, type Pos } from './grid';
import type { ObjectWorking } from './objects';
import { effectDefs, endEffects, giveEffect, type Ctx } from './status';
import { recordEvent } from './stats';

const MAX_LOOPS = 200;

const inArea = (center: Unit, area: string[], p: Pos) =>
  unitTiles(center).some((t) => areaTiles(t, area, facingOf(center)).some((x) => samePos(x, p)));

const active = (ctx: Ctx) => ctx.battle.units.filter((u) => u.status !== 'entfernt');

// ---------- Bedingungen ----------

/** Passt ein Ereignis zu einer (Effekt-)Bedingung für den Charakter u? Bereiche werden separat geprüft. */
function eventMatches(ctx: Ctx, cond: EffectCondition, e: GameEvent, u: Unit): boolean {
  switch (cond.kind) {
    case 'ziel': {
      if (e.kind !== 'targeted' || e.targetId !== u.id) return false;
      const src = getUnit(ctx.battle, e.sourceId);
      if (cond.from === 'allys') return src?.side === 'ally';
      if (cond.from === 'gegner') return src?.side === 'enemy';
      if (cond.from === 'typen') return e.typeIds.some((t) => cond.typeIds.includes(t));
      return true;
    }
    case 'ressource-aenderung': {
      if (e.kind !== 'resource' || e.unitId !== u.id || (cond.resourceId && e.resourceId !== cond.resourceId)) return false;
      const d = e.after - e.before;
      if (cond.change === 'positiv') return d > 0;
      if (cond.change === 'negativ') return d < 0;
      if (cond.change === 'mindestens') return Math.abs(d) >= cond.min;
      return d !== 0;
    }
    case 'ressource-grenze':
      if (e.kind !== 'resource' || e.unitId !== u.id || (cond.resourceId && e.resourceId !== cond.resourceId)) return false;
      return cond.direction === 'faellt' ? e.before > cond.threshold && e.after <= cond.threshold : e.before < cond.threshold && e.after >= cond.threshold;
    case 'gegenstand':
      return e.kind === 'item' && e.unitId === u.id && e.action === cond.action && (!cond.objectId || e.objectId === cond.objectId);
    default:
      return false;
  }
}

/** Auslöser einer Fähigkeit (Reaktion) für den Besitzer u. „In der Nähe“ gilt aus Sicht des Besitzers. */
function abilityTriggerMatches(ctx: Ctx, t: AbilityTrigger, e: GameEvent, u: Unit): boolean {
  if (t.kind === 'nahe-ziel' || t.kind === 'nahe-verwendet') {
    const otherId = e.kind === 'targeted' && t.kind === 'nahe-ziel' ? e.targetId : e.kind === 'used' && t.kind === 'nahe-verwendet' ? e.casterId : null;
    if (!otherId || otherId === u.id) return false;
    const other = getUnit(ctx.battle, otherId);
    if (!other?.pos) return false;
    const sameSide = other.side === u.side;
    if ((t.entity === 'ally') !== sameSide) return false;
    const types = e.kind === 'targeted' || e.kind === 'used' ? e.typeIds : [];
    if (t.typeIds.length && !types.some((x) => t.typeIds.includes(x))) return false;
    return unitTiles(other).some((p) => inArea(u, t.area, p));
  }
  return eventMatches(ctx, t, e, u);
}

// ---------- Effekt-Auslöser ----------

function effectTriggers(ctx: Ctx, e: GameEvent): Ctx {
  for (const [effectId, def] of Object.entries(ctx.defs.effects)) {
    for (const u of active(ctx)) {
      if (def.triggers.some((c) => eventMatches(ctx, c, e, u))) ctx = giveEffect(ctx, u.id, effectId, { kind: 'bis-aufloesung' });
      const has = (getUnit(ctx.battle, u.id)?.effects ?? []).some((a) => a.effectId === effectId);
      if (has && def.endings.some((c) => c.kind !== 'nach' && eventMatches(ctx, c as EffectCondition, e, u))) {
        ctx = endEffects(ctx, u.id, (a) => a.effectId === effectId);
      }
    }
  }
  return ctx;
}

/** Wer (bzw. was) befindet sich aus Sicht von u im Bereich einer Bereichs-Bedingung? */
function areaMembers(ctx: Ctx, u: Unit, cond: Extract<EffectCondition, { kind: 'bereich' }>): string[] {
  const sel = cond.selection;
  const ok = (id: string | undefined, types: string[]) => sel.all || (!!id && sel.ids.includes(id)) || types.some((t) => sel.typeIds.includes(t));
  if (cond.entity === 'objekt') {
    return (ctx.battle.objects ?? [])
      .filter((o) => inArea(u, cond.area, o.pos) && ok(o.objectId, ctx.defs.objects[o.objectId]?.typeIds ?? []))
      .map((o) => o.id);
  }
  const side = cond.entity === 'ally' ? 'ally' : 'enemy';
  return active(ctx)
    .filter((x) => x.id !== u.id && x.side === side && x.pos && unitTiles(x).some((p) => inArea(u, cond.area, p)) && ok(x.templateId, x.typeIds ?? []))
    .map((x) => x.id);
}

/**
 * Bereichs-Auslöser und -Beendigungen: vergleicht, wer jetzt im Bereich ist, mit dem letzten Stand.
 * Mit trigger=false wird nur der Stand gemerkt (z. B. zu Kampfbeginn).
 */
export function areaPass(ctx: Ctx, trigger = true): Ctx {
  const memory = { ...(ctx.battle.areaMemory ?? {}) };
  for (const [effectId, def] of Object.entries(ctx.defs.effects)) {
    const conds: { c: EffectCondition | EffectEnding; ending: boolean; i: number }[] = [
      ...def.triggers.map((c, i) => ({ c, ending: false, i })),
      ...def.endings.map((c, i) => ({ c, ending: true, i })),
    ];
    for (const { c, ending, i } of conds) {
      if (c.kind !== 'bereich') continue;
      for (const u of active(ctx)) {
        const key = `${u.id}|${effectId}|${ending ? 'e' : 't'}|${i}`;
        const now = areaMembers(ctx, u, c);
        const before = memory[key] ?? [];
        memory[key] = now;
        if (!trigger) continue;
        const fired = c.event === 'betritt' ? now.some((id) => !before.includes(id)) : before.some((id) => !now.includes(id));
        if (!fired) continue;
        if (ending) ctx = endEffects(ctx, u.id, (a) => a.effectId === effectId);
        else ctx = giveEffect(ctx, u.id, effectId, { kind: 'bis-aufloesung' });
      }
    }
  }
  ctx = { ...ctx, battle: { ...ctx.battle, areaMemory: memory } };
  return originEndings(ctx);
}

/** Effekte aus Wirkungen enden beim Verlassen des Bereichs bzw. beim Ablegen des Objekts. */
function originEndings(ctx: Ctx): Ctx {
  for (const u of active(ctx)) {
    for (const a of u.effects ?? []) {
      const o = a.origin;
      if (!o) continue;
      let ends = false;
      if (o.kind === 'bereich') ends = !u.pos || !unitTiles(u).some((t) => o.tiles.includes(posKey(t)));
      if (o.kind === 'ablegen') {
        const holder = getUnit(ctx.battle, o.holderId);
        ends = !holder || ![...(holder.items ?? []), ...(holder.carried ?? [])].some((i) => i.objectId === o.objectId && i.count > 0);
      }
      if (ends) ctx = endEffects(ctx, u.id, (x) => x.instanceId === a.instanceId);
    }
  }
  return ctx;
}

// ---------- Reaktionen ----------

function reactionAvailable(ctx: Ctx, u: Unit, index: number, limit: 'runde' | 'level' | 'unbegrenzt', count: number): boolean {
  if (limit === 'unbegrenzt') return true;
  const used = u.reactionUses?.[index];
  if (!used) return true;
  if (limit === 'runde' && used.round !== ctx.battle.round) return true;
  return used.count < count;
}

/** Zählt eine genutzte Reaktion (pro Runde: Zähler beginnt in jeder Runde neu; pro Level: zählt weiter). */
export function markReactionUsed(ctx: Ctx, unitId: string, index: number): Ctx {
  return {
    ...ctx,
    battle: {
      ...ctx.battle,
      units: ctx.battle.units.map((x) => {
        if (x.id !== unitId) return x;
        const tpl = x.templateId ? ctx.defs.allys[x.templateId] ?? ctx.defs.enemies[x.templateId] : undefined;
        const perRound = tpl?.reactions[index]?.limit === 'runde';
        const prev = x.reactionUses?.[index];
        const count = prev && (!perRound || prev.round === ctx.battle.round) ? prev.count + 1 : 1;
        return { ...x, reactionUses: { ...(x.reactionUses ?? {}), [index]: { round: ctx.battle.round, count } } };
      }),
    },
  };
}

/** KI-gesteuert: Gegner und Allys mit Verhaltens-Effekt. */
export const aiControlled = (ctx: Ctx, u: Unit) => u.side === 'enemy' || hasBlock(u.effects ?? [], 'verhalten', effectDefs(ctx.defs)).length > 0;

function reactions(ctx: Ctx, e: GameEvent): Ctx {
  for (const u of active(ctx)) {
    if (u.status !== 'aktiv' || u.carriedBy) continue;
    if (hasBlock(u.effects ?? [], 'verlust', effectDefs(ctx.defs)).some((b) => b.what === 'reaktion')) continue;
    const tpl = u.templateId ? ctx.defs.allys[u.templateId] ?? ctx.defs.enemies[u.templateId] : undefined;
    (tpl?.reactions ?? []).forEach((r, index) => {
      const cur = getUnit(ctx.battle, u.id)!;
      if (!reactionAvailable(ctx, cur, index, r.limit, r.count)) return;
      const abilityIds = r.abilityIds.filter((id) => {
        const a: AbilityFields | undefined = ctx.defs.abilities[id];
        return a && a.triggers.some((t) => abilityTriggerMatches(ctx, t, e, cur));
      });
      if (!abilityIds.length) return;
      const pending: PendingReaction = {
        unitId: u.id,
        reaction: index,
        abilityIds,
        sourceId: e.kind === 'targeted' ? e.sourceId : e.kind === 'used' ? e.casterId : undefined,
        targetIds: e.kind === 'targeted' ? [e.targetId] : e.kind === 'used' ? e.targetIds : undefined,
      };
      if (!aiControlled(ctx, cur)) {
        if (!(ctx.pending ?? []).some((p) => p.unitId === u.id && p.reaction === index)) ctx = { ...ctx, pending: [...(ctx.pending ?? []), pending] };
        return;
      }
      ctx = aiReaction(ctx, cur, pending);
    });
  }
  return ctx;
}

/** Gegner reagieren nur über Regeln mit „Als Reaktion“; Ziel: der Auslöser, sonst das erste legale. */
function aiReaction(ctx: Ctx, u: Unit, p: PendingReaction): Ctx {
  const rules = u.side === 'enemy' && u.templateId ? ctx.defs.enemies[u.templateId]?.behavior.rules ?? [] : [];
  const rule = pickRule(rules, 'reaktion', (r) => !!r.abilityId && p.abilityIds.includes(r.abilityId));
  if (!rule?.abilityId) return ctx;
  const a = ctx.defs.abilities[rule.abilityId];
  const rc = { sourceId: p.sourceId, targetIds: p.targetIds };
  const legal = legalTargets(ctx, u.id, a, rc);
  const src = p.sourceId ? getUnit(ctx.battle, p.sourceId) : undefined;
  const target =
    rule.target.kind === 'selbst' ? (u.pos ? [u.pos] : []) : legal.filter((t) => src?.pos && samePos(t, src.pos)).concat(legal).slice(0, 1);
  if (a.targeting.kind === 'ziel' && !target.length) return ctx;
  ctx = markReactionUsed(ctx, u.id, p.reaction);
  return executeAbility({ ...ctx, log: [...ctx.log, `${u.name} reagiert.`] }, u.id, rule.abilityId, target, { reaction: rc });
}

// ---------- Objekt- & Gelände-Wirkungen ----------

interface WorkingSource {
  key: string;
  pos: Pos;
  working: ObjectWorking;
  terrainId?: string;
  objectId?: string;
}

function workingSources(ctx: Ctx): WorkingSource[] {
  const out: WorkingSource[] = [];
  for (const [k, tid] of Object.entries(ctx.battle.terrain ?? {})) {
    const t = ctx.defs.terrains[tid];
    if (!t?.workings.length) continue;
    const [x, y] = k.split(',').map(Number);
    t.workings.forEach((w, i) => out.push({ key: `gelaende|${k}|${i}`, pos: { x, y }, working: w, terrainId: tid }));
  }
  for (const o of ctx.battle.objects ?? []) {
    (ctx.defs.objects[o.objectId]?.workings ?? []).forEach((w, i) => out.push({ key: `objekt|${o.id}|${i}`, pos: o.pos, working: w, objectId: o.objectId }));
  }
  return out;
}

const workingTiles = (s: WorkingSource) => areaTiles(s.pos, s.working.area, 'n');

function filterPasses(ctx: Ctx, w: ObjectWorking, u: Unit, terrainId?: string): boolean {
  const t = w.trigger;
  if (terrainId && hasBlock(u.effects ?? [], 'gelaende-ignorieren', effectDefs(ctx.defs)).some((b) => b.terrain.all || b.terrain.ids.includes(terrainId))) return false;
  if (t.kind !== 'bereich') return true;
  if (u.side === 'ally' ? !t.allys : !t.gegner) return false;
  if (t.typeIds.length && !(u.typeIds ?? []).some((x) => t.typeIds.includes(x))) return false;
  if (t.effectIds.length && !(u.effects ?? []).some((x) => t.effectIds.includes(x.effectId))) return false;
  return true;
}

/** Führt eine Wirkung aus: Ziel = der Auslöser/Träger oder alle (passenden) im Bereich. */
function applyWorking(ctx: Ctx, s: WorkingSource, triggerUnit?: Unit, holderId?: string): Ctx {
  const tiles = workingTiles(s);
  const units =
    s.working.target === 'traeger'
      ? triggerUnit ? [triggerUnit] : []
      : active(ctx).filter((u) => u.pos && unitTiles(u).some((p) => tiles.some((t) => samePos(t, p))));
  const hitUnits = units.filter((u) => filterPasses(ctx, s.working, u, s.terrainId));
  if (!hitUnits.length && s.working.target === 'traeger') return ctx;
  const origin =
    s.working.ending === 'verlassen'
      ? { kind: 'bereich' as const, key: s.key, tiles: tiles.map(posKey) }
      : s.working.ending === 'ablegen' && holderId && s.objectId
        ? { kind: 'ablegen' as const, holderId, objectId: s.objectId }
        : undefined;
  const pseudo: Unit = { id: s.key, side: 'enemy', name: s.objectId ? ctx.defs.objects[s.objectId]?.title ?? 'Objekt' : ctx.defs.terrains[s.terrainId!]?.title ?? 'Gelände', pos: s.pos, status: 'aktiv', actions: [], facing: 'n' };
  const hit: Hit = { units: hitUnits, objects: s.working.target === 'aoe' ? tiles.flatMap((t) => objectsAt(ctx.battle, t)) : [], tiles };
  const shell: AbilityFields = DEFAULT_ABILITY;
  ctx = { ...ctx, log: [...ctx.log, `${pseudo.name} wirkt.`] };
  for (const b of s.working.blocks) {
    const fresh = { ...hit, units: hit.units.map((u) => getUnit(ctx.battle, u.id)!).filter((u) => u && u.status !== 'entfernt') };
    ctx = applyBlock(ctx, pseudo, `wirkung:${s.key}`, shell, b, fresh, [triggerUnit?.pos ?? s.pos], { origin });
  }
  return ctx;
}

function workingsOnEvent(ctx: Ctx, e: GameEvent): Ctx {
  if (e.kind === 'move') {
    const u = getUnit(ctx.battle, e.unitId);
    if (!u) return ctx;
    for (const s of workingSources(ctx)) {
      const t = s.working.trigger;
      if (t.kind !== 'bereich' || (t.event !== 'betritt' && t.event !== 'verlaesst')) continue;
      const tiles = workingTiles(s);
      const was = tiles.some((p) => samePos(p, e.from));
      const is = tiles.some((p) => samePos(p, e.to));
      if ((t.event === 'betritt' && is && !was) || (t.event === 'verlaesst' && was && !is)) ctx = applyWorking(ctx, s, getUnit(ctx.battle, e.unitId));
    }
  }
  if (e.kind === 'item') {
    const action = { sammelt: 'gesammelt', verwendet: 'verwendet', vergeben: 'vergeben', geworfen: 'geworfen', platziert: null }[e.action];
    const d = ctx.defs.objects[e.objectId];
    const holder = getUnit(ctx.battle, e.unitId);
    (d?.workings ?? []).forEach((w, i) => {
      if (!action || w.trigger.kind !== 'objekt' || w.trigger.event !== action) return;
      const pos = e.at ?? holder?.pos;
      if (!pos) return;
      ctx = applyWorking(ctx, { key: `besitz|${e.unitId}|${e.objectId}|${i}`, pos, working: w, objectId: e.objectId }, holder, e.unitId);
    });
  }
  return ctx;
}

/** Wirkungen „steht zu Beginn/Ende seines Zuges im Bereich“. */
export function turnWorkings(ctx: Ctx, unitId: string, timing: 'beginn' | 'ende'): Ctx {
  const u = getUnit(ctx.battle, unitId);
  if (!u?.pos) return ctx;
  for (const s of workingSources(ctx)) {
    const t = s.working.trigger;
    if (t.kind !== 'bereich' || t.event !== (timing === 'beginn' ? 'zugbeginn' : 'zugende')) continue;
    if (workingTiles(s).some((p) => unitTiles(u).some((x) => samePos(x, p)))) ctx = applyWorking(ctx, s, getUnit(ctx.battle, unitId));
  }
  return ctx;
}

// ---------- Hauptschleife ----------

/** Verarbeitet alle anstehenden Ereignisse (auch solche, die dabei neu entstehen). */
export function processEvents(ctx: Ctx): Ctx {
  for (let loop = 0; loop < MAX_LOOPS; loop++) {
    const queue = ctx.events ?? [];
    if (!queue.length) {
      const before = JSON.stringify(ctx.battle.areaMemory ?? {});
      ctx = areaPass(ctx);
      if ((ctx.events ?? []).length === 0 && JSON.stringify(ctx.battle.areaMemory ?? {}) === before) break;
      continue;
    }
    const [e, ...rest] = queue;
    ctx = { ...ctx, events: rest, stats: ctx.stats && recordEvent(ctx.stats, ctx.battle, e) };
    ctx = effectTriggers(ctx, e);
    ctx = workingsOnEvent(ctx, e);
    ctx = reactions(ctx, e);
  }
  return { ...ctx, events: [] };
}

/** Effekt-Auslöser zu Beginn eines Levels („startet damit ins Spiel“, „Level enthält …“). */
export function levelStartTriggers(ctx: Ctx, firstLevel: boolean, levelEntities: { enemies: string[]; objects: string[]; allys: string[] }): Ctx {
  for (const [effectId, def] of Object.entries(ctx.defs.effects)) {
    for (const c of def.triggers) {
      const fires =
        (c.kind === 'spielstart' && firstLevel) ||
        (c.kind === 'level-enthaelt' &&
          !!c.id &&
          (c.entity === 'gegner' ? levelEntities.enemies : c.entity === 'objekt' ? levelEntities.objects : levelEntities.allys).includes(c.id));
      if (!fires) continue;
      for (const u of active(ctx)) ctx = giveEffect(ctx, u.id, effectId, { kind: 'bis-aufloesung' });
    }
  }
  return ctx;
}

