// Gegner-KI (und Allys mit Verhaltens-Effekt): feste Regeln, kein Zufall – gleiche Lage, gleiches Handeln.
import type { AbilityFields } from './abilities';
import { actionState, currentUnit, getUnit, litArea, unitTiles, useAction, type Unit } from './battle';
import { DEFAULT_BEHAVIOR, rankTargets, type Behavior, type MovementMode, type RuleCondition, type RuleTarget, type TargetCriterion } from './behavior';
import { hasBlock } from './effects';
import { affordable, conditionsMet, executeAbility, findPath, legalOnTile, legalTargets, perceives, perception, rangeTiles } from './execute';
import { distance, posKey, samePos, type Pos } from './grid';
import { effectDefs, valueOf, type Ctx } from './status';
import { aiControlled } from './triggers';

interface Option {
  action: number;
  abilityId: string;
  def: AbilityFields;
}

/** Reine Bewegung auf ein Feld („Anwender bewegen“ auf ein Zielfeld); hin/weg zählen als normale Fähigkeit mit Ziel. */
const isMovement = (a: AbilityFields) => a.blocks.some((b) => b.kind === 'anwender-bewegen' && (b.mode ?? 'feld') === 'feld');

/** Nutzbare Fähigkeiten (Aktion noch frei bzw. auf diese Fähigkeit festgelegt, Bedingungen erfüllt, bezahlbar). */
function options(ctx: Ctx, u: Unit): Option[] {
  const out: Option[] = [];
  u.actions.forEach((a, i) => {
    if (actionState(ctx.battle, i) === 'verbraucht') return;
    const used = ctx.battle.turn?.used[i];
    for (const ab of a.abilities) {
      if (!ab.abilityId || (used && used.abilityId !== ab.abilityId)) continue;
      const def = ctx.defs.abilities[ab.abilityId];
      if (def && conditionsMet(ctx, u.id, def) && affordable(ctx, u.id, def)) out.push({ action: i, abilityId: ab.abilityId, def });
    }
  });
  return out;
}

const tilesOf = (u: Unit) => (u.pos ? unitTiles(u) : []);
const dist = (a: Pos, b: Pos) => distance(a, b, true);
const minDist = (u: Unit, p: Pos) => Math.min(...tilesOf(u).map((t) => dist(t, p)));

/** Mögliche Ziele (wahrgenommen, nicht entfernt) – Gegner sehen nur ihr Sichtfeld bzw. im Licht alles Beleuchtete. */
function candidates(ctx: Ctx, u: Unit, side: 'allys' | 'gegner' | 'alle') {
  const seen = perception(ctx, u);
  const wanted = (x: Unit) => (side === 'alle' ? true : side === 'allys' ? x.side === 'ally' : x.side === 'enemy');
  return ctx.battle.units.filter(
    (x) => x.id !== u.id && x.status !== 'entfernt' && x.pos && !x.carriedBy && wanted(x) && tilesOf(x).some((t) => seen.has(posKey(t))) && perceives(ctx, u, x),
  );
}

function rank(ctx: Ctx, u: Unit, list: Unit[], criteria: TargetCriterion[]): string[] {
  return rankTargets(
    list.map((x) => ({
      id: x.id,
      distance: Math.min(...tilesOf(x).map((t) => minDist(u, t))),
      values: Object.fromEntries(Object.keys(x.values ?? {}).map((k) => [k, valueOf(ctx.defs, x, k) ?? 0])),
      isLanternBearer: !!x.lantern,
      typeIds: x.typeIds ?? [],
      effectIds: (x.effects ?? []).map((e) => e.effectId),
    })),
    criteria,
    u.lastAttackerId,
  );
}

/** Weg in die Nähe eines Feldes (Nachbarfeld oder das Feld selbst). */
function reachableNear(ctx: Ctx, u: Unit, p: Pos): boolean {
  if (minDist(u, p) <= 1) return true;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (findPath(ctx, u, { x: p.x + dx, y: p.y + dy }, 60)) return true;
  return false;
}

