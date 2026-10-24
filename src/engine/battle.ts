// Ablauf eines Level-Kampfes: Platzierung → Runden mit Zügen nach Initiative → Sieg/Niederlage.
// Der Zustand ist reines JSON (für Spielstände); alle Funktionen liefern einen neuen Zustand.
import { inBounds, posKey, samePos, type Grid, type Pos } from './grid';
import { initiativeOrder } from './initiative';
import { visibleTiles, type LightSource } from './light';
import type { Rules } from './rules';

export type Side = 'ally' | 'enemy';
export type UnitStatus = 'aktiv' | 'bewusstlos' | 'tot';
export type Phase = 'platzierung' | 'kampf' | 'sieg' | 'niederlage';

export interface Unit {
  id: string;
  side: Side;
  name: string;
  pos: Pos | null;
  status: UnitStatus;
  /** Laternenträger: steht fest auf dem Laternen-Startfeld. */
  lantern?: { radius?: number };
  /** Abweichende Anzahl Züge pro Runde. */
  turnsPerRound?: number;
  /** Aktionsplätze eines Zuges; jeder Platz bietet eine Auswahl an Fähigkeiten (IDs). */
  actionSlots: string[][];
  /** Werte für Initiative u. Ä. (ab Abschnitt 3 aus Ressourcen). */
  values?: Record<string, number>;
}

export interface BattleMap {
  width: number;
  height: number;
  /** Nicht begehbare Felder (posKey). */
  blocked: string[];
  /** Sichtblockierende Felder (posKey). */
  opaque: string[];
  victory: Pos[];
  lanternStart: Pos;
}

export interface Turn {
  unitId: string;
  usedSlots: number[];
}

export interface BattleState {
  rules: Rules;
  map: BattleMap;
  units: Unit[];
  phase: Phase;
  round: number;
  order: string[];
  /** Noch ausstehende Züge dieser Runde; der aktuelle steht vorne. */
  queue: string[];
  turn: Turn | null;
  explored: string[];
}

/** Platzierung relativ zum Laternenträger, um sie ins nächste Level zu übernehmen. */
export type Placement = Record<string, { dx: number; dy: number }>;

export class RuleError extends Error {}

// ---------- Hilfsfunktionen ----------

export function gridOf(map: BattleMap): Grid {
  const blocked = new Set(map.blocked);
  const opaque = new Set(map.opaque);
  return {
    width: map.width,
    height: map.height,
    isPassable: (p) => inBounds(map, p) && !blocked.has(posKey(p)),
    blocksSight: (p) => opaque.has(posKey(p)),
  };
}

export const getUnit = (s: BattleState, id: string) => s.units.find((u) => u.id === id);
export const lanternBearer = (s: BattleState) => s.units.find((u) => u.side === 'ally' && u.lantern);
export const unitAt = (s: BattleState, p: Pos) =>
  s.units.find((u) => u.pos && samePos(u.pos, p) && u.status !== 'tot');

function lightSources(s: BattleState): LightSource[] {
  return s.units
    .filter((u) => u.lantern && u.pos && u.status === 'aktiv')
    .map((u) => ({ pos: u.pos!, radius: u.lantern!.radius ?? s.rules.light.lanternRadius }));
}

/** Aktuell sichtbare Felder. */
export function visible(s: BattleState): Set<string> {
  const viewers = s.units.filter((u) => u.side === 'ally' && u.status === 'aktiv' && u.pos).map((u) => u.pos!);
  return visibleTiles(gridOf(s.map), lightSources(s), viewers, s.rules.light);
}

function withExplored(s: BattleState): BattleState {
  if (!s.rules.light.rememberExplored) return s;
  const all = new Set(s.explored);
  for (const k of visible(s)) all.add(k);
  return all.size === s.explored.length ? s : { ...s, explored: [...all] };
}

function updateUnit(s: BattleState, id: string, patch: Partial<Unit>): BattleState {
  return { ...s, units: s.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) };
}

// ---------- Platzierung ----------

/** Felder, auf denen Allys platziert werden dürfen: beleuchtet und begehbar. */
export function placementArea(s: BattleState): Pos[] {
  const g = gridOf(s.map);
  const lit = visible({ ...s, units: s.units.filter((u) => u.lantern) });
  return [...lit]
    .map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    })
    .filter((p) => g.isPassable(p));
}

