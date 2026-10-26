// Zwischen den Leveln: Ressourcen-Regeln, Ereignisse aus dem Spiel-Editor und Zwischenstationen
// (Rast, Belohnung, Effekte, Rucksäcke, Händler, Text).
import type { Defs } from './defs';
import { priceFor, type InterludeBlock } from './dungeon';
import { addEffect, type ActiveEffect } from './effects';
import type { LevelEvent } from './game';
import { slotsNeeded } from './objects';
import type { ResourceCarry } from './rules';

export interface Item {
  objectId: string;
  count: number;
}

/** Zustand eines Team-Mitglieds außerhalb eines Kampfes. */
export interface Member {
  memberId: string;
  allyId: string;
  values: Record<string, number>;
  maxValues: Record<string, number | null>;
  /** Startwerte (für „auf Startwert auffüllen“). */
  startValues?: Record<string, number>;
  items: Item[];
  /** Getragenes (wenn der Rucksack voll ist). */
  carried?: Item[];
  effects: ActiveEffect[];
}

export interface Party {
  team: Member[];
  globals: Record<string, number>;
  log: string[];
}

export interface InterludeState {
  stationId: string;
  /** Folgestationen (mehrere = der Spieler wählt am Ende). */
  choices: string[];
  /** Bereits vergebene Belohnungen: `${block}|${item}`. */
  claimed: string[];
  /** Verbleibender Vorrat je Angebot: `${block}|${offer}` (fehlt = wie im Editor). */
  stock: Record<string, number | null>;
  /** Zustand beim Betreten (für „Zwischenstation zurücksetzen“). */
  start: { team: Member[]; globals: Record<string, number>; logLength: number };
}

const clamp = (v: number, max: number | null | undefined) => Math.max(0, max === null || max === undefined ? v : Math.min(v, max));
const titleOf = (defs: Defs, id: string) =>
  defs.resources[id]?.title ?? defs.objects[id]?.title ?? defs.effects[id]?.title ?? defs.allys[id]?.title ?? '?';
const nameOf = (defs: Defs, m: Member) => defs.allys[m.allyId]?.title ?? '?';

// ---------- Levelwechsel ----------

/** Ressourcen der Allys nach dem Regelwerk behalten, auf den Startwert setzen oder auffüllen. */
export function carryResources(defs: Defs, team: Member[]): Member[] {
  const rule = defs.rules.betweenLevels;
  const modeOf = (rid: string): ResourceCarry => rule.overrides.find((o) => o.resourceId === rid)?.mode ?? rule.resources;
  return team.map((m) => {
    const values = { ...m.values };
    for (const rid of Object.keys(values)) {
      const mode = modeOf(rid);
      if (mode === 'start' && m.startValues?.[rid] !== undefined) values[rid] = m.startValues[rid];
      if (mode === 'max' && typeof m.maxValues[rid] === 'number') values[rid] = m.maxValues[rid]!;
    }
    return { ...m, values };
  });
}

/** Ereignisse aus dem Spiel-Editor nach einem geschafften Level. */
export function applyLevelEvents(
  defs: Defs, party: Party, events: LevelEvent[], finishedLevelId: string | null, globalStarts: Record<string, number>,
): Party {
  let { team, globals, log } = party;
  for (const e of events) {
    if (!e.resourceId || (e.after === 'level' && e.levelId !== finishedLevelId)) continue;
    const r = defs.resources[e.resourceId];
    if (!r) continue;
    const rid = e.resourceId;
    if (r.scope === 'global') {
      const cur = globals[rid] ?? 0;
      const max = r.hasMax ? r.max : null;
      const next = e.mode === 'max' ? (max ?? cur) : e.mode === 'start' ? (globalStarts[rid] ?? r.start) : clamp(cur + e.amount, max);
      if (next !== cur) log = [...log, `${r.title}: ${cur} → ${next}`];
      globals = { ...globals, [rid]: next };
      continue;
    }
    team = team.map((m) => {
      if (!(rid in m.values)) return m;
      const cur = m.values[rid];
      const max = m.maxValues[rid];
      const next = e.mode === 'max' ? (max ?? cur) : e.mode === 'start' ? (m.startValues?.[rid] ?? cur) : clamp(cur + e.amount, max);
      if (next !== cur) log = [...log, `${nameOf(defs, m)}: ${r.title} ${cur} → ${next}`];
      return { ...m, values: { ...m.values, [rid]: next } };
    });
  }
  return { team, globals, log };
}

