# Asset Licenses

Every external asset used by Emberfall is listed here. Nothing is added to `public/assets`
without an entry in this file. Raw packs live in `vendor/` (git-ignored); only curated,
renamed copies are committed.

Rule of thumb: CC0 first. If a license cannot be verified on the creator's official page,
the asset is not used.

---

## Ninja Adventure - Asset Pack

- **Asset Name:** Ninja Adventure - Asset Pack (characters, monsters, bosses, tilesets, items, FX, UI, fonts, music, SFX)
- **Creator:** Pixel-Boy and AAA
- **Original Source:** https://pixel-boy.itch.io/ninja-adventure-asset-pack (file: `Ninja Adventure - Asset Pack.zip`, 89 MB, 2,674 files)
- **Local Path:** raw pack in `vendor/ninja-adventure/` (ignored); curated copies under `public/assets/**`
- **License:** Creative Commons Zero v1.0 Universal (CC0 1.0)
- **License Reference:** `LICENSE.txt` inside the pack (full CC0 1.0 text); pack `README.md`:
  "They are released under the Creative Commons Zero (CC0) license. You can use any and all of the
  assets found in this package in your own games, even commercial ones. Attribution is not required
  but appreciated."; itch.io page metadata: "Asset license: Creative Commons Zero v1.0 Universal".
- **Commercial Use:** Yes
- **Modification:** Yes (we crop, re-pack, recolor and transcode)
- **Attribution:** Not required. We credit Pixel-Boy and AAA in the in-game credits and README anyway.
- **Redistribution:** Yes (CC0). Curated copies are committed to this repository.
- **Date Verified:** 2026-09-04 (fetched the itch.io page and the pack's own LICENSE.txt)
- **Notes:** Audio in the pack is WAV/OGG; SFX are transcoded to OGG (and MP3 fallback) for the web.
  Music files are used as-is (OGG). Font `NormalFont.ttf` and bitmap fonts `font8x8.png` / `font24x30.png`
  are part of the same CC0 pack.

---

## Fonts

(Only the pack's own CC0 fonts are used for now. If a Latin/Korean pixel font is added later it
gets its own entry with license and URL.)

---

## Generated / Original

- Everything under `public/assets/generated/` (placeholder shapes, particle textures, palette-consistent
  edits) is created for this project and released under the project license.
