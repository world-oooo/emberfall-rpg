# ADR-001: Phaser 4 (direct) instead of RPGJS / Grid Engine

**Date:** 2026-09-05 · **Status:** accepted

## Context
The master prompt allows Phaser 4, RPGJS v5, or Grid Engine as the base. The game is a single-player, real-time,
free-movement action RPG with custom combat feel (hitstop, knockback, i-frames, telegraphs).

## Decision
Build directly on **Phaser 4.2.1** (npm `latest`, released 2026-07-09) with Arcade Physics. No RPGJS, no Grid Engine.

## Reasons
- RPGJS is an event-driven, server-authoritative JRPG framework (tile movement, server-side maps). Its abstractions fight
  free-movement action combat and add a client/server split this offline game does not need.
- Grid Engine is for tile-by-tile movement (Pokémon-like). Our movement is continuous 8-direction.
- Phaser 4 ships everything needed (tilemaps, arcade physics, animations, cameras, tweens, particles, audio, scale manager)
  plus official agent skills (vendored under `.claude/skills/phaser-*`) and typed `phaser.d.ts` in-package.
- Known v4 caveats we design around: TilemapGPULayer bugs (#7331, #7317) → CPU layers; camera lerp is framerate-dependent
  (#7352) and `startFollow` resets `roundPixels` → custom integer-snapped follow; avoid angle tweens on moving objects (#7341).

## Consequences
We own the RPG layer (inventory, quests, dialogue, save). That is the point: it stays small, data-driven and testable.
