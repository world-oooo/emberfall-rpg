import Phaser from 'phaser';
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
    // The canvas always matches the window; DisplaySystem picks an integer camera zoom for it. That keeps every
    // game pixel a whole number of screen pixels while using the entire window, instead of scaling a fixed
    // 480x270 canvas which fell back to 2x (under half the window) on any screen shorter than 810 px.
    mode: Phaser.Scale.RESIZE,
    width: '100%',
    height: '100%',
    parent: 'game-container',
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
