"""Render a zoomed, index-labelled crop of a tileset region for reading tile ids.
Usage: python tools/assets/tile-crop.py <TilesetName> <col0> <row0> <cols> <rows> [scale] [out.png]
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "vendor" / "ninja-adventure" / "pack" / "Ninja Adventure - Asset Pack" / "Backgrounds" / "Tilesets"
T = 16


def main() -> None:
    name, c0, r0, cols, rows = sys.argv[1], *map(int, sys.argv[2:6])
    scale = int(sys.argv[6]) if len(sys.argv) > 6 else 5
    out = Path(sys.argv[7]) if len(sys.argv) > 7 else ROOT / "vendor" / f"crop_{name}_{c0}_{r0}.png"
    path = PACK / f"{name}.png"
    if not path.exists():
        path = PACK / "Interior" / f"{name}.png"
    img = Image.open(path).convert("RGBA")
    tcols = img.width // T
    crop = img.crop((c0 * T, r0 * T, (c0 + cols) * T, (r0 + rows) * T))
    big = crop.resize((crop.width * scale, crop.height * scale), Image.NEAREST)
    bg = Image.new("RGBA", big.size, (48, 48, 58, 255))
    bg.alpha_composite(big)
    d = ImageDraw.Draw(bg)
    for ty in range(rows):
        for tx in range(cols):
            x, y = tx * T * scale, ty * T * scale
            d.rectangle([x, y, x + T * scale - 1, y + T * scale - 1], outline=(255, 0, 255, 110))
            idx = (r0 + ty) * tcols + (c0 + tx)
            d.text((x + 2, y + 2), str(idx), fill=(0, 0, 0, 255))
            d.text((x + 1, y + 1), str(idx), fill=(255, 255, 0, 255))
    out.parent.mkdir(parents=True, exist_ok=True)
    bg.save(out)
    print(out)


if __name__ == "__main__":
    main()
