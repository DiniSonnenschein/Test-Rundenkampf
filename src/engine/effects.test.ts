import { describe, expect, it } from 'vitest';
import { addEffect, DEFAULT_EFFECT, hasBlock, permanentModifier, tickEffects, type ActiveEffect, type EffectDefs } from './effects';

const inst = (effectId: string, id = effectId + Math.random(), duration: ActiveEffect['duration'] = { kind: 'bis-aufloesung' }): ActiveEffect => ({
  instanceId: id, effectId, duration, counters: {},
});

const defs: EffectDefs = {
  gift: { ...DEFAULT_EFFECT, stack: { stackable: true, max: 3 }, blocks: [{ kind: 'ressource', resourceId: 'lp', mode: 'wiederkehrend', interval: 'zug', timing: 'beginn', amount: -1, mayExceedMax: false }] },
  schwach: { ...DEFAULT_EFFECT, blocks: [{ kind: 'ressource', resourceId: 'staerke', mode: 'dauerhaft', interval: 'zug', timing: 'beginn', amount: -6, mayExceedMax: false }] },
  feuer: { ...DEFAULT_EFFECT, excludes: ['eis'] },
  eis: { ...DEFAULT_EFFECT },
  kurz: { ...DEFAULT_EFFECT, endings: [{ kind: 'nach', count: 2, unit: 'zuege', timing: 'ende' }] },
};

describe('Effekte', () => {
  it('stapelbar bis zum Maximum, darüber ersetzt der neue den ältesten', () => {
    let a: ActiveEffect[] = [];
    for (let i = 0; i < 4; i++) a = addEffect(a, inst('gift', 'g' + i), defs).active;
    expect(a.map((x) => x.instanceId)).toEqual(['g1', 'g2', 'g3']);
  });

  it('nicht stapelbar: erneuert', () => {
    let a = addEffect([], inst('schwach', 's1'), defs).active;
    a = addEffect(a, inst('schwach', 's2'), defs).active;
    expect(a.map((x) => x.instanceId)).toEqual(['s2']);
  });

  it('dominanter Effekt beendet den anderen und verhindert sein Hinzukommen', () => {
    let r = addEffect([inst('eis', 'e1')], inst('feuer', 'f1'), defs);
    expect(r.active.map((x) => x.effectId)).toEqual(['feuer']);
    expect(r.ended.map((x) => x.instanceId)).toEqual(['e1']);
    r = addEffect(r.active, inst('eis', 'e2'), defs);
    expect(r.added).toBe(false);
  });

  it('Dauer von der Quelle und eigene Beendigung: was zuerst eintritt', () => {
    let a = addEffect([], inst('kurz', 'k', { kind: 'runden', rounds: 5 }), defs).active;
    a = tickEffects(a, { unit: 'zug', timing: 'ende' }, defs).active;
    expect(a).toHaveLength(1);
    const r = tickEffects(a, { unit: 'zug', timing: 'ende' }, defs);
    expect(r.ended).toHaveLength(1);

    let b = addEffect([], inst('eis', 'x', { kind: 'runden', rounds: 1 }), defs).active;
    b = tickEffects(b, { unit: 'runde', timing: 'beginn' }, defs).active;
    expect(b).toHaveLength(1);
    expect(tickEffects(b, { unit: 'runde', timing: 'ende' }, defs).active).toHaveLength(0);
  });

  it('dauerhafte Veränderungen je Stapel, wiederkehrende werden nicht mitgezählt', () => {
    const a = [inst('schwach'), inst('gift'), inst('gift')];
    expect(permanentModifier(a, 'staerke', defs)).toBe(-6);
    expect(permanentModifier(a, 'lp', defs)).toBe(0);
    expect(hasBlock(a, 'ressource', defs)).toHaveLength(3);
  });
});
