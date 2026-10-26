// Level: Raster mit Geländearten, platzierte Gegner/Objekte, Laternen-Startfeld und Siegfelder.
import type { Facing } from './facing';
import { inBounds, posKey, samePos, type Pos } from './grid';

export interface PlacedEnemy {
  id: string;
  enemyId: string | null;
  pos: Pos;
  facing: Facing;
  patrol: { points: Pos[]; mode: 'rundweg' | 'hin-zurueck' };
}

export interface PlacedObject {
  id: string;
  objectId: string | null;
  pos: Pos;
  /** null = wie in der Vorlage. */
  hidden: boolean | null;
}

export interface LevelColors {
  /** Felder mit dem Grundboden (Schachbrett). */
  standard: [string, string];
  lantern: string;
  victory: [string, string];
  /** Hintergrund und „kein Feld“. */
  background: string;
}

export interface LevelFields {
  width: number;
  height: number;
  baseTerrainId: string | null;
  /** Abweichende Geländeart je Feld (posKey → ID); fehlt ein Feld, gilt der Grundboden. */
  terrain: Record<string, string>;
  /** Entfernte Felder („kein Feld“). */
  voids: string[];
  lanternStart: Pos | null;
  victory: string[];
  enemies: PlacedEnemy[];
  objects: PlacedObject[];
  colors: LevelColors;
}

export const MAX_LEVEL_SIZE = 40;

export const DEFAULT_LEVEL: LevelFields = {
  width: 12,
  height: 16,
  baseTerrainId: null,
  terrain: {},
  voids: [],
  lanternStart: null,
  victory: [],
  enemies: [],
  objects: [],
  colors: { standard: ['#6b5a44', '#584936'], lantern: '#c99a3a', victory: ['#5f8a4a', '#4e7a3c'], background: '#140c09' },
};

export function normalizeLevel(partial: unknown): LevelFields {
  const p = (partial && typeof partial === 'object' ? partial : {}) as Partial<LevelFields>;
  const d = DEFAULT_LEVEL;
  return {
    width: p.width ?? d.width,
    height: p.height ?? d.height,
    baseTerrainId: p.baseTerrainId ?? null,
    terrain: p.terrain ?? {},
    voids: p.voids ?? [],
    lanternStart: p.lanternStart ?? null,
    victory: p.victory ?? [],
    enemies: p.enemies ?? [],
    objects: p.objects ?? [],
    colors: { ...d.colors, ...p.colors },
  };
}

// ---------- Farben ----------

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

/** Schachbrett: der Editor entscheidet selbst, welche Farbe die helle ist. */
export function checker(colors: [string, string], p: Pos): string {
  const [light, dark] = luminance(colors[0]) >= luminance(colors[1]) ? colors : [colors[1], colors[0]];
  return (p.x + p.y) % 2 === 0 ? light : dark;
}

// ---------- Felder ----------

export const isVoid = (l: LevelFields, p: Pos) => l.voids.includes(posKey(p));
export const isVictory = (l: LevelFields, p: Pos) => l.victory.includes(posKey(p));
export const terrainAt = (l: LevelFields, p: Pos): string | null => l.terrain[posKey(p)] ?? l.baseTerrainId;

/** Setzt die Geländeart eines Feldes (null = „kein Feld“). */
export function paint(l: LevelFields, p: Pos, terrainId: string | null): LevelFields {
  if (!inBounds(l, p)) return l;
  const k = posKey(p);
  const terrain = { ...l.terrain };
  delete terrain[k];
  if (terrainId === null) return { ...l, terrain, voids: l.voids.includes(k) ? l.voids : [...l.voids, k] };
  if (terrainId !== l.baseTerrainId) terrain[k] = terrainId;
  return { ...l, terrain, voids: l.voids.filter((v) => v !== k) };
}

export function rectTiles(a: Pos, b: Pos): Pos[] {
  const tiles: Pos[] = [];
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) tiles.push({ x, y });
  return tiles;
}

export function paintMany(l: LevelFields, tiles: Pos[], terrainId: string | null): LevelFields {
  return tiles.reduce((acc, p) => paint(acc, p, terrainId), l);
}

/** Farbeimer: zusammenhängende Fläche gleicher Art (4er-Nachbarschaft). */
export function floodTiles(l: LevelFields, start: Pos): Pos[] {
  if (!inBounds(l, start)) return [];
  const same = (p: Pos) => isVoid(l, p) === isVoid(l, start) && (isVoid(l, p) || terrainAt(l, p) === terrainAt(l, start));
  const seen = new Set([posKey(start)]);
  const out: Pos[] = [];
  const queue = [start];
  while (queue.length) {
    const p = queue.shift()!;
    out.push(p);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (inBounds(l, n) && !seen.has(posKey(n)) && same(n)) {
        seen.add(posKey(n));
        queue.push(n);
      }
    }
  }
  return out;
}

