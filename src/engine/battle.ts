// Ablauf eines Level-Kampfes: Platzierung → Runden mit Zügen nach Initiative → Sieg/Niederlage.
// Der Zustand ist reines JSON (für Spielstände); alle Funktionen liefern einen neuen Zustand.
import { areaTiles, facingFromStep, facingTowards, type Area, type Facing } from './facing';
import { inBounds, posKey, samePos, type Grid, type Pos } from './grid';
import type { CharacterAction } from './characters';
import { initiativeOrder } from './initiative';
import { INITIATIVE_ID } from './resources';
import { litTiles, visibleTiles, type LightSource } from './light';
import type { ActiveEffect } from './effects';
import type { Rules } from './rules';

export type Side = 'ally' | 'enemy';
/** bewusstlos = hat den festen Effekt „Bewusstlos“; entfernt = z. B. geflohener Gegner. Niemand stirbt. */
export type UnitStatus = 'aktiv' | 'bewusstlos' | 'entfernt';
export type Phase = 'platzierung' | 'kampf' | 'sieg' | 'niederlage';

export interface Unit {
  id: string;
  side: Side;
  name: string;
  pos: Pos | null;
  status: UnitStatus;
  /** Laternenträger: steht fest auf dem Laternen-Startfeld; die Laterne brennt auch, wenn er bewusstlos ist. */
  lantern?: { radius?: number };
  /** Blickrichtung (Standard: oben). */
  facing?: Facing;
  /** Eigensicht im Nebel als Bereich relativ zur Blickrichtung (leer = nichts). */
  sightArea?: Area;
  /** Eigene Züge am Stück mit dem Effekt „Bewusstlos“. */
  unconsciousTurns?: number;
  /** Setzt Züge aus (z. B. durch den Effekt-Baustein „Möglichkeit verlieren: Zug“). */
  skipsTurns?: boolean;
  /** Hauptziel (Gegner bzw. unkontrollierbare Allys, Abschnitt 7). */
  targetId?: string;
  /** Abweichende Anzahl Züge pro Runde. */
  turnsPerRound?: number;
  /** Aktionen eines Zuges; jede bietet eine Auswahl an Fähigkeiten. */
  actions: CharacterAction[];
  /** Größe in Feldern (2 = 2×2); pos ist das Feld oben links. */
  /** Breite in Feldern (Standard 1). */
  size?: number;
  /** Höhe in Feldern (ohne Angabe = Breite). */
  height?: number;
  /** Ist ein Hindernis und belegt seine Felder (Standard: ja). */
  collision?: boolean;
  /** Aktuelle Werte der individuellen Ressourcen (ID → Menge, ohne dauerhafte Effekt-Veränderungen). */
  values?: Record<string, number>;
  /** Maximum je Ressource (null = keins). */
  maxValues?: Record<string, number | null>;
  /** Vorlage (Ally bzw. Gegner) im Spielmodus. */
  templateId?: string;
  typeIds?: string[];
  effects?: ActiveEffect[];
  items?: { objectId: string; count: number }[];
  /** Werte ohne Effekte (für das Zurücksetzen, wenn Effekte enden). */
  base?: { sightArea: Area; collision: boolean };
  /** Wer ihn zuletzt angegriffen hat (für die Gegner-KI). */
  lastAttackerId?: string;
  /** Einmaliger Schutz (Fähigkeits-Baustein). */
  shields?: Shield[];
  /** Wird getragen von … (bewegt sich mit, belegt kein eigenes Feld). */
  carriedBy?: string;
  /** Getragene Objekte. */
  carried?: { objectId: string; count: number }[];
  /** Verwandelt (Effekt „Ziel verwandeln“): sieht aus wie / handelt wie diese Vorlage. */
  transform?: { kind: 'ally' | 'gegner' | 'objekt'; id: string };
  /** Genutzte Reaktionen (Index → Runde/Level der Zählung und Anzahl). */
  reactionUses?: Record<number, { round: number; count: number }>;
  /** Gegner: zuletzt gesehene Positionen der Allys. */
  lastSeen?: Record<string, Pos>;
  /** Gegner: Patrouille aus dem Level-Editor. */
  patrol?: { points: Pos[]; mode: 'rundweg' | 'hin-zurueck'; index: number; forward: boolean };
}

