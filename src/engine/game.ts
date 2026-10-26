// Spiel-Konfiguration („Neues Spiel“): was gespielt wird, mit wem und womit.
// Anpassungen hier gelten nur für diesen Test und ändern die Editoren nicht.
import type { CharacterFields, CharacterResource } from './characters';

export type GameContent =
  | { kind: 'dungeon'; dungeonId: string | null }
  | { kind: 'level'; levelId: string | null }
  /** Eigene Reihenfolge von Leveln (ohne Zwischenstationen); Level dürfen mehrfach vorkommen. */
  | { kind: 'levels'; levelIds: (string | null)[] };

export interface TeamMember {
  id: string;
  allyId: string | null;
  /** null = Start-Gegenstände wie im Ally-Editor. */
  items: { objectId: string | null; count: number }[] | null;
  /** Abweichende Werte je Ressource (fehlend = wie im Ally-Editor). */
  resources: Record<string, { start?: number; max?: number }>;
}

/** Ereignis zwischen Leveln: füllt eine Ressource wieder auf (individuell: alle Allys; global: der Pool). */
export interface LevelEvent {
  /** Nach jedem Level oder nur nach einem bestimmten. */
  after: 'jedem-level' | 'level';
  levelId: string | null;
  resourceId: string | null;
  /** Auf das Maximum, auf den Startwert oder um einen Betrag. */
  mode: 'max' | 'start' | 'betrag';
  amount: number;
}

export interface GameFields {
  regelwerkId: string | null;
  content: GameContent;
  /** Reihenfolge = Gleichstand-Regel unter Allys bei der Initiative. */
  team: TeamMember[];
  lanternMemberId: string | null;
  /** Abweichende Startwerte globaler Ressourcen. */
  globalStarts: Record<string, number>;
  levelEvents: LevelEvent[];
}

export const DEFAULT_GAME: GameFields = {
  regelwerkId: null,
  content: { kind: 'dungeon', dungeonId: null },
  team: [],
  lanternMemberId: null,
  globalStarts: {},
  levelEvents: [],
};

export function normalizeGame(partial: unknown): GameFields {
  const p = (partial && typeof partial === 'object' ? partial : {}) as Partial<GameFields>;
  const team = p.team ?? [];
  return {
    regelwerkId: p.regelwerkId ?? null,
    content: p.content ?? DEFAULT_GAME.content,
    team,
    lanternMemberId: team.some((m) => m.id === p.lanternMemberId) ? p.lanternMemberId! : null,
    globalStarts: p.globalStarts ?? {},
    levelEvents: p.levelEvents ?? [],
  };
}

/** Ressourcen eines Team-Mitglieds: Werte aus dem Ally-Editor mit den Anpassungen dieses Tests. */
export function memberResources(m: TeamMember, ally: Pick<CharacterFields, 'resources'>): CharacterResource[] {
  return ally.resources.map((r) => {
    const o = m.resources[r.resourceId];
    return o ? { ...r, start: o.start ?? r.start, max: o.max ?? r.max } : r;
  });
}

export function memberItems(m: TeamMember, ally: Pick<CharacterFields, 'startItems'>) {
  return m.items ?? ally.startItems;
}

/** Level, die (mindestens) gespielt werden können – bei Dungeons alle Stationen. */
export function contentLevels(c: GameContent, dungeonLevels: (dungeonId: string) => (string | null)[]): (string | null)[] {
  if (c.kind === 'level') return [c.levelId];
  if (c.kind === 'levels') return c.levelIds;
  return c.dungeonId ? dungeonLevels(c.dungeonId) : [];
}

export function validateGame(
  g: GameFields,
  info: {
    allyExists: (id: string | null) => boolean;
    dungeonLevels: (dungeonId: string) => (string | null)[];
    /** Anzahl Siegfelder eines Levels (undefined = Level fehlt). */
    victoryCount: (levelId: string) => number | undefined;
    levelName: (levelId: string) => string;
  },
): string[] {
  const w: string[] = [];
  const c = g.content;
  const levels = contentLevels(c, info.dungeonLevels);
  if ((c.kind === 'dungeon' && !c.dungeonId) || levels.length === 0) w.push('Noch kein Dungeon bzw. Level gewählt.');
  if (levels.some((id) => !id || info.victoryCount(id) === undefined)) w.push('Ein gewähltes Level fehlt.');
  if (g.team.length === 0) w.push('Das Team ist leer.');
  if (g.team.some((m) => !info.allyExists(m.allyId))) w.push('Im Team ist ein Ally, der gelöscht wurde.');
  if (g.team.length && !g.lanternMemberId) w.push('Niemand trägt die Laterne.');
  const tooFew = [...new Set(levels.filter((id): id is string => !!id))].filter((id) => (info.victoryCount(id) ?? Infinity) < g.team.length);
  for (const id of tooFew) w.push(`„${info.levelName(id)}“ hat weniger Siegfelder als Allys im Team – dort ist kein Sieg möglich.`);
  return w;
}
