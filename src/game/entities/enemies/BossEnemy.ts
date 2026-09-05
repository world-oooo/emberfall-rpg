import Phaser from 'phaser';
import { BaseEnemy, type EnemyHitboxSink, type EnemyTarget } from './BaseEnemy';
import { Feel } from '../../config/constants';
import type { DamageInfo } from '../../combat/Damage';
import type { EnemyDefinition } from '../../data/enemies';
import { StateMachine } from '../../core/StateMachine';

/** Everything the boss needs from the world, supplied by WorldScene so the boss stays scene-agnostic. */
export interface BossWorld {
  spawnHitbox: EnemyHitboxSink;
  spawnProjectile(x: number, y: number, vx: number, vy: number, damage: number): void;
  telegraph(x: number, y: number, kind: 'swipe' | 'charge' | 'burst'): void;
  onPhaseChange(phase: number): void;
  shake(heavy: boolean): void;
  sfx(id: string, volume?: number, detune?: number): void;
}

type BossState = 'sleep' | 'wake' | 'idle' | 'swipeWind' | 'swipeHit' | 'swipeEnd' | 'chargeWind' | 'chargeDash' | 'chargeStun' | 'burstWind' | 'burstFire' | 'burstEnd' | 'dead';

/** Attack ranges in pixels between body centres. */
const SWIPE_RANGE = 52;
const CHARGE_MIN = 46;
const CHARGE_SPEED = 320;
const BURST_PROJECTILES = 8;

/**
 * The Mask Keeper.
 *
 * A regular enemy with more HP is not a boss: the old encounter had one attack, chased without pause, and
 * could drain the player from full to one heart in under three seconds. This controller gives it three
 * readable attacks, a telegraph before each, a guaranteed punish window after each, and a second phase that
 * changes the attack composition rather than only the speed.
 */
export class BossEnemy extends BaseEnemy {
  private readonly fsm: StateMachine<BossEnemy, BossState>;
  private readonly world: BossWorld;
  private readonly aim = new Phaser.Math.Vector2(0, 1);
  private target: EnemyTarget | null = null;
  private phase = 1;
  private lastAttack: BossState | null = null;
  private repeatCount = 0;
  private comboFollowUp: BossState | null = null;
  private dashElapsed = 0;
  private awake = false;
  /** Cuts taken while repositioning; three in a row and the Keeper answers instead of drifting. */
  private hitsWhileIdle = 0;

  constructor(scene: Phaser.Scene, def: EnemyDefinition, spawnId: string, x: number, y: number, world: BossWorld) {
    super(scene, def, spawnId, x, y);
    this.world = world;
    this.body.setImmovable(true);
    this.body.pushable = false;
    this.fsm = this.buildStates();
    this.fsm.set('sleep');
  }

  get currentPhase(): number {
    return this.phase;
  }

  /** Time in ms the boss stands open after its current action; used by the debug overlay and tests. */
  get isVulnerableWindow(): boolean {
    return this.fsm.is('swipeEnd') || this.fsm.is('burstEnd') || this.fsm.is('chargeStun');
  }

