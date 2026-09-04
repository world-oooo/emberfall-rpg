import type { SaveGame } from '../core/session';

export const LEVEL_THRESHOLDS = [0, 20, 50, 90, 140, 200] as const;
export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export interface XpResult {
  previousLevel: number;
  level: number;
  previousXp: number;
  xp: number;
  levelsGained: number;
  maxHpIncreasedBy: number;
}

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    const threshold = LEVEL_THRESHOLDS[i];
    if (threshold === undefined || xp < threshold) break;
    level = i + 1;
  }
  return level;
}

export function attackBonusForLevel(level: number): number {
  return Math.max(0, Math.min(level, MAX_LEVEL) - 1);
}

export class ProgressionSystem {
  constructor(private readonly save: SaveGame) {}

  addXp(amount: number): XpResult {
    if (!Number.isInteger(amount) || amount < 0) throw new Error(`XP must be a non-negative integer: ${amount}`);
    const previousXp = this.save.player.xp;
    const previousLevel = this.save.player.level;
    this.save.player.xp += amount;

    const nextLevel = Math.max(previousLevel, levelForXp(this.save.player.xp));
    let maxHpIncreasedBy = 0;
    for (let level = previousLevel + 1; level <= nextLevel; level++) {
      if (level % 2 === 0) maxHpIncreasedBy += 2;
    }

    this.save.player.level = nextLevel;
    this.save.player.maxHp += maxHpIncreasedBy;
    this.save.player.hp = Math.min(this.save.player.maxHp, this.save.player.hp + maxHpIncreasedBy);

    return {
      previousLevel,
      level: nextLevel,
      previousXp,
      xp: this.save.player.xp,
      levelsGained: nextLevel - previousLevel,
      maxHpIncreasedBy,
    };
  }
}
