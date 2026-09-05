# Emberfall measurements

Generated 2026-09-05T05:59:53.683Z

## Viewport matrix

| Viewport | Canvas CSS | Zoom | World shown | Window used |
|---|---|---|---|---|
| 1280x720 | 1280x720 | 4x | 320x180 | 100% |
| 1366x768 | 1366x768 | 4x | 341x192 | 100% |
| 1440x800 | 1440x800 | 4x | 360x200 | 100% |
| 1440x900 | 1440x900 | 4x | 360x225 | 100% |
| 1536x864 | 1536x864 | 4x | 384x216 | 100% |
| 1600x900 | 1600x900 | 5x | 320x180 | 100% |
| 1920x1080 | 1920x1080 | 5x | 384x216 | 100% |
| 2560x1440 | 2560x1440 | 7x | 365x205 | 100% |

## Frame time (1920x1080, software WebGL)

| Scene | Avg ms | p95 | p99 | Max | Frames > 33 ms |
|---|---|---|---|---|---|
| Main menu | 19.38 | 25.8 | 146.2 | 161.3 | 8 |
| Village idle | 17.61 | 23 | 25.2 | 37.1 | 1 |
| Village walking | 20.02 | 22.4 | 26.3 | 30.9 | 0 |
| Woods idle | 19.83 | 24.9 | 26.6 | 27.7 | 0 |
| Shrine idle | 18.14 | 21.4 | 23.7 | 35.1 | 2 |

## Map transitions

| Transition | Cold ms | Warm ms |
|---|---|---|
| village to woods | 1136 | 234 |
| woods to village | 233 | - |
| woods to shrine | 1248 | - |
| shrine to woods | - | 226 |

## Other

- Input latency (keydown to first movement): 44 ms
- JS heap: 78 MB

