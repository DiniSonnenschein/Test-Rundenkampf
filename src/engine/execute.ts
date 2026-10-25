// Fähigkeiten im Kampf: Reichweite, legale Ziele, Bedingungen, Kosten und Ausführung der Bausteine.
import { canPay, resourceCosts, traceProjectile, type AbilityBlock, type AbilityFields } from './abilities';
import {
  facingOf, getUnit, gridOf, onTargeted, unitTiles, visible, type BattleState, type MapObject, type Unit,
} from './battle';
import { titleOf } from './defs';
import { areaTiles, facingFromStep, facingTowards, type Facing } from './facing';
import { distance, inBounds, neighbors, posKey, samePos, type Pos } from './grid';
import { changeGlobal, changeResource, endEffects, giveEffect, valueOf, type Ctx } from './status';
import { totalAdjustment } from './resources';
import { slide, terrainCosts } from './terrain';

const uniq = (tiles: Pos[]) => [...new Map(tiles.map((t) => [posKey(t), t])).values()];

const isVoidTile = (b: BattleState, p: Pos) => !inBounds(b.map, p) || (b.map.voids ?? []).includes(posKey(p));

export const unitsAt = (b: BattleState, p: Pos) => b.units.filter((u) => u.status !== 'entfernt' && unitTiles(u).some((t) => samePos(t, p)));
export const objectsAt = (b: BattleState, p: Pos) => (b.objects ?? []).filter((o) => samePos(o.pos, p));
export const terrainOf = (ctx: Ctx, p: Pos) => {
  const id = ctx.battle.terrain?.[posKey(p)];
  return id ? ctx.defs.terrains[id] : undefined;
};

/** Felder in Reichweite (von jedem belegten Feld aus, gedreht nach Blickrichtung). */
export function rangeTiles(b: BattleState, caster: Unit, ability: AbilityFields): Pos[] {
  return uniq(unitTiles(caster).flatMap((t) => areaTiles(t, ability.targeting.range, facingOf(caster)))).filter((p) => !isVoidTile(b, p));
}

/** Ist ein Objekt für Allys sichtbar (nicht verborgen oder aufgedeckt)? */
const objectVisible = (b: BattleState, o: MapObject) => !o.hidden || (b.revealed ?? []).includes(o.id);

function unitIsLegal(caster: Unit, u: Unit, a: AbilityFields): boolean {
  const l = a.targeting.legal;
  const rule = u.side === caster.side ? l.allys : l.gegner;
  if (!rule.on) return false;
  if (rule.typeIds.length && !(u.typeIds ?? []).some((t) => rule.typeIds.includes(t))) return false;
  if (rule.effectIds.length && !(u.effects ?? []).some((e) => rule.effectIds.includes(e.effectId))) return false;
  return true;
}

function objectIsLegal(ctx: Ctx, o: MapObject, a: AbilityFields): boolean {
  const l = a.targeting.legal.objekte;
  if (!l.on) return false;
  if (!l.ids.length && !l.typeIds.length) return true;
  return l.ids.includes(o.objectId) || (ctx.defs.objects[o.objectId]?.typeIds ?? []).some((t) => l.typeIds.includes(t));
}

/** Getroffene Dinge auf einem Feld nach den Regeln für legale Ziele. */
export function legalOnTile(ctx: Ctx, caster: Unit, a: AbilityFields, p: Pos, onlyVisible: boolean) {
  const b = ctx.battle;
  const units = unitsAt(b, p).filter((u) => unitIsLegal(caster, u, a));
  const objects = objectsAt(b, p).filter((o) => objectIsLegal(ctx, o, a) && (!onlyVisible || objectVisible(b, o)));
  const l = a.targeting.legal;
  const tid = b.terrain?.[posKey(p)];
  const terrain = l.gelaende.on && (!l.gelaende.ids.length || (tid !== undefined && l.gelaende.ids.includes(tid)));
  const empty = l.leer && unitsAt(b, p).length === 0 && objectsAt(b, p).filter((o) => objectVisible(b, o)).length === 0;
  return { units, objects, tile: terrain || empty };
}

const hasAnything = (r: ReturnType<typeof legalOnTile>) => r.units.length > 0 || r.objects.length > 0 || r.tile;

