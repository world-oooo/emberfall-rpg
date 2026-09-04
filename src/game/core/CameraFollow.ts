import Phaser from 'phaser';
import { Feel } from '../config/constants';

/**
 * Delta-time based, integer-snapped camera follow with easing look-ahead.
 *
 * Phaser's built-in lerp follow is framerate dependent and clears pixel rounding (see RESEARCH.md), so the
 * camera position is integrated here instead. Scroll is rounded to whole world pixels every frame; with an
 * integer camera zoom that puts every sprite on an exact screen-pixel boundary.
 */
export class CameraFollow {
  private readonly target = new Phaser.Math.Vector2();
  private readonly pos = new Phaser.Math.Vector2();
  private readonly lookAhead = new Phaser.Math.Vector2();
  private readonly lookAheadGoal = new Phaser.Math.Vector2();
  private snapNext = true;
  private lookAheadDistance = 0;
  private lerpRate: number = Feel.cameraLerpPerSecond;

  constructor(
    private readonly cam: Phaser.Cameras.Scene2D.Camera,
    private readonly subject: { x: number; y: number },
  ) {}

  /** Jump to the subject immediately (map load, respawn). */
  snap(): void {
    this.snapNext = true;
  }

  setLerpRate(rate: number): void {
    this.lerpRate = rate;
  }

  /**
   * How far the camera leads the player, in world pixels. Applied through its own slow smoothing so a
   * direction change never snaps the view.
   */
  setLookAheadDistance(distance: number): void {
    this.lookAheadDistance = distance;
  }

  /** Direction the player is heading, normalised; zero when standing still. */
  setLookAheadDirection(x: number, y: number): void {
    this.lookAheadGoal.set(x * this.lookAheadDistance, y * this.lookAheadDistance * 0.7);
  }

  update(delta: number): void {
    const cam = this.cam;
    // A zoomed Phaser camera centres on `scroll + viewportSize / 2` and shows `viewportSize / zoom` of world,
    // so the scroll value and the visible rectangle differ by this offset.
    const viewWidth = cam.width / cam.zoomX;
    const viewHeight = cam.height / cam.zoomY;
    const offsetX = (cam.width - viewWidth) / 2;
    const offsetY = (cam.height - viewHeight) / 2;

    const lookK = 1 - Math.exp((-Feel.cameraLookAheadPerSecond * delta) / 1000);
    this.lookAhead.x += (this.lookAheadGoal.x - this.lookAhead.x) * lookK;
    this.lookAhead.y += (this.lookAheadGoal.y - this.lookAhead.y) * lookK;

    // Target scroll places the subject at the centre of the visible rectangle.
    this.target.set(
      this.subject.x - cam.width / 2 + this.lookAhead.x,
      this.subject.y - cam.height / 2 + this.lookAhead.y,
    );

    if (this.snapNext) {
      this.pos.copy(this.target);
      this.lookAhead.copy(this.lookAheadGoal);
      this.snapNext = false;
    } else {
      const k = 1 - Math.exp((-this.lerpRate * delta) / 1000);
      this.pos.x += (this.target.x - this.pos.x) * k;
      this.pos.y += (this.target.y - this.pos.y) * k;
      // Settle the last fraction so the camera comes to rest on a whole pixel instead of creeping.
      if (Math.abs(this.target.x - this.pos.x) < 0.35) this.pos.x = this.target.x;
      if (Math.abs(this.target.y - this.pos.y) < 0.35) this.pos.y = this.target.y;
    }

    let sx = this.pos.x;
    let sy = this.pos.y;
    if (cam.useBounds) {
      const b = cam.getBounds();
      // Clamp what the player actually sees, then convert back to a scroll value.
      const minX = b.x - offsetX;
      const maxX = b.right - viewWidth - offsetX;
      const minY = b.y - offsetY;
      const maxY = b.bottom - viewHeight - offsetY;
      sx = b.width <= viewWidth ? b.centerX - cam.width / 2 : Phaser.Math.Clamp(sx, minX, maxX);
      sy = b.height <= viewHeight ? b.centerY - cam.height / 2 : Phaser.Math.Clamp(sy, minY, maxY);
    }
    // Round the visible top-left, not the raw scroll, so every world pixel lands on an exact screen pixel.
    cam.setScroll(Math.round(sx + offsetX) - offsetX, Math.round(sy + offsetY) - offsetY);
  }
}
