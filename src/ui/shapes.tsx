// Vorläufige Formen-Bibliothek für die Darstellung im Spiel. Wird später erweitert.
import type { ReactElement } from 'react';

function polygon(corners: number, radius = 44, rotation = -90, inner?: number): string {
  const pts: string[] = [];
  const steps = inner ? corners * 2 : corners;
  for (let i = 0; i < steps; i++) {
    const r = inner && i % 2 ? inner : radius;
    const a = ((rotation + (360 / steps) * i) * Math.PI) / 180;
    pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
}

export interface ShapeDef {
  key: string;
  label: string;
  render: (fill: string) => ReactElement;
}

const stroke = { stroke: 'rgba(0,0,0,.45)', strokeWidth: 3, strokeLinejoin: 'round' as const };

export const SHAPES: ShapeDef[] = [
  { key: 'kreis', label: 'Kreis', render: (f) => <circle r={42} fill={f} {...stroke} /> },
  { key: 'quadrat', label: 'Quadrat', render: (f) => <rect x={-38} y={-38} width={76} height={76} rx={6} fill={f} {...stroke} /> },
  { key: 'dreieck', label: 'Dreieck', render: (f) => <polygon points={polygon(3, 46, -90)} transform="translate(0 8)" fill={f} {...stroke} /> },
  { key: 'raute', label: 'Raute', render: (f) => <polygon points={polygon(4, 46, -90)} fill={f} {...stroke} /> },
  { key: 'fuenfeck', label: 'Fünfeck', render: (f) => <polygon points={polygon(5)} fill={f} {...stroke} /> },
  { key: 'sechseck', label: 'Sechseck', render: (f) => <polygon points={polygon(6, 44, 0)} fill={f} {...stroke} /> },
  { key: 'stern', label: 'Stern', render: (f) => <polygon points={polygon(5, 46, -90, 20)} fill={f} {...stroke} /> },
  {
    key: 'kreuz',
    label: 'Kreuz',
    render: (f) => (
      <polygon points="-14,-42 14,-42 14,-14 42,-14 42,14 14,14 14,42 -14,42 -14,14 -42,14 -42,-14 -14,-14" fill={f} {...stroke} />
    ),
  },
];

export function ShapeIcon({ shape, color, size = 32 }: { shape: string; color: string; size?: number }) {
  const def = SHAPES.find((s) => s.key === shape) ?? SHAPES[0];
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} aria-label={def.label} role="img">
      {def.render(color)}
    </svg>
  );
}