/** Felder, die als Ziel gewählt werden dürfen (für Allys nur sichtbare). */
export function legalTargets(ctx: Ctx, casterId: string, a: AbilityFields): Pos[] {
  const caster = getUnit(ctx.battle, casterId);
  if (!caster) return [];
  const seen = caster.side === 'ally' ? visible(ctx.battle) : null;
  return rangeTiles(ctx.battle, caster, a).filter((p) => {
    if (seen && !seen.has(posKey(p))) return false;
    // Nicht wahrnehmbare Charaktere kann man nicht anvisieren (Abschnitt 13b), hier nur Sichtbarkeit.
    return hasAnything(legalOnTile(ctx, caster, a, p, true));
  });
}

// ---------- Bedingungen & Kosten ----------

export function conditionsMet(ctx: Ctx, casterId: string, a: AbilityFields): boolean {
  const u = getUnit(ctx.battle, casterId);
  if (!u) return false;
  return a.conditions.every((c) => {
    if (c.kind === 'gegenstand') return !c.objectId || (u.items ?? []).some((i) => i.objectId === c.objectId && i.count > 0);
    if (c.kind === 'ressource') {
      if (!c.resourceId) return true;
      const v = ctx.defs.resources[c.resourceId]?.scope === 'global' ? ctx.globals[c.resourceId] : valueOf(ctx.defs, u, c.resourceId);
      if (v === undefined) return false;
      return c.bound === 'min' ? v >= c.value : v <= c.value;
    }
    // Etwas befindet sich im Bereich (vom Anwender aus).
    const tiles = uniq(unitTiles(u).flatMap((t) => areaTiles(t, c.area, facingOf(u))));
    const sel = c.selection;
    return tiles.some((p) => {
      if (c.entity === 'gelaende') {
        const tid = ctx.battle.terrain?.[posKey(p)];
        return !!tid && (sel.all || sel.ids.includes(tid));
      }
      if (c.entity === 'objekt') {
        return objectsAt(ctx.battle, p).some(
          (o) => sel.all || sel.ids.includes(o.objectId) || (ctx.defs.objects[o.objectId]?.typeIds ?? []).some((t) => sel.typeIds.includes(t)),
        );
      }
      const side = c.entity === 'ally' ? 'ally' : 'enemy';
      return unitsAt(ctx.battle, p).some(
        (x) => x.id !== u.id && x.side === side && (sel.all || sel.ids.includes(x.templateId ?? '') || (x.typeIds ?? []).some((t) => sel.typeIds.includes(t))),
      );
    });
  });
}

/** Kosten (Ressource → Menge) inkl. Steigerungen und Gelände unter dem Anwender. */
export function costsFor(ctx: Ctx, casterId: string, a: AbilityFields, targets: Pos[]): Record<string, number> {
  const u = getUnit(ctx.battle, casterId)!;
  const total = resourceCosts(a, { targets: targets.length, distances: targets.map((t) => (u.pos ? distance(u.pos, t, true) : 0)) });
  const t = u.pos ? terrainOf(ctx, u.pos) : undefined;
  if (t) for (const [k, v] of Object.entries(terrainCosts(t, a.typeIds))) total[k] = (total[k] ?? 0) + v;
  return total;
}

/** Was der Anwender aktuell bezahlen kann (individuelle Werte + globale Pools). */
export function available(ctx: Ctx, casterId: string): Record<string, number> {
  const u = getUnit(ctx.battle, casterId)!;
  const own = Object.fromEntries(Object.keys(u.values ?? {}).map((k) => [k, valueOf(ctx.defs, u, k)!]));
  return { ...ctx.globals, ...own };
}

export function affordable(ctx: Ctx, casterId: string, a: AbilityFields, targets: Pos[] = []): boolean {
  const objectCostsOk = a.costs.every((c) => {
    if (c.kind !== 'objekt') return true;
    const u = getUnit(ctx.battle, casterId)!;
    const matches = (u.items ?? []).filter(
      (i) => c.selection.ids.includes(i.objectId) || (ctx.defs.objects[i.objectId]?.typeIds ?? []).some((t) => c.selection.typeIds.includes(t)),
    );
    return matches.reduce((s, i) => s + i.count, 0) >= c.count;
  });
  return objectCostsOk && canPay(costsFor(ctx, casterId, a, targets.length ? targets : []), available(ctx, casterId));
}

