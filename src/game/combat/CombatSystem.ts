import Phaser from 'phaser';
import { Feel } from '../config/constants';
import type { Player } from '../entities/player/Player';
import { Effects } from '../vfx/Effects';
import type { TiledObject } from '../world/MapLoader';
import { createEnemy, enemySpawnFromObject, type EnemySpawnInput } from '../entities/enemies/factory';
import type { BaseEnemy } from '../entities/enemies/BaseEnemy';
import { Hitbox, type HitboxConfig, type Hittable } from './Hitbox';

/**
 * Runtime glue for hitboxes and hittables. WorldScene can own one instance and call update(delta).
 */
export class CombatSystem {
  readonly enemies: BaseEnemy[] = [];
  private readonly hitboxes: Hitbox[] = [];
  private readonly effects: Effects;
  private collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
  ) {
    this.effects = new Effects(scene);
    player.combat.setHitboxSink((config) => this.spawnHitbox(config));
    player.combat.setEffects(this.effects);
  }

  setWorldCollision(layer: Phaser.Tilemaps.TilemapLayer | null): void {
    this.collisionLayer = layer;
    if (!layer) return;
    for (const enemy of this.enemies) this.scene.physics.add.collider(enemy.sprite, layer);
  }

  spawnEnemy(spawn: EnemySpawnInput): BaseEnemy {
    const enemy = createEnemy(this.scene, spawn);
    this.enemies.push(enemy);
    this.scene.physics.add.collider(this.player.sprite, enemy.sprite);
    if (this.collisionLayer) this.scene.physics.add.collider(enemy.sprite, this.collisionLayer);
    return enemy;
  }

  spawnEnemies(objects: readonly TiledObject[]): BaseEnemy[] {
    return objects.map((obj) => this.spawnEnemy(enemySpawnFromObject(obj)));
  }

  spawnHitbox(config: HitboxConfig): Hitbox {
    const hitbox = new Hitbox(this.scene, config);
    this.hitboxes.push(hitbox);
    return hitbox;
  }

  update(delta: number): void {
    if (this.destroyed) return;
    const now = this.scene.time.now;
    for (const enemy of this.enemies) enemy.update(delta, this.player, (config) => this.spawnHitbox(config));
    for (const hitbox of this.hitboxes) {
      hitbox.update(now);
      if (hitbox.faction === 'player') {
        for (const enemy of this.enemies) this.tryHit(hitbox, enemy, enemy.body.center.x, enemy.body.center.y);
      } else {
        this.tryHit(hitbox, this.player, this.player.body.center.x, this.player.body.center.y);
      }
    }
    this.cleanup();
  }

  getLivingEnemies(): BaseEnemy[] {
    return this.enemies.filter((enemy) => !enemy.isDead && !enemy.isDestroyed);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.player.combat.setHitboxSink(null);
    this.player.combat.setEffects(null);
    for (const hitbox of this.hitboxes) hitbox.destroy();
    for (const enemy of this.enemies) enemy.destroy();
    this.hitboxes.length = 0;
    this.enemies.length = 0;
  }

  private tryHit(hitbox: Hitbox, target: Hittable & { body: Phaser.Physics.Arcade.Body }, x: number, y: number): void {
    if (!this.overlaps(hitbox.body, target.body)) return;
    const applied = hitbox.tryHit(target, x, y);
    if (!applied) return;
    this.effects.hitSpark(x, y);
    this.effects.number(x, y, `-${hitbox.config.damage}`, hitbox.faction === 'player' ? 0xfff0a6 : 0xff8f8f);
    this.effects.shake(hitbox.config.heavy);
    this.effects.sfx(hitbox.config.heavy ? 'hit_heavy' : 'hit', 0.8);
    if (hitbox.config.hitstop > 0) this.scene.physics.world.timeScale = 0.08;
    if (hitbox.config.hitstop > 0) {
      this.scene.time.delayedCall(Math.min(hitbox.config.hitstop, Feel.hitstopHeavy), () => {
        this.scene.physics.world.timeScale = 1;
      });
    }
  }

  private overlaps(a: Phaser.Physics.Arcade.Body, b: Phaser.Physics.Arcade.Body): boolean {
    return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
  }

  private cleanup(): void {
    for (let i = this.hitboxes.length - 1; i >= 0; i -= 1) {
      const hitbox = this.hitboxes[i];
      if (hitbox?.done) {
        hitbox.destroy();
        this.hitboxes.splice(i, 1);
      }
    }
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      if (this.enemies[i]?.isDestroyed) this.enemies.splice(i, 1);
    }
  }
}
