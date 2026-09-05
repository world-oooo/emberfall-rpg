import Phaser from 'phaser';
import {
  BINDABLE_ACTIONS,
  DEFAULT_BINDINGS,
  inputBindingStore,
  type ActiveInputDevice,
  type ActiveDeviceListener,
  type BindableAction,
  type BindResult,
  type BindingListener,
  type InputBindingStore,
} from './InputBindingStore';

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
type KeyName = Action | Dir;

const K = Phaser.Input.Keyboard.KeyCodes;

const CODE_TO_KEYCODE: Readonly<Record<string, number>> = {
  ArrowUp: K.UP,
  ArrowDown: K.DOWN,
  ArrowLeft: K.LEFT,
  ArrowRight: K.RIGHT,
  Backspace: K.BACKSPACE,
  Enter: K.ENTER,
  Escape: K.ESC,
  Space: K.SPACE,
  Tab: K.TAB,
  ShiftLeft: K.SHIFT,
  ShiftRight: K.SHIFT,
  KeyA: K.A,
  KeyB: K.B,
  KeyC: K.C,
  KeyD: K.D,
  KeyE: K.E,
  KeyF: K.F,
  KeyG: K.G,
  KeyH: K.H,
  KeyI: K.I,
  KeyJ: K.J,
  KeyK: K.K,
  KeyL: K.L,
  KeyM: K.M,
  KeyN: K.N,
  KeyO: K.O,
  KeyP: K.P,
  KeyQ: K.Q,
  KeyR: K.R,
  KeyS: K.S,
  KeyT: K.T,
  KeyU: K.U,
  KeyV: K.V,
  KeyW: K.W,
  KeyX: K.X,
  KeyY: K.Y,
  KeyZ: K.Z,
  Digit0: K.ZERO,
  Digit1: K.ONE,
  Digit2: K.TWO,
  Digit3: K.THREE,
  Digit4: K.FOUR,
  Digit5: K.FIVE,
  Digit6: K.SIX,
  Digit7: K.SEVEN,
  Digit8: K.EIGHT,
  Digit9: K.NINE,
};

/** Reverse of CODE_TO_KEYCODE: a Phaser keycode back to the first DOM code that maps to it. */
const KEYCODE_TO_CODE: ReadonlyMap<number, string> = (() => {
  const map = new Map<number, string>();
  for (const [code, keyCode] of Object.entries(CODE_TO_KEYCODE)) if (!map.has(keyCode)) map.set(keyCode, code);
  return map;
})();

/** Keys Phaser must swallow so the browser never scrolls or tabs away. */
export const CAPTURED_KEYS: number[] = capturedKeyCodesFromBindings(DEFAULT_BINDINGS);

/** Presses waiting to be consumed. A player mashing faster than this has stopped meaning it. */
const MAX_QUEUED_PRESSES = 6;

/**
 * Per-scene action mapper: keyboard + gamepad (pad1) → named actions and a movement axis.
 * Call update() once at the top of the scene's update; then read `axis`, `held()`, `pressed()`.
 *
 * Every physical key press is queued from its DOM event and consumed one per frame, in the order the keys went
 * down. Reading the keys' state once per frame instead would collapse two presses that arrive inside one frame
 * into a single press, which is exactly what happens on a slow machine, or in a test runner without a GPU,
 * where a frame can last a third of a second. Held keys are still read live, so movement never lags.
 */
export class InputActions {
  readonly axis = new Phaser.Math.Vector2();
  /** Last non-zero facing derived from input, useful for attacks while standing still. */
  readonly lastDir = new Phaser.Math.Vector2(0, 1);