function pay(ctx: Ctx, casterId: string, a: AbilityFields, targets: Pos[]): Ctx {
  for (const [id, amount] of Object.entries(costsFor(ctx, casterId, a, targets))) {
    if (amount === 0) continue;
    if (ctx.defs.resources[id]?.scope === 'global') ctx = changeGlobal(ctx, id, -amount, false);
    else ctx = changeResource(ctx, casterId, id, -amount, false);
  }
  // Objekte verbrauchen.
  for (const c of a.costs) {
    if (c.kind !== 'objekt') continue;
    let left = c.count;
    const u = getUnit(ctx.battle, casterId)!;
    const items = (u.items ?? []).map((i) => {
      const fits = c.selection.ids.includes(i.objectId) || (ctx.defs.objects[i.objectId]?.typeIds ?? []).some((t) => c.selection.typeIds.includes(t));
      if (!fits || left === 0) return i;
      const take = Math.min(left, i.count);
      left -= take;
      return { ...i, count: i.count - take };
    });
    ctx = { ...ctx, battle: { ...ctx.battle, units: ctx.battle.units.map((x) => (x.id === casterId ? { ...x, items: items.filter((i) => i.count > 0) } : x)) } };
  }
  return ctx;
}

// ---------- Hindernisse & Wege ----------

/** Hindernis für Fähigkeiten: Gelände-Hindernis, Objekt bzw. Charakter mit Kollision. */
function isObstacle(ctx: Ctx, p: Pos, ignore: string[]): boolean {
  const b = ctx.battle;
  if (terrainOf(ctx, p)?.obstacle) return true;
  if (objectsAt(b, p).some((o) => ctx.defs.objects[o.objectId]?.collision)) return true;
  return unitsAt(b, p).some((u) => !ignore.includes(u.id) && u.collision !== false);
}

/** Kann eine Figur auf diesem Feld stehen (begehbar, frei)? */
export function canEnter(ctx: Ctx, u: Unit, pos: Pos): boolean {
  const g = gridOf(ctx.battle.map);
  return unitTiles(u, pos).every(
    (t) =>
      g.isPassable(t) &&
      (u.collision === false || !ctx.battle.units.some((x) => x.id !== u.id && x.collision !== false && x.status !== 'entfernt' && unitTiles(x).some((y) => samePos(y, t)))),
  );
}

/** Kürzester Weg (Liste der Felder ohne Start) oder null. */
export function findPath(ctx: Ctx, u: Unit, to: Pos): Pos[] | null {
  if (!u.pos) return null;
  const g = gridOf(ctx.battle.map);
  const rules = { diagonal: ctx.battle.rules.diagonal, cornerCutting: ctx.battle.rules.cornerCutting };
  const prev = new Map<string, Pos | null>([[posKey(u.pos), null]]);
  const queue = [u.pos];
  while (queue.length) {
    const p = queue.shift()!;
    if (samePos(p, to)) break;
    for (const n of neighbors(g, p, rules)) {
      if (prev.has(posKey(n)) || !canEnter(ctx, u, n)) continue;
      prev.set(posKey(n), p);
      queue.push(n);
    }
  }
  if (!prev.has(posKey(to))) return null;
  const path: Pos[] = [];
  for (let p: Pos | null = to; p && !samePos(p, u.pos); p = prev.get(posKey(p)) ?? null) path.unshift(p);
  return path;
}

function placeUnitAt(ctx: Ctx, unitId: string, pos: Pos, facing?: Facing): Ctx {
  return { ...ctx, battle: { ...ctx.battle, units: ctx.battle.units.map((x) => (x.id === unitId ? { ...x, pos, facing: facing ?? x.facing } : x)) } };
}

/** Bewegung über einen Weg (bzw. Sprung) inkl. Weiterrutschen auf rutschigem Gelände. */
export function moveAlong(ctx: Ctx, unitId: string, path: Pos[]): Ctx {
  const u = getUnit(ctx.battle, unitId);
  if (!u?.pos || !path.length) return ctx;
  let from = path.length > 1 ? path[path.length - 2] : u.pos;
  let to = path[path.length - 1];
  const extra = slide(
    ctx.battle.map,
    from,
    to,
    (p) => !!terrainOf(ctx, p)?.slippery,
    (p) => !canEnter(ctx, { ...u, pos: to }, p),
  );
  if (extra.length) {
    from = extra.length > 1 ? extra[extra.length - 2] : to;
    to = extra[extra.length - 1];
  }
  ctx = placeUnitAt(ctx, unitId, to, facingFromStep(from, to, facingOf(u)));
  return { ...ctx, log: [...ctx.log, `${u.name} bewegt sich${extra.length ? ` und rutscht ${extra.length} Feld${extra.length === 1 ? '' : 'er'} weiter` : ''}.`] };
}

// ---------- Ausführung ----------

