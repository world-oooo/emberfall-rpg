import type { HitboxConfig } from '../../combat/Hitbox';
import { computeDamage } from '../../combat/Damage';
import { Feel } from '../../config/constants';
import { getItem, type AccessoryStats, type WeaponStats } from '../../data/items';
import { FACING_VEC, facingFromVector, type Facing } from './heroAnimations';
import type { Player } from './Player';

export type PlayerHitboxSink = (config: HitboxConfig) => void;

export interface PlayerCombatEffects {
  slash?(x: number, y: number, facing: Facing, heavy: boolean): void;
  dust?(x: number, y: number): void;
  sfx?(id: string, volume?: number, detune?: number): void;
}

interface AttackStep {
  startup: number;
  active: number;
  recovery: number;
  width: number;
  height: number;
  damageMultiplier: number;
  /** small forward step so each swing carries weight instead of rooting the player */
  lunge: number;
  sfx: string;
}

const ATTACK_BUFFER_MS = 170;
const COMBO_GRACE_MS = 460;
/** The hero animation is 4 frames at 16 fps. Steps are timed against it so nothing outlives what you see. */
const ATTACK_ANIM_MS = 250;
/** Fraction of recovery after which movement and roll may cancel the swing. */
const CANCEL_AT = 0.45;

/**
 * Three-hit chain. Totals are 240/245/385 ms against a 250 ms animation, and the animation time scale is
 * matched to each step, so the sprite finishes its swing exactly as the state ends. The previous timings
 * (300/300/440 ms) left the hero standing on the last frame after every hit.
 */
const ATTACKS: readonly AttackStep[] = [
  { startup: 55, active: 90, recovery: 95, width: 26, height: 19, damageMultiplier: 1, lunge: 42, sfx: 'attack_swing' },
  { startup: 50, active: 90, recovery: 105, width: 28, height: 19, damageMultiplier: 1.1, lunge: 46, sfx: 'attack_swing2' },
  { startup: 85, active: 115, recovery: 185, width: 34, height: 24, damageMultiplier: 1.45, lunge: 70, sfx: 'attack_swing3' },
];

/** Roll animation is 3 frames at 14 fps (214 ms); the state is 300 ms with the animation stretched to match. */
const ROLL_DURATION_MS = 300;
const ROLL_ANIM_MS = 214;
const ROLL_INVULNERABLE_MS = 235;
const ROLL_SPEED = 210;
const ROLL_COOLDOWN_MS = 260;

/**
 * Owns player attack and roll timing. The scene supplies a hitbox sink, which keeps Player decoupled from enemy wiring.
 */
export class PlayerCombat {
  private hitboxSink: PlayerHitboxSink | null = null;
  private effects: PlayerCombatEffects | null = null;
  private weapon: WeaponStats;
  private accessory: AccessoryStats | null = null;
  private attackBonus = 0;
  private comboIndex = 0;
  private comboExpiresAt = 0;
  private attackElapsed = 0;
  private attackSpawned = false;
  private queuedAttack = false;
  private rollElapsed = 0;
  private rollReadyAt = 0;
  private rollVelocity = { x: 0, y: 0 };
  private lungeVelocity = { x: 0, y: 0 };

  constructor(
    private readonly player: Player,
    loadout: { weaponId: string | null; accessoryId: string | null },
  ) {
    this.weapon = getItem(loadout.weaponId ?? 'katana').weapon ?? getItem('katana').weapon!;
    this.accessory = loadout.accessoryId ? (getItem(loadout.accessoryId).accessory ?? null) : null;
  }

  setHitboxSink(sink: PlayerHitboxSink | null): void {
    this.hitboxSink = sink;
  }

  setEffects(effects: PlayerCombatEffects | null): void {
    this.effects = effects;
  }

  setLoadout(weaponId: string | null, accessoryId: string | null): void {
    this.weapon = getItem(weaponId ?? 'katana').weapon ?? getItem('katana').weapon!;
    this.accessory = accessoryId ? (getItem(accessoryId).accessory ?? null) : null;
  }

  setAttackBonus(value: number): void {
    this.attackBonus = Math.max(0, Math.floor(value));
  }

  /** True while the current attack has finished its active frames and may be cancelled. */
  get canCancel(): boolean {
    if (!this.player.fsm.is('attack')) return false;
    const step = this.currentAttack;
    const startup = step.startup * this.weapon.speed;
    const active = step.active * this.weapon.speed;
    const recovery = step.recovery * this.weapon.speed;
    return this.attackElapsed >= startup + active + recovery * CANCEL_AT;
  }

  update(delta: number): void {
    if (this.player.controlLocked || this.player.health.isDead) return;
    const now = this.player.scene.time.now;
    const input = this.player.input;

    if (!this.player.fsm.is('attack') && !this.player.fsm.is('roll')) {
      if (input?.consumeBuffered('attack', ATTACK_BUFFER_MS, now)) this.startAttack(now);
      else if (now >= this.rollReadyAt && input?.consumeBuffered('roll', ATTACK_BUFFER_MS, now)) this.startRoll(now);
      return;
    }

    if (this.player.fsm.is('attack')) this.updateAttack(delta, now);
    if (this.player.fsm.is('roll')) this.updateRoll(delta);
  }

  private startAttack(now: number): void {
    if (now > this.comboExpiresAt) this.comboIndex = 0;
    this.attackElapsed = 0;
    this.attackSpawned = false;
    this.queuedAttack = false;
    const step = this.currentAttack;
    const total = (step.startup + step.active + step.recovery) * this.weapon.speed;

    // Face the direction the stick is held so a swing can be redirected right up to the moment it starts.
    const input = this.player.input;
    if (input && input.axis.lengthSq() > 0) this.player.setFacing(facingFromVector(input.axis.x, input.axis.y, this.player.facing));

    const vec = FACING_VEC[this.player.facing];
    this.lungeVelocity = { x: vec.x * step.lunge, y: vec.y * step.lunge };
    this.player.body.velocity.set(this.lungeVelocity.x, this.lungeVelocity.y);
    this.player.fsm.set('attack');
    this.player.playAttackAnim(ATTACK_ANIM_MS / total);
    this.effects?.sfx?.(step.sfx, 0.8);
  }

