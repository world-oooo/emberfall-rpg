"""
Render a generated Tiled JSON map to a PNG so level layout and tile choices can be reviewed without
launching the game. Layers are composited in the order Phaser draws them.

Usage:
  python tools/maps/render-map.py shrine [out.png] [--scale 1] [--region x y w h]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MAPS = ROOT / "public" / "assets" / "maps"
TILES = ROOT / "public" / "assets" / "tiles"

DRAW_ORDER = ["Ground", "Water", "GroundDetail", "BelowPlayer", "AbovePlayer", "Foreground"]


def load_tilesets(data: dict) -> list[dict]:
    out = []
    for ts in data["tilesets"]:
        image = Image.open(TILES / f"{ts['name']}.png").convert("RGBA")
        out.append({
            "firstgid": ts["firstgid"],
            "count": ts["tilecount"],
            "columns": ts["columns"],
            "margin": ts.get("margin", 0),
            "spacing": ts.get("spacing", 0),
            "tw": ts["tilewidth"],
            "th": ts["tileheight"],
            "image": image,
            "name": ts["name"],
        })
    return sorted(out, key=lambda t: t["firstgid"])


def tile_image(tilesets: list[dict], gid: int) -> Image.Image | None:
    gid &= 0x0FFFFFFF
    if gid == 0:
        return None
    chosen = None
    for ts in tilesets:
        if gid >= ts["firstgid"]:
            chosen = ts
    if chosen is None:
        return None
    local = gid - chosen["firstgid"]
    if local >= chosen["count"]:
        return None
    col = local % chosen["columns"]
    row = local // chosen["columns"]
    x = chosen["margin"] + col * (chosen["tw"] + chosen["spacing"])
    y = chosen["margin"] + row * (chosen["th"] + chosen["spacing"])
    return chosen["image"].crop((x, y, x + chosen["tw"], y + chosen["th"]))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("map")
    parser.add_argument("out", nargs="?")
    parser.add_argument("--scale", type=int, default=1)
    parser.add_argument("--region", nargs=4, type=int, metavar=("X", "Y", "W", "H"))
    parser.add_argument("--collision", action="store_true", help="tint solid cells")
    args = parser.parse_args()

    data = json.loads((MAPS / f"{args.map}.json").read_text())
    tilesets = load_tilesets(data)
    tw, th = data["tilewidth"], data["tileheight"]
    mw, mh = data["width"], data["height"]
    x0, y0, w, h = args.region if args.region else (0, 0, mw, mh)

    canvas = Image.new("RGBA", (w * tw, h * th), (12, 10, 18, 255))
    layers = {layer["name"]: layer for layer in data["layers"] if layer["type"] == "tilelayer"}

    for name in DRAW_ORDER:
        layer = layers.get(name)
        if layer is None or not layer.get("visible", True):
            continue
        ox = int(layer.get("offsetx", 0))
        oy = int(layer.get("offsety", 0))
        for ty in range(y0 - 1, y0 + h + 1):
            for tx in range(x0 - 1, x0 + w + 1):
                if not (0 <= tx < mw and 0 <= ty < mh):
                    continue
                gid = layer["data"][ty * mw + tx]
                image = tile_image(tilesets, gid)
                if image is None:
                    continue
                canvas.alpha_composite(image, ((tx - x0) * tw + ox, (ty - y0) * th + oy))

    if args.collision and "Collision" in layers:
        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        red = Image.new("RGBA", (tw, th), (255, 0, 90, 80))
        collision = layers["Collision"]
        for ty in range(y0, y0 + h):
            for tx in range(x0, x0 + w):
                if 0 <= tx < mw and 0 <= ty < mh and collision["data"][ty * mw + tx] != 0:
                    overlay.alpha_composite(red, ((tx - x0) * tw, (ty - y0) * th))
        canvas.alpha_composite(overlay)

    if args.scale != 1:
        canvas = canvas.resize((canvas.width * args.scale, canvas.height * args.scale), Image.NEAREST)
    out = Path(args.out) if args.out else ROOT / "artifacts" / "maps" / f"{args.map}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)
    print(out)


if __name__ == "__main__":
    main()
