// Stable string ids used as persistence keys. Display names are never keys.
export type ItemId = string & { readonly __brand: 'ItemId' };
export type EnemyId = string & { readonly __brand: 'EnemyId' };
export type NpcId = string & { readonly __brand: 'NpcId' };
export type QuestId = string & { readonly __brand: 'QuestId' };
export type MapId = string & { readonly __brand: 'MapId' };
export type DialogueId = string & { readonly __brand: 'DialogueId' };
export type LootTableId = string & { readonly __brand: 'LootTableId' };

export const itemId = (s: string): ItemId => s as ItemId;
export const enemyId = (s: string): EnemyId => s as EnemyId;
export const npcId = (s: string): NpcId => s as NpcId;
export const questId = (s: string): QuestId => s as QuestId;
export const mapId = (s: string): MapId => s as MapId;
export const dialogueId = (s: string): DialogueId => s as DialogueId;
export const lootTableId = (s: string): LootTableId => s as LootTableId;
