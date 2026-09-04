import Phaser from 'phaser';
import { getEnemy } from '../../data/enemies';
import { propStr, type TiledObject } from '../../world/MapLoader';
import { BaseEnemy } from './BaseEnemy';
import { BossEnemy, type BossWorld } from './BossEnemy';

export interface EnemySpawnInput {
  enemyId: string;
  spawnId: string;
  x: number;
  y: number;
}

export function enemySpawnFromObject(obj: TiledObject): EnemySpawnInput {
  const enemyId = propStr(obj, 'enemyId');
  return {
    enemyId,
    spawnId: propStr(obj, 'spawnId', obj.name || `${enemyId}_${obj.id}`),
    x: Math.round(obj.x),
    y: Math.round(obj.y) - 8,
  };
}

export function createEnemy(scene: Phaser.Scene, spawn: EnemySpawnInput, bossWorld?: BossWorld): BaseEnemy {
  const definition = getEnemy(spawn.enemyId);
  if (definition.boss && bossWorld) return new BossEnemy(scene, definition, spawn.spawnId, spawn.x, spawn.y, bossWorld);
  return new BaseEnemy(scene, definition, spawn.spawnId, spawn.x, spawn.y);
}