export interface Shield {
  id: string;
  against: 'faehigkeit' | 'effekt' | 'ressource';
  from: 'alle' | 'gegner' | 'allys' | 'typen';
  typeIds: string[];
  /** Verbleibende Runden (null = bis verbraucht). */
  roundsLeft: number | null;
}

/** Objekt auf der Map während des Spiels. */
export interface MapObject {
  id: string;
  objectId: string;
  /** Linkes oberes Feld. */
  pos: Pos;
  hidden: boolean;
  /** Breite und Höhe in Feldern (Standard 1). */
  w?: number;
  h?: number;
}

export interface BattleMap {
  width: number;
  height: number;
  /** Nicht begehbare Felder (posKey). */
  blocked: string[];
  /** Sichtblockierende (schattenwerfende) Felder (posKey). */
  opaque: string[];
  victory: Pos[];
  lanternStart: Pos;
  /** Felder, die es nicht gibt („kein Feld“). */
  voids?: string[];
  /** Weitere Lichtquellen (Gelände, Objekte) mit Leuchtbereich (Blick nach oben). */
  lights?: { pos: Pos; area: Area }[];
}

export interface Turn {
  unitId: string;
  /** Je Aktion (Index): gewählte Fähigkeit und bisherige Nutzungen. */
  used: Record<number, { abilityId: string; uses: number }>;
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
  /** Grund für Sieg/Niederlage. */
  outcome?: string;
  /** Spielmodus: Geländearten je Feld und Objekte. */
  terrain?: Record<string, string>;
  objects?: MapObject[];
  /** Aufgedeckte (verborgene) Objekte/Gegner. */
  revealed?: string[];
  /** Bereichs-Auslöser: wer sich zuletzt in welchem Bereich befand (Schlüssel → IDs). */
  areaMemory?: Record<string, string[]>;
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
/** Breite × Höhe einer Vorlage bzw. Figur (Höhe ohne Angabe = Breite). */
export const dimsOf = (x?: { size?: number; height?: number }) => {
  const w = x?.size ?? 1;
  return { w, h: x?.height ?? w };
};

/** Alle Felder eines Rechtecks ab dem linken oberen Feld. */
export function rectTiles(pos: Pos, w: number, h: number): Pos[] {
  const tiles: Pos[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) tiles.push({ x: pos.x + dx, y: pos.y + dy });
  return tiles;
}

/** Alle Felder, die eine Figur belegt. */
export function unitTiles(u: Unit, pos: Pos | null = u.pos): Pos[] {
  if (!pos) return [];
  const { w, h } = dimsOf(u);
  return rectTiles(pos, w, h);
}

/** Alle Felder, die ein Objekt auf der Map belegt. */
export const objectTiles = (o: MapObject) => rectTiles(o.pos, o.w ?? 1, o.h ?? 1);

/** Ein Objekt für die Map (Abmessungen aus der Vorlage). */
export const mapObject = (look: { size?: number; height?: number } | undefined, o: Omit<MapObject, 'w' | 'h'>): MapObject => {
  const { w, h } = dimsOf(look);
  return w === 1 && h === 1 ? o : { ...o, w, h };
};

const occupies = (u: Unit, p: Pos) => u.status !== 'entfernt' && !u.carriedBy && unitTiles(u).some((t) => samePos(t, p));

/** Figur auf einem Feld (bevorzugt eine mit Kollision). */
export const unitAt = (s: BattleState, p: Pos) =>
  s.units.find((u) => occupies(u, p) && u.collision !== false) ?? s.units.find((u) => occupies(u, p));

function lightSources(s: BattleState): LightSource[] {
  return s.units
    .filter((u) => u.lantern && u.pos && u.status !== 'entfernt')
    .map((u) => ({ pos: u.pos!, radius: u.lantern!.radius ?? s.rules.light.lanternRadius }));
}

export const facingOf = (u: Unit): Facing => u.facing ?? 'n';

/** Beleuchtete Felder: Laterne(n) sowie leuchtende Objekte und Gelände (ohne das, was Allys nur sehen). */
export function litArea(s: BattleState): Set<string> {
  const lights = (s.map.lights ?? []).map((l) => ({ pos: l.pos, tiles: areaTiles(l.pos, l.area, 'n') }));
  return visibleTiles(gridOf(s.map), lightSources(s), lights, s.rules.light.shape);
}

/** Aktuell sichtbare Felder: Licht + was wache Allys sehen (alle Allys teilen ihre Sicht). */
export function visible(s: BattleState): Set<string> {
  const viewers = s.units
    .filter((u) => u.side === 'ally' && u.status === 'aktiv' && u.pos)
    .flatMap((u) => unitTiles(u).map((t) => ({ pos: t, tiles: areaTiles(t, u.sightArea ?? [], facingOf(u)) })));
  // Leuchtende Objekte/Gelände wirken wie ein Blick mit ihrem Leuchtbereich.
  const lights = (s.map.lights ?? []).map((l) => ({ pos: l.pos, tiles: areaTiles(l.pos, l.area, 'n') }));
  return visibleTiles(gridOf(s.map), lightSources(s), [...viewers, ...lights], s.rules.light.shape);
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
  const lit = litTiles(g, lightSources(s), s.rules.light.shape);
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
    const free = (p: Pos) => canStand(s, ally, p, area);
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

/** Kann eine Figur (mit allen ihren Feldern) hier stehen? Optional nur innerhalb eines Bereichs. */
function canStand(s: BattleState, unit: Unit, pos: Pos, within?: Pos[], ignore: string[] = []): boolean {
  const g = gridOf(s.map);
  return unitTiles(unit, pos).every(
    (t) =>
      g.isPassable(t) &&
      (!within || within.some((a) => samePos(a, t))) &&
      !s.units.some((u) => u.id !== unit.id && !ignore.includes(u.id) && u.collision !== false && unit.collision !== false && occupies(u, t)),
  );
}

/** Verschiebt einen Ally während der Platzierung; steht dort schon ein (gleich großer) Ally, tauschen beide. */
export function placeUnit(s: BattleState, id: string, pos: Pos): BattleState {
  if (s.phase !== 'platzierung') throw new RuleError('Platzieren ist nur vor dem Kampf möglich.');
  const unit = getUnit(s, id);
  if (!unit || unit.side !== 'ally') throw new RuleError('Nur Allys können platziert werden.');
  if (unit.lantern) throw new RuleError('Der Laternenträger steht fest.');
  const area = placementArea(s);
  if (!unitTiles(unit, pos).every((t) => area.some((a) => samePos(a, t)))) throw new RuleError('Nur im Lichtkegel platzierbar.');
  const other = unitAt(s, pos);
  if (other && other.id !== id && unit.collision !== false && other.collision !== false && other.pos && samePos(other.pos, pos)) {
    const a = dimsOf(other);
    const b = dimsOf(unit);
    if (other.side !== 'ally' || other.lantern || a.w !== b.w || a.h !== b.h) throw new RuleError('Das Feld ist belegt.');
    if (!unit.pos) throw new RuleError('Das Feld ist belegt.');
    s = updateUnit(s, other.id, { pos: unit.pos });
    return updateUnit(s, id, { pos });
  }
  if (!canStand(s, unit, pos, area)) throw new RuleError('Das Feld ist belegt.');
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
  // Bewusstlose bleiben in der Reihenfolge, damit ihre verpassten Züge gezählt werden.
  const present = s.order.filter((id) => getUnit(s, id)?.status !== 'entfernt');
  const turns = (id: string) => getUnit(s, id)?.turnsPerRound ?? s.rules.turnsPerRound;
  const max = Math.max(0, ...present.map(turns));
  const queue: string[] = [];
  for (let pass = 0; pass < max; pass++) queue.push(...present.filter((id) => turns(id) > pass));
  return queue;
}

/**
 * Nächster Zug. Züge mit „Bewusstlos“ werden gezählt (Run verloren nach X am Stück);
 * wer Züge aussetzt, wird übersprungen.
 */
function beginTurn(s: BattleState): BattleState {
  let queue = s.queue.filter((id) => getUnit(s, id)?.status !== 'entfernt');
  let round = s.round;
  for (let guard = 0; guard < 1000; guard++) {
    if (queue.length === 0) {
      round++;
      queue = roundQueue(s);
      if (queue.length === 0) break;
    }
    const unit = getUnit(s, queue[0])!;
    if (unit.status === 'bewusstlos') {
      const count = (unit.unconsciousTurns ?? 0) + 1;
      s = updateUnit(s, unit.id, { unconsciousTurns: count });
      const limit = s.rules.defeat.unconsciousTurns;
      if (unit.side === 'ally' && limit > 0 && count >= limit) {
        return { ...s, round, queue, phase: 'niederlage', turn: null, outcome: `${unit.name} war ${count} Züge bewusstlos.` };
      }
    }
    if (!unit.skipsTurns) break;
    queue = queue.slice(1);
  }
  return { ...s, round, queue, turn: queue.length ? { unitId: queue[0], used: {} } : null };
}

/** Bestätigt die Platzierung, legt die Initiative fest und startet Runde 1. */
export function startBattle(s: BattleState): BattleState {
  if (s.phase !== 'platzierung') throw new RuleError('Der Kampf läuft bereits.');
  if (s.units.some((u) => u.side === 'ally' && !u.pos)) throw new RuleError('Es sind noch nicht alle Allys platziert.');
  const placed = s.units.filter((u) => u.pos);
  const order = initiativeOrder(placed, s.rules.initiative, (u) => u.values?.[INITIATIVE_ID] ?? 0);
  return checkOutcome(beginTurn({ ...s, phase: 'kampf', order, round: 0, queue: [] }));
}

export const currentUnit = (s: BattleState) => (s.turn ? getUnit(s, s.turn.unitId) : undefined);

export type ActionState = 'offen' | 'weiter' | 'verbraucht';

/**
 * Zustand einer Aktion im aktuellen Zug: offen (noch nichts gewählt), weiter (gewählte Fähigkeit hat
 * noch Nutzungen) oder verbraucht. Ob die Kosten bezahlbar sind, prüft die Oberfläche zusätzlich.
 */
export function actionState(s: BattleState, action: number): ActionState {
  const unit = currentUnit(s);
  const used = s.turn?.used[action];
  if (!unit || !used) return 'offen';
  const max = unit.actions[action]?.abilities.find((a) => a.abilityId === used.abilityId)?.maxUses ?? 1;
  return used.uses < max ? 'weiter' : 'verbraucht';
}

/** Nutzt eine Fähigkeit einer Aktion. Pro Zug ist jede Aktion auf eine Fähigkeit festgelegt. */
export function useAction(s: BattleState, action: number, abilityId: string): BattleState {
  const unit = currentUnit(s);
  if (s.phase !== 'kampf' || !unit || !s.turn) throw new RuleError('Gerade ist niemand am Zug.');
  const entry = unit.actions[action]?.abilities.find((a) => a.abilityId === abilityId);
  if (!entry) throw new RuleError('Diese Fähigkeit gehört nicht zu dieser Aktion.');
  const used = s.turn.used[action];
  if (used && used.abilityId !== abilityId) throw new RuleError('In dieser Aktion wurde schon eine andere Fähigkeit gewählt.');
  if (used && used.uses >= entry.maxUses) throw new RuleError('Diese Aktion ist verbraucht.');
  const next = { abilityId, uses: (used?.uses ?? 0) + 1 };
  return { ...s, turn: { ...s.turn, used: { ...s.turn.used, [action]: next } } };
}

export function endTurn(s: BattleState): BattleState {
  if (s.phase !== 'kampf') return s;
  // Gegner (und unkontrollierbare Allys) wenden sich am Zugende ihrem Ziel zu.
  const unit = currentUnit(s);
  const target = unit?.targetId ? getUnit(s, unit.targetId) : undefined;
  if (unit?.pos && target?.pos) s = updateUnit(s, unit.id, { facing: facingTowards(unit.pos, target.pos, facingOf(unit)) });
  return checkOutcome(beginTurn({ ...s, queue: s.queue.slice(1) }));
}

/** Blickrichtung ändern: im eigenen Zug beliebig oft, Allys außerdem während der Platzierung. */
export function turnUnit(s: BattleState, id: string, facing: Facing): BattleState {
  const unit = getUnit(s, id);
  const allowed =
    (s.phase === 'platzierung' && unit?.side === 'ally') || (s.phase === 'kampf' && s.turn?.unitId === id);
  if (!unit || !allowed) throw new RuleError('Die Blickrichtung kann nur im eigenen Zug geändert werden.');
  return withExplored(updateUnit(s, id, { facing }));
}

/**
 * Ein Charakter wird Ziel einer Fähigkeit/eines Effekts. Außerhalb seines Zuges dreht er sich
 * je nach Regelwerk zur Quelle.
 */
export function onTargeted(s: BattleState, targetId: string, sourceId: string, typeIds: string[] = []): BattleState {
  const target = getUnit(s, targetId);
  const source = getUnit(s, sourceId);
  if (!target?.pos || !source?.pos || s.turn?.unitId === targetId || targetId === sourceId) return s;
  const rule = s.rules.facing;
  const hostile = target.side !== source.side;
  const turns =
    rule.turnWhenTargeted === 'alle' ||
    (rule.turnWhenTargeted === 'gegnerisch' && hostile) ||
    (rule.turnWhenTargeted === 'typen' && typeIds.some((t) => rule.typeIds.includes(t)));
  if (!turns) return s;
  return withExplored(updateUnit(s, targetId, { facing: facingTowards(target.pos, source.pos, facingOf(target)) }));
}

/** Zusätzlicher Zug (z. B. Reaktion) direkt nach dem aktuellen. */
export function grantExtraTurn(s: BattleState, id: string): BattleState {
  return { ...s, queue: [s.queue[0], id, ...s.queue.slice(1)].filter(Boolean) };
}

/** Setzt eine Figur auf ein Feld (Grundlage für Bewegungs-Fähigkeiten). */
export function moveUnit(s: BattleState, id: string, pos: Pos): BattleState {
  const unit = getUnit(s, id);
  if (!unit) return s;
  const g = gridOf(s.map);
  if (!unitTiles(unit, pos).every((t) => g.isPassable(t))) throw new RuleError('Das Feld ist nicht begehbar.');
  if (!canStand(s, unit, pos)) throw new RuleError('Das Feld ist belegt.');
  const facing = unit.pos ? facingFromStep(unit.pos, pos, facingOf(unit)) : unit.facing;
  return checkOutcome(withExplored(updateUnit(s, id, { pos, facing })));
}

// ---------- Bewusstlosigkeit, Sieg & Niederlage ----------

/** Effekt „Bewusstlos“ erhalten oder verlieren. Ob der Charakter Züge aussetzt, regeln die Bausteine des Effekts. */
export function setUnconscious(s: BattleState, id: string, unconscious: boolean): BattleState {
  const unit = getUnit(s, id);
  if (!unit || unit.status === 'entfernt') return s;
  if (unconscious === (unit.status === 'bewusstlos')) return s;
  return checkOutcome(withExplored(updateUnit(s, id, { status: unconscious ? 'bewusstlos' : 'aktiv', unconsciousTurns: 0 })));
}

/** Züge aussetzen an/aus; wer gerade am Zug ist und aussetzen muss, beendet seinen Zug. */
export function setSkipsTurns(s: BattleState, id: string, skips: boolean): BattleState {
  s = updateUnit(s, id, { skipsTurns: skips });
  if (skips && s.turn?.unitId === id && s.phase === 'kampf') s = checkOutcome(beginTurn({ ...s, queue: s.queue.slice(1) }));
  return s;
}

/** Nimmt eine Figur aus dem Kampf (z. B. geflohener Gegner). */
export function removeUnit(s: BattleState, id: string): BattleState {
  const unit = getUnit(s, id);
  if (!unit || unit.status === 'entfernt') return s;
  s = updateUnit(s, id, { status: 'entfernt', pos: null });
  if (s.turn?.unitId === id) s = beginTurn({ ...s, queue: s.queue.slice(1) });
  return checkOutcome(s);
}

export function checkOutcome(s: BattleState): BattleState {
  if (s.phase !== 'kampf') return s;
  const allies = s.units.filter((u) => u.side === 'ally' && u.status !== 'entfernt');
  const unconscious = allies.filter((u) => u.status === 'bewusstlos').length;
  const limit = s.rules.defeat.unconsciousCount === 'alle' ? allies.length : s.rules.defeat.unconsciousCount;
  if (unconscious > 0 && (unconscious >= limit || unconscious === allies.length)) {
    return { ...s, phase: 'niederlage', turn: null, outcome: `${unconscious} Allys sind bewusstlos.` };
  }
  // Siegfelder sind bis dahin gewöhnliche Felder; keiner wird zurückgelassen.
  const onVictory = (u: Unit) => unitTiles(u).some((t) => s.map.victory.some((v) => samePos(v, t)));
  if (allies.length > 0 && allies.every(onVictory)) {
    return { ...s, phase: 'sieg', turn: null, outcome: 'Alle Allys haben ein Siegfeld erreicht.' };
  }
  return s;
}
