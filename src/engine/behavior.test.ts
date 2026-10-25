import { describe, expect, it } from 'vitest';
import { chooseTarget, pickRule, rankTargets, type BehaviorRule, type Candidate } from './behavior';

const c = (id: string, distance: number, lp: number, extra: Partial<Candidate> = {}): Candidate => ({
  id, distance, values: { lp }, isLanternBearer: false, typeIds: [], effectIds: [], ...extra,
});

describe('Gegner-KI', () => {
  const cands = [c('a', 3, 10), c('b', 1, 8), c('c', 1, 2, { isLanternBearer: true }), c('d', 5, 2, { typeIds: ['magier'] })];

  it('Prioritätenliste: erstes Kriterium entscheidet, weitere brechen Gleichstände', () => {
    expect(rankTargets(cands, [{ kind: 'naechster' }])).toEqual(['b', 'c', 'a', 'd']);
    expect(rankTargets(cands, [{ kind: 'naechster' }, { kind: 'ressource', resourceId: 'lp', order: 'niedrigster' }])).toEqual(['c', 'b', 'a', 'd']);
    expect(rankTargets(cands, [{ kind: 'ressource', resourceId: 'lp', order: 'hoechster' }])[0]).toBe('a');
    expect(rankTargets(cands, [{ kind: 'laternentraeger' }])[0]).toBe('c');
    expect(rankTargets(cands, [{ kind: 'typ', typeIds: ['magier'] }])[0]).toBe('d');
    expect(rankTargets(cands, [{ kind: 'letzter-angreifer' }], 'a')[0]).toBe('a');
  });

  it('ohne Weg zum Ziel geht es in der Prioritätenliste weiter', () => {
    expect(chooseTarget(['b', 'c', 'a'], (id) => id !== 'b')).toBe('c');
    expect(chooseTarget(['b'], () => false)).toBeNull();
  });

  it('erste passende Regel für Zug bzw. Reaktion', () => {
    const rule = (abilityId: string, zug: boolean, reaktion: boolean): BehaviorRule => ({
      zug, reaktion, conditions: [], abilityId, target: { kind: 'hauptziel' },
    });
    const rules = [rule('heilen', true, false), rule('biss', true, true), rule('laufen', true, false)];
    expect(pickRule(rules, 'zug', (r) => r.abilityId !== 'heilen')?.abilityId).toBe('biss');
    expect(pickRule(rules, 'reaktion', () => true)?.abilityId).toBe('biss');
    expect(pickRule(rules, 'reaktion', (r) => r.abilityId !== 'biss')).toBeNull();
  });
});
