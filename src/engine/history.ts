// Verlauf für „Züge rückgängig machen“: Zustand zu Beginn jedes Zuges.
import type { BattleState } from './battle';

const MAX = 300;

/** Merkt sich den Zustand, wenn ein neuer Zug begonnen hat. */
export function recordTurn(history: BattleState[], s: BattleState): BattleState[] {
  if (!s.turn) return history;
  const last = history[history.length - 1];
  if (last && last.round === s.round && last.queue.length === s.queue.length && last.turn?.unitId === s.turn.unitId) {
    return history;
  }
  return [...history, s].slice(-MAX);
}

/** Zurück zum Beginn des n-letzten Zuges (1 = Beginn des aktuellen bzw. letzten Zuges). */
export function undoTurns(history: BattleState[], n: number): { state: BattleState; history: BattleState[] } | null {
  if (history.length === 0 || n < 1) return null;
  const index = Math.max(0, history.length - n);
  return { state: history[index], history: history.slice(0, index + 1) };
}
