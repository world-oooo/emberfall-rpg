import Phaser from 'phaser';
import { Actor } from '../Actor';
import { Feel } from '../../config/constants';
import { gameEvents } from '../../core/events';
import type { DamageInfo } from '../../combat/Damage';
import { Health } from '../../combat/Health';
import { HitFeedback } from '../../combat/HitFeedback';
import type { HitboxConfig, Hittable } from '../../combat/Hitbox';
import type { EnemyDefinition } from '../../data/enemies';

export interface EnemyTarget {
  readonly x: number;
  readonly y: number;
  readonly body: Phaser.Physics.Arcade.Body;
}

export type EnemyHitboxSink = (config: HitboxConfig) => void;

type EnemyState = 'idle' | 'chase' | 'windup' | 'attack' | 'cooldown' | 'return' | 'dead';

let nextEnemyUid = 1;

export class BaseEnemy extends Actor implements Hittable {
  readonly hitId: string;
  readonly health: Health;
  readonly spawn = new Phaser.Math.Vector2();
  private readonly feedback: HitFeedback;
  private state: EnemyState = 'idle';
  private stateElapsed = 0;
  private cooldownUntil = 0;
  private attackSpawned = false;
  private lastDir = new Phaser.Math.Vector2(0, 1);
  private destroyed = false;

  constructor(
    scene: Phaser.Scene,
    readonly def: EnemyDefinition,
    readonly spawnId: string,
    x: number,
    y: number,
  ) {
    super(scene, x, y, { texture: def.texture, frame: 0, body: def.body, shadow: true, shadowOffsetY: -1 });
    this.spawn.set(x, y);
    this.hitId = `enemy:${spawnId}:${nextEnemyUid++}`;
    this.health = new Health(def.hp);
    this.feedback = new HitFeedback(scene, this.sprite);
    this.sprite.setName(`enemy:${def.id}:${spawnId}`);
    if (def.tint !== undefined) this.sprite.setTint(def.tint);
    this.ensureIdleAnimation();
    this.health.addListener({
      onDied: () => {
        gameEvents.emit('enemyDefeated', { enemyId: this.def.id, spawnId: this.spawnId, x: this.x, y: this.y });
      },
    });
  }

  get isDead(): boolean {
    return this.health.isDead;
  }

  get isDestroyed(): boolean {
    return this.destroyed;
  }

  update(delta: number, target: EnemyTarget, spawnHitbox: EnemyHitboxSink): void {
    if (this.destroyed || this.state === 'dead') return;
    this.stateElapsed += delta;
    this.syncDepth();
    if (this.feedback.isKnockedBack) return;

    const toTarget = new Phaser.Math.Vector2(target.body.center.x - this.body.center.x, target.body.center.y - this.body.center.y);
    const distance = toTarget.length();
    const fromSpawn = Phaser.Math.Distance.Between(this.x, this.y, this.spawn.x, this.spawn.y);
    if (distance > 0) this.lastDir.copy(toTarget).normalize();

    if (this.state === 'windup') {
      this.body.velocity.set(0, 0);
      if (this.stateElapsed >= this.def.attack.windup) this.setState('attack');
      return;
    }

    if (this.state === 'attack') {
      this.performAttack(spawnHitbox);
      if (this.stateElapsed >= this.def.attack.active) {
        this.cooldownUntil = this.scene.time.now + this.def.attack.cooldown;
        this.setState('cooldown');
      }
      return;
    }

    if (this.state === 'cooldown') {
      this.body.velocity.set(0, 0);
      if (this.scene.time.now >= this.cooldownUntil) this.setState(distance <= this.def.aggroRange ? 'chase' : 'idle');
      return;
    }

    if (fromSpawn > this.def.leashRange) {
      this.moveToward(this.spawn.x, this.spawn.y, this.def.speed * 0.85);
      this.state = 'return';
      if (fromSpawn < 8) this.setState('idle');
      return;
    }

    if (distance <= this.def.attack.range && this.scene.time.now >= this.cooldownUntil) {
      this.setState('windup');
      return;
    }

    if (distance <= this.def.aggroRange) {
      this.setState('chase');
      this.chase(target, distance);
      return;
    }

    this.idleDrift();
  }

  takeHit(info: DamageInfo): boolean {
    if (info.faction === 'enemy' || this.health.isDead) return false;
    const result = this.health.applyDamage(info, this.scene.time.now, 170);
    if (!result.applied) return false;
    this.feedback.flash(Feel.hitFlash);
    this.feedback.knockback(info, info.heavy ? 240 : 160, 1);
    this.feedback.squash(info.heavy ? 0.2 : 0.13, 120);
    if (result.killed) this.die(info);
    else this.setState('cooldown');
    return true;
  }