// ---------- Gegenstände ----------

/** Gegenstand hinzufügen: in den Rucksack, solange Platz ist, sonst wird er getragen. */
export function giveItem(defs: Defs, m: Member, objectId: string, count = 1): Member {
  const slots = defs.allys[m.allyId]?.backpackSlots ?? 0;
  const add = (list: Item[]) => {
    const has = list.find((i) => i.objectId === objectId);
    return has ? list.map((i) => (i === has ? { ...i, count: i.count + count } : i)) : [...list, { objectId, count }];
  };
  const items = add(m.items);
  const used = items.reduce((s, i) => s + slotsNeeded(defs.objects[i.objectId] ?? { stack: { stackable: false, max: 1 } }, i.count), 0);
  return used <= slots ? { ...m, items } : { ...m, carried: add(m.carried ?? []) };
}

/** Einen Gegenstand entfernen (zuerst aus dem Rucksack, dann Getragenes). */
export function takeItem(m: Member, objectId: string, count = 1): Member | null {
  const total = [...m.items, ...(m.carried ?? [])].filter((i) => i.objectId === objectId).reduce((s, i) => s + i.count, 0);
  if (total < count) return null;
  let left = count;
  const take = (list: Item[]) =>
    list
      .map((i) => {
        if (i.objectId !== objectId || left === 0) return i;
        const n = Math.min(left, i.count);
        left -= n;
        return { ...i, count: i.count - n };
      })
      .filter((i) => i.count > 0);
  const items = take(m.items);
  return { ...m, items, carried: take(m.carried ?? []) };
}

export const allItems = (m: Member): Item[] => {
  const out: Item[] = [];
  for (const i of [...m.items, ...(m.carried ?? [])]) {
    const has = out.find((x) => x.objectId === i.objectId);
    if (has) has.count += i.count;
    else out.push({ ...i });
  }
  return out;
};

// ---------- Zwischenstation ----------

export interface InterludeRun extends Party {
  defs: Defs;
  interlude?: InterludeState;
}

function blocksOf<R extends InterludeRun>(run: R): InterludeBlock[] {
  return run.defs.dungeon?.stations.find((s) => s.id === run.interlude?.stationId)?.interlude ?? [];
}

const setMember = <R extends InterludeRun>(run: R, m: Member): R => ({ ...run, team: run.team.map((x) => (x.memberId === m.memberId ? m : x)) });
const findMember = (run: InterludeRun, id: string) => run.team.find((m) => m.memberId === id);

/** Zwischenstation betreten: Rast und Effekte wirken sofort. */
export function enterInterlude<R extends InterludeRun>(run: R, stationId: string, choices: string[]): R {
  const defs = run.defs;
  let next: R = {
    ...run,
    log: [...run.log, '— Zwischenstation —'],
    interlude: { stationId, choices, claimed: [], stock: {}, start: { team: run.team, globals: run.globals, logLength: 0 } },
  };
  for (const b of blocksOf(next)) {
    if (b.kind === 'rast') {
      for (const c of b.changes) {
        const r = c.resourceId ? defs.resources[c.resourceId] : undefined;
        if (!r || !c.resourceId) continue;
        const rid = c.resourceId;
        if (r.scope === 'global') {
          const cur = next.globals[rid] ?? 0;
          const v = clamp(cur + c.amount, r.hasMax ? r.max : null);
          next = { ...next, globals: { ...next.globals, [rid]: v }, log: [...next.log, `Rast: ${r.title} ${cur} → ${v}`] };
        } else {
          for (const m of next.team) {
            if (!(rid in m.values)) continue;
            const v = clamp(m.values[rid] + c.amount, m.maxValues[rid]);
            next = { ...setMember(next, { ...m, values: { ...m.values, [rid]: v } }), log: [...next.log, `Rast: ${nameOf(defs, m)} ${r.title} ${m.values[rid]} → ${v}`] };
          }
        }
      }
    }
    if (b.kind === 'effekte') {
      for (const m of next.team) {
        if (b.action === 'vergeben' && b.effectId && defs.effects[b.effectId]) {
          const inst: ActiveEffect = { instanceId: `zw-${stationId}-${m.memberId}-${b.effectId}-${next.log.length}`, effectId: b.effectId, duration: b.duration, counters: {} };
          if (b.duration.kind === 'runden') inst.roundsLeft = b.duration.rounds;
          const r = addEffect(m.effects, inst, defs.effects);
          if (r.added) next = { ...setMember(next, { ...m, effects: r.active }), log: [...next.log, `${nameOf(defs, m)} erhält ${titleOf(defs, b.effectId)}.`] };
        }
        if (b.action === 'beenden') {
          const ends = (a: ActiveEffect) => a.effectId === b.effectId || (defs.effects[a.effectId]?.typeIds ?? []).some((t) => b.typeIds.includes(t));
          const ended = m.effects.filter(ends);
          if (ended.length) {
            next = {
              ...setMember(next, { ...m, effects: m.effects.filter((a) => !ends(a)) }),
              log: [...next.log, `${nameOf(defs, m)}: ${ended.map((a) => titleOf(defs, a.effectId)).join(', ')} endet.`],
            };
          }
        }
      }
    }
  }
  // „Zurücksetzen“ führt zum Zustand nach Rast und Effekten.
  return { ...next, interlude: { ...next.interlude!, start: { team: next.team, globals: next.globals, logLength: next.log.length } } };
}

