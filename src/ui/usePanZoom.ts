// Zoomen & Verschieben mit zwei Fingern (bzw. Mausrad); ein Finger tippt.
// Tipps werden erst beim Loslassen gemeldet, damit der erste Finger eines Zooms nichts auslöst.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject, type WheelEvent } from 'react';
import type { Pos } from '../engine/grid';

export interface View {
  x: number;
  y: number;
  /** Pixel pro Feld. */
  s: number;
}

export function usePanZoom(container: RefObject<HTMLDivElement | null>, mapSize: { width: number; height: number }, onTap: (tile: Pos) => void) {
  const [size, setSize] = useState({ w: 360, h: 500 });
  const [view, setView] = useState<View | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number }; view: View } | null>(null);
  const tap = useRef<{ x: number; y: number } | null>(null);
  const pan = useRef<{ x: number; y: number; view: View } | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [container]);

  // Anfangs die ganze Map einpassen.
  useEffect(() => {
    if (view || size.w === 0) return;
    const s = Math.min(size.w / mapSize.width, size.h / mapSize.height) * 0.95;
    setView({ x: -(size.w / s - mapSize.width) / 2, y: -(size.h / s - mapSize.height) / 2, s });
  }, [view, size, mapSize.width, mapSize.height]);

  const v = view ?? { x: 0, y: 0, s: 30 };

  function tileAt(clientX: number, clientY: number): Pos {
    const r = container.current!.getBoundingClientRect();
    return { x: Math.floor(v.x + (clientX - r.left) / v.s), y: Math.floor(v.y + (clientY - r.top) / v.s) };
  }

  /** Feld auf den Bildschirm (Mitte des Feldes, relativ zum Container). */
  const toScreen = (p: { x: number; y: number }) => ({ x: (p.x - v.x) * v.s, y: (p.y - v.y) * v.s });

  /** Ansicht auf ein Feld zentrieren (Zoom bleibt). */
  function centerOn(p: Pos, span = 1) {
    setView((cur) => {
      const c = cur ?? v;
      return { ...c, x: p.x + span / 2 - size.w / c.s / 2, y: p.y + span / 2 - size.h / c.s / 2 };
    });
  }

  const handlers = {
    onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
      // Knöpfe über der Map (z. B. der Aktionen-Ring) bekommen ihre Klicks selbst.
      if ((e.target as HTMLElement).closest('button')) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ohne Capture geht es auch.
      }
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        tap.current = null;
        const [a, b] = [...pointers.current.values()];
        pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: v };
      } else if (pointers.current.size === 1) {
        tap.current = { x: e.clientX, y: e.clientY };
      }
    },
    onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current && pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()];
        const r = container.current!.getBoundingClientRect();
        const st = pinch.current;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const s = Math.min(140, Math.max(6, (st.view.s * dist) / st.dist));
        const tileX = st.view.x + (st.mid.x - r.left) / st.view.s;
        const tileY = st.view.y + (st.mid.y - r.top) / st.view.s;
        setView({ s, x: tileX - (mid.x - r.left) / s, y: tileY - (mid.y - r.top) / s });
      } else if (tap.current && Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) > 12) {
        // Ein Finger, der sich bewegt: Ansicht verschieben.
        const prev = tap.current;
        tap.current = null;
        pinch.current = null;
        pan.current = { x: prev.x, y: prev.y, view: v };
      }
      if (pan.current && pointers.current.size === 1) {
        const p = pan.current;
        setView({ ...p.view, x: p.view.x - (e.clientX - p.x) / p.view.s, y: p.view.y - (e.clientY - p.y) / p.view.s });
      }
    },
    onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 0) {
        pinch.current = null;
        pan.current = null;
      }
      if (tap.current) {
        onTap(tileAt(tap.current.x, tap.current.y));
        tap.current = null;
      }
    },
    onPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
      pointers.current.delete(e.pointerId);
      tap.current = null;
      pinch.current = null;
      pan.current = null;
    },
    onWheel(e: WheelEvent<HTMLDivElement>) {
      const r = container.current!.getBoundingClientRect();
      const s = Math.min(140, Math.max(6, v.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      const tileX = v.x + (e.clientX - r.left) / v.s;
      const tileY = v.y + (e.clientY - r.top) / v.s;
      setView({ s, x: tileX - (e.clientX - r.left) / s, y: tileY - (e.clientY - r.top) / s });
    },
  };

  return { view: v, size, viewBox: `${v.x} ${v.y} ${size.w / v.s} ${size.h / v.s}`, handlers, toScreen, centerOn, ready: !!view };
}