  private readonly keys: Record<Action | Dir, Phaser.Input.Keyboard.Key[]>;
  /** Which action/direction names each keyboard code maps to, e.g. ArrowDown -> ['down','menuDown']. */
  private namesByCode: Map<string, KeyName[]> = new Map();
  private readonly heldNow = new Set<Action>();
  private readonly padHeld = new Set<Action>();
  private readonly padHeldPrev = new Set<Action>();
  /** Actions that count as freshly pressed this frame. */
  private readonly edges = new Set<Action>();
  private readonly buffered = new Map<Action, number>();
  /** One entry per physical press: every name bound to that key, so pause+cancel on Escape stay one press. */
  private readonly pressQueue: KeyName[][] = [];
  private padDir: Record<Dir, boolean> = { up: false, down: false, left: false, right: false };
  private enabled = true;
  private readonly unsubscribeBindings: () => void;
  private readonly onWindowBlur = (): void => this.clearTransientInput();
  /**
   * Edges are taken from the DOM keydown, not from Phaser's ANY_KEY_DOWN. In this Phaser build the latter
   * re-emits a single physical press once per Key registered to that code, so binding both `down` and
   * `menuDown` to ArrowDown made one tap walk a menu cursor two rows. The browser fires keydown exactly once.
   */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled || event.repeat) return;
    // Both shift keys share one Phaser keycode, so namesByCode only holds the left one.
    const code = event.code === 'ShiftRight' ? 'ShiftLeft' : event.code;
    const names = this.namesByCode.get(code);
    if (!names) return;
    this.bindingStore.setActiveDevice('keyboard');
    if (this.pressQueue.length < MAX_QUEUED_PRESSES) this.pressQueue.push(names);
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindingStore: InputBindingStore = inputBindingStore,
  ) {
    const kb = scene.input.keyboard;
    if (!kb) throw new Error('Keyboard plugin missing');
    this.keys = {} as Record<Action | Dir, Phaser.Input.Keyboard.Key[]>;
    this.rebuildKeys();
    this.unsubscribeBindings = this.bindingStore.onChange(() => this.rebuildKeys());
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  /** Disable while a modal (dialogue/menu) owns input; movement axis becomes zero and nothing is "pressed". */
  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.clearTransientInput();
  }

  bind(action: BindableAction, code: string): BindResult {
    return this.bindingStore.bind(action, code);
  }

  bindings(): Record<BindableAction, string[]> {
    return this.bindingStore.getBindings();
  }

  resetBindings(): Record<BindableAction, string[]> {
    return this.bindingStore.reset();
  }

  onBindingsChange(listener: BindingListener): () => void {
    return this.bindingStore.onChange(listener);
  }

  onActiveDeviceChange(listener: ActiveDeviceListener): () => void {
    return this.bindingStore.onActiveDeviceChange(listener);
  }

  prompt(action: BindableAction): string {
    return this.bindingStore.prompt(action);
  }

  getActiveDevice(): ActiveInputDevice {
    return this.bindingStore.getActiveDevice();
  }

  update(time: number): void {
    this.heldNow.clear();
    this.edges.clear();
    this.padHeldPrev.clear();
    for (const a of this.padHeld) this.padHeldPrev.add(a);
    this.padHeld.clear();
    if (!this.enabled) {
      this.axis.set(0, 0);
      this.pressQueue.length = 0;
      return;
    }

    // The oldest physical press becomes this frame's edges; the rest wait their turn.
    const consumed = new Set<KeyName>(this.pressQueue.shift() ?? []);

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
      if (pad.A) this.padHeld.add('attack').add('confirm');
      if (pad.B) this.padHeld.add('roll').add('cancel');
      if (pad.X) this.padHeld.add('interact').add('confirm');
      if (pad.Y) this.padHeld.add('throw');
      if (pad.isButtonDown(9)) this.padHeld.add('pause');
      if (pad.isButtonDown(8)) this.padHeld.add('inventory');
      if (pad.L1 > 0.5) this.padHeld.add('quests');
      if (this.padDir.up) this.padHeld.add('menuUp');
      if (this.padDir.down) this.padHeld.add('menuDown');
      if (this.padDir.left) this.padHeld.add('menuLeft');
      if (this.padDir.right) this.padHeld.add('menuRight');
      if (ax !== 0 || ay !== 0 || this.padHeld.size > 0) this.bindingStore.setActiveDevice('gamepad');
    }

    const keyDown = (name: KeyName): boolean => consumed.has(name) || this.anyKeyDown(name);
    const kx = (keyDown('right') ? 1 : 0) - (keyDown('left') ? 1 : 0);
    const ky = (keyDown('down') ? 1 : 0) - (keyDown('up') ? 1 : 0);
    if (kx !== 0 || ky !== 0) {
      ax = kx;
      ay = ky;
    }
    this.axis.set(ax, ay);
    if (this.axis.lengthSq() > 1) this.axis.normalize();
    if (ax !== 0 || ay !== 0) this.lastDir.set(ax, ay).normalize();

    for (const a of ACTIONS) {
      if (keyDown(a)) this.heldNow.add(a);
      if (consumed.has(a)) this.edges.add(a);
    }
    // Gamepad buttons have no key events; their edge is the frame they go down.
    for (const a of this.padHeld) {
      this.heldNow.add(a);
      if (!this.padHeldPrev.has(a)) this.edges.add(a);
    }
    for (const a of this.edges) this.buffered.set(a, time);
  }

  held(action: Action): boolean {
    return this.heldNow.has(action);
  }

  /** True on the frame a press is consumed, once per physical press. */
  pressed(action: Action): boolean {
    return this.edges.has(action);
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

  private rebuildKeys(): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    this.releaseKeys();

    const bindings = this.bindingStore.getBindings();
    const keyCodes = keyCodeBindings(bindings);
    kb.addCapture(capturedKeyCodesFromBindings(bindings));

    // Phaser Key objects are used only for live held-state (movement); edges come from the DOM event below.
    for (const name of KEY_NAMES) {
      const codes = keyCodes[name] ?? [];
      this.keys[name] = codes.map((code) => kb.addKey(code, false));
    }

    // Map each DOM code (e.g. 'ArrowDown') to the names it drives, so one keydown queues one press for all of
    // them together — pause and cancel on the same Escape stay a single press.
    this.namesByCode = new Map();
    for (const name of KEY_NAMES) {
      for (const keyCode of keyCodes[name] ?? []) {
        const code = KEYCODE_TO_CODE.get(keyCode);
        if (!code) continue;
        const names = this.namesByCode.get(code) ?? [];
        names.push(name);
        this.namesByCode.set(code, names);
      }
    }
    this.clearTransientInput();
  }

  private releaseKeys(): void {
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    for (const list of Object.values(this.keys)) {
      for (const key of list) kb.removeKey(key, false, false);
    }
    for (const name of KEY_NAMES) this.keys[name] = [];
  }

  private clearTransientInput(): void {
    this.axis.set(0, 0);
    this.heldNow.clear();
    this.padHeld.clear();
    this.padHeldPrev.clear();
    this.edges.clear();
    this.buffered.clear();
    this.pressQueue.length = 0;
  }

  private anyKeyDown(name: KeyName): boolean {
    const list = this.keys[name] ?? [];
    for (const k of list) if (k.isDown) return true;
    return false;
  }

  destroy(): void {
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('keydown', this.onKeyDown, true);
    this.unsubscribeBindings();
    this.releaseKeys();
    this.clearTransientInput();
  }
}

