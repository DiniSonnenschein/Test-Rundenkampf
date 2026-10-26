// Dungeons: Stationen (Level) mit Verzweigungen und optionalen Zwischenstationen.
import type { EffectDuration } from './resources';

/** Preis je Objekt-Typ bzw. je Objekt (Sonderpreis geht vor). */
export interface Price {
  buy: number;
  sell: number;
}

export type InterludeBlock =
  /** Rast: individuelle Ressourcen für alle Allys, globale für den Pool. */
  | { kind: 'rast'; changes: { resourceId: string | null; amount: number }[] }
  /** Belohnung; der Spieler wählt, welcher Ally sie bekommt. Optional „wähle X aus diesen“. */
  | { kind: 'belohnung'; items: { objectId: string | null; count: number }[]; choose: { on: boolean; count: number } }
  | { kind: 'effekte'; action: 'vergeben' | 'beenden'; effectId: string | null; typeIds: string[]; duration: EffectDuration }
  /** Rucksäcke ordnen und Gegenstände zwischen Allys tauschen. */
  | { kind: 'rucksack' }
  /** Händler: kaufen und verkaufen mit einer globalen Ressource. */
  | {
      kind: 'haendler';
      currencyId: string | null;
      typePrices: ({ typeId: string | null } & Price)[];
      objectPrices: ({ objectId: string | null } & Price)[];
      /** Angebot; stock null = unbegrenzt. */
      offers: { objectId: string | null; stock: number | null }[];
      /** Der Händler kauft auch an (alles, wofür er einen Preis hat). */
      selling: boolean;
    }
  /** Ereignis mit Text (nur zum Lesen). */
  | { kind: 'text'; title: string; text: string };

export interface DungeonStation {
  id: string;
  name: string;
  levelId: string | null;
  /** Mögliche Folgestationen (mehrere = der Spieler wählt; keine = Ende, Run gewonnen). */
  next: string[];
  /** Zwischenstation nach diesem Level. */
  interlude: InterludeBlock[];
}

export interface DungeonFields {
  stations: DungeonStation[];
}

export function normalizeDungeon(partial: unknown): DungeonFields {
  const p = (partial && typeof partial === 'object' ? partial : {}) as Partial<DungeonFields>;
  const stations = p.stations ?? [];
  const ids = new Set(stations.map((s) => s.id));
  // Verweise auf gelöschte Stationen fallen weg.
  const block = (b: InterludeBlock): InterludeBlock => (b.kind === 'haendler' ? { ...b, selling: b.selling ?? true } : b);
  return { stations: stations.map((s) => ({ ...s, next: s.next.filter((n) => ids.has(n)), interlude: (s.interlude ?? []).map(block) })) };
}

export const startStation = (d: DungeonFields) => d.stations[0] ?? null;
export const isEnd = (s: DungeonStation) => s.next.length === 0;

/** Stationen, die vom Start aus nicht erreichbar sind. */
export function unreachable(d: DungeonFields): DungeonStation[] {
  const start = startStation(d);
  if (!start) return [];
  const seen = new Set([start.id]);
  const queue = [start];
  while (queue.length) {
    const s = queue.shift()!;
    for (const n of s.next) {
      const next = d.stations.find((x) => x.id === n);
      if (next && !seen.has(n)) {
        seen.add(n);
        queue.push(next);
      }
    }
  }
  return d.stations.filter((s) => !seen.has(s.id));
}

/** Gibt es einen Weg vom Start zu einem Ende? (Sonst endet der Dungeon nie.) */
export function hasEnding(d: DungeonFields): boolean {
  const reachable = new Set(d.stations.map((s) => s.id));
  for (const s of unreachable(d)) reachable.delete(s.id);
  return d.stations.some((s) => reachable.has(s.id) && isEnd(s));
}

export function validateDungeon(d: DungeonFields): string[] {
  const w: string[] = [];
  if (!d.stations.length) return ['Noch keine Level im Dungeon.'];
  const noLevel = d.stations.filter((s) => !s.levelId);
  if (noLevel.length) w.push(`${noLevel.length} Station${noLevel.length === 1 ? '' : 'en'} ohne Level.`);
  const lost = unreachable(d);
  if (lost.length) w.push(`Nicht erreichbar: ${lost.map((s) => s.name || 'Ohne Namen').join(', ')}.`);
  if (!hasEnding(d)) w.push('Kein Ende erreichbar – der Dungeon endet nie.');
  return w;
}

/** Preis eines Objekts beim Händler: Sonderpreis vor Typ-Preis; ohne Preis nicht handelbar (null). */
export function priceFor(
  m: Extract<InterludeBlock, { kind: 'haendler' }>,
  objectId: string,
  objectTypeIds: string[],
): Price | null {
  const special = m.objectPrices.find((p) => p.objectId === objectId);
  if (special) return { buy: special.buy, sell: special.sell };
  const byType = m.typePrices.find((p) => p.typeId && objectTypeIds.includes(p.typeId));
  return byType ? { buy: byType.buy, sell: byType.sell } : null;
}
