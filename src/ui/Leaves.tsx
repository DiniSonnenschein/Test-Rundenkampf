import { useMemo } from 'react';

const COLORS = ['var(--accent)', 'var(--red)', 'var(--gold)', 'var(--olive)'];
const LEAF_PATH =
  'M0-10 L2-5 L5-7 L4-3 L9-4 L6 0 L9 2 L4 3 L4 6 L1 4 L.5 9 L-.5 9 L-1 4 L-4 6 L-4 3 L-9 2 L-6 0 L-9-4 L-4-3 L-5-7 L-2-5 Z';

/** Ein paar langsam fallende, bunte Blätter als Hintergrund-Deko. */
export function Leaves({ count = 7 }: { count?: number }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 95,
        size: 16 + Math.random() * 16,
        duration: 14 + Math.random() * 12,
        delay: -Math.random() * 26,
        color: COLORS[i % COLORS.length],
      })),
    [count],
  );

  return (
    <div className="leaves" aria-hidden="true">
      {leaves.map((l, i) => (
        <svg
          key={i}
          className="leaf"
          viewBox="-10 -10 20 20"
          width={l.size}
          height={l.size}
          style={{ left: `${l.left}%`, animationDuration: `${l.duration}s`, animationDelay: `${l.delay}s` }}
        >
          <path d={LEAF_PATH} fill={l.color} />
        </svg>
      ))}
    </div>
  );
}
