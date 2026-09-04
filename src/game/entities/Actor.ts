import Phaser from 'phaser';
import { Depth } from '../config/constants';
import { Tex } from '../config/assets';

export interface ActorOptions {
  texture: string;
  frame?: number;
  /** physics body size/offset in frame pixels */
  body: { width: number; height: number; offsetX: number; offsetY: number };
  shadow?: boolean;
  shadowOffsetY?: number;
}

/**
 * Base for anything that walks: a physics sprite, a shadow, and y-sorted depth.
 * Health/hit reactions are composed on top by combat components.
 */
export class Actor {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly shadow: Phaser.GameObjects.Image | null;
  private lastDepthY = Number.NaN;
  private readonly shadowOffsetY: number;

  constructor(
    readonly scene: Phaser.Scene,
    x: number,
    y: number,
    opts: ActorOptions,
  ) {
    this.sprite = scene.physics.add.sprite(x, y, opts.texture, opts.frame ?? 0);
    this.body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.body.setSize(opts.body.width, opts.body.height);
    this.body.setOffset(opts.body.offsetX, opts.body.offsetY);
    this.body.setCollideWorldBounds(true);
    this.shadowOffsetY = opts.shadowOffsetY ?? 0;
    this.shadow = opts.shadow === false ? null : scene.add.image(x, y, Tex.shadow).setAlpha(0.55).setDepth(Depth.Shadow);
    this.syncDepth(true);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  /** World y of the feet (bottom of the physics body). Used for depth sorting and interaction ranges. */
  get feetY(): number {
    return this.body.bottom;
  }

  get center(): Phaser.Math.Vector2 {
    return this.body.center;
  }

  setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.body.reset(x, y);
    this.syncDepth(true);
  }

  /** Call every frame after physics: keeps depth = feet y and the shadow under the feet. */
  syncDepth(force = false): void {
    const fy = this.feetY;
    if (force || fy !== this.lastDepthY) {
      this.sprite.setDepth(Depth.ActorBase + fy);
      this.lastDepthY = fy;
    }
    if (this.shadow) {
      this.shadow.setPosition(Math.round(this.body.center.x), Math.round(fy + this.shadowOffsetY));
    }
  }

  destroy(): void {
    this.shadow?.destroy();
    this.sprite.destroy();
  }
}
