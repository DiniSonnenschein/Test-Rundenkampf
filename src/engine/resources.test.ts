import { describe, expect, it } from 'vitest';
import { adjustAmount, applyChange, changesAt, totalAdjustment, triggeredEvents, type ResourceEvent } from './resources';

describe('Ressourcen', () => {
  it('Minimum 0, automatische Erhöhung nie über das Maximum', () => {
    expect(applyChange(3, -5, 10)).toBe(0);
    expect(applyChange(8, 5, 10)).toBe(10);
    expect(applyChange(12, 2, 10)).toBe(12); // schon darüber (durch Fähigkeit): keine weitere Erhöhung
    expect(applyChange(12, -1, 10)).toBe(11);
    expect(applyChange(8, 5, 10, true)).toBe(13);
    expect(applyChange(8, 5, null)).toBe(13);
  });

  it('Anpassung verändert den Betrag und kippt nicht um', () => {
    expect(adjustAmount(-8, -5)).toBe(-3);
    expect(adjustAmount(6, -2)).toBe(4);
    expect(adjustAmount(-3, -5)).toBe(0);
    expect(adjustAmount(-3, 2)).toBe(-5);
  });

  it('Anpassungen nach Fähigkeit und Kategorie', () => {
    const adj = [
      { abilityId: 'angriff', category: null, amount: -5 },
      { abilityId: null, category: 'feuer', amount: 2 },
    ];
    expect(totalAdjustment(adj, 'angriff')).toBe(-5);
    expect(totalAdjustment(adj, 'feuerball', ['feuer'])).toBe(2);
    expect(totalAdjustment(adj, 'heilung')).toBe(0);
  });

  it('Events lösen bei jedem erneuten Überschreiten aus', () => {
    const events: ResourceEvent[] = [
      { direction: 'faellt', threshold: 0, action: { kind: 'niederlage' } },
      { direction: 'steigt', threshold: 5, action: { kind: 'sieg' } },
    ];
    expect(triggeredEvents(events, 3, 0)).toHaveLength(1);
    expect(triggeredEvents(events, 0, 0)).toHaveLength(0);
    expect(triggeredEvents(events, 1, 0)).toHaveLength(1);
    expect(triggeredEvents(events, 4, 5)[0].action.kind).toBe('sieg');
    expect(triggeredEvents(events, 5, 7)).toHaveLength(0);
  });

  it('automatische Veränderungen nach Zeitpunkt', () => {
    const changes = [
      { interval: 'zug' as const, timing: 'beginn' as const, amount: 1 },
      { interval: 'level' as const, timing: 'ende' as const, amount: 3 },
    ];
    expect(changesAt(changes, 'zug', 'beginn')).toHaveLength(1);
    expect(changesAt(changes, 'level', 'beginn')).toHaveLength(0);
  });
});
