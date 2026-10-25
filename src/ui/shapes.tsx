// Formen-Bibliothek für die Darstellung im Spiel: einfache Vektor-Zeichnungen in Kategorien.
// Jede Form wird in der gewählten Farbe gefüllt; dunkle/helle Details sind halbtransparent.
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
  category: string;
  render: (fill: string) => ReactElement;
}

const S = { stroke: 'rgba(0,0,0,.5)', strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const D = 'rgba(0,0,0,.4)';
const L = 'rgba(255,255,255,.6)';
const line = (f: string, w = 6) => ({ stroke: f, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' });
const outline = (w = 9) => ({ stroke: 'rgba(0,0,0,.5)', strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' });
const eyes = (y = 0, dx = 9, r = 3.5) => (
  <>
    <circle cx={-dx} cy={y} r={r} fill={D} />
    <circle cx={dx} cy={y} r={r} fill={D} />
  </>
);
/** Linie mit dunklem Rand (für Stäbe, Bögen usw.). */
const stroked = (d: string, f: string, w = 6) => (
  <>
    <path d={d} {...outline(w + 4)} />
    <path d={d} {...line(f, w)} />
  </>
);

type Def = [key: string, label: string, render: (f: string) => ReactElement];

const GRUNDFORMEN: Def[] = [
  ['kreis', 'Kreis', (f) => <circle r={42} fill={f} {...S} />],
  ['quadrat', 'Quadrat', (f) => <rect x={-38} y={-38} width={76} height={76} rx={6} fill={f} {...S} />],
  ['dreieck', 'Dreieck', (f) => <polygon points={polygon(3, 46, -90)} transform="translate(0 8)" fill={f} {...S} />],
  ['raute', 'Raute', (f) => <polygon points={polygon(4, 46, -90)} fill={f} {...S} />],
  ['fuenfeck', 'Fünfeck', (f) => <polygon points={polygon(5)} fill={f} {...S} />],
  ['sechseck', 'Sechseck', (f) => <polygon points={polygon(6, 44, 0)} fill={f} {...S} />],
  ['stern', 'Stern', (f) => <polygon points={polygon(5, 46, -90, 20)} fill={f} {...S} />],
  ['kreuz', 'Kreuz', (f) => <polygon points="-14,-42 14,-42 14,-14 42,-14 42,14 14,14 14,42 -14,42 -14,14 -42,14 -42,-14 -14,-14" fill={f} {...S} />],
];

const FANTASY: Def[] = [
  ['goblin', 'Goblin-Kopf', (f) => (
    <g>
      <polygon points="-18,-6 -48,-24 -20,10" fill={f} {...S} />
      <polygon points="18,-6 48,-24 20,10" fill={f} {...S} />
      <ellipse cx={0} cy={6} rx={24} ry={28} fill={f} {...S} />
      {eyes(0, 9, 4)}
      <path d="M -9 18 Q 0 24 9 18" {...line(D, 3)} />
    </g>
  )],
  ['ork', 'Ork-Kopf', (f) => (
    <g>
      <rect x={-30} y={-28} width={60} height={60} rx={20} fill={f} {...S} />
      <path d="M -20 -10 L -4 -5 M 20 -10 L 4 -5" {...line(D, 4)} />
      {eyes(2, 11, 4)}
      <polygon points="-14,26 -10,10 -6,26" fill={L} />
      <polygon points="14,26 10,10 6,26" fill={L} />
    </g>
  )],
  ['elf', 'Elf-Kopf', (f) => (
    <g>
      <polygon points="-16,0 -44,-34 -14,12" fill={f} {...S} />
      <polygon points="16,0 44,-34 14,12" fill={f} {...S} />
      <ellipse cx={0} cy={6} rx={20} ry={30} fill={f} {...S} />
      <path d="M -20 -10 Q 0 -32 20 -10 Q 0 -18 -20 -10 Z" fill={D} />
      {eyes(4, 8, 3)}
    </g>
  )],
  ['vampir', 'Vampir-Kopf', (f) => (
    <g>
      <polygon points="-42,40 -30,-6 -12,30" fill={f} {...S} />
      <polygon points="42,40 30,-6 12,30" fill={f} {...S} />
      <ellipse cx={0} cy={2} rx={22} ry={30} fill={f} {...S} />
      <path d="M -22 -6 Q -20 -30 0 -30 Q 20 -30 22 -6 Q 10 -16 0 -6 Q -10 -16 -22 -6 Z" fill={D} />
      {eyes(4, 8, 3)}
      <polygon points="-6,18 -3,26 0,18" fill={L} />
      <polygon points="6,18 3,26 0,18" fill={L} />
    </g>
  )],
  ['naga', 'Naga', (f) => (
    <g>
      {stroked('M -30 40 Q 25 34 10 16 Q -10 0 4 -14', f, 14)}
      <ellipse cx={4} cy={-26} rx={14} ry={16} fill={f} {...S} />
      <path d="M -8 -34 Q 4 -50 16 -34" {...line(D, 4)} />
      {eyes(-26, 5, 2.5)}
    </g>
  )],
  ['krone', 'Krone', (f) => (
    <g>
      <polygon points="-40,26 -40,-18 -20,4 0,-28 20,4 40,-18 40,26" fill={f} {...S} />
      <rect x={-40} y={14} width={80} height={12} fill={D} />
      <circle cx={0} cy={20} r={4} fill={L} />
      <circle cx={-22} cy={20} r={3} fill={L} />
      <circle cx={22} cy={20} r={3} fill={L} />
    </g>
  )],
  ['diadem', 'Diadem', (f) => (
    <g>
      <path d="M -42 22 Q 0 -8 42 22 L 42 30 Q 0 4 -42 30 Z" fill={f} {...S} />
      <polygon points="0,-30 12,-12 0,6 -12,-12" fill={f} {...S} />
      <polygon points="0,-22 6,-12 0,-2 -6,-12" fill={L} />
    </g>
  )],
  ['geist', 'Geist', (f) => (
    <g>
      <path d="M -28 38 L -28 -6 A 28 28 0 0 1 28 -6 L 28 38 L 18 30 L 9 38 L 0 30 L -9 38 L -18 30 Z" fill={f} {...S} />
      <ellipse cx={-10} cy={-6} rx={5} ry={8} fill={D} />
      <ellipse cx={10} cy={-6} rx={5} ry={8} fill={D} />
    </g>
  )],
  ['spirit', 'Spirit', (f) => (
    <g>
      <path d="M 0 -44 C 18 -24 32 -4 24 18 A 25 25 0 0 1 -24 18 C -32 -2 -12 -14 0 -44 Z" fill={f} {...S} />
      <path d="M 0 -6 C 8 4 12 12 8 22 A 9 9 0 0 1 -8 22 C -12 12 -6 6 0 -6 Z" fill={L} />
      {eyes(12, 8, 3)}
    </g>
  )],
  ['engel', 'Engel', (f) => (
    <g>
      <ellipse cx={-26} cy={6} rx={18} ry={26} fill={f} {...S} transform="rotate(-20 -26 6)" />
      <ellipse cx={26} cy={6} rx={18} ry={26} fill={f} {...S} transform="rotate(20 26 6)" />
      <polygon points="0,0 22,42 -22,42" fill={f} {...S} />
      <circle cx={0} cy={-12} r={13} fill={f} {...S} />
      <ellipse cx={0} cy={-34} rx={14} ry={5} {...line(f, 4)} />
    </g>
  )],
];

const TIERE: Def[] = [
  ['baer', 'Bär', (f) => (
    <g>
      <circle cx={-24} cy={-24} r={12} fill={f} {...S} />
      <circle cx={24} cy={-24} r={12} fill={f} {...S} />
      <circle cx={0} cy={4} r={32} fill={f} {...S} />
      <ellipse cx={0} cy={16} rx={13} ry={10} fill={L} />
      <ellipse cx={0} cy={11} rx={5} ry={4} fill={D} />
      {eyes(-4, 12, 4)}
    </g>
  )],
  ['drache', 'Drache', (f) => (
    <g>
      <path d="M -42 14 L -12 -8 L -8 -38 L 4 -12 L 24 -30 L 20 -6 L 44 6 L 22 20 L 30 30 L -42 28 Z" fill={f} {...S} />
      <circle cx={8} cy={2} r={4} fill={D} />
      <path d="M 30 12 L 40 12" {...line(D, 3)} />
    </g>
  )],
  ['salamander', 'Salamander', (f) => (
    <g>
      {stroked('M 0 18 Q 4 34 20 40', f, 7)}
      <path d="M -14 -14 L -26 -24 M 14 -14 L 26 -24 M -14 8 L -26 18 M 14 8 L 26 18" {...outline(10)} />
      <path d="M -14 -14 L -26 -24 M 14 -14 L 26 -24 M -14 8 L -26 18 M 14 8 L 26 18" {...line(f, 6)} />
      <ellipse cx={0} cy={0} rx={11} ry={24} fill={f} {...S} />
      <circle cx={0} cy={-30} r={10} fill={f} {...S} />
      {eyes(-32, 5, 2.5)}
    </g>
  )],
  ['schlange', 'Schlange', (f) => (
    <g>
      {stroked('M -36 38 C -36 12 22 22 16 2 S -26 -14 8 -28', f, 12)}
      <ellipse cx={14} cy={-30} rx={13} ry={9} fill={f} {...S} />
      <circle cx={18} cy={-32} r={2.5} fill={D} />
      <path d="M 27 -30 L 36 -30 M 33 -30 L 38 -34" {...line(D, 2)} />
    </g>
  )],
  ['wolf', 'Wolf', (f) => (
    <g>
      <path d="M -32 -38 L -14 -12 L 14 -12 L 32 -38 L 34 4 L 0 40 L -34 4 Z" fill={f} {...S} />
      {eyes(-2, 12, 4)}
      <ellipse cx={0} cy={28} rx={6} ry={4} fill={D} />
    </g>
  )],
  ['ratte', 'Ratte', (f) => (
    <g>
      {stroked('M 34 18 Q 50 30 40 44', f, 4)}
      <ellipse cx={8} cy={12} rx={30} ry={20} fill={f} {...S} />
      <path d="M -16 0 L -44 14 L -16 26 Z" fill={f} {...S} />
      <circle cx={-10} cy={-8} r={11} fill={f} {...S} />
      <circle cx={-10} cy={-8} r={5} fill={D} />
      <circle cx={-28} cy={10} r={2.5} fill={D} />
    </g>
  )],
  ['fuchs', 'Fuchs', (f) => (
    <g>
      <path d="M -36 -38 L -12 -12 L 12 -12 L 36 -38 L 30 6 L 0 40 L -30 6 Z" fill={f} {...S} />
      <path d="M -30 6 L 0 40 L -6 14 Z" fill={L} />
      <path d="M 30 6 L 0 40 L 6 14 Z" fill={L} />
      {eyes(-2, 12, 3.5)}
      <circle cx={0} cy={34} r={4} fill={D} />
    </g>
  )],
  ['eichhoernchen', 'Eichhörnchen', (f) => (
    <g>
      <path d="M 8 36 C 46 32 46 -38 14 -42 C -2 -44 -2 -26 12 -22 C 26 -16 26 14 8 20 Z" fill={f} {...S} />
      <ellipse cx={-10} cy={16} rx={15} ry={22} fill={f} {...S} />
      <circle cx={-14} cy={-14} r={12} fill={f} {...S} />
      <polygon points="-18,-24 -14,-38 -8,-24" fill={f} {...S} />
      <circle cx={-18} cy={-14} r={2.5} fill={D} />
    </g>
  )],
  ['hirsch', 'Hirsch', (f) => (
    <g>
      {stroked('M -8 -8 L -20 -30 L -18 -44 M -20 -30 L -34 -36 M -14 -18 L -30 -18', f, 5)}
      {stroked('M 8 -8 L 20 -30 L 18 -44 M 20 -30 L 34 -36 M 14 -18 L 30 -18', f, 5)}
      <ellipse cx={-18} cy={-2} rx={9} ry={5} fill={f} {...S} transform="rotate(-25 -18 -2)" />
      <ellipse cx={18} cy={-2} rx={9} ry={5} fill={f} {...S} transform="rotate(25 18 -2)" />
      <ellipse cx={0} cy={16} rx={14} ry={24} fill={f} {...S} />
      {eyes(8, 6, 2.5)}
      <ellipse cx={0} cy={34} rx={5} ry={3.5} fill={D} />
    </g>
  )],
  ['schwein', 'Schwein', (f) => (
    <g>
      <polygon points="-30,-14 -26,-38 -10,-24" fill={f} {...S} />
      <polygon points="30,-14 26,-38 10,-24" fill={f} {...S} />
      <circle cx={0} cy={4} r={32} fill={f} {...S} />
      <ellipse cx={0} cy={14} rx={14} ry={10} fill={L} {...S} />
      <circle cx={-5} cy={14} r={3} fill={D} />
      <circle cx={5} cy={14} r={3} fill={D} />
      {eyes(-8, 13, 3.5)}
    </g>
  )],
  ['wildschwein', 'Wildschwein', (f) => (
    <g>
      <path d="M -24 -22 L -18 -34 L -10 -24 L -4 -36 L 2 -24 L 8 -36 L 14 -24 L 20 -34 L 24 -22 Z" fill={f} {...S} />
      <ellipse cx={0} cy={4} rx={32} ry={28} fill={f} {...S} />
      <ellipse cx={0} cy={18} rx={13} ry={9} fill={D} />
      <path d="M -12 22 Q -22 18 -20 8 M 12 22 Q 22 18 20 8" {...line(L, 4)} />
      {eyes(-6, 13, 3.5)}
    </g>
  )],
  ['hase', 'Hase', (f) => (
    <g>
      <ellipse cx={-12} cy={-26} rx={8} ry={20} fill={f} {...S} />
      <ellipse cx={12} cy={-26} rx={8} ry={20} fill={f} {...S} />
      <circle cx={0} cy={14} r={24} fill={f} {...S} />
      {eyes(8, 9, 3)}
      <path d="M -4 20 L 0 24 L 4 20" {...line(D, 3)} />
    </g>
  )],
  ['eule', 'Eule', (f) => (
    <g>
      <polygon points="-28,-24 -24,-42 -10,-30" fill={f} {...S} />
      <polygon points="28,-24 24,-42 10,-30" fill={f} {...S} />
      <ellipse cx={0} cy={4} rx={30} ry={38} fill={f} {...S} />
      <circle cx={-12} cy={-10} r={10} fill={L} />
      <circle cx={12} cy={-10} r={10} fill={L} />
      <circle cx={-12} cy={-10} r={4.5} fill={D} />
      <circle cx={12} cy={-10} r={4.5} fill={D} />
      <polygon points="-5,2 5,2 0,12" fill={D} />
    </g>
  )],
];

const PFLANZEN: Def[] = [
  ['apfel', 'Apfel', (f) => (
    <g>
      {stroked('M 0 -18 Q 2 -32 8 -38', f, 4)}
      <ellipse cx={14} cy={-32} rx={10} ry={5} fill={f} {...S} transform="rotate(-25 14 -32)" />
      <path d="M 0 -16 C -16 -30 -40 -16 -36 8 C -32 30 -14 42 0 34 C 14 42 32 30 36 8 C 40 -16 16 -30 0 -16 Z" fill={f} {...S} />
      <ellipse cx={-18} cy={-2} rx={5} ry={9} fill={L} />
    </g>
  )],
  ['karotte', 'Karotte', (f) => (
    <g>
      <ellipse cx={-8} cy={-32} rx={5} ry={12} fill={f} {...S} transform="rotate(-25 -8 -32)" />
      <ellipse cx={8} cy={-32} rx={5} ry={12} fill={f} {...S} transform="rotate(25 8 -32)" />
      <ellipse cx={0} cy={-34} rx={5} ry={12} fill={f} {...S} />
      <path d="M -16 -20 L 16 -20 L 0 46 Z" fill={f} {...S} />
      <path d="M -10 -6 L 2 -6 M 4 8 L -6 8 M -4 22 L 4 22" {...line(D, 3)} />
    </g>
  )],
  ['kuerbis', 'Kürbis', (f) => (
    <g>
      {stroked('M 0 -24 Q 2 -36 10 -40', f, 6)}
      <ellipse cx={-18} cy={8} rx={20} ry={30} fill={f} {...S} />
      <ellipse cx={18} cy={8} rx={20} ry={30} fill={f} {...S} />
      <ellipse cx={0} cy={8} rx={18} ry={32} fill={f} {...S} />
    </g>
  )],
  ['pilz', 'Pilz', (f) => (
    <g>
      <rect x={-11} y={0} width={22} height={38} rx={8} fill={L} {...S} />
      <path d="M -42 6 C -42 -46 42 -46 42 6 Z" fill={f} {...S} />
      <circle cx={-16} cy={-14} r={6} fill={L} />
      <circle cx={10} cy={-22} r={5} fill={L} />
      <circle cx={22} cy={-6} r={4} fill={L} />
    </g>
  )],
  ['gras', 'Gras', (f) => (
    <g>
      <path d="M -36 40 Q -34 0 -42 -26 Q -24 4 -20 40 Z" fill={f} {...S} />
      <path d="M -18 40 Q -14 -10 -8 -42 Q 2 -4 2 40 Z" fill={f} {...S} />
      <path d="M 4 40 Q 12 -4 28 -32 Q 22 6 22 40 Z" fill={f} {...S} />
      <path d="M 20 40 Q 30 10 44 0 Q 38 20 38 40 Z" fill={f} {...S} />
    </g>
  )],
  ['kraut', 'Kraut', (f) => (
    <g>
      {stroked('M 0 44 L 0 -36', f, 5)}
      {[-26, -6, 14].map((y, i) => (
        <g key={i}>
          <ellipse cx={-14} cy={y} rx={14} ry={7} fill={f} {...S} transform={`rotate(-30 -14 ${y})`} />
          <ellipse cx={14} cy={y + 8} rx={14} ry={7} fill={f} {...S} transform={`rotate(30 14 ${y + 8})`} />
        </g>
      ))}
    </g>
  )],
  ['blume', 'Blume', (f) => (
    <g>
      {stroked('M 0 10 L 0 46', f, 5)}
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={Math.cos(((a - 90) * Math.PI) / 180) * 18} cy={-10 + Math.sin(((a - 90) * Math.PI) / 180) * 18} r={13} fill={f} {...S} />
      ))}
      <circle cx={0} cy={-10} r={10} fill={D} />
    </g>
  )],
  ['beere', 'Beere', (f) => (
    <g>
      <ellipse cx={4} cy={-34} rx={14} ry={6} fill={f} {...S} transform="rotate(-20 4 -34)" />
      <circle cx={-14} cy={-6} r={15} fill={f} {...S} />
      <circle cx={14} cy={-6} r={15} fill={f} {...S} />
      <circle cx={0} cy={20} r={15} fill={f} {...S} />
      <circle cx={-18} cy={-10} r={4} fill={L} />
      <circle cx={10} cy={-10} r={4} fill={L} />
      <circle cx={-4} cy={16} r={4} fill={L} />
    </g>
  )],
  ['wurzel', 'Wurzel', (f) => (
    <g>
      {stroked('M 0 -30 L 0 40 M 0 0 L -26 30 M 0 10 L 24 34 M 0 -12 L 28 6 M 0 -18 L -30 -2', f, 7)}
      <ellipse cx={0} cy={-34} rx={22} ry={8} fill={f} {...S} />
    </g>
  )],
  ['ruebe', 'Rübe', (f) => (
    <g>
      <ellipse cx={-10} cy={-34} rx={6} ry={13} fill={f} {...S} transform="rotate(-20 -10 -34)" />
      <ellipse cx={10} cy={-34} rx={6} ry={13} fill={f} {...S} transform="rotate(20 10 -34)" />
      <path d="M 0 -22 C -40 -22 -36 22 0 46 C 36 22 40 -22 0 -22 Z" fill={f} {...S} />
      <path d="M -16 0 Q -8 4 -2 0 M 6 14 Q 12 18 18 12" {...line(D, 3)} />
    </g>
  )],
  ['eichel', 'Eichel', (f) => (
    <g>
      <ellipse cx={0} cy={12} rx={22} ry={28} fill={f} {...S} />
      <path d="M -28 -6 C -28 -32 28 -32 28 -6 Z" fill={f} {...S} />
      <path d="M -28 -6 C -28 -32 28 -32 28 -6 Z" fill={D} />
      {stroked('M 0 -26 L 4 -40', f, 5)}
      <ellipse cx={-8} cy={14} rx={4} ry={10} fill={L} />
    </g>
  )],
  ['haselnuss', 'Haselnuss', (f) => (
    <g>
      <path d="M 0 -28 C 28 -20 34 20 0 40 C -34 20 -28 -20 0 -28 Z" fill={f} {...S} />
      <path d="M -26 -14 L -18 -30 L -8 -22 L 0 -38 L 8 -22 L 18 -30 L 26 -14 Q 0 -4 -26 -14 Z" fill={f} {...S} />
      <path d="M -26 -14 L -18 -30 L -8 -22 L 0 -38 L 8 -22 L 18 -30 L 26 -14 Q 0 -4 -26 -14 Z" fill={D} />
      <ellipse cx={-8} cy={12} rx={4} ry={10} fill={L} />
    </g>
  )],
];

const AUSRUESTUNG: Def[] = [
  ['schwert', 'Schwert', (f) => (
    <g>
      <polygon points="-6,-46 0,-52 6,-46 6,16 -6,16" fill={f} {...S} />
      <rect x={-20} y={14} width={40} height={8} rx={3} fill={f} {...S} />
      <rect x={-5} y={22} width={10} height={18} fill={D} />
      <circle cx={0} cy={44} r={6} fill={f} {...S} />
    </g>
  )],
  ['saebel', 'Säbel', (f) => (
    <g>
      <path d="M -16 22 C -10 -10 6 -36 34 -46 C 18 -26 4 -2 0 26 Z" fill={f} {...S} />
      <path d="M -28 18 Q -8 34 10 22" {...outline(11)} />
      <path d="M -28 18 Q -8 34 10 22" {...line(f, 7)} />
      <rect x={-18} y={28} width={10} height={18} rx={3} fill={D} transform="rotate(20 -13 37)" />
    </g>
  )],
  ['schild', 'Schild', (f) => (
    <g>
      <path d="M -32 -38 L 32 -38 L 32 0 C 32 26 0 44 0 44 C 0 44 -32 26 -32 0 Z" fill={f} {...S} />
      <path d="M 0 -30 L 0 32 M -24 -6 L 24 -6" {...line(D, 6)} />
    </g>
  )],
  ['kochtopf', 'Kochtopf', (f) => (
    <g>
      <path d="M -46 -4 L -34 -4 M 34 -4 L 46 -4" {...outline(12)} />
      <path d="M -46 -4 L -34 -4 M 34 -4 L 46 -4" {...line(f, 8)} />
      <path d="M -34 -12 L 34 -12 L 30 34 Q 0 42 -30 34 Z" fill={f} {...S} />
      <ellipse cx={0} cy={-14} rx={36} ry={8} fill={f} {...S} />
      <rect x={-6} y={-28} width={12} height={8} rx={3} fill={f} {...S} />
    </g>
  )],
  ['speer', 'Speer', (f) => (
    <g>
      {stroked('M -38 42 L 22 -18', f, 6)}
      <polygon points="18,-30 44,-44 30,-18" fill={f} {...S} />
    </g>
  )],
  ['bogen', 'Bogen', (f) => (
    <g>
      <path d="M -8 -44 L -8 44" stroke="rgba(0,0,0,.6)" strokeWidth={2} />
      {stroked('M -8 -44 Q 46 0 -8 44', f, 8)}
    </g>
  )],
  ['armbrust', 'Armbrust', (f) => (
    <g>
      <path d="M -40 -6 Q 0 26 40 -6" stroke="rgba(0,0,0,.6)" strokeWidth={2} fill="none" />
      {stroked('M -40 -6 Q 0 -30 40 -6', f, 7)}
      <rect x={-7} y={-26} width={14} height={70} rx={4} fill={f} {...S} />
    </g>
  )],
  ['zauberstab', 'Zauberstab', (f) => (
    <g>
      {stroked('M -34 42 L 16 -12', f, 6)}
      <polygon points={polygon(5, 18, -90, 8)} transform="translate(24 -22)" fill={f} {...S} />
    </g>
  )],
  ['buch', 'Buch', (f) => (
    <g>
      <rect x={-30} y={-40} width={60} height={80} rx={4} fill={f} {...S} />
      <rect x={-30} y={-40} width={10} height={80} fill={D} />
      <rect x={-8} y={-24} width={30} height={10} rx={2} fill={L} />
    </g>
  )],
  ['schriftrolle', 'Schriftrolle', (f) => (
    <g>
      <rect x={-26} y={-32} width={52} height={64} fill={f} {...S} />
      <path d="M -16 -16 L 16 -16 M -16 -4 L 16 -4 M -16 8 L 10 8" {...line(D, 3)} />
      <rect x={-34} y={-42} width={68} height={12} rx={6} fill={f} {...S} />
      <rect x={-34} y={30} width={68} height={12} rx={6} fill={f} {...S} />
    </g>
  )],
  ['geige', 'Geige', (f) => (
    <g>
      <rect x={-4} y={-46} width={8} height={30} fill={D} />
      <path d="M 0 -18 C 20 -18 22 -4 14 2 C 26 10 26 40 0 40 C -26 40 -26 10 -14 2 C -22 -4 -20 -18 0 -18 Z" fill={f} {...S} />
      <path d="M -6 8 Q -2 14 -6 20 M 6 8 Q 2 14 6 20" {...line(D, 3)} />
      <path d="M 0 -16 L 0 34" stroke="rgba(0,0,0,.5)" strokeWidth={1.5} />
    </g>
  )],
  ['ruestung', 'Rüstung', (f) => (
    <g>
      <path d="M -40 -30 L -16 -38 Q 0 -28 16 -38 L 40 -30 L 32 -6 L 26 -10 L 26 38 L -26 38 L -26 -10 L -32 -6 Z" fill={f} {...S} />
      <path d="M 0 -24 L 0 34 M -20 10 L 20 10" {...line(D, 4)} />
    </g>
  )],
  ['trommel', 'Trommel', (f) => (
    <g>
      <path d="M -34 -10 L -34 26 Q 0 42 34 26 L 34 -10" fill={f} {...S} />
      <path d="M -34 -6 L -20 28 L -6 -4 L 8 30 L 22 -2 L 34 24" {...line(D, 3)} />
      <ellipse cx={0} cy={-10} rx={34} ry={12} fill={f} {...S} />
      <ellipse cx={0} cy={-10} rx={26} ry={8} fill={L} />
      {stroked('M -10 -16 L -30 -42 M 10 -16 L 30 -42', f, 4)}
    </g>
  )],
  ['kompass', 'Kompass', (f) => (
    <g>
      <circle r={40} fill={f} {...S} />
      <circle r={30} fill={L} />
      <polygon points="0,-26 8,0 0,26 -8,0" fill={D} />
      <polygon points="0,-26 8,0 -8,0" fill={f} />
      <circle r={4} fill={f} {...S} />
    </g>
  )],
  ['besen', 'Besen', (f) => (
    <g>
      {stroked('M 32 -44 L -2 8', f, 6)}
      <path d="M -6 2 L 8 12 L -14 46 L -42 28 Z" fill={f} {...S} />
      <path d="M -10 16 L -30 34 M -4 22 L -22 42" {...line(D, 3)} />
    </g>
  )],
  ['laterne', 'Laterne', (f) => (
    <g>
      <circle cx={0} cy={-38} r={7} {...line('rgba(0,0,0,.6)', 3)} />
      <polygon points="-18,-30 18,-30 24,-20 -24,-20" fill={f} {...S} />
      <rect x={-18} y={-20} width={36} height={44} fill={L} {...S} />
      <path d="M 0 -12 C 8 -2 8 8 0 14 C -8 8 -8 -2 0 -12 Z" fill={f} />
      <rect x={-22} y={24} width={44} height={10} rx={2} fill={f} {...S} />
    </g>
  )],
  ['zauberhut', 'Zauberhut', (f) => (
    <g>
      <ellipse cx={0} cy={32} rx={44} ry={10} fill={f} {...S} />
      <path d="M -26 30 L 6 -44 L 26 30 Z" fill={f} {...S} />
      <polygon points={polygon(5, 9, -90, 4)} transform="translate(6 4)" fill={L} />
    </g>
  )],
];

const SONSTIGES: Def[] = [
  ['baum', 'Baum', (f) => (
    <g>
      <rect x={-8} y={4} width={16} height={40} fill={f} {...S} />
      <rect x={-8} y={4} width={16} height={40} fill={D} />
      <circle cx={-18} cy={-6} r={20} fill={f} {...S} />
      <circle cx={18} cy={-6} r={20} fill={f} {...S} />
      <circle cx={0} cy={-24} r={22} fill={f} {...S} />
    </g>
  )],
  ['stein', 'Stein', (f) => (
    <g>
      <polygon points="-40,30 -32,-6 -12,-26 16,-24 38,-4 42,30" fill={f} {...S} />
      <path d="M -12 -26 L -4 0 L 16 -24 M -4 0 L 6 30" {...line(D, 3)} />
    </g>
  )],
  ['truhe', 'Truhe', (f) => (
    <g>
      <rect x={-40} y={-6} width={80} height={42} rx={3} fill={f} {...S} />
      <path d="M -40 -6 L -40 -18 Q 0 -44 40 -18 L 40 -6 Z" fill={f} {...S} />
      <path d="M -40 -6 L 40 -6" {...line(D, 4)} />
      <rect x={-7} y={-12} width={14} height={18} rx={2} fill={L} {...S} />
    </g>
  )],
  ['sack', 'Sack', (f) => (
    <g>
      <path d="M -10 -24 C -44 -4 -42 40 0 40 C 42 40 44 -4 10 -24 Z" fill={f} {...S} />
      <path d="M -12 -24 L -18 -40 L 0 -32 L 18 -40 L 12 -24 Z" fill={f} {...S} />
      <path d="M -12 -24 L 12 -24" {...line(D, 5)} />
    </g>
  )],
  ['baumstamm', 'Baumstamm', (f) => (
    <g>
      <rect x={-40} y={-18} width={66} height={36} fill={f} {...S} />
      <path d="M -32 -6 L 10 -6 M -24 8 L 18 8" {...line(D, 3)} />
      <ellipse cx={28} cy={0} rx={14} ry={18} fill={f} {...S} />
      <ellipse cx={28} cy={0} rx={8} ry={11} fill={L} />
      <ellipse cx={28} cy={0} rx={3} ry={5} fill={D} />
    </g>
  )],
  ['gebuesch', 'Gebüsch', (f) => (
    <g>
      <circle cx={-26} cy={14} r={18} fill={f} {...S} />
      <circle cx={26} cy={14} r={18} fill={f} {...S} />
      <circle cx={-10} cy={-4} r={20} fill={f} {...S} />
      <circle cx={14} cy={-6} r={18} fill={f} {...S} />
      <rect x={-42} y={18} width={84} height={18} rx={9} fill={f} />
    </g>
  )],
  ['tanne', 'Tanne', (f) => (
    <g>
      <rect x={-6} y={30} width={12} height={14} fill={D} />
      <polygon points="0,-46 -22,-14 22,-14" fill={f} {...S} />
      <polygon points="0,-26 -30,8 30,8" fill={f} {...S} />
      <polygon points="0,-6 -38,32 38,32" fill={f} {...S} />
    </g>
  )],
  ['feuer', 'Feuer', (f) => (
    <g>
      <path d="M 0 -46 C 10 -26 34 -16 30 12 C 28 34 14 42 0 42 C -14 42 -30 34 -30 14 C -30 -4 -18 -10 -16 -26 C -6 -16 -2 -28 0 -46 Z" fill={f} {...S} />
      <path d="M 2 -6 C 8 6 16 12 14 24 C 12 34 6 38 0 38 C -8 38 -14 32 -12 22 C -10 12 -2 8 2 -6 Z" fill={L} />
    </g>
  )],
  ['brunnen', 'Brunnen', (f) => (
    <g>
      <path d="M -30 -6 L -30 -26 M 30 -6 L 30 -26" {...outline(10)} />
      <path d="M -30 -6 L -30 -26 M 30 -6 L 30 -26" {...line(f, 6)} />
      <polygon points="-40,-24 0,-46 40,-24" fill={f} {...S} />
      <rect x={-36} y={0} width={72} height={36} rx={4} fill={f} {...S} />
      <ellipse cx={0} cy={0} rx={36} ry={8} fill={D} />
      <path d="M -36 18 L 36 18 M -12 0 L -12 18 M 12 18 L 12 36" {...line(D, 3)} />
    </g>
  )],
  ['mauer', 'Mauer', (f) => (
    <g>
      <rect x={-42} y={-34} width={84} height={68} fill={f} {...S} />
      <path d="M -42 -12 L 42 -12 M -42 10 L 42 10 M -14 -34 L -14 -12 M 18 -34 L 18 -12 M -28 -12 L -28 10 M 4 -12 L 4 10 M 30 -12 L 30 10 M -14 10 L -14 34 M 18 10 L 18 34" {...line(D, 3)} />
    </g>
  )],
  ['blatthaufen', 'Blatthaufen', (f) => (
    <g>
      <path d="M -44 34 C -40 -6 40 -6 44 34 Z" fill={f} {...S} />
      {[[-24, 8, -30], [0, -2, 15], [22, 10, 40], [-8, 20, -60], [16, 24, 70]].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={12} ry={6} fill={f} {...S} transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </g>
  )],
  ['schnee', 'Schnee', (f) => (
    <g>
      {[0, 60, 120].map((a) => (
        <g key={a} transform={`rotate(${a})`}>
          <path d="M 0 -42 L 0 42 M -10 -32 L 0 -22 L 10 -32 M -10 32 L 0 22 L 10 32" {...outline(10)} />
          <path d="M 0 -42 L 0 42 M -10 -32 L 0 -22 L 10 -32 M -10 32 L 0 22 L 10 32" {...line(f, 6)} />
        </g>
      ))}
    </g>
  )],
  ['blitz', 'Blitz', (f) => <polygon points="8,-46 -24,6 -2,6 -10,46 24,-8 2,-8" fill={f} {...S} />],
  ['wolke', 'Wolke', (f) => (
    <g>
      <circle cx={-20} cy={6} r={18} fill={f} {...S} />
      <circle cx={22} cy={8} r={16} fill={f} {...S} />
      <circle cx={0} cy={-8} r={22} fill={f} {...S} />
      <rect x={-34} y={6} width={66} height={18} rx={9} fill={f} />
      <path d="M -34 24 L 32 24" stroke="rgba(0,0,0,.5)" strokeWidth={3} strokeLinecap="round" />
    </g>
  )],
];

export const SHAPE_CATEGORIES: { name: string; shapes: ShapeDef[] }[] = (
  [
    ['Grundformen', GRUNDFORMEN],
    ['Fantasy', FANTASY],
    ['Tiere', TIERE],
    ['Pflanzen', PFLANZEN],
    ['Ausrüstung', AUSRUESTUNG],
    ['Sonstiges', SONSTIGES],
  ] as [string, Def[]][]
).map(([name, defs]) => ({ name, shapes: defs.map(([key, label, render]) => ({ key, label, category: name, render })) }));

export const SHAPES: ShapeDef[] = SHAPE_CATEGORIES.flatMap((c) => c.shapes);

export function ShapeIcon({ shape, color, size = 32 }: { shape: string; color: string; size?: number }) {
  const def = SHAPES.find((s) => s.key === shape) ?? SHAPES[0];
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} aria-label={def.label} role="img">
      {def.render(color)}
    </svg>
  );
}

/** Form innerhalb einer anderen SVG-Zeichnung (z. B. auf der Map). */
export function ShapeInSvg({ shape, color, x, y, size, opacity }: { shape: string; color: string; x: number; y: number; size: number; opacity?: number }) {
  const def = SHAPES.find((s) => s.key === shape) ?? SHAPES[0];
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="-50 -50 100 100" opacity={opacity} overflow="visible">
      {def.render(color)}
    </svg>
  );
}

/** Formen-Auswahl nach Kategorien (ohne Beschriftung). */
export function ShapePicker({ value, color, onChange }: { value: string; color: string; onChange: (key: string) => void }) {
  return (
    <div className="shape-picker">
      {SHAPE_CATEGORIES.map((cat) => (
        <div key={cat.name}>
          <span className="shape-category">{cat.name}</span>
          <div className="shape-grid">
            {cat.shapes.map((s) => (
              <button key={s.key} className={`shape-option ${s.key === value ? 'selected' : ''}`} onClick={() => onChange(s.key)} aria-label={s.label} title={s.label}>
                <ShapeIcon shape={s.key} color={color} size={34} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