/** Bestes Feld für eine Bewegungs-Fähigkeit je nach Ziel und Bewegungsart; null = keine Verbesserung. */
function moveTile(ctx: Ctx, u: Unit, opt: Option, goal: Pos | null, mode: MovementMode, keep: number): Pos | null {
  if (!goal || !u.pos || mode === 'stehen') return null;
  // Die KI kennt die Karte: Bewegungsziele müssen nicht im Sichtfeld liegen.
  const tiles = rangeTiles(ctx.battle, u, opt.def).filter((p) => legalOnTile(ctx, u, opt.def, p, true).tile).filter((t) => findPath(ctx, u, t, 40) || opt.def.blocks.some((b) => b.kind === 'anwender-bewegen' && b.ignoresObstacles));
  if (!tiles.length) return null;
  const score = (p: Pos) => {
    const d = dist(p, goal);
    if (mode === 'fliehen') return -d;
    if (mode === 'abstand') return Math.abs(d - keep);
    if (mode === 'kreis') {
      // Im Uhrzeigersinn um das Ziel herum: möglichst gleiche Entfernung, möglichst kleiner Winkel-Schritt.
      const angle = (q: Pos) => Math.atan2(q.y - goal.y, q.x - goal.x);
      const step = (angle(p) - angle(u.pos!) + 2 * Math.PI) % (2 * Math.PI);
      return Math.abs(d - dist(u.pos!, goal)) * 10 + (step === 0 ? 100 : step);
    }
    return d;
  };
  const current = score(u.pos);
  const best = [...tiles].sort((a, b) => score(a) - score(b) || dist(u.pos!, a) - dist(u.pos!, b))[0];
  return score(best) < current || mode === 'kreis' ? best : null;
}

/** Ziel ohne sichtbares Hauptziel: Patrouille, letzte bekannte Position, Licht. */
function idleGoal(ctx: Ctx, u: Unit, behavior: Behavior): Pos | null {
  if (!u.pos) return null;
  if (behavior.idle === 'patrouille' && u.patrol?.points.length) return u.patrol.points[u.patrol.index % u.patrol.points.length];
  if (behavior.idle === 'letzte-position') return Object.values(u.lastSeen ?? {})[0] ?? null;
  if (behavior.idle === 'licht') {
    const lit = [...litArea(ctx.battle)].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    });
    return lit.sort((a, b) => dist(u.pos!, a) - dist(u.pos!, b))[0] ?? null;
  }
  return null;
}

function setUnit(ctx: Ctx, id: string, patch: Partial<Unit>): Ctx {
  return { ...ctx, battle: { ...ctx.battle, units: ctx.battle.units.map((x) => (x.id === id ? { ...x, ...patch } : x)) } };
}

/** Patrouille: Wegpunkt erreicht → nächster (Rundweg bzw. hin & zurück). */
function advancePatrol(ctx: Ctx, u: Unit): Ctx {
  const p = u.patrol;
  if (!p?.points.length || !u.pos || !samePos(u.pos, p.points[p.index % p.points.length])) return ctx;
  let index = p.index;
  let forward = p.forward;
  if (p.mode === 'rundweg') index = (index + 1) % p.points.length;
  else {
    if (forward && index >= p.points.length - 1) forward = false;
    else if (!forward && index <= 0) forward = true;
    index += forward ? 1 : -1;
  }
  return setUnit(ctx, u.id, { patrol: { ...p, index, forward } });
}

function ruleTargets(ctx: Ctx, u: Unit, opt: Option, target: RuleTarget, main: Unit | undefined): Pos[] | null {
  if (opt.def.targeting.kind !== 'ziel') return [];
  const legal = legalTargets(ctx, u.id, opt.def);
  const pick = (x: Unit | undefined) => (x?.pos ? legal.filter((t) => tilesOf(x).some((p) => samePos(p, t))).slice(0, 1) : []);
  if (target.kind === 'selbst') return pick(u).length ? pick(u) : null;
  if (target.kind === 'hauptziel') return pick(main).length ? pick(main) : null;
  const friends = ctx.battle.units.filter((x) => x.side === u.side && x.id !== u.id && x.status !== 'entfernt' && x.pos);
  for (const id of rank(ctx, u, friends, target.criteria)) {
    const t = pick(getUnit(ctx.battle, id));
    if (t.length) return t;
  }
  return null;
}

/**
 * Ein Schritt der KI: wählt eine Fähigkeit und führt sie aus. Liefert null, wenn nichts mehr zu tun ist
 * (dann endet der Zug).
 */
export function aiStep(ctx: Ctx): Ctx | null {
  const d = decide(ctx);
  if (!d?.choice) return null;
  const { opt, targets } = d.choice;
  let next: Ctx = { ...d.ctx, battle: useAction(d.ctx.battle, opt.action, opt.abilityId) };
  next = executeAbility(next, d.selfId, opt.abilityId, targets);
  const moved = getUnit(next.battle, d.selfId);
  return moved ? advancePatrol(next, moved) : next;
}

interface Decision {
  ctx: Ctx;
  selfId: string;
  mainId?: string;
  choice?: { opt: Option; targets: Pos[] };
}

/** Absicht eines Gegners (für die Anzeige): Hauptziel und die Fähigkeit, die er als Nächstes einsetzen würde. */
export function aiIntent(ctx: Ctx, unitId: string): { targetId?: string; abilityId?: string } | null {
  const u = getUnit(ctx.battle, unitId);
  if (!u?.pos || u.status !== 'aktiv') return null;
  const own = ctx.battle.turn?.unitId === unitId;
  const battle = own ? ctx.battle : { ...ctx.battle, turn: { unitId, used: {} } };
  const d = decide({ ...ctx, battle } as Ctx);
  return d ? { targetId: d.mainId, abilityId: d.choice?.opt.abilityId } : null;
}

