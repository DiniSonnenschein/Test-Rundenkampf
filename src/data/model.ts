import { DEFAULT_ABILITY, normalizeAbility } from '../engine/abilities';
import { DEFAULT_BEHAVIOR } from '../engine/behavior';
import { DEFAULT_CHARACTER } from '../engine/characters';
import { DEFAULT_OBJECT, normalizeObject } from '../engine/objects';
import { normalizeDungeon } from '../engine/dungeon';
import { DEFAULT_GAME, normalizeGame } from '../engine/game';
import { DEFAULT_LEVEL, normalizeLevel } from '../engine/level';
import { DEFAULT_TERRAIN, normalizeTerrain } from '../engine/terrain';
import { DEFAULT_EFFECT, normalizeEffect, UNCONSCIOUS_ID } from '../engine/effects';
import { DEFAULT_RESOURCE, INITIATIVE_ID, normalizeResource } from '../engine/resources';
import { DEFAULT_RULES } from '../engine/rules';

// Gemeinsames Datenmodell aller Einträge im Erstell-Modus und unter „Neues Spiel“ / „Spielstand laden“.

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  updatedAt: string;
}

/** Jeder Eintrag beginnt mit Titel und Notiz; je nach Art kommen weitere Felder hinzu. */
export interface Entry {
  id: string;
  title: string;
  note: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Fester Eintrag: bearbeitbar, aber nicht löschbar. */
  fixed?: boolean;
  [field: string]: unknown;
}

/** Darstellung von sichtbaren Spielfiguren/-objekten (Allys, Gegner, Objekte). */
export interface Look {
  shape: string;
  color: string;
  size: number;
}

export interface Collection {
  entries: Entry[];
  folders: Folder[];
}

export interface CollectionDef {
  key: string;
  label: string;
  singular: string;
  newTitle: string;
  icon: string;
  /** Hat eine sichtbare Darstellung im Spiel (Form, Farbe, Größe). */
  visible?: boolean;
  /** Können neue Einträge direkt in der Liste angelegt werden? */
  creatable?: boolean;
  /** Abschnitt im Sheet, in dem die weiteren Felder ausgearbeitet werden. */
  section: number;
  /** Zusätzliche Startwerte neuer Einträge. */
  defaults?: () => Record<string, unknown>;
  /** Feste Einträge, die immer existieren und nicht gelöscht werden können. */
  fixedEntries?: () => Entry[];
  /** Kurzinfo in der Liste (vor dem Datum). */
  subtitle?: (entry: Entry) => string;
}

