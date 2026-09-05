# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-09-05
- Primary product surfaces: boot/loading, main menu, village, woods, shrine dungeon, combat, dialogue, HUD, inventory/quest panels, pause/settings, ending.
- Evidence reviewed: `docs/GAME_DESIGN.md`, `docs/ART_DIRECTION.md`, `docs/ARCHITECTURE.md`, `docs/ADR/ADR-003-ui-strategy.md`, `docs/ASSET_LICENSES.md`, `docs/TILED_CONVENTIONS.md`, the original master prompt, current Phaser source, and milestone screenshots under `.playwright-shots/`.

## Brand
- Personality: warm village folklore, restrained melancholy, readable ninja adventure, compact handcrafted charm.
- Trust signals: immediate controls, consistent feedback, short text, visible objectives, stable save/continue, no dead-end interactions.
- Avoid: mixed asset families, smooth/vector UI inside the game, lore dumps, excessive bloom/shake, noisy debug overlays, imitation of a commercial game's characters or maps.

## Product goals
- Goals: deliver a compact browser action-RPG from New Game to the relit shrine and a restorable save; target 15–25 minutes for a first playthrough, subject to playtesting.
- Non-goals: multiplayer, backend, crafting, skill trees, localization, procedural worlds, live service, extra dungeons.
- Success signals: the documented village → woods → shrine → guardian → return loop works without developer commands; a first-time player understands movement, interaction, combat, roll, objectives, rewards, and saving through play.

## Personas and jobs
- Primary personas: desktop browser players who enjoy short pixel-art adventures; keyboard players first, gamepad players second.
- User jobs: start quickly, understand the next meaningful action, survive readable combat, find a secret/reward, finish the story beat, continue after refresh.
- Key contexts of use: Chromium-class desktop browsers in windowed or fullscreen mode, with audio initially locked until input.

## Information architecture
- Primary navigation: Main Menu → New Game/Continue/Settings/Credits; in-game Pause → Resume/Settings/Save & Quit.
- Core screens: loading, menu, HUD, dialogue, inventory, quest log, pause/settings, ending summary.
- Content hierarchy: survival state (HP) → immediate interaction prompt → current objective → reward/toast → optional inventory/quest detail.

## Design principles
- Teach through placement and consequences: Hana introduces interaction, Ryo/dummy introduces attack, slime introduces timing, mushroom introduces roll, the shrine tests mastery.
- One visual language: Ninja Adventure art, 16 px world grid, bitmap text, warm wood panels, restrained pack-native VFX.
- Clarity over quantity: few enemies/items/NPCs, each with a distinct purpose.
- Preserve player momentum: dialogue is short, transitions are fast, errors explain recovery, save points are predictable.
- Tradeoffs: Fill Window adapts the logical view at integer camera zoom for readable combat; optional Fixed View frames 400×225. English-only text preserves the supplied bitmap font and the compact release scope.

## Visual language
- Color: Ninja Adventure palette; amber `#f0b45a` for focus/reward, parchment `#f2ead8` for primary text, muted tan `#9a8f80` for secondary text, deep violet-black `#0b0a12` for shell/backdrops, red `#e05656` for danger.
- Typography: `font8x8.png` bitmap font at 8 px for body/UI and integer multiples for titles; integer positions and restrained letter spacing.
- Spacing/layout rhythm: 4 px micro-grid; 8/12/16 px gaps; panels sized to content and kept off the action center when possible.
- Shape/radius/elevation: pack wood nine-patch panels, 1 px dark outlines, no modern rounded-card styling; actors and tall props y-sort by feet.
- Motion: 80–400 ms feedback, short easing, whole-pixel resting transforms, optional low-amplitude shake, no continuous screen-covering effects.
- Imagery/iconography: curated Ninja Adventure sprites only; visible key icons and item sprites may reinforce, but never replace, text meaning.

## Components
- Existing components to reuse: `NinePanel`, bitmap labels, heart strip, input-key sprites, dialog/choice panels, inventory cells, focus arrows, life bars, map-name banner, toast.
- New/changed components: interaction prompt, objective tracker, dialogue speaker/portrait panel, modal list panel, boss life bar/name plate, ending summary.
- Variants and states: focused/unfocused/disabled menu entries; full/half/empty hearts; active/completed objectives; normal/danger/success toasts; paused/audio-locked states.
- Token/component ownership: colors, depth bands, timings, and internal resolution live in `src/game/config`; reusable UI construction lives under `src/game/ui`; `UIScene` coordinates modal state but does not own persistent game data.

