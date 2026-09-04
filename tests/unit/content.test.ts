import { describe, expect, it } from 'vitest';
import { DIALOGUE, getDialogue, hasDialogue } from '../../src/game/data/dialogue';
import { QUESTS } from '../../src/game/data/quests';
import { MAPS } from '../../src/game/data/maps';

/** Every speaking NPC in the world, by the id WorldScene looks their dialogue up under. */
const SPEAKING_NPCS = ['elder_hana', 'master_ryo', 'child_mimi', 'merchant_botan', 'guard_goro', 'hermit_sen'];

describe('dialogue content', () => {
  it('gives every named NPC something new to say after the Ember is restored', () => {
    for (const npcId of SPEAKING_NPCS) {
      expect(hasDialogue(`${npcId}_after`), `${npcId} has no post-ending line`).toBe(true);
      expect(getDialogue(`${npcId}_after`).speakerId).toBe(npcId);
    }
  });

  it('keeps every dialogue node non-empty and attributed', () => {
    for (const node of Object.values(DIALOGUE)) {
      expect(node.lines.length).toBeGreaterThan(0);
      for (const line of node.lines) expect(line.trim().length).toBeGreaterThan(0);
      expect(node.speakerId.length).toBeGreaterThan(0);
    }
  });

  it('only starts quests that exist', () => {
    for (const node of Object.values(DIALOGUE)) {
      for (const option of node.options ?? []) {
        if (option.startsQuestId) expect(Object.keys(QUESTS)).toContain(option.startsQuestId);
      }
    }
  });
});

describe('map registry', () => {
  it('declares a tileset, music and file for every map', () => {
    for (const map of Object.values(MAPS)) {
      expect(map.tilesets.length).toBeGreaterThan(0);
      expect(map.file.endsWith('.json')).toBe(true);
      expect(map.displayName.length).toBeGreaterThan(0);
    }
  });
});
