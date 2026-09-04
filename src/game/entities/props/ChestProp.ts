import Phaser from 'phaser';
import { sfxKey, Tex } from '../../config/assets';
import { Depth } from '../../config/constants';
import type { InteractionContext, Interactable, InteractableCallbacks } from './Interactable';

export interface ChestPropConfig {
  chestId: string;
  lootTable: string;
  x: number;
  y: number;
  big?: boolean;
  opened?: boolean;
  radius?: number;
}

export class ChestProp implements Interactable {
  readonly kind = 'chest' as const;
  readonly radius: number;
  readonly priority = 5;
  readonly data: Readonly<Record<string, string | number | boolean>>;
  private opened: boolean;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly focus: Phaser.GameObjects.Image | null;
  private readonly callbacks: InteractableCallbacks;

  constructor(scene: Phaser.Scene, private readonly cfg: ChestPropConfig, callbacks: InteractableCallbacks = {}) {
    this.radius = cfg.radius ?? 30;
    this.opened = cfg.opened ?? false;
    this.callbacks = callbacks;
    this.data = { chestId: cfg.chestId, lootTable: cfg.lootTable, big: cfg.big ?? false };
    this.sprite = scene.add.sprite(cfg.x, cfg.y - 8, cfg.big ? Tex.chestBig : Tex.chestSmall, this.opened ? 1 : 0);
    this.sprite.setOrigin(0.5, 1).setDepth(Depth.ActorBase + cfg.y).setName(`chest:${cfg.chestId}`);
    this.focus = scene.textures.exists(Tex.focus)
      ? scene.add.image(cfg.x, cfg.y - 16, Tex.focus).setDepth(Depth.Overlay).setVisible(false).setAlpha(0.8)
      : null;
  }

  get id(): string {
    return this.cfg.chestId;
  }

  get x(): number {
    return this.cfg.x;
  }

  get y(): number {
    return this.cfg.y;
  }

  get prompt(): string {
    return this.opened ? 'Opened' : 'Open';
  }

  get isOpen(): boolean {
    return this.opened;
  }

  canInteract(): boolean {
    return !this.opened;
  }

  interact(ctx: InteractionContext): void {
    if (this.opened) return;
    this.markOpened(ctx);
    this.callbacks.onChest?.(this.id, this.cfg.lootTable, ctx);
  }

  markOpened(ctx: InteractionContext): void {
    this.opened = true;
    this.sprite.setFrame(1);
    if (!ctx.session.save.openedChests.includes(this.id)) ctx.session.save.openedChests.push(this.id);
    const key = sfxKey('chest_open');
    if (ctx.scene.cache.audio.exists(key)) ctx.scene.sound.play(key, { volume: 0.65 });
  }

  setHighlighted(highlighted: boolean): void {
    this.focus?.setVisible(highlighted && !this.opened);
  }

  destroy(): void {
    this.focus?.destroy();
    this.sprite.destroy();
  }
}