interface Hit {
  units: Unit[];
  objects: MapObject[];
  tiles: Pos[];
}

/** Löst Ziele inkl. Hindernis-Verhalten und Radius in getroffene Dinge auf. Null = Fähigkeit bricht ab. */
function resolveHits(ctx: Ctx, caster: Unit, a: AbilityFields, targets: Pos[]): Hit | null {
  const t = a.targeting;
  const hitTiles: Pos[] = [];
  for (const target of targets) {
    if (t.ignoresObstacles || !caster.pos || t.kind === 'aoe') {
      hitTiles.push(target);
      continue;
    }
    const ignore = [caster.id, ...unitsAt(ctx.battle, target).map((u) => u.id)];
    const bounces = t.obstacle.behavior === 'abprallen' ? t.obstacle.maxBounces : 0;
    const r = traceProjectile(
      ctx.battle.map,
      caster.pos,
      target,
      (p) => !samePos(p, target) && isObstacle(ctx, p, ignore),
      (p) => hasAnything(legalOnTile(ctx, caster, a, p, false)),
      bounces,
    );
    if (r.outcome === 'ziel' && r.end) {
      hitTiles.push(r.end);
      continue;
    }
    if (r.outcome === 'verlassen') continue;
    const behavior = t.obstacle.behavior === 'abprallen' ? t.obstacle.final : t.obstacle.behavior;
    const obstacle = r.end!;
    const before = r.path.length > 1 ? r.path[r.path.length - 2] : caster.pos;
    if (behavior === 'abbruch') return null;
    if (behavior === 'hindernis') hitTiles.push(obstacle);
    if (behavior === 'davor') hitTiles.push(before);
    if (behavior === 'beide') hitTiles.push(obstacle, target);
  }
  const radius = t.radius.length ? uniq(hitTiles.flatMap((p) => areaTiles(p, t.radius, 'n'))) : [];
  const all = uniq([...hitTiles, ...radius]);
  const hit: Hit = { units: [], objects: [], tiles: [] };
  for (const p of all) {
    const r = legalOnTile(ctx, caster, a, p, false);
    hit.units.push(...r.units.filter((u) => !hit.units.some((x) => x.id === u.id)));
    hit.objects.push(...r.objects.filter((o) => !hit.objects.some((x) => x.id === o.id)));
    if (r.tile || r.units.length || r.objects.length) hit.tiles.push(p);
  }
  return hit;
}

