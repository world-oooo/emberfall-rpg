import Phaser from 'phaser';

/** Typed game-wide events. Systems subscribe, scenes/entities emit. Kept deliberately small. */
export interface GameEventMap {
  playerHealthChanged: { hp: number; maxHp: number };
  playerDied: Record<string, never>;
  enemyDefeated: { enemyId: string; spawnId: string; x: number; y: number };
  itemAcquired: { itemId: string; quantity: number };
  coinsChanged: { coins: number; delta: number };
  xpChanged: { xp: number; level: number };
  levelUp: { level: number; maxHp: number };
  questUpdated: { questId: string; status: string; objectiveId?: string };
  npcSpoken: { npcId: string };
  objectInteracted: { interactionId: string };
  areaEntered: { mapId: string };
  toast: { text: string };
}

type Handler<T> = (payload: T) => void;

class TypedEmitter {
  private readonly emitter = new Phaser.Events.EventEmitter();

  on<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>, context?: unknown): () => void {
    this.emitter.on(event, handler, context);
    return () => this.emitter.off(event, handler, context);
  }

  once<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>, context?: unknown): void {
    this.emitter.once(event, handler, context);
  }

  off<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>, context?: unknown): void {
    this.emitter.off(event, handler, context);
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    this.emitter.emit(event, payload);
  }

  removeAll(): void {
    this.emitter.removeAllListeners();
  }
}

/** One emitter for the whole game (lives across scene restarts). */
export const gameEvents = new TypedEmitter();
