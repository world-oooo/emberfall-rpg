export type Faction = 'player' | 'enemy';

export interface DamageInfo {
  amount: number;
  /** world position the hit came from; knockback pushes away from it */
  sourceX: number;
  sourceY: number;
  /** knockback speed in px/s (0 = none) */
  knockback: number;
  /** hitstop duration in ms requested by this hit */
  hitstop: number;
  faction: Faction;
  /** true for the last hit of a chain / heavy attacks: stronger feedback */
  heavy?: boolean;
  tags?: readonly string[];
}

export interface HitResult {
  applied: boolean;
  damage: number;
  killed: boolean;
}

/** Pure helper used by both the game and unit tests. */
export function computeDamage(base: number, attackBonus: number, multiplier = 1): number {
  return Math.max(1, Math.round((base + attackBonus) * multiplier));
}
