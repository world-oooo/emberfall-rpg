"""
Curate runtime assets from the raw Ninja Adventure pack (vendor/, git-ignored) into public/assets/.

- Copies only the files the game uses, under stable names.
- Extrudes tilesets by 1 px (margin 1, spacing 2) so tiles never bleed at 3-4x zoom.
- Transcodes WAV sound effects to OGG + MP3 with ffmpeg.

Dev-time only. Curated output is committed, so contributors do not need this script.
Run: python tools/assets/curate.py
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "vendor" / "ninja-adventure" / "pack" / "Ninja Adventure - Asset Pack"
OUT = ROOT / "public" / "assets"

TILE = 16


def copy(src: str, dst: str) -> None:
    s = PACK / src
    d = OUT / dst
    d.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(s, d)
    print(f"  copy  {dst}")


def extrude_tileset(src: str, dst: str, tile: int = TILE, extrude: int = 1) -> None:
    """Copy each tile into a new sheet with `extrude` px of duplicated edge pixels around it."""
    img = Image.open(PACK / src).convert("RGBA")
    cols = img.width // tile
    rows = img.height // tile
    cell = tile + extrude * 2
    out = Image.new("RGBA", (cols * cell, rows * cell), (0, 0, 0, 0))
    for ty in range(rows):
        for tx in range(cols):
            box = (tx * tile, ty * tile, tx * tile + tile, ty * tile + tile)
            t = img.crop(box)
            ox, oy = tx * cell + extrude, ty * cell + extrude
            out.paste(t, (ox, oy))
            # edges
            out.paste(t.crop((0, 0, tile, 1)).resize((tile, extrude)), (ox, oy - extrude))
            out.paste(t.crop((0, tile - 1, tile, tile)).resize((tile, extrude)), (ox, oy + tile))
            out.paste(t.crop((0, 0, 1, tile)).resize((extrude, tile)), (ox - extrude, oy))
            out.paste(t.crop((tile - 1, 0, tile, tile)).resize((extrude, tile)), (ox + tile, oy))
            # corners
            for (cx, cy, px, py) in (
                (ox - extrude, oy - extrude, 0, 0),
                (ox + tile, oy - extrude, tile - 1, 0),
                (ox - extrude, oy + tile, 0, tile - 1),
                (ox + tile, oy + tile, tile - 1, tile - 1),
            ):
                out.paste(t.crop((px, py, px + 1, py + 1)).resize((extrude, extrude)), (cx, cy))
    d = OUT / dst
    d.parent.mkdir(parents=True, exist_ok=True)
    out.save(d)
    print(f"  tiles {dst}  ({cols}x{rows} tiles, extruded)")


def recolor_white(src: str, dst: str) -> None:
    """Bitmap fonts in the pack are dark; make every opaque pixel white so tints work (tint = multiply)."""
    img = Image.open(PACK / src).convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            px[x, y] = (255, 255, 255, a)
    d = OUT / dst
    d.parent.mkdir(parents=True, exist_ok=True)
    img.save(d)
    print(f"  font  {dst} (recolored white)")


def npc_walk_sheet(folder: str, dst: str) -> None:
    """64x64 walk sheet: columns = down/up/left/right, rows = 4 walk frames (row 0 doubles as the idle pose).
    Simple characters only ship a 64x32 sheet (stand + step); expand it to stand/step/stand/step."""
    walk = PACK / "Actor" / "Character" / folder / "SeparateAnim" / "Walk.png"
    if walk.exists():
        copy(f"Actor/Character/{folder}/SeparateAnim/Walk.png", dst)
        return
    sheet = Image.open(PACK / "Actor" / "Character" / folder / "SpriteSheet.png").convert("RGBA")
    if sheet.size != (64, 32):
        raise RuntimeError(f"unexpected sheet size for {folder}: {sheet.size}")
    out = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    stand = sheet.crop((0, 0, 64, 16))
    step = sheet.crop((0, 16, 64, 32))
    for row, src in enumerate((stand, step, stand, step)):
        out.paste(src, (0, row * 16))
    d = OUT / dst
    d.parent.mkdir(parents=True, exist_ok=True)
    out.save(d)
    print(f"  sheet {dst} (expanded from 64x32)")


def transcode_music(src: str, dst: str) -> None:
    """Re-encode looping music to ~112 kbps stereo.

    The pack ships 195-260 kbps tracks; at 16 MB total they dominated both the download and the decode time
    on every area transition. Quality 3 is transparent for this material and cuts the set by about 60%.
    """
    s = PACK / src
    d = OUT / dst
    d.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(s), "-c:a", "libvorbis", "-q:a", "3", "-ar", "44100", str(d)]
    subprocess.run(cmd, check=True)
    print(f"  music {dst} ({d.stat().st_size // 1024} KB)")


def transcode(src: str, dst_base: str) -> None:
    """WAV -> OGG (primary) + MP3 (fallback)."""
    s = PACK / src
    for ext, args in (("ogg", ["-c:a", "libvorbis", "-q:a", "4"]), ("mp3", ["-c:a", "libmp3lame", "-q:a", "5"])):
        d = OUT / f"{dst_base}.{ext}"
        d.parent.mkdir(parents=True, exist_ok=True)
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(s), "-ac", "1", "-ar", "44100", *args, str(d)]
        subprocess.run(cmd, check=True)
    print(f"  audio {dst_base}.(ogg|mp3)")


def main() -> int:
    if not PACK.exists():
        print(f"pack not found: {PACK}", file=sys.stderr)
        return 1
    if shutil.which("ffmpeg") is None:
        print("ffmpeg not found on PATH", file=sys.stderr)
        return 1

    print("characters")
    hero = "Actor/CharacterAnimated/NinjaGreen/Separate/"
    for name in ("Idle", "Walk", "Attack", "Roll", "Hit", "Dead", "Item", "Pickup", "Jump"):
        copy(hero + f"{name}.png", f"characters/hero/{name.lower()}.png")
    copy("Actor/CharacterAnimated/Weapon/Katana.png", "characters/hero/weapon_katana.png")
    copy("Actor/Character/Shadow.png", "characters/shadow.png")
    copy("Actor/Character/NinjaGreen/Faceset.png", "characters/hero/faceset.png")

    npcs = {
        "elder_hana": "OldWoman",
        "master_ryo": "Master",
        "merchant_botan": "Villager2",
        "child_mimi": "Child",
        "guard_goro": "Samurai",
        "hermit_sen": "OldMan",
        "villager_woman": "Woman",
        "villager_man": "Villager",
    }
    for key, folder in npcs.items():
        npc_walk_sheet(folder, f"characters/npcs/{key}.png")
        copy(f"Actor/Character/{folder}/Faceset.png", f"characters/npcs/{key}_face.png")

    print("enemies")
    copy("Actor/Monster/Slime/Slime.png", "enemies/slime.png")
    copy("Actor/Monster/Mushroom/mushroom.png", "enemies/mushroom.png")
    copy("Actor/Monster/BlueBat/SpriteSheet.png", "enemies/bat.png")
    copy("Actor/Character/Skeleton/SpriteSheet.png", "enemies/skeleton.png")
    copy("Actor/Character/Skeleton/SeparateAnim/Attack.png", "enemies/skeleton_attack.png")
    for name in ("Idle", "Charge", "Attack", "Jump"):
        copy(f"Actor/Boss/GiantRacoon/{name}.png", f"enemies/boss_racoon_{name.lower()}.png")
    copy("Actor/Boss/GiantRacoon/Faceset.png", "enemies/boss_racoon_face.png")

    print("tilesets")
    for name in ("TilesetFloor", "TilesetFloorDetail", "TilesetNature", "TilesetHouse", "TilesetWater",
                 "TilesetRelief", "TilesetReliefDetail", "TilesetElement", "TilesetLogic", "TilesetDungeon",
                 "TilesetVillageAbandoned", "TilesetField"):
        extrude_tileset(f"Backgrounds/Tilesets/{name}.png", f"tiles/{name}.png")
    for name in ("TilesetInterior", "TilesetInteriorFloor", "TilesetWallSimple", "Elements"):
        extrude_tileset(f"Backgrounds/Tilesets/Interior/{name}.png", f"tiles/{name}.png")
    copy("Backgrounds/Animated/Waterfall/MiddleSheet16x16.png", "tiles/anim/waterfall_middle.png")
    copy("Backgrounds/Animated/Waterfall/BottomSheet16x16.png", "tiles/anim/waterfall_bottom.png")
    copy("Backgrounds/Animated/Waterfall/TopSheet16x16.png", "tiles/anim/waterfall_top.png")
    copy("Backgrounds/Animated/Water Ripples/SpriteSheet16x16.png", "tiles/anim/water_ripples.png")
    copy("Backgrounds/Animated/Flower/SpriteSheet16x16.png", "tiles/anim/flower.png")

    print("items")
    items = {
        "katana": "Weapons/Katana/Sprite.png",
        "heavy_blade": "Weapons/BigSword/Sprite.png",
        "shuriken": "Projectile/Shuriken.png",
        "rice_ball": "Food/Onigiri.png",
        "life_potion": "Potion/LifePot.png",
        "heart": "Potion/Heart.png",
        "gold_coin": "Treasure/GoldCoin.png",
        "gold_key": "Treasure/GoldKey.png",
        "scroll_fire": "Scroll/ScrollFire.png",
        "gem_red": "Resource/GemRed.png",
        "gem_green": "Resource/GemGreen.png",
        "letter": "Other/Letter.png",
        "money_bag": "Object/MoneyBag.png",
        "chest_small": "Treasure/LittleTreasureChest.png",
        "chest_big": "Treasure/BigTreasureChest.png",
        "coin_anim": "Treasure/Coin2.png",
    }
    for key, path in items.items():
        copy(f"Items/{path}", f"items/{key}.png")

    print("fx")
    fx = {
        "slash_arc": "Slash/SpriteSheetArc.png",
        "slash_01": "Slash/SpriteSheetSlash01.png",
        "slash_03": "Slash/SpriteSheetSlash03.png",
        "slash_circular": "Slash/SpriteSheetCircular.png",
        "spark": "Magic/Spark/SpriteSheet.png",
        "circle_spark": "Magic/Circle/SpriteSheetSpark.png",
        "smoke": "Smoke/Smoke/SpriteSheet.png",
        "smoke_circular": "Smoke/SmokeCircular/SpriteSheet.png",
        "explosion": "Elemental/Explosion/SpriteSheet.png",
        "aura": "Magic/Aura/SpriteSheet.png",
        "boost": "Magic/Boost/SpriteSheet.png",
        "spirit": "Magic/Spirit/SpriteSheet.png",
        "plant": "Elemental/Plant/SpriteSheet.png",
        "rock_spike": "Elemental/RockSpike/SpriteSheet.png",
        "proj_shuriken": "Projectile/Shuriken.png",
        "proj_energy": "Projectile/EnergyBall.png",
        "proj_plant": "Projectile/PlantSpike.png",
        "particle_leaf": "Particle/Leaf.png",
        "particle_spark": "Particle/Spark.png",
        "particle_rock": "Particle/Rock.png",
        "particle_grass": "Particle/Grass.png",
        "particle_fire": "Particle/Fire.png",
        "particle_wood": "Particle/Wood.png",
        "fog": "Environment/Fog.png",
        "raylight": "Environment/Raylight.png",
    }
    for key, path in fx.items():
        copy(f"FX/{path}", f"vfx/{key}.png")

    print("ui")
    ui = {
        "dialog_box": "Dialog/DialogBox.png",
        "dialog_faceset_box": "Dialog/FacesetBox.png",
        "choice_box": "Dialog/ChoiceBox.png",
        "dialog_info": "Dialog/DialogInfo.png",
        "hearts": "Receptacle/Heart.png",
        "icon_heart": "Receptacle/IconHeart.png",
        "lifebar_under": "Receptacle/LifeBarMiniUnder.png",
        "lifebar_progress": "Receptacle/LifeBarMiniProgress.png",
        "panel": "Theme/Theme Wood/nine_path_panel.png",
        "panel_2": "Theme/Theme Wood/nine_path_panel_2.png",
        "panel_3": "Theme/Theme Wood/nine_path_panel_3.png",
        "panel_interior": "Theme/Theme Wood/nine_path_panel_interior.png",
        "panel_bg": "Theme/Theme Wood/nine_path_bg.png",
        "panel_bg_2": "Theme/Theme Wood/nine_path_bg_2.png",
        "focus": "Theme/Theme Wood/nine_path_focus.png",
        "inventory_cell": "Theme/Theme Wood/inventory_cell.png",
        "button": "Theme/Theme Wood/button_normal.png",
        "button_hover": "Theme/Theme Wood/button_hover.png",
        "button_pressed": "Theme/Theme Wood/button_pressed.png",
        "arrow_left": "Theme/Theme Wood/arrow_left.png",
        "arrow_right": "Theme/Theme Wood/arrow_right.png",
        "checked": "Theme/Theme Wood/checked.png",
        "unchecked": "Theme/Theme Wood/unchecked.png",
        "slider_progress": "Theme/Theme Wood/slider_progress.png",
        "slider_grabber": "Theme/Theme Wood/h_slidder_grabber.png",
        "arrow": "Arrow.png",
        "emote_exclaim": "Emote/emote1.png",
        "emote_question": "Emote/emote2.png",
        "key_e": "Input/Keyboard/KeyE.png",
        "key_space": "Input/Keyboard/KeySpace.png",
        "key_shift": "Input/Keyboard/KeyShift.png",
        "icon_sword": "Skill Icon/Items & Weapon/Sword.png",
        "icon_armor": "Skill Icon/Items & Weapon/Armor.png",
        "icon_amulet": "Skill Icon/Items & Weapon/Amulet.png",
    }
    for key, path in ui.items():
        src = PACK / "Ui" / path
        if not src.exists():
            print(f"  skip  ui/{key} (missing {path})")
            continue
        copy(f"Ui/{path}", f"ui/{key}.png")
    recolor_white("Ui/Font/font8x8.png", "fonts/font8x8.png")
    copy("Ui/Font/NormalFont.ttf", "fonts/NormalFont.ttf")

    print("music")
    music = {
        "title": "38 - Intro.ogg",
        "village": "33 - Calm Village.ogg",
        "woods": "37 - Dark Forest.ogg",
        "shrine": "40 - Crypt.ogg",
        "boss": "34  - Fight.ogg",
        "victory": "15 - Credit Theme.ogg",
    }
    for key, name in music.items():
        transcode_music(f"Audio/Musics/{name}", f"audio/music/{key}.ogg")

    print("sfx")
    sfx = {
        "attack_swing": "Sounds/Whoosh & Slash/Slash.wav",
        "attack_swing2": "Sounds/Whoosh & Slash/Slash2.wav",
        "attack_swing3": "Sounds/Whoosh & Slash/Sword2.wav",
        "hit": "Sounds/Hit & Impact/Hit1.wav",
        "hit2": "Sounds/Hit & Impact/Hit3.wav",
        "hit_heavy": "Sounds/Hit & Impact/Impact2.wav",
        "player_hurt": "Sounds/Voice/Voice4.wav",
        "enemy_death": "Sounds/Elemental/Explosion3.wav",
        "roll": "Sounds/Whoosh & Slash/Whoosh.wav",
        "throw": "Sounds/Whoosh & Slash/Launch.wav",
        "pickup": "Sounds/Bonus/Bonus3.wav",
        "coin": "Sounds/Bonus/Coin.wav",
        "heal": "Sounds/Magic & Skill/Heal.wav",
        "level_up": "Jingles/LevelUp1.wav",
        "quest_complete": "Jingles/Success2.wav",
        "secret": "Jingles/Secret1.wav",
        "game_over": "Jingles/GameOver2.wav",
        "chest_open": "Sounds/Bonus/Bonus2.wav",
        "door": "Sounds/Menu/Menu8.wav",
        "menu_move": "Sounds/Menu/Move2.wav",
        "menu_accept": "Sounds/Menu/Accept4.wav",
        "menu_cancel": "Sounds/Menu/Cancel2.wav",
        "dialogue_blip": "Sounds/Menu/Move6.wav",
        "alert": "Sounds/Alert/Alert2.wav",
        "boss_roar": "Sounds/Alert/Alert5.wav",
        "slam": "Sounds/Hit & Impact/Impact5.wav",
        "spore": "Sounds/Elemental/Bubble2.wav",
        "bat": "Sounds/Creature/Wings.wav",
        "bone": "Sounds/Hit & Impact/Hit7.wav",
        "fire_light": "Sounds/Elemental/Fire.wav",
        "magic": "Sounds/Magic & Skill/Magic1.wav",
    }
    for key, path in sfx.items():
        transcode(f"Audio/{path}", f"audio/sfx/{key}")

    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
