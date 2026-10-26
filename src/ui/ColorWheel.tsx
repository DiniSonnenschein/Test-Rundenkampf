// Farbrad: Farbton rundherum, Sättigung nach außen, Helligkeit über den Regler darunter.
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { hexToRgb, hsvToHex, rgbToHsv, type Hsv } from './color';

const SIZE = 220;
/** Schnellwahl: je Farbton ein heller, ein mittlerer und ein dunkler Ton, dazu Graustufen. */
const SWATCHES = [
  ['#ffffff', '#f6d9b8', '#f4b6a8', '#fbe8a6', '#d5e8b0', '#b8e0d2', '#b9d6f2', '#d8c4ec'],
  ['#9a9a9a', '#d9772b', '#b5432b', '#e0a83a', '#7d8a3a', '#3f9a7c', '#3b6e8f', '#7a4f9a'],
  ['#000000', '#6b4226', '#5e2018', '#7a5a14', '#3d4a1c', '#1d4d3e', '#1c3448', '#3a2650'],
];

/** Eigener Schieberegler (ohne Eingabefeld – nimmt keinen Fokus, springt auf dem Handy nicht ins nächste Feld). */
function Slider({ value, onChange, background, label }: { value: number; onChange: (v: number) => void; background: string; label: string }) {
  function pick(e: PointerEvent<HTMLDivElement>) {
    if (e.type === 'pointermove' && e.buttons === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    onChange(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  }
  return (
    <div
      className="slider"
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      style={{ background, touchAction: 'none' }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e);
      }}
      onPointerMove={pick}
    >
      <span className="slider-thumb" style={{ left: `${value * 100}%` }} />
    </div>
  );
}

export function ColorWheel({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(hexToRgb(value) ?? [0, 0, 0]));
  const [hexText, setHexText] = useState(value);

  // Von außen geänderte Farbe übernehmen, ohne Farbton bei Grau/Schwarz zu verlieren.
  useEffect(() => {
    if (hsvToHex(hsv) !== value.toLowerCase()) {
      const rgb = hexToRgb(value);
      if (rgb) setHsv(rgbToHsv(rgb));
    }
    setHexText(value);
  }, [value]);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const dpr = 1;
    const px = SIZE * dpr;
    const img = ctx.createImageData(px, px);
    const r = px / 2;
    for (let y = 0; y < px; y++) {
      for (let x = 0; x < px; x++) {
        const dx = x - r, dy = y - r;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > r) continue;
        const h = (Math.atan2(dy, dx) * 180) / Math.PI + 360;
        const rgb = hexToRgb(hsvToHex({ h: h % 360, s: dist / r, v: hsv.v }))!;
        const i = (y * px + x) * 4;
        img.data.set([rgb[0], rgb[1], rgb[2], 255], i);
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [hsv.v]);

  function update(next: Hsv) {
    setHsv(next);
    onChange(hsvToHex(next));
  }

  function pick(e: PointerEvent<HTMLCanvasElement>) {
    if (e.type === 'pointermove' && e.buttons === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - rect.left - rect.width / 2;
    const dy = e.clientY - rect.top - rect.height / 2;
    const s = Math.min(1, Math.sqrt(dx * dx + dy * dy) / (rect.width / 2));
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    update({ ...hsv, h, s });
  }

  const angle = (hsv.h * Math.PI) / 180;
  const markerX = SIZE / 2 + Math.cos(angle) * hsv.s * (SIZE / 2);
  const markerY = SIZE / 2 + Math.sin(angle) * hsv.s * (SIZE / 2);

  return (
    <div className="color-wheel">
      <div className="color-wheel-disc" style={{ width: SIZE, height: SIZE }}>
        <canvas
          ref={canvas}
          width={SIZE}
          height={SIZE}
          style={{ width: SIZE, height: SIZE, touchAction: 'none' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pick(e);
          }}
          onPointerMove={pick}
        />
        <span className="color-wheel-marker" style={{ left: markerX, top: markerY, background: value }} />
      </div>

      <span className="field-label">Helligkeit</span>
      <Slider label="Helligkeit" value={hsv.v} onChange={(v) => update({ ...hsv, v })} background={`linear-gradient(90deg, #000, ${hsvToHex({ ...hsv, v: 1 })})`} />
      <span className="field-label">Farbstärke</span>
      <Slider label="Farbstärke" value={hsv.s} onChange={(s) => update({ ...hsv, s })} background={`linear-gradient(90deg, ${hsvToHex({ ...hsv, s: 0 })}, ${hsvToHex({ ...hsv, s: 1 })})`} />

      <div className="color-row">
        <span className="color-preview" style={{ background: value }} />
        <input
          className="input input-small"
          value={hexText}
          maxLength={7}
          onChange={(e) => {
            setHexText(e.target.value);
            const rgb = hexToRgb(e.target.value);
            if (rgb) update(rgbToHsv(rgb));
          }}
        />
      </div>
      {SWATCHES.map((row, i) => (
        <div key={i} className="swatches">
          {row.map((c) => (
            <button key={c} className="swatch" style={{ background: c }} aria-label={c} onClick={() => update(rgbToHsv(hexToRgb(c)!))} />
          ))}
        </div>
      ))}
    </div>
  );
}
