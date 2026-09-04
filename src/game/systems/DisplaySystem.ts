import Phaser from 'phaser';
import { SettingsStore } from './SettingsStore';

export type DisplayMode = 'fill' | 'fixed';

export interface DisplayLayout {
  /** integer camera zoom applied to world and UI cameras */
  zoom: number;
  /** logical width in game pixels visible on screen */
  width: number;
  /** logical height in game pixels visible on screen */
  height: number;
  /** canvas pixel size (equals the window in fill mode) */
  canvasWidth: number;
  canvasHeight: number;
  mode: DisplayMode;
}

/** Design targets: the view should stay close to this much world, whatever the window is. */
const TARGET_HEIGHT = 198;
const MIN_WIDTH = 300;
const MAX_WIDTH = 440;
const MIN_HEIGHT = 168;
const MAX_HEIGHT = 240;
const MIN_ZOOM = 2;
const MAX_ZOOM = 8;

/** Fixed mode always frames exactly this much world, letterboxed. */
export const FIXED_WIDTH = 400;
export const FIXED_HEIGHT = 225;

/**
 * Chooses the integer camera zoom for the current window.
 *
 * The canvas always matches the window (Scale.RESIZE), and every game pixel is drawn at an exact integer
 * multiple, so pixels stay sharp while the window is fully used. Compare with the previous approach, which
 * scaled a fixed 480x270 canvas and fell back to 2x — under half the window — on any screen below 810 px tall.
 */
function chooseZoom(canvasWidth: number, canvasHeight: number): number {
  let best = MIN_ZOOM;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let zoom = MIN_ZOOM; zoom <= MAX_ZOOM; zoom += 1) {
    const width = canvasWidth / zoom;
    const height = canvasHeight / zoom;
    if (width < MIN_WIDTH || width > MAX_WIDTH || height < MIN_HEIGHT || height > MAX_HEIGHT) continue;
    const score = Math.abs(height - TARGET_HEIGHT);
    if (score < bestScore) {
      bestScore = score;
      best = zoom;
    }
  }
  if (bestScore === Number.POSITIVE_INFINITY) {
    // Window outside every comfortable band (very small or very wide): keep the view as close as possible.
    best = Phaser.Math.Clamp(Math.round(canvasHeight / TARGET_HEIGHT), MIN_ZOOM, MAX_ZOOM);
  }
  return best;
}

type Listener = (layout: DisplayLayout) => void;

/**
 * Owns the relationship between the browser window, the canvas and the camera zoom.
 * Scenes read `layout` for their logical size and subscribe to changes instead of using fixed constants.
 */
class DisplayManager {
  private game: Phaser.Game | null = null;
  private readonly listeners = new Set<Listener>();
  private current: DisplayLayout = {
    zoom: 4,
    width: FIXED_WIDTH,
    height: FIXED_HEIGHT,
    canvasWidth: FIXED_WIDTH * 4,
    canvasHeight: FIXED_HEIGHT * 4,
    mode: 'fill',
  };

  get layout(): DisplayLayout {
    return this.current;
  }

  get width(): number {
    return this.current.width;
  }

  get height(): number {
    return this.current.height;
  }

  get zoom(): number {
    return this.current.zoom;
  }

  attach(game: Phaser.Game): void {
    this.game = game;
    this.refresh();
    game.scale.on(Phaser.Scale.Events.RESIZE, () => this.refresh());
  }

  setMode(mode: DisplayMode): void {
    SettingsStore.set({ displayMode: mode });
    this.refresh();
  }

  toggleMode(): DisplayMode {
    const next: DisplayMode = SettingsStore.get().displayMode === 'fill' ? 'fixed' : 'fill';
    this.setMode(next);
    return next;
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Recompute from the current canvas size and notify scenes if anything changed. */
  refresh(): void {
    const game = this.game;
    if (!game) return;
    const canvasWidth = Math.max(1, Math.floor(game.scale.gameSize.width));
    const canvasHeight = Math.max(1, Math.floor(game.scale.gameSize.height));
    const mode = SettingsStore.get().displayMode;

    let zoom: number;
    let width: number;
    let height: number;
    if (mode === 'fixed') {
      zoom = Phaser.Math.Clamp(Math.floor(Math.min(canvasWidth / FIXED_WIDTH, canvasHeight / FIXED_HEIGHT)), 1, MAX_ZOOM);
      width = FIXED_WIDTH;
      height = FIXED_HEIGHT;
    } else {
      zoom = chooseZoom(canvasWidth, canvasHeight);
      // Whole logical pixels only, so UI anchored to the right/bottom edge lands on the pixel grid.
      width = Math.floor(canvasWidth / zoom);
      height = Math.floor(canvasHeight / zoom);
    }

    const next: DisplayLayout = { zoom, width, height, canvasWidth, canvasHeight, mode };
    const changed =
      next.zoom !== this.current.zoom ||
      next.width !== this.current.width ||
      next.height !== this.current.height ||
      next.canvasWidth !== this.current.canvasWidth ||
      next.canvasHeight !== this.current.canvasHeight ||
      next.mode !== this.current.mode;
    this.current = next;
    if (changed) for (const listener of this.listeners) listener(next);
  }

  /**
   * Point a scene camera at the logical viewport: integer zoom, centred, and (in fixed mode) letterboxed
   * to an exact multiple so no partial pixels are ever drawn.
   *
   * `scrollToOrigin` puts logical (0, 0) at the top-left of the viewport. A zoomed Phaser camera keeps
   * `scroll + viewportSize / 2` at the centre of the view, not `scroll` at its corner, so UI-style cameras
   * need this offset or everything lands off-screen.
   */
  applyToCamera(camera: Phaser.Cameras.Scene2D.Camera, scrollToOrigin = true): void {
    const { zoom, width, height, canvasWidth, canvasHeight } = this.current;
    const viewWidth = Math.min(canvasWidth, width * zoom);
    const viewHeight = Math.min(canvasHeight, height * zoom);
    const offsetX = Math.floor((canvasWidth - viewWidth) / 2);
    const offsetY = Math.floor((canvasHeight - viewHeight) / 2);
    camera.setViewport(offsetX, offsetY, viewWidth, viewHeight);
    camera.setZoom(zoom);
    camera.setRoundPixels(true);
    if (scrollToOrigin) camera.setScroll(-DisplayManager.scrollOffsetX(camera), -DisplayManager.scrollOffsetY(camera));
  }

  /** Horizontal gap between the camera's scroll value and the left edge of what it actually shows. */
  static scrollOffsetX(camera: Phaser.Cameras.Scene2D.Camera): number {
    return (camera.width - camera.width / camera.zoomX) / 2;
  }

  static scrollOffsetY(camera: Phaser.Cameras.Scene2D.Camera): number {
    return (camera.height - camera.height / camera.zoomY) / 2;
  }
}

export const Display = new DisplayManager();
