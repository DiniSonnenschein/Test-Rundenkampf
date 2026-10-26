import { navigate, routes } from '../router';
import { SPIELE, SPIELSTAENDE } from '../data/model';
import { useCollection } from '../data/store';
import { latestSave } from '../game/saves';

export function StartScreen() {
  const last = latestSave(useCollection(SPIELSTAENDE.key).entries);
  return (
    <main className="screen">
      <div className="start-top">
        <button className="icon-btn" aria-label="Einstellungen" onClick={() => navigate(routes.settings())}>
          ⚙
        </button>
      </div>
      <header className="start-title">
        <h1>Rundenkämpfe</h1>
        <p className="muted">Testumgebung für rundenbasierte Dungeon-Kämpfe</p>
      </header>
      <nav className="start-menu">
        {last && (
          <button className="btn btn-primary btn-big continue-btn" onClick={() => navigate(routes.game(last.id))}>
            Weiterspielen
            <span className="continue-sub">{last.title}</span>
          </button>
        )}
        <button className={`btn btn-big ${last ? '' : 'btn-primary'}`} onClick={() => navigate(routes.create())}>Erstellen</button>
        <button className="btn btn-big" onClick={() => navigate(routes.list(SPIELE.key))}>Neues Spiel</button>
        <button className="btn btn-big" onClick={() => navigate(routes.list(SPIELSTAENDE.key))}>Spielstand laden</button>
      </nav>
      <footer className="muted start-footer">Version {__APP_VERSION__}</footer>
    </main>
  );
}
