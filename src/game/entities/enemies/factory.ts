import Phaser from 'phaser';
import { getEnemy } from '../../data/enemies';
import { propStr, type TiledObject } from '../../world/MapLoader';
import { BaseEnemy } from './BaseEnemy';

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

export function createEnemy(scene: Phaser.Scene, spawn: EnemySpawnInput): BaseEnemy {
  return new BaseEnemy(scene, getEnemy(spawn.enemyId), spawn.spawnId, spawn.x, spawn.y);
}
