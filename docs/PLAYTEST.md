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
