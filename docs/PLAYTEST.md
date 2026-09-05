# Playtest notes

Notes from driving the finished build end to end, at 1280×720 and 1920×1080, in Chromium.

## Route and pacing

The intended route is Elder Hana → Master Ryo → south gate → Whispering Woods → four slimes → shrine entrance
→ brazier puzzle → key room → sealed stair → Mask Keeper → Ember → back to Hana → relight the village shrine.
A player who explores the optional content runs about 15–20 minutes; a direct run is closer to 12.

## What reads well

- **The first thirty seconds.** The canvas fills the window, the village is dense enough to look inhabited,
  and the objective is legible in the corner without opening a menu.
- **The three-hit combo.** Each swing resolves inside its animation, the third hit is heavier and lunges
  further, and the hitstop on a connect gives the katana weight.
- **The arena.** Walking through the opened seal locks the camera, wakes the Keeper and swaps the music in one
  beat. It reads as an event rather than as another corridor.
- **The ending.** Lighting the village shrine changes the world, not just an overlay: the pedestal burns, the
  hill glows, embers drift, and every villager has a new line.

## Rough edges worth knowing

- **The brazier puzzle is easy to miss.** The sign in the entrance hall is the only hint, and a player who
  runs straight up the stair will never learn the vault exists. That is deliberate for a secret, but it means
  most players will finish without the heavy blade.
- **Mashing the boss was a strategy.** A bot that walked in and swung killed the 42 HP Keeper in 4.4 s while
  taking two hits, a quarter of that during the wake roar. The intro is now invulnerable, cuts into a wind-up
  or charge do half damage, three cuts taken while it drifts trigger a counter, and it has 140 HP; the same bot
  now needs 21.7 s and eats 13 hits, which a player cannot survive. See PERFORMANCE.md for the table.
- **The shortcut arrives late.** It is barred from the arena side, so its value is one walk back. It pays off
  for a player who dies to the boss and returns, and does very little otherwise.
- **Regular enemies are readable but not deep.** Each archetype moves differently and at most two commit to
  an attack at once, but none of them has a second attack; variety before the boss comes from placement.
- **The Keeper's charge is the hardest attack to read** at 4× zoom on a small window, because the telegraph
  rectangle can start off screen. It is fair at 5× and above.

## Hands-on pass after the release candidate

Played through the captures screen by screen as a player would, and fixed what read badly:

- **A blank pause after the loading bar.** MainMenuScene loaded its own title track (~800 KB) and two
  tilesets after the bar had already read 100%, on an empty screen: 214 ms locally, about five seconds on a
  1.5 Mbps connection, and it looked like a hang. Those assets now load under the bar; the title appears the
  frame loading completes. See PERFORMANCE.md.
- **Options scrolled with room to spare.** Ten rows at a 16 px pitch could never fit the 184 px panel on a
  768-tall screen, yet the panel showed dead space. Rows are 13 px and the panel uses the screen height; all
  ten rows fit at 720p, 768p and 1080p with no page indicator.
- **Nothing said left/right adjusts a value.** The selected adjustable row now shows its value between the
  two arrow sprites. A text hint in the header was tried first and collided with the title at 1366×768.
- **Toasts covered the hero.** "Quest complete" landed on the hero entering the shrine from the south, and the
  boss's phase message landed where the player dodges. Toasts now anchor at the top, under whichever of the
  HUD row, area banner or boss bar is showing.
- **The "[E] Talk" prompt stayed up during the dialogue it opened**, and near the top of the view it collided
  with the quest tracker. It hides while control is locked and flips below its target in the HUD band.
- **Panel headers spoke in bare key names** ("Up Down E Escape") while the release menu said "E SELECT
  ESC BACK". Inventory, shop and quest log now use the same key-plus-verb language, and the release menu's
  BACK label comes from the real Pause binding rather than a hard-coded "ESC".
- **A keydown without a `code`** (some IMEs, virtual keyboards, remote desktops) was invisible to the input
  layer. It now falls back to `key`, then `keyCode`.