export const BAUSTEINE: CollectionDef[] = [
  {
    key: 'regelwerke', label: 'Regelwerke', singular: 'Regelwerk', newTitle: 'Neues Regelwerk', icon: '📜', creatable: true, section: 2,
    defaults: () => ({ rules: structuredClone(DEFAULT_RULES) }),
  },
  {
    key: 'allys', label: 'Allys', singular: 'Ally', newTitle: 'Neuer Ally', icon: '🛡️', visible: true, creatable: true, section: 6,
    defaults: () => structuredClone(DEFAULT_CHARACTER) as unknown as Record<string, unknown>,
  },
  {
    key: 'gegner', label: 'Gegner', singular: 'Gegner', newTitle: 'Neuer Gegner', icon: '👹', visible: true, creatable: true, section: 7,
    defaults: () => ({ ...structuredClone(DEFAULT_CHARACTER), behavior: structuredClone(DEFAULT_BEHAVIOR) }) as unknown as Record<string, unknown>,
  },
  {
    key: 'objekte', label: 'Objekte', singular: 'Objekt', newTitle: 'Neues Objekt', icon: '🎒', visible: true, creatable: true, section: 8,
    defaults: () => structuredClone(DEFAULT_OBJECT) as unknown as Record<string, unknown>,
    subtitle: (e) => {
      const o = normalizeObject(e);
      return [o.collectible && 'Sammelbar', o.use.usable && 'Verwendbar', o.hidden && 'Verborgen'].filter(Boolean).join(' · ');
    },
  },
  {
    key: 'gelaende', label: 'Geländearten', singular: 'Geländeart', newTitle: 'Neue Geländeart', icon: '🌲', creatable: true, section: 9,
    defaults: () => structuredClone(DEFAULT_TERRAIN) as unknown as Record<string, unknown>,
    subtitle: (e) => {
      const t = normalizeTerrain(e);
      return [t.walkable === 'nein' ? 'Nicht begehbar' : t.walkable === 'bedingt' ? 'Bedingt begehbar' : '', t.slippery && 'Rutschig', t.light.on && 'Leuchtet']
        .filter(Boolean)
        .join(' · ');
    },
  },
  {
    key: 'faehigkeiten', label: 'Fähigkeiten', singular: 'Fähigkeit', newTitle: 'Neue Fähigkeit', icon: '✨', creatable: true, section: 5,
    defaults: () => structuredClone(DEFAULT_ABILITY) as unknown as Record<string, unknown>,
    subtitle: (e) => {
      const a = normalizeAbility(e);
      const kind = { ziel: 'Ziel', zufall: 'Zufall', aoe: 'AOE' }[a.targeting.kind];
      return `${a.mode === 'zwang' ? 'Zwang' : 'Wahl'} · ${kind}`;
    },
  },
  {
    key: 'effekte', label: 'Effekte', singular: 'Effekt', newTitle: 'Neuer Effekt', icon: '🔥', creatable: true, section: 4,
    defaults: () => structuredClone(DEFAULT_EFFECT) as unknown as Record<string, unknown>,
    fixedEntries: () => [
      {
        id: UNCONSCIOUS_ID,
        title: 'Bewusstlos',
        note: '',
        folderId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fixed: true,
        ...structuredClone(DEFAULT_EFFECT),
        display: { show: false, color: '#6b6b8a' },
      },
    ],
    subtitle: (e) => {
      const n = normalizeEffect(e).blocks.length;
      return (e.fixed ? 'Fest · ' : '') + (n === 1 ? '1 Baustein' : `${n} Bausteine`);
    },
  },
  {
    key: 'ressourcen', label: 'Ressourcen', singular: 'Ressource', newTitle: 'Neue Ressource', icon: '💧', creatable: true, section: 3,
    defaults: () => structuredClone(DEFAULT_RESOURCE) as unknown as Record<string, unknown>,
    fixedEntries: () => [
      {
        id: INITIATIVE_ID,
        title: 'Initiative',
        note: 'Bestimmt die Reihenfolge innerhalb der Initiative-Reihe.',
        folderId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fixed: true,
        ...structuredClone(DEFAULT_RESOURCE),
        display: { show: false, color: '#e0a83a' },
      },
    ],
    subtitle: (e) => (e.fixed ? 'Fest · ' : '') + (normalizeResource(e).scope === 'global' ? 'Global' : 'Individuell'),
  },
  {
    key: 'level', label: 'Level', singular: 'Level', newTitle: 'Neues Level', icon: '🗺️', creatable: true, section: 10,
    defaults: () => structuredClone(DEFAULT_LEVEL) as unknown as Record<string, unknown>,
    subtitle: (e) => {
      const l = normalizeLevel(e);
      return `${l.width}×${l.height} · ${l.enemies.length} Gegner`;
    },
  },
  {
    key: 'dungeons', label: 'Dungeons', singular: 'Dungeon', newTitle: 'Neuer Dungeon', icon: '🏰', creatable: true, section: 11,
    defaults: () => ({ stations: [] }),
    subtitle: (e) => {
      const n = normalizeDungeon(e).stations.length;
      return n === 1 ? '1 Level' : `${n} Level`;
    },
  },
];

export const SPIELE: CollectionDef = {
  key: 'spiele', label: 'Neues Spiel', singular: 'Spiel', newTitle: 'Neues Spiel', icon: '▶️', creatable: true, section: 12,
  defaults: () => structuredClone(DEFAULT_GAME) as unknown as Record<string, unknown>,
  subtitle: (e) => {
    const g = normalizeGame(e);
    const what = { dungeon: 'Dungeon', level: 'Level', levels: 'Level-Folge' }[g.content.kind];
    return `${what} · ${g.team.length === 1 ? '1 Ally' : `${g.team.length} Allys`}`;
  },
};

export const SPIELSTAENDE: CollectionDef = {
  key: 'spielstaende', label: 'Spielstand laden', singular: 'Spielstand', newTitle: 'Neuer Spielstand', icon: '💾', section: 14,
};

/** Typen-Listen (verwaltet in den Einstellungen, ergänzbar direkt in den Editoren). */
export const TYPEN_AKTIONEN: CollectionDef = {
  key: 'typen-aktionen', label: 'Typen für Fähigkeiten & Effekte', singular: 'Typ', newTitle: 'Neuer Typ', icon: '🏷️', section: 4,
};
export const TYPEN_CHARAKTERE: CollectionDef = {
  key: 'typen-charaktere', label: 'Typen für Allys & Gegner', singular: 'Typ', newTitle: 'Neuer Typ', icon: '🏷️', section: 4,
};
export const TYPEN_OBJEKTE: CollectionDef = {
  key: 'typen-objekte', label: 'Typen für Objekte', singular: 'Typ', newTitle: 'Neuer Typ', icon: '🏷️', section: 5,
};

export const ALL_DEFS: CollectionDef[] = [...BAUSTEINE, SPIELE, SPIELSTAENDE, TYPEN_AKTIONEN, TYPEN_CHARAKTERE, TYPEN_OBJEKTE];

export function getDef(key: string): CollectionDef | undefined {
  return ALL_DEFS.find((d) => d.key === key);
}

export const DEFAULT_LOOK: Look = { shape: 'kreis', color: '#d9772b', size: 1 };
