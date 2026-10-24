// Licht & Nebel: Nur beleuchtete Felder (und die direkte Umgebung der Allys) sind sichtbar.
import { hasLineOfSight, inBounds, posKey, type Grid, type Pos } from './grid';
import type { Rules } from './rules';

export interface LightSource {
  pos: Pos;
  radius: number;
}

export function inRadius(a: Pos, b: Pos, radius: number, shape: Rules['light']['shape']): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  if (shape === 'quadrat') return Math.max(Math.abs(dx), Math.abs(dy)) <= radius;
  return dx * dx + dy * dy <= (radius + 0.5) * (radius + 0.5);
}

/** Felder im Umkreis, optional nur mit freier Sichtlinie. */
export function tilesAround(g: Grid, center: Pos, radius: number, light: Rules['light']): Set<string> {
  const result = new Set<string>();
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      const p = { x, y };
      if (!inBounds(g, p) || !inRadius(center, p, radius, light.shape)) continue;
      if (light.blockedBySight && !hasLineOfSight(g, center, p)) continue;
      result.add(posKey(p));
    }
  }
  return result;
}

export function litTiles(g: Grid, sources: LightSource[], light: Rules['light']): Set<string> {
  const result = new Set<string>();
  for (const s of sources) for (const k of tilesAround(g, s.pos, s.radius, light)) result.add(k);
  return result;
}

/** Sichtbar = beleuchtet + Eigensicht der Allys. */
export function visibleTiles(g: Grid, sources: LightSource[], viewers: Pos[], light: Rules['light']): Set<string> {
  const result = litTiles(g, sources, light);
  for (const v of viewers) for (const k of tilesAround(g, v, light.ownSight, light)) result.add(k);
  return result;
}
