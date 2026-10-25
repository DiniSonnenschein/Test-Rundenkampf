// Map-Editor (Vollbild): ein Finger malt bzw. platziert, zwei Finger zoomen und verschieben.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createEntry, newId, sortEntries } from '../../data/collection';
import { getDef } from '../../data/model';
import { getCollection, patchEntry, saveEntry, useCollection } from '../../data/store';
import type { Facing } from '../../engine/facing';
import { posKey, samePos, type Pos } from '../../engine/grid';
import {
  floodTiles, normalizeLevel, paint, paintMany, placementError, rectTiles, removeThing, thingsAt, toggleVictory, upsertThing,
  type LevelFields, type PlacedEnemy, type PlacedObject, type Thing,
} from '../../engine/level';
import { normalizeObject } from '../../engine/objects';
import { navigate, routes } from '../../router';
import { useDialog } from '../../ui/Dialog';
import { Header } from '../../ui/Header';
import { MapView } from './MapView';
import { useLookups } from './useTemplates';

type Tool = 'malen' | 'rechteck' | 'fuellen' | 'gegner' | 'objekt' | 'auswahl' | 'laterne' | 'sieg';

const TOOLS: { tool: Tool; icon: string; label: string }[] = [
  { tool: 'malen', icon: '🖌️', label: 'Malen' },
  { tool: 'rechteck', icon: '▭', label: 'Rechteck' },
  { tool: 'fuellen', icon: '🪣', label: 'Füllen' },
  { tool: 'gegner', icon: '👹', label: 'Gegner' },
  { tool: 'objekt', icon: '🎒', label: 'Objekt' },
  { tool: 'auswahl', icon: '👆', label: 'Auswählen' },
  { tool: 'laterne', icon: '🏮', label: 'Laterne' },
  { tool: 'sieg', icon: '🏁', label: 'Siegfeld' },
];

const NO_TILE = '__kein-feld__';

/** Zuletzt aus dem Map-Editor neu angelegter Eintrag – nach der Rückkehr wird er als Pinsel gewählt. */
let lastCreated: { key: string; id: string } | null = null;

const CREATE: { key: string; label: string; tool?: Tool }[] = [
  { key: 'allys', label: 'Ally' },
  { key: 'gegner', label: 'Gegner', tool: 'gegner' },
  { key: 'objekte', label: 'Objekt', tool: 'objekt' },
  { key: 'gelaende', label: 'Geländeart', tool: 'malen' },
];
const NEXT_FACING: Record<Facing, Facing> = { n: 'o', o: 's', s: 'w', w: 'n' };
const MAX_HISTORY = 100;

interface View {
  x: number;
  y: number;
  /** Pixel pro Feld. */
  s: number;
}

