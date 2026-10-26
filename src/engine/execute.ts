// Fähigkeiten im Kampf: Reichweite, legale Ziele, Bedingungen, Kosten und Ausführung der Bausteine.
import { canPay, resourceCosts, traceProjectile, type AbilityBlock, type AbilityFields } from './abilities';
import { dimsOf, facingOf, getUnit, gridOf, litArea, mapObject, objectTiles, rectTiles, onTargeted, unitTiles, visible, type BattleState, type MapObject, type Unit } from './battle';
import { titleOf } from './defs';
import { hasBlock, type Selection } from './effects';
import { areaTiles, facingFromStep, facingTowards, type Facing } from './facing';
import { distance, hasLineOfSight, inBounds, neighbors, posKey, samePos, type Grid, type Pos } from './grid';
import { slotsNeeded } from './objects';
import { totalAdjustment } from './resources';
import {
  changeGlobal, changeResource, consumeShield, destroyUnit, effectDefs, emit, endEffects, giveEffect, replaceUnit, valueOf, type Ctx, type Source,
} from './status';
import { canWalk, slide, terrainCosts } from './terrain';

const uniq = (tiles: Pos[]) => [...new Map(tiles.map((t) => [posKey(t), t])).values()];
let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const isVoidTile = (b: BattleState, p: Pos) => !inBounds(b.map, p) || (b.map.voids ?? []).includes(posKey(p));

export const unitsAt = (b: BattleState, p: Pos) =>
  b.units.filter((u) => u.status !== 'entfernt' && !u.carriedBy && unitTiles(u).some((t) => samePos(t, p)));
export const objectsAt = (b: BattleState, p: Pos) => (b.objects ?? []).filter((o) => objectTiles(o).some((t) => samePos(t, p)));
export const terrainOf = (ctx: Ctx, p: Pos) => {
  const id = ctx.battle.terrain?.[posKey(p)];
  return id ? ctx.defs.terrains[id] : undefined;
};

function setUnits(ctx: Ctx, fn: (u: Unit) => Unit): Ctx {
  return { ...ctx, battle: { ...ctx.battle, units: ctx.battle.units.map(fn) } };
}
const log = (ctx: Ctx, line: string): Ctx => ({ ...ctx, log: [...ctx.log, line] });

const selects = (sel: Selection, id: string | undefined, typeIds: string[]) => sel.all || (!!id && sel.ids.includes(id)) || typeIds.some((t) => sel.typeIds.includes(t));

/** Felder in Reichweite (von jedem belegten Feld aus, gedreht nach Blickrichtung). */
export function rangeTiles(b: BattleState, caster: Unit, ability: AbilityFields): Pos[] {
  return uniq(unitTiles(caster).flatMap((t) => areaTiles(t, ability.targeting.range, facingOf(caster)))).filter((p) => !isVoidTile(b, p));
}

/** Ist ein Objekt für Allys sichtbar (nicht verborgen oder aufgedeckt)? */
export const objectVisible = (b: BattleState, o: MapObject) => !o.hidden || (b.revealed ?? []).includes(o.id);

/** Nimmt viewer den Charakter target wahr? (Effekt „Nicht wahrnehmbar“) */
export function perceives(ctx: Ctx, viewer: Unit, target: Unit): boolean {
  if (viewer.id === target.id) return true;
  return !hasBlock(target.effects ?? [], 'unsichtbar', effectDefs(ctx.defs)).some((b) => selects(b.selection, viewer.templateId, viewer.typeIds ?? []));
}

/** Kontext einer Reaktion: wer gerade eine Fähigkeit ausführt bzw. Ziel wird. */
export interface ReactionContext {
  sourceId?: string;
  targetIds?: string[];
}

