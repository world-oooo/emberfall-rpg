# Release Candidate Audit

Current HEAD at start: `a9582b6`, plus an uncommitted release pass by a previous agent (26 modified files,
11 new) that did not compile and had never been verified at runtime. Everything below was re-verified on the
repaired tree.
Date: 2026-09-05
Version: 1.0.0-rc.1
Environment: Windows 11, Node 24.15.0, npm 11.12.1 (engines >= 22.12.0; CI runs Node 22).

## Automated Gates

| Gate | Result |
|---|---|
| TypeScript | Pass (three errors in the inherited pass fixed: two unchecked lookups in `SaveSystem`, one in the smoke spec) |
| Unit | Pass, 35 tests in 7 files |
| Map validation | Pass, village / woods / shrine, reachability through seal gates |
| Build | Pass, 153 kB game JS (46.7 kB gzip), 1.37 MB Phaser |
| Chromium E2E | Pass, 24 tests on the dev server (15 game, 7 release surface, 2 gamepad), green under a 6x CPU throttle |
| Production preview | Pass: `vite preview` of the build, canvas drawn, `window.__GAME_TEST__` absent, no failed requests, no console errors, walk village → woods, reload, Continue, walk back |
| WebKit | Completion run at 1366×768, 1440×900 and 1920×1080 (see Browser) |
| Firefox | Completion run at 1366×768, 1440×900 and 1920×1080 (see Browser) |
| CI | `.github/workflows/ci.yml`: check, build, Chromium E2E and production smoke on every push and PR; three-engine matrix nightly and on demand; Playwright report and traces uploaded on failure |

`npm ci` could not complete locally because the running Vite dev servers hold `esbuild.exe` open on Windows;
`npm install` repaired the tree and CI performs the clean install on Ubuntu.

## UX

Keyboard: verified. The whole game completes on keyboard alone in the acceptance matrix; every menu is driven
by keyboard in the release tests.
Gamepad: verified with a synthetic standard-mapping pad injected over navigator.getGamepads (Phaser polls it
every frame). Tests cover D-pad title navigation, A to confirm Continue, left-stick movement in the world,
Menu to open pause, D-pad through the pause rows, and the active-device flip to gamepad; glyph mapping
(A/B/X/Y vs keyboard) is unit-tested. Real controller hardware is still not exercised in this environment,
but the full input path from a standard pad is.
Rebinding: verified. Eleven actions, conflict refused with the owning action named, reserved browser keys
refused, Escape always pauses/cancels and Enter always confirms, bindings persist outside the save and survive
a reload; the rebound key was exercised in play.
Fullscreen: verified for the fallback path in headless Chromium: the stored preference matches
`document.fullscreenElement` and the display stays sane whether or not the browser grants it. The granted
path was not exercised by a browser that allows it.
Save: verified. Save & Quit writes before leaving and Continue resumes the same position and coins; the
ending's Return to Title saves the restored world.
Import/Export: verified. Export downloads `emberfall-save.json`; a modified copy imports after a cancel-first
confirmation and is what Continue loads; a broken file is refused before touching the slot.
Credits: verified. Opens from the title, returns to a working menu, attribution matches ASSET_LICENSES.md.

## Content

Main quest: verified end to end, including save, reload and Continue.
Side quest: verified through the real systems. Mimi → grove chest → Fox Charm → return → rewarded (30 XP,
15 coins, Life Potion; the charm stays), state kept across a reload. The previous reward re-granted the
charm the player already held, which was a no-op against a one-per-stack accessory.
Secret: hidden grove chest verified.
Puzzle: four braziers open the keepers' vault, verified.
Shortcut: keepers' passage unbars from the arena side, verified.
Boss: measured with real attacks, then rebalanced. A mashing, constantly healed bot killed the original 42 HP
Keeper in 4.4 s taking two hits, a quarter of that during the invulnerable-looking wake roar. Now: the intro
is invulnerable, cuts into a wind-up or charge do half damage, three cuts taken while it drifts trigger a
counter, a player in swipe range is answered twice as fast, and it has 140 HP. The same bot needs 21.7 s and
takes 13 hits, more than a player's health. Careful play is estimated at 80–120 s; not human-playtested here.
Ending: verified. Card with level, coins and time; Continue Exploring or Return to Title.

## Browser

Chromium: full matrix 3/3, production smoke, default suite 22/22.
WebKit: full matrix 3/3.
Firefox: full matrix 3/3 after the save-queue fix (0/3 before it; browser installed for this pass).

Matrix results are recorded in the Verification record below.

## Release Blockers

P0: none open. Fixed after the first CI run went red on the clean Ubuntu checkout: on a GPU-less runner the
game renders two or three frames per second, and Phaser's ANY_KEY_DOWN re-emits one physical keypress once per
Key registered to that code — binding both `down` and `menuDown` to ArrowDown made a single tap walk a menu
cursor two rows, so a reload's Down+Enter landed on Options instead of Continue and no world loaded. Edges now
come from the DOM keydown (delivered exactly once, `event.repeat` filtered) rather than Phaser's event, and
presses queue one-per-frame so nothing collapses when a frame lasts 300 ms. Verified locally under a 6x CPU
throttle (`E2E_CPU_THROTTLE=6`), 0/10 on the reload→Continue repro and the whole suite green. Also fixed: every
door softlocked in Firefox, because each save awaited
`navigator.storage.persist()`, which Firefox answers with a permission prompt that never settles headlessly
and blocks until answered otherwise, and the door transition waits on the save queue (found by the
three-engine matrix, reproduced by walking into a door in Firefox, fixed by requesting persistence once and
never awaiting it); the inherited tree did not compile; New Game silently dropped an Enter that
arrived before the save slot finished reading (four E2E tests hung on it); the production smoke wedged on the
torii and held a key before the world scene existed.

P1: none open. Fixed this pass: boss trivialised by mashing; side-quest reward was a no-op; Heavy Blade priced
out of reach at 120 (now 80); Controls page printed raw key codes and wrapped a row onto the next; the ending
card re-armed a 400 ms input lockout on every cursor move.

P2: real controller hardware and the granted-fullscreen path not exercised here (the synthetic-pad path is); boss balance estimate rests on a bot
floor rather than human playtesting; the title's main-menu frame spikes under the software rasteriser are the
one-time rebuild after the save slot loads and were not re-measured on hardware.

## Verification record

Recorded from the runs on this date.

- First CI run (clean Ubuntu, no GPU): 5 E2E failures from the frame-rate/input bug above; fixed and re-verified under a local 6x CPU throttle.
- Default suite: 22/22 on one worker (an earlier two-worker run dropped a menu press under CPU load; the
  tests now press until the browser event arrives and the config pins one worker).
- Production smoke: pass, 17 s.
- Measurement pass: 100% window use at all eight viewports; software-rasteriser frame times in `PERFORMANCE.md`;
  cold transitions 1.1–1.2 s, warm 0.23 s; input latency 44 ms.
- Boss bot: 21.7 s at 140 HP, 48 hits landed, 13 taken.
- Completion matrix, first run: Chromium 3/3, WebKit 3/3, Firefox 0/3 with every run stuck on the first door.
- Completion matrix after the persistence fix: Firefox 3/3 (1366×768, 1440×900, 1920×1080); Chromium 3/3 and
  WebKit 3/3 unchanged from the first run; Firefox walks through the first door in about one second.