- **The quest log and the shop drew rows at a fixed pitch**, so an objective or description that wrapped to a
  second line was overwritten by the next row ("D0/1eat 4 forest slimes", "Hits from afar." over "Life
  Potion"), and "BOTAN STALL" ran into its header hint. Rows now advance by what they draw, objective
  counters sit right-aligned on the first line, panel hints are just "Escape BACK" with an explicit "E BUY"
  beside the shop's coin count, and both panels are tall enough for their content at 720p. These two screens,
  plus the game-over card, were never in the capture baseline before; they are now.
- **The first level-up was silent.** A level earned from an enemy kill got a toast and a sound; one earned from
  a quest reward got neither, and the quest's own toast would have replaced it anyway because toasts
  replaced each other. The first level a real player earns is the Dimmed Shrine reward, so that was the one
  with no fanfare. Toasts now queue (capped at three), and one celebration — sound, burst at the hero, toast —
  serves both paths, landing a beat after "Quest complete". Fixed View (letterboxed) was also captured and
  checked at 1366×768.
- **The world kept running while the pause menu was open.** Pausing only locked the hero: a slime next to
  them walked 21 px and bit them (6 → 5 hearts) with the menu up, and the same held for dialogue, the shop
  and the quest log — reading the shrine sign beside the skeletons was a free hit. Now, while any UI owns
  the screen, enemy AI, hitboxes and Arcade physics all hold; map transitions and the boss intro never use
  this path. Tests pause next to a slime and mid-boss-fight and check nothing moves, no damage lands, and
  everything resumes. The boss now reports its real state machine to the DEV bridge, which had shown "idle"
  even while it charged. The fix nearly shipped its own bug: Phaser restarts a scene on the same instance,
  so the pause flag survived the game-over restart and every enemy stood frozen after a respawn. A test that
  dies to the Keeper and returns for a fresh fight caught it.

The in-app browser pane used for the first attempt reports `document.hidden`, so Chromium throttles it and
Phaser pauses; that environment is unusable for judging feel, and the pass was done from Playwright captures.

## Slow machines and input

Input edges are taken from the browser's own `keydown` event, once per press, and queued one-per-frame. On a
machine that renders two or three frames a second (a GPU-less CI runner, or a heavily loaded laptop) two taps
in one frame still register as two, and one tap never registers as two — an earlier build walked menu cursors
two rows per press there. `E2E_CPU_THROTTLE=6 npm run test:e2e` reproduces that environment.

## Release candidate additions

- **Controls.** Title and pause both open the same Options, Controls, Save Data and Credits pages. Rebinding
  refuses a key another action owns and always leaves Escape and Enter working; the menus were driven through
  all of this by the release tests, including a reload with a rebound key.
- **Save management.** Save & Quit writes before it leaves; export downloads `emberfall-save.json`; import
  validates every field before the confirmation appears, and a broken file leaves the slot untouched.
- **Ending.** The card shows level, coins and time and offers Continue Exploring or Return to Title, which
  saves the restored world first.
- **Mimi's charm.** The side quest now pays 30 XP, 15 coins and a Life Potion; the charm itself stays with the
  player, which is what Mimi says.
- **Heavy Blade.** 80 coins in the shop, so a thorough player can afford it before the shrine instead of
  finding it priced out of reach; the keepers' vault still gives one away.

## Difficulty

Starting at 6 HP with a 2-damage katana, the woods are forgiving; the shrine's skeletons punish standing
still. The Guardian's Charm from the shrine entrance takes the player to 8 HP before the boss, and the boss
does 1 per hit with a real punish window after each attack, and 140 health means the fight is won in those
windows, not by trading. A careful player wins first try; a careless one
dies once and retries from the shrine entrance with the seal and braziers already handled.

## Settings that matter

- **Display mode.** "Fill window" is the default and the better experience. "Fixed view" exists for players
  who want an identical field of view and do not mind letterboxing.
- **Screen shake.** On by default. The boss fight is noticeably calmer with it off, and nothing depends on it.

## Verified end to end

Menu → New Game → Hana → Ryo → woods → four slimes → shrine → braziers → vault → key → seal → arena → Mask
Keeper → Ember → woods → village → Hana → relight → save → reload → Continue, with the restored shrine still
burning and every world flag intact. No console errors at any point.
