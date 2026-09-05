# Tasks

## Done

- M0 — Environment audit, Phaser research, asset curation, CC0 license verification, concept and art direction.
- M1 — Player movement, animation, camera and input actions.
- M2 — Village, woods and shrine maps with collision, layering, spawns and transitions.
- M3 — Melee and ranged combat, health, hitboxes, knockback, hit feedback and VFX.
- M4 — Slime, spore cap, bat, skeleton and Mask Keeper encounters.
- M5 — NPC dialogue, signs, chests, doors, shrine and contextual interaction prompts.
- M6 — Inventory, consumables, equipment, XP/levels, quests, quest log and shop.
- M7 — Shrine key/lock, boss arena, Ember reward, return journey and ending.
- M8 — Versioned IndexedDB save/load, autosave, Continue and serialized transition saves.
- M9 — HUD, pause/settings, audio mix, panels, portraits, boss bar, toasts and ending presentation.
- M10 — Responsive canvas, focus-safe input, keyboard capture and WebGL startup handling.
- M11 — Unit tests, Playwright browser tests, screenshot review and map validation.
- M12 — Complete acceptance playthrough, production build and player documentation.
- M13 — Deep polish audit: fill-window display system, combat timing aligned to animation, owned hitstop
  controller, dedicated boss controller with two phases, redesigned HUD and menus, rebuilt shrine interior.
- M14 — World content and QA: real village shrine with an ending that lights it, hidden grove, brazier puzzle
  and keepers' vault, shrine shortcut, post-ending dialogue, scripted screenshot and measurement passes.
- M15 — Release-candidate shell: title vignette, Continue metadata, New Game warning, shared pause/options
  surface, eleven-action keyboard rebinding, gamepad prompts, Save & Quit, validated save import/export,
  fullscreen toggle, credits and production smoke-test command.
- M16 — Release verification: GitHub CI (check, build, Chromium E2E, production smoke on every push; three-engine
  matrix nightly), seven release-surface E2E tests, the Mimi side quest end to end, a boss fight measured with
  real attacks and rebalanced on the result, and documentation synced to the code.

## Later

- Korean localization.
- PWA/offline caching.
- Second dungeon: the Samurai Crypt.

## Known limitations

- One environmental puzzle in the whole game (the shrine braziers).
- Boss balance was measured with a mashing bot, not with human playtesters; the design target of 90–150 s for
  a careful player is an estimate from that floor.
- The controls menu rebinds keyboard actions only; gamepad bindings use the built-in prompt/action layout.
- Save import/export is local JSON only; there is no cloud account or backend sync.
