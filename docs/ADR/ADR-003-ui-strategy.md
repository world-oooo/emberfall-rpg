# ADR-003: UI inside the Phaser canvas, bitmap font, no React

**Date:** 2026-09-05 · **Status:** accepted

## Decision
- All game UI (HUD, dialogue, inventory, quest log, pause, settings, menus) is drawn in a parallel `UIScene` with
  Phaser game objects: nine-patch panels from the pack's Theme Wood, `BitmapText` using the pack's `font8x8.png`
  (parsed with `RetroFont`, ASCII from space, 15 glyphs per row).
- HTML/CSS is only the shell: dark vignette background, boot fallback, error screen, `<noscript>`.
- No React, no rexUI. A small widget set (`NinePanel`, `Label`, `Hearts`, `ListMenu` with keyboard/gamepad focus) is enough
  for this slice and keeps one authoritative state (the session) with no DOM mirror.

## Why bitmap text
Canvas `Text` is antialiased and re-uploads a texture on every change; at 480×270 internal resolution it blurs.
`BitmapText` is crisp at integer scale and cheap for damage numbers/HUD.

## Revisit when
A settings screen or localization (Korean) needs proportional Unicode text → generate a bitmap font atlas from an OFL/CC0
pixel font (e.g. Galmuri) with a tool script, still no DOM UI.
