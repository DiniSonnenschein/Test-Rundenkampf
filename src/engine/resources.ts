// Ressourcen: Typen und Rechenregeln. Alles in ganzen Zahlen, Minimum immer 0.

export const INITIATIVE_ID = 'ressourcen-initiative';

export type ResourceScope = 'global' | 'individuell';
export type ChangeInterval = 'zug' | 'runde' | 'level';
export type ChangeTiming = 'beginn' | 'ende';

/** Automatische Veränderung (mehrfach möglich). Global: nur Runde/Level. */
export interface AutoChange {
  interval: ChangeInterval;
  timing: ChangeTiming;
  amount: number;
}

/** Anpassung einer Veränderung durch eine bestimmte Fähigkeit bzw. Kategorie. */
export interface Adjustment {
  abilityId: string | null;
  category: string | null;
  amount: number;
}

export type EventDirection = 'faellt' | 'steigt';

export type EffectDuration = { kind: 'runden'; rounds: number } | { kind: 'unendlich' } | { kind: 'bis-aufloesung' };

export type EventAction =
  | { kind: 'sieg' }
  | { kind: 'niederlage' }
  /** Individuell: der Charakter selbst; global: alle Allys bzw. alle Gegner. */
  | { kind: 'effekt'; target: 'selbst' | 'allys' | 'gegner'; effectId: string | null; duration: EffectDuration }
  /** Individuell: andere Ressource desselben Charakters; global: andere globale Ressource. */
  | { kind: 'ressource'; resourceId: string | null; amount: number };

export interface ResourceEvent {
  /** 'faellt': erreicht oder unterschreitet die Grenze; 'steigt': erreicht oder überschreitet sie. */
  direction: EventDirection;
  threshold: number;
  action: EventAction;
}

export interface ResourceFields {
  scope: ResourceScope;
  // Nur global (bei individuellen Ressourcen je Charakter):
  hasMax: boolean;
  max: number;
  start: number;
  changes: AutoChange[];
  adjustments: Adjustment[];
  // Nur individuell:
  display: { show: boolean; color: string };
  // Beide:
  events: ResourceEvent[];
}

export const DEFAULT_RESOURCE: ResourceFields = {
  scope: 'individuell',
  hasMax: true,
  max: 10,
  start: 10,
  changes: [],
  adjustments: [],
  display: { show: true, color: '#b5432b' },
  events: [],
};

/**
 * Wendet eine Veränderung an. Minimum ist 0. Automatische Erhöhungen (und Fähigkeiten,
 * die es nicht erlauben) überschreiten das Maximum nicht.
 */
export function applyChange(current: number, amount: number, max: number | null, mayExceedMax = false): number {
  if (amount < 0) return Math.max(0, current + amount);
  if (max === null || mayExceedMax) return current + amount;
  return Math.max(current, Math.min(current + amount, max));
}

/** Anpassung verändert den Betrag (−5 = 5 weniger Wirkung), ohne dass die Wirkung umkippt. */
export function adjustAmount(amount: number, adjustment: number): number {
  if (amount === 0) return 0;
  const magnitude = Math.max(0, Math.abs(amount) + adjustment);
  return magnitude === 0 ? 0 : Math.sign(amount) * magnitude;
}

/** Summe aller passenden Anpassungen für eine Fähigkeit (inkl. ihrer Kategorien). */
export function totalAdjustment(adjustments: Adjustment[], abilityId: string, categories: string[] = []): number {
  return adjustments
    .filter((a) => (a.abilityId && a.abilityId === abilityId) || (a.category && categories.includes(a.category)))
    .reduce((sum, a) => sum + a.amount, 0);
}

/** Events, deren Grenze durch die Veränderung (erneut) erreicht bzw. überschritten wurde. */
export function triggeredEvents(events: ResourceEvent[], before: number, after: number): ResourceEvent[] {
  return events.filter((e) =>
    e.direction === 'faellt' ? before > e.threshold && after <= e.threshold : before < e.threshold && after >= e.threshold,
  );
}

/** Automatische Veränderungen für einen Zeitpunkt. */
export function changesAt(changes: AutoChange[], interval: ChangeInterval, timing: ChangeTiming): AutoChange[] {
  return changes.filter((c) => c.interval === interval && c.timing === timing);
}

export function normalizeResource(partial: unknown): ResourceFields {
  const p = (partial && typeof partial === 'object' ? partial : {}) as Partial<ResourceFields>;
  return {
    ...DEFAULT_RESOURCE,
    ...p,
    display: { ...DEFAULT_RESOURCE.display, ...p.display },
    changes: p.changes ?? [],
    adjustments: p.adjustments ?? [],
    events: p.events ?? [],
  };
}
