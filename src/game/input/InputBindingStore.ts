export type BindableAction =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'attack'
  | 'roll'
  | 'interact'
  | 'throw'
  | 'inventory'
  | 'quests'
  | 'pause';

export type ActiveInputDevice = 'keyboard' | 'gamepad';

export type BindResult =
  | { ok: true }
  | { ok: false; reason: 'invalid-action' | 'reserved' | 'conflict'; conflictAction?: BindableAction };

export type BindingListener = (bindings: Readonly<Record<BindableAction, readonly string[]>>) => void;
export type ActiveDeviceListener = (device: ActiveInputDevice) => void;

export interface BindingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const BINDABLE_ACTIONS: readonly BindableAction[] = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'attack',
  'roll',
  'interact',
  'throw',
  'inventory',
  'quests',
  'pause',
];

export const ACTION_LABELS: Readonly<Record<BindableAction, string>> = {
  moveUp: 'Move Up',
  moveDown: 'Move Down',
  moveLeft: 'Move Left',
  moveRight: 'Move Right',
  attack: 'Attack',
  roll: 'Roll',
  interact: 'Interact',
  throw: 'Throw',
  inventory: 'Inventory',
  quests: 'Quest Log',
  pause: 'Pause',
};

export const DEFAULT_BINDINGS: Readonly<Record<BindableAction, readonly string[]>> = {
  moveUp: ['ArrowUp', 'KeyW'],
  moveDown: ['ArrowDown', 'KeyS'],
  moveLeft: ['ArrowLeft', 'KeyA'],
  moveRight: ['ArrowRight', 'KeyD'],
  attack: ['KeyJ', 'KeyZ', 'Space'],
  roll: ['KeyK', 'KeyX', 'ShiftLeft', 'ShiftRight'],
  interact: ['KeyE', 'Enter'],
  throw: ['KeyL', 'KeyC'],
  inventory: ['KeyI', 'Tab'],
  quests: ['KeyQ'],
  pause: ['Escape', 'KeyP'],
};

const GAMEPAD_PROMPTS: Readonly<Record<BindableAction, string>> = {
  moveUp: 'D-Pad Up',
  moveDown: 'D-Pad Down',
  moveLeft: 'D-Pad Left',
  moveRight: 'D-Pad Right',
  attack: 'A',
  roll: 'B',
  interact: 'X',
  throw: 'Y',
  inventory: 'View',
  quests: 'LB',
  pause: 'Menu',
};

const RESERVED_CODES = new Set(['F5', 'F11', 'F12']);
const validCode = (code: string): boolean => /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Backspace|Enter|Escape|Space|Tab|ShiftLeft|ShiftRight)$/.test(code);
const STORAGE_KEY = 'emberfall.inputBindings.v1';

function defaultStorage(): BindingStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function cloneBindings(bindings: Readonly<Record<BindableAction, readonly string[]>>): Record<BindableAction, string[]> {
  const result = {} as Record<BindableAction, string[]>;
  for (const action of BINDABLE_ACTIONS) result[action] = [...bindings[action]];
  return result;
}

function isBindableAction(value: string): value is BindableAction {
  return (BINDABLE_ACTIONS as readonly string[]).includes(value);
}

function normalizeCode(code: string): string {
  const trimmed = code.trim();
  if (trimmed === 'Esc') return 'Escape';
  if (trimmed === ' ') return 'Space';
  return trimmed;
}

function isValidCodeForAction(action: BindableAction, code: string): boolean {
  return validCode(code) && !RESERVED_CODES.has(code) && (code !== 'Escape' || action === 'pause');
}

