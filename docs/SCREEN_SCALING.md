# Screen scaling

## The problem

The first build framed a fixed 480×270 canvas and scaled it by an integer factor that had to fit the window.
Three-times zoom needs 810 px of height, so any window shorter than that dropped to 2× — a 960×540 canvas
letterboxed inside a much larger page. Measured before the change:

| Viewport | Canvas CSS | Window used |
|---|---|---|
| 1280×720 | 960×540 | 56.3% |
| 1366×768 | 960×540 | 49.4% |
| 1440×800 | 960×540 | 45.0% |
| 1920×1080 | 1920×1080 | 100% |

The two most common laptop sizes were the worst cases. Nearly half the screen was black.

## The approach

`src/game/systems/DisplaySystem.ts` owns the relationship between window, canvas and camera zoom.

1. Phaser runs in `Scale.RESIZE`, so the canvas always equals the window in CSS pixels. There is no letterbox.
2. The camera zoom is an integer chosen for the current window, so every game pixel is still drawn at an exact
   multiple and nothing shimmers.
3. What varies is how much world is visible, not how large a pixel is. The chooser targets 198 logical pixels
   of height and accepts 300–440 wide by 168–240 tall, which keeps encounters framed consistently.

```ts
for (let zoom = MIN_ZOOM; zoom <= MAX_ZOOM; zoom += 1) {
  const width = canvasWidth / zoom;
  const height = canvasHeight / zoom;
  if (width < MIN_WIDTH || width > MAX_WIDTH || height < MIN_HEIGHT || height > MAX_HEIGHT) continue;
  const score = Math.abs(height - TARGET_HEIGHT);
  if (score < bestScore) { bestScore = score; best = zoom; }
}
```

Scenes never read a fixed constant. They read `Display.width` / `Display.height` and subscribe to
`Display.onChange`, so the HUD re-anchors and the camera re-applies whenever the window changes.

## Zoomed-camera convention

A zoomed Phaser camera keeps `scrollX + camera.width / 2` at the centre of the view, and the visible world is
`camera.width / zoom` wide. Code that treats `scroll` as the top-left corner of the visible area is wrong by
half the difference, which is hundreds of pixels at 4×. `DisplayManager.scrollOffsetX/Y` converts between the
two, and `CameraFollow` targets `subject.x - camera.width / 2` for that reason.

## Display mode

The pause menu exposes two modes, stored in settings and applied live:

- **Fill window** (default) — the canvas covers the window at the best integer zoom.
- **Fixed view** — always frames exactly 400×225 world pixels and letterboxes the remainder, for players who
  want an identical field of view on every machine.

## After

Measured with `npm run test:perf`, which drives the eight viewports and reports what the game actually chose:

| Viewport | Canvas CSS | Zoom | World shown | Window used |
|---|---|---|---|---|
| 1280×720 | 1280×720 | 4× | 320×180 | 100% |
| 1366×768 | 1366×768 | 4× | 341×192 | 100% |
| 1440×800 | 1440×800 | 4× | 360×200 | 100% |
| 1440×900 | 1440×900 | 4× | 360×225 | 100% |
| 1536×864 | 1536×864 | 4× | 384×216 | 100% |
| 1600×900 | 1600×900 | 5× | 320×180 | 100% |
| 1920×1080 | 1920×1080 | 5× | 384×216 | 100% |
| 2560×1440 | 2560×1440 | 7× | 365×205 | 100% |

Every supported window is fully used, the visible world stays within a narrow band, and the zoom is always a
whole number.
