// Kleine Navigation über den URL-Hash, damit die Android-Zurück-Taste funktioniert.
import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function currentIndex(): number {
  return (history.state as { idx?: number } | null)?.idx ?? 0;
}

if (!history.state || typeof history.state.idx !== 'number') {
  history.replaceState({ idx: 0 }, '', location.hash || '#/');
}
window.addEventListener('popstate', emit);

function currentPath(): string {
  return location.hash.replace(/^#\/?/, '');
}

export function useRoute(): string[] {
  const path = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    currentPath,
  );
  return path ? path.split('/').map(decodeURIComponent) : [];
}

export function navigate(path: string, replace = false) {
  const url = `#/${path}`;
  if (replace) history.replaceState({ idx: currentIndex() }, '', url);
  else history.pushState({ idx: currentIndex() + 1 }, '', url);
  window.scrollTo(0, 0);
  emit();
}

/** Zurück in der App; ohne Vorgeschichte (z. B. nach Neuladen) zur übergeordneten Seite. */
export function goBack(fallback: string) {
  if (currentIndex() > 0) history.back();
  else navigate(fallback, true);
}

export const routes = {
  start: () => '',
  settings: () => 'einstellungen',
  create: () => 'erstellen',
  list: (key: string, folderId: string | null = null) =>
    folderId ? `liste/${key}/ordner/${encodeURIComponent(folderId)}` : `liste/${key}`,
  entry: (key: string, id: string) => `eintrag/${key}/${encodeURIComponent(id)}`,
  map: (levelId: string) => `karte/${encodeURIComponent(levelId)}`,
  game: (saveId: string) => `spiel/${encodeURIComponent(saveId)}`,
};
