// Initiative: wird zu Beginn jedes Levels anhand der Ressource „Initiative“ festgelegt
// und gilt für das ganze Level (spätere Änderungen wirken erst im nächsten Level).
import type { Rules } from './rules';

export interface InitiativeUnit {
  id: string;
  side: 'ally' | 'enemy';
}

/**
 * Höchster Wert zuerst. Bei Gleichstand entscheidet die Gleichstand-Regel,
 * danach die Eingabe-Reihenfolge (Allys: Platzierung, Gegner: Level).
 */
export function initiativeOrder<U extends InitiativeUnit>(
  units: U[],
  rules: Rules['initiative'],
  getValue: (unit: U) => number,
): string[] {
  const values = new Map(units.map((u) => [u.id, getValue(u)]));
  const distinct = [...new Set(values.values())].sort((a, b) => b - a);
  const order: string[] = [];
  for (const v of distinct) {
    const group = units.filter((u) => values.get(u.id) === v);
    const allies = group.filter((u) => u.side === 'ally');
    const enemies = group.filter((u) => u.side === 'enemy');
    if (rules.tieBreak === 'allys-zuerst') order.push(...allies.map((u) => u.id), ...enemies.map((u) => u.id));
    else if (rules.tieBreak === 'gegner-zuerst') order.push(...enemies.map((u) => u.id), ...allies.map((u) => u.id));
    else {
      for (let i = 0; i < Math.max(allies.length, enemies.length); i++) {
        if (allies[i]) order.push(allies[i].id);
        if (enemies[i]) order.push(enemies[i].id);
      }
    }
  }
  return order;
}
