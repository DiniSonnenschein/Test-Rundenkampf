// Spielfeld im Spielmodus: Gelände, Nebel, Objekte, Figuren, Effekt-Kreise und Hervorhebungen.
import { unitTiles, type BattleState } from '../../engine/battle';
import type { Defs } from '../../engine/defs';
import { posKey, type Pos } from '../../engine/grid';
import { checker } from '../../engine/level';
import { tileColor } from '../../engine/terrain';
import { ShapeInSvg } from '../../ui/shapes';

const ARROW: Record<string, string> = {
  n: '0.5,0.02 0.64,0.16 0.36,0.16',
  s: '0.5,0.98 0.64,0.84 0.36,0.84',
  o: '0.98,0.5 0.84,0.36 0.84,0.64',
  w: '0.02,0.5 0.16,0.36 0.16,0.64',
};

export interface Highlights {
  range?: Pos[];
  legal?: Pos[];
  chosen?: Pos[];
  path?: Pos[];
  activeId?: string | null;
  selectedId?: string | null;
}

export function GameMap({
  battle: b, defs, levelId, seen, viewBox, h,
}: {
  battle: BattleState;
  defs: Defs;
  levelId: string;
  seen: Set<string>;
  viewBox: string;
  h: Highlights;
}) {
  const level = defs.levels[levelId];
  const explored = new Set(b.explored);
  const tiles = [];
  for (let y = 0; y < b.map.height; y++) {
    for (let x = 0; x < b.map.width; x++) {
      const p = { x, y };
      const k = posKey(p);
      if ((b.map.voids ?? []).includes(k)) continue;
      const known = seen.has(k) || explored.has(k);
      if (!known) {
        tiles.push(<rect key={k} x={x} y={y} width={1.01} height={1.01} fill="#050302" />);
        continue;
      }
      const tid = b.terrain?.[k];
      const t = tid ? defs.terrains[tid] : undefined;
      const isLantern = b.phase === 'platzierung' && b.map.lanternStart.x === x && b.map.lanternStart.y === y;
      const fill = isLantern
        ? level.colors.lantern
        : level.victory.includes(k)
          ? checker(level.colors.victory, p)
          : tid === level.baseTerrainId || !t
            ? checker(level.colors.standard, p)
            : tileColor(t, p);
      tiles.push(
        <g key={k}>
          <rect x={x} y={y} width={1.01} height={1.01} fill={fill} />
          {t?.pattern.on && <ShapeInSvg shape={t.pattern.shape} color="rgba(255,255,255,.3)" x={x + 0.2} y={y + 0.2} size={0.6} />}
          {!seen.has(k) && <rect x={x} y={y} width={1.01} height={1.01} fill="rgba(0,0,0,.55)" />}
        </g>,
      );
    }
  }

  const revealed = new Set(b.revealed ?? []);
  const objects = (b.objects ?? []).filter((o) => seen.has(posKey(o.pos)) && (!o.hidden || revealed.has(o.id)));
  // Allys sind immer sichtbar, Gegner nur auf gesehenen Feldern.
  const units = b.units.filter((u) => u.pos && u.status !== 'entfernt' && (u.side === 'ally' || unitTiles(u).some((t) => seen.has(posKey(t)))));
  const rect = (p: Pos, cls: string) => <rect key={`${cls}-${posKey(p)}`} className={cls} x={p.x + 0.04} y={p.y + 0.04} width={0.92} height={0.92} rx={0.08} />;

  return (
    <svg className="map-svg" viewBox={viewBox} style={{ background: level.colors.background }}>
      {tiles}
      {h.range?.map((p) => rect(p, 'hl-range'))}
      {objects.map((o) => {
        const d = defs.objects[o.objectId];
        return <ShapeInSvg key={o.id} shape={d?.shape ?? 'kreis'} color={d?.color ?? '#888'} x={o.pos.x + 0.12} y={o.pos.y + 0.12} size={0.76} />;
      })}
      {h.path && h.path.length > 0 && (
        <polyline className="hl-path" points={h.path.map((p) => `${p.x + 0.5},${p.y + 0.5}`).join(' ')} />
      )}
      {units.map((u) => {
        const d = u.templateId ? defs.allys[u.templateId] ?? defs.enemies[u.templateId] : undefined;
        const n = u.size ?? 1;
        const p = u.pos!;
        const rings = (u.effects ?? []).map((e) => defs.effects[e.effectId]).filter((e) => e?.display.show);
        const down = u.status === 'bewusstlos';
        return (
          <g key={u.id} opacity={down ? 0.55 : 1}>
            {u.id === h.activeId && <rect className="hl-active" x={p.x} y={p.y} width={n} height={n} rx={0.12} />}
            {rings.map((e, i) => (
              <circle key={i} cx={p.x + n / 2} cy={p.y + n / 2} r={n * 0.47 - i * 0.06} fill="none" stroke={e!.display.color} strokeWidth={0.05} />
            ))}
            <ShapeInSvg shape={d?.shape ?? 'kreis'} color={d?.color ?? '#888'} x={p.x + 0.12 * n} y={p.y + 0.12 * n} size={0.76 * n} />
            <polygon points={ARROW[u.facing ?? 'n']} transform={`translate(${p.x} ${p.y}) scale(${n})`} fill={u.side === 'ally' ? '#fff' : '#ffb4a0'} stroke="#000" strokeWidth={0.02} />
            {u.lantern && <ShapeInSvg shape="laterne" color="#f2c94c" x={p.x + n - 0.38} y={p.y - 0.02} size={0.36} />}
            {u.id === h.selectedId && <rect className="hl-selected" x={p.x} y={p.y} width={n} height={n} rx={0.12} />}
          </g>
        );
      })}
      {h.legal?.map((p) => rect(p, 'hl-legal'))}
      {h.chosen?.map((p) => rect(p, 'hl-chosen'))}
    </svg>
  );
}
