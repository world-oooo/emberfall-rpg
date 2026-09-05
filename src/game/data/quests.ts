import { questId, type QuestId } from '../types/ids';

export type QuestObjectiveKind = 'talkToNpc' | 'enterArea' | 'defeatEnemy' | 'collectItem' | 'interactObject';

export interface QuestObjective {
  id: string;
  label: string;
  kind: QuestObjectiveKind;
  targetId: string;
  count: number;
}

export interface QuestReward {
  xp?: number;
  coins?: number;
  items?: readonly { itemId: string; quantity: number }[];
  flags?: readonly { key: string; value: boolean | number | string }[];
}

export interface QuestDefinition {
  id: QuestId;
  title: string;
  giver?: string;
  summary: string;
  startsAvailable?: boolean;
  autoStartAfterRewarded?: string;
  objectives: readonly QuestObjective[];
  rewards: QuestReward;
}

const define = <T extends Record<string, Omit<QuestDefinition, 'id'>>>(defs: T) =>
  Object.fromEntries(Object.entries(defs).map(([id, d]) => [id, { ...d, id: questId(id) }])) as {
    [K in keyof T]: QuestDefinition;
  };

export const QUESTS = define({
  quest_dimmed_shrine: {
    title: 'The Dimmed Shrine',
    giver: 'elder_hana',
    summary: 'Help Elder Hana learn why the shrine ember went dark.',
    startsAvailable: true,
    objectives: [
      { id: 'talk_ryo', label: 'Talk to Master Ryo', kind: 'talkToNpc', targetId: 'master_ryo', count: 1 },
      { id: 'reach_woods', label: 'Reach the Whispering Woods', kind: 'enterArea', targetId: 'woods', count: 1 },
      { id: 'defeat_slimes', label: 'Defeat 4 forest slimes', kind: 'defeatEnemy', targetId: 'slime', count: 4 },
      { id: 'reach_shrine', label: 'Find the Hollow Shrine entrance', kind: 'enterArea', targetId: 'shrine', count: 1 },
    ],
    rewards: { xp: 40, coins: 30 },
  },
  quest_sleeping_guardian: {
    title: 'The Sleeping Guardian',
    summary: 'Recover the Ember from the Mask Keeper, the corrupted Tanuki Guardian.',
    autoStartAfterRewarded: 'quest_dimmed_shrine',
    objectives: [
      { id: 'find_key', label: 'Find the shrine key', kind: 'collectItem', targetId: 'shrine_key', count: 1 },
      { id: 'defeat_guardian', label: 'Defeat the Mask Keeper', kind: 'defeatEnemy', targetId: 'boss_racoon', count: 1 },
      { id: 'take_ember', label: 'Take the Ember', kind: 'collectItem', targetId: 'ember', count: 1 },
      { id: 'return_hana', label: 'Return to Elder Hana', kind: 'talkToNpc', targetId: 'elder_hana', count: 1 },
      { id: 'relight_shrine', label: 'Relight the village shrine', kind: 'interactObject', targetId: 'shrine_ember', count: 1 },
    ],
    rewards: {
      xp: 120,
      items: [{ itemId: 'guardian_charm', quantity: 1 }],
      flags: [{ key: 'ending.relit_shrine', value: true }],
    },
  },
  quest_lost_charm: {
    title: "Mimi's Lost Charm",
    giver: 'child_mimi',
    summary: "Find Mimi's charm hidden in the secret grove.",
    startsAvailable: true,
    objectives: [
      { id: 'find_charm', label: 'Find the charm in the secret grove', kind: 'collectItem', targetId: 'fox_charm', count: 1 },
      { id: 'return_mimi', label: 'Return to Mimi', kind: 'talkToNpc', targetId: 'child_mimi', count: 1 },
    ],
    // The charm itself is found in the grove and stays with the player; handing it back as the "reward" was a
    // no-op against a one-per-stack accessory. Mimi gives something the road ahead can use instead.
    rewards: { xp: 30, coins: 15, items: [{ itemId: 'life_potion', quantity: 1 }] },
  },
});

export type KnownQuestId = keyof typeof QUESTS;

export function getQuest(id: string): QuestDefinition {
  const quest = (QUESTS as Record<string, QuestDefinition>)[id];
  if (!quest) throw new Error(`Unknown quest: ${id}`);
  return quest;
}

export function hasQuestDef(id: string): boolean {
  return id in QUESTS;
}