export function createBattle(opts: {
  rules: Rules;
  map: BattleMap;
  allies: Omit<Unit, 'side' | 'status'>[];
  enemies: Omit<Unit, 'side' | 'status'>[];
  previous?: Placement;
}): BattleState {
  const units: Unit[] = [
    ...opts.allies.map((u) => ({ ...u, side: 'ally' as const, status: 'aktiv' as const, pos: null })),
    ...opts.enemies.map((u) => ({ ...u, side: 'enemy' as const, status: 'aktiv' as const })),
  ];
  const bearer = units.find((u) => u.side === 'ally' && u.lantern);
  if (!bearer) throw new RuleError('Im Team fehlt ein Charakter mit Laterne.');
  bearer.pos = { ...opts.map.lanternStart };

  let s: BattleState = {
    rules: opts.rules, map: opts.map, units, phase: 'platzierung', round: 0, order: [], queue: [], turn: null, explored: [],
  };

  // Übrige Allys: möglichst wie im vorherigen Level, sonst auf das nächste freie beleuchtete Feld.
  const area = placementArea(s);
  const start = opts.map.lanternStart;
  for (const ally of s.units.filter((u) => u.side === 'ally' && !u.pos)) {
    const free = (p: Pos) => area.some((a) => samePos(a, p)) && !unitAt(s, p);
    const prev = opts.previous?.[ally.id];
    let target: Pos | undefined = prev && { x: start.x + prev.dx, y: start.y + prev.dy };
    if (!target || !free(target)) {
      target = area
        .filter(free)
        .sort((a, b) => Math.hypot(a.x - start.x, a.y - start.y) - Math.hypot(b.x - start.x, b.y - start.y))[0];
    }
    if (target) s = updateUnit(s, ally.id, { pos: target });
  }
  return withExplored(s);
}

/** Verschiebt einen Ally während der Platzierung; steht dort schon ein Ally, tauschen beide. */
export function placeUnit(s: BattleState, id: string, pos: Pos): BattleState {
  if (s.phase !== 'platzierung') throw new RuleError('Platzieren ist nur vor dem Kampf möglich.');
  const unit = getUnit(s, id);
  if (!unit || unit.side !== 'ally') throw new RuleError('Nur Allys können platziert werden.');
  if (unit.lantern) throw new RuleError('Der Laternenträger steht fest.');
  if (!placementArea(s).some((p) => samePos(p, pos))) throw new RuleError('Nur im Lichtkegel platzierbar.');
  const other = unitAt(s, pos);
  if (other && other.id !== id) {
    if (other.side !== 'ally' || other.lantern) throw new RuleError('Das Feld ist belegt.');
    s = updateUnit(s, other.id, { pos: unit.pos });
  }
  return updateUnit(s, id, { pos });
}

export function placementSnapshot(s: BattleState): Placement {
  const bearer = lanternBearer(s);
  const result: Placement = {};
  if (!bearer?.pos) return result;
  for (const u of s.units) {
    if (u.side === 'ally' && u.pos && !u.lantern) result[u.id] = { dx: u.pos.x - bearer.pos.x, dy: u.pos.y - bearer.pos.y };
  }
  return result;
}

// ---------- Runden & Züge ----------

function roundQueue(s: BattleState): string[] {
  const active = s.order.filter((id) => getUnit(s, id)?.status === 'aktiv');
  const turns = (id: string) => getUnit(s, id)?.turnsPerRound ?? s.rules.turnsPerRound;
  const max = Math.max(0, ...active.map(turns));
  const queue: string[] = [];
  for (let pass = 0; pass < max; pass++) queue.push(...active.filter((id) => turns(id) > pass));
  return queue;
}

function beginTurn(s: BattleState): BattleState {
  let queue = s.queue.filter((id) => getUnit(s, id)?.status === 'aktiv');
  let round = s.round;
  if (queue.length === 0) {
    round++;
    queue = roundQueue(s);
  }
  return { ...s, round, queue, turn: queue.length ? { unitId: queue[0], usedSlots: [] } : null };
}

