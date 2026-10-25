// Fähigkeiten: jede Aktion (auch Bewegung) ist eine Fähigkeit. Werden einmalig ausgeführt.
import type { EffectCondition, EntityKind, Selection } from './effects';
import type { Area } from './facing';
import { inBounds, type Pos } from './grid';
import type { EffectDuration } from './resources';

// ---------- Grundeinstellungen ----------

export interface AbilityDisplay {
  /** Objekt fliegt vom Anwender zum Ziel. */
  projectile: { on: boolean; shape: string; color: string };
  casterGlow: { on: boolean; color: string };
  targetGlow: { on: boolean; color: string };
}

/** Zusätzliche Auslöser nur für Fähigkeiten. */
export type AbilityTrigger =
  | EffectCondition
  | { kind: 'nahe-ziel'; entity: 'ally' | 'gegner'; area: Area; typeIds: string[] }
  | { kind: 'nahe-verwendet'; entity: 'ally' | 'gegner'; area: Area; typeIds: string[] };

// ---------- Zielwahl ----------

export interface LegalTargets {
  allys: { on: boolean; typeIds: string[]; effectIds: string[] };
  gegner: { on: boolean; typeIds: string[]; effectIds: string[] };
  objekte: { on: boolean; ids: string[]; typeIds: string[] };
  gelaende: { on: boolean; ids: string[] };
  leer: boolean;
  /** Charaktere, die gerade eine Fähigkeit (bestimmter Typen) ausführen. */
  ausfuehrend: { on: boolean; typeIds: string[] };
  /** Charaktere, die gerade Ziel einer Fähigkeit (bestimmter Typen) werden. */
  anvisiert: { on: boolean; typeIds: string[] };
}

export type ObstacleBehavior = 'abbruch' | 'abbruch-ziel' | 'hindernis' | 'davor' | 'beide' | 'abprallen';
export type FinalObstacleBehavior = Exclude<ObstacleBehavior, 'abprallen'>;

export interface Targeting {
  kind: 'ziel' | 'zufall' | 'aoe';
  minTargets: number;
  maxTargets: number;
  /** Zufall: auch illegale Felder in Reichweite können getroffen werden. */
  includeIllegal: boolean;
  legal: LegalTargets;
  /** Reichweite (vom Anwender aus, dreht mit seiner Blickrichtung). Wird nicht durch Hindernisse eingeschränkt. */
  range: Area;
  /** Trifft auch hinter Hindernissen. */
  ignoresObstacles: boolean;
  obstacle: { behavior: ObstacleBehavior; maxBounces: number; final: FinalObstacleBehavior };
  /** Radius um jedes Ziel (Blick immer nach oben); Getroffene gelten nicht als Ziele. */
  radius: Area;
  radiusIgnoresObstacles: boolean;
}

// ---------- Bedingungen & Kosten ----------

export type AbilityCondition =
  | { kind: 'gegenstand'; objectId: string | null }
  | { kind: 'ressource'; resourceId: string | null; bound: 'min' | 'max'; value: number }
  | { kind: 'in-bereich'; entity: EntityKind | 'gelaende'; selection: Selection; area: Area };

export type Cost =
  | { kind: 'ressource'; resourceId: string | null; amount: number }
  | { kind: 'objekt'; selection: Selection; count: number };

/** Kostensteigerung pro zusätzlichem Ziel bzw. pro Feld Entfernung (Schritte, diagonal = 1). */
export interface CostIncrease {
  per: 'ziel' | 'entfernung';
  resourceId: string | null;
  amount: number;
}

// ---------- Bausteine ----------

