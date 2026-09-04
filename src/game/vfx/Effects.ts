import Phaser from 'phaser';
import { Depth, Feel } from '../config/constants';
import { Tex, sfxKey } from '../config/assets';
import { SettingsStore } from '../systems/SettingsStore';
import type { Facing } from '../entities/player/heroAnimations';

const FACING_ANGLE: Record<Facing, number> = { right: 0, down: 90, left: 180, up: 270 };

/** One-shot sprite effects and particles. Every effect is short and never covers the screen. */
export class Effects {
  constructor(private readonly scene: Phaser.Scene) {}

  private oneShot(anim: string, texture: string, x: number, y: number, depth: number, angle = 0, flipX = false): Phaser.GameObjects.Sprite {
    const s = this.scene.add.sprite(Math.round(x), Math.round(y), texture, 0).setDepth(depth).setAngle(angle).setFlipX(flipX);
    s.play(anim);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
    return s;
  }

  slash(x: number, y: number, facing: Facing, heavy = false): void {
    const angle = FACING_ANGLE[facing];
    if (heavy) this.oneShot('fx_slash_arc', Tex.fxSlashArc, x, y, Depth.ActorBase + y + 20, angle);
    else this.oneShot('fx_slash_01', Tex.fxSlash01, x, y, Depth.ActorBase + y + 20, angle);
  }

  hitSpark(x: number, y: number): void {
    this.oneShot('fx_circle_spark', Tex.fxCircleSpark, x, y, Depth.ActorBase + y + 30);
  }

  bigSpark(x: number, y: number): void {
    this.oneShot('fx_spark', Tex.fxSpark, x, y, Depth.ActorBase + y + 30);
  }

  smokePuff(x: number, y: number): void {
    this.oneShot('fx_smoke', Tex.fxSmoke, x, y, Depth.ActorBase + y + 25);
  }

  dust(x: number, y: number): void {
    this.oneShot('fx_smoke_circular', Tex.fxSmokeCircular, x, y, Depth.ActorBase + y - 2);
  }

  explosion(x: number, y: number): void {
    this.oneShot('fx_explosion', Tex.fxExplosion, x, y, Depth.ActorBase + y + 30);
  }

  deathBurst(x: number, y: number): void {
    this.smokePuff(x, y);
    const emitter = this.scene.add.particles(x, y, Tex.fxParticleSpark, {
      frame: [0, 1, 2, 3],
      speed: { min: 40, max: 110 },
      lifespan: { min: 250, max: 450 },
      quantity: 10,
      scale: 1,
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    emitter.setDepth(Depth.ActorBase + y + 31);
    emitter.explode(10, 0, 0);
    this.scene.time.delayedCall(600, () => emitter.destroy());
  }

  leaves(x: number, y: number, count = 6): void {
    const emitter = this.scene.add.particles(x, y, Tex.fxParticleLeaf, {
      frame: [0, 1, 2, 3, 4, 5],
      speed: { min: 20, max: 60 },
      angle: { min: 200, max: 340 },
      gravityY: 60,
      lifespan: { min: 400, max: 800 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    emitter.setDepth(Depth.ActorBase + y + 20);
    emitter.explode(count, 0, 0);
    this.scene.time.delayedCall(900, () => emitter.destroy());
  }

  levelUp(x: number, y: number): void {
    const s = this.scene.add.sprite(Math.round(x), Math.round(y) - 8, Tex.fxBoost, 0).setDepth(Depth.ActorBase + y + 40);
    s.play('fx_boost');
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
  }

  /** Floating damage/heal number. */
  number(x: number, y: number, value: string, tint = 0xffffff): void {
    const t = this.scene.add.bitmapText(Math.round(x), Math.round(y) - 12, Tex.font, value, 8).setOrigin(0.5).setTint(tint).setDepth(Depth.AbovePlayer + 1);
    this.scene.tweens.add({ targets: t, y: t.y - 14, alpha: { from: 1, to: 0 }, duration: 600, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  /**
   * Warning marker drawn before an enemy commits to an attack. Shape and colour differ per attack so the
   * player can tell a swipe from a charge without reading the sprite.
   */
  telegraph(x: number, y: number, kind: 'swipe' | 'charge' | 'burst' | 'strike'): void {
    const graphics = this.scene.add.graphics().setDepth(Depth.ActorBase + y - 4);
    const colour = kind === 'charge' ? 0xffb45c : kind === 'burst' ? 0xa9c8ff : 0xff7a5c;
    const draw = (scale: number, alpha: number) => {
      graphics.clear();
      graphics.lineStyle(1, colour, alpha);
      graphics.fillStyle(colour, alpha * 0.18);
      if (kind === 'burst') {
        graphics.strokeCircle(x, y, 26 * scale);
        graphics.fillCircle(x, y, 26 * scale);
      } else if (kind === 'charge') {
        const w = 46 * scale;
        graphics.strokeRect(x - w / 2, y - 7, w, 14);
        graphics.fillRect(x - w / 2, y - 7, w, 14);
      } else {
        graphics.strokeCircle(x, y, 17 * scale);
        graphics.fillCircle(x, y, 17 * scale);
      }
    };
    draw(0.4, 0.9);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: kind === 'charge' ? 520 : 420,
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        draw(0.4 + t * 0.75, 0.9 * (1 - t * 0.55));
      },
      onComplete: () => graphics.destroy(),
    });
  }

  shake(heavy = false): void {
    if (!SettingsStore.get().screenShake) return;
    this.scene.cameras.main.shake(heavy ? Feel.cameraShakeHeavy : Feel.cameraShakeLight, heavy ? 0.008 : 0.004);
  }

  sfx(id: string, volume = 1, detune = 0): void {
    const v = volume * SettingsStore.get().sfxVolume;
    if (v <= 0) return;
    this.scene.sound.play(sfxKey(id), { volume: v, detune });
  }

  sfxRandom(ids: string[], volume = 1): void {
    const id = ids[Math.floor(Math.random() * ids.length)];
    if (id) this.sfx(id, volume, Phaser.Math.Between(-150, 150));
  }
}
