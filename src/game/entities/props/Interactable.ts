import type Phaser from 'phaser';
import type { GameSession } from '../../core/session';

export type InteractableKind = 'npc' | 'sign' | 'chest' | 'shrine' | 'dummy' | 'savepoint' | 'emberPedestal' | 'seal';

export interface InteractionContext {
  scene: Phaser.Scene;
  session: GameSession;
  player: {
    x: number;
    y: number;
    center: Phaser.Math.Vector2;
  };
}

export interface Interactable {
  readonly id: string;
  readonly kind: InteractableKind;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly prompt: string;
  readonly priority: number;
  readonly isDestroyed?: boolean;
  readonly data?: Readonly<Record<string, string | number | boolean>>;
  canInteract(ctx: InteractionContext): boolean;
  interact(ctx: InteractionContext): void;
  setHighlighted?(highlighted: boolean): void;
  destroy?(): void;
}

export interface InteractableCallbacks {
  onNpc?: (id: string, ctx: InteractionContext) => void;
  onObject?: (id: string, kind: InteractableKind, ctx: InteractionContext) => void;
  onChest?: (id: string, lootTable: string, ctx: InteractionContext) => void;
}
