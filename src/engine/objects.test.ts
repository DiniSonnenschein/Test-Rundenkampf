import { describe, expect, it } from 'vitest';
import { normalizeObject, slotsNeeded } from './objects';

describe('Objekte', () => {
  it('Standardwerte und Rucksackplätze', () => {
    const o = normalizeObject({ stack: { stackable: true, max: 3 } });
    expect(o.collectible).toBe(true);
    expect(slotsNeeded(o, 7)).toBe(3);
    expect(slotsNeeded(normalizeObject({}), 2)).toBe(2);
    expect(slotsNeeded(o, 0)).toBe(0);
  });
});
