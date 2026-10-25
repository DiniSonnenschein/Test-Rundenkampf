// Geländearten: Böden der Map (jedes Feld hat genau eine).
import { inBounds, type Pos } from './grid';
import type { ObjectWorking } from './objects';

export interface TerrainFields {
  /** Schachbrett-Muster: helle und dunkle Felder wechseln sich ab. */
  colors: { light: string; dark: string };
  /** Optionales, halbtransparentes Symbol aus der Formen-Bibliothek. */
  pattern: { on: boolean; shape: string };
  walkable: 'ja' | 'nein' | 'bedingt';
  /** Bei 'bedingt': nur für Charaktere mit diesen Typen bzw. Effekten. */
  walkableFor: { typeIds: string[]; effectIds: string[] };
  /** Hindernis für Fähigkeiten. */
  obstacle: boolean;
  castsShadow: boolean;
  /** Wer sich darauf bewegt, rutscht in Bewegungsrichtung weiter. */
  slippery: boolean;
  /** Wer auf diesem Gelände steht, zahlt für Fähigkeiten bestimmter Typen (leer = alle) mehr. */
  costIncreases: { typeIds: string[]; resourceId: string | null; amount: number }[];
  light: { on: boolean; area: string[] };
  /** Wie bei Objekten, aber nur mit Bereichs-Auslösern. */
  workings: ObjectWorking[];
}

export const DEFAULT_TERRAIN: TerrainFields = {
  colors: { light: '#6b5a44', dark: '#584936' },
  pattern: { on: false, shape: 'gras' },
  walkable: 'ja',
  walkableFor: { typeIds: [], effectIds: [] },
  obstacle: false,
  castsShadow: false,
  slippery: false,
  costIncreases: [],
  light: { on: false, area: ['0,0'] },
  workings: [],
};

export function normalizeTerrain(partial: unknown): TerrainFields {
  const p = (partial && typeof partial === 'object' ? partial : {}) as Partial<TerrainFields>;
  const d = DEFAULT_TERRAIN;
  return {
    colors: { ...d.colors, ...p.colors },
    pattern: { ...d.pattern, ...p.pattern },
    walkable: p.walkable ?? d.walkable,
    walkableFor: { typeIds: p.walkableFor?.typeIds ?? [], effectIds: p.walkableFor?.effectIds ?? [] },
    obstacle: p.obstacle ?? d.obstacle,
    castsShadow: p.castsShadow ?? d.castsShadow,
    slippery: p.slippery ?? d.slippery,
    costIncreases: p.costIncreases ?? [],
    light: { ...d.light, ...p.light },
    workings: (p.workings ?? []).filter((w) => w.trigger.kind === 'bereich'),
  };
}

/** Darf ein Charakter (mit seinen Typen und Effekten) dieses Gelände betreten? */
export function canWalk(t: Pick<TerrainFields, 'walkable' | 'walkableFor'>, typeIds: string[], effectIds: string[]): boolean {
  if (t.walkable === 'ja') return true;
  if (t.walkable === 'nein') return false;
  return typeIds.some((x) => t.walkableFor.typeIds.includes(x)) || effectIds.some((x) => t.walkableFor.effectIds.includes(x));
}

/** Farbe eines Feldes im Schachbrett-Muster. */
export const tileColor = (t: Pick<TerrainFields, 'colors'>, p: Pos) => ((p.x + p.y) % 2 === 0 ? t.colors.light : t.colors.dark);

/** Zusätzliche Kosten (Ressource → Menge) für eine Fähigkeit mit diesen Typen auf diesem Gelände. */
export function terrainCosts(t: Pick<TerrainFields, 'costIncreases'>, abilityTypeIds: string[]): Record<string, number> {
  const total: Record<string, number> = {};
  for (const c of t.costIncreases) {
    if (!c.resourceId) continue;
    if (c.typeIds.length && !c.typeIds.some((x) => abilityTypeIds.includes(x))) continue;
    total[c.resourceId] = (total[c.resourceId] ?? 0) + c.amount;
  }
  return total;
}

/**
 * Weiterrutschen: Endet eine Bewegung von `from` nach `to` auf rutschigem Gelände, gleitet die Figur
 * in derselben Richtung weiter, bis das nächste Feld blockiert ist oder sie auf nicht-rutschigem Gelände ankommt.
 * Liefert die Felder, über die gerutscht wird (letztes = Endposition).
 */
export function slide(
  map: { width: number; height: number },
  from: Pos,
  to: Pos,
  isSlippery: (p: Pos) => boolean,
  isBlocked: (p: Pos) => boolean,
): Pos[] {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  const path: Pos[] = [];
  if (dx === 0 && dy === 0) return path;
  let cur = to;
  for (let guard = 0; guard < 1000 && isSlippery(cur); guard++) {
    const next = { x: cur.x + dx, y: cur.y + dy };
    if (!inBounds(map, next) || isBlocked(next)) break;
    path.push(next);
    cur = next;
  }
  return path;
}
