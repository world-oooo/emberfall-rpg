import { STORAGE_NAMESPACE } from '../config/constants';
import { inputBindingStore, type BindableAction } from '../input/InputBindingStore';

export type ControlAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'attack'
  | 'roll'
  | 'interact'
  | 'throw'
  | 'inventory'
  | 'quests'
  | 'pause';

export interface Settings {
  masterVolume: number; // 0..1
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  /** 'fill' uses the whole window at an integer zoom; 'fixed' frames a constant view and letterboxes. */
  displayMode: 'fill' | 'fixed';
  showHints: boolean;
  fullscreen: boolean;
}

const DEFAULTS: Settings = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.9,
  screenShake: true,
  displayMode: 'fill',
  showHints: true,
  fullscreen: false,
};

const KEY = `${STORAGE_NAMESPACE}.settings`;

function clamp01(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

function sanitize(raw: unknown): Settings {
  const parsed = typeof raw === 'object' && raw !== null ? (raw as Partial<Settings>) : {};
  return {
    masterVolume: clamp01(parsed.masterVolume, DEFAULTS.masterVolume),
    musicVolume: clamp01(parsed.musicVolume, DEFAULTS.musicVolume),
    sfxVolume: clamp01(parsed.sfxVolume, DEFAULTS.sfxVolume),
    screenShake: typeof parsed.screenShake === 'boolean' ? parsed.screenShake : DEFAULTS.screenShake,
    displayMode: parsed.displayMode === 'fixed' || parsed.displayMode === 'fill' ? parsed.displayMode : DEFAULTS.displayMode,
    showHints: typeof parsed.showHints === 'boolean' ? parsed.showHints : DEFAULTS.showHints,
    fullscreen: typeof parsed.fullscreen === 'boolean' ? parsed.fullscreen : DEFAULTS.fullscreen,
  };
}

/** Tiny synchronous settings store (localStorage). Everything else persists through SaveSystem. */
export class SettingsStore {
  private static current: Settings = sanitize(DEFAULTS);
  private static listeners = new Set<(s: Settings) => void>();

  static load(): Settings {
    try {
      const raw = localStorage.getItem(KEY);
      this.current = raw ? sanitize(JSON.parse(raw) as unknown) : sanitize(DEFAULTS);
    } catch {
      this.current = sanitize(DEFAULTS);
    }
    return this.current;
  }

  static get(): Settings {
    return this.current;
  }

  static set(patch: Partial<Settings>): Settings {
    this.current = sanitize({ ...this.current, ...patch });
    try {
      localStorage.setItem(KEY, JSON.stringify(this.current));
    } catch {
      /* storage may be unavailable (private mode) — settings stay in memory */
    }
    for (const l of this.listeners) l(this.current);
    return this.current;
  }

  static onChange(fn: (s: Settings) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  static keyLabel(action: ControlAction): string {
    const directions: Record<string, BindableAction> = { up: 'moveUp', down: 'moveDown', left: 'moveLeft', right: 'moveRight' };
    return inputBindingStore.prompt(directions[action] ?? action as BindableAction);
  }

  static hint(actions: ControlAction[]): string {
    return actions.map((action) => this.keyLabel(action)).join(' / ');
  }

  static reset(): Settings {
    return this.set(sanitize(DEFAULTS));
  }
}
