import type { QuestProgress, SaveGame } from '../core/session';
import { QUESTS, getQuest, type QuestDefinition, type QuestObjectiveKind, type QuestReward } from '../data/quests';
import { InventorySystem } from './InventorySystem';
import { ProgressionSystem } from './ProgressionSystem';

export interface QuestUpdate {
  questId: string;
  objectiveId?: string;
  completed: boolean;
  status: QuestProgress['status'];
}

export class QuestSystem {
  constructor(private readonly save: SaveGame) {
    this.seedAvailableQuests();
  }

  getProgress(questId: string): QuestProgress {
    return this.ensureProgress(getQuest(questId));
  }

  getActiveQuests(): QuestDefinition[] {
    return Object.values(QUESTS).filter((quest) => this.getProgress(quest.id).status === 'active');
  }

  start(questId: string): QuestUpdate {
    const quest = getQuest(questId);
    const progress = this.ensureProgress(quest);
    if (progress.status === 'available' || progress.status === 'locked') progress.status = 'active';
    this.applyCurrentInventoryToCollectObjectives(quest, progress);
    this.completeIfReady(quest, progress);
    return { questId, completed: progress.status === 'completed' || progress.status === 'rewarded', status: progress.status };
  }

  recordNpcSpoken(npcId: string): QuestUpdate[] {
    return this.recordObjective('talkToNpc', npcId);
  }

  recordAreaEntered(mapId: string): QuestUpdate[] {
    return this.recordObjective('enterArea', mapId);
  }

  recordEnemyDefeated(enemyId: string): QuestUpdate[] {
    return this.recordObjective('defeatEnemy', enemyId);
  }

  recordItemAcquired(itemId: string): QuestUpdate[] {
    return this.recordObjective('collectItem', itemId);
  }

  recordObjectInteracted(interactionId: string): QuestUpdate[] {
    return this.recordObjective('interactObject', interactionId);
  }

  claimReward(questId: string): QuestReward | null {
    const quest = getQuest(questId);
    const progress = this.ensureProgress(quest);
    if (progress.status === 'rewarded') return null;
    if (progress.status !== 'completed') throw new Error(`Quest is not completed: ${questId}`);

    const reward = quest.rewards;
    const inventory = new InventorySystem(this.save);
    const progression = new ProgressionSystem(this.save);
    if (reward.coins) inventory.add('coin', reward.coins);
    if (reward.items) inventory.addMany(reward.items);
    if (reward.xp) progression.addXp(reward.xp);
    if (reward.flags) for (const flag of reward.flags) this.save.flags[flag.key] = flag.value;

    progress.status = 'rewarded';
    this.seedAvailableQuests();
    return reward;
  }

  private recordObjective(kind: QuestObjectiveKind, targetId: string): QuestUpdate[] {
    const updates: QuestUpdate[] = [];
    for (const quest of Object.values(QUESTS)) {
      const progress = this.ensureProgress(quest);
      if (progress.status !== 'active') continue;

      for (let index = 0; index < quest.objectives.length; index += 1) {
        const objective = quest.objectives[index];
        if (!objective) continue;
        if (objective.kind !== kind || objective.targetId !== targetId) continue;
        const previousObjectivesComplete = quest.objectives
          .slice(0, index)
          .every((earlier) => (progress.objectives[earlier.id] ?? 0) >= earlier.count);
        if (!previousObjectivesComplete) continue;
        const previous = progress.objectives[objective.id] ?? 0;
        progress.objectives[objective.id] = Math.min(objective.count, previous + 1);
        this.completeIfReady(quest, progress);
        const status = progress.status as QuestProgress['status'];
        updates.push({ questId: quest.id, objectiveId: objective.id, completed: status === 'completed', status });
      }
    }
    return updates;
  }

  private ensureProgress(quest: QuestDefinition): QuestProgress {
    this.save.quests[quest.id] ??= {
      status: quest.startsAvailable ? 'available' : 'locked',
      objectives: Object.fromEntries(quest.objectives.map((objective) => [objective.id, 0])),
    };
    const progress = this.save.quests[quest.id];
    if (!progress) throw new Error(`Could not create quest progress: ${quest.id}`);
    for (const objective of quest.objectives) progress.objectives[objective.id] ??= 0;
    return progress;
  }

  private completeIfReady(quest: QuestDefinition, progress: QuestProgress): void {
    if (progress.status !== 'active') return;
    const complete = quest.objectives.every((objective) => (progress.objectives[objective.id] ?? 0) >= objective.count);
    if (complete) progress.status = 'completed';
  }

  private applyCurrentInventoryToCollectObjectives(quest: QuestDefinition, progress: QuestProgress): void {
    const inventory = new InventorySystem(this.save);
    for (const objective of quest.objectives) {
      if (objective.kind !== 'collectItem') continue;
      progress.objectives[objective.id] = Math.max(progress.objectives[objective.id] ?? 0, Math.min(objective.count, inventory.quantityOf(objective.targetId)));
    }
  }

  private seedAvailableQuests(): void {
    for (const quest of Object.values(QUESTS)) {
      const progress = this.ensureProgress(quest);
      if (quest.autoStartAfterRewarded && progress.status === 'locked') {
        const prerequisite = this.save.quests[quest.autoStartAfterRewarded];
        if (prerequisite?.status === 'rewarded') progress.status = 'active';
      }
    }
  }
}
