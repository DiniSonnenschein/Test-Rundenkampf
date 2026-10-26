// Spielstände: anlegen (höchstens 10 je Spiel bzw. je getestetem Level), zuletzt gespielter.
import { createEntry } from '../data/collection';
import { SPIELSTAENDE, type Entry } from '../data/model';
import { deleteEntry, getCollection, saveEntry } from '../data/store';
import type { RunState } from '../engine/run';
import { formatDate } from '../ui/format';

export const MAX_SAVES = 10;

/** Zu welchem Spiel bzw. Level-Test ein Spielstand gehört. */
const groupOf = (e: Entry) => (e.gameId ? `spiel:${String(e.gameId)}` : e.levelId ? `level:${String(e.levelId)}` : 'sonst');

/** Legt einen Spielstand an; ältere derselben Gruppe über der Grenze werden gelöscht. */
export function createSave(title: string, run: RunState, link: { gameId?: string; levelId?: string }): Entry {
  const save: Entry = { ...createEntry(SPIELSTAENDE, null), title: `${title} – ${formatDate(new Date().toISOString())}`, ...link, run };
  saveEntry(SPIELSTAENDE.key, save);
  const group = groupOf(save);
  const same = getCollection(SPIELSTAENDE.key)
    .entries.filter((e) => groupOf(e) === group)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const old of same.slice(MAX_SAVES)) if (old.id !== save.id) deleteEntry(SPIELSTAENDE.key, old.id);
  return save;
}

/** Der zuletzt gespielte Spielstand. */
export function latestSave(entries: Entry[]): Entry | undefined {
  return [...entries].filter((e) => e.run).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}
