// Spielmodus: Platzierung, Züge mit Aktionen-Ring, Zielwahl, Gegnerzüge, Rückgängig, Log und Ende.
import { useEffect, useMemo, useRef, useState } from 'react';
import { patchEntry, useCollection } from '../../data/store';
import {
  actionState, currentUnit, getUnit, placeUnit, placementArea, turnUnit, useAction, visible, type Unit,
} from '../../engine/battle';
import { titleOf } from '../../engine/defs';
import { affordable, conditionsMet, costsFor, findPath, legalTargets, rangeTiles, unitsAt, executeAbility } from '../../engine/execute';
import { FACING_LABELS, type Facing } from '../../engine/facing';
import { posKey, samePos, type Pos } from '../../engine/grid';
import { beginCombat, canUndo, finishTurn, fromCtx, isAllyTurn, nextLevel, restartLevel, toCtx, undo, type RunState } from '../../engine/run';
import { valueOf } from '../../engine/status';
import { navigate, routes } from '../../router';
import { Header } from '../../ui/Header';
import { usePanZoom } from '../../ui/usePanZoom';
import { GameMap } from './GameMap';

type Ui =
  | { kind: 'aktionen' }
  | { kind: 'faehigkeiten'; action: number }
  | { kind: 'ziel'; action: number; abilityId: string; chosen: Pos[]; forced: boolean };

const FACINGS: Facing[] = ['n', 'o', 's', 'w'];
const ARROWS: Record<Facing, string> = { n: '↑', o: '→', s: '↓', w: '←' };

