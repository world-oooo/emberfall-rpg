import { describe, expect, it } from 'vitest';
import { createNewSave } from '../../src/game/core/session';
import { QuestSystem } from '../../src/game/systems/QuestSystem';
import { SaveSystem, type KeyValueStore } from '../../src/game/systems/SaveSystem';
import { InventorySystem } from '../../src/game/systems/InventorySystem';

class MemoryStore implements KeyValueStore {
  readonly values = new Map<IDBValidKey, unknown>();

  async get<T>(key: IDBValidKey): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async set(key: IDBValidKey, value: unknown): Promise<void> {
    this.values.set(key, value);
  }

  async del(key: IDBValidKey): Promise<void> {
    this.values.delete(key);
  }
}

describe("Mimi's Lost Charm persistence", () => {
  it('keeps accepted, collected, rewarded, and equipped charm state across save/load', async () => {
    const store = new MemoryStore();
    const saves = new SaveSystem(store);
    const save = createNewSave();
    const quests = new QuestSystem(save);
    const inventory = new InventorySystem(save);

    quests.start('quest_lost_charm');
    inventory.add('fox_charm');
    quests.recordItemAcquired('fox_charm');
    quests.recordNpcSpoken('child_mimi');
    expect(quests.claimReward('quest_lost_charm')).toMatchObject({ xp: 30 });
    inventory.equip('fox_charm');

    const saved = await saves.save(save);
    const loaded = await saves.load();

    expect(saved.quests.quest_lost_charm).toMatchObject({
      status: 'rewarded',
      objectives: { find_charm: 1, return_mimi: 1 },
    });
    expect(saved.quests.quest_lost_charm).toBeDefined();
    expect(loaded?.quests.quest_lost_charm).toMatchObject(saved.quests.quest_lost_charm ?? {});
    expect(loaded?.inventory.find((entry) => entry.itemId === 'fox_charm')?.quantity).toBe(1);
    expect(loaded?.equipment.accessory).toBe('fox_charm');
    expect(loaded?.player.xp).toBe(30);
  });
});