function decide(ctx: Ctx): Decision | null {
  const u = currentUnit(ctx.battle);
  if (!u?.pos || !aiControlled(ctx, u)) return null;
  const fx = u.effects ?? [];
  const override = hasBlock(fx, 'verhalten', effectDefs(ctx.defs)).at(-1);
  const tpl = u.side === 'enemy' && u.templateId ? ctx.defs.enemies[u.templateId] : undefined;
  const behavior = tpl?.behavior ?? DEFAULT_BEHAVIOR;

  // Wahrnehmung & Gedächtnis.
  const side = override?.targetSide ?? (u.side === 'enemy' ? 'allys' : 'gegner');
  const seenUnits = candidates(ctx, u, side);
  const lastSeen = { ...(u.lastSeen ?? {}) };
  for (const x of seenUnits) lastSeen[x.id] = x.pos!;
  for (const [id, p] of Object.entries(lastSeen)) if (samePos(p, u.pos) && !seenUnits.some((x) => x.id === id)) delete lastSeen[id];
  ctx = setUnit(ctx, u.id, { lastSeen });

  // Hauptziel.
  const criteria = override?.criteria ?? behavior.targetPriority;
  const keepCurrent = !override && behavior.retarget === 'bis-ungueltig' && seenUnits.some((x) => x.id === u.targetId && x.status !== 'bewusstlos');
  const targetId = keepCurrent ? u.targetId : rank(ctx, u, seenUnits, criteria).find((id) => reachableNear(ctx, u, getUnit(ctx.battle, id)!.pos!));
  ctx = setUnit(ctx, u.id, { targetId });
  // Steht er schon auf dem aktuellen Wegpunkt, geht es zum nächsten.
  ctx = advancePatrol(ctx, getUnit(ctx.battle, u.id)!);
  const self = getUnit(ctx.battle, u.id)!;
  const main = targetId ? getUnit(ctx.battle, targetId) : undefined;
  const opts = options(ctx, self);
  const mode: MovementMode = override?.movement ?? (behavior.keepDistance.on ? 'abstand' : 'zum-ziel');
  const keep = override?.distance ?? behavior.keepDistance.distance;
  const goal = main?.pos ?? idleGoal(ctx, self, behavior);

  const base: Decision = { ctx, selfId: self.id, mainId: main?.id };
  const run = (opt: Option, targets: Pos[]): Decision => ({ ...base, choice: { opt, targets } });

  // Mit Verhaltens-Effekt: nur bewegen (z. B. Flucht).
  if (override) {
    const mv = opts.find((o) => isMovement(o.def));
    const tile = mv ? moveTile(ctx, self, mv, goal, mode, keep) : null;
    return mv && tile ? run(mv, [tile]) : base;
  }

  // Regeln von oben nach unten.
  for (const rule of behavior.rules.filter((r) => r.zug)) {
    const opt = opts.find((o) => o.abilityId === rule.abilityId);
    if (!opt) continue;
    if (isMovement(opt.def)) {
      const tile = moveTile(ctx, self, opt, goal, mode, keep);
      if (!tile || !ruleConditions(ctx, self, rule.conditions, main, [tile], opt)) continue;
      return run(opt, [tile]);
    }
    const targets = ruleTargets(ctx, self, opt, rule.target, main);
    if (targets === null || !ruleConditions(ctx, self, rule.conditions, main, targets, opt)) continue;
    return run(opt, targets);
  }
  if (behavior.rules.length) return base;

  // Standardverhalten ohne Regeln: Hauptziel angreifen, sonst darauf zu bewegen.
  for (const opt of opts.filter((o) => !isMovement(o.def))) {
    const targets = ruleTargets(ctx, self, opt, { kind: 'hauptziel' }, main);
    if (targets?.length || (targets && opt.def.targeting.kind !== 'ziel' && main)) return run(opt, targets);
  }
  const mv = opts.find((o) => isMovement(o.def));
  const tile = mv ? moveTile(ctx, self, mv, goal, mode, keep) : null;
  return mv && tile ? run(mv, [tile]) : base;
}

function ruleConditions(ctx: Ctx, u: Unit, conds: RuleCondition[], main: Unit | undefined, targets: Pos[], opt: Option): boolean {
  return conds.every((c) => {
    if (c.kind === 'ziel-in-reichweite') return targets.length > 0 || opt.def.targeting.kind !== 'ziel';
    if (c.kind === 'hat-effekt') {
      const who = c.who === 'selbst' ? u : main;
      return !!who && (who.effects ?? []).some((e) => e.effectId === c.effectId);
    }
    return conditionsMet(ctx, u.id, { ...opt.def, conditions: [c] });
  });
}
