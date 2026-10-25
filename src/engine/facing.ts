// Blickrichtung (4 Richtungen) und Bereichs-Auswahl relativ zur Blickrichtung.
import type { Pos } from './grid';

export type Facing = 'n' | 'o' | 's' | 'w';

export const FACING_LABELS: Record<Facing, string> = { n: 'Oben', o: 'Rechts', s: 'Unten', w: 'Links' };

/** Bereich: Versatz-Schlüssel "dx,dy" auf einem 9×9-Raster, definiert mit Blick nach oben (dy < 0 = vorne). */
export type Area = string[];
export const AREA_RADIUS = 4;

export function rotateOffset(dx: number, dy: number, facing: Facing): { dx: number; dy: number } {
  switch (facing) {
    case 'n': return { dx, dy };
    case 'o': return { dx: -dy, dy: dx };
    case 's': return { dx: -dx, dy: -dy };
    case 'w': return { dx: dy, dy: -dx };
  }
}

/** Felder eines Bereichs um eine Position, gedreht nach Blickrichtung. */
export function areaTiles(center: Pos, area: Area, facing: Facing): Pos[] {
  return area.map((k) => {
    const [dx, dy] = k.split(',').map(Number);
    const r = rotateOffset(dx, dy, facing);
    return { x: center.x + r.dx, y: center.y + r.dy };
  });
}

/** Blickrichtung nach einem Bewegungsschritt. Diagonal: aktuelle Richtung bleibt, wenn sie passt, sonst die senkrechte. */
export function facingFromStep(from: Pos, to: Pos, current: Facing): Facing {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  const vertical: Facing | null = dy < 0 ? 'n' : dy > 0 ? 's' : null;
  const horizontal: Facing | null = dx > 0 ? 'o' : dx < 0 ? 'w' : null;
  if (!vertical) return horizontal ?? current;
  if (!horizontal) return vertical;
  return current === vertical || current === horizontal ? current : vertical;
}

/** Zu einem Ziel hin drehen (vorherrschende Achse). Steht das Ziel genau diagonal, ändert sich nichts. */
export function facingTowards(from: Pos, to: Pos, current: Facing): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) === Math.abs(dy)) return current;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'o' : 'w';
  return dy > 0 ? 's' : 'n';
}