## Accessibility
- Target standard: keyboard-complete play and WCAG-inspired readability within the limits of a canvas game.
- Keyboard/focus behavior: WASD/arrows navigate and move; J/Z/Space attack; K/X/Shift roll; E/Enter interact/confirm; Esc backs out/pauses; all modals expose a visible cursor and deterministic cancel path.
- Contrast/readability: light bitmap text on dark/wood backing; critical messages stay long enough to read; color is reinforced by icons, motion, or text.
- Screen-reader semantics: the outer document names the game canvas and exposes boot/error status; full gameplay remains visual canvas content.
- Reduced motion and sensory considerations: screen shake toggle, conservative flashes, volume controls, pause on focus loss.

## Responsive behavior
- Supported breakpoints/devices: desktop Chromium/Firefox/Edge, laptop through large monitor; keyboard and common gamepads.
- Layout adaptations: DisplaySystem selects integer camera zoom from the actual browser size. Fill Window claims the canvas; Fixed View uses a centered 400×225 view. Layout all surfaces from Display.width/height, including 320×180 on a 1280×720 window. Recalculate on resize/fullscreen.
- Touch/hover differences: touch play is out of scope; no essential hover interaction.

## Interaction states
- Loading: branded title, progress, no raw browser text.
- Empty: inventory and quest panels explain that nothing is available instead of showing blank grids.
- Error: visible boot/runtime fallback with reload guidance; missing save disables Continue.
- Success: toast/VFX/SFX plus updated objective or reward state; final shrine relight leads to a clear ending beat.
- Disabled: visually muted but readable, skipped by keyboard navigation.
- Offline/slow network: static assets only; loading remains on screen until the core pack is ready.

## Content voice
- Tone: brief, warm, lightly humorous, never encyclopedic.
- Terminology: Ember, Kagehara, Whispering Woods, Hollow Shrine, Guardian, quest/objective, shrine key.
- Microcopy rules: one idea per dialogue page, verbs first in objectives, explicit item/reward names, controls shown contextually once.

## Implementation constraints
- Framework/styling system: Phaser 4.2.1 + TypeScript + Vite; Phaser game objects for all in-game UI; HTML/CSS shell only; no React or new UI dependency.
- Design-token constraints: 16×16 tiles, adaptive logical viewport or fixed 400×225, nearest-neighbor filtering, integer zoom/positions at rest, documented depth bands.
- Performance constraints: map-scoped world assets/music, small active enemy counts, bounded particles, no per-frame object churn in hot paths.
- Compatibility constraints: browser audio unlock, focus/visibility handling, captured gameplay keys, static hosting paths, versioned IndexedDB save.
- Test/screenshot expectations: unit coverage for pure game rules, Playwright smoke/full-flow checks, console/resource-error review, and screenshots for menu, village, combat, dialogue, inventory, shrine, boss, and ending.

## Open questions
- [ ] Final tuning of damage, enemy counts, and shop prices remains playtest-owned; it must not expand content scope.
- [ ] Fullscreen may be exposed in Settings only if the browser runtime proves reliable; windowed play is always the baseline.

## Release Candidate presentation contract

- Preserve warm amber highlights, blue/violet shadows, bitmap text and existing wood frames.
- Title: one clear EMBERFALL wordmark, brief subtitle, New Game / Continue / Options / Controls / Credits. Place full control explanations inside Controls, with only a short confirm hint on the title.
- Use existing Ninja Adventure trees, torii, lanterns and fire/spark textures for a quiet title vignette; keep the world assets visually consistent and bounded in cost.
- Continue shows place and level/time; New Game with saved progress offers a cancel-first warning.
- Shared options are consistent in title and pause. Rebinding displays conflicts. All overlays retain a visible keyboard/gamepad focus and Escape fallback.
- Save failures keep the current journey open. Import is validated before replacement confirmation. Credits match docs/ASSET_LICENSES.md.
- Ending shows closure and journey statistics, then allows continued exploration or a saved return to title.