function validateStoredBindings(raw: unknown): Record<BindableAction, string[]> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const next = cloneBindings(DEFAULT_BINDINGS);
  for (const [action, value] of Object.entries(raw)) {
    if (!isBindableAction(action) || !Array.isArray(value) || value.length === 0) return null;

    const codes: string[] = [];
    for (const item of value) {
      if (typeof item !== 'string') return null;
      const code = normalizeCode(item);
      if (!isValidCodeForAction(action, code) || codes.includes(code)) return null;
      codes.push(code);
    }
    next[action] = codes;
  }

  const used = new Map<string, BindableAction>();
  for (const action of BINDABLE_ACTIONS) {
    for (const code of next[action]) {
      const existing = used.get(code);
      if (existing && existing !== action) return null;
      used.set(code, action);
    }
  }

  return next;
}

export class InputBindingStore {
  private bindings = cloneBindings(DEFAULT_BINDINGS);
  private readonly listeners = new Set<BindingListener>();
  private readonly deviceListeners = new Set<ActiveDeviceListener>();
  private activeDevice: ActiveInputDevice = 'keyboard';

  constructor(
    private readonly storage: BindingStorage | null = defaultStorage(),
    private readonly storageKey = STORAGE_KEY,
  ) {
    this.load();
  }

  getBindings(): Record<BindableAction, string[]> {
    return cloneBindings(this.bindings);
  }

  getBinding(action: BindableAction): string[] {
    return [...this.bindings[action]];
  }

  bind(action: BindableAction, code: string): BindResult {
    if (!isBindableAction(action)) return { ok: false, reason: 'invalid-action' };
    const normalized = normalizeCode(code);
    if (RESERVED_CODES.has(normalized) || !validCode(normalized) || (normalized === 'Escape' && action !== 'pause')) return { ok: false, reason: 'reserved' };
    for (const other of BINDABLE_ACTIONS) {
      if (other !== action && this.bindings[other].includes(normalized)) {
        return { ok: false, reason: 'conflict', conflictAction: other };
      }
    }
    this.bindings = { ...this.bindings, [action]: [normalized] };
    this.persist();
    this.emit();
    return { ok: true };
  }

  reset(): Record<BindableAction, string[]> {
    this.bindings = cloneBindings(DEFAULT_BINDINGS);
    try {
      this.storage?.removeItem(this.storageKey);
    } catch {
      /* bindings stay in memory when storage is unavailable */
    }
    this.emit();
    return this.getBindings();
  }

  onChange(listener: BindingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onActiveDeviceChange(listener: ActiveDeviceListener): () => void {
    this.deviceListeners.add(listener);
    return () => this.deviceListeners.delete(listener);
  }

  prompt(action: BindableAction): string {
    if (this.activeDevice === 'gamepad') return GAMEPAD_PROMPTS[action];
    return formatKeyboardCode(this.bindings[action][0] ?? DEFAULT_BINDINGS[action][0] ?? '');
  }

  getActiveDevice(): ActiveInputDevice {
    return this.activeDevice;
  }

  setActiveDevice(device: ActiveInputDevice): void {
    if (this.activeDevice === device) return;
    this.activeDevice = device;
    for (const listener of this.deviceListeners) listener(device);
  }

  private load(): void {
    try {
      const raw = this.storage?.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      const next = validateStoredBindings(parsed);
      if (!next) {
        this.bindings = cloneBindings(DEFAULT_BINDINGS);
        this.storage?.removeItem(this.storageKey);
        return;
      }
      this.bindings = next;
    } catch {
      this.bindings = cloneBindings(DEFAULT_BINDINGS);
      try {
        this.storage?.removeItem(this.storageKey);
      } catch {
        /* bindings stay in memory when storage is unavailable */
      }
    }
  }

  private persist(): void {
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(this.bindings));
    } catch {
      /* bindings stay in memory when storage is unavailable */
    }
  }

  private emit(): void {
    const snapshot = this.getBindings();
    for (const listener of this.listeners) listener(snapshot);
  }
}

export function formatKeyboardCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'Space';
  if (code === 'ArrowUp') return 'Up';
  if (code === 'ArrowDown') return 'Down';
  if (code === 'ArrowLeft') return 'Left';
  if (code === 'ArrowRight') return 'Right';
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  return code;
}

export const inputBindingStore = new InputBindingStore();
