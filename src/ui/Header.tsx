import type { ReactNode } from 'react';
import { goBack } from '../router';

/** Kopfzeile mit Zurück-Pfeil, Titel und optionalen Aktionen rechts. */
export function Header({ title, back, actions }: { title: ReactNode; back?: string; actions?: ReactNode }) {
  return (
    <header className="topbar">
      {back !== undefined && (
        <button className="icon-btn" aria-label="Zurück" onClick={() => goBack(back)}>
          ←
        </button>
      )}
      <h1 className="topbar-title">{title}</h1>
      {actions && <div className="topbar-actions">{actions}</div>}
    </header>
  );
}
