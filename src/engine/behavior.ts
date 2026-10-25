// Gegner-KI (und unkontrollierbare Allys): feste, nachvollziehbare Regeln ohne Zufall.
import type { AbilityCondition } from './abilities';
import type { EntityKind } from './effects';
import type { EffectDuration, EventDirection } from './resources';

/** Kriterium der Hauptziel-Prioritätenliste; das erste entscheidet, die weiteren brechen Gleichstände. */
export type TargetCriterion =
  | { kind: 'naechster' }
  | { kind: 'ressource'; resourceId: string | null; order: 'niedrigster' | 'hoechster' }
  | { kind: 'laternentraeger' }
  | { kind: 'letzter-angreifer' }
  | { kind: 'typ'; typeIds: string[] }
  | { kind: 'effekt'; effectIds: string[] };

export type RuleCondition =
  | AbilityCondition
  /** Das Ziel der Regel liegt in Reichweite ihrer Fähigkeit. */
  | { kind: 'ziel-in-reichweite' }
  | { kind: 'hat-effekt'; who: 'selbst' | 'hauptziel'; effectId: string | null };

export type RuleTarget =
  | { kind: 'hauptziel' }
  | { kind: 'selbst' }
  /** Ein Verbündeter (anderer Gegner) nach eigener kleiner Prioritätenliste. */
  | { kind: 'verbuendeter'; criteria: TargetCriterion[] };

export interface BehaviorRule {
  zug: boolean;
  reaktion: boolean;
  conditions: RuleCondition[];
  abilityId: string | null;
  target: RuleTarget;
}

export type CharacterEventAction =
  | { kind: 'zerstoert' }
  | { kind: 'effekt'; effectId: string | null; duration: EffectDuration }
  | { kind: 'ersetzen'; into: { kind: EntityKind; id: string | null } }
  | { kind: 'sieg' }
  | { kind: 'niederlage' };

/** Event nur für diesen Gegner (wie Ressourcen-Events). */
export interface CharacterEvent {
  resourceId: string | null;
  direction: EventDirection;
  threshold: number;
  action: CharacterEventAction;
}

export interface Behavior {
  targetPriority: TargetCriterion[];
  retarget: 'jeder-zug' | 'bis-ungueltig';
  idle: 'stehen' | 'patrouille' | 'letzte-position' | 'licht';
  keepDistance: { on: boolean; distance: number };
  rules: BehaviorRule[];
  events: CharacterEvent[];
  loot: { items: { objectId: string | null; count: number }[]; when: 'zerstoert' | 'flucht' | 'beides' };
}

export const DEFAULT_BEHAVIOR: Behavior = {
  targetPriority: [{ kind: 'naechster' }],
  retarget: 'bis-ungueltig',
  idle: 'stehen',
  keepDistance: { on: false, distance: 3 },
  rules: [],
  events: [],
  loot: { items: [], when: 'zerstoert' },
};

export function normalizeBehavior(partial: unknown): Behavior {
  const p = (partial && typeof partial === 'object' ? partial : {}) as Partial<Behavior>;
  return {
    ...DEFAULT_BEHAVIOR,
    ...p,
    keepDistance: { ...DEFAULT_BEHAVIOR.keepDistance, ...p.keepDistance },
    loot: { ...DEFAULT_BEHAVIOR.loot, ...p.loot },
    targetPriority: p.targetPriority ?? structuredClone(DEFAULT_BEHAVIOR.targetPriority),
    rules: p.rules ?? [],
    events: p.events ?? [],
  };
}

/** Bewegungsart unter dem Effekt „Verhalten ändern“. */
export type MovementMode = 'zum-ziel' | 'abstand' | 'fliehen' | 'kreis' | 'stehen';

// ---------- Auswertung ----------

export interface Candidate {
  id: string;
  distance: number;
  values: Record<string, number>;
  isLanternBearer: boolean;
  typeIds: string[];
  effectIds: string[];
}

function score(c: Candidate, k: TargetCriterion, lastAttackerId?: string): number {
  switch (k.kind) {
    case 'naechster': return c.distance;
    case 'ressource': {
      const v = k.resourceId ? c.values[k.resourceId] ?? 0 : 0;
      return k.order === 'niedrigster' ? v : -v;
    }
    case 'laternentraeger': return c.isLanternBearer ? 0 : 1;
    case 'letzter-angreifer': return c.id === lastAttackerId ? 0 : 1;
    case 'typ': return c.typeIds.some((t) => k.typeIds.includes(t)) ? 0 : 1;
    case 'effekt': return c.effectIds.some((e) => k.effectIds.includes(e)) ? 0 : 1;
  }
}

/**
 * Ordnet mögliche Ziele nach der Prioritätenliste (kleinster Wert zuerst). Bei völligem Gleichstand
 * bleibt die Eingabe-Reihenfolge – so ist das Ergebnis immer gleich.
 */
export function rankTargets(candidates: Candidate[], criteria: TargetCriterion[], lastAttackerId?: string): string[] {
  return candidates
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      for (const k of criteria) {
        const d = score(a.c, k, lastAttackerId) - score(b.c, k, lastAttackerId);
        if (d !== 0) return d;
      }
      return a.i - b.i;
    })
    .map((x) => x.c.id);
}

/** Erstes Ziel der Rangfolge, zu dem es einen Weg gibt; sonst geht es in der Liste weiter. */
export function chooseTarget(ranked: string[], hasPath: (id: string) => boolean): string | null {
  return ranked.find(hasPath) ?? null;
}

/** Erste passende Regel für Zug bzw. Reaktion (von oben nach unten). */
export function pickRule(rules: BehaviorRule[], mode: 'zug' | 'reaktion', matches: (r: BehaviorRule) => boolean): BehaviorRule | null {
  return rules.find((r) => r[mode] && matches(r)) ?? null;
}
