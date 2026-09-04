import Phaser from 'phaser';
import { Tex } from '../../config/assets';
import { Depth } from '../../config/constants';
import type { InteractionContext, Interactable, InteractableCallbacks, InteractableKind } from './Interactable';

export interface MapInteractableConfig {
  id: string;
  kind: InteractableKind;
  x: number;
  y: number;
  radius?: number;
  priority?: number;
  data?: Readonly<Record<string, string | number | boolean>>;
}

const DEFAULT_PROMPTS: Record<InteractableKind, string> = {
  npc: 'Talk',
  sign: 'Read',
  chest: 'Open',
  shrine: 'Pray',
  dummy: 'Inspect',
  savepoint: 'Save',
  emberPedestal: 'Place',
  seal: 'Unseal',
  brazier: 'Light',
};

export class MapInteractable implements Interactable {
  readonly id: string;
  readonly kind: InteractableKind;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly priority: number;
  readonly data?: Readonly<Record<string, string | number | boolean>>;
  private readonly promptText: string;
  private readonly callbacks: InteractableCallbacks;
  private readonly marker: Phaser.GameObjects.Image | null;

  constructor(scene: Phaser.Scene, cfg: MapInteractableConfig, callbacks: InteractableCallbacks = {}) {
    this.id = cfg.id;
    this.kind = cfg.kind;
    this.x = cfg.x;
    this.y = cfg.y;
    this.radius = cfg.radius ?? 32;
    this.priority = cfg.priority ?? 0;
    this.data = cfg.data;
    this.promptText = DEFAULT_PROMPTS[this.kind];
    this.callbacks = callbacks;
    this.marker = scene.textures.exists(Tex.focus)
      ? scene.add.image(cfg.x, cfg.y - 12, Tex.focus).setDepth(Depth.Overlay).setVisible(false).setAlpha(0.8)
      : null;
  }

  get prompt(): string {
    return this.promptText;
  }

  canInteract(ctx: InteractionContext): boolean {
    // Some props are one-shot (a brazier you already lit). Once their flag is set they stop offering a prompt
    // instead of repeating a "nothing happens" message.
    const flag = this.data?.hideWhenFlag;
    return !(typeof flag === 'string' && Boolean(ctx.session.save.flags[flag]));
  }

  interact(ctx: InteractionContext): void {
    this.callbacks.onObject?.(this.id, this.kind, ctx);
  }

  setHighlighted(highlighted: boolean): void {
    this.marker?.setVisible(highlighted);
  }

  destroy(): void {
    this.marker?.destroy();
  }
}
