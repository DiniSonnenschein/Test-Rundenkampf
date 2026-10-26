// Darstellung eines Levels als SVG (Vorschau und Editor).
import type { Ref } from 'react';
import { tileSize } from '../../engine/characters';
import type { Pos } from '../../engine/grid';
import { checker, isVictory, isVoid, terrainAt, type LevelFields } from '../../engine/level';
import { normalizeObject } from '../../engine/objects';
import { tileColor } from '../../engine/terrain';
import { ShapeInSvg } from '../../ui/shapes';
import type { LevelLookups } from './useTemplates';

/** Kleines Dreieck am Rand des Feldes für die Blickrichtung. */
const ARROW: Record<string, string> = {
  n: '0.5,0.04 0.62,0.18 0.38,0.18',
  s: '0.5,0.96 0.62,0.82 0.38,0.82',
  o: '0.96,0.5 0.82,0.38 0.82,0.62',
  w: '0.04,0.5 0.18,0.38 0.18,0.62',
};

export function MapView({
  level: l, lookups, viewBox, svgRef, selectedId, rect, className,
}: {
  level: LevelFields;
  lookups: LevelLookups;
  viewBox?: string;
  svgRef?: Ref<SVGSVGElement>;
  selectedId?: string | null;
  rect?: { a: Pos; b: Pos } | null;
  className?: string;
}) {
  const tiles = [];
  for (let y = 0; y < l.height; y++) {
    for (let x = 0; x < l.width; x++) {
      const p = { x, y };
      if (isVoid(l, p)) continue;
      const tid = terrainAt(l, p);
      const t = lookups.terrain(tid);
      const isLantern = !!l.lanternStart && l.lanternStart.x === x && l.lanternStart.y === y;
      const fill = isLantern
        ? l.colors.lantern
        : isVictory(l, p)
          ? checker(l.colors.victory, p)
          : tid === l.baseTerrainId || !t
            ? checker(l.colors.standard, p)
            : tileColor(t, p);
      tiles.push(
        <g key={`${x},${y}`}>
          <rect x={x} y={y} width={1.01} height={1.01} fill={fill} />
          {t?.pattern.on && !isLantern && <ShapeInSvg shape={t.pattern.shape} color="rgba(255,255,255,.3)" x={x + 0.2} y={y + 0.2} size={0.6} />}
          {isLantern && <ShapeInSvg shape="laterne" color="#f2c94c" x={x + 0.15} y={y + 0.15} size={0.7} />}
        </g>,
      );
    }
  }

  const selectedEnemy = l.enemies.find((e) => e.id === selectedId);

  return (
    <svg ref={svgRef} className={className} viewBox={viewBox ?? `0 0 ${l.width} ${l.height}`} style={{ background: l.colors.background, touchAction: 'none' }}>
      {tiles}
      {l.objects.map((o) => {
        const entry = lookups.object(o.objectId);
        const hidden = o.hidden ?? (entry ? normalizeObject(entry).hidden : false);
        const w = tileSize(entry?.size);
        const h = tileSize(entry?.height ?? entry?.size);
        return (
          <g key={o.id}>
            <ShapeInSvg shape={String(entry?.shape ?? 'kreis')} color={String(entry?.color ?? '#888')} x={o.pos.x + 0.1} y={o.pos.y + 0.1} size={w - 0.2} height={h - 0.2} opacity={hidden ? 0.45 : 1} />
            {hidden && <rect x={o.pos.x + 0.06} y={o.pos.y + 0.06} width={w - 0.12} height={h - 0.12} fill="none" stroke="#fff" strokeWidth={0.04} strokeDasharray="0.1 0.08" />}
            {o.id === selectedId && <rect x={o.pos.x} y={o.pos.y} width={w} height={h} fill="none" stroke="#fff" strokeWidth={0.08} />}
          </g>
        );
      })}
      {l.enemies.map((e) => {
        const entry = lookups.enemy(e.enemyId);
        const w = tileSize(entry?.size);
        const h = tileSize(entry?.height ?? entry?.size);
        return (
          <g key={e.id}>
            <ShapeInSvg shape={String(entry?.shape ?? 'kreis')} color={String(entry?.color ?? '#888')} x={e.pos.x + 0.08} y={e.pos.y + 0.08} size={w - 0.16} height={h - 0.16} />
            <polygon points={ARROW[e.facing]} transform={`translate(${e.pos.x} ${e.pos.y}) scale(${w} ${h})`} fill="#fff" stroke="#000" strokeWidth={0.02} />
            {e.id === selectedId && <rect x={e.pos.x} y={e.pos.y} width={w} height={h} fill="none" stroke="#fff" strokeWidth={0.08} />}
          </g>
        );
      })}
      {selectedEnemy && selectedEnemy.patrol.points.length > 0 && (
        <g pointerEvents="none">
          <polyline
            points={[selectedEnemy.pos, ...selectedEnemy.patrol.points, ...(selectedEnemy.patrol.mode === 'rundweg' ? [selectedEnemy.pos] : [])]
              .map((p) => `${p.x + 0.5},${p.y + 0.5}`)
              .join(' ')}
            fill="none"
            stroke="#f2c94c"
            strokeWidth={0.08}
            strokeDasharray="0.2 0.12"
          />
          {selectedEnemy.patrol.points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x + 0.5} cy={p.y + 0.5} r={0.22} fill="#f2c94c" />
              <text x={p.x + 0.5} y={p.y + 0.58} fontSize={0.26} textAnchor="middle" fill="#1f1410">{i + 1}</text>
            </g>
          ))}
        </g>
      )}
      {rect && (
        <rect
          x={Math.min(rect.a.x, rect.b.x)}
          y={Math.min(rect.a.y, rect.b.y)}
          width={Math.abs(rect.a.x - rect.b.x) + 1}
          height={Math.abs(rect.a.y - rect.b.y) + 1}
          fill="rgba(255,255,255,.2)"
          stroke="#fff"
          strokeWidth={0.06}
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
