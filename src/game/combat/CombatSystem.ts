import Phaser from 'phaser';
import { Feel } from '../config/constants';
import type { Player } from '../entities/player/Player';
import { Effects } from '../vfx/Effects';
import type { TiledObject } from '../world/MapLoader';
import { createEnemy, enemySpawnFromObject, type EnemySpawnInput } from '../entities/enemies/factory';
import type { BossWorld } from '../entities/enemies/BossEnemy';
import type { BaseEnemy } from '../entities/enemies/BaseEnemy';
import { Hitbox, type HitboxConfig, type Hittable } from './Hitbox';
import { HitStopController } from './HitStop';

/**
 * Runtime glue for hitboxes and hittables. WorldScene can own one instance and call update(delta).
 */
export class CombatSystem {
  readonly enemies: BaseEnemy[] = [];
  readonly hitStop: HitStopController;
  private readonly hitboxes: Hitbox[] = [];
  /** Bound once so the enemy loop does not allocate a closure per enemy per frame. */
  private readonly enemyHitboxSink = (config: HitboxConfig): void => {
    this.spawnHitbox(config);
  };
  private readonly effects: Effects;

  private collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private bossWorld: BossWorld | null = null;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
  ) {
    this.effects = new Effects(scene);
    this.hitStop = new HitStopController(scene);
    player.combat.setHitboxSink((config) => this.spawnHitbox(config));
    player.combat.setEffects(this.effects);
  }

  /** Shared one-shot effects, exposed so entity controllers can play telegraphs without owning a scene reference. */
  get effectsLayer(): Effects {
    return this.effects;
  }

  setWorldCollision(layer: Phaser.Tilemaps.TilemapLayer | null): void {
    this.collisionLayer = layer;
    if (!layer) return;
    for (const enemy of this.enemies) this.scene.physics.add.collider(enemy.sprite, layer);
  }

  /** Supplies the hooks a boss controller needs. Must be set before boss spawns are created. */
  setBossWorld(world: BossWorld): void {
    this.bossWorld = world;
  }

  spawnEnemy(spawn: EnemySpawnInput): BaseEnemy {
    const enemy = createEnemy(this.scene, spawn, this.bossWorld ?? undefined);
    enemy.telegraphSink = (x, y, kind) => this.effects.telegraph(x, y, kind);
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
    for (const enemy of this.enemies) enemy.update(delta, this.player, this.enemyHitboxSink);
    // Keep chasers from collapsing into one sprite. With at most a dozen enemies the pair loop is trivial.
    for (let i = 0; i < this.enemies.length; i += 1) {
      const a = this.enemies[i];
      if (!a || a.isDead || a.isDestroyed) continue;
      for (let j = i + 1; j < this.enemies.length; j += 1) {
        const b = this.enemies[j];
        if (!b || b.isDead || b.isDestroyed) continue;
        a.separateFrom(b, delta);
        b.separateFrom(a, delta);
      }
    }
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
    this.hitStop.destroy();
    for (const hitbox of this.hitboxes) hitbox.destroy();
    for (const enemy of this.enemies) enemy.destroy();
    this.hitboxes.length = 0;
    this.enemies.length = 0;
  }

  private tryHit(hitbox: Hitbox, target: Hittable & { body: Phaser.Physics.Arcade.Body }, x: number, y: number): void {
    if (!this.overlaps(hitbox.body, target.body)) return;
    const applied = hitbox.tryHit(target, x, y);
    if (!applied) return;
    const heavy = Boolean(hitbox.config.heavy);
    if (heavy) this.effects.bigSpark(x, y);
    else this.effects.hitSpark(x, y);
    this.effects.number(x, y, `${hitbox.config.damage}`, hitbox.faction === 'player' ? 0xfff0a6 : 0xff8f8f);
    this.effects.shake(heavy);
    this.effects.sfx(heavy ? 'hit_heavy' : 'hit', 0.8, heavy ? -120 : 0);
    this.hitStop.request(Math.min(hitbox.config.hitstop, Feel.hitstopBoss));
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
