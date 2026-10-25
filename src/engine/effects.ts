// Effekte: dauerhafte Zustände auf Allys und Gegnern. Alle Charaktere können grundsätzlich
// von allen Effekten betroffen sein (Ausnahmen legt die Charaktererstellung fest).
import type { Area } from './facing';
import type { ChangeInterval, ChangeTiming, EffectDuration, EventDirection } from './resources';

export const UNCONSCIOUS_ID = 'effekte-bewusstlos';

/** Auswahl „alle oder bestimmte“: einzelne Einträge und/oder Typen. */
export interface Selection {
  all: boolean;
  ids: string[];
  typeIds: string[];
}

export type CharacterKind = 'ally' | 'gegner';
export type EntityKind = CharacterKind | 'objekt';
export type ChangeSource = 'alle' | 'gegner' | 'allys' | 'eigene' | 'typen';

// ---------- Bausteine (Wirkung, solange der Effekt aktiv ist) ----------

export type EffectBlock =
  /** Ressource verändern: dauerhaft (wird am Ende zurückgenommen) oder wiederkehrend. */
  | {
      kind: 'ressource';
      resourceId: string | null;
      mode: 'dauerhaft' | 'wiederkehrend';
      interval: ChangeInterval;
      timing: ChangeTiming;
      amount: number;
      mayExceedMax: boolean;
    }
  /** Weiteren Effekt hinzufügen: pro Runde/Level oder einmalig nach X Runden. */
  | {
      kind: 'effekt';
      effectId: string | null;
      schedule: 'runde' | 'level' | 'nach-runden';
      timing: ChangeTiming;
      rounds: number;
      duration: EffectDuration;
    }
  | { kind: 'ersetzen'; from: string[]; to: string[] }
  | { kind: 'hinzufuegen'; abilityIds: string[] }
  /** Reaktion hinzufügen – wird wie im Charakter-Editor festgelegt (Abschnitt 6). */
  | { kind: 'reaktion' }
  | { kind: 'verlust'; what: 'typ' | 'faehigkeiten' | 'zug' | 'reaktion'; typeIds: string[] }
  /** Ersetzt die Sicht im Nebel. */
  | { kind: 'sicht'; area: Area }
  /** Gegner: neues Hauptziel; Allys: unkontrollierbar mit Hauptziel (Details Abschnitt 7). */
  | { kind: 'verhalten' }
  | { kind: 'gelaende-ignorieren'; terrain: Selection }
  | { kind: 'hindernis-ignorieren'; category: EntityKind | 'gelaende'; selection: Selection }
  | { kind: 'unveraenderlich'; resourceId: string | null; by: ChangeSource; typeIds: string[] }
  /** Nicht wahrnehmbar für alle bzw. bestimmte Charaktere (AOE trifft trotzdem). */
  | { kind: 'unsichtbar'; selection: Selection }
  /** Keine Kollision: kann Felder mit anderen teilen und gilt nicht als Hindernis; bleibt anvisierbar. */
  | { kind: 'keine-kollision' }
  /** Verwandelt den Träger in einen Ally/Gegner/Gegenstand; endet der Effekt, wird zurückverwandelt. Allys zählen weiter als Ally. */
  | { kind: 'verwandeln'; into: { kind: EntityKind; id: string | null } };

// ---------- Auslöser & Beendigung ----------

export type EffectCondition =
  | { kind: 'spielstart' }
  | { kind: 'level-enthaelt'; entity: EntityKind; id: string | null }
  | { kind: 'bereich'; event: 'betritt' | 'verlaesst'; entity: EntityKind; selection: Selection; area: Area }
  | { kind: 'ziel'; from: 'alle' | 'allys' | 'gegner' | 'typen'; typeIds: string[] }
  | { kind: 'ressource-aenderung'; resourceId: string | null; change: 'positiv' | 'negativ' | 'mindestens' | 'generell'; min: number }
  | { kind: 'ressource-grenze'; resourceId: string | null; direction: EventDirection; threshold: number }
  | { kind: 'gegenstand'; action: 'sammelt' | 'verwendet' | 'platziert'; objectId: string | null };

export type EffectEnding =
  | { kind: 'nach'; count: number; unit: 'zuege' | 'runden' | 'level'; timing: ChangeTiming }
  | EffectCondition;

export interface EffectFields {
  display: { show: boolean; color: string };
  typeIds: string[];
  stack: { stackable: boolean; max: number };
  /** Diese Effekte werden beim Hinzukommen beendet und können nicht hinzukommen, solange dieser aktiv ist. */
  excludes: string[];
  blocks: EffectBlock[];
  triggers: EffectCondition[];
  endings: EffectEnding[];
}

export const DEFAULT_EFFECT: EffectFields = {
  display: { show: true, color: '#7d8a3a' },
  typeIds: [],
  stack: { stackable: false, max: 2 },
  excludes: [],
  blocks: [],
  triggers: [],
  endings: [],
};

