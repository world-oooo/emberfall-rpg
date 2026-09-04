import type { DamageInfo, HitResult } from './Damage';

export interface HealthListener {
  onDamaged?(info: DamageInfo, result: HitResult): void;
  onHealed?(amount: number): void;
  onDied?(info: DamageInfo): void;
}

/**
 * Hit points + invulnerability window. Shared by player, enemies and breakables.
 * No Phaser dependency so it is unit-testable.
 */
export class Health {
  current: number;
  private invulnerableUntil = 0;
  private readonly listeners: HealthListener[] = [];

  constructor(
    public max: number,
    current?: number,
  ) {
    this.current = Math.min(max, current ?? max);
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  get ratio(): number {
    return this.max <= 0 ? 0 : this.current / this.max;
  }

  addListener(l: HealthListener): () => void {
    this.listeners.push(l);
    return () => {
      const i = this.listeners.indexOf(l);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  isInvulnerable(now: number): boolean {
    return now < this.invulnerableUntil;
  }

  setInvulnerable(now: number, durationMs: number): void {
    this.invulnerableUntil = Math.max(this.invulnerableUntil, now + durationMs);
  }

  /** Apply damage unless dead or invulnerable. Returns what happened so feedback can react. */
  applyDamage(info: DamageInfo, now: number, invulnerabilityMs = 0): HitResult {
    if (this.isDead || this.isInvulnerable(now) || info.amount <= 0) {
      return { applied: false, damage: 0, killed: false };
    }
    const damage = Math.min(this.current, Math.max(1, Math.round(info.amount)));
    this.current -= damage;
    if (invulnerabilityMs > 0) this.setInvulnerable(now, invulnerabilityMs);
    const result: HitResult = { applied: true, damage, killed: this.current <= 0 };
    for (const l of this.listeners) l.onDamaged?.(info, result);
    if (result.killed) for (const l of this.listeners) l.onDied?.(info);
    return result;
  }

  heal(amount: number): number {
    if (this.isDead) return 0;
    const healed = Math.min(amount, this.max - this.current);
    if (healed <= 0) return 0;
    this.current += healed;
    for (const l of this.listeners) l.onHealed?.(healed);
    return healed;
  }

  setMax(max: number, fill = false): void {
    this.max = max;
    if (fill) this.current = max;
    else this.current = Math.min(this.current, max);
  }

  revive(): void {
    this.current = this.max;
    this.invulnerableUntil = 0;
  }
}
