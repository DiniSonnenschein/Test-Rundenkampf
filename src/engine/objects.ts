// Objekte: alles, was kein Charakter ist (Gegenstände für den Rucksack und Dinge auf der Map).
import { DEFAULT_ABILITY, type AbilityBlock, type AbilityFields } from './abilities';
import type { EntityKind } from './effects';
import type { Area } from './facing';

/** Wirkung eines Objekts: verteilt bei einem Auslöser die Bausteine einer Fähigkeit. */
export interface ObjectWorking {
  trigger:
    /** Ein Charakter betritt/verlässt den Bereich bzw. steht zu Beginn/Ende seines eigenen Zuges darin. */
    | {
        kind: 'bereich';
        event: 'betritt' | 'verlaesst' | 'zugbeginn' | 'zugende';
        allys: boolean;
        gegner: boolean;
        typeIds: string[];
        effectIds: string[];
      }
    | { kind: 'objekt'; event: 'gesammelt' | 'verwendet' | 'vergeben' | 'geworfen' };
  /** Bereich um das Objekt (Blick immer nach oben). */
  area: Area;
  /** Ein Ziel (der auslösende Charakter bzw. Träger) oder alle legalen im Bereich. */
  target: 'traeger' | 'aoe';
  /** Wann vergebene Effekte enden. */
  ending: 'verlassen' | 'ablegen' | 'nie';
  blocks: AbilityBlock[];
}

export interface ObjectFields {
  typeIds: string[];
  collision: boolean;
  castsShadow: boolean;
  collectible: boolean;
  carriable: boolean;
  stack: { stackable: boolean; max: number };
  /** Verborgen, bis es aufgedeckt wird (dann bis Levelende sichtbar). */
  hidden: boolean;
  light: { on: boolean; area: Area; whenCarried: boolean };
  /** Verwendung (z. B. trinken, anziehen) – aufgebaut wie eine Fähigkeit. */
  use: { usable: boolean; consumed: boolean; ability: AbilityFields };
  throw: {
    impact: 'liegen' | 'zerstoert' | 'verwandelt';
    into: { kind: EntityKind; id: string | null };
    ignoresObstacles: boolean;
    terrainId: string | null;
  };
  workings: ObjectWorking[];
}

export const DEFAULT_OBJECT: ObjectFields = {
  typeIds: [],
  collision: false,
  castsShadow: false,
  collectible: true,
  carriable: true,
  stack: { stackable: false, max: 5 },
  hidden: false,
  light: { on: false, area: ['0,0'], whenCarried: true },
  use: { usable: false, consumed: true, ability: { ...DEFAULT_ABILITY, targeting: { ...DEFAULT_ABILITY.targeting, range: ['0,0'], legal: { ...DEFAULT_ABILITY.targeting.legal, allys: { on: true, typeIds: [], effectIds: [] }, gegner: { on: false, typeIds: [], effectIds: [] } } } } },
  throw: { impact: 'liegen', into: { kind: 'objekt', id: null }, ignoresObstacles: false, terrainId: null },
  workings: [],
};

export function normalizeObject(partial: unknown): ObjectFields {
  const p = (partial && typeof partial === 'object' ? partial : {}) as Partial<ObjectFields>;
  const d = DEFAULT_OBJECT;
  return {
    typeIds: p.typeIds ?? [],
    collision: p.collision ?? d.collision,
    castsShadow: p.castsShadow ?? d.castsShadow,
    collectible: p.collectible ?? d.collectible,
    carriable: p.carriable ?? d.carriable,
    stack: { ...d.stack, ...p.stack },
    hidden: p.hidden ?? d.hidden,
    light: { ...d.light, ...p.light },
    use: { ...d.use, ...p.use, ability: p.use?.ability ?? structuredClone(d.use.ability) },
    throw: { ...d.throw, ...p.throw },
    workings: p.workings ?? [],
  };
}

/** Wie viele Rucksackplätze eine Menge eines Objekts belegt. */
export function slotsNeeded(o: Pick<ObjectFields, 'stack'>, count: number): number {
  if (count <= 0) return 0;
  return o.stack.stackable ? Math.ceil(count / Math.max(1, o.stack.max)) : count;
}
