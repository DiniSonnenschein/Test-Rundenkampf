import { describe, expect, it } from 'vitest';
import { newCharacterResource } from './characters';
import { memberItems, memberResources, normalizeGame, validateGame, type TeamMember } from './game';

const ally = {
  resources: [newCharacterResource('init'), { ...newCharacterResource('lp'), start: 10, max: 10 }],
  startItems: [{ objectId: 'trank', count: 2 }],
};

describe('Neues Spiel', () => {
  it('Anpassungen gelten nur für diesen Test', () => {
    const m: TeamMember = { id: 'm1', allyId: 'ritter', items: null, resources: { lp: { start: 20 } } };
    const res = memberResources(m, ally);
    expect(res.find((r) => r.resourceId === 'lp')).toMatchObject({ start: 20, max: 10 });
    expect(ally.resources[1].start).toBe(10);
    expect(memberItems(m, ally)).toEqual([{ objectId: 'trank', count: 2 }]);
    expect(memberItems({ ...m, items: [] }, ally)).toEqual([]);
  });

  it('Laternenträger muss im Team sein', () => {
    expect(normalizeGame({ team: [], lanternMemberId: 'x' }).lanternMemberId).toBeNull();
  });

  it('Prüfung', () => {
    const info = {
      allyExists: (id: string | null) => id === 'ritter',
      dungeonLevels: () => ['l1', 'l2'],
      victoryCount: (id: string) => ({ l1: 3, l2: 1 } as Record<string, number>)[id],
      levelName: (id: string) => id.toUpperCase(),
    };
    expect(validateGame(normalizeGame({}), info)).toEqual(['Noch kein Dungeon bzw. Level gewählt.', 'Das Team ist leer.']);
    const team = [
      { id: 'a', allyId: 'ritter', items: null, resources: {} },
      { id: 'b', allyId: 'ritter', items: null, resources: {} },
    ];
    const g = normalizeGame({ content: { kind: 'dungeon', dungeonId: 'd' }, team, lanternMemberId: 'a' });
    expect(validateGame(g, info)).toEqual(['„L2“ hat weniger Siegfelder als Allys im Team – dort ist kein Sieg möglich.']);
    expect(validateGame({ ...g, content: { kind: 'levels', levelIds: ['l1', 'weg'] }, lanternMemberId: null }, info)).toEqual([
      'Ein gewähltes Level fehlt.',
      'Niemand trägt die Laterne.',
    ]);
  });
});