export type AbilityBlockBody =
  | { kind: 'ressource'; resourceId: string | null; amount: number; mayExceedMax: boolean }
  | { kind: 'effekt'; action: 'ausloesen' | 'beenden'; effectId: string | null; typeIds: string[]; duration: EffectDuration }
  | { kind: 'faehigkeit'; action: 'ausloesen' | 'unterbrechen'; abilityId: string | null; typeIds: string[] }
  | {
      kind: 'schutz';
      against: 'faehigkeit' | 'effekt' | 'ressource';
      from: 'alle' | 'gegner' | 'allys' | 'typen';
      typeIds: string[];
      duration: EffectDuration;
    }
  /**
   * Richtung: mögliche Zielfelder als Bereich vom Ziel aus; weg/hin: um X Felder vom/zum Anwender.
   * Unabhängig von Blickrichtungen. Hindernisse stoppen die Bewegung (außer sie werden ignoriert).
   */
  | { kind: 'ziel-bewegen'; mode: 'richtung' | 'weg' | 'hin'; area: Area; distance: number; ignoresObstacles: boolean }
  /** Mögliche Zielfelder als Bereich (unabhängig von der Blickrichtung). Ohne „Hindernisse ignorieren“ ein Weg ohne Blockade, sonst ein Sprung. */
  | { kind: 'anwender-bewegen'; area: Area; ignoresObstacles: boolean }
  | { kind: 'gelaende'; terrainId: string | null }
  /** Nur Objekte und Gegner: werden aus dem Level entfernt. */
  | { kind: 'zerstoeren' }
  /** Nur Objekte und Gegner: werden dauerhaft in ein Objekt oder einen Gegner verwandelt (Position & Blickrichtung bleiben). */
  | { kind: 'ersetzen'; into: { kind: 'objekt' | 'gegner'; id: string | null } }
  | { kind: 'sammeln' }
  | { kind: 'tragen' }
  | { kind: 'platzieren'; what: 'getragenes' | 'rucksack'; selection: Selection; area: Area; ignoresObstacles: boolean }
  | { kind: 'blickrichtung'; who: 'ziel' | 'anwender'; mode: 'zu' | 'weg' | 'richtung'; direction: 'n' | 'o' | 's' | 'w' };

export type AbilityBlock = AbilityBlockBody & { extraCosts: Cost[] };

export interface AbilityFields {
  typeIds: string[];
  display: AbilityDisplay;
  mode: 'zwang' | 'wahl';
  triggers: AbilityTrigger[];
  targeting: Targeting;
  conditions: AbilityCondition[];
  costs: Cost[];
  costIncreases: CostIncrease[];
  blocks: AbilityBlock[];
}

export const DEFAULT_LEGAL: LegalTargets = {
  allys: { on: false, typeIds: [], effectIds: [] },
  gegner: { on: true, typeIds: [], effectIds: [] },
  objekte: { on: false, ids: [], typeIds: [] },
  gelaende: { on: false, ids: [] },
  leer: false,
  ausfuehrend: { on: false, typeIds: [] },
  anvisiert: { on: false, typeIds: [] },
};

export const DEFAULT_ABILITY: AbilityFields = {
  typeIds: [],
  display: {
    projectile: { on: false, shape: 'kreis', color: '#e0a83a' },
    casterGlow: { on: false, color: '#e0a83a' },
    targetGlow: { on: true, color: '#e0523a' },
  },
  mode: 'wahl',
  triggers: [],
  targeting: {
    kind: 'ziel',
    minTargets: 1,
    maxTargets: 1,
    includeIllegal: false,
    legal: DEFAULT_LEGAL,
    range: ['-1,-1', '0,-1', '1,-1', '-1,0', '1,0', '-1,1', '0,1', '1,1'],
    ignoresObstacles: false,
    obstacle: { behavior: 'abbruch-ziel', maxBounces: 1, final: 'abbruch-ziel' },
    radius: [],
    radiusIgnoresObstacles: false,
  },
  conditions: [],
  costs: [],
  costIncreases: [],
  blocks: [],
};

export function normalizeAbility(partial: unknown): AbilityFields {
  const p = (partial && typeof partial === 'object' ? partial : {}) as Partial<AbilityFields>;
  const d = DEFAULT_ABILITY;
  const t = (p.targeting ?? {}) as Partial<Targeting>;
  return {
    typeIds: p.typeIds ?? [],
    display: {
      projectile: { ...d.display.projectile, ...p.display?.projectile },
      casterGlow: { ...d.display.casterGlow, ...p.display?.casterGlow },
      targetGlow: { ...d.display.targetGlow, ...p.display?.targetGlow },
    },
    mode: p.mode ?? d.mode,
    triggers: p.triggers ?? [],
    targeting: {
      ...d.targeting,
      ...t,
      legal: { ...d.targeting.legal, ...t.legal },
      obstacle: { ...d.targeting.obstacle, ...t.obstacle },
    },
    conditions: p.conditions ?? [],
    costs: p.costs ?? [],
    costIncreases: p.costIncreases ?? [],
    blocks: p.blocks ?? [],
  };
}

// ---------- Kosten ----------

/**
 * Gesamtkosten an Ressourcen (ID → Menge): Grundkosten + Bausteine + Steigerungen
 * (pro Ziel über dem Minimum, pro Feld Entfernung je Ziel).
 */
