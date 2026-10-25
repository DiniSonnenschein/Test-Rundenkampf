// Ereignisse während eines Kampfes – sie lösen Effekt-Auslöser/-Beendigungen, Reaktionen
// sowie Objekt- und Gelände-Wirkungen aus.
import type { Pos } from './grid';

export type GameEvent =
  | { kind: 'move'; unitId: string; from: Pos; to: Pos }
  | { kind: 'targeted'; targetId: string; sourceId: string; abilityId: string; typeIds: string[] }
  | { kind: 'used'; casterId: string; abilityId: string; typeIds: string[]; targetIds: string[] }
  | { kind: 'resource'; unitId: string; resourceId: string; before: number; after: number }
  | {
      kind: 'item';
      unitId: string;
      objectId: string;
      action: 'sammelt' | 'verwendet' | 'platziert' | 'vergeben' | 'geworfen';
      /** Ort (z. B. Aufprall beim Werfen, Platzieren). */
      at?: Pos;
    };

/** Wer eine Veränderung verursacht (für Schutz und „Ressource unveränderlich“). */
export interface Source {
  unitId?: string;
  side?: 'ally' | 'enemy';
  typeIds: string[];
  kind: 'faehigkeit' | 'effekt';
}

/** Eine ausgelöste Reaktion, die auf eine Entscheidung wartet (Allys) bzw. von der KI genutzt wird. */
export interface PendingReaction {
  unitId: string;
  reaction: number;
  abilityIds: string[];
  /** Auslösendes Geschehen (für die legalen Ziele „führt gerade aus“/„wird gerade Ziel“). */
  sourceId?: string;
  targetIds?: string[];
}
