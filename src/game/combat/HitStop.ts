import type Phaser from 'phaser';

/**
 * Single owner of combat freeze frames.
 *
 * The previous implementation set `physics.world.timeScale = 0.08` and reset it on a timer. Phaser's world
 * timeScale is inverted (2 = half speed), so that value ran physics roughly twelve times faster for the
 * window — a jolt, not a hitstop — and overlapping hits reset each other early.
 *
 * This controller pauses physics, animations and tweens together, keeps only the longest pending request,
 * and resumes from the scene clock, which is unaffected by the physics time scale.
 */
export class HitStopController {
  private endsAt = 0;
  private active = false;
  private timer: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  get isFrozen(): boolean {
    return this.active;
  }

  /** Freeze everything for `durationMs`. A longer request while frozen extends the freeze; a shorter one is ignored. */
  request(durationMs: number): void {
    if (durationMs <= 0) return;
    const now = this.scene.time.now;
    const end = now + durationMs;
    if (this.active && end <= this.endsAt) return;
    this.endsAt = end;
    if (!this.active) this.freeze();
    this.timer?.remove(false);
    this.timer = this.scene.time.delayedCall(Math.max(1, this.endsAt - now), () => this.release());
  }

  private freeze(): void {
    this.active = true;
    this.scene.physics.world.pause();
    this.scene.anims.pauseAll();
    this.scene.tweens.timeScale = 0;
  }

  private release(): void {
    if (!this.active) return;
    this.active = false;
    this.timer = null;
    this.scene.physics.world.resume();
    this.scene.anims.resumeAll();
    this.scene.tweens.timeScale = 1;
  }

  destroy(): void {
    this.timer?.remove(false);
    this.timer = null;
    if (this.active) this.release();
  }
}
