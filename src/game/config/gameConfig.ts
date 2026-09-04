import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';
import { CAPTURED_KEYS } from '../input/InputActions';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { WorldScene } from '../scenes/WorldScene';
import { UIScene } from '../scenes/UIScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  title: 'Emberfall',
  version: __APP_VERSION__,
  banner: false,
  backgroundColor: '#0b0a12',
  pixelArt: true, // antialias off + roundPixels on
  disableContextMenu: true,
  scale: {
    // NONE + MAX_ZOOM = the largest integer zoom that fits the window: every game pixel is a whole number of
    // screen pixels. FIT would stretch to a fractional scale and shimmer. Re-evaluated on resize (see main.ts).
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    zoom: Phaser.Scale.MAX_ZOOM,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
      tileBias: 16,
    },
  },
  input: {
    keyboard: { capture: CAPTURED_KEYS },
    gamepad: true,
    mouse: true,
    touch: false,
  },
  audio: {
    disableWebAudio: false,
  },
  scene: [BootScene, PreloadScene, MainMenuScene, WorldScene, UIScene],
};