export function resourceCosts(a: AbilityFields, opts: { targets: number; distances: number[] }): Record<string, number> {
  const total: Record<string, number> = {};
  const add = (id: string | null, n: number) => {
    if (id) total[id] = (total[id] ?? 0) + n;
  };
  const all = [...a.costs, ...a.blocks.flatMap((b) => b.extraCosts)];
  for (const c of all) if (c.kind === 'ressource') add(c.resourceId, c.amount);
  const extraTargets = Math.max(0, opts.targets - Math.max(1, a.targeting.minTargets));
  const distance = opts.distances.reduce((s, d) => s + d, 0);
  for (const inc of a.costIncreases) add(inc.resourceId, inc.amount * (inc.per === 'ziel' ? extraTargets : distance));
  return total;
}

export function canPay(costs: Record<string, number>, available: Record<string, number>): boolean {
  return Object.entries(costs).every(([id, n]) => (available[id] ?? 0) >= n);
}

// ---------- Flugbahn ----------

export interface TraceResult {
  /** Durchflogene Felder (ohne Start). */
  path: Pos[];
  /** Felder, an denen abgeprallt wurde. */
  bounces: Pos[];
  /** Feld, an dem die Flugbahn endet (Ziel, Hindernis, davor) bzw. null, wenn sie das Spielfeld verlässt. */
  end: Pos | null;
  /** Wie die Flugbahn endet. */
  outcome: 'ziel' | 'hindernis' | 'verlassen';
}

/**
 * Verfolgt eine Fähigkeit von Feldmitte zu Feldmitte. Hindernisse reflektieren die Flugbahn
 * (Einfallswinkel = Ausfallswinkel, das Feld wirkt als Spiegel), solange Abpraller übrig sind;
 * danach (bzw. ohne Abprallen) endet sie am Hindernis. Nach einem Abpraller trifft sie das erste
 * Feld, für das isTarget gilt.
 */
export function traceProjectile(
  map: { width: number; height: number },
  from: Pos,
  to: Pos,
  isObstacle: (p: Pos) => boolean,
  isTarget: (p: Pos) => boolean,
  maxBounces: number,
): TraceResult {
  const path: Pos[] = [];
  const bounces: Pos[] = [];
  let x = from.x + 0.5;
  let y = from.y + 0.5;
  let dx = to.x - from.x;
  let dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { path, bounces, end: { ...from }, outcome: 'ziel' };
  dx /= len;
  dy /= len;
  let cx = from.x;
  let cy = from.y;
  let bounced = 0;

  for (let guard = 0; guard < 1000; guard++) {
    // Abstand bis zur nächsten senkrechten bzw. waagrechten Feldgrenze.
    const tx = dx > 0 ? (cx + 1 - x) / dx : dx < 0 ? (cx - x) / dx : Infinity;
    const ty = dy > 0 ? (cy + 1 - y) / dy : dy < 0 ? (cy - y) / dy : Infinity;
    const eps = 1e-9;
    const stepX = tx <= ty + eps;
    const stepY = ty <= tx + eps;
    const nx = cx + (stepX ? Math.sign(dx) : 0);
    const ny = cy + (stepY ? Math.sign(dy) : 0);
    const next = { x: nx, y: ny };
    const t = Math.min(tx, ty);

    if (!inBounds(map, next)) return { path, bounces, end: null, outcome: 'verlassen' };

    if (isObstacle(next)) {
      if (bounced >= maxBounces) {
        path.push(next);
        return { path, bounces, end: next, outcome: 'hindernis' };
      }
      bounced++;
      bounces.push(next);
      // Spiegeln an der getroffenen Feldkante (Ecke: beide Richtungen).
      const blockedX = stepX && (!stepY || isObstacle({ x: nx, y: cy }));
      const blockedY = stepY && (!stepX || isObstacle({ x: cx, y: ny }));
      x += dx * t;
      y += dy * t;
      if (blockedX || (!blockedX && !blockedY)) dx = -dx;
      if (blockedY || (!blockedX && !blockedY)) dy = -dy;
      continue;
    }

    x += dx * t;
    y += dy * t;
    cx = nx;
    cy = ny;
    path.push(next);
    const reachedTarget = bounced === 0 ? nx === to.x && ny === to.y : isTarget(next);
    if (reachedTarget) return { path, bounces, end: next, outcome: 'ziel' };
  }
  return { path, bounces, end: null, outcome: 'verlassen' };
}
