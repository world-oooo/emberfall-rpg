import Phaser from 'phaser';

/**
 * A soft dark plate used behind HUD text so it stays readable over bright grass and pale shrine floors.
 * Drawn as a rounded rectangle rather than a nine-slice so it can be any size without stretching artefacts.
 */
export class Plate extends Phaser.GameObjects.Graphics {
  constructor(
    scene: Phaser.Scene,
    private width_: number,
    private height_: number,
    private readonly opts: { radius?: number; fill?: number; alpha?: number; stroke?: number; strokeAlpha?: number } = {},
  ) {
    super(scene);
    scene.add.existing(this);
    this.redraw();
  }

  resize(width: number, height: number): this {
    this.width_ = width;
    this.height_ = height;
    this.redraw();
    return this;
  }

  private redraw(): void {
    const { radius = 3, fill = 0x120f17, alpha = 0.72, stroke, strokeAlpha = 0.5 } = this.opts;
    this.clear();
    this.fillStyle(fill, alpha);
    this.fillRoundedRect(0, 0, this.width_, this.height_, radius);
    if (stroke !== undefined) {
      this.lineStyle(1, stroke, strokeAlpha);
      this.strokeRoundedRect(0.5, 0.5, this.width_ - 1, this.height_ - 1, radius);
    }
  }
}
