// Charaktere (Allys, später auch Gegner): Werte, Aktionen, Reaktionen, Start-Effekte.
import type { Area } from './facing';
import { INITIATIVE_ID, type Adjustment, type AutoChange, type EffectDuration } from './resources';

/** Individuelle Ressource eines Charakters mit seinen eigenen Werten. */
export interface CharacterResource {
  resourceId: string;
  hasMax: boolean;
  max: number;
  start: number;
  changes: AutoChange[];
  adjustments: Adjustment[];
}

/** Benannte Aktion: pro Zug kann genau eine ihrer Fähigkeiten gewählt werden (bis zu maxUses-mal). */
export interface CharacterAction {
  name: string;
  abilities: { abilityId: string | null; maxUses: number }[];
}

/** Reaktion: Fähigkeiten mit Auslöser, begrenzt pro Runde/Level oder unbegrenzt. */
export interface CharacterReaction {
  name: string;
  abilityIds: string[];
  limit: 'runde' | 'level' | 'unbegrenzt';
  count: number;
}

export interface CharacterFields {
  typeIds: string[];
  /** Ist ein Hindernis und belegt seine Felder. */
  collision: boolean;
  /** Sicht im Nebel (relativ zur Blickrichtung). */
  sightArea: Area;
  backpackSlots: number;
  startItems: { objectId: string | null; count: number }[];
  resources: CharacterResource[];
  actions: CharacterAction[];
  reactions: CharacterReaction[];
  startEffects: { effectId: string | null; duration: EffectDuration }[];
  immunities: { effectIds: string[]; typeIds: string[] };
}

export const newCharacterResource = (resourceId: string): CharacterResource => ({
  resourceId,
  hasMax: resourceId !== INITIATIVE_ID,
  max: 10,
  start: resourceId === INITIATIVE_ID ? 0 : 10,
  changes: [],
  adjustments: [],
});

export const DEFAULT_CHARACTER: CharacterFields = {
  typeIds: [],
  collision: true,
  sightArea: ['0,0'],
  backpackSlots: 4,
  startItems: [],
  resources: [newCharacterResource(INITIATIVE_ID)],
  actions: [{ name: 'Aktion 1', abilities: [] }],
  reactions: [],
  startEffects: [],
  immunities: { effectIds: [], typeIds: [] },
};

/** Ergänzt Standardwerte; Initiative ist immer vorhanden (und steht vorne), gelöschte Ressourcen fallen weg. */
export function normalizeCharacter(partial: unknown): CharacterFields {
  const p = (partial && typeof partial === 'object' ? partial : {}) as Partial<CharacterFields>;
  const resources = (p.resources ?? []).filter((r) => r && r.resourceId);
  const initiative = resources.find((r) => r.resourceId === INITIATIVE_ID) ?? newCharacterResource(INITIATIVE_ID);
  return {
    typeIds: p.typeIds ?? [],
    collision: p.collision ?? true,
    sightArea: p.sightArea ?? DEFAULT_CHARACTER.sightArea,
    backpackSlots: p.backpackSlots ?? DEFAULT_CHARACTER.backpackSlots,
    startItems: p.startItems ?? [],
    resources: [initiative, ...resources.filter((r) => r.resourceId !== INITIATIVE_ID)],
    actions: p.actions ?? structuredClone(DEFAULT_CHARACTER.actions),
    reactions: p.reactions ?? [],
    startEffects: p.startEffects ?? [],
    immunities: { effectIds: p.immunities?.effectIds ?? [], typeIds: p.immunities?.typeIds ?? [] },
  };
}

/** Größe als ganze Zahl ≥ 1 (Größe 2 = 2×2 Felder). */
export const tileSize = (size: unknown) => Math.max(1, Math.round(Number(size) || 1));
