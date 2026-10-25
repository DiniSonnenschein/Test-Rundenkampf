// Erstellt aus den Editor-Inhalten die Momentaufnahme aller Vorlagen für ein neues Spiel.
import { normalizeAbility } from '../engine/abilities';
import { normalizeBehavior } from '../engine/behavior';
import { normalizeCharacter, tileSize } from '../engine/characters';
import type { Defs } from '../engine/defs';
import { normalizeDungeon } from '../engine/dungeon';
import { normalizeEffect } from '../engine/effects';
import type { GameFields } from '../engine/game';
import { normalizeLevel } from '../engine/level';
import { normalizeObject } from '../engine/objects';
import { normalizeResource } from '../engine/resources';
import { normalizeRules } from '../engine/rules';
import { normalizeTerrain } from '../engine/terrain';
import { getCollection } from '../data/store';
import type { Entry } from '../data/model';

function map<T>(key: string, fn: (e: Entry) => T): Record<string, T & { title: string }> {
  return Object.fromEntries(getCollection(key).entries.map((e) => [e.id, { ...fn(e), title: e.title }]));
}

const look = (e: Entry) => ({ shape: String(e.shape ?? 'kreis'), color: String(e.color ?? '#d9772b'), size: tileSize(e.size) });

export function buildDefs(game: GameFields): Defs {
  const ruleset = getCollection('regelwerke').entries.find((e) => e.id === game.regelwerkId);
  const c = game.content;
  const dungeonEntry = c.kind === 'dungeon' ? getCollection('dungeons').entries.find((e) => e.id === c.dungeonId) : undefined;
  const typeNames = Object.fromEntries(
    ['typen-aktionen', 'typen-charaktere', 'typen-objekte'].flatMap((k) => getCollection(k).entries.map((e) => [e.id, e.title])),
  );
  return {
    rules: normalizeRules(ruleset?.rules),
    resources: map('ressourcen', normalizeResource),
    effects: map('effekte', normalizeEffect),
    abilities: map('faehigkeiten', normalizeAbility),
    objects: map('objekte', (e) => ({ ...normalizeObject(e), ...look(e) })),
    terrains: map('gelaende', normalizeTerrain),
    allys: map('allys', (e) => ({ ...normalizeCharacter(e), ...look(e) })),
    enemies: map('gegner', (e) => ({ ...normalizeCharacter(e), ...look(e), behavior: normalizeBehavior(e.behavior) })),
    levels: map('level', normalizeLevel),
    dungeon: dungeonEntry ? { ...normalizeDungeon(dungeonEntry), title: dungeonEntry.title } : null,
    typeNames,
  };
}
