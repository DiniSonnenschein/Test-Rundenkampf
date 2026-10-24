import { describe, expect, it } from 'vitest';
import { hexToRgb, hsvToHex, rgbToHsv } from './color';

describe('Farben', () => {
  it('rechnet Hex → HSV → Hex verlustfrei um', () => {
    for (const hex of ['#d9772b', '#000000', '#ffffff', '#7d8a3a', '#2b5fd9']) {
      expect(hsvToHex(rgbToHsv(hexToRgb(hex)!))).toBe(hex);
    }
  });
  it('lehnt ungültige Werte ab', () => {
    expect(hexToRgb('#12')).toBeNull();
    expect(hexToRgb('rot')).toBeNull();
  });
});