function unitIsLegal(caster: Unit, u: Unit, a: AbilityFields, rc?: ReactionContext): boolean {
  const l = a.targeting.legal;
  const typed = (rule: { on: boolean; typeIds: string[] }) => rule.on && (!rule.typeIds.length || (u.typeIds ?? []).some((t) => rule.typeIds.includes(t)));
  if (l.ausfuehrend.on && rc?.sourceId === u.id && typed(l.ausfuehrend)) return true;
  if (l.anvisiert.on && rc?.targetIds?.includes(u.id) && typed(l.anvisiert)) return true;
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
export function legalOnTile(ctx: Ctx, caster: Unit, a: AbilityFields, p: Pos, onlyVisible: boolean, rc?: ReactionContext) {
  const b = ctx.battle;
  const units = unitsAt(b, p).filter((u) => unitIsLegal(caster, u, a, rc) && (!onlyVisible || perceives(ctx, caster, u)));
  const objects = objectsAt(b, p).filter((o) => objectIsLegal(ctx, o, a) && (!onlyVisible || objectVisible(b, o)));
  const l = a.targeting.legal;
  const tid = b.terrain?.[posKey(p)];
  const terrain = l.gelaende.on && (!l.gelaende.ids.length || (tid !== undefined && l.gelaende.ids.includes(tid)));
  const empty = l.leer && unitsAt(b, p).length === 0 && objectsAt(b, p).filter((o) => objectVisible(b, o)).length === 0;
  return { units, objects, tile: terrain || empty };
}

const hasAnything = (r: ReturnType<typeof legalOnTile>) => r.units.length > 0 || r.objects.length > 0 || r.tile;

/**
 * Was ein Charakter sieht: Allys teilen ihre Sicht. Gegner sehen ihr Sichtfeld und – wenn sie im Licht stehen –
 * die beleuchteten Felder, die ohne Nebel dazwischen mit ihrem Licht zusammenhängen (diagonal nur, wenn diagonale
 * Bewegung erlaubt ist) und zu denen sie freie Sicht haben.
 */
export function perception(ctx: Ctx, viewer: Unit): Set<string> {
  if (viewer.side === 'ally') return visible(ctx.battle);
  const b = ctx.battle;
  const lit = litArea(b);
  const own = new Set<string>();
  const from = unitTiles(viewer);
  for (const t of from) {
    own.add(posKey(t));
    for (const p of areaTiles(t, viewer.sightArea ?? [], facingOf(viewer))) own.add(posKey(p));
  }
  const start = from.filter((t) => lit.has(posKey(t)));
  if (!start.length) return own;
  // Zusammenhängendes Licht um den Gegner.
  const steps = b.rules.diagonal
    ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
    : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const region = new Set(start.map(posKey));
  const queue = [...start];
  while (queue.length) {
    const p = queue.shift()!;
    for (const [dx, dy] of steps) {
      const q = { x: p.x + dx, y: p.y + dy };
      const k = posKey(q);
      if (!region.has(k) && lit.has(k)) {
        region.add(k);
        queue.push(q);
      }
    }
  }
  // Davon nur, was er auch sehen kann (Wände und Schatten werfende Objekte blockieren).
  const g = gridOf(b.map);
  for (const k of region) {
    const [x, y] = k.split(',').map(Number);
    if (from.some((t) => hasLineOfSight(g, t, { x, y }))) own.add(k);
  }
  return own;
}

/** Felder, die als Ziel gewählt werden dürfen (nur wahrgenommene). */
export function legalTargets(ctx: Ctx, casterId: string, a: AbilityFields, rc?: ReactionContext): Pos[] {
  const caster = getUnit(ctx.battle, casterId);
  if (!caster) return [];
  const seen = perception(ctx, caster);
  return rangeTiles(ctx.battle, caster, a).filter((p) => seen.has(posKey(p)) && hasAnything(legalOnTile(ctx, caster, a, p, true, rc)));
}

// ---------- Bedingungen & Kosten ----------

export function conditionsMet(ctx: Ctx, casterId: string, a: AbilityFields): boolean {
  const u = getUnit(ctx.battle, casterId);
  if (!u) return false;
  return a.conditions.every((c) => {
    if (c.kind === 'gegenstand') return !c.objectId || [...(u.items ?? []), ...(u.carried ?? [])].some((i) => i.objectId === c.objectId && i.count > 0);
    if (c.kind === 'ressource') {
      if (!c.resourceId) return true;
      const v = ctx.defs.resources[c.resourceId]?.scope === 'global' ? ctx.globals[c.resourceId] : valueOf(ctx.defs, u, c.resourceId);
      if (v === undefined) return false;
      return c.bound === 'min' ? v >= c.value : v <= c.value;
    }
    const tiles = uniq(unitTiles(u).flatMap((t) => areaTiles(t, c.area, facingOf(u))));
    const sel = c.selection;
    return tiles.some((p) => {
      if (c.entity === 'gelaende') {
        const tid = ctx.battle.terrain?.[posKey(p)];
        return !!tid && (sel.all || sel.ids.includes(tid));
      }
      if (c.entity === 'objekt') return objectsAt(ctx.battle, p).some((o) => selects(sel, o.objectId, ctx.defs.objects[o.objectId]?.typeIds ?? []));
      const side = c.entity === 'ally' ? 'ally' : 'enemy';
      return unitsAt(ctx.battle, p).some((x) => x.id !== u.id && x.side === side && selects(sel, x.templateId, x.typeIds ?? []));
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

const itemFits = (ctx: Ctx, sel: Selection, objectId: string) =>
  sel.all || sel.ids.includes(objectId) || (ctx.defs.objects[objectId]?.typeIds ?? []).some((t) => sel.typeIds.includes(t));

export function affordable(ctx: Ctx, casterId: string, a: AbilityFields, targets: Pos[] = []): boolean {
  const u = getUnit(ctx.battle, casterId)!;
  const objectCostsOk = a.costs.every((c) => {
    if (c.kind !== 'objekt') return true;
    return (u.items ?? []).filter((i) => itemFits(ctx, { ...c.selection, all: false }, i.objectId)).reduce((s, i) => s + i.count, 0) >= c.count;
  });
  return objectCostsOk && canPay(costsFor(ctx, casterId, a, targets), available(ctx, casterId));
}

function removeItem(ctx: Ctx, unitId: string, objectId: string, count = 1): Ctx {
  return setUnits(ctx, (x) => {
    if (x.id !== unitId) return x;
    let left = count;
    const take = (list: { objectId: string; count: number }[] = []) =>
      list
        .map((i) => {
          if (i.objectId !== objectId || left === 0) return i;
          const n = Math.min(left, i.count);
          left -= n;
          return { ...i, count: i.count - n };
        })
        .filter((i) => i.count > 0);
    const items = take(x.items);
    return { ...x, items, carried: take(x.carried) };
  });
}

/** Gegenstand bekommen: in den Rucksack, wenn Platz ist, sonst wird er getragen. */
function addItem(ctx: Ctx, unitId: string, objectId: string, count = 1): Ctx {
  const u = getUnit(ctx.battle, unitId);
  if (!u) return ctx;
  const tpl = u.templateId ? ctx.defs.allys[u.templateId] ?? ctx.defs.enemies[u.templateId] : undefined;
  const slots = tpl?.backpackSlots ?? 0;
  const items = [...(u.items ?? [])];
  const existing = items.find((i) => i.objectId === objectId);
  const next = existing ? items.map((i) => (i === existing ? { ...i, count: i.count + count } : i)) : [...items, { objectId, count }];
  const used = next.reduce((s, i) => s + slotsNeeded(ctx.defs.objects[i.objectId] ?? { stack: { stackable: false, max: 1 } }, i.count), 0);
  if (used <= slots) return setUnits(ctx, (x) => (x.id === unitId ? { ...x, items: next } : x));
  const carried = [...(u.carried ?? [])];
  const c = carried.find((i) => i.objectId === objectId);
  return log(
    setUnits(ctx, (x) => (x.id === unitId ? { ...x, carried: c ? carried.map((i) => (i === c ? { ...i, count: i.count + count } : i)) : [...carried, { objectId, count }] } : x)),
    `${u.name}: Rucksack voll – ${titleOf(ctx.defs, objectId)} wird getragen.`,
  );
}

function pay(ctx: Ctx, casterId: string, a: AbilityFields, targets: Pos[]): Ctx {
  for (const [id, amount] of Object.entries(costsFor(ctx, casterId, a, targets))) {
    if (amount === 0) continue;
    if (ctx.defs.resources[id]?.scope === 'global') ctx = changeGlobal(ctx, id, -amount, false);
    else ctx = changeResource(ctx, casterId, id, -amount, false);
  }
  for (const c of a.costs) {
    if (c.kind !== 'objekt') continue;
    let left = c.count;
    for (const i of getUnit(ctx.battle, casterId)?.items ?? []) {
      if (left === 0 || !itemFits(ctx, { ...c.selection, all: false }, i.objectId)) continue;
      const n = Math.min(left, i.count);
      left -= n;
      ctx = removeItem(ctx, casterId, i.objectId, n);
    }
  }
  return ctx;
}

// ---------- Hindernisse & Wege ----------

/** Hindernis für Fähigkeiten: Gelände-Hindernis, Objekt bzw. Charakter mit Kollision. */
function isObstacle(ctx: Ctx, p: Pos, ignore: string[]): boolean {
  if (terrainOf(ctx, p)?.obstacle) return true;
  if (objectsAt(ctx.battle, p).some((o) => ctx.defs.objects[o.objectId]?.collision)) return true;
  return unitsAt(ctx.battle, p).some((u) => !ignore.includes(u.id) && u.collision !== false);
}

/** Kann eine Figur auf diesem Feld stehen? (Gelände, Objekte und Figuren mit Kollision; „Hindernisse ignorieren“.) */
export function canEnter(ctx: Ctx, u: Unit, pos: Pos): boolean {
  const ignores = hasBlock(u.effects ?? [], 'hindernis-ignorieren', effectDefs(ctx.defs));
  const ignored = (cat: string, id: string | undefined, types: string[]) => ignores.some((b) => b.category === cat && selects(b.selection, id, types));
  const effects = (u.effects ?? []).map((e) => e.effectId);
  return unitTiles(u, pos).every((t) => {
    if (isVoidTile(ctx.battle, t)) return false;
    const tid = ctx.battle.terrain?.[posKey(t)];
    const terrain = tid ? ctx.defs.terrains[tid] : undefined;
    if (terrain && !canWalk(terrain, u.typeIds ?? [], effects) && !ignored('gelaende', tid, [])) return false;
    if (u.collision === false) return true;
    if (objectsAt(ctx.battle, t).some((o) => ctx.defs.objects[o.objectId]?.collision && !ignored('objekt', o.objectId, ctx.defs.objects[o.objectId]?.typeIds ?? []))) return false;
    return !unitsAt(ctx.battle, t).some(
      (x) => x.id !== u.id && x.collision !== false && !ignored(x.side === 'ally' ? 'ally' : 'gegner', x.templateId, x.typeIds ?? []),
    );
  });
}

/** Kürzester Weg (Liste der Felder ohne Start) oder null. */
export function findPath(ctx: Ctx, u: Unit, to: Pos, maxSteps = 400): Pos[] | null {
  if (!u.pos) return null;
  const g: Grid = { width: ctx.battle.map.width, height: ctx.battle.map.height, isPassable: (p) => canEnter(ctx, u, p), blocksSight: () => false };
  const rules = { diagonal: ctx.battle.rules.diagonal, cornerCutting: ctx.battle.rules.cornerCutting };
  const prev = new Map<string, Pos | null>([[posKey(u.pos), null]]);
  const queue = [u.pos];
  while (queue.length && prev.size < maxSteps * 40) {
    const p = queue.shift()!;
    if (samePos(p, to)) break;
    for (const n of neighbors(g, p, rules)) {
      if (prev.has(posKey(n))) continue;
      prev.set(posKey(n), p);
      queue.push(n);
    }
  }
  if (!prev.has(posKey(to))) return null;
  const path: Pos[] = [];
  for (let p: Pos | null = to; p && !samePos(p, u.pos); p = prev.get(posKey(p)) ?? null) path.unshift(p);
  return path;
}

/** Bewegung über einen Weg (bzw. Sprung) inkl. Weiterrutschen; Getragenes bewegt sich mit. */
export function moveAlong(ctx: Ctx, unitId: string, path: Pos[]): Ctx {
  const u = getUnit(ctx.battle, unitId);
  if (!u?.pos || !path.length) return ctx;
  const start = u.pos;
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
  const facing = facingFromStep(from, to, facingOf(u));
  ctx = setUnits(ctx, (x) => (x.id === unitId ? { ...x, pos: to, facing } : x.carriedBy === unitId ? { ...x, pos: to } : x));
  const n = path.length;
  ctx = log(ctx, `${u.name} bewegt sich ${n} Feld${n === 1 ? '' : 'er'}${extra.length ? ` und rutscht ${extra.length} Feld${extra.length === 1 ? '' : 'er'} weiter` : ''}.`);
  // Ereignisse Feld für Feld (für Bereichs- und Gelände-Auslöser).
  const steps = [...path, ...extra];
  let prev = start;
  for (const s of steps) {
    ctx = emit(ctx, { kind: 'move', unitId, from: prev, to: s });
    prev = s;
  }
  return ctx;
}

// ---------- Ausführung ----------

export interface Hit {
  units: Unit[];
  objects: MapObject[];
  tiles: Pos[];
}

/** Löst Ziele inkl. Hindernis-Verhalten und Radius in getroffene Dinge auf. Null = Fähigkeit bricht ab. */
function resolveHits(ctx: Ctx, caster: Unit, a: AbilityFields, targets: Pos[], rc?: ReactionContext): Hit | null {
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
      (p) => hasAnything(legalOnTile(ctx, caster, a, p, false, rc)),
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
    const r = legalOnTile(ctx, caster, a, p, false, rc);
    hit.units.push(...r.units.filter((u) => !hit.units.some((x) => x.id === u.id)));
    hit.objects.push(...r.objects.filter((o) => !hit.objects.some((x) => x.id === o.id)));
    hit.tiles.push(p);
  }
  return hit;
}

export interface ExecOptions {
  /** Gewählter Gegenstand für „Objekt verwenden/geben/werfen“ bzw. „Platzieren aus dem Rucksack“. */
  objectId?: string;
  /** Reaktions-Kontext (legale Ziele „führt gerade aus“/„wird gerade Ziel“). */
  reaction?: ReactionContext;
  /** Herkunft für vergebene Effekte (Objekt-/Gelände-Wirkungen). */
  origin?: import('./effects').ActiveEffect['origin'];
}

/** Gegenstände eines Charakters, die zu einer Auswahl passen (Rucksack und Getragenes). */
export function matchingItems(ctx: Ctx, u: Unit, sel: Selection): string[] {
  return [...new Set([...(u.items ?? []), ...(u.carried ?? [])].filter((i) => i.count > 0 && itemFits(ctx, sel, i.objectId)).map((i) => i.objectId))];
}

/** Ein Objekt auf die Map legen (Kollision: nur, wenn frei – sonst daneben auf ein freies Feld). */
function dropObject(ctx: Ctx, objectId: string, at: Pos): Ctx {
  const d = ctx.defs.objects[objectId];
  const { w, h } = dimsOf(d);
  const freeTile = (p: Pos) =>
    !isVoidTile(ctx.battle, p) &&
    (!d?.collision || (!objectsAt(ctx.battle, p).some((o) => ctx.defs.objects[o.objectId]?.collision) && !unitsAt(ctx.battle, p).some((u) => u.collision !== false)));
  // Große Objekte brauchen alle ihre Felder frei.
  const free = (p: Pos) => rectTiles(p, w, h).every(freeTile);
  let pos: Pos | undefined = free(at) ? at : undefined;
  for (let r = 1; !pos && r <= 3; r++) {
    for (let dy = -r; dy <= r && !pos; dy++) for (let dx = -r; dx <= r && !pos; dx++) if (free({ x: at.x + dx, y: at.y + dy })) pos = { x: at.x + dx, y: at.y + dy };
  }
  if (!pos) return log(ctx, `${titleOf(ctx.defs, objectId)} findet keinen Platz.`);
  return { ...ctx, battle: { ...ctx.battle, objects: [...(ctx.battle.objects ?? []), mapObject(d, { id: uid('obj'), objectId, pos, hidden: false })] } };
}

/** Wendet einen Baustein an. caster kann auch ein Objekt bzw. Feld sein (Wirkungen). */
export function applyBlock(ctx: Ctx, caster: Unit, abilityId: string, a: AbilityFields, b: AbilityBlock, hit: Hit, targets: Pos[], opts: ExecOptions = {}): Ctx {
  const source: Source = { unitId: caster.id, side: caster.side, typeIds: a.typeIds, kind: 'faehigkeit' };
  const self = getUnit(ctx.battle, caster.id);
  switch (b.kind) {
    case 'ressource':
      if (!b.resourceId) return ctx;
      for (const u of hit.units) {
        const tpl = u.templateId ? ctx.defs.allys[u.templateId] ?? ctx.defs.enemies[u.templateId] : undefined;
        const charAdj = tpl?.resources.find((r) => r.resourceId === b.resourceId)?.adjustments ?? [];
        const resAdj = ctx.defs.resources[b.resourceId]?.adjustments ?? [];
        const adj = totalAdjustment([...charAdj, ...resAdj], abilityId, a.typeIds);
        const amount = adj ? Math.sign(b.amount) * Math.max(0, Math.abs(b.amount) + adj) : b.amount;
        ctx = changeResource(ctx, u.id, b.resourceId, amount, b.mayExceedMax, 0, u.id === caster.id ? undefined : source);
      }
      return ctx;
    case 'effekt':
      for (const u of hit.units) {
        if (b.action === 'ausloesen' && b.effectId) ctx = giveEffect(ctx, u.id, b.effectId, b.duration, caster.id, 0, opts.origin);
        if (b.action === 'beenden') {
          ctx = endEffects(ctx, u.id, (e) => e.effectId === b.effectId || (ctx.defs.effects[e.effectId]?.typeIds ?? []).some((t) => b.typeIds.includes(t)));
        }
      }
      return ctx;
    case 'faehigkeit':
      for (const u of hit.units) {
        const has = u.actions.flatMap((x) => x.abilities.map((y) => y.abilityId)).filter((id): id is string => !!id);
        const pick = has.find((id) => id === b.abilityId || (ctx.defs.abilities[id]?.typeIds ?? []).some((t) => b.typeIds.includes(t)));
        if (b.action === 'unterbrechen') {
          ctx = { ...ctx, pending: (ctx.pending ?? []).filter((p) => p.unitId !== u.id) };
          ctx = log(ctx, `${u.name} wird unterbrochen.`);
          continue;
        }
        if (!pick) continue;
        const def = ctx.defs.abilities[pick];
        const targetsFor = def.targeting.kind === 'ziel' ? legalTargets(ctx, u.id, def).slice(0, def.targeting.maxTargets) : [];
        ctx = executeAbility(ctx, u.id, pick, targetsFor, { reaction: opts.reaction });
      }
      return ctx;
    case 'schutz':
      for (const u of hit.units) {
        const shield = { id: uid('schutz'), against: b.against, from: b.from, typeIds: b.typeIds, roundsLeft: b.duration.kind === 'runden' ? b.duration.rounds : null };
        ctx = setUnits(ctx, (x) => (x.id === u.id ? { ...x, shields: [...(x.shields ?? []), shield] } : x));
        ctx = log(ctx, `${u.name} erhält einen Schutz.`);
      }
      return ctx;
    case 'anwender-bewegen': {
      const target = targets[0];
      if (!target || !self?.pos) return ctx;
      const allowed = b.area.length === 0 || areaTiles(self.pos, b.area, 'n').some((p) => samePos(p, target));
      if (!allowed) return log(ctx, `${self.name}: Zielfeld liegt außerhalb der möglichen Bewegung.`);
      if (b.ignoresObstacles) return canEnter(ctx, self, target) ? moveAlong(ctx, self.id, [target]) : ctx;
      const path = findPath(ctx, self, target);
      return path ? moveAlong(ctx, self.id, path) : log(ctx, `${self.name}: kein Weg dorthin.`);
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
    case 'gelaende':
      if (!b.terrainId) return ctx;
      for (const p of hit.tiles) ctx = { ...ctx, battle: { ...ctx.battle, terrain: { ...(ctx.battle.terrain ?? {}), [posKey(p)]: b.terrainId } } };
      return log(ctx, `Gelände wird zu ${titleOf(ctx.defs, b.terrainId)}.`);
    case 'zerstoeren':
      for (const u of hit.units.filter((x) => x.side === 'enemy')) ctx = destroyUnit(ctx, u.id);
      if (hit.objects.length) {
        const ids = new Set(hit.objects.map((o) => o.id));
        ctx = log({ ...ctx, battle: { ...ctx.battle, objects: (ctx.battle.objects ?? []).filter((o) => !ids.has(o.id)) } }, `${hit.objects.map((o) => titleOf(ctx.defs, o.objectId)).join(', ')} zerstört.`);
      }
      return ctx;
    case 'ersetzen':
      if (!b.into.id) return ctx;
      for (const u of hit.units.filter((x) => x.side === 'enemy')) ctx = replaceUnit(ctx, u.id, b.into.kind, b.into.id);
      for (const o of hit.objects) {
        if (b.into.kind === 'objekt') {
          ctx = { ...ctx, battle: { ...ctx.battle, objects: (ctx.battle.objects ?? []).map((x) => (x.id === o.id ? mapObject(ctx.defs.objects[b.into.id!], { ...x, objectId: b.into.id! }) : x)) } };
        } else {
          ctx = { ...ctx, battle: { ...ctx.battle, objects: (ctx.battle.objects ?? []).filter((x) => x.id !== o.id) } };
          ctx = spawnEnemy(ctx, b.into.id!, o.pos);
        }
      }
      return ctx;
    case 'sammeln':
      if (!self) return ctx;
      for (const o of hit.objects) {
        if (!ctx.defs.objects[o.objectId]?.collectible) {
          ctx = log(ctx, `${titleOf(ctx.defs, o.objectId)} kann nicht gesammelt werden.`);
          continue;
        }
        ctx = { ...ctx, battle: { ...ctx.battle, objects: (ctx.battle.objects ?? []).filter((x) => x.id !== o.id) } };
        ctx = addItem(ctx, self.id, o.objectId);
        ctx = log(ctx, `${self.name} sammelt ${titleOf(ctx.defs, o.objectId)}.`);
        ctx = emit(ctx, { kind: 'item', unitId: self.id, objectId: o.objectId, action: 'sammelt', at: o.pos });
      }
      return ctx;
    case 'tragen':
      if (!self) return ctx;
      for (const u of hit.units.filter((x) => x.id !== self.id)) {
        ctx = setUnits(ctx, (x) => (x.id === u.id ? { ...x, carriedBy: self.id, pos: self.pos } : x));
        ctx = log(ctx, `${self.name} trägt ${u.name}.`);
      }
      for (const o of hit.objects) {
        if (!ctx.defs.objects[o.objectId]?.carriable) continue;
        ctx = { ...ctx, battle: { ...ctx.battle, objects: (ctx.battle.objects ?? []).filter((x) => x.id !== o.id) } };
        ctx = setUnits(ctx, (x) => (x.id === self.id ? { ...x, carried: [...(x.carried ?? []), { objectId: o.objectId, count: 1 }] } : x));
        ctx = log(ctx, `${self.name} trägt ${titleOf(ctx.defs, o.objectId)}.`);
      }
      return ctx;
    case 'platzieren': {
      const target = targets[0];
      if (!self?.pos || !target) return ctx;
      if (b.area.length && !areaTiles(self.pos, b.area, 'n').some((p) => samePos(p, target))) return log(ctx, 'Zielort liegt außerhalb des Bereichs.');
      if (b.what === 'getragenes') {
        const unit = ctx.battle.units.find((x) => x.carriedBy === self.id);
        if (unit) {
          ctx = setUnits(ctx, (x) => (x.id === unit.id ? { ...x, carriedBy: undefined, pos: target } : x));
          return emit(log(ctx, `${self.name} setzt ${unit.name} ab.`), { kind: 'move', unitId: unit.id, from: self.pos, to: target });
        }
        const item = self.carried?.[0];
        if (!item) return log(ctx, `${self.name} trägt nichts.`);
        ctx = removeItem(ctx, self.id, item.objectId);
        ctx = dropObject(ctx, item.objectId, target);
        return emit(ctx, { kind: 'item', unitId: self.id, objectId: item.objectId, action: 'platziert', at: target });
      }
      const objectId = opts.objectId ?? matchingItems(ctx, self, b.selection)[0];
      if (!objectId) return log(ctx, `${self.name} hat keinen passenden Gegenstand.`);
      ctx = removeItem(ctx, self.id, objectId);
      ctx = dropObject(ctx, objectId, target);
      return emit(log(ctx, `${self.name} platziert ${titleOf(ctx.defs, objectId)}.`), { kind: 'item', unitId: self.id, objectId, action: 'platziert', at: target });
    }
    case 'objekt-verwenden': {
      if (!self) return ctx;
      const objectId = opts.objectId ?? matchingItems(ctx, self, b.selection).find((id) => ctx.defs.objects[id]?.use.usable);
      const d = objectId ? ctx.defs.objects[objectId] : undefined;
      if (!objectId || !d?.use.usable) return log(ctx, `${self.name} hat nichts Verwendbares.`);
      if (d.use.consumed) ctx = removeItem(ctx, self.id, objectId);
      ctx = log(ctx, `${self.name} verwendet ${d.title}.`);
      // Die Verwendung wirkt wie eine Fähigkeit; Ziele: das eigene Feld, wenn erlaubt, sonst die Ziele dieser Fähigkeit.
      const useTargets = d.use.ability.targeting.range.includes('0,0') && self.pos ? [self.pos] : targets;
      ctx = runAbility(ctx, self, `objekt:${objectId}`, { ...d.use.ability, title: d.title }, useTargets, opts, false);
      return emit(ctx, { kind: 'item', unitId: self.id, objectId, action: 'verwendet' });
    }
    case 'objekt-geben': {
      if (!self) return ctx;
      const objectId = opts.objectId ?? matchingItems(ctx, self, b.selection)[0];
      const receiver = hit.units.find((x) => x.id !== self.id);
      if (!objectId || !receiver) return log(ctx, 'Nichts zu geben.');
      ctx = removeItem(ctx, self.id, objectId);
      ctx = addItem(ctx, receiver.id, objectId);
      ctx = log(ctx, `${self.name} gibt ${titleOf(ctx.defs, objectId)} an ${receiver.name}.`);
      return emit(ctx, { kind: 'item', unitId: self.id, objectId, action: 'vergeben' });
    }
    case 'objekt-werfen': {
      if (!self?.pos) return ctx;
      const objectId = opts.objectId ?? matchingItems(ctx, self, b.selection)[0];
      const target = targets[0];
      const d = objectId ? ctx.defs.objects[objectId] : undefined;
      if (!objectId || !target || !d) return log(ctx, 'Nichts zu werfen.');
      ctx = removeItem(ctx, self.id, objectId);
      let at = target;
      if (!d.throw.ignoresObstacles) {
        const r = traceProjectile(ctx.battle.map, self.pos, target, (p) => !samePos(p, target) && isObstacle(ctx, p, [self.id]), () => false, 0);
        if (r.outcome === 'hindernis' && r.path.length > 1) at = r.path[r.path.length - 2];
      }
      ctx = log(ctx, `${self.name} wirft ${d.title}.`);
      if (d.throw.terrainId) ctx = { ...ctx, battle: { ...ctx.battle, terrain: { ...(ctx.battle.terrain ?? {}), [posKey(at)]: d.throw.terrainId } } };
      if (d.throw.impact === 'liegen') ctx = dropObject(ctx, objectId, at);
      if (d.throw.impact === 'verwandelt' && d.throw.into.id) {
        if (d.throw.into.kind === 'objekt') ctx = dropObject(ctx, d.throw.into.id, at);
        else ctx = spawnEnemy(ctx, d.throw.into.id, at);
      }
      return emit(ctx, { kind: 'item', unitId: self.id, objectId, action: 'geworfen', at });
    }
    case 'aufdecken': {
      const tiles = new Set(hit.tiles.map(posKey));
      const ids = [
        ...(b.objekte.on
          ? (ctx.battle.objects ?? [])
              .filter((o) => objectTiles(o).some((t) => tiles.has(posKey(t))) && (!b.objekte.typeIds.length || (ctx.defs.objects[o.objectId]?.typeIds ?? []).some((t) => b.objekte.typeIds.includes(t))))
              .map((o) => o.id)
          : []),
        ...(b.gegner.on
          ? ctx.battle.units
              .filter((u) => u.side === 'enemy' && unitTiles(u).some((t) => tiles.has(posKey(t))) && (!b.gegner.typeIds.length || (u.typeIds ?? []).some((t) => b.gegner.typeIds.includes(t))))
              .map((u) => u.id)
          : []),
        ...(b.showRange ? ['__bereiche__'] : []),
      ];
      if (!ids.length) return log(ctx, 'Nichts Verborgenes gefunden.');
      return log({ ...ctx, battle: { ...ctx.battle, revealed: [...new Set([...(ctx.battle.revealed ?? []), ...ids])] } }, `${ids.filter((i) => i !== '__bereiche__').length} Verborgenes aufgedeckt.`);
    }
    case 'blickrichtung': {
      const turn = (who: Unit, other: Unit | undefined, fixed: Facing) => {
        if (!who.pos) return who.facing;
        if (b.mode === 'richtung') return fixed;
        if (!other?.pos) return who.facing;
        const toward = facingTowards(who.pos, other.pos, facingOf(who));
        const opposite: Record<Facing, Facing> = { n: 's', s: 'n', o: 'w', w: 'o' };
        return b.mode === 'zu' ? toward : opposite[toward];
      };
      return setUnits(ctx, (x) => {
        if (b.who === 'ziel' && hit.units.some((h) => h.id === x.id)) return { ...x, facing: turn(x, caster, b.direction) };
        if (b.who === 'anwender' && x.id === caster.id) return { ...x, facing: turn(x, hit.units[0], b.direction) };
        return x;
      });
    }
  }
}

/** Neuen Gegner auf ein Feld setzen (z. B. durch Ersetzen/Werfen). */
export function spawnEnemy(ctx: Ctx, enemyId: string, pos: Pos): Ctx {
  const d = ctx.defs.enemies[enemyId];
  if (!d) return ctx;
  const id = uid('gegner');
  const unit: Unit = {
    id,
    side: 'enemy',
    status: 'aktiv',
    name: d.title,
    pos,
    facing: 's',
    templateId: enemyId,
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
  };
  // Neue Gegner handeln ab der nächsten Runde (am Ende der Reihenfolge).
  return log({ ...ctx, battle: { ...ctx.battle, units: [...ctx.battle.units, unit], order: [...ctx.battle.order, id] } }, `${d.title} erscheint.`);
}

/** Bausteine einer Fähigkeit (bzw. einer Objekt-Verwendung) mit Zielen ausführen. */
function runAbility(
  ctx: Ctx, caster: Unit, abilityId: string, a: AbilityFields & { title: string }, targets: Pos[], opts: ExecOptions, payCosts: boolean,
): Ctx {
  const chosen = a.targeting.kind === 'aoe' ? rangeTiles(ctx.battle, caster, a) : targets;
  if (payCosts) ctx = pay(ctx, caster.id, a, a.targeting.kind === 'aoe' ? [] : chosen);
  const hit = resolveHits(ctx, caster, a, chosen, opts.reaction);
  if (!hit) return log(ctx, `${a.title} wird von einem Hindernis aufgehalten.`);
  const source: Source = { unitId: caster.id, side: caster.side, typeIds: a.typeIds, kind: 'faehigkeit' };
  const outerCause = ctx.cause;
  ctx = { ...ctx, cause: caster.id };
  const protectedIds = new Set<string>();
  for (const u of hit.units) {
    if (u.id === caster.id) continue;
    const s = consumeShield(ctx, u.id, 'faehigkeit', source);
    ctx = s.ctx;
    if (s.blocked) {
      protectedIds.add(u.id);
      continue;
    }
    ctx = { ...ctx, battle: onTargeted(ctx.battle, u.id, caster.id, a.typeIds) };
    if (u.side !== caster.side) ctx = setUnits(ctx, (x) => (x.id === u.id ? { ...x, lastAttackerId: caster.id } : x));
    ctx = emit(ctx, { kind: 'targeted', targetId: u.id, sourceId: caster.id, abilityId, typeIds: a.typeIds });
  }
  for (const b of a.blocks) {
    const fresh = { ...hit, units: hit.units.filter((u) => !protectedIds.has(u.id)).map((u) => getUnit(ctx.battle, u.id)!).filter((u) => u && u.status !== 'entfernt') };
    ctx = applyBlock(ctx, getUnit(ctx.battle, caster.id) ?? caster, abilityId, a, b, fresh, chosen, opts);
  }
  ctx = emit(ctx, { kind: 'used', casterId: caster.id, abilityId, typeIds: a.typeIds, targetIds: hit.units.map((u) => u.id), reaction: !!opts.reaction });
  if (!hit.units.length && !hit.tiles.length && a.blocks.length) ctx = log(ctx, `${a.title} trifft nichts.`);
  return { ...ctx, cause: outerCause };
}

/**
 * Führt eine Fähigkeit aus: Kosten bezahlen, Ziele (inkl. Hindernissen und Radius) auflösen,
 * Schutz prüfen, Bausteine anwenden. Getroffene drehen sich ggf. zur Quelle.
 */
export function executeAbility(ctx: Ctx, casterId: string, abilityId: string, targets: Pos[], opts: ExecOptions = {}): Ctx {
  const a = ctx.defs.abilities[abilityId];
  const caster = getUnit(ctx.battle, casterId);
  if (!a || !caster) return ctx;
  ctx = log(ctx, `${caster.name} setzt ${a.title} ein.`);
  return runAbility(ctx, caster, abilityId, a, targets, opts, true);
}

export const abilityTitle = (ctx: Ctx, id: string) => titleOf(ctx.defs, id);
