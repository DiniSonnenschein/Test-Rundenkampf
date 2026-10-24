// Quadratisches Raster: Nachbarn, Entfernungen, Sichtlinie, erreichbare Felder.

export interface Pos {
  x: number;
  y: number;
}

export const posKey = (p: Pos) => `${p.x},${p.y}`;
export const samePos = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;

export interface Grid {
  width: number;
  height: number;
  isPassable(p: Pos): boolean;
  blocksSight(p: Pos): boolean;
}

export interface MoveRules {
  diagonal: boolean;
  cornerCutting: boolean;
}

export function inBounds(g: Pick<Grid, 'width' | 'height'>, p: Pos): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < g.width && p.y < g.height;
}

/** Schritte zwischen zwei Feldern (mit Diagonale: Schachkönig-Distanz). */
export function distance(a: Pos, b: Pos, diagonal: boolean): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return diagonal ? Math.max(dx, dy) : dx + dy;
}

const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Begehbare Nachbarfelder. */
export function neighbors(g: Grid, p: Pos, rules: MoveRules): Pos[] {
  const result: Pos[] = [];
  for (const [dx, dy] of ORTHO) {
    const n = { x: p.x + dx, y: p.y + dy };
    if (inBounds(g, n) && g.isPassable(n)) result.push(n);
  }
  if (rules.diagonal) {
    for (const [dx, dy] of DIAG) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (!inBounds(g, n) || !g.isPassable(n)) continue;
      if (!rules.cornerCutting) {
        const a = { x: p.x + dx, y: p.y };
        const b = { x: p.x, y: p.y + dy };
        if (!g.isPassable(a) || !g.isPassable(b)) continue;
      }
      result.push(n);
    }
  }
  return result;
}

/** Felder auf der Linie zwischen a und b (ohne Start und Ziel). */
export function lineBetween(a: Pos, b: Pos): Pos[] {
  const tiles: Pos[] = [];
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const p = { x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) };
    if (!samePos(p, a) && !samePos(p, b) && !tiles.some((q) => samePos(q, p))) tiles.push(p);
  }
  return tiles;
}

/** Freie Sichtlinie: kein sichtblockierendes Feld dazwischen. */
export function hasLineOfSight(g: Grid, a: Pos, b: Pos): boolean {
  return lineBetween(a, b).every((p) => !g.blocksSight(p));
}

/** Alle Felder, die in höchstens maxSteps Schritten erreichbar sind, mit Schrittzahl. */
export function reachable(
  g: Grid,
  start: Pos,
  maxSteps: number,
  rules: MoveRules,
  isOccupied: (p: Pos) => boolean = () => false,
): Map<string, number> {
  const dist = new Map<string, number>([[posKey(start), 0]]);
  let frontier = [start];
  for (let step = 1; step <= maxSteps && frontier.length; step++) {
    const next: Pos[] = [];
    for (const p of frontier) {
      for (const n of neighbors(g, p, rules)) {
        const k = posKey(n);
        if (dist.has(k) || isOccupied(n)) continue;
        dist.set(k, step);
        next.push(n);
      }
    }
    frontier = next;
  }
  return dist;
}
