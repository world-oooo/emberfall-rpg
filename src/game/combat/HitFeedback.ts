import Phaser from 'phaser';
import type { DamageInfo } from './Damage';

/**
 * Visual/physical reaction to a hit for any actor sprite: white fill flash, knockback impulse, squash.
 * Audio, hitstop and camera shake are scene-level (CombatSystem) so they are not duplicated per actor.
 */
export class HitFeedback {
  private flashTimer: Phaser.Time.TimerEvent | null = null;
  private knockbackUntil = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly sprite: Phaser.Physics.Arcade.Sprite,
  ) {}

  get isKnockedBack(): boolean {
    return this.scene.time.now < this.knockbackUntil;
  }

  flash(durationMs = 90): void {
    const s = this.sprite;
    s.setTint(0xffffff);
    s.tintMode = Phaser.TintModes.FILL;
    this.flashTimer?.remove(false);
    this.flashTimer = this.scene.time.delayedCall(durationMs, () => {
      s.clearTint();
      s.tintMode = Phaser.TintModes.MULTIPLY;
      this.flashTimer = null;
    });
  }

  /** Velocity impulse away from the damage source; caller's state machine decides how long to honour it. */
  knockback(info: DamageInfo, durationMs = 160, multiplier = 1): void {
    if (info.knockback <= 0) return;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const dx = body.center.x - info.sourceX;
    const dy = body.center.y - info.sourceY;
    const len = Math.hypot(dx, dy) || 1;
    const speed = info.knockback * multiplier;
    body.velocity.set((dx / len) * speed, (dy / len) * speed);
    this.knockbackUntil = this.scene.time.now + durationMs;
  }

  /** Quick squash-and-recover. Scale returns to exactly 1 so pixels stay crisp afterwards. */
  squash(amount = 0.18, durationMs = 110): void {
    const s = this.sprite;
    this.scene.tweens.killTweensOf(s);
    s.setScale(1 + amount, 1 - amount);
    this.scene.tweens.add({ targets: s, scaleX: 1, scaleY: 1, duration: durationMs, ease: 'Back.easeOut' });
  }

  destroy(): void {
    this.flashTimer?.remove(false);
    this.flashTimer = null;
    this.scene.tweens.killTweensOf(this.sprite);
  }
}
