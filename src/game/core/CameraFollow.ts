import Phaser from 'phaser';
import { Feel } from '../config/constants';

/**
 * Delta-time based, integer-snapped camera follow.
 * Phaser's built-in lerp follow is framerate dependent and disables pixel rounding (see RESEARCH.md);
 * this keeps the camera bounded, smooth and pixel-exact.
 */
export class CameraFollow {
  private readonly target = new Phaser.Math.Vector2();
  private readonly pos = new Phaser.Math.Vector2();
  private snapNext = true;
  private lookAhead = new Phaser.Math.Vector2();

  constructor(
    private readonly cam: Phaser.Cameras.Scene2D.Camera,
    private readonly subject: { x: number; y: number },
  ) {}

  /** Jump to the subject immediately (map load, respawn). */
  snap(): void {
    this.snapNext = true;
  }

  setLookAhead(x: number, y: number): void {
    this.lookAhead.set(x, y);
  }

  update(delta: number): void {
    const cam = this.cam;
    this.target.set(
      this.subject.x - cam.width / 2 + this.lookAhead.x,
      this.subject.y - cam.height / 2 + this.lookAhead.y,
    );
    if (this.snapNext) {
      this.pos.copy(this.target);
      this.snapNext = false;
    } else {
      // exponential smoothing, framerate independent
      const k = 1 - Math.exp((-Feel.cameraLerpPerSecond * delta) / 1000);
      this.pos.x += (this.target.x - this.pos.x) * k;
      this.pos.y += (this.target.y - this.pos.y) * k;
      // finish tiny remainders so the camera settles on whole pixels
      if (Math.abs(this.target.x - this.pos.x) < 0.5) this.pos.x = this.target.x;
      if (Math.abs(this.target.y - this.pos.y) < 0.5) this.pos.y = this.target.y;
    }
    let sx = Math.round(this.pos.x);
    let sy = Math.round(this.pos.y);
    const b = cam.getBounds();
    if (cam.useBounds) {
      sx = Phaser.Math.Clamp(sx, b.x, Math.max(b.x, b.right - cam.width));
      sy = Phaser.Math.Clamp(sy, b.y, Math.max(b.y, b.bottom - cam.height));
    }
    cam.setScroll(sx, sy);
  }
}