const ACTIONS: readonly Action[] = [
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

const KEY_NAMES: readonly KeyName[] = [
  'up',
  'down',
  'left',
  'right',
  ...ACTIONS,
];

function keyCodeBindings(bindings: Readonly<Record<BindableAction, readonly string[]>>): Record<KeyName, number[]> {
  const directions: Record<Dir, number[]> = {
    up: codesToKeyCodes(bindings.moveUp),
    down: codesToKeyCodes(bindings.moveDown),
    left: codesToKeyCodes(bindings.moveLeft),
    right: codesToKeyCodes(bindings.moveRight),
  };

  const actions: Record<Action, number[]> = {
    attack: codesToKeyCodes(bindings.attack),
    roll: codesToKeyCodes(bindings.roll),
    interact: codesToKeyCodes(bindings.interact),
    throw: codesToKeyCodes(bindings.throw),
    inventory: codesToKeyCodes(bindings.inventory),
    quests: codesToKeyCodes(bindings.quests),
    pause: uniqueCodes([...codesToKeyCodes(bindings.pause), K.ESC]),
    // Enter always confirms and Escape always cancels, so no rebinding can leave a player unable to work a menu.
    confirm: uniqueCodes([...codesToKeyCodes(bindings.interact), ...codesToKeyCodes(bindings.attack), K.ENTER]),
    cancel: uniqueCodes([...codesToKeyCodes(bindings.roll), K.BACKSPACE, K.ESC]),
    menuUp: directions.up,
    menuDown: directions.down,
    menuLeft: directions.left,
    menuRight: directions.right,
  };

  return { ...directions, ...actions };
}

function codesToKeyCodes(codes: readonly string[]): number[] {
  return uniqueCodes(codes.map((code) => CODE_TO_KEYCODE[code]).filter((code): code is number => typeof code === 'number'));
}

function capturedKeyCodesFromBindings(bindings: Readonly<Record<BindableAction, readonly string[]>>): number[] {
  const codes = BINDABLE_ACTIONS.flatMap((action) => bindings[action]);
  return uniqueCodes([...codesToKeyCodes(codes), K.ESC, K.BACKSPACE, K.ENTER]);
}

function uniqueCodes(codes: readonly number[]): number[] {
  return Array.from(new Set(codes));
}
