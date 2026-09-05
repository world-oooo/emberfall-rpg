import Phaser from 'phaser';
import { Tex } from '../config/assets';
import { Depth } from '../config/constants';
import { gameEvents } from '../core/events';
import type { GameSession } from '../core/session';
import type { Player } from '../entities/player/Player';
import type { InputActions } from '../input/InputActions';
import type { InteractionContext, Interactable } from '../entities/props/Interactable';
import { chooseInteractionTarget } from '../entities/props/targeting';

export interface InteractionSystemConfig {
  session: GameSession;
  targets?: Iterable<Interactable>;
  onInteract?: (target: Interactable, ctx: InteractionContext) => void;
}

export class InteractionSystem {
  private readonly targets: Interactable[] = [];
  private current: Interactable | null = null;
  private readonly prompt: Phaser.GameObjects.Container | null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly input: InputActions,
    private readonly cfg: InteractionSystemConfig,
  ) {
    if (cfg.targets) this.addMany(cfg.targets);
    this.prompt = this.createPrompt();
  }

  add(target: Interactable): void {
    this.targets.push(target);
  }

  addMany(targets: Iterable<Interactable>): void {
    for (const t of targets) this.add(t);
  }

  update(): void {
    const next = this.findNearest();
    if (next !== this.current) {
      this.current?.setHighlighted?.(false);
      next?.setHighlighted?.(true);
      this.current = next;
    }
    this.updatePrompt(next);
    if (next && this.input.pressed('interact')) {
      const ctx = this.context();
      next.interact(ctx);
      this.cfg.onInteract?.(next, ctx);
      gameEvents.emit('objectInteracted', { interactionId: next.id });
      this.current = this.findNearest();
      this.updatePrompt(this.current);
    }
  }

  getActive(): Interactable | null {
    return this.current;
  }

  destroy(): void {
    this.current?.setHighlighted?.(false);
    for (const t of this.targets) t.destroy?.();
    this.targets.length = 0;
    this.prompt?.destroy(true);
    this.current = null;
  }

  private findNearest(): Interactable | null {
    const center = this.player.center;
    return chooseInteractionTarget(this.targets, center, this.player.facingVector, this.context());
  }

  private context(): InteractionContext {
    return {
      scene: this.scene,
      session: this.cfg.session,
      player: { x: this.player.x, y: this.player.y, center: this.player.center },
    };
  }

  private createPrompt(): Phaser.GameObjects.Container | null {
    const icon = this.scene.add.rectangle(0, -13, 22, 12, 0x191621).setOrigin(0.5);
    const label = this.scene.add.bitmapText(0, -13, Tex.font, '', 8).setOrigin(0.5).setTint(0xf2ead8);
    return this.scene.add.container(0, 0, [icon, label]).setDepth(Depth.Overlay).setVisible(false);
  }

  /** Hides the "[E] Talk" label; the world scene calls this whenever it skips update() because control is locked. */
  hidePrompt(): void {
    this.updatePrompt(null);
  }

  private updatePrompt(target: Interactable | null): void {
    if (!this.prompt) return;
    if (!target) {
      this.prompt.setVisible(false);
      return;
    }
    const label = this.prompt.list[1];
    if (label instanceof Phaser.GameObjects.BitmapText) {
      label.setText(`[${this.input.prompt('interact')}] ${target.prompt}`);
      const plate = this.prompt.list[0];
      if (plate instanceof Phaser.GameObjects.Rectangle) plate.setSize(label.width + 8, 14);
    }
    // Above the target by default; below it when that would land in the HUD band at the top of the view,
    // where it collided with the quest tracker.
    // worldView, not scrollY: with an integer camera zoom the visible top of the world is not scrollY.
    const viewTop = this.scene.cameras.main.worldView.y;
    const above = target.y - 20;
    const y = above - viewTop < 46 ? target.y + 12 : above;
    this.prompt.setPosition(Math.round(target.x - 8), Math.round(y));
    this.prompt.setVisible(true);
  }
}
