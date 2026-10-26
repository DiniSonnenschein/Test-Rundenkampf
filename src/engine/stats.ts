// Statistik: Was Allys und Gegner im Kampf bewirkt haben – aus den Ereignissen gezählt.
import { getUnit, type BattleState } from './battle';
import { UNCONSCIOUS_ID } from './effects';
import type { GameEvent } from './events';

type Count = Record<string, number>;

export interface UnitStats {
  name: string;
  side: 'ally' | 'enemy';
  /** Eigene Züge. */
  turns: number;
  /** Bewegte Felder. */
  moved: number;
  /** Eingesetzte Fähigkeiten (ohne Reaktionen) bzw. Reaktionen, je Fähigkeit. */
  abilities: Count;
  reactions: Count;
  /** Ressourcen-Punkte, die bei der Gegenseite gesenkt wurden (je Ressource). */
  lowered: Count;
  /** Ressourcen-Punkte, die bei der eigenen Seite (inkl. sich selbst) aufgefüllt wurden. */
  raised: Count;
  /** Vergebene Effekte (je Effekt). */
  effects: Count;
  /** Gegenstände eingesammelt bzw. verwendet. */
  collected: Count;
  used: Count;
  /** Wie oft bewusstlos geworden. */
  unconscious: number;
}

export interface Stats {
  units: Record<string, UnitStats>;
}

/** Statistik je gespieltem Level (der letzte Eintrag ist das laufende Level). */
export interface LevelStats {
  levelId: string | null;
  title: string;
  stats: Stats;
}

export const emptyStats = (): Stats => ({ units: {} });

const blank = (name: string, side: 'ally' | 'enemy'): UnitStats => ({
  name, side, turns: 0, moved: 0, abilities: {}, reactions: {}, lowered: {}, raised: {}, effects: {}, collected: {}, used: {}, unconscious: 0,
});

const add = (c: Count, key: string, n = 1): Count => ({ ...c, [key]: (c[key] ?? 0) + n });

function update(stats: Stats, battle: BattleState, unitId: string | undefined, fn: (u: UnitStats) => UnitStats): Stats {
  const u = unitId ? getUnit(battle, unitId) : undefined;
  if (!u) return stats;
  const cur = stats.units[u.id] ?? blank(u.name, u.side);
  return { units: { ...stats.units, [u.id]: fn({ ...cur, name: u.name }) } };
}

/** Zählt ein Ereignis. Veränderungen ohne Verursacher (Umgebung, automatische Änderungen) zählen nicht. */
export function recordEvent(stats: Stats, battle: BattleState, e: GameEvent): Stats {
  switch (e.kind) {
    case 'move':
      return update(stats, battle, e.unitId, (s) => ({ ...s, moved: s.moved + Math.max(Math.abs(e.to.x - e.from.x), Math.abs(e.to.y - e.from.y)) }));
    case 'used':
      if (e.abilityId.startsWith('objekt:')) return stats;
      return update(stats, battle, e.casterId, (s) => (e.reaction ? { ...s, reactions: add(s.reactions, e.abilityId) } : { ...s, abilities: add(s.abilities, e.abilityId) }));
    case 'resource': {
      const target = getUnit(battle, e.unitId);
      const cause = e.causeId ? getUnit(battle, e.causeId) : undefined;
      if (!target || !cause) return stats;
      const d = e.after - e.before;
      if (d < 0 && target.side !== cause.side) return update(stats, battle, cause.id, (s) => ({ ...s, lowered: add(s.lowered, e.resourceId, -d) }));
      if (d > 0 && target.side === cause.side) return update(stats, battle, cause.id, (s) => ({ ...s, raised: add(s.raised, e.resourceId, d) }));
      return stats;
    }
    case 'effect': {
      if (e.effectId === UNCONSCIOUS_ID) stats = update(stats, battle, e.unitId, (s) => ({ ...s, unconscious: s.unconscious + 1 }));
      return e.causeId ? update(stats, battle, e.causeId, (s) => ({ ...s, effects: add(s.effects, e.effectId) })) : stats;
    }
    case 'item':
      if (e.action === 'sammelt') return update(stats, battle, e.unitId, (s) => ({ ...s, collected: add(s.collected, e.objectId) }));
      if (e.action === 'verwendet') return update(stats, battle, e.unitId, (s) => ({ ...s, used: add(s.used, e.objectId) }));
      return stats;
    default:
      return stats;
  }
}

export function recordTurn(stats: Stats, battle: BattleState, unitId: string): Stats {
  return update(stats, battle, unitId, (s) => ({ ...s, turns: s.turns + 1 }));
}

function sum(a: Count, b: Count): Count {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}

function combine(a: UnitStats, b: UnitStats): UnitStats {
  return {
    ...a,
    turns: a.turns + b.turns,
    moved: a.moved + b.moved,
    abilities: sum(a.abilities, b.abilities),
    reactions: sum(a.reactions, b.reactions),
    lowered: sum(a.lowered, b.lowered),
    raised: sum(a.raised, b.raised),
    effects: sum(a.effects, b.effects),
    collected: sum(a.collected, b.collected),
    used: sum(a.used, b.used),
    unconscious: a.unconscious + b.unconscious,
  };
}

/** Mehrere Statistiken zusammenfassen (alle Level eines Runs): Allys je Team-Mitglied, Gegner je Name. */
export function mergeStats(list: Stats[]): Stats {
  const units: Record<string, UnitStats> = {};
  for (const st of list) {
    for (const [id, u] of Object.entries(st.units)) {
      const key = u.side === 'ally' ? id : `gegner:${u.name}`;
      units[key] = units[key] ? combine(units[key], u) : { ...u };
    }
  }
  return { units };
}

/** Summe aller Figuren einer Seite. */
export function sideTotal(stats: Stats, side: 'ally' | 'enemy'): UnitStats {
  return Object.values(stats.units)
    .filter((u) => u.side === side)
    .reduce(combine, blank(side === 'ally' ? 'Allys' : 'Gegner', side));
}
