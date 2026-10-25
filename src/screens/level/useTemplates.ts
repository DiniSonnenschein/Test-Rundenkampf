// Vorlagen (Gegner, Objekte, Geländearten) für Level-Darstellung und -Prüfung.
import { useMemo } from 'react';
import type { Entry } from '../../data/model';
import { useCollection } from '../../data/store';
import { normalizeCharacter, tileSize } from '../../engine/characters';
import type { Templates } from '../../engine/level';
import { normalizeObject } from '../../engine/objects';
import { normalizeTerrain, type TerrainFields } from '../../engine/terrain';

export interface LevelLookups {
  tpl: Templates;
  enemy: (id: string | null) => Entry | undefined;
  object: (id: string | null) => Entry | undefined;
  terrain: (id: string | null) => (TerrainFields & { title: string }) | undefined;
}

export function useLookups(): LevelLookups {
  const gegner = useCollection('gegner');
  const objekte = useCollection('objekte');
  const gelaende = useCollection('gelaende');
  return useMemo(() => {
    const enemy = (id: string | null) => gegner.entries.find((e) => e.id === id);
    const object = (id: string | null) => objekte.entries.find((e) => e.id === id);
    const terrains = new Map(gelaende.entries.map((e) => [e.id, { ...normalizeTerrain(e), title: e.title }]));
    return {
      enemy,
      object,
      terrain: (id) => (id ? terrains.get(id) : undefined),
      tpl: {
        enemy: (id) => {
          const e = enemy(id);
          return { size: tileSize(e?.size), collision: e ? normalizeCharacter(e).collision : true };
        },
        object: (id) => {
          const o = object(id);
          return { collision: o ? normalizeObject(o).collision : false };
        },
      },
    };
  }, [gegner, objekte, gelaende]);
}
