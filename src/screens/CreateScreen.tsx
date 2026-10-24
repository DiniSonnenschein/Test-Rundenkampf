import { BAUSTEINE } from '../data/model';
import { getCollection, useStoreVersion } from '../data/store';
import { Header } from '../ui/Header';
import { navigate, routes } from '../router';

export function CreateScreen() {
  useStoreVersion();
  return (
    <main className="screen">
      <Header title="Erstellen" back={routes.start()} />
      <div className="tiles">
        {BAUSTEINE.map((def) => (
          <button key={def.key} className="tile" onClick={() => navigate(routes.list(def.key))}>
            <span className="tile-icon">{def.icon}</span>
            <span className="tile-label">{def.label}</span>
            <span className="tile-count muted">{getCollection(def.key).entries.length}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