  private chase(target: EnemyTarget, distance: number): void {
    switch (this.def.behavior) {
      case 'slime':
        this.slimeHop(target);
        break;
      case 'mushroom':
        if (distance < this.def.attack.range * 0.7) this.moveAwayFrom(target, this.def.speed * 0.7);
        else this.moveToward(target.body.center.x, target.body.center.y, this.def.speed);
        break;
      case 'bat':
        this.moveToward(target.body.center.x, target.body.center.y + Math.sin(this.scene.time.now / 150) * 10, this.def.speed);
        break;
      case 'skeleton':
        this.moveToward(target.body.center.x, target.body.center.y, this.def.speed);
        break;
      case 'boss':
        this.moveToward(target.body.center.x, target.body.center.y, this.def.speed * (this.health.ratio < 0.5 ? 1.2 : 1));
        break;
    }
  }

  private performAttack(spawnHitbox: EnemyHitboxSink): void {
    if (this.attackSpawned) return;
    this.attackSpawned = true;
    const a = this.def.attack;
    const heavy = this.def.behavior === 'boss';
    const range = this.def.behavior === 'mushroom' ? 0 : a.range * 0.65;
    const x = this.body.center.x + this.lastDir.x * range;
    const y = this.body.center.y + this.lastDir.y * range;
    const horizontal = Math.abs(this.lastDir.x) > Math.abs(this.lastDir.y);
    spawnHitbox({
      x,
      y,
      width: horizontal ? a.width : a.height,
      height: horizontal ? a.height : a.width,
      faction: 'enemy',
      damage: a.damage,
      knockback: a.knockback,
      hitstop: a.hitstop,
      duration: a.active,
      heavy,
      owner: this,
      tags: [this.def.behavior],
    });
  }

  private slimeHop(target: EnemyTarget): void {
    const pulse = Math.sin(this.scene.time.now / 120);
    const speed = pulse > -0.15 ? this.def.speed : 0;
    this.moveToward(target.body.center.x, target.body.center.y, speed);
  }

  private idleDrift(): void {
    const t = this.scene.time.now / 1000 + this.spawn.x * 0.01;
    const radius = this.def.behavior === 'bat' ? 18 : 8;
    const goalX = this.spawn.x + Math.cos(t) * radius;
    const goalY = this.spawn.y + Math.sin(t * 0.8) * radius;
    this.moveToward(goalX, goalY, this.def.speed * 0.35);
    this.state = 'idle';
  }

  private moveToward(x: number, y: number, speed: number): void {
    const dx = x - this.body.center.x;
    const dy = y - this.body.center.y;
    const len = Math.hypot(dx, dy);
    if (len < 2 || speed <= 0) {
      this.body.velocity.set(0, 0);
      return;
    }
    this.body.velocity.set((dx / len) * speed, (dy / len) * speed);
  }

  private moveAwayFrom(target: EnemyTarget, speed: number): void {
    const dx = this.body.center.x - target.body.center.x;
    const dy = this.body.center.y - target.body.center.y;
    const len = Math.hypot(dx, dy) || 1;
    this.body.velocity.set((dx / len) * speed, (dy / len) * speed);
  }

  private setState(state: EnemyState): void {
    if (this.state === state) return;
    this.state = state;
    this.stateElapsed = 0;
    this.attackSpawned = false;
    if (state === 'windup') this.sprite.setTint(this.def.boss ? 0xff9b67 : 0xffc1a3);
    else if (this.def.tint !== undefined) this.sprite.setTint(this.def.tint);
    else this.sprite.clearTint();
  }

  private ensureIdleAnimation(): void {
    const key = `${this.def.texture}_idle`;
    if (!this.scene.anims.exists(key)) {
      const frameCount = this.def.boss ? 6 : 4;
      this.scene.anims.create({
        key,
        frames: this.scene.anims.generateFrameNumbers(this.def.texture, { start: 0, end: frameCount - 1 }),
        frameRate: this.def.boss ? 7 : 5,
        repeat: -1,
      });
    }
    this.sprite.play(key);
  }

  private die(info: DamageInfo): void {
    this.setState('dead');
    this.body.velocity.set(0, 0);
    this.body.enable = false;
    const pushX = this.x + (this.x - info.sourceX) * 0.05;
    const pushY = this.y + (this.y - info.sourceY) * 0.05;
    this.scene.tweens.add({
      targets: this.sprite,
      x: pushX,
      y: pushY,
      alpha: 0,
      scaleX: 0.85,
      scaleY: 0.85,
      duration: 260,
      ease: 'Cubic.easeIn',
      onComplete: () => this.destroy(),
    });
    this.shadow?.setAlpha(0);
  }

  override destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.feedback.destroy();
    super.destroy();
  }
}
