import type { HitboxConfig } from '../../combat/Hitbox';
import { computeDamage } from '../../combat/Damage';
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
}

const ATTACK_BUFFER_MS = 150;
const COMBO_GRACE_MS = 520;
const ATTACKS: readonly AttackStep[] = [
  { startup: 70, active: 100, recovery: 130, width: 24, height: 18, damageMultiplier: 1 },
  { startup: 60, active: 95, recovery: 145, width: 26, height: 18, damageMultiplier: 1.1 },
  { startup: 90, active: 130, recovery: 220, width: 30, height: 22, damageMultiplier: 1.45 },
];

const ROLL_DURATION_MS = 360;
const ROLL_INVULNERABLE_MS = 260;
const ROLL_SPEED = 190;

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
  private rollVelocity = { x: 0, y: 0 };

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

  update(delta: number): void {
    if (this.player.controlLocked || this.player.health.isDead) return;
    const now = this.player.scene.time.now;
    const input = this.player.input;

    if (!this.player.fsm.is('attack') && !this.player.fsm.is('roll')) {
      if (input?.consumeBuffered('attack', ATTACK_BUFFER_MS, now)) this.startAttack(now);
      else if (input?.consumeBuffered('roll', ATTACK_BUFFER_MS, now)) this.startRoll(now);
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
    this.player.body.velocity.set(0, 0);
    this.player.fsm.set('attack');
    this.player.playAnim('attack');
    this.effects?.sfx?.(`attack_swing${this.comboIndex === 0 ? '' : this.comboIndex + 1}`, 0.85);
  }

  private updateAttack(delta: number, now: number): void {
    const step = this.currentAttack;
    const scaledStartup = step.startup * this.weapon.speed;
    const scaledActive = step.active * this.weapon.speed;
    const scaledRecovery = step.recovery * this.weapon.speed;
    this.attackElapsed += delta;
    this.player.body.velocity.set(0, 0);

    if (!this.queuedAttack && this.player.input?.consumeBuffered('attack', ATTACK_BUFFER_MS, now)) this.queuedAttack = true;

    if (!this.attackSpawned && this.attackElapsed >= scaledStartup) {
      this.attackSpawned = true;
      this.spawnAttackHitbox(step, scaledActive);
    }

    if (this.attackElapsed < scaledStartup + scaledActive + scaledRecovery) return;
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
      knockback: this.weapon.knockback * (heavy ? 1.35 : 1),
      hitstop: heavy ? 90 : 45,
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
    this.player.health.setInvulnerable(now, ROLL_INVULNERABLE_MS + (this.accessory?.rollInvulnerableBonusMs ?? 0));
    this.player.fsm.set('roll');
    this.player.playAnim('roll');
    this.effects?.dust?.(this.player.body.center.x, this.player.feetY);
    this.effects?.sfx?.('roll', 0.75);
  }

  private updateRoll(delta: number): void {
    this.rollElapsed += delta;
    const t = Math.min(1, this.rollElapsed / ROLL_DURATION_MS);
    const ease = 1 - t * t;
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
