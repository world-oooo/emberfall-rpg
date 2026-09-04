import { describe, expect, it } from 'vitest';
import { computeDamage, type DamageInfo } from '../../src/game/combat/Damage';
import { Health } from '../../src/game/combat/Health';

const hit = (amount: number): DamageInfo => ({
  amount,
  sourceX: 0,
  sourceY: 0,
  knockback: 0,
  hitstop: 0,
  faction: 'player',
});

describe('combat pure helpers', () => {
  it('rounds damage but never drops below one', () => {
    expect(computeDamage(2, 0, 1.5)).toBe(3);
    expect(computeDamage(0, -10, 1)).toBe(1);
  });

  it('applies health invulnerability windows', () => {
    const health = new Health(5);
    expect(health.applyDamage(hit(2), 100, 300)).toEqual({ applied: true, damage: 2, killed: false });
    expect(health.current).toBe(3);
    expect(health.applyDamage(hit(2), 250, 300)).toEqual({ applied: false, damage: 0, killed: false });
    expect(health.current).toBe(3);
    expect(health.applyDamage(hit(5), 401, 0)).toEqual({ applied: true, damage: 3, killed: true });
    expect(health.current).toBe(0);
  });
});
