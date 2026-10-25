// Charakter-Editor für Allys (Gegner nutzen ihn später mit zusätzlichen Feldern).
import { sortEntries } from '../../data/collection';
import type { Entry } from '../../data/model';
import { useCollection } from '../../data/store';
import {
  newCharacterResource, normalizeCharacter, type CharacterAction, type CharacterFields, type CharacterReaction, type CharacterResource,
} from '../../engine/characters';
import { INITIATIVE_ID, normalizeResource } from '../../engine/resources';
import { AreaPicker } from '../../ui/AreaPicker';
import { useDialog } from '../../ui/Dialog';
import { Choice, RefSelect, Stepper, Toggle } from '../../ui/fields';
import { MultiRefPicker, TypePicker } from '../../ui/pickers';
import type { EditorProps } from './index';
import { AdjustmentsCard, ChangesCard } from './ResourceEditor';
import { DurationPicker, SubCard } from './shared';

function ResourcesCard({ resources, set }: { resources: CharacterResource[]; set: (r: CharacterResource[]) => void }) {
  const col = useCollection('ressourcen');
  const dialog = useDialog();
  const name = (id: string) => col.entries.find((e) => e.id === id)?.title ?? '?';
  const individual = sortEntries(col.entries.filter((e) => normalizeResource(e).scope === 'individuell'));
  const available = individual.filter((e) => !resources.some((r) => r.resourceId === e.id));
  const edit = (i: number, patch: Partial<CharacterResource>) => set(resources.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function add() {
    if (!available.length) {
      await dialog.confirm({ title: 'Keine weiteren Ressourcen', message: 'Lege zuerst weitere individuelle Ressourcen an.', confirmLabel: 'OK' });
      return;
    }
    const id = await dialog.menu({ title: 'Ressource hinzufügen', items: available.map((e) => ({ label: e.title, value: e.id })) });
    if (id) set([...resources, newCharacterResource(id)]);
  }

  return (
    <section className="card fields">
      <h2>Ressourcen</h2>
      <p className="muted small">Individuelle Ressourcen mit den Werten dieses Charakters. Initiative ist immer dabei.</p>
      {resources.map((r, i) => {
        const body = (
          <>
            <Toggle label="Hat ein Maximum" checked={r.hasMax} onChange={(hasMax) => edit(i, { hasMax })} />
            {r.hasMax && <Stepper value={r.max} min={0} onChange={(max) => edit(i, { max })} />}
            <label className="field-label">Startwert</label>
            <Stepper value={r.start} min={0} onChange={(start) => edit(i, { start })} />
            <ChangesCard embedded changes={r.changes} intervals={['zug', 'runde', 'level']} onChange={(changes) => edit(i, { changes })} />
            <AdjustmentsCard embedded adjustments={r.adjustments} onChange={(adjustments) => edit(i, { adjustments })} />
          </>
        );
        return r.resourceId === INITIATIVE_ID ? (
          <div key={r.resourceId} className="sub-card">
            <span className="field-label">{name(r.resourceId)} (fest)</span>
            {body}
          </div>
        ) : (
          <SubCard key={r.resourceId} title={name(r.resourceId)} onRemove={() => set(resources.filter((_, j) => j !== i))}>
            {body}
          </SubCard>
        );
      })}
      <button className="btn" onClick={add}>+ Ressource</button>
    </section>
  );
}

function ActionsCard({ actions, set }: { actions: CharacterAction[]; set: (a: CharacterAction[]) => void }) {
  const col = useCollection('faehigkeiten');
  const dialog = useDialog();
  const name = (id: string | null) => col.entries.find((e) => e.id === id)?.title ?? '(gelöscht)';
  const edit = (i: number, patch: Partial<CharacterAction>) => set(actions.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  async function addAbility(i: number) {
    const options = sortEntries(col.entries.filter((e) => !actions[i].abilities.some((a) => a.abilityId === e.id)));
    if (!options.length) {
      await dialog.confirm({ title: 'Keine Fähigkeiten verfügbar', message: 'Lege zuerst Fähigkeiten an.', confirmLabel: 'OK' });
      return;
    }
    const id = await dialog.menu({ title: 'Fähigkeit hinzufügen', items: options.map((e) => ({ label: e.title, value: e.id })) });
    if (id) edit(i, { abilities: [...actions[i].abilities, { abilityId: id, maxUses: 1 }] });
  }

  return (
    <section className="card fields">
      <h2>Aktionen</h2>
      <p className="muted small">
        Im Zug erscheinen alle Aktionen um den Charakter (beliebige Reihenfolge). Pro Aktion und Zug kann genau eine ihrer Fähigkeiten gewählt
        werden – bis zu ihrer maximalen Nutzungszahl. Der Zug kann jederzeit beendet werden.
      </p>
      {actions.map((a, i) => (
        <SubCard key={i} title={`Aktion ${i + 1}`} onRemove={() => set(actions.filter((_, j) => j !== i))}>
          <input className="input" value={a.name} aria-label="Name der Aktion" onChange={(e) => edit(i, { name: e.target.value })} />
          {a.abilities.map((ab, k) => (
            <div key={k} className="ability-row">
              <span className="ability-name">{name(ab.abilityId)}</span>
              <span className="muted small">max.</span>
              <Stepper
                value={ab.maxUses}
                min={1}
                onChange={(maxUses) => edit(i, { abilities: a.abilities.map((x, j) => (j === k ? { ...x, maxUses } : x)) })}
              />
              <button className="icon-btn" aria-label="Entfernen" onClick={() => edit(i, { abilities: a.abilities.filter((_, j) => j !== k) })}>✕</button>
            </div>
          ))}
          <button className="btn btn-small" onClick={() => addAbility(i)}>+ Fähigkeit</button>
        </SubCard>
      ))}
      <button className="btn" onClick={() => set([...actions, { name: `Aktion ${actions.length + 1}`, abilities: [] }])}>+ Aktion</button>
    </section>
  );
}

function ReactionsCard({ reactions, set }: { reactions: CharacterReaction[]; set: (r: CharacterReaction[]) => void }) {
  const edit = (i: number, patch: Partial<CharacterReaction>) => set(reactions.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <section className="card fields">
      <h2>Reaktionen</h2>
      <p className="muted small">
        Kleine Zwischen-Züge (keine Züge, keine Aktion), die durch ein Ereignis einmalig ausgelöst werden. Ausgelöst werden sie über die
        Auslöser der enthaltenen Fähigkeiten.
      </p>
      {reactions.map((r, i) => (
        <SubCard key={i} title={`Reaktion ${i + 1}`} onRemove={() => set(reactions.filter((_, j) => j !== i))}>
          <input className="input" value={r.name} aria-label="Name der Reaktion" onChange={(e) => edit(i, { name: e.target.value })} />
          <MultiRefPicker collection="faehigkeiten" addLabel="Fähigkeit" value={r.abilityIds} onChange={(abilityIds) => edit(i, { abilityIds })} />
          <span className="field-label">Nutzbar</span>
          <Choice<CharacterReaction['limit']>
            value={r.limit}
            options={[{ value: 'runde', label: 'Pro Runde' }, { value: 'level', label: 'Pro Level' }, { value: 'unbegrenzt', label: 'Unbegrenzt' }]}
            onChange={(limit) => edit(i, { limit })}
          />
          {r.limit !== 'unbegrenzt' && <Stepper value={r.count} min={1} onChange={(count) => edit(i, { count })} />}
        </SubCard>
      ))}
      <button className="btn" onClick={() => set([...reactions, { name: `Reaktion ${reactions.length + 1}`, abilityIds: [], limit: 'runde', count: 1 }])}>
        + Reaktion
      </button>
    </section>
  );
}

export function CharacterEditor({ entry, set }: EditorProps) {
  const c = normalizeCharacter(entry);
  const update = (patch: Partial<CharacterFields>) => set({ ...c, ...patch } as unknown as Partial<Entry>);
  const items = c.startItems;

  return (
    <>
      <section className="card fields">
        <h2>Grundsätzliches</h2>
        <span className="field-label">Typen</span>
        <TypePicker list="typen-charaktere" value={c.typeIds} onChange={(typeIds) => update({ typeIds })} />
        <Toggle label="Kollision" hint="Ist ein Hindernis und belegt seine Felder" checked={c.collision} onChange={(collision) => update({ collision })} />
        <label className="field-label">Rucksackplätze</label>
        <Stepper value={c.backpackSlots} min={0} onChange={(backpackSlots) => update({ backpackSlots })} />
        <span className="field-label">Start-Gegenstände</span>
        {items.map((it, i) => (
          <div key={i} className="ability-row">
            <RefSelect
              collection="objekte"
              value={it.objectId}
              emptyLabel="– Gegenstand –"
              onChange={(objectId) => update({ startItems: items.map((x, j) => (j === i ? { ...x, objectId } : x)) })}
            />
            <Stepper value={it.count} min={1} onChange={(count) => update({ startItems: items.map((x, j) => (j === i ? { ...x, count } : x)) })} />
            <button className="icon-btn" aria-label="Entfernen" onClick={() => update({ startItems: items.filter((_, j) => j !== i) })}>✕</button>
          </div>
        ))}
        <button className="btn btn-small" onClick={() => update({ startItems: [...items, { objectId: null, count: 1 }] })}>+ Gegenstand</button>
      </section>

      <section className="card fields">
        <h2>Sicht im Nebel</h2>
        <p className="muted small">Was der Charakter ohne Licht sieht (dreht mit der Blickrichtung). Schattenwerfende Objekte verdecken.</p>
        <AreaPicker value={c.sightArea} onChange={(sightArea) => update({ sightArea })} />
      </section>

      <ResourcesCard resources={c.resources} set={(resources) => update({ resources })} />
      <ActionsCard actions={c.actions} set={(actions) => update({ actions })} />
      <ReactionsCard reactions={c.reactions} set={(reactions) => update({ reactions })} />

      <section className="card fields">
        <h2>Start-Effekte</h2>
        <p className="muted small">Effekte, die nur dieser Charakter ab Spielbeginn hat.</p>
        {c.startEffects.map((fx, i) => (
          <SubCard key={i} title={`Start-Effekt ${i + 1}`} onRemove={() => update({ startEffects: c.startEffects.filter((_, j) => j !== i) })}>
            <RefSelect
              collection="effekte"
              value={fx.effectId}
              emptyLabel="– Effekt wählen –"
              onChange={(effectId) => update({ startEffects: c.startEffects.map((x, j) => (j === i ? { ...x, effectId } : x)) })}
            />
            <DurationPicker value={fx.duration} onChange={(duration) => update({ startEffects: c.startEffects.map((x, j) => (j === i ? { ...x, duration } : x)) })} />
          </SubCard>
        ))}
        <button className="btn" onClick={() => update({ startEffects: [...c.startEffects, { effectId: null, duration: { kind: 'unendlich' } }] })}>
          + Start-Effekt
        </button>
      </section>

      <section className="card fields">
        <h2>Effekt-Ausnahmen</h2>
        <p className="muted small">Von diesen Effekten bzw. Effekt-Typen kann der Charakter nicht betroffen sein.</p>
        <MultiRefPicker collection="effekte" addLabel="Effekt" value={c.immunities.effectIds} onChange={(effectIds) => update({ immunities: { ...c.immunities, effectIds } })} />
        <TypePicker list="typen-aktionen" value={c.immunities.typeIds} onChange={(typeIds) => update({ immunities: { ...c.immunities, typeIds } })} />
      </section>
    </>
  );
}
