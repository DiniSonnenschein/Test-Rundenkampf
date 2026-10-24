// Farbrad: Farbton rundherum, Sättigung nach außen, Helligkeit über den Regler darunter.
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { hexToRgb, hsvToHex, rgbToHsv, type Hsv } from './color';

const SIZE = 220;
const SWATCHES = ['#d9772b', '#b5432b', '#e0a83a', '#7d8a3a', '#6b4226', '#3b6e8f', '#7a4f9a', '#e8e0d0'];

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
    const dpr = 2;
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
          width={SIZE * 2}
          height={SIZE * 2}
          style={{ width: SIZE, height: SIZE, touchAction: 'none' }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pick(e);
          }}
          onPointerMove={pick}
        />
        <span className="color-wheel-marker" style={{ left: markerX, top: markerY, background: value }} />
      </div>

      <label className="field-label">Helligkeit</label>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(hsv.v * 100)}
        onChange={(e) => update({ ...hsv, v: Number(e.target.value) / 100 })}
        className="slider"
        style={{ background: `linear-gradient(90deg, #000, ${hsvToHex({ ...hsv, v: 1 })})` }}
      />

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
      <div className="swatches">
        {SWATCHES.map((c) => (
          <button key={c} className="swatch" style={{ background: c }} aria-label={c} onClick={() => update(rgbToHsv(hexToRgb(c)!))} />
        ))}
      </div>
    </div>
  );
}