function applyBlock(ctx: Ctx, casterId: string, abilityId: string, a: AbilityFields, b: AbilityBlock, hit: Hit, targets: Pos[]): Ctx {
  const caster = getUnit(ctx.battle, casterId)!;
  switch (b.kind) {
    case 'ressource':
      if (!b.resourceId) return ctx;
      for (const u of hit.units) {
        const tpl = u.templateId ? ctx.defs.allys[u.templateId] ?? ctx.defs.enemies[u.templateId] : undefined;
        const charAdj = tpl?.resources.find((r) => r.resourceId === b.resourceId)?.adjustments ?? [];
        const resAdj = ctx.defs.resources[b.resourceId]?.adjustments ?? [];
        const adj = totalAdjustment([...charAdj, ...resAdj], abilityId, a.typeIds);
        const amount = adj ? Math.sign(b.amount) * Math.max(0, Math.abs(b.amount) + adj) : b.amount;
        ctx = changeResource(ctx, u.id, b.resourceId, amount, b.mayExceedMax);
      }
      return ctx;
    case 'effekt':
      for (const u of hit.units) {
        if (b.action === 'ausloesen' && b.effectId) ctx = giveEffect(ctx, u.id, b.effectId, b.duration, casterId);
        if (b.action === 'beenden') {
          ctx = endEffects(ctx, u.id, (e) => e.effectId === b.effectId || (ctx.defs.effects[e.effectId]?.typeIds ?? []).some((t) => b.typeIds.includes(t)));
        }
      }
      return ctx;
    case 'anwender-bewegen': {
      const target = targets[0];
      if (!target || !caster.pos) return ctx;
      const allowed = b.area.length === 0 || areaTiles(caster.pos, b.area, 'n').some((p) => samePos(p, target));
      if (!allowed) return { ...ctx, log: [...ctx.log, `${caster.name}: Zielfeld liegt außerhalb der möglichen Bewegung.`] };
      if (b.ignoresObstacles) return canEnter(ctx, caster, target) ? moveAlong(ctx, casterId, [target]) : ctx;
      const path = findPath(ctx, caster, target);
      return path ? moveAlong(ctx, casterId, path) : { ...ctx, log: [...ctx.log, `${caster.name}: kein Weg dorthin.`] };
    }
    case 'ziel-bewegen':
      for (const u of hit.units) {
        if (!u.pos || !caster.pos) continue;
        let path: Pos[] = [];
        if (b.mode === 'richtung') {
          const dest = areaTiles(u.pos, b.area, 'n').find((p) => canEnter(ctx, u, p));
          if (dest) path = [dest];
        } else {
          const dx = Math.sign(u.pos.x - caster.pos.x) * (b.mode === 'weg' ? 1 : -1);
          const dy = Math.sign(u.pos.y - caster.pos.y) * (b.mode === 'weg' ? 1 : -1);
          let cur = u.pos;
          for (let i = 0; i < b.distance; i++) {
            const next = { x: cur.x + dx, y: cur.y + dy };
            if (!b.ignoresObstacles && !canEnter(ctx, u, next)) break;
            if (b.ignoresObstacles && isVoidTile(ctx.battle, next)) break;
            path.push(next);
            cur = next;
          }
          if (b.ignoresObstacles) {
            while (path.length && !canEnter(ctx, u, path[path.length - 1])) path.pop();
            path = path.length ? [path[path.length - 1]] : [];
          }
        }
        ctx = path.length ? moveAlong(ctx, u.id, path) : ctx;
      }
      return ctx;
    case 'blickrichtung': {
      const turn = (who: Unit, other: Unit | undefined, fixed: Facing) => {
        if (!who.pos) return who.facing;
        if (b.mode === 'richtung') return fixed;
        if (!other?.pos) return who.facing;
        const toward = facingTowards(who.pos, other.pos, facingOf(who));
        const opposite: Record<Facing, Facing> = { n: 's', s: 'n', o: 'w', w: 'o' };
        return b.mode === 'zu' ? toward : opposite[toward];
      };
      const units = ctx.battle.units.map((x) => {
        if (b.who === 'ziel' && hit.units.some((h) => h.id === x.id)) return { ...x, facing: turn(x, caster, b.direction) };
        if (b.who === 'anwender' && x.id === casterId) return { ...x, facing: turn(x, hit.units[0], b.direction) };
        return x;
      });
      return { ...ctx, battle: { ...ctx.battle, units } };
    }
    default:
      return { ...ctx, log: [...ctx.log, `(Baustein „${b.kind}“ folgt in Abschnitt 13b.)`] };
  }
}

/**
 * Führt eine Fähigkeit aus: Kosten bezahlen, Ziele (inkl. Hindernissen und Radius) auflösen,
 * Bausteine anwenden. Getroffene drehen sich ggf. zur Quelle.
 */
export function executeAbility(ctx: Ctx, casterId: string, abilityId: string, targets: Pos[]): Ctx {
  const a = ctx.defs.abilities[abilityId];
  const caster = getUnit(ctx.battle, casterId);
  if (!a || !caster) return ctx;
  const chosen = a.targeting.kind === 'aoe' ? rangeTiles(ctx.battle, caster, a) : targets;
  ctx = { ...ctx, log: [...ctx.log, `${caster.name} setzt ${a.title} ein.`] };
  ctx = pay(ctx, casterId, a, a.targeting.kind === 'aoe' ? [] : chosen);
  const hit = resolveHits(ctx, caster, a, chosen);
  if (!hit) return { ...ctx, log: [...ctx.log, `${a.title} wird von einem Hindernis aufgehalten.`] };
  for (const u of hit.units) {
    if (u.id === casterId) continue;
    ctx = { ...ctx, battle: onTargeted(ctx.battle, u.id, casterId, a.typeIds) };
    if (u.side !== caster.side) ctx = { ...ctx, battle: { ...ctx.battle, units: ctx.battle.units.map((x) => (x.id === u.id ? { ...x, lastAttackerId: casterId } : x)) } };
  }
  for (const b of a.blocks) {
    const fresh = { ...hit, units: hit.units.map((u) => getUnit(ctx.battle, u.id)!).filter((u) => u && u.status !== 'entfernt') };
    ctx = applyBlock(ctx, casterId, abilityId, a, b, fresh, chosen);
  }
  if (!hit.units.length && !hit.tiles.length && a.blocks.length) ctx = { ...ctx, log: [...ctx.log, `${a.title} trifft nichts.`] };
  return ctx;
}

export const abilityTitle = (ctx: Ctx, id: string) => titleOf(ctx.defs, id);
