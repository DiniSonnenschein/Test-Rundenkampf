// Momentaufnahme aller Vorlagen für ein laufendes Spiel. Spielstände enthalten sie vollständig,
// damit ein Spiel unabhängig von späteren Änderungen in den Editoren weiterläuft.
import type { AbilityFields } from './abilities';
import type { Behavior } from './behavior';
import type { CharacterFields } from './characters';
import type { DungeonFields } from './dungeon';
import type { EffectFields } from './effects';
import type { LevelFields } from './level';
import type { ObjectFields } from './objects';
import type { ResourceFields } from './resources';
import type { Rules } from './rules';
import type { TerrainFields } from './terrain';

export interface Look {
  title: string;
  shape: string;
  color: string;
  size: number;
}

export interface Defs {
  rules: Rules;
  resources: Record<string, ResourceFields & { title: string }>;
  effects: Record<string, EffectFields & { title: string }>;
  abilities: Record<string, AbilityFields & { title: string }>;
  objects: Record<string, ObjectFields & Look>;
  terrains: Record<string, TerrainFields & { title: string }>;
  allys: Record<string, CharacterFields & Look>;
  enemies: Record<string, CharacterFields & Look & { behavior: Behavior }>;
  levels: Record<string, LevelFields & { title: string }>;
  dungeon: (DungeonFields & { title: string }) | null;
  typeNames: Record<string, string>;
}

export const titleOf = (defs: Defs, id: string | null | undefined): string => {
  if (!id) return '?';
  return (
    defs.resources[id]?.title ??
    defs.effects[id]?.title ??
    defs.abilities[id]?.title ??
    defs.objects[id]?.title ??
    defs.terrains[id]?.title ??
    defs.allys[id]?.title ??
    defs.enemies[id]?.title ??
    defs.levels[id]?.title ??
    defs.typeNames[id] ??
    '?'
  );
};