export function GameScreen({ id }: { id: string }) {
  const saves = useCollection('spielstaende');
  const entry = saves.entries.find((e) => e.id === id);
  const [run, setRun] = useState<RunState | null>(() => (entry?.run as RunState | undefined) ?? null);
  const [ui, setUi] = useState<Ui>({ kind: 'aktionen' });
  const [infoId, setInfoId] = useState<string | null>(null);
  const [placing, setPlacing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [fast, setFast] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  const battle = run?.battle;
  const mapSize = { width: battle?.map.width ?? 10, height: battle?.map.height ?? 10 };
  const pz = usePanZoom(container, mapSize, onTap);
  const seen = useMemo(() => (battle ? visible(battle) : new Set<string>()), [battle]);
  const current = battle ? currentUnit(battle) : undefined;
  const allyTurn = run ? isAllyTurn(run) : false;
  const ctx = run ? toCtx(run) : null;

  // Automatisch speichern.
  useEffect(() => {
    if (!run) return;
    const t = setTimeout(() => patchEntry('spielstaende', id, { run }), 300);
    return () => clearTimeout(t);
  }, [run, id]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 2500);
    return () => clearTimeout(t);
  }, [message]);

  // Kamera zur Figur, die am Zug ist.
  useEffect(() => {
    if (current?.pos && pz.ready) pz.centerOn(current.pos, current.size ?? 1);
    setUi({ kind: 'aktionen' });
  }, [current?.id, battle?.round, pz.ready]);

  // Gegnerzüge (die KI folgt in 13b – bis dahin warten Gegner).
  useEffect(() => {
    if (!run || run.result || run.battle.phase !== 'kampf' || !current || current.side !== 'enemy') return;
    const t = setTimeout(() => {
      setRun((r) => (r ? finishTurn({ ...r, log: [...r.log, `${current.name} wartet.`] }) : r));
    }, fast ? 0 : 500);
    return () => clearTimeout(t);
  }, [run, current, fast]);

  // Zwang-Fähigkeiten starten zu Beginn des Zuges sofort.
  const forced = useMemo(() => {
    if (!run || !ctx || !allyTurn || !current) return null;
    for (let i = 0; i < current.actions.length; i++) {
      if (actionState(run.battle, i) !== 'offen') continue;
      for (const ab of current.actions[i].abilities) {
        const def = ab.abilityId ? run.defs.abilities[ab.abilityId] : undefined;
        if (!def || def.mode !== 'zwang' || !conditionsMet(ctx, current.id, def) || !affordable(ctx, current.id, def)) continue;
        if (def.targeting.kind === 'ziel' && legalTargets(ctx, current.id, def).length === 0) continue;
        return { action: i, abilityId: ab.abilityId! };
      }
    }
    return null;
  }, [run?.battle, allyTurn]);

  useEffect(() => {
    if (forced && ui.kind !== 'ziel') startAbility(forced.action, forced.abilityId, true);
  }, [forced]);

  if (!entry || !run || !battle || !ctx) {
    return (
      <main className="screen">
        <Header title="Spiel" back={routes.start()} />
        <p className="muted empty">Dieser Spielstand existiert nicht (mehr).</p>
      </main>
    );
  }

  const r = run;
  const defs = r.defs;
  const name = (u: Unit) => u.name;

  // ---------- Aktionen ----------

  function abilityOptions(unit: Unit, action: number) {
    const used = r.battle.turn?.used[action];
    return unit.actions[action].abilities
      .filter((a) => a.abilityId && defs.abilities[a.abilityId] && (!used || used.abilityId === a.abilityId))
      .map((a) => {
        const def = defs.abilities[a.abilityId!];
        const shown = conditionsMet(ctx!, unit.id, def);
        const targetsOk = def.targeting.kind !== 'ziel' || legalTargets(ctx!, unit.id, def).length > 0;
        return { id: a.abilityId!, def, shown, usable: shown && affordable(ctx!, unit.id, def) && targetsOk };
      });
  }

  function actionUsable(unit: Unit, i: number) {
    return actionState(r.battle, i) !== 'verbraucht' && abilityOptions(unit, i).some((o) => o.usable);
  }

  function openAction(i: number) {
    if (!current) return;
    const all = current.actions[i].abilities;
    const opts = abilityOptions(current, i);
    const shown = opts.filter((o) => o.shown);
    if (all.length === 1 && shown.length === 1 && shown[0].usable) return startAbility(i, shown[0].id, false);
    setUi({ kind: 'faehigkeiten', action: i });
  }

  function startAbility(action: number, abilityId: string, isForced: boolean) {
    const def = defs.abilities[abilityId];
    if (!current || !def) return;
    if (def.targeting.kind === 'ziel') return setUi({ kind: 'ziel', action, abilityId, chosen: [], forced: isForced });
    // AOE und Zufall brauchen keine Zielwahl.
    perform(action, abilityId, def.targeting.kind === 'zufall' ? randomTargets(abilityId) : []);
  }

  function randomTargets(abilityId: string): Pos[] {
    const def = defs.abilities[abilityId];
    const pool = def.targeting.includeIllegal ? rangeTiles(r.battle, current!, def) : legalTargets(ctx!, current!.id, def);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.max(def.targeting.minTargets, Math.min(def.targeting.maxTargets, shuffled.length)));
  }

  function perform(action: number, abilityId: string, targets: Pos[]) {
    if (!current) return;
    try {
      let next: RunState = { ...r, battle: useAction(r.battle, action, abilityId) };
      next = fromCtx(next, executeAbility(toCtx(next), current.id, abilityId, targets));
      setRun(next);
      setUi({ kind: 'aktionen' });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }

  // ---------- Antippen ----------

  function onTap(p: Pos) {
    if (!run) return;
    const b = run.battle;
    if (b.phase === 'platzierung') {
      const here = unitsAt(b, p).find((u) => u.side === 'ally');
      if (here && !here.lantern) return setPlacing(here.id);
      if (here?.lantern) return setMessage('Der Laternenträger steht fest.');
      if (!placing) return setMessage('Zuerst einen Ally antippen.');
      try {
        setRun({ ...run, battle: placeUnit(b, placing, p) });
      } catch (e) {
        setMessage(e instanceof Error ? e.message : String(e));
      }
      return;
    }
    if (ui.kind === 'ziel') {
      const def = run.defs.abilities[ui.abilityId];
      const legal = legalTargets(toCtx(run), current!.id, def);
      if (!legal.some((l) => samePos(l, p))) return setMessage('Kein legales Ziel.');
      const has = ui.chosen.some((c) => samePos(c, p));
      let chosen = has ? ui.chosen.filter((c) => !samePos(c, p)) : [...ui.chosen, p];
      if (chosen.length > def.targeting.maxTargets) chosen = chosen.slice(-def.targeting.maxTargets);
      if (!affordable(toCtx(run), current!.id, def, chosen)) return setMessage('Nicht genug für weitere Ziele.');
      const moves = def.blocks.some((x) => x.kind === 'anwender-bewegen' && !x.ignoresObstacles);
      if (def.targeting.maxTargets === 1 && chosen.length === 1 && !moves) return perform(ui.action, ui.abilityId, chosen);
      return setUi({ ...ui, chosen });
    }
    const unit = unitsAt(run.battle, p).find((u) => u.side === 'ally' || seen.has(posKey(p)));
    setInfoId(unit?.id ?? null);
  }

  // ---------- Darstellung ----------

  const target = ui.kind === 'ziel' ? defs.abilities[ui.abilityId] : null;
  const highlights = {
    activeId: allyTurn ? current?.id : null,
    selectedId: battle.phase === 'platzierung' ? placing : infoId,
    range: target && current ? rangeTiles(battle, current, target) : battle.phase === 'platzierung' ? placementArea(battle) : undefined,
    legal: target && current ? legalTargets(ctx, current.id, target) : undefined,
    chosen: ui.kind === 'ziel' ? ui.chosen : undefined,
    path:
      target && current?.pos && ui.kind === 'ziel' && ui.chosen.length === 1 && target.blocks.some((x) => x.kind === 'anwender-bewegen' && !x.ignoresObstacles)
        ? [current.pos, ...(findPath(ctx, current, ui.chosen[0]) ?? [])]
        : undefined,
  };

  const order = battle.order
    .map((uid) => getUnit(battle, uid)!)
    .filter((u) => u && u.status !== 'entfernt' && (u.side === 'ally' || (u.pos && seen.has(posKey(u.pos)))));
  const globals = Object.entries(r.globals).filter(([rid]) => defs.resources[rid]);
  const info = infoId ? getUnit(battle, infoId) : undefined;

  // Aktionen-Ring um die aktive Figur.
  const ring = (() => {
    if (!allyTurn || !current?.pos || ui.kind === 'ziel') return null;
    const n = current.size ?? 1;
    const c = pz.toScreen({ x: current.pos.x + n / 2, y: current.pos.y + n / 2 });
    const items =
      ui.kind === 'aktionen'
        ? [
            ...current.actions.map((a, i) => ({ key: `a${i}`, label: a.name || `Aktion ${i + 1}`, disabled: !actionUsable(current, i), onClick: () => openAction(i) })),
            ...(forced ? [] : [{ key: 'end', label: '✕', disabled: false, onClick: () => setRun(finishTurn(r)), cls: 'ring-end' }]),
          ]
        : [
            ...abilityOptions(current, ui.action)
              .filter((o) => o.shown)
              .map((o) => ({ key: o.id, label: o.def.title, disabled: !o.usable, onClick: () => startAbility(ui.action, o.id, false) })),
            { key: 'back', label: '↩', disabled: false, onClick: () => setUi({ kind: 'aktionen' }), cls: 'ring-end' },
          ];
    const radius = Math.max(64, (pz.view.s * n) / 2 + 40);
    return (
      <div className="action-ring" style={{ left: c.x, top: c.y }}>
        {items.map((it, i) => {
          const angle = -Math.PI / 2 + (2 * Math.PI * i) / items.length;
          return (
            <button
              key={it.key}
              className={`ring-btn ${'cls' in it ? it.cls : ''}`}
              disabled={it.disabled}
              style={{ transform: `translate(-50%, -50%) translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)` }}
              onClick={it.onClick}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    );
  })();

  const costs = target && current ? costsFor(ctx, current.id, target, ui.kind === 'ziel' ? ui.chosen : []) : {};

  return (
    <main className="map-editor game-screen">
      <div className="map-editor-head">
        <Header
          title={titleOf(defs, r.levelId)}
          back={routes.start()}
          actions={
            <>
              <button className="icon-btn" aria-label="Log" onClick={() => setShowLog(!showLog)}>📜</button>
              <button
                className="icon-btn"
                aria-label="Zug zurück"
                disabled={!canUndo(r)}
                onClick={() => {
                  setRun(undo(r));
                  setUi({ kind: 'aktionen' });
                }}
              >
                ↶
              </button>
            </>
          }
        />
        <div className="game-bars">
          {battle.phase === 'kampf' && (
            <div className="initiative">
              <span className="muted small">R{battle.round}</span>
              {order.map((u) => {
                const d = u.templateId ? defs.allys[u.templateId] ?? defs.enemies[u.templateId] : undefined;
                return (
                  <span key={u.id} className={`init-item ${u.id === current?.id ? 'active' : ''} ${u.side}`} title={u.name}>
                    <svg viewBox="-50 -50 100 100" width={22} height={22}>
                      <circle r={48} fill={u.side === 'ally' ? '#3d2a1e' : '#4a1f14'} />
                    </svg>
                    <span className="init-shape" style={{ color: d?.color }}>{u.name.slice(0, 2)}</span>
                  </span>
                );
              })}
            </div>
          )}
          {globals.length > 0 && (
            <div className="globals">
              {globals.map(([rid, v]) => (
                <span key={rid} className="global-chip">{defs.resources[rid].title} {v}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={container} className="map-canvas" {...pz.handlers}>
        {r.levelId && <GameMap battle={battle} defs={defs} levelId={r.levelId} seen={seen} viewBox={pz.viewBox} h={highlights} />}
        {ring}
        {message && <div className="map-toast">{message}</div>}
      </div>

      <div className="map-tools">
        {battle.phase === 'platzierung' && (
          <>
            <p className="small">Ally antippen, dann ein Feld im Lichtkegel. Der Laternenträger steht fest.</p>
            {placing && (
              <FacingRow
                value={getUnit(battle, placing)?.facing ?? 'n'}
                onChange={(f) => setRun({ ...r, battle: turnUnit(battle, placing, f) })}
              />
            )}
            <button className="btn btn-primary" onClick={() => setRun(beginCombat(r))}>Kampf beginnen</button>
          </>
        )}
        {battle.phase === 'kampf' && !r.result && ui.kind === 'ziel' && target && (
          <>
            <p className="small">
              <strong>{target.title}</strong> – Ziele {ui.chosen.length}/{target.targeting.maxTargets}
              {Object.keys(costs).length > 0 && ` · Kosten: ${Object.entries(costs).map(([k, v]) => `${v} ${titleOf(defs, k)}`).join(', ')}`}
            </p>
            <div className="btn-row">
              {!ui.forced && <button className="btn" onClick={() => setUi({ kind: 'aktionen' })}>Abbrechen</button>}
              <button className="btn btn-primary" disabled={ui.chosen.length < target.targeting.minTargets} onClick={() => perform(ui.action, ui.abilityId, ui.chosen)}>
                Bestätigen
              </button>
            </div>
          </>
        )}
        {battle.phase === 'kampf' && !r.result && ui.kind !== 'ziel' && current && (
          <>
            <p className="small">
              {allyTurn ? <>Am Zug: <strong>{name(current)}</strong></> : <>Gegner sind am Zug …</>}
            </p>
            {allyTurn && <FacingRow value={current.facing ?? 'n'} onChange={(f) => setRun({ ...r, battle: turnUnit(battle, current.id, f) })} />}
            {!allyTurn && <button className="btn btn-small" onClick={() => setFast(!fast)}>{fast ? 'Normales Tempo' : 'Überspringen ⏩'}</button>}
          </>
        )}
        {info && <UnitInfo unit={info} run={r} onClose={() => setInfoId(null)} />}
      </div>

      {showLog && (
        <div className="game-log" onClick={() => setShowLog(false)}>
          <div className="game-log-inner" onClick={(e) => e.stopPropagation()}>
            <h2>Kampf-Log</h2>
            <ol>{[...r.log].reverse().slice(0, 300).map((l, i) => <li key={i}>{l}</li>)}</ol>
            <button className="btn" onClick={() => setShowLog(false)}>Schließen</button>
          </div>
        </div>
      )}

      {r.result && (
        <div className="sheet-backdrop">
          <div className="sheet">
            {r.result === 'run-verloren' && (
              <>
                <h2>Run verloren</h2>
                <p className="muted">{battle.outcome ?? r.log.at(-1)}</p>
                <button className="btn btn-primary" disabled={!canUndo(r)} onClick={() => setRun(undo(r))}>↶ Zug zurück</button>
                <button className="btn" onClick={() => setRun(restartLevel(r))}>Level neu starten</button>
              </>
            )}
            {r.result === 'run-gewonnen' && (
              <>
                <h2>Run gewonnen! 🍂</h2>
                <button className="btn" disabled={!canUndo(r)} onClick={() => setRun(undo(r))}>↶ Zug zurück</button>
                <button className="btn" onClick={() => setRun(restartLevel(r))}>Level noch einmal</button>
              </>
            )}
            {r.result === 'level-gewonnen' && (
              <>
                <h2>Level geschafft!</h2>
                {r.choices && r.choices.length > 1 ? (
                  <>
                    <p className="muted">Wie geht es weiter?</p>
                    {r.choices.map((sid) => (
                      <button key={sid} className="btn btn-primary" onClick={() => setRun(nextLevel(r, sid))}>
                        {defs.dungeon?.stations.find((s) => s.id === sid)?.name || 'Weiter'}
                      </button>
                    ))}
                  </>
                ) : (
                  <button className="btn btn-primary" onClick={() => setRun(nextLevel(r))}>Weiter</button>
                )}
                <button className="btn" disabled={!canUndo(r)} onClick={() => setRun(undo(r))}>↶ Zug zurück</button>
              </>
            )}
            <button className="btn" onClick={() => navigate(routes.start())}>Zum Menü</button>
          </div>
        </div>
      )}
    </main>
  );
}

function FacingRow({ value, onChange }: { value: Facing; onChange: (f: Facing) => void }) {
  return (
    <div className="facing-row">
      <span className="muted small">Blickrichtung</span>
      {FACINGS.map((f) => (
        <button key={f} className={`btn btn-small ${f === value ? 'btn-primary' : ''}`} aria-label={FACING_LABELS[f]} onClick={() => onChange(f)}>
          {ARROWS[f]}
        </button>
      ))}
    </div>
  );
}

function UnitInfo({ unit: u, run, onClose }: { unit: Unit; run: RunState; onClose: () => void }) {
  const defs = run.defs;
  const shown = Object.keys(u.values ?? {}).filter((k) => defs.resources[k]?.display.show);
  return (
    <div className="unit-info">
      <div className="unit-info-head">
        <strong>{u.name}</strong>
        {u.status === 'bewusstlos' && <span className="muted small"> · bewusstlos</span>}
        <button className="icon-btn" aria-label="Schließen" onClick={onClose}>✕</button>
      </div>
      {shown.map((k) => {
        const v = valueOf(defs, u, k) ?? 0;
        const max = u.maxValues?.[k];
        return (
          <div key={k} className="resource-bar-preview">
            <span className="resource-bar-label">{defs.resources[k].title}</span>
            <span className="resource-bar">
              <span style={{ width: `${max ? Math.min(100, (100 * v) / max) : 100}%`, background: defs.resources[k].display.color }} />
            </span>
            <span className="resource-bar-value">{max ? `${v}/${max}` : v}</span>
          </div>
        );
      })}
      {(u.effects ?? []).length > 0 && (
        <p className="small">Effekte: {(u.effects ?? []).map((e) => titleOf(defs, e.effectId)).join(', ')}</p>
      )}
      {(u.items ?? []).length > 0 && (
        <p className="small muted">Rucksack: {(u.items ?? []).map((i) => `${i.count}× ${titleOf(defs, i.objectId)}`).join(', ')}</p>
      )}
    </div>
  );
}