/** Wie viele Belohnungen eines Blocks noch genommen werden dürfen. */
export function rewardsLeft(run: InterludeRun, blockIndex: number): number {
  const b = blocksOf(run)[blockIndex];
  if (b?.kind !== 'belohnung' || !run.interlude) return 0;
  const taken = run.interlude.claimed.filter((k) => k.startsWith(`${blockIndex}|`)).length;
  const total = b.items.filter((i) => i.objectId).length;
  return (b.choose.on ? Math.min(b.choose.count, total) : total) - taken;
}

export function claimReward<R extends InterludeRun>(run: R, blockIndex: number, itemIndex: number, memberId: string): R {
  const b = blocksOf(run)[blockIndex];
  const it = b?.kind === 'belohnung' ? b.items[itemIndex] : undefined;
  const m = findMember(run, memberId);
  const key = `${blockIndex}|${itemIndex}`;
  if (!run.interlude || !it?.objectId || !m || run.interlude.claimed.includes(key) || rewardsLeft(run, blockIndex) <= 0) return run;
  const next = setMember(run, giveItem(run.defs, m, it.objectId, it.count));
  return {
    ...next,
    interlude: { ...run.interlude, claimed: [...run.interlude.claimed, key] },
    log: [...run.log, `${nameOf(run.defs, m)} erhält ${it.count}× ${titleOf(run.defs, it.objectId)}.`],
  };
}

type Merchant = Extract<InterludeBlock, { kind: 'haendler' }>;

const merchantAt = (run: InterludeRun, blockIndex: number): Merchant | undefined => {
  const b = blocksOf(run)[blockIndex];
  return b?.kind === 'haendler' ? b : undefined;
};

/** Verbleibender Vorrat eines Angebots (null = unbegrenzt). */
export function stockLeft(run: InterludeRun, blockIndex: number, offerIndex: number): number | null {
  const m = merchantAt(run, blockIndex);
  const key = `${blockIndex}|${offerIndex}`;
  if (run.interlude && key in run.interlude.stock) return run.interlude.stock[key];
  return m?.offers[offerIndex]?.stock ?? null;
}

export function price(run: InterludeRun, blockIndex: number, objectId: string) {
  const m = merchantAt(run, blockIndex);
  return m ? priceFor(m, objectId, run.defs.objects[objectId]?.typeIds ?? []) : null;
}

