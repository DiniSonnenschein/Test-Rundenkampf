// Regelwerk: alle einstellbaren Grundregeln eines Kampfes.
// Fest (nicht einstellbar) sind: quadratisches Raster, Nebel & Laterne, Platzierung vor dem Kampf,
// feste Initiative-Reihenfolge, Züge aus Aktionen und Sieg durch Erreichen der Siegfelder.

export type LightShape = 'kreis' | 'quadrat';
export type TieBreak = 'allys-zuerst' | 'gegner-zuerst' | 'abwechselnd';
export type KoMode = 'bewusstlos' | 'tot';

export interface InitiativeCriterion {
  /** Ressource/Wert, der in die Initiative einfließt (ab Abschnitt 3). */
  resourceId: string | null;
  factor: number;
}

export interface Rules {
  /** Diagonale Bewegung erlaubt. */
  diagonal: boolean;
  /** Diagonal an Hindernis-Ecken vorbei bewegen erlaubt. */
  cornerCutting: boolean;
  light: {
    /** Standard-Radius der Laterne (kann je Ally später abweichen). */
    lanternRadius: number;
    shape: LightShape;
    /** Sichtblockierende Felder werfen Schatten. */
    blockedBySight: boolean;
    /** Wie weit jeder Ally ohne Licht sieht (0 = nur das eigene Feld). */
    ownSight: number;
    /** Einmal gesehene Felder bleiben (ohne Figuren) aufgedeckt. */
    rememberExplored: boolean;
  };
  initiative: {
    /** Initiative-Wert = Summe aus Wert × Faktor. */
    criteria: InitiativeCriterion[];
    tieBreak: TieBreak;
  };
  /** Reguläre Züge pro Charakter und Runde. */
  turnsPerRound: number;
  ko: {
    /** Ressource, bei deren Erreichen von 0 ein Charakter K.O. geht (z. B. LP). */
    resourceId: string | null;
    allies: KoMode;
    enemies: KoMode;
    /** Bewusstlose Allys müssen für den Sieg kein Siegfeld erreichen. */
    unconsciousExcludedFromVictory: boolean;
    /** Niederlage, wenn der Laternenträger K.O. geht. */
    defeatOnLanternLoss: boolean;
  };
}

export const DEFAULT_RULES: Rules = {
  diagonal: true,
  cornerCutting: false,
  light: { lanternRadius: 3, shape: 'kreis', blockedBySight: true, ownSight: 0, rememberExplored: true },
  initiative: { criteria: [], tieBreak: 'allys-zuerst' },
  turnsPerRound: 1,
  ko: {
    resourceId: null,
    allies: 'bewusstlos',
    enemies: 'tot',
    unconsciousExcludedFromVictory: true,
    defeatOnLanternLoss: false,
  },
};

/** Ergänzt fehlende Werte (z. B. aus älteren Spielständen) mit den Standardwerten. */
export function normalizeRules(partial: unknown): Rules {
  const p = (partial && typeof partial === 'object' ? partial : {}) as Partial<Rules>;
  return {
    ...DEFAULT_RULES,
    ...p,
    light: { ...DEFAULT_RULES.light, ...p.light },
    initiative: { ...DEFAULT_RULES.initiative, ...p.initiative },
    ko: { ...DEFAULT_RULES.ko, ...p.ko },
  };
}
