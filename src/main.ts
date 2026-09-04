import Phaser from 'phaser';
import './style.css';
import { gameConfig } from './game/config/gameConfig';
import { installTestBridge } from './game/debug/TestBridge';
import { Display } from './game/systems/DisplaySystem';
import { SettingsStore } from './game/systems/SettingsStore';

function showFatal(message: string): void {
  const el = document.getElementById('boot-fallback');
  if (!el) return;
  el.classList.add('is-error');
  el.hidden = false;
  const sub = el.querySelector('.boot-sub');
  if (sub) sub.textContent = message;
}

function boot(): void {
  try {
    const game = new Phaser.Game(gameConfig);
    game.events.once(Phaser.Core.Events.READY, () => {
      const fallback = document.getElementById('boot-fallback');
      if (fallback) fallback.hidden = true;
    });
    if (import.meta.env.DEV) installTestBridge(game);
    SettingsStore.load();
    Display.attach(game);
    window.addEventListener('error', (e) => {
      // Surface uncaught errors visibly instead of a silent black canvas (dev only text; production shows a generic line).
      showFatal(import.meta.env.DEV ? String(e.message) : 'Something went wrong. Reload the page.');
    });
  } catch (err) {
    showFatal('Your browser could not start the game (WebGL/Canvas unavailable).');
    console.error(err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