  private buildStates(): StateMachine<BossEnemy, BossState> {
    return new StateMachine<BossEnemy, BossState>(this)
      .add('sleep', {
        enter: (b) => {
          b.body.velocity.set(0, 0);
          b.playBossAnim('idle');
        },
        update: (b) => {
          if (b.awake) b.fsm.set('wake');
        },
      })
      .add('wake', {
        enter: (b) => {
          b.body.velocity.set(0, 0);
          b.playBossAnim('idle');
          b.sprite.setTint(0xffd0a0);
          b.world.sfx('boss_roar', 0.9);
          b.world.shake(true);
          b.scene.tweens.add({ targets: b.sprite, scaleX: 1.12, scaleY: 0.9, duration: 220, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
        },
        update: (b) => {
          if (b.fsm.elapsed >= 1100) {
            b.sprite.clearTint();
            b.fsm.set('idle');
          }
        },
      })
      // Reposition between attacks. Always leaves a beat where the player can close in and hit back.
      .add('idle', {
        enter: (b) => {
          b.hitsWhileIdle = 0;
          b.playBossAnim('idle');
        },
        update: (b, delta) => {
          const target = b.target;
          if (!target) return;
          const distance = b.distanceTo(target);
          // Drift toward a comfortable mid distance rather than hugging the player.
          const desired = 62;
          const speed = b.def.speed * (b.phase === 2 ? 0.9 : 0.7);
          if (distance > desired + 14) b.moveToward(target.body.center.x, target.body.center.y, speed);
          else if (distance < desired - 18) b.stepAwayFrom(target, speed * 0.8);
          else b.body.velocity.set(0, 0);
          b.faceTarget(target);
          void delta;
          // A player standing in swipe range gets answered twice as fast: hugging the boss is not free.
          const wait = (b.phase === 2 ? 620 : 900) * (distance <= SWIPE_RANGE ? 0.5 : 1);
          if (b.fsm.elapsed >= wait) b.chooseAttack(distance);
        },
        exit: (b) => b.body.velocity.set(0, 0),
      })
      // ---- Swipe: short reach, clear raise, big punish window.
      .add('swipeWind', {
        enter: (b) => {
          b.body.velocity.set(0, 0);
          if (b.target) b.faceTarget(b.target);
          b.playBossAnim('attack', 0.55);
          b.sprite.setTint(0xff8a5c);
          b.world.telegraph(b.body.center.x + b.aim.x * 30, b.body.center.y + b.aim.y * 30, 'swipe');
          b.world.sfx('alert', 0.45, 300);
        },
        update: (b) => {
          if (b.fsm.elapsed >= (b.phase === 2 ? 380 : 460)) b.fsm.set('swipeHit');
        },
      })
      .add('swipeHit', {
        enter: (b) => {
          b.sprite.clearTint();
          b.playBossAnim('attack', 1.4);
          const horizontal = Math.abs(b.aim.x) > Math.abs(b.aim.y);
          b.world.spawnHitbox({
            x: b.body.center.x + b.aim.x * 30,
            y: b.body.center.y + b.aim.y * 30,
            width: horizontal ? 40 : 54,
            height: horizontal ? 54 : 40,
            faction: 'enemy',
            damage: 1,
            knockback: 190,
            hitstop: Feel.hitstopBoss,
            duration: 150,
            heavy: true,
            owner: b,
            tags: ['boss', 'swipe'],
          });
          b.world.sfx('slam', 0.7);
          b.world.shake(true);
        },
        update: (b) => {
          if (b.fsm.elapsed >= 160) b.fsm.set('swipeEnd');
        },
      })
      .add('swipeEnd', {
        enter: (b) => {
          b.body.velocity.set(0, 0);
          b.playBossAnim('idle');
        },
        update: (b) => {
          const recovery = b.phase === 2 ? 480 : 620;
          if (b.fsm.elapsed < recovery) return;
          if (b.comboFollowUp) {
            const next = b.comboFollowUp;
            b.comboFollowUp = null;
            b.fsm.set(next);
          } else b.fsm.set('idle');
        },
      })
      // ---- Charge: locks a direction, warns, then commits. Hitting a wall staggers it wide open.
      .add('chargeWind', {
        enter: (b) => {
          b.body.velocity.set(0, 0);
          if (b.target) b.faceTarget(b.target);
          b.playBossAnim('charge');
          b.sprite.setTint(0xffb45c);
          b.world.telegraph(b.body.center.x + b.aim.x * 60, b.body.center.y + b.aim.y * 60, 'charge');
          b.world.sfx('alert', 0.5);
          b.scene.tweens.add({ targets: b.sprite, scaleX: 1.15, scaleY: 0.85, duration: 200, yoyo: true, repeat: 1 });
        },
        update: (b) => {
          // Keep tracking until shortly before the dash so the charge is dodgeable but not free.
          if (b.target && b.fsm.elapsed < 300) b.faceTarget(b.target);
          if (b.fsm.elapsed >= (b.phase === 2 ? 520 : 620)) b.fsm.set('chargeDash');
        },
      })
      .add('chargeDash', {
        enter: (b) => {
          b.sprite.clearTint();
          b.dashElapsed = 0;
          b.playBossAnim('jump');
          b.body.velocity.set(b.aim.x * CHARGE_SPEED, b.aim.y * CHARGE_SPEED);
          b.world.sfx('roll', 0.8, -200);
        },
        update: (b, delta) => {
          b.dashElapsed += delta;
          b.body.velocity.set(b.aim.x * CHARGE_SPEED, b.aim.y * CHARGE_SPEED);
          // Contact damage only exists during the dash, and only once per dash.
          if (b.target && b.distanceTo(b.target) < 26) {
            b.world.spawnHitbox({
              x: b.body.center.x,
              y: b.body.center.y,
              width: 34,
              height: 34,
              faction: 'enemy',
              damage: 1,
              knockback: 220,
              hitstop: Feel.hitstopHeavy,
              duration: 90,
              heavy: true,
              owner: b,
              tags: ['boss', 'charge'],
            });
          }
          const blocked = b.body.blocked.left || b.body.blocked.right || b.body.blocked.up || b.body.blocked.down;
          if (blocked) {
            b.fsm.set('chargeStun');
            return;
          }
          if (b.dashElapsed >= 900) b.fsm.set('swipeEnd');
        },
      })
      .add('chargeStun', {
        enter: (b) => {
          b.body.velocity.set(0, 0);
          b.playBossAnim('idle');
          b.world.shake(true);
          b.world.sfx('slam', 0.85, -300);
          b.sprite.setTint(0x9fb4ff);
          b.scene.tweens.add({ targets: b.sprite, angle: { from: -4, to: 4 }, duration: 90, yoyo: true, repeat: 4, onComplete: () => b.sprite.setAngle(0) });
        },
        update: (b) => {
          if (b.fsm.elapsed >= (b.phase === 2 ? 950 : 1250)) {
            b.sprite.clearTint();
            b.fsm.set('idle');
          }
        },
        exit: (b) => {
          b.sprite.clearTint();
          b.sprite.setAngle(0);
        },
      })
      // ---- Spirit burst: forces the player to move rather than stand and trade.
      .add('burstWind', {
        enter: (b) => {
          b.body.velocity.set(0, 0);
          b.playBossAnim('idle');
          b.sprite.setTint(0xa9c8ff);
          b.world.telegraph(b.body.center.x, b.body.center.y, 'burst');
          b.world.sfx('magic', 0.6);
        },
        update: (b) => {
          if (b.fsm.elapsed >= (b.phase === 2 ? 520 : 640)) b.fsm.set('burstFire');
        },
      })
      .add('burstFire', {
        enter: (b) => {
          b.sprite.clearTint();
          const count = b.phase === 2 ? BURST_PROJECTILES + 2 : BURST_PROJECTILES;
          // Aim the ring at the player so there is always a clean gap to step through.
          const base = b.target ? Math.atan2(b.target.body.center.y - b.body.center.y, b.target.body.center.x - b.body.center.x) : 0;
          for (let i = 0; i < count; i += 1) {
            const angle = base + (Math.PI * 2 * i) / count + Math.PI / count;
            b.world.spawnProjectile(b.body.center.x, b.body.center.y, Math.cos(angle) * 96, Math.sin(angle) * 96, 1);
          }
          b.world.sfx('magic', 0.8, -200);
          b.world.shake(false);
        },
        update: (b) => {
          if (b.fsm.elapsed >= 140) b.fsm.set('burstEnd');
        },
      })
      .add('burstEnd', {
        enter: (b) => {
          b.body.velocity.set(0, 0);
          b.playBossAnim('idle');
        },
        update: (b) => {
          const recovery = b.phase === 2 ? 620 : 800;
          if (b.fsm.elapsed < recovery) return;
          if (b.comboFollowUp) {
            const next = b.comboFollowUp;
            b.comboFollowUp = null;
            b.fsm.set(next);
          } else b.fsm.set('idle');
        },
      })
      .add('dead', {
        enter: (b) => b.body.velocity.set(0, 0),
      });
  }

  /** Pick the next attack from range, and avoid repeating the same one three times running. */
  private chooseAttack(distance: number): void {
    const options: BossState[] = [];
    if (distance <= SWIPE_RANGE + 16) options.push('swipeWind');
    if (distance >= CHARGE_MIN) options.push('chargeWind');
    options.push('burstWind');
    if (distance > SWIPE_RANGE + 16) options.push('chargeWind');

    let choice = options[Math.floor(Math.random() * options.length)] ?? 'burstWind';
    if (choice === this.lastAttack && this.repeatCount >= 1) {
      const alternatives = options.filter((option) => option !== choice);
      choice = alternatives[Math.floor(Math.random() * alternatives.length)] ?? choice;
    }
    this.repeatCount = choice === this.lastAttack ? this.repeatCount + 1 : 0;
    this.lastAttack = choice;

    // Phase two chains two attacks together, but the recovery between them is never removed.
    if (this.phase === 2 && Math.random() < 0.45) {
      if (choice === 'swipeWind') this.comboFollowUp = 'swipeWind';
      else if (choice === 'chargeWind') this.comboFollowUp = 'burstWind';
      else this.comboFollowUp = 'swipeWind';
    } else {
      this.comboFollowUp = null;
    }
    this.fsm.set(choice);
  }

  private distanceTo(target: EnemyTarget): number {
    return Phaser.Math.Distance.Between(this.body.center.x, this.body.center.y, target.body.center.x, target.body.center.y);
  }

  private faceTarget(target: EnemyTarget): void {
    const dx = target.body.center.x - this.body.center.x;
    const dy = target.body.center.y - this.body.center.y;
    const length = Math.hypot(dx, dy) || 1;
    this.aim.set(dx / length, dy / length);
    this.lastDir.copy(this.aim);
    this.sprite.setFlipX(dx < 0);
  }

  private stepAwayFrom(target: EnemyTarget, speed: number): void {
    const dx = this.body.center.x - target.body.center.x;
    const dy = this.body.center.y - target.body.center.y;
    const length = Math.hypot(dx, dy) || 1;
    this.body.velocity.set((dx / length) * speed, (dy / length) * speed);
  }

  private playBossAnim(name: 'idle' | 'attack' | 'charge' | 'jump', timeScale = 1): void {
    const key = `boss_racoon_${name}`;
    if (!this.scene.anims.exists(key)) return;
    this.sprite.play({ key, timeScale }, true);
  }

  /** Woken by WorldScene when the player enters the arena, so the fight starts with an intro rather than a chase. */
  wake(): void {
    this.awake = true;
  }

  get isAwake(): boolean {
    return this.awake;
  }

  override update(delta: number, target: EnemyTarget, _spawnHitbox: EnemyHitboxSink): void {
    void _spawnHitbox;
    if (this.destroyed || this.health.isDead) return;
    this.target = target;
    this.syncDepth();
    if (this.feedback.isKnockedBack) return;
    this.fsm.update(delta);
  }

  override takeHit(info: DamageInfo): boolean {
    if (info.faction === 'enemy' || this.health.isDead) return false;
    // The DEV bridge's damage helper carries a 'dev' tag so tests keep a deterministic kill; real hitboxes never do.
    const dev = info.tags?.includes('dev') ?? false;
    // The intro is a presentation beat, not a free opening. Measured before this rule: a bot that walked in
    // and mashed dealt a quarter of the boss's health during the roar.
    if (!dev && (this.fsm.is('sleep') || this.fsm.is('wake'))) return false;
    // Trading into a wind-up or a charge is the wrong answer: cuts land, but at half strength. The open
    // window after each attack is where a chain pays out in full.
    const guarded = this.fsm.is('swipeWind') || this.fsm.is('chargeWind') || this.fsm.is('burstWind') || this.fsm.is('chargeDash');
    const amount = guarded && !dev ? Math.max(1, Math.floor(info.amount * 0.5)) : info.amount;
    const result = this.health.applyDamage({ ...info, amount }, this.scene.time.now, 120);
    if (!result.applied) return false;
    this.feedback.flash(Feel.hitFlash);
    // A boss is not knocked around by every cut; only the finisher nudges it.
    if (info.heavy) this.feedback.knockback(info, 110, 0.35);
    this.feedback.squash(info.heavy ? 0.16 : 0.1, 130);

    if (result.killed) {
      this.fsm.set('dead');
      this.die(info);
      return true;
    }
    if (this.phase === 1 && this.health.ratio <= 0.5) {
      this.phase = 2;
      this.world.onPhaseChange(2);
      this.world.sfx('boss_roar', 0.8, 200);
      this.world.shake(true);
      this.sprite.setTint(0xff9a6a);
      this.scene.time.delayedCall(700, () => {
        if (!this.destroyed) this.sprite.clearTint();
      });
      this.comboFollowUp = null;
      this.fsm.set('idle');
      return true;
    }
    if (this.fsm.is('idle') && this.target) {
      this.hitsWhileIdle += 1;
      if (this.hitsWhileIdle >= 3) this.chooseAttack(this.distanceTo(this.target));
    }
    return true;
  }

  protected override ensureIdleAnimation(): void {
    // Boss animations are registered by WorldScene from four separate sheets.
    if (this.scene.anims.exists('boss_racoon_idle')) this.sprite.play('boss_racoon_idle');
  }
}