/** Bestätigt die Platzierung, legt die Initiative fest und startet Runde 1. */
export function startBattle(s: BattleState): BattleState {
  if (s.phase !== 'platzierung') throw new RuleError('Der Kampf läuft bereits.');
  if (s.units.some((u) => u.side === 'ally' && !u.pos)) throw new RuleError('Es sind noch nicht alle Allys platziert.');
  const placed = s.units.filter((u) => u.pos);
  const order = initiativeOrder(placed, s.rules.initiative, (u, res) => u.values?.[res] ?? 0);
  return checkOutcome(beginTurn({ ...s, phase: 'kampf', order, round: 0, queue: [] }));
}

export const currentUnit = (s: BattleState) => (s.turn ? getUnit(s, s.turn.unitId) : undefined);

/** Nutzt einen Aktionsplatz des aktuellen Zuges mit einer der dort erlaubten Fähigkeiten. */
export function useActionSlot(s: BattleState, slot: number, abilityId: string): BattleState {
  const unit = currentUnit(s);
  if (s.phase !== 'kampf' || !unit || !s.turn) throw new RuleError('Gerade ist niemand am Zug.');
  if (s.turn.usedSlots.includes(slot)) throw new RuleError('Diese Aktion wurde in diesem Zug schon genutzt.');
  if (!unit.actionSlots[slot]?.includes(abilityId)) throw new RuleError('Diese Fähigkeit ist hier nicht erlaubt.');
  return { ...s, turn: { ...s.turn, usedSlots: [...s.turn.usedSlots, slot] } };
}

export function endTurn(s: BattleState): BattleState {
  if (s.phase !== 'kampf') return s;
  return checkOutcome(beginTurn({ ...s, queue: s.queue.slice(1) }));
}

/** Zusätzlicher Zug (z. B. Reaktion) direkt nach dem aktuellen. */
export function grantExtraTurn(s: BattleState, id: string): BattleState {
  return { ...s, queue: [s.queue[0], id, ...s.queue.slice(1)].filter(Boolean) };
}

/** Setzt eine Figur auf ein Feld (Grundlage für Bewegungs-Fähigkeiten). */
export function moveUnit(s: BattleState, id: string, pos: Pos): BattleState {
  const g = gridOf(s.map);
  if (!g.isPassable(pos)) throw new RuleError('Das Feld ist nicht begehbar.');
  const other = unitAt(s, pos);
  if (other && other.id !== id) throw new RuleError('Das Feld ist belegt.');
  return checkOutcome(withExplored(updateUnit(s, id, { pos })));
}

// ---------- K.O., Sieg & Niederlage ----------

export function knockOut(s: BattleState, id: string): BattleState {
  const unit = getUnit(s, id);
  if (!unit || unit.status !== 'aktiv') return s;
  const mode = unit.side === 'ally' ? s.rules.ko.allies : s.rules.ko.enemies;
  s = updateUnit(s, id, { status: mode });
  if (s.turn?.unitId === id) s = beginTurn({ ...s, queue: s.queue.slice(1) });
  return checkOutcome(s);
}

export function revive(s: BattleState, id: string): BattleState {
  const unit = getUnit(s, id);
  if (!unit || unit.status !== 'bewusstlos') return s;
  return checkOutcome(updateUnit(s, id, { status: 'aktiv' }));
}

export function checkOutcome(s: BattleState): BattleState {
  if (s.phase !== 'kampf') return s;
  const allies = s.units.filter((u) => u.side === 'ally');
  const active = allies.filter((u) => u.status === 'aktiv');
  const bearer = lanternBearer(s);
  if (active.length === 0 || (s.rules.ko.defeatOnLanternLoss && bearer && bearer.status !== 'aktiv')) {
    return { ...s, phase: 'niederlage', turn: null };
  }
  const mustReach = allies.filter(
    (u) => u.status === 'aktiv' || (u.status === 'bewusstlos' && !s.rules.ko.unconsciousExcludedFromVictory),
  );
  const onVictory = (u: Unit) => !!u.pos && s.map.victory.some((v) => samePos(v, u.pos!));
  if (mustReach.every(onVictory)) return { ...s, phase: 'sieg', turn: null };
  return s;
}
