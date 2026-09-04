import { dialogueId, type DialogueId } from '../types/ids';

export interface DialogueOption {
  label: string;
  nextId?: DialogueId;
  startsQuestId?: string;
}

export interface DialogueNode {
  id: DialogueId;
  speakerId: string;
  portrait?: string;
  lines: readonly string[];
  options?: readonly DialogueOption[];
  when?: { questId: string; status?: string };
}

const define = <T extends Record<string, Omit<DialogueNode, 'id'>>>(defs: T) =>
  Object.fromEntries(Object.entries(defs).map(([id, d]) => [id, { ...d, id: dialogueId(id) }])) as {
    [K in keyof T]: DialogueNode;
  };

export const DIALOGUE = define({
  elder_hana_start: {
    speakerId: 'elder_hana',
    portrait: 'elder_hana_face',
    lines: ['The Ember has gone cold. Speak with Ryo, then follow the old road through the woods.'],
    options: [{ label: 'I will go.', startsQuestId: 'quest_dimmed_shrine' }],
  },
  elder_hana_guardian: {
    speakerId: 'elder_hana',
    portrait: 'elder_hana_face',
    lines: ['The shrine key was kept beyond the forest. Bring back the Ember, and Kagehara will breathe again.'],
    when: { questId: 'quest_sleeping_guardian', status: 'active' },
  },
  master_ryo_hint: {
    speakerId: 'master_ryo',
    portrait: 'master_ryo_face',
    lines: ['Do not trade blows. Strike, step away, and roll through danger when the forest tries to answer.'],
  },
  child_mimi_start: {
    speakerId: 'child_mimi',
    portrait: 'child_mimi_face',
    lines: ['I dropped my lucky charm near the secret grove. It shines green when the trees get too quiet.'],
    options: [{ label: 'I will look.', startsQuestId: 'quest_lost_charm' }],
  },
  merchant_botan_shop: {
    speakerId: 'merchant_botan',
    portrait: 'merchant_botan_face',
    lines: ['The heavy blade is slow, but old shrine bones respect it. Rice balls respect everyone.'],
  },
  guard_goro_gate: {
    speakerId: 'guard_goro',
    portrait: 'guard_goro_face',
    lines: ['The woods are open, but keep your thumb near the roll button. Pride heals slowly.'],
  },
  hermit_sen_hint: {
    speakerId: 'hermit_sen',
    portrait: 'hermit_sen_face',
    lines: ['The Guardian is not evil. Something broke its dream. Keys and courage both rust when unused.'],
  },
});

export type KnownDialogueId = keyof typeof DIALOGUE;

export function getDialogue(id: string): DialogueNode {
  const node = (DIALOGUE as Record<string, DialogueNode>)[id];
  if (!node) throw new Error(`Unknown dialogue: ${id}`);
  return node;
}
