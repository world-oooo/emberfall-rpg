import Phaser from 'phaser';
import { Actor } from '../Actor';
import { Anim, Tex } from '../../config/assets';
import { StateMachine } from '../../core/StateMachine';
import type { InputActions } from '../../input/InputActions';
import { FACING_VEC, facingFromVector, type Facing } from './heroAnimations';

export type PlayerStateName = 'idle' | 'move' | 'attack' | 'roll' | 'hurt' | 'dead' | 'interact';

const WALK_SPEED = 84; // px/s
const ACCEL_RATE = 40; // 1/s — how fast velocity approaches the target (framerate independent)
const STOP_RATE = 55;

export interface PlayerConfig {
  facing?: Facing;
}

/**
 * The hero. Movement lives here; combat actions are layered on in PlayerCombat (M3).
 * Body: 10x8 at the feet inside the 32x32 animation frame.
 */
export class Player extends Actor {
  readonly fsm: StateMachine<Player, PlayerStateName>;
  facing: Facing;
  readonly moveDir = new Phaser.Math.Vector2();
  private readonly desiredVel = new Phaser.Math.Vector2();
  /** Set by scene: current input snapshot. */
  input: InputActions | null = null;
  /** External systems can freeze the player (dialogue, cutscene). */
  controlLocked = false;

  constructor(scene: Phaser.Scene, x: number, y: number, cfg: PlayerConfig = {}) {
    super(scene, x, y, {
      texture: Tex.heroIdle,
      frame: 0,
      body: { width: 10, height: 8, offsetX: 11, offsetY: 17 },
      shadow: true,
      shadowOffsetY: -1,
    });
    this.facing = cfg.facing ?? 'down';
    this.sprite.setName('player');
    this.fsm = new StateMachine<Player, PlayerStateName>(this)
      .add('idle', {
        enter: (p) => p.playAnim('idle'),
        update: (p) => {
          if (p.wantsToMove()) p.fsm.set('move');
        },
      })
      .add('move', {
        enter: (p) => p.playAnim('walk'),
        update: (p) => {
          if (!p.wantsToMove()) p.fsm.set('idle');
        },
      })
      .add('attack', {})
      .add('roll', {})
      .add('hurt', {})
      .add('dead', {})
      .add('interact', {
        enter: (p) => {
          p.playAnim('idle');
          p.desiredVel.set(0, 0);
        },
      });
    this.fsm.set('idle');
  }

  private wantsToMove(): boolean {
    return !this.controlLocked && this.input !== null && this.input.axis.lengthSq() > 0;
  }

  playAnim(state: 'idle' | 'walk' | 'attack' | 'roll' | 'hit', facing: Facing = this.facing): void {
    this.sprite.play(Anim.hero(state, facing), true);
  }

  setFacing(f: Facing): void {
    if (f === this.facing) return;
    this.facing = f;
    const s = this.fsm.name;
    if (s === 'idle') this.playAnim('idle');
    else if (s === 'move') this.playAnim('walk');
  }

  get facingVector(): { x: number; y: number } {
    return FACING_VEC[this.facing];
  }

  update(delta: number): void {
    const dt = delta / 1000;
    const input = this.input;
    const canMove = !this.controlLocked && (this.fsm.is('idle') || this.fsm.is('move'));

    if (canMove && input && input.axis.lengthSq() > 0) {
      this.moveDir.copy(input.axis);
      this.desiredVel.set(this.moveDir.x * WALK_SPEED, this.moveDir.y * WALK_SPEED);
      this.setFacing(facingFromVector(this.moveDir.x, this.moveDir.y, this.facing));
    } else if (this.fsm.is('idle') || this.fsm.is('move') || this.fsm.is('interact')) {
      this.desiredVel.set(0, 0);
    }

    if (this.fsm.is('idle') || this.fsm.is('move') || this.fsm.is('interact')) {
      const rate = this.desiredVel.lengthSq() > 0 ? ACCEL_RATE : STOP_RATE;
      const k = 1 - Math.exp(-rate * dt);
      const v = this.body.velocity;
      v.x += (this.desiredVel.x - v.x) * k;
      v.y += (this.desiredVel.y - v.y) * k;
      if (Math.abs(v.x) < 2 && this.desiredVel.x === 0) v.x = 0;
      if (Math.abs(v.y) < 2 && this.desiredVel.y === 0) v.y = 0;
    }

    this.fsm.update(delta);
  }

  /** Called after physics so depth/shadow follow the resolved position. */
  postUpdate(): void {
    this.syncDepth();
  }
}
