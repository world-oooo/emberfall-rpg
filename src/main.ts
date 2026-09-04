import Phaser from 'phaser';
import './style.css';
import { gameConfig } from './game/config/gameConfig';
import { installTestBridge } from './game/debug/TestBridge';

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
    // NONE + MAX_ZOOM only evaluates the zoom at boot; re-apply the largest integer zoom whenever the window changes.
    let resizeTimer = 0;
    const applyZoom = () => game.scale.setMaxZoom();
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(applyZoom, 80);
    });
    game.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, applyZoom);
    game.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, applyZoom);
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