/** Neue Größe; was außerhalb liegt, fällt weg. */
export function resize(l: LevelFields, width: number, height: number): LevelFields {
  const w = Math.max(1, Math.min(MAX_LEVEL_SIZE, width));
  const h = Math.max(1, Math.min(MAX_LEVEL_SIZE, height));
  const inside = (k: string) => {
    const [x, y] = k.split(',').map(Number);
    return x < w && y < h;
  };
  const insidePos = (p: Pos) => p.x < w && p.y < h;
  return {
    ...l,
    width: w,
    height: h,
    terrain: Object.fromEntries(Object.entries(l.terrain).filter(([k]) => inside(k))),
    voids: l.voids.filter(inside),
    victory: l.victory.filter(inside),
    lanternStart: l.lanternStart && insidePos(l.lanternStart) ? l.lanternStart : null,
    enemies: l.enemies.filter((e) => insidePos(e.pos)).map((e) => ({ ...e, patrol: { ...e.patrol, points: e.patrol.points.filter(insidePos) } })),
    objects: l.objects.filter((o) => insidePos(o.pos)),
  };
}

export function toggleVictory(l: LevelFields, p: Pos): LevelFields {
  const k = posKey(p);
  return { ...l, victory: l.victory.includes(k) ? l.victory.filter((v) => v !== k) : [...l.victory, k] };
}

// ---------- Platzieren ----------

/** Infos über Vorlagen: Größe und Kollision. */
export interface Templates {
  enemy: (id: string | null) => { size: number; height?: number; collision: boolean };
  object: (id: string | null) => { size?: number; height?: number; collision: boolean };
}

export type Thing = { kind: 'gegner'; item: PlacedEnemy } | { kind: 'objekt'; item: PlacedObject };

function tilesOf(t: Thing, tpl: Templates, pos: Pos = t.item.pos): Pos[] {
  const d = t.kind === 'gegner' ? tpl.enemy(t.item.enemyId) : tpl.object(t.item.objectId);
  const w = d.size ?? 1;
  const h = d.height ?? w;
  const tiles: Pos[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) tiles.push({ x: pos.x + dx, y: pos.y + dy });
  return tiles;
}

const collides = (t: Thing, tpl: Templates) => (t.kind === 'gegner' ? tpl.enemy(t.item.enemyId).collision : tpl.object(t.item.objectId).collision);

export function allThings(l: LevelFields): Thing[] {
  return [...l.enemies.map((item) => ({ kind: 'gegner' as const, item })), ...l.objects.map((item) => ({ kind: 'objekt' as const, item }))];
}

/** Dinge auf einem Feld. */
export function thingsAt(l: LevelFields, p: Pos, tpl: Templates): Thing[] {
  return allThings(l).filter((t) => tilesOf(t, tpl).some((x) => samePos(x, p)));
}

/**
 * Pro Feld: höchstens ein Ding mit Kollision, beliebig viele ohne. Liefert einen Fehlertext oder null.
 */
export function placementError(l: LevelFields, thing: Thing, pos: Pos, tpl: Templates): string | null {
  const tiles = tilesOf(thing, tpl, pos);
  if (!tiles.every((t) => inBounds(l, t))) return 'Passt nicht auf die Map.';
  if (tiles.some((t) => isVoid(l, t))) return 'Dort ist kein Feld.';
  if (!collides(thing, tpl)) return null;
  const blocked = allThings(l).some(
    (o) => o.item.id !== thing.item.id && collides(o, tpl) && tilesOf(o, tpl).some((x) => tiles.some((t) => samePos(t, x))),
  );
  return blocked ? 'Auf einem Feld darf nur ein Ding mit Kollision stehen.' : null;
}

export function upsertThing(l: LevelFields, thing: Thing): LevelFields {
  if (thing.kind === 'gegner') {
    const exists = l.enemies.some((e) => e.id === thing.item.id);
    return { ...l, enemies: exists ? l.enemies.map((e) => (e.id === thing.item.id ? thing.item : e)) : [...l.enemies, thing.item] };
  }
  const exists = l.objects.some((o) => o.id === thing.item.id);
  return { ...l, objects: exists ? l.objects.map((o) => (o.id === thing.item.id ? thing.item : o)) : [...l.objects, thing.item] };
}

export function removeThing(l: LevelFields, id: string): LevelFields {
  return { ...l, enemies: l.enemies.filter((e) => e.id !== id), objects: l.objects.filter((o) => o.id !== id) };
}

// ---------- Prüfung ----------

export function validateLevel(l: LevelFields, tpl: Templates, walkable: (terrainId: string | null) => boolean): string[] {
  const warnings: string[] = [];
  if (!l.baseTerrainId) warnings.push('Kein Grundboden gewählt.');
  if (!l.lanternStart) warnings.push('Kein Laternen-Startfeld.');
  else if (isVoid(l, l.lanternStart) || !walkable(terrainAt(l, l.lanternStart))) warnings.push('Das Laternen-Startfeld ist nicht begehbar.');
  if (l.victory.length === 0) warnings.push('Keine Siegfelder.');
  else warnings.push(`${l.victory.length} Siegfeld${l.victory.length === 1 ? '' : 'er'} – reicht für höchstens ${l.victory.length} Ally${l.victory.length === 1 ? '' : 's'}.`);
  const badEnemies = l.enemies.filter((e) => tilesOf({ kind: 'gegner', item: e }, tpl).some((t) => isVoid(l, t) || !walkable(terrainAt(l, t))));
  if (badEnemies.length) warnings.push(`${badEnemies.length} Gegner auf nicht begehbarem Gelände.`);
  if (l.enemies.some((e) => !e.enemyId) || l.objects.some((o) => !o.objectId)) warnings.push('Platzierte Dinge, deren Vorlage gelöscht wurde.');
  return warnings;
}
