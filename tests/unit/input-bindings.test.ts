import { describe, expect, it } from 'vitest';
import {
  ACTION_LABELS,
  BINDABLE_ACTIONS,
  DEFAULT_BINDINGS,
  InputBindingStore,
  type BindingStorage,
} from '../../src/game/input/InputBindingStore';

class MemoryStorage implements BindingStorage {
  readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe('InputBindingStore', () => {
  it('keeps the eleven gameplay actions and default keyboard aliases', () => {
    const store = new InputBindingStore(new MemoryStorage());

    expect(BINDABLE_ACTIONS).toHaveLength(11);
    expect(ACTION_LABELS.attack).toBe('Attack');
    expect(store.getBinding('moveUp')).toEqual(['ArrowUp', 'KeyW']);
    expect(store.getBinding('attack')).toEqual(['KeyJ', 'KeyZ', 'Space']);
    expect(store.getBinding('throw')).toEqual(['KeyL', 'KeyC']);
  });

  it('persists rebinding outside save data and reloads it', () => {
    const storage = new MemoryStorage();
    const first = new InputBindingStore(storage);

    expect(first.bind('attack', 'KeyF')).toEqual({ ok: true });

    const second = new InputBindingStore(storage);
    expect(second.getBinding('attack')).toEqual(['KeyF']);
    expect(second.getBinding('moveLeft')).toEqual(DEFAULT_BINDINGS.moveLeft);
  });

  it('loads a valid full snapshot even when actions have swapped defaults', () => {
    const storage = new MemoryStorage();
    const swapped = {
      ...DEFAULT_BINDINGS,
      attack: ['KeyK'],
      roll: ['KeyJ'],
    };
    storage.setItem('emberfall.inputBindings.v1', JSON.stringify(swapped));

    const store = new InputBindingStore(storage);

    expect(store.getBinding('attack')).toEqual(['KeyK']);
    expect(store.getBinding('roll')).toEqual(['KeyJ']);
  });

  it('falls back to defaults and clears persisted bindings with cross-action conflicts', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'emberfall.inputBindings.v1',
      JSON.stringify({
        ...DEFAULT_BINDINGS,
        attack: ['KeyK'],
      }),
    );

    const store = new InputBindingStore(storage);

    expect(store.getBinding('attack')).toEqual(DEFAULT_BINDINGS.attack);
    expect(store.getBinding('roll')).toEqual(DEFAULT_BINDINGS.roll);
    expect(storage.getItem('emberfall.inputBindings.v1')).toBeNull();
  });

  it.each([
    ['unsupported code', { ...DEFAULT_BINDINGS, attack: ['Numpad1'] }],
    ['reserved browser key', { ...DEFAULT_BINDINGS, attack: ['F5'] }],
    ['escape outside pause', { ...DEFAULT_BINDINGS, attack: ['Escape'] }],
    ['duplicate codes inside one action', { ...DEFAULT_BINDINGS, attack: ['KeyF', 'KeyF'] }],
    ['unknown action', { ...DEFAULT_BINDINGS, debugMenu: ['KeyF'] }],
    ['empty action binding', { ...DEFAULT_BINDINGS, attack: [] }],
    ['malformed JSON shape', []],
  ])('falls back to defaults for %s', (_name, value) => {
    const storage = new MemoryStorage();
    storage.setItem('emberfall.inputBindings.v1', JSON.stringify(value));

    const store = new InputBindingStore(storage);

    expect(store.getBindings()).toEqual(DEFAULT_BINDINGS);
    expect(storage.getItem('emberfall.inputBindings.v1')).toBeNull();
  });

  it('rejects conflicts and reserved browser keys', () => {
    const store = new InputBindingStore(new MemoryStorage());

    expect(store.bind('attack', 'KeyK')).toEqual({ ok: false, reason: 'conflict', conflictAction: 'roll' });
    expect(store.bind('attack', 'F5')).toEqual({ ok: false, reason: 'reserved' });
    expect(store.getBinding('attack')).toEqual(DEFAULT_BINDINGS.attack);
  });

  it('notifies runtime listeners and resets to defaults', () => {
    const storage = new MemoryStorage();
    const store = new InputBindingStore(storage);
    const seen: string[][] = [];
    const off = store.onChange((bindings) => seen.push([...bindings.roll]));

    expect(store.bind('roll', 'KeyR')).toEqual({ ok: true });
    expect(seen).toEqual([['KeyR']]);

    off();
    expect(store.reset().roll).toEqual(DEFAULT_BINDINGS.roll);
    expect(seen).toEqual([['KeyR']]);
    expect(storage.data.size).toBe(0);
  });

  it('formats prompts for the active input device', () => {
    const store = new InputBindingStore(new MemoryStorage());

    expect(store.prompt('interact')).toBe('E');
    store.setActiveDevice('gamepad');
    expect(store.prompt('interact')).toBe('X');
    store.setActiveDevice('keyboard');
    expect(store.bind('interact', 'KeyF')).toEqual({ ok: true });
    expect(store.prompt('interact')).toBe('F');
  });

  it('notifies when the active device changes', () => {
    const store = new InputBindingStore(new MemoryStorage());
    const seen: string[] = [];
    const off = store.onActiveDeviceChange((device) => seen.push(device));

    store.setActiveDevice('gamepad');
    store.setActiveDevice('gamepad');
    store.setActiveDevice('keyboard');
    off();
    store.setActiveDevice('gamepad');

    expect(seen).toEqual(['gamepad', 'keyboard']);
  });
});
