import { createStore, del, get, set } from 'idb-keyval';
import { SAVE_VERSION, STORAGE_NAMESPACE } from '../config/constants';
import { createNewSave, type SaveGame } from '../core/session';

export const SAVE_SLOT_KEY = 'slot_1';
export const SAVE_META_KEY = 'meta';

interface SaveMeta {
  savedAt: number;
  saveVersion: number;
  level: number;
  mapId: string;
  playtimeMs: number;
}

export interface KeyValueStore {
  get<T>(key: IDBValidKey): Promise<T | undefined>;
  set(key: IDBValidKey, value: unknown): Promise<void>;
  del(key: IDBValidKey): Promise<void>;
}

const idbStore = createStore(STORAGE_NAMESPACE, 'saves');

const defaultStore: KeyValueStore = {
  get: <T>(key: IDBValidKey) => get<T>(key, idbStore),
  set: (key: IDBValidKey, value: unknown) => set(key, value, idbStore),
  del: (key: IDBValidKey) => del(key, idbStore),
};

function cloneSave(save: SaveGame): SaveGame {
  return structuredClone(save);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function migrate(raw: unknown): SaveGame {
  if (!isRecord(raw)) throw new Error('Invalid save data');
  const version = Number(raw.saveVersion ?? 0);
  if (version > SAVE_VERSION) throw new Error(`Save version ${version} is newer than this build`);
  if (version !== SAVE_VERSION) throw new Error(`Unsupported save version: ${version}`);
  return { ...createNewSave(), ...raw, saveVersion: SAVE_VERSION } as SaveGame;
}

function metaFromSave(save: SaveGame): SaveMeta {
  return {
    savedAt: save.savedAt,
    saveVersion: save.saveVersion,
    level: save.player.level,
    mapId: save.player.mapId,
    playtimeMs: save.playtimeMs,
  };
}

export class SaveSystem {
  constructor(private readonly store: KeyValueStore = defaultStore) {}

  async save(save: SaveGame): Promise<SaveGame> {
    const copy = cloneSave(save);
    copy.savedAt = Date.now();
    copy.saveVersion = SAVE_VERSION;
    await this.store.set(SAVE_SLOT_KEY, copy);
    await this.store.set(SAVE_META_KEY, metaFromSave(copy));
    await this.persistStorage();
    return cloneSave(copy);
  }

  async load(): Promise<SaveGame | null> {
    const raw = await this.store.get<unknown>(SAVE_SLOT_KEY);
    if (raw === undefined) return null;
    return migrate(raw);
  }

  async delete(): Promise<void> {
    await this.store.del(SAVE_SLOT_KEY);
    await this.store.del(SAVE_META_KEY);
  }

  async export(): Promise<string> {
    const save = await this.load();
    if (!save) throw new Error('No save to export');
    return JSON.stringify(save);
  }

  async import(json: string): Promise<SaveGame> {
    const parsed = JSON.parse(json) as unknown;
    const save = migrate(parsed);
    return this.save(save);
  }

  async getMeta(): Promise<SaveMeta | null> {
    return (await this.store.get<SaveMeta>(SAVE_META_KEY)) ?? null;
  }

  private async persistStorage(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
    await navigator.storage.persist();
  }
}
