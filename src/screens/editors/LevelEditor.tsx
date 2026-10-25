// Level-Einstellungen: Größe, Grundboden, Farben, Vorschau und Prüfung. Die Map selbst wird im Map-Editor bearbeitet.
import type { Entry } from '../../data/model';
import { MAX_LEVEL_SIZE, normalizeLevel, resize, validateLevel, type LevelColors, type LevelFields } from '../../engine/level';
import { navigate, routes } from '../../router';
import { ColorField } from '../../ui/ColorField';
import { RefSelect, Stepper } from '../../ui/fields';
import { MapView } from '../level/MapView';
import { useLookups } from '../level/useTemplates';
import type { EditorProps } from './index';

export function LevelEditor({ entry, set }: EditorProps) {
  const l = normalizeLevel(entry);
  const lookups = useLookups();
  const update = (next: LevelFields) => set(next as unknown as Partial<Entry>);
  const setColors = (patch: Partial<LevelColors>) => update({ ...l, colors: { ...l.colors, ...patch } });
  // „Bedingt begehbar“ zählt hier als begehbar.
  const warnings = validateLevel(l, lookups.tpl, (id) => lookups.terrain(id)?.walkable !== 'nein');

  return (
    <>
      <section className="card fields">
        <h2>Map</h2>
        <button className="map-preview" onClick={() => navigate(routes.map(entry.id))} aria-label="Map bearbeiten">
          <MapView level={l} lookups={lookups} />
        </button>
        <button className="btn btn-primary" onClick={() => navigate(routes.map(entry.id))}>Map bearbeiten</button>
        <button className="btn" disabled>Level testen (ab Abschnitt 13)</button>
      </section>

      <section className="card fields">
        <h2>Prüfung</h2>
        <ul className="warnings">
          {warnings.map((w) => (
            <li key={w} className={w.includes('reicht für') ? 'muted' : 'warn'}>{w}</li>
          ))}
        </ul>
      </section>

      <section className="card fields">
        <h2>Größe & Grundboden</h2>
        <label className="field-label">Breite</label>
        <Stepper value={l.width} min={1} max={MAX_LEVEL_SIZE} onChange={(w) => update(resize(l, w, l.height))} />
        <label className="field-label">Höhe</label>
        <Stepper value={l.height} min={1} max={MAX_LEVEL_SIZE} onChange={(h) => update(resize(l, l.width, h))} />
        <p className="muted small">Beim Verkleinern fällt weg, was außerhalb liegt.</p>
        <label className="field-label" htmlFor="base">Grundboden</label>
        <RefSelect id="base" collection="gelaende" value={l.baseTerrainId} emptyLabel="– Geländeart wählen –" onChange={(baseTerrainId) => update({ ...l, baseTerrainId })} />
      </section>

      <section className="card fields">
        <h2>Farben</h2>
        <p className="muted small">Hell und dunkel ordnet der Editor selbst zu. Andere Geländearten behalten ihre eigenen Farben.</p>
        <ColorField label="Standardfelder 1" value={l.colors.standard[0]} onChange={(c) => setColors({ standard: [c, l.colors.standard[1]] })} />
        <ColorField label="Standardfelder 2" value={l.colors.standard[1]} onChange={(c) => setColors({ standard: [l.colors.standard[0], c] })} />
        <ColorField label="Laternen-Startfeld" value={l.colors.lantern} onChange={(lantern) => setColors({ lantern })} />
        <ColorField label="Siegfelder 1" value={l.colors.victory[0]} onChange={(c) => setColors({ victory: [c, l.colors.victory[1]] })} />
        <ColorField label="Siegfelder 2" value={l.colors.victory[1]} onChange={(c) => setColors({ victory: [l.colors.victory[0], c] })} />
        <ColorField label="Hintergrund / kein Feld" value={l.colors.background} onChange={(background) => setColors({ background })} />
      </section>
    </>
  );
}
