import { STORAGE_NAMESPACE } from '../config/constants';

export interface Settings {
  masterVolume: number; // 0..1
  musicVolume: number;
  sfxVolume: number;
  screenShake: boolean;
  integerScaling: boolean;
  showHints: boolean;
}

const DEFAULTS: Settings = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.9,
  screenShake: true,
  integerScaling: true,
  showHints: true,
};

const KEY = `${STORAGE_NAMESPACE}.settings`;

/** Tiny synchronous settings store (localStorage). Everything else persists through SaveSystem. */
export class SettingsStore {
  private static current: Settings = { ...DEFAULTS };
  private static listeners = new Set<(s: Settings) => void>();

  static load(): Settings {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        this.current = { ...DEFAULTS, ...parsed };
      }
    } catch {
      this.current = { ...DEFAULTS };
    }
    return this.current;
  }

  static get(): Settings {
    return this.current;
  }

  static set(patch: Partial<Settings>): Settings {
    this.current = { ...this.current, ...patch };
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

  static reset(): Settings {
    return this.set({ ...DEFAULTS });
  }
}