  private updateAttack(delta: number, now: number): void {
    const step = this.currentAttack;
    const startup = step.startup * this.weapon.speed;
    const active = step.active * this.weapon.speed;
    const recovery = step.recovery * this.weapon.speed;
    const total = startup + active + recovery;
    this.attackElapsed += delta;

    // Short forward lunge during startup and active frames, then a quick settle.
    const glide = this.attackElapsed < startup + active ? 1 : Math.max(0, 1 - (this.attackElapsed - startup - active) / Math.max(1, recovery * 0.5));
    this.player.body.velocity.set(this.lungeVelocity.x * glide, this.lungeVelocity.y * glide);

    if (!this.queuedAttack && this.player.input?.consumeBuffered('attack', ATTACK_BUFFER_MS, now)) this.queuedAttack = true;

    if (!this.attackSpawned && this.attackElapsed >= startup) {
      this.attackSpawned = true;
      this.spawnAttackHitbox(step, active);
    }

    // Cancel windows: late recovery can be broken by a roll, or by walking away.
    if (this.canCancel) {
      if (now >= this.rollReadyAt && this.player.input?.consumeBuffered('roll', ATTACK_BUFFER_MS, now)) {
        this.comboExpiresAt = now + COMBO_GRACE_MS;
        this.startRoll(now);
        return;
      }
      if (!this.queuedAttack && this.player.input && this.player.input.axis.lengthSq() > 0) {
        this.comboExpiresAt = now + COMBO_GRACE_MS;
        this.comboIndex = 0;
        this.player.fsm.set('move');
        return;
      }
    }

    if (this.attackElapsed < total) return;
    const canContinue = this.queuedAttack && this.comboIndex < ATTACKS.length - 1;
    this.comboExpiresAt = now + COMBO_GRACE_MS;
    if (canContinue) {
      this.comboIndex += 1;
      this.startAttack(now);
    } else {
      this.comboIndex = 0;
      this.player.fsm.set(this.player.input?.axis.lengthSq() ? 'move' : 'idle');
    }
  }

  private spawnAttackHitbox(step: AttackStep, duration: number): void {
    const vec = FACING_VEC[this.player.facing];
    const heavy = this.comboIndex === ATTACKS.length - 1;
    const cx = this.player.body.center.x + vec.x * this.weapon.reach;
    const cy = this.player.body.center.y + vec.y * this.weapon.reach;
    const horizontal = this.player.facing === 'left' || this.player.facing === 'right';
    const width = horizontal ? step.width : step.height;
    const height = horizontal ? step.height : step.width;
    const damage = computeDamage(this.weapon.damage, this.attackBonus, heavy ? this.weapon.finisherMultiplier : step.damageMultiplier);
    this.effects?.slash?.(cx, cy, this.player.facing, heavy);
    this.hitboxSink?.({
      x: cx,
      y: cy,
      width,
      height,
      faction: 'player',
      damage,
      knockback: this.weapon.knockback * (heavy ? 1.4 : 1),
      hitstop: heavy ? Feel.hitstopHeavy : Feel.hitstopLight,
      duration,
      heavy,
      owner: this.player,
      tags: ['melee', `combo_${this.comboIndex + 1}`],
    });
  }

  private startRoll(now: number): void {
    const input = this.player.input;
    const axis = input && input.axis.lengthSq() > 0 ? input.axis : input?.lastDir;
    const facing = axis ? facingFromVector(axis.x, axis.y, this.player.facing) : this.player.facing;
    this.player.setFacing(facing);
    const vec = axis && axis.lengthSq() > 0 ? axis.clone().normalize() : FACING_VEC[facing];
    const speed = ROLL_SPEED * (this.accessory?.rollSpeedMultiplier ?? 1);
    this.rollVelocity = { x: vec.x * speed, y: vec.y * speed };
    this.rollElapsed = 0;
    this.rollReadyAt = now + ROLL_DURATION_MS + ROLL_COOLDOWN_MS;
    this.comboIndex = 0;
    this.player.health.setInvulnerable(now, ROLL_INVULNERABLE_MS + (this.accessory?.rollInvulnerableBonusMs ?? 0));
    this.player.fsm.set('roll');
    this.player.playRollAnim(ROLL_ANIM_MS / ROLL_DURATION_MS);
    this.effects?.dust?.(this.player.body.center.x, this.player.feetY);
    this.effects?.sfx?.('roll', 0.7);
  }

  private updateRoll(delta: number): void {
    this.rollElapsed += delta;
    const t = Math.min(1, this.rollElapsed / ROLL_DURATION_MS);
    // Fast out, soft landing: most of the distance is covered in the invulnerable window.
    const ease = 1 - t * t * t;
    this.player.body.velocity.set(this.rollVelocity.x * ease, this.rollVelocity.y * ease);
    if (this.rollElapsed >= ROLL_DURATION_MS) {
      this.player.body.velocity.set(0, 0);
      this.player.fsm.set(this.player.input?.axis.lengthSq() ? 'move' : 'idle');
    }
  }

  private get currentAttack(): AttackStep {
    const first = ATTACKS[0];
    if (!first) throw new Error('Player attack table is empty');
    return ATTACKS[this.comboIndex] ?? first;
  }

  destroy(): void {
    this.hitboxSink = null;
    this.effects = null;
  }
}
