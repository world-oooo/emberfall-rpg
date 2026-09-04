# Testing

Emberfall uses three complementary gates.

## Automated checks

- `npm run check` runs strict TypeScript checking, unit tests and generated-map validation.
- `npm run build` creates the production bundle and catches missing or incorrectly referenced runtime assets.
- `npm run test:e2e` drives the real Phaser WebGL canvas in Chromium and fails on page errors or unexpected console errors.

The browser suite covers menu boot, New Game, movement, village-to-woods transition, enemy spawning, dialogue and quest start, melee combat, chest loot, shuriken combat, inventory healing, pause settings, death/retry, the full two-quest story, boss defeat, ending save, reload and Continue.

## Visual acceptance

Review the main menu, HUD, dialogue, inventory, quest log, shop, boss arena, death screen and ending at the 480×270 internal resolution and at a larger browser size. Pixel art should remain crisp, text should stay inside panels, and the current objective should be readable without opening a menu.

## Development test bridge

Development builds expose `window.__GAME_TEST__` to Playwright for deterministic inspection and positioning. It is gated by `import.meta.env.DEV` and is absent from production builds. The helpers shorten the long story test; separate tests still exercise real movement, interaction, melee, ranged attacks and menu input.

## Manual release smoke test

1. Start New Game and speak with Elder Hana and Master Ryo.
2. Reach the woods, fight a slime, open a chest and use a rice ball.
3. Enter the shrine, collect the key, pass the seal and defeat the Guardian.
4. Take the Ember, return to Hana and relight the shrine.
5. Refresh the page, choose Continue and confirm the restored-shrine state remains saved.