/** Kaufen: kostet den Kaufpreis in der Währung des Händlers; der gewählte Ally bekommt den Gegenstand. */
export function buy<R extends InterludeRun>(run: R, blockIndex: number, offerIndex: number, memberId: string): R {
  const m = merchantAt(run, blockIndex);
  const offer = m?.offers[offerIndex];
  const member = findMember(run, memberId);
  if (!m?.currencyId || !offer?.objectId || !member || !run.interlude) return run;
  const p = price(run, blockIndex, offer.objectId);
  const left = stockLeft(run, blockIndex, offerIndex);
  const money = run.globals[m.currencyId] ?? 0;
  if (!p || (left !== null && left <= 0) || money < p.buy) return run;
  const next = setMember(run, giveItem(run.defs, member, offer.objectId));
  return {
    ...next,
    globals: { ...run.globals, [m.currencyId]: money - p.buy },
    interlude: { ...run.interlude, stock: left === null ? run.interlude.stock : { ...run.interlude.stock, [`${blockIndex}|${offerIndex}`]: left - 1 } },
    log: [...run.log, `${nameOf(run.defs, member)} kauft ${titleOf(run.defs, offer.objectId)} für ${p.buy} ${titleOf(run.defs, m.currencyId)}.`],
  };
}

/** Verkaufen: nur, wenn der Händler ankauft und einen Preis für den Gegenstand hat. */
export function sell<R extends InterludeRun>(run: R, blockIndex: number, memberId: string, objectId: string): R {
  const m = merchantAt(run, blockIndex);
  const member = findMember(run, memberId);
  if (!m?.currencyId || !m.selling || !member) return run;
  const p = price(run, blockIndex, objectId);
  const rest = p ? takeItem(member, objectId) : null;
  if (!p || !rest) return run;
  const money = run.globals[m.currencyId] ?? 0;
  const r = run.defs.resources[m.currencyId];
  return {
    ...setMember(run, rest),
    globals: { ...run.globals, [m.currencyId]: clamp(money + p.sell, r?.hasMax ? r.max : null) },
    log: [...run.log, `${nameOf(run.defs, member)} verkauft ${titleOf(run.defs, objectId)} für ${p.sell} ${titleOf(run.defs, m.currencyId)}.`],
  };
}

/** Gegenstand an einen anderen Ally geben (toId) oder wegwerfen (null). */
export function moveItem<R extends InterludeRun>(run: R, fromId: string, toId: string | null, objectId: string): R {
  const from = findMember(run, fromId);
  const rest = from ? takeItem(from, objectId) : null;
  if (!from || !rest) return run;
  let next = setMember(run, rest);
  const to = toId ? findMember(next, toId) : undefined;
  if (to) next = setMember(next, giveItem(run.defs, to, objectId));
  const what = titleOf(run.defs, objectId);
  return { ...next, log: [...run.log, to ? `${nameOf(run.defs, from)} gibt ${what} an ${nameOf(run.defs, to)}.` : `${nameOf(run.defs, from)} wirft ${what} weg.`] };
}

/** Gegenstand zwischen Rucksack und Getragenem verschieben (Rucksack nur, wenn Platz ist). */
export function toggleCarried<R extends InterludeRun>(run: R, memberId: string, objectId: string): R {
  const m = findMember(run, memberId);
  if (!m) return run;
  const inPack = m.items.some((i) => i.objectId === objectId);
  if (inPack) {
    const rest = takeItem({ ...m, carried: [] }, objectId);
    if (!rest) return run;
    const carried = [...(m.carried ?? [])];
    const has = carried.find((i) => i.objectId === objectId);
    return setMember(run, { ...m, items: rest.items, carried: has ? carried.map((i) => (i === has ? { ...i, count: i.count + 1 } : i)) : [...carried, { objectId, count: 1 }] });
  }
  const rest = takeItem({ ...m, items: [] }, objectId);
  if (!rest) return run;
  const moved = giveItem(run.defs, { ...m, carried: rest.carried }, objectId);
  // Kein Platz im Rucksack: unverändert lassen.
  return moved.items === m.items ? run : setMember(run, moved);
}

export function resetInterlude<R extends InterludeRun>(run: R): R {
  const i = run.interlude;
  if (!i) return run;
  return { ...run, team: i.start.team, globals: i.start.globals, log: [...run.log.slice(0, i.start.logLength), '↺ Zwischenstation zurückgesetzt'], interlude: { ...i, claimed: [], stock: {} } };
}

/** Noch nicht vergebene Belohnungen (Hinweis vor dem Verlassen). */
export function unclaimedRewards(run: InterludeRun): number {
  return blocksOf(run).reduce((s, b, i) => s + (b.kind === 'belohnung' ? Math.max(0, rewardsLeft(run, i)) : 0), 0);
}

export const interludeBlocks = blocksOf;
