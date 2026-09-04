"""
Derive autotile lookup tables from the pack's "blob" tilesets by sampling pixels.

For each terrain we know the tileset region that holds its blob tiles, one tile that is fully the
inner material ("full") and one tile that is fully the outer material ("plain"). Each tile in the
region is sampled at its 4 edge midpoints, 4 corners and center; a sample is classified as inner (A)
or outer (B) by nearest reference colour. That yields an 8-bit neighbour mask per tile
(bit order N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128, bit set = inner material continues there),
which the map builder uses to paint terrain from a boolean grid.

Output: tools/maps/data/terrains.json
Run:    python tools/assets/analyze-terrains.py
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "vendor" / "ninja-adventure" / "pack" / "Ninja Adventure - Asset Pack" / "Backgrounds" / "Tilesets"
OUT = ROOT / "tools" / "maps" / "data" / "terrains.json"
T = 16

# terrain id -> definition. region = (col0, row0, cols, rows) of the blob block in the tileset.
TERRAINS = {
    # dirt path on grass (main outdoor ground)
    "dirt_on_grass": {"tileset": "TilesetFloor", "region": (0, 7, 10, 5), "full": 181, "plain": 264,
                      "plainVariants": [264, 264, 264, 264, 264, 264, 265, 266, 267, 268]},
    # dark dirt on dark grass (deep woods floor)
    "darkdirt_on_darkgrass": {"tileset": "TilesetFloor", "region": (11, 7, 10, 5), "full": 192, "plain": 275,
                              "plainVariants": [275, 275, 275, 275, 275, 276, 277, 278, 279]},
    # sand on light sand
    "sand_on_lightsand": {"tileset": "TilesetFloor", "region": (0, 0, 10, 5), "full": 27, "plain": 110,
                          "plainVariants": [110, 110, 110, 110, 111, 112, 113, 114]},
    # brown dirt on tan (shrine grounds / dungeon exterior)
    "dirt_on_tan": {"tileset": "TilesetFloor", "region": (11, 14, 10, 5), "full": 345, "plain": 429,
                    "plainVariants": [429, 429, 429, 429, 430, 431, 432, 433]},
    # snow on grey
    "snow_on_grey": {"tileset": "TilesetFloor", "region": (0, 14, 10, 5), "full": 335, "plain": 418,
                     "plainVariants": [418, 418, 418, 419, 420, 421, 422]},
    # water on grass (ponds, streams)
    "water_on_grass": {"tileset": "TilesetWater", "region": (0, 6, 10, 5), "full": 197, "plain": 308,
                       "plainVariants": [308], "mode": "corner"},
    # poison water on brown (shrine swamp)
    "poison_on_brown": {"tileset": "TilesetWater", "region": (13, 6, 10, 5), "full": 210, "plain": 321,
                        "plainVariants": [321], "mode": "corner"},
    # water on sand
    "water_on_sand": {"tileset": "TilesetWater", "region": (0, 0, 10, 5), "full": 29, "plain": 140,
                      "plainVariants": [140], "mode": "corner"},
}

# name -> (x0, y0, x1, y1) patch inside a 16px tile (inclusive), and the mask bit it represents.
# A patch counts as "outer" when the majority of its opaque pixels are closer to the outer colour;
# foam/outline pixels therefore stay with the inner material.
SAMPLES = {
    "N": ((5, 0, 10, 2), 1), "NE": ((13, 0, 15, 2), 2), "E": ((13, 5, 15, 10), 4), "SE": ((13, 13, 15, 15), 8),
    "S": ((5, 13, 10, 15), 16), "SW": ((0, 13, 2, 15), 32), "W": ((0, 5, 2, 10), 64), "NW": ((0, 0, 2, 2), 128),
}


def load(name: str) -> Image.Image:
    return Image.open(PACK / f"{name}.png").convert("RGBA")


def tile_at(img: Image.Image, idx: int) -> Image.Image:
    cols = img.width // T
    x, y = (idx % cols) * T, (idx // cols) * T
    return img.crop((x, y, x + T, y + T))


def avg(tile: Image.Image, cx: int, cy: int, r: int = 1):
    px = tile.load()
    rs = gs = bs = n = 0
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            x, y = min(max(cx + dx, 0), T - 1), min(max(cy + dy, 0), T - 1)
            p = px[x, y]
            if p[3] < 128:
                continue
            rs += p[0]; gs += p[1]; bs += p[2]; n += 1
    if n == 0:
        return None
    return (rs / n, gs / n, bs / n)


def dist(a, b) -> float:
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


def patch_is_inner(tile: Image.Image, box, a_ref, b_ref) -> bool | None:
    """Majority vote over the patch: True = inner material continues here, False = outer, None = transparent."""
    px = tile.load()
    x0, y0, x1, y1 = box
    inner = outer = 0
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            p = px[x, y]
            if p[3] < 128:
                continue
            if dist(p, b_ref) < dist(p, a_ref):
                outer += 1
            else:
                inner += 1
    if inner + outer == 0:
        return None
    return inner >= outer


def region_indices(img: Image.Image, region) -> list[int]:
    cols = img.width // T
    c0, r0, w, h = region
    return [(r0 + r) * cols + (c0 + c) for r in range(h) for c in range(w)]


def analyze(name: str, d: dict) -> dict:
    img = load(d["tileset"])
    idxs = region_indices(img, d["region"])
    tiles = {i: tile_at(img, i) for i in idxs}
    # reference colours
    a_ref = avg(tiles[d["full"]] if d["full"] in tiles else tile_at(img, d["full"]), 8, 8, 2)
    b_ref = avg(tile_at(img, d["plain"]), 8, 8, 2)
    if False:
        # water sets: centre colour = most common centre colour in region (inner), outer = corner colour of the
        # tile whose centre is inner but whose corners differ most from it.
        centers = [avg(t, 8, 8, 2) for t in tiles.values() if avg(t, 8, 8, 2)]
        centers.sort(key=lambda c: (round(c[0] / 8), round(c[1] / 8), round(c[2] / 8)))
        # median-ish centre colour
        a_ref = centers[len(centers) // 2]
        # outer: the corner sample farthest from a_ref across region tiles
        far, b_ref = -1.0, None
        for t in tiles.values():
            for (sx, sy), _ in SAMPLES.values():
                s = avg(t, sx, sy, 1)
                if s is None:
                    continue
                dd = dist(s, a_ref)
                if dd > far:
                    far, b_ref = dd, s
    masks: dict[int, int] = {}
    full_tiles: list[int] = []
    if d.get("mode") == "corner":
        # Dual-grid set: each tile shows the 2x2 corner states around a grid corner point.
        # Bits: NW=1, NE=2, SW=4, SE=8 (bit set = inner material in that quadrant).
        CORNERS = {"NW": ((0, 0, 5, 5), 1), "NE": ((10, 0, 15, 5), 2), "SW": ((0, 10, 5, 15), 4), "SE": ((10, 10, 15, 15), 8)}
        for i, t in tiles.items():
            mask = 0
            opaque = False
            for box, bit in CORNERS.values():
                r = patch_is_inner(t, box, a_ref, b_ref)
                if r is None:
                    continue
                opaque = True
                if r:
                    mask |= bit
            if not opaque:
                continue
            # the centre must agree with the majority of corners to reject decorative ring tiles
            c = patch_is_inner(t, (6, 6, 9, 9), a_ref, b_ref)
            inner_corners = bin(mask).count("1")
            if (inner_corners >= 3 and not c) or (inner_corners <= 1 and c):
                continue
            masks.setdefault(mask, i)
            if mask == 15:
                full_tiles.append(i)
        missing = [m for m in range(16) if m not in masks]
        if missing:
            print(f"  ! {name}: missing corner masks {missing}")
        return {
            "tileset": d["tileset"],
            "mode": "corner",
            "masks": {str(k): v for k, v in sorted(masks.items())},
            "fullVariants": full_tiles[:4],
            "plainVariants": d["plainVariants"],
            "innerColor": [round(x) for x in a_ref],
            "outerColor": [round(x) for x in b_ref],
        }
    for i, t in tiles.items():
        c = avg(t, 8, 8, 1)
        if c is None:
            continue
        # only tiles whose centre is inner material are blob tiles
        if dist(c, a_ref) > dist(c, b_ref):
            continue
        mask = 0
        for box, bit in SAMPLES.values():
            r = patch_is_inner(t, box, a_ref, b_ref)
            if r:
                mask |= bit
        if mask == 255:
            full_tiles.append(i)
        masks.setdefault(mask, i)
    # ensure a full tile exists
    if 255 not in masks and full_tiles:
        masks[255] = full_tiles[0]
    return {
        "tileset": d["tileset"],
        "mode": "edge",
        "masks": {str(k): v for k, v in sorted(masks.items())},
        "fullVariants": full_tiles[:4] or ([masks[255]] if 255 in masks else []),
        "plainVariants": d["plainVariants"],
        "innerColor": [round(x) for x in a_ref],
        "outerColor": [round(x) for x in b_ref],
    }


def main() -> None:
    result = {}
    for name, d in TERRAINS.items():
        r = analyze(name, d)
        result[name] = r
        print(f"{name:24s} tileset={r['tileset']:14s} masks={len(r['masks']):3d} full={r['fullVariants']}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, indent=2))
    print("wrote", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
