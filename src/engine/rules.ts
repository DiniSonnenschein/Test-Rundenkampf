// Regelwerk: alle einstellbaren Grundregeln eines Kampfes.
// Fest (nicht einstellbar) sind: quadratisches Raster, 4 Blickrichtungen, Nebel & Laterne, Platzierung vor dem Kampf,
// feste Initiative-Reihenfolge, Züge aus Aktionen und Sieg, sobald alle Allys auf Siegfeldern stehen.
// Niemand stirbt: „Bewusstlos“ ist ein fester Effekt; zu lange oder zu viele Bewusstlose → Run verloren (Flucht).

export type LightShape = 'kreis' | 'quadrat';
export type TieBreak = 'allys-zuerst' | 'gegner-zuerst' | 'abwechselnd';
/** Wann sich Charaktere außerhalb ihres Zuges zur Quelle einer Fähigkeit/eines Effekts drehen. */
export type TurnWhenTargeted = 'nie' | 'gegnerisch' | 'alle' | 'typen';

/** Was mit individuellen Ressourcen der Allys beim Levelwechsel passiert. */
export type ResourceCarry = 'behalten' | 'start' | 'max';

export interface Rules {
  /** Diagonale Bewegung erlaubt. */
  diagonal: boolean;
  /** Diagonal an Hindernis-Ecken vorbei bewegen erlaubt. */
  cornerCutting: boolean;
  light: {
    /** Standard-Radius der Laterne. */
    lanternRadius: number;
    shape: LightShape;
    /** Einmal gesehene Felder bleiben (ohne Figuren) aufgedeckt. */
    rememberExplored: boolean;
  };
  /** Reihenfolge nach der festen Ressource „Initiative“; hier nur die Regel bei Gleichstand. */
  initiative: {
    tieBreak: TieBreak;
  };
  /** Reguläre Züge pro Charakter und Runde. */
  turnsPerRound: number;
  /** Effekte laufen beim Levelwechsel weiter (sonst enden alle). */
  effectsPersistAcrossLevels: boolean;
  /** Ressourcen beim Levelwechsel: Grundregel und Ausnahmen je Ressource. */
  betweenLevels: {
    resources: ResourceCarry;
    overrides: { resourceId: string | null; mode: ResourceCarry }[];
  };
  facing: {
    turnWhenTargeted: TurnWhenTargeted;
    /** Typen (Fähigkeiten & Effekte) für 'typen'. */
    typeIds: string[];
  };
  defeat: {
    /** Run verloren, wenn ein Ally so viele eigene Züge am Stück bewusstlos verpasst (0 = aus). */
    unconsciousTurns: number;
    /** Run verloren, sobald so viele Allys gleichzeitig bewusstlos sind ('alle' = das ganze Team). */
    unconsciousCount: number | 'alle';
  };
}

export const DEFAULT_RULES: Rules = {
  diagonal: true,
  cornerCutting: false,
  light: { lanternRadius: 3, shape: 'kreis', rememberExplored: true },
  initiative: { tieBreak: 'allys-zuerst' },
  turnsPerRound: 1,
  effectsPersistAcrossLevels: true,
  betweenLevels: { resources: 'behalten', overrides: [] },
  facing: { turnWhenTargeted: 'nie', typeIds: [] },
  defeat: { unconsciousTurns: 2, unconsciousCount: 'alle' },
};

/** Ergänzt fehlende Werte mit den Standardwerten und entfernt veraltete Einstellungen. */
export function normalizeRules(partial: unknown): Rules {
  const p = (partial && typeof partial === 'object' ? partial : {}) as Partial<Rules>;
  const d = DEFAULT_RULES;
  return {
    diagonal: p.diagonal ?? d.diagonal,
    cornerCutting: p.cornerCutting ?? d.cornerCutting,
    light: {
      lanternRadius: p.light?.lanternRadius ?? d.light.lanternRadius,
      shape: p.light?.shape ?? d.light.shape,
      rememberExplored: p.light?.rememberExplored ?? d.light.rememberExplored,
    },
    initiative: {
      tieBreak: p.initiative?.tieBreak ?? d.initiative.tieBreak,
    },
    turnsPerRound: p.turnsPerRound ?? d.turnsPerRound,
    effectsPersistAcrossLevels: p.effectsPersistAcrossLevels ?? d.effectsPersistAcrossLevels,
    betweenLevels: {
      resources: p.betweenLevels?.resources ?? d.betweenLevels.resources,
      overrides: p.betweenLevels?.overrides ?? [],
    },
    facing: {
      turnWhenTargeted: p.facing?.turnWhenTargeted ?? d.facing.turnWhenTargeted,
      typeIds: p.facing?.typeIds ?? [],
    },
    defeat: {
      unconsciousTurns: p.defeat?.unconsciousTurns ?? d.defeat.unconsciousTurns,
      unconsciousCount: p.defeat?.unconsciousCount ?? d.defeat.unconsciousCount,
    },
  };
}
