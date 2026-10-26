// Zwischenstation nach einem Dungeon-Level: Rast, Belohnung, Effekte, Rucksäcke, Händler, Text.
import { titleOf } from '../../engine/defs';
import {
  allItems, buy, claimReward, interludeBlocks, moveItem, price, resetInterlude, rewardsLeft, sell, stockLeft, toggleCarried, unclaimedRewards,
} from '../../engine/interlude';
import { nextLevel, type RunState } from '../../engine/run';
import { routes } from '../../router';
import { useDialog } from '../../ui/Dialog';
import { Header } from '../../ui/Header';

export function InterludeView({ run, setRun }: { run: RunState; setRun: (r: RunState) => void }) {
  const dialog = useDialog();
  const defs = run.defs;
  const i = run.interlude!;
  const station = defs.dungeon?.stations.find((s) => s.id === i.stationId);
  const blocks = interludeBlocks(run);
  const name = (memberId: string) => titleOf(defs, run.team.find((m) => m.memberId === memberId)?.allyId);
  const globals = Object.entries(run.globals).filter(([rid]) => defs.resources[rid]);
  const hasPack = blocks.some((b) => b.kind === 'rucksack');

  async function pickAlly(title: string, exclude?: string): Promise<string | null> {
    const items = run.team.filter((m) => m.memberId !== exclude).map((m) => ({ label: name(m.memberId), value: m.memberId }));
    if (items.length === 1) return items[0].value;
    return dialog.menu({ title, items });
  }

  async function leave(stationId?: string) {
    const open = unclaimedRewards(run);
    if (open > 0) {
      const ok = await dialog.confirm({
        title: 'Belohnungen liegen lassen?',
        message: `${open} Belohnung${open === 1 ? '' : 'en'} wurde${open === 1 ? '' : 'n'} noch nicht vergeben.`,
        confirmLabel: 'Trotzdem weiter',
      });
      if (!ok) return;
    }
    setRun(nextLevel(run, stationId));
  }

  return (
    <main className="screen interlude">
      <Header title={station?.name ? `Rast – ${station.name}` : 'Zwischenstation'} back={routes.start()} />
      {globals.length > 0 && (
        <div className="globals interlude-globals">
          {globals.map(([rid, v]) => (
            <span key={rid} className="global-chip">{defs.resources[rid].title} {v}</span>
          ))}
        </div>
      )}

      {blocks.map((b, bi) => {
        switch (b.kind) {
          case 'text':
            return (
              <section key={bi} className="card">
                {b.title && <h2>{b.title}</h2>}
                <p className="pre-line">{b.text}</p>
              </section>
            );
          case 'rast':
            return (
              <section key={bi} className="card">
                <h2>Rast</h2>
                <p className="small">
                  {b.changes
                    .filter((c) => c.resourceId && defs.resources[c.resourceId])
                    .map((c) => `${defs.resources[c.resourceId!].title} ${c.amount >= 0 ? '+' : ''}${c.amount}`)
                    .join(' · ') || 'Nichts passiert.'}
                </p>
              </section>
            );
          case 'effekte':
            return (
              <section key={bi} className="card">
                <h2>{b.action === 'vergeben' ? 'Effekt erhalten' : 'Effekte enden'}</h2>
                <p className="small">
                  {b.action === 'vergeben'
                    ? `Alle Allys erhalten ${titleOf(defs, b.effectId)}.`
                    : `Bei allen Allys endet: ${[...(b.effectId ? [titleOf(defs, b.effectId)] : []), ...b.typeIds.map((t) => titleOf(defs, t))].join(', ')}.`}
                </p>
              </section>
            );
          case 'belohnung': {
            const left = rewardsLeft(run, bi);
            return (
              <section key={bi} className="card fields">
                <h2>Belohnung</h2>
                <p className="muted small">{b.choose.on ? `Wähle ${b.choose.count} – noch ${Math.max(0, left)}.` : 'Antippen, um sie einem Ally zu geben.'}</p>
                {b.items.map((it, ii) => {
                  if (!it.objectId) return null;
                  const done = i.claimed.includes(`${bi}|${ii}`);
                  return (
                    <div key={ii} className="trade-row">
                      <span>{it.count}× {titleOf(defs, it.objectId)}</span>
                      <button
                        className="btn btn-small"
                        disabled={done || left <= 0}
                        onClick={async () => {
                          const m = await pickAlly('Wer bekommt es?');
                          if (m) setRun(claimReward(run, bi, ii, m));
                        }}
                      >
                        {done ? 'Vergeben ✓' : 'Nehmen'}
                      </button>
                    </div>
                  );
                })}
              </section>
            );
          }
          case 'haendler': {
            const money = b.currencyId ? run.globals[b.currencyId] ?? 0 : 0;
            const cur = titleOf(defs, b.currencyId);
            const sellable = b.selling
              ? run.team.flatMap((m) => allItems(m).map((it) => ({ m: m.memberId, it, p: price(run, bi, it.objectId) }))).filter((x) => x.p)
              : [];
            return (
              <section key={bi} className="card fields">
                <h2>Händler</h2>
                <p className="muted small">Du hast {money} {cur}.</p>
                {b.offers.map((o, oi) => {
                  if (!o.objectId) return null;
                  const p = price(run, bi, o.objectId);
                  const stock = stockLeft(run, bi, oi);
                  return (
                    <div key={oi} className="trade-row">
                      <span>
                        {titleOf(defs, o.objectId)}
                        <span className="muted small"> · {p ? `${p.buy} ${cur}` : 'kein Preis'}{stock !== null ? ` · noch ${stock}` : ''}</span>
                      </span>
                      <button
                        className="btn btn-small"
                        disabled={!p || money < p.buy || (stock !== null && stock <= 0)}
                        onClick={async () => {
                          const m = await pickAlly('Wer bekommt es?');
                          if (m) setRun(buy(run, bi, oi, m));
                        }}
                      >
                        Kaufen
                      </button>
                    </div>
                  );
                })}
                {b.selling && (
                  <>
                    <span className="field-label">Verkaufen</span>
                    {sellable.length === 0 && <p className="muted small">Nichts, wofür der Händler etwas zahlt.</p>}
                    {sellable.map(({ m, it, p }) => (
                      <div key={`${m}-${it.objectId}`} className="trade-row">
                        <span>
                          {name(m)}: {it.count}× {titleOf(defs, it.objectId)}
                          <span className="muted small"> · {p!.sell} {cur}</span>
                        </span>
                        <button className="btn btn-small" onClick={() => setRun(sell(run, bi, m, it.objectId))}>Verkaufen</button>
                      </div>
                    ))}
                  </>
                )}
              </section>
            );
          }
          case 'rucksack':
            return null; // siehe Team
        }
      })}

      <section className="card fields">
        <h2>Team</h2>
        {hasPack && <p className="muted small">Gegenstände tauschen, wegwerfen oder zwischen Rucksack und Tragen wechseln.</p>}
        {run.team.map((m) => {
          const shown = Object.keys(m.values).filter((k) => defs.resources[k]?.display.show);
          const slots = defs.allys[m.allyId]?.backpackSlots ?? 0;
          const row = (objectId: string, count: number, carried: boolean) => (
            <div key={`${carried}-${objectId}`} className="trade-row">
              <span>
                {count}× {titleOf(defs, objectId)}
                {carried && <span className="muted small"> · getragen</span>}
              </span>
              {hasPack && (
                <span className="btn-group">
                  {run.team.length > 1 && (
                    <button
                      className="btn btn-small"
                      onClick={async () => {
                        const to = await pickAlly('Geben an …', m.memberId);
                        if (to) setRun(moveItem(run, m.memberId, to, objectId));
                      }}
                    >
                      Geben
                    </button>
                  )}
                  <button className="btn btn-small" aria-label={carried ? 'Einpacken' : 'Tragen'} onClick={() => setRun(toggleCarried(run, m.memberId, objectId))}>
                    {carried ? '🎒' : '✋'}
                  </button>
                  <button className="icon-btn" aria-label="Wegwerfen" onClick={() => setRun(moveItem(run, m.memberId, null, objectId))}>🗑</button>
                </span>
              )}
            </div>
          );
          return (
            <div key={m.memberId} className="sub-card">
              <strong>{name(m.memberId)}</strong>
              <p className="small">
                {shown.map((k) => `${defs.resources[k].title} ${m.values[k]}${m.maxValues[k] !== null && m.maxValues[k] !== undefined ? `/${m.maxValues[k]}` : ''}`).join(' · ')}
              </p>
              {m.effects.length > 0 && <p className="small muted">Effekte: {m.effects.map((e) => titleOf(defs, e.effectId)).join(', ')}</p>}
              <span className="muted small">Rucksack ({slots} Plätze)</span>
              {m.items.length === 0 && (m.carried ?? []).length === 0 && <span className="muted small">leer</span>}
              {m.items.map((it) => row(it.objectId, it.count, false))}
              {(m.carried ?? []).map((it) => row(it.objectId, it.count, true))}
            </div>
          );
        })}
      </section>

      <section className="card fields">
        {i.choices.length > 1 ? (
          <>
            <h2>Wie geht es weiter?</h2>
            {i.choices.map((sid) => (
              <button key={sid} className="btn btn-primary" onClick={() => leave(sid)}>
                {defs.dungeon?.stations.find((s) => s.id === sid)?.name || 'Weiter'}
              </button>
            ))}
          </>
        ) : (
          <button className="btn btn-primary" onClick={() => leave()}>Weiter ins nächste Level</button>
        )}
        <button className="btn" onClick={() => setRun(resetInterlude(run))}>↺ Zwischenstation zurücksetzen</button>
      </section>
    </main>
  );
}
