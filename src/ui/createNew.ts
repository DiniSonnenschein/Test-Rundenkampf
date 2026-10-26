// „+ Neu … anlegen“ in Auswahllisten: legt einen Eintrag an und öffnet seinen Editor.
// Mit „Zurück“ geht es an die Stelle, von der man kam; dort ist der neue Eintrag schon ausgewählt.
import { createEntry } from '../data/collection';
import { getDef, type Entry } from '../data/model';
import { saveEntry } from '../data/store';
import { navigate, routes } from '../router';

export const NEW = '__neu__';

/** Menüpunkt bzw. Option für „neu anlegen“ (nur für Sammlungen, die man selbst anlegen kann). */
export function newOption(collection: string): { label: string; value: string } | null {
  const def = getDef(collection);
  return def?.creatable ? { label: `+ ${def.newTitle} anlegen …`, value: NEW } : null;
}

/** Legt einen Eintrag an (mit optionalen Vorgaben), öffnet seinen Editor und liefert die neue ID. */
export function createAndOpen(collection: string, defaults: Partial<Entry> = {}): string {
  const def = getDef(collection)!;
  const entry = { ...createEntry(def, null), ...defaults };
  saveEntry(def.key, entry);
  navigate(routes.entry(def.key, entry.id));
  return entry.id;
}