export function MapEditorScreen({ id }: { id: string }) {
  const col = useCollection('level');
  const entry = col.entries.find((e) => e.id === id);
  const lookups = useLookups();
  const dialog = useDialog();
  const gelaende = useCollection('gelaende');

  // Nach dem Anlegen eines neuen Eintrags direkt damit weiterarbeiten.
  const [created] = useState(() => lastCreated);
  useEffect(() => {
    lastCreated = null;
  }, []);
  const [tool, setTool] = useState<Tool>(CREATE.find((c) => c.key === created?.key)?.tool ?? 'malen');
  const [brush, setBrush] = useState<{ terrain: string | null; enemyId: string | null; objectId: string | null }>({
    terrain: created?.key === 'gelaende' ? created.id : null,
    enemyId: created?.key === 'gegner' ? created.id : null,
    objectId: created?.key === 'objekte' ? created.id : null,
  });
  const [draft, setDraft] = useState<LevelFields | null>(null);
  const [rect, setRect] = useState<{ a: Pos; b: Pos } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'normal' | 'verschieben' | 'patrouille'>('normal');
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<{ past: LevelFields[]; future: LevelFields[] }>({ past: [], future: [] });

  const container = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 360, h: 500 });
  const [view, setView] = useState<View | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number }; view: View } | null>(null);
  const stroke = useRef<{ start: LevelFields; last: string | null } | null>(null);
  /** Tipp-Aktionen werden erst beim Loslassen ausgeführt – so löst der erste Finger eines Zooms nichts aus. */
  const pendingTap = useRef<{ tile: Pos; x: number; y: number } | null>(null);

  const saved = entry ? normalizeLevel(entry) : null;
  const level = draft ?? saved;

  // Grundboden als Pinsel vorbelegen.
  useEffect(() => {
    if (saved && brush.terrain === null) setBrush((b) => ({ ...b, terrain: saved.baseTerrainId ?? NO_TILE }));
  }, [saved?.baseTerrainId]);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Anfangs die ganze Map einpassen.
  useEffect(() => {
    if (!level || view || size.w === 0) return;
    const s = Math.min(size.w / level.width, size.h / level.height) * 0.95;
    setView({ x: -(size.w / s - level.width) / 2, y: -(size.h / s - level.height) / 2, s });
  }, [level, view, size]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2500);
    return () => clearTimeout(t);
  }, [message]);

  if (!entry || !level || !saved) {
    return (
      <main className="screen">
        <Header title="Map" back={routes.list('level')} />
        <p className="muted empty">Dieses Level existiert nicht (mehr).</p>
      </main>
    );
  }

  function commit(next: LevelFields, before: LevelFields = saved!) {
    if (JSON.stringify(next) === JSON.stringify(before)) {
      setDraft(null);
      return;
    }
    setHistory((h) => ({ past: [...h.past, before].slice(-MAX_HISTORY), future: [] }));
    patchEntry('level', id, next as unknown as Record<string, unknown>);
    setDraft(null);
  }

  function undo() {
    const prev = history.past[history.past.length - 1];
    if (!prev) return;
    setHistory((h) => ({ past: h.past.slice(0, -1), future: [saved!, ...h.future] }));
    patchEntry('level', id, prev as unknown as Record<string, unknown>);
  }

  function redo() {
    const next = history.future[0];
    if (!next) return;
    setHistory((h) => ({ past: [...h.past, saved!], future: h.future.slice(1) }));
    patchEntry('level', id, next as unknown as Record<string, unknown>);
  }

  const v = view ?? { x: 0, y: 0, s: 30 };

  function tileAt(clientX: number, clientY: number): Pos {
    const r = container.current!.getBoundingClientRect();
    return { x: Math.floor(v.x + (clientX - r.left) / v.s), y: Math.floor(v.y + (clientY - r.top) / v.s) };
  }

  const inside = (p: Pos) => p.x >= 0 && p.y >= 0 && p.x < level.width && p.y < level.height;
  const brushTerrain = brush.terrain === NO_TILE ? null : brush.terrain;
  const selected = level.enemies.find((e) => e.id === selectedId) ?? level.objects.find((o) => o.id === selectedId);
  const selectedThing: Thing | null = selected
    ? 'enemyId' in selected ? { kind: 'gegner', item: selected } : { kind: 'objekt', item: selected as PlacedObject }
    : null;

  function place(thing: Thing, p: Pos, base: LevelFields): LevelFields | null {
    const error = placementError(base, thing, p, lookups.tpl);
    if (error) {
      setMessage(error);
      return null;
    }
    return upsertThing(base, { ...thing, item: { ...thing.item, pos: p } } as Thing);
  }

  /** Ein-Finger-Aktion beim Aufsetzen. */
  function startAction(p: Pos) {
    if (!inside(p)) return;
    const base = saved!;
    switch (tool) {
      case 'malen':
        stroke.current = { start: base, last: posKey(p) };
        setDraft(paint(base, p, brushTerrain));
        return;
      case 'rechteck':
        setRect({ a: p, b: p });
        return;
      case 'fuellen':
        commit(paintMany(base, floodTiles(base, p), brushTerrain));
        return;
      case 'laterne':
        commit({ ...base, lanternStart: p });
        return;
      case 'sieg':
        commit(toggleVictory(base, p));
        return;
      case 'gegner': {
        if (!brush.enemyId) return setMessage('Zuerst einen Gegner wählen.');
        const item: PlacedEnemy = { id: newId('platziert'), enemyId: brush.enemyId, pos: p, facing: 's', patrol: { points: [], mode: 'rundweg' } };
        const next = place({ kind: 'gegner', item }, p, base);
        if (next) commit(next);
        return;
      }
      case 'objekt': {
        if (!brush.objectId) return setMessage('Zuerst ein Objekt wählen.');
        const item: PlacedObject = { id: newId('platziert'), objectId: brush.objectId, pos: p, hidden: null };
        const next = place({ kind: 'objekt', item }, p, base);
        if (next) commit(next);
        return;
      }
      case 'auswahl': {
        if (mode === 'verschieben' && selectedThing) {
          const next = place(selectedThing, p, base);
          if (next) commit(next);
          setMode('normal');
          return;
        }
        if (mode === 'patrouille' && selectedThing?.kind === 'gegner') {
          const e = selectedThing.item;
          commit(upsertThing(base, { kind: 'gegner', item: { ...e, patrol: { ...e.patrol, points: [...e.patrol.points, p] } } }));
          return;
        }
        // Mehrere Dinge auf einem Feld: bei erneutem Tippen das nächste wählen.
        const here = thingsAt(base, p, lookups.tpl);
        if (!here.length) return setSelectedId(null);
        const i = here.findIndex((t) => t.item.id === selectedId);
        setSelectedId(here[(i + 1) % here.length].item.id);
        setMode('normal');
      }
    }
  }

  function moveAction(p: Pos) {
    if (tool === 'malen' && stroke.current && inside(p) && stroke.current.last !== posKey(p)) {
      stroke.current.last = posKey(p);
      setDraft((d) => paint(d ?? saved!, p, brushTerrain));
    }
    if (tool === 'rechteck' && rect && inside(p) && !samePos(rect.b, p)) setRect({ ...rect, b: p });
  }

  function endAction() {
    if (tool === 'malen' && stroke.current) {
      commit(draft ?? saved!, stroke.current.start);
      stroke.current = null;
    }
    if (tool === 'rechteck' && rect) {
      commit(paintMany(saved!, rectTiles(rect.a, rect.b), brushTerrain));
      setRect(null);
    }
  }

  function cancelAction() {
    stroke.current = null;
    setDraft(null);
    setRect(null);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ohne Capture geht es auch (z. B. bei bereits beendetem Zeiger).
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      cancelAction();
      pendingTap.current = null;
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: v };
    } else if (pointers.current.size === 1) {
      const tile = tileAt(e.clientX, e.clientY);
      if (tool === 'malen' || tool === 'rechteck') startAction(tile);
      else pendingTap.current = { tile, x: e.clientX, y: e.clientY };
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const r = container.current!.getBoundingClientRect();
      const st = pinch.current;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = Math.min(120, Math.max(6, (st.view.s * dist) / st.dist));
      const tileX = st.view.x + (st.mid.x - r.left) / st.view.s;
      const tileY = st.view.y + (st.mid.y - r.top) / st.view.s;
      setView({ s, x: tileX - (mid.x - r.left) / s, y: tileY - (mid.y - r.top) / s });
    } else if (!pinch.current) {
      const tap = pendingTap.current;
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 12) pendingTap.current = null;
      moveAction(tileAt(e.clientX, e.clientY));
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size === 0) pinch.current = null;
      return;
    }
    if (pendingTap.current) {
      startAction(pendingTap.current.tile);
      pendingTap.current = null;
    }
    endAction();
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    const r = container.current!.getBoundingClientRect();
    const s = Math.min(120, Math.max(6, v.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    const tileX = v.x + (e.clientX - r.left) / v.s;
    const tileY = v.y + (e.clientY - r.top) / v.s;
    setView({ s, x: tileX - (e.clientX - r.left) / s, y: tileY - (e.clientY - r.top) / s });
  }

  async function chooseBrush() {
    if (tool === 'gegner' || tool === 'objekt') {
      const key = tool === 'gegner' ? 'gegner' : 'objekte';
      const items = sortEntries(getCollection(key).entries).map((x) => ({ label: x.title, value: x.id }));
      if (!items.length) return setMessage(`Lege zuerst ${tool === 'gegner' ? 'Gegner' : 'Objekte'} an.`);
      const picked = await dialog.menu({ title: tool === 'gegner' ? 'Gegner wählen' : 'Objekt wählen', items });
      if (picked) setBrush((b) => (tool === 'gegner' ? { ...b, enemyId: picked } : { ...b, objectId: picked }));
      return;
    }
    const items = [
      ...sortEntries(gelaende.entries).map((x) => ({ label: x.title + (x.id === level!.baseTerrainId ? ' (Grundboden)' : ''), value: x.id })),
      { label: '⬛ Kein Feld', value: NO_TILE },
    ];
    const picked = await dialog.menu({ title: 'Geländeart wählen', items });
    if (picked) setBrush((b) => ({ ...b, terrain: picked }));
  }

  const brushLabel =
    tool === 'gegner'
      ? lookups.enemy(brush.enemyId)?.title ?? 'Gegner wählen …'
      : tool === 'objekt'
        ? lookups.object(brush.objectId)?.title ?? 'Objekt wählen …'
        : brush.terrain === NO_TILE
          ? 'Kein Feld'
          : lookups.terrain(brush.terrain)?.title ?? 'Geländeart wählen …';

  const hint: Record<Tool, string> = {
    malen: 'Felder antippen oder darüberwischen',
    rechteck: 'Von Ecke zu Ecke ziehen',
    fuellen: 'Zusammenhängende Fläche antippen',
    gegner: 'Feld antippen zum Platzieren',
    objekt: 'Feld antippen zum Platzieren',
    auswahl: 'Gegner oder Objekt antippen',
    laterne: 'Feld für den Laternenträger antippen',
    sieg: 'Siegfelder an-/abschalten',
  };

  async function createNew() {
    const key = await dialog.menu({ title: 'Neu anlegen', items: CREATE.map((c) => ({ label: c.label, value: c.key })) });
    const def = key ? getDef(key) : undefined;
    if (!def) return;
    const e = createEntry(def, null);
    saveEntry(def.key, e);
    lastCreated = { key: def.key, id: e.id };
    navigate(routes.entry(def.key, e.id));
  }

  function updateSelected(item: PlacedEnemy | PlacedObject) {
    commit(upsertThing(saved!, 'enemyId' in item ? { kind: 'gegner', item } : { kind: 'objekt', item }));
  }

  return (
    <main className="map-editor">
      <div className="map-editor-head">
        <Header
          title={entry.title || 'Level'}
          back={routes.entry('level', id)}
          actions={
            <>
              <button className="icon-btn" aria-label="Neu anlegen" onClick={createNew}>＋</button>
              <button className="icon-btn" aria-label="Rückgängig" disabled={!history.past.length} onClick={undo}>↶</button>
              <button className="icon-btn" aria-label="Wiederholen" disabled={!history.future.length} onClick={redo}>↷</button>
            </>
          }
        />
      </div>

      <div
        ref={container}
        className="map-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <MapView
          level={level}
          lookups={lookups}
          svgRef={svg}
          viewBox={`${v.x} ${v.y} ${size.w / v.s} ${size.h / v.s}`}
          selectedId={selectedId}
          rect={rect}
          className="map-svg"
        />
        {message && <div className="map-toast">{message}</div>}
      </div>

      <div className="map-tools">
        {tool === 'auswahl' && selectedThing ? (
          <SelectionPanel
            thing={selectedThing}
            mode={mode}
            setMode={setMode}
            lookups={lookups}
            onChange={updateSelected}
            onDelete={() => {
              commit(removeThing(saved!, selectedThing.item.id));
              setSelectedId(null);
            }}
          />
        ) : (
          <div className="map-brush">
            {['malen', 'rechteck', 'fuellen', 'gegner', 'objekt'].includes(tool) && (
              <button className="btn btn-small" onClick={chooseBrush}>{brushLabel} ▾</button>
            )}
            <span className="muted small">{hint[tool]} · zwei Finger: zoomen & verschieben</span>
          </div>
        )}
        <div className="tool-row">
          {TOOLS.map((t) => (
            <button
              key={t.tool}
              className={`tool-btn ${tool === t.tool ? 'selected' : ''}`}
              onClick={() => {
                setTool(t.tool);
                setMode('normal');
                if (t.tool !== 'auswahl') setSelectedId(null);
              }}
            >
              <span aria-hidden="true">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

function SelectionPanel({
  thing, mode, setMode, lookups, onChange, onDelete,
}: {
  thing: Thing;
  mode: 'normal' | 'verschieben' | 'patrouille';
  setMode: (m: 'normal' | 'verschieben' | 'patrouille') => void;
  lookups: ReturnType<typeof useLookups>;
  onChange: (item: PlacedEnemy | PlacedObject) => void;
  onDelete: () => void;
}) {
  const title = thing.kind === 'gegner' ? lookups.enemy(thing.item.enemyId)?.title : lookups.object(thing.item.objectId)?.title;
  return (
    <div className="selection-panel">
      <div className="selection-title">
        <strong>{title ?? '(gelöscht)'}</strong>
        {mode === 'verschieben' && <span className="muted small"> – Zielfeld antippen</span>}
        {mode === 'patrouille' && <span className="muted small"> – Wegpunkte antippen</span>}
      </div>
      <div className="selection-actions">
        <button className={`btn btn-small ${mode === 'verschieben' ? 'btn-primary' : ''}`} onClick={() => setMode(mode === 'verschieben' ? 'normal' : 'verschieben')}>
          Verschieben
        </button>
        {thing.kind === 'gegner' && (
          <>
            <button className="btn btn-small" onClick={() => onChange({ ...thing.item, facing: NEXT_FACING[thing.item.facing] })}>Drehen ↻</button>
            <button className={`btn btn-small ${mode === 'patrouille' ? 'btn-primary' : ''}`} onClick={() => setMode(mode === 'patrouille' ? 'normal' : 'patrouille')}>
              {mode === 'patrouille' ? 'Fertig' : 'Patrouille'}
            </button>
          </>
        )}
        {thing.kind === 'objekt' && (
          <button
            className="btn btn-small"
            onClick={() => {
              const h = thing.item.hidden;
              onChange({ ...thing.item, hidden: h === null ? true : h ? false : null });
            }}
          >
            Verborgen: {thing.item.hidden === null ? `wie Vorlage (${normalizeObject(lookups.object(thing.item.objectId) ?? {}).hidden ? 'ja' : 'nein'})` : thing.item.hidden ? 'ja' : 'nein'}
          </button>
        )}
        <button className="btn btn-small btn-danger" onClick={onDelete}>Löschen</button>
      </div>
      {thing.kind === 'gegner' && mode === 'patrouille' && (
        <div className="selection-actions">
          <button
            className="btn btn-small"
            onClick={() => onChange({ ...thing.item, patrol: { ...thing.item.patrol, mode: thing.item.patrol.mode === 'rundweg' ? 'hin-zurueck' : 'rundweg' } })}
          >
            {thing.item.patrol.mode === 'rundweg' ? 'Rundweg' : 'Hin & zurück'}
          </button>
          <button className="btn btn-small" onClick={() => onChange({ ...thing.item, patrol: { ...thing.item.patrol, points: thing.item.patrol.points.slice(0, -1) } })}>
            Letzten Punkt entfernen
          </button>
        </div>
      )}
    </div>
  );
}
