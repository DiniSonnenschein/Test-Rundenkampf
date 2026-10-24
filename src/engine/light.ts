// Licht & Nebel: Nur beleuchtete Felder (und was Allys selbst sehen) sind sichtbar.
// Schatten werfen nur Felder, deren Objekte/Gelände als sichtblockierend angelegt sind.
import { hasLineOfSight, inBounds, posKey, type Grid, type Pos } from './grid';
import type { LightShape } from './rules';

export interface LightSource {
  pos: Pos;
  radius: number;
}

export function inRadius(a: Pos, b: Pos, radius: number, shape: LightShape): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  if (shape === 'quadrat') return Math.max(Math.abs(dx), Math.abs(dy)) <= radius;
  return dx * dx + dy * dy <= (radius + 0.5) * (radius + 0.5);
}

/** Felder im Umkreis mit freier Sichtlinie. */
export function tilesAround(g: Grid, center: Pos, radius: number, shape: LightShape): Set<string> {
  const result = new Set<string>();
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      const p = { x, y };
      if (inBounds(g, p) && inRadius(center, p, radius, shape) && hasLineOfSight(g, center, p)) result.add(posKey(p));
    }
  }
  return result;
}

export function litTiles(g: Grid, sources: LightSource[], shape: LightShape): Set<string> {
  const result = new Set<string>();
  for (const s of sources) for (const k of tilesAround(g, s.pos, s.radius, shape)) result.add(k);
  return result;
}

/** Sichtbar = beleuchtet + Eigensicht der Allys (Radius je Charakter, 0 = nur eigenes Feld). */
export function visibleTiles(g: Grid, sources: LightSource[], viewers: LightSource[], shape: LightShape): Set<string> {
  return litTiles(g, [...sources, ...viewers], shape);
}