export function normalizeEffect(partial: unknown): EffectFields {
  const p = (partial && typeof partial === 'object' ? partial : {}) as Partial<EffectFields>;
  return {
    display: { ...DEFAULT_EFFECT.display, ...p.display },
    typeIds: p.typeIds ?? [],
    stack: { ...DEFAULT_EFFECT.stack, ...p.stack },
    excludes: p.excludes ?? [],
    blocks: p.blocks ?? [],
    triggers: p.triggers ?? [],
    endings: p.endings ?? [],
  };
}

// ---------- Laufzeit ----------

/** Ein aktiver Effekt (bzw. Stapel) auf einem Charakter. */
export interface ActiveEffect {
  instanceId: string;
  effectId: string;
  sourceId?: string;
  /** Von der Quelle vorgegebene Dauer. */
  duration: EffectDuration;
  /** Verbleibende Runden laut Quelle. */
  roundsLeft?: number;
  /** Zähler je Beendigung „nach X …“ (Index → bisher gezählt). */
  counters: Record<number, number>;
}

export type EffectDefs = Record<string, EffectFields>;

export interface AddResult {
  active: ActiveEffect[];
  added: boolean;
  ended: ActiveEffect[];
}

/**
 * Fügt einen Effekt hinzu. Unverträglichkeit legt der dominante Effekt fest: er beendet die
 * genannten Effekte und verhindert ihr Hinzukommen. Nicht stapelbar = höchstens einmal (erneuert);
 * stapelbar bis zum Maximum, darüber ersetzt der neue Stapel den ältesten.
 */
export function addEffect(active: ActiveEffect[], instance: ActiveEffect, defs: EffectDefs): AddResult {
  const def = defs[instance.effectId] ?? DEFAULT_EFFECT;
  const blocked = active.some((a) => (defs[a.effectId]?.excludes ?? []).includes(instance.effectId));
  if (blocked) return { active, added: false, ended: [] };

  const ended = active.filter((a) => def.excludes.includes(a.effectId));
  let next = active.filter((a) => !def.excludes.includes(a.effectId));

  const same = next.filter((a) => a.effectId === instance.effectId);
  const max = def.stack.stackable ? Math.max(1, def.stack.max) : 1;
  if (same.length >= max) {
    const drop = same.slice(0, same.length - max + 1);
    ended.push(...drop);
    next = next.filter((a) => !drop.includes(a));
  }
  const withRounds = instance.duration.kind === 'runden' ? { ...instance, roundsLeft: instance.duration.rounds } : instance;
  return { active: [...next, withRounds], added: true, ended };
}

export type TickEvent = { unit: 'zug' | 'runde' | 'level'; timing: ChangeTiming };

const ENDING_UNIT: Record<'zuege' | 'runden' | 'level', TickEvent['unit']> = { zuege: 'zug', runden: 'runde', level: 'level' };

/**
 * Zählt Dauern herunter. Von der Quelle vorgegebene Runden laufen am Ende jeder Runde ab;
 * „nach X …“-Beendigungen zählen zum eingestellten Zeitpunkt. Was zuerst eintritt, beendet den Effekt.
 * Bei 'zug' sind nur die Effekte des Charakters gemeint, der am Zug ist.
 */
export function tickEffects(active: ActiveEffect[], event: TickEvent, defs: EffectDefs): { active: ActiveEffect[]; ended: ActiveEffect[] } {
  const keep: ActiveEffect[] = [];
  const ended: ActiveEffect[] = [];
  for (const a of active) {
    let done = false;
    let next = a;
    if (event.unit === 'runde' && event.timing === 'ende' && a.roundsLeft !== undefined) {
      next = { ...next, roundsLeft: a.roundsLeft - 1 };
      if (next.roundsLeft! <= 0) done = true;
    }
    const endings = defs[a.effectId]?.endings ?? [];
    endings.forEach((e, i) => {
      if (e.kind !== 'nach' || ENDING_UNIT[e.unit] !== event.unit || e.timing !== event.timing) return;
      const count = (next.counters[i] ?? 0) + 1;
      next = { ...next, counters: { ...next.counters, [i]: count } };
      if (count >= e.count) done = true;
    });
    (done ? ended : keep).push(next);
  }
  return { active: keep, ended };
}

/** Summe der dauerhaften Veränderungen einer Ressource durch aktive Effekte (je Stapel). */
export function permanentModifier(active: ActiveEffect[], resourceId: string, defs: EffectDefs): number {
  let sum = 0;
  for (const a of active) {
    for (const b of defs[a.effectId]?.blocks ?? []) {
      if (b.kind === 'ressource' && b.mode === 'dauerhaft' && b.resourceId === resourceId) sum += b.amount;
    }
  }
  return sum;
}

/** Hat irgendein aktiver Effekt einen Baustein dieser Art? */
export function hasBlock<K extends EffectBlock['kind']>(active: ActiveEffect[], kind: K, defs: EffectDefs): Extract<EffectBlock, { kind: K }>[] {
  return active.flatMap((a) => (defs[a.effectId]?.blocks ?? []).filter((b): b is Extract<EffectBlock, { kind: K }> => b.kind === kind));
}
