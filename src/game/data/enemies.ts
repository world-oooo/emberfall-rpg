import { enemyTexture } from '../config/assets';

export type EnemyBehavior = 'slime' | 'mushroom' | 'bat' | 'skeleton' | 'boss';

export interface EnemyAttackDefinition {
  damage: number;
  knockback: number;
  hitstop: number;
  range: number;
  cooldown: number;
  windup: number;
  active: number;
  width: number;
  height: number;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  hp: number;
  speed: number;
  body: { width: number; height: number; offsetX: number; offsetY: number };
  aggroRange: number;
  leashRange: number;
  behavior: EnemyBehavior;
  xp: number;
  texture: string;
  attack: EnemyAttackDefinition;
  tint?: number;
  boss?: boolean;
}

export const ENEMIES: Record<string, EnemyDefinition> = {
  slime: {
    id: 'slime',
    name: 'Forest Slime',
    hp: 4,
    speed: 44,
    body: { width: 10, height: 8, offsetX: 3, offsetY: 7 },
    aggroRange: 82,
    leashRange: 150,
    behavior: 'slime',
    xp: 2,
    texture: enemyTexture('slime'),
    attack: { damage: 1, knockback: 85, hitstop: 35, range: 18, cooldown: 820, windup: 180, active: 150, width: 18, height: 16 },
  },
  mushroom: {
    id: 'mushroom',
    name: 'Sporecap',
    hp: 5,
    speed: 30,
    body: { width: 10, height: 8, offsetX: 3, offsetY: 7 },
    aggroRange: 96,
    leashRange: 160,
    behavior: 'mushroom',
    xp: 3,
    texture: enemyTexture('mushroom'),
    attack: { damage: 1, knockback: 55, hitstop: 35, range: 46, cooldown: 1350, windup: 420, active: 180, width: 38, height: 38 },
  },
  bat: {
    id: 'bat',
    name: 'Shrine Bat',
    hp: 3,
    speed: 78,
    body: { width: 10, height: 8, offsetX: 3, offsetY: 7 },
    aggroRange: 118,
    leashRange: 185,
    behavior: 'bat',
    xp: 3,
    texture: enemyTexture('bat'),
    attack: { damage: 1, knockback: 95, hitstop: 35, range: 24, cooldown: 760, windup: 120, active: 170, width: 20, height: 18 },
  },
  skeleton: {
    id: 'skeleton',
    name: 'Hollow Guard',
    hp: 7,
    speed: 52,
    body: { width: 10, height: 8, offsetX: 3, offsetY: 7 },
    aggroRange: 112,
    leashRange: 175,
    behavior: 'skeleton',
    xp: 5,
    texture: enemyTexture('skeleton'),
    attack: { damage: 2, knockback: 125, hitstop: 45, range: 24, cooldown: 1050, windup: 280, active: 120, width: 24, height: 18 },
  },
  boss_racoon: {
    id: 'boss_racoon',
    name: 'Mask Keeper',
    hp: 26,
    speed: 64,
    body: { width: 18, height: 12, offsetX: 21, offsetY: 42 },
    aggroRange: 160,
    leashRange: 230,
    behavior: 'boss',
    xp: 25,
    texture: enemyTexture('boss_racoon'),
    attack: { damage: 2, knockback: 160, hitstop: 70, range: 34, cooldown: 980, windup: 360, active: 190, width: 42, height: 30 },
    boss: true,
  },
};

export function getEnemy(id: string): EnemyDefinition {
  const enemy = ENEMIES[id];
  if (!enemy) throw new Error(`Unknown enemy: ${id}`);
  return enemy;
}
