import Phaser from 'phaser';
import type { DamageInfo, Faction } from './Damage';

export interface HitboxConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  faction: Faction;
  damage: number;
  knockback: number;
  hitstop: number;
  /** how long the box stays active (ms) */
  duration: number;
  heavy?: boolean;
  /** optional: follow this object every frame (offsets relative to it) */
  follow?: { target: { x: number; y: number }; offsetX: number; offsetY: number };
  /** the actor that owns the box; hits on it are ignored */
  owner?: unknown;
  tags?: readonly string[];
}

export interface Hittable {
  /** unique object identity used for once-per-hitbox filtering */
  readonly hitId: string;
  takeHit(info: DamageInfo): boolean;
}

/**
 * A short-lived Arcade zone that damages every Hittable it overlaps, once per target.
 * Attack windows spawn one; enemies' lunges/slams spawn one. Overlap wiring lives in CombatSystem.
 */
export class Hitbox {
  readonly zone: Phaser.GameObjects.Zone;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly faction: Faction;
  readonly config: HitboxConfig;
  private readonly hit = new Set<string>();
  private readonly expiresAt: number;
  done = false;

  constructor(
    readonly scene: Phaser.Scene,
    config: HitboxConfig,
  ) {
    this.config = config;
    this.faction = config.faction;
    this.zone = scene.add.zone(config.x, config.y, config.width, config.height);
    scene.physics.add.existing(this.zone, false);
    this.body = this.zone.body as Phaser.Physics.Arcade.Body;
    this.body.setAllowGravity(false);
    this.body.moves = false;
    this.expiresAt = scene.time.now + config.duration;
  }

  update(now: number): void {
    const f = this.config.follow;
    if (f) {
      this.zone.setPosition(f.target.x + f.offsetX, f.target.y + f.offsetY);
      this.body.reset(this.zone.x, this.zone.y);
    }
    if (now >= this.expiresAt) this.done = true;
  }

  /** Apply to a target; returns true if damage was dealt. */
  tryHit(target: Hittable, targetX: number, targetY: number): boolean {
    if (this.done || this.hit.has(target.hitId)) return false;
    if (target === (this.config.owner as unknown)) return false;
    this.hit.add(target.hitId);
    const info: DamageInfo = {
      amount: this.config.damage,
      sourceX: this.config.follow ? this.config.follow.target.x : this.zone.x,
      sourceY: this.config.follow ? this.config.follow.target.y : this.zone.y,
      knockback: this.config.knockback,
      hitstop: this.config.hitstop,
      faction: this.faction,
      heavy: this.config.heavy ?? false,
      tags: this.config.tags,
    };
    // knock away from the hitbox centre, not the target itself
    void targetX;
    void targetY;
    return target.takeHit(info);
  }

  destroy(): void {
    this.done = true;
    this.zone.destroy();
  }
}
