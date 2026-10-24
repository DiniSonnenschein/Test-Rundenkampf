// Kleine Vorschau, wie Laterne, Schatten und Eigensicht mit den aktuellen Regeln wirken.
import { posKey, type Grid } from '../../engine/grid';
import { litTiles, visibleTiles } from '../../engine/light';
import type { Rules } from '../../engine/rules';

const SIZE = 13;
const WALLS = new Set(['8,4', '8,5', '8,6', '8,7', '3,3', '4,3']);
const LANTERN = { x: 6, y: 6 };
const ALLY = { x: 4, y: 9 };

export function LightPreview({ rules }: { rules: Rules }) {
  const grid: Grid = { width: SIZE, height: SIZE, isPassable: (p) => !WALLS.has(posKey(p)), blocksSight: (p) => WALLS.has(posKey(p)) };
  const source = [{ pos: LANTERN, radius: rules.light.lanternRadius }];
  const lit = litTiles(grid, source, rules.light);
  const seen = visibleTiles(grid, source, [ALLY], rules.light);
  const cell = 100 / SIZE;

  return (
    <figure className="light-preview">
      <svg viewBox="0 0 100 100" role="img" aria-label="Vorschau Licht und Nebel">
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const x = i % SIZE, y = Math.floor(i / SIZE), k = `${x},${y}`;
          const fill = WALLS.has(k) && seen.has(k) ? '#6b4a33' : lit.has(k) ? '#8a5a2b' : seen.has(k) ? '#4a3524' : '#120b08';
          return <rect key={k} x={x * cell} y={y * cell} width={cell} height={cell} fill={fill} stroke="#00000055" strokeWidth={0.3} />;
        })}
        <circle cx={(LANTERN.x + 0.5) * cell} cy={(LANTERN.y + 0.5) * cell} r={cell * 0.35} fill="#f2c94c" stroke="#000" strokeWidth={0.4} />
        <circle cx={(ALLY.x + 0.5) * cell} cy={(ALLY.y + 0.5) * cell} r={cell * 0.35} fill="#d9772b" stroke="#000" strokeWidth={0.4} />
      </svg>
      <figcaption className="muted">
        Gelb: Laternenträger · Orange: anderer Ally · hell: Lichtkegel · mittel: Eigensicht · dunkel: Nebel
      </figcaption>
    </figure>
  );
}
