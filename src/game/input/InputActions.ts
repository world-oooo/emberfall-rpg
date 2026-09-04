import Phaser from 'phaser';

export type Action =
  | 'attack'
  | 'roll'
  | 'interact'
  | 'throw'
  | 'inventory'
  | 'quests'
  | 'pause'
  | 'confirm'
  | 'cancel'
  | 'menuUp'
  | 'menuDown'
  | 'menuLeft'
  | 'menuRight';

type Dir = 'up' | 'down' | 'left' | 'right';

const K = Phaser.Input.Keyboard.KeyCodes;

/** Keyboard bindings. Several keys per action so both WASD/JK and Arrows/ZX layouts feel native. */
const KEY_BINDINGS: Record<Action | Dir, number[]> = {
  up: [K.UP, K.W],
  down: [K.DOWN, K.S],
  left: [K.LEFT, K.A],
  right: [K.RIGHT, K.D],
  attack: [K.J, K.Z, K.SPACE],
  roll: [K.K, K.X, K.SHIFT],
  interact: [K.E, K.ENTER],
  throw: [K.L, K.C],
  inventory: [K.I, K.TAB],
  quests: [K.Q],
  pause: [K.ESC, K.P],
  confirm: [K.ENTER, K.SPACE, K.E, K.J, K.Z],
  cancel: [K.ESC, K.X, K.K, K.BACKSPACE],
  menuUp: [K.UP, K.W],
  menuDown: [K.DOWN, K.S],
  menuLeft: [K.LEFT, K.A],
  menuRight: [K.RIGHT, K.D],
};

/** Keys Phaser must swallow so the browser never scrolls or tabs away. */
export const CAPTURED_KEYS: number[] = Array.from(new Set(Object.values(KEY_BINDINGS).flat()));

/**
 * Per-scene action mapper: keyboard + gamepad (pad1) → named actions and a movement axis.
 * Call update() once at the top of the scene's update; then read `axis`, `held()`, `pressed()`.
 */
export class InputActions {
  readonly axis = new Phaser.Math.Vector2();
  /** Last non-zero facing derived from input, useful for attacks while standing still. */
  readonly lastDir = new Phaser.Math.Vector2(0, 1);

  private readonly keys: Record<Action | Dir, Phaser.Input.Keyboard.Key[]>;
  private readonly heldNow = new Set<Action>();
  private readonly heldPrev = new Set<Action>();
  private readonly buffered = new Map<Action, number>();
  private padDir: Record<Dir, boolean> = { up: false, down: false, left: false, right: false };
  private enabled = true;
  /** key names that received a DOM keydown since the last update (catches presses shorter than a frame) */
  private readonly latched = new Set<Action | Dir>();

  constructor(private readonly scene: Phaser.Scene) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Keyboard plugin missing');
    this.keys = {} as Record<Action | Dir, Phaser.Input.Keyboard.Key[]>;
    for (const [name, codes] of Object.entries(KEY_BINDINGS) as [Action | Dir, number[]][]) {
      this.keys[name] = codes.map((c) => kb.addKey(c, false));
      for (const k of this.keys[name]) k.on(Phaser.Input.Keyboard.Events.DOWN, () => this.latched.add(name));
    }
  }

  /** Disable while a modal (dialogue/menu) owns input; movement axis becomes zero and nothing is "pressed". */
  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) {
      this.axis.set(0, 0);
      this.heldNow.clear();
      this.heldPrev.clear();
      this.buffered.clear();
      this.latched.clear();
    }
  }

  update(time: number): void {
    this.heldPrev.clear();
    for (const a of this.heldNow) this.heldPrev.add(a);
    this.heldNow.clear();
    if (!this.enabled) {
      this.axis.set(0, 0);
      this.latched.clear();
      return;
    }

    const pad = this.scene.input.gamepad?.total ? this.scene.input.gamepad.pad1 : undefined;
    this.padDir = { up: false, down: false, left: false, right: false };
    let ax = 0;
    let ay = 0;
    if (pad) {
      const dead = 0.25;
      const sx = Math.abs(pad.leftStick.x) > dead ? pad.leftStick.x : 0;
      const sy = Math.abs(pad.leftStick.y) > dead ? pad.leftStick.y : 0;
      ax = sx;
      ay = sy;
      this.padDir = { up: pad.up || sy < -0.5, down: pad.down || sy > 0.5, left: pad.left || sx < -0.5, right: pad.right || sx > 0.5 };
      if (pad.up) ay = -1;
      if (pad.down) ay = 1;
      if (pad.left) ax = -1;
      if (pad.right) ax = 1;
      if (pad.A) this.heldNow.add('attack').add('confirm');
      if (pad.B) this.heldNow.add('roll').add('cancel');
      if (pad.X) this.heldNow.add('interact');
      if (pad.Y) this.heldNow.add('throw');
      if (pad.isButtonDown(9)) this.heldNow.add('pause');
      if (pad.isButtonDown(8)) this.heldNow.add('inventory');
      if (pad.L1 > 0.5) this.heldNow.add('quests');
      if (this.padDir.up) this.heldNow.add('menuUp');
      if (this.padDir.down) this.heldNow.add('menuDown');
      if (this.padDir.left) this.heldNow.add('menuLeft');
      if (this.padDir.right) this.heldNow.add('menuRight');
    }

    const kx = (this.anyDown('right') ? 1 : 0) - (this.anyDown('left') ? 1 : 0);
    const ky = (this.anyDown('down') ? 1 : 0) - (this.anyDown('up') ? 1 : 0);
    if (kx !== 0 || ky !== 0) {
      ax = kx;
      ay = ky;
    }
    this.axis.set(ax, ay);
    if (this.axis.lengthSq() > 1) this.axis.normalize();
    if (ax !== 0 || ay !== 0) this.lastDir.set(ax, ay).normalize();

    for (const a of ACTIONS) {
      if (this.anyDown(a) || this.latched.has(a)) this.heldNow.add(a);
    }
    this.latched.clear();
    for (const a of this.heldNow) {
      if (!this.heldPrev.has(a)) this.buffered.set(a, time);
    }
  }

  held(action: Action): boolean {
    return this.heldNow.has(action);
  }

  /** True on the first frame the action is held. */
  pressed(action: Action): boolean {
    return this.heldNow.has(action) && !this.heldPrev.has(action);
  }

  /** True if the action was pressed within the last `windowMs`; consuming clears it (input buffering for combat). */
  consumeBuffered(action: Action, windowMs: number, now: number): boolean {
    const t = this.buffered.get(action);
    if (t !== undefined && now - t <= windowMs) {
      this.buffered.delete(action);
      return true;
    }
    return false;
  }

  clearBuffer(action?: Action): void {
    if (action) this.buffered.delete(action);
    else this.buffered.clear();
  }

  private anyDown(name: Action | Dir): boolean {
    const list = this.keys[name];
    for (const k of list) if (k.isDown) return true;
    return this.latched.has(name);
  }

  destroy(): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    for (const list of Object.values(this.keys)) {
      for (const k of list) {
        k.removeAllListeners();
        kb.removeKey(k, false, false);
      }
    }
  }
}

const ACTIONS: Action[] = [
  'attack',
  'roll',
  'interact',
  'throw',
  'inventory',
  'quests',
  'pause',
  'confirm',
  'cancel',
  'menuUp',
  'menuDown',
  'menuLeft',
  'menuRight',
];
