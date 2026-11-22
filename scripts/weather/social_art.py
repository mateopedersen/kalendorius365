"""Build the compact atlas and the verified city photo cards used by Pages."""
from base64 import b64encode
import json
import zlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
OUT = SITE / "assets/visuals/weather-share"
WIDTH, HEIGHT = 1200, 630
PAPER = "#102d3b"
GOLD = "#f4d88c"
WHITE = "#f7fbf9"
MUTED = "#b1d0d1"


def font(size, bold=False):
    return ImageFont.truetype(str(SITE / f"assets/fonts/Lato-{'Bold' if bold else 'Regular'}.ttf"), size)


def point(lon, lat):
    return round(773 + (lon - 20.6) * 62), round(148 + (56.55 - lat) * 108)


def weather_mark(draw, ink, gold):
    draw.ellipse((65, 62, 97, 94), fill=gold)
    draw.arc((53, 75, 79, 102), 160, 290, fill=ink, width=4)
    draw.arc((68, 77, 98, 102), 210, 350, fill=ink, width=4)
    draw.arc((87, 82, 111, 103), 240, 97, fill=ink, width=4)
    draw.line((59, 102, 100, 102), fill=ink, width=4)


def atlas():
    # Reserved palette blocks provide antialiased glyphs for each ink.
    colors = [PAPER]
    for color in (WHITE, GOLD, MUTED):
        a = tuple(bytes.fromhex(PAPER[1:]))
        b = tuple(bytes.fromhex(color[1:]))
        colors.extend(tuple(round(x + (y-x)*n/8) for x,y in zip(a,b)) for n in range(1,9))
    colors += ["#164050", "#1d5060", "#35636a", "#67a39a", "#233f49", "#d88648"]
    for n in range(45):
        colors.append((16+n//3, 45+n//2, 59+n//2))
    palette = bytes(channel for color in colors for channel in (bytes.fromhex(color[1:]) if isinstance(color, str) else color))
    base = Image.new("P", (WIDTH, HEIGHT))
    base.putpalette(palette + bytes(768-len(palette)))
    d = ImageDraw.Draw(base)
    for x in range(725, WIDTH):
        d.line((x, 0, x, HEIGHT), fill=31+min(44,(x-725)//11))
    d.rounded_rectangle((735, 67, 1150, 543), 29, fill=25, outline=26, width=2)
    for x in range(758, 1139, 42):
        d.line((x, 118, x, 487), fill=26)
    for y in range(118, 490, 42):
        d.line((754, y, 1132, y), fill=26)
    data = json.loads((ROOT / "data/lithuania-social-map.json").read_text())
    for polygon in data["coordinates"]:
        for index, ring in enumerate(polygon):
            d.polygon([point(*coords) for coords in ring], fill=27 if index == 0 else 25, outline=28, width=2)
    weather_mark(d, 8, 16)
    d.text((126, 67), "KALENDORIUS365", font=font(24, True), fill=16)
    d.text((61, 174), "ORŲ PROGNOZĖ", font=font(26, True), fill=16)
    d.line((62, 488, 650, 488), fill=26, width=2)
    d.text((62, 515), "Valandomis  /  iki 15 dienų", font=font(30), fill=8)
    d.text((62, 567), "kalendorius365.lt", font=font(21), fill=24)
    d.text((758, 89), "LIETUVA", font=font(23, True), fill=8)
    d.text((758, 502), "Žemėlapis · Natural Earth", font=font(19), fill=24)
    raw = base.tobytes()
    scanlines = b"".join(b"\x00" + raw[y:y+WIDTH] for y in range(0, len(raw), WIDTH))
    OUT.joinpath("atlas-v1.bin").write_bytes(zlib.compress(scanlines, 9))

    registry = json.loads((SITE / "assets/data/weather-places.json").read_text())
    text = "".join(row[1] for row in registry["places"])
    alphabet = set(text) | set(chr(code) for code in range(32,127)) | set("ĄąČčĘęĖėĮįŠšŲųŪūŽž·°–′ …")
    glyphs = {}
    for size in (30, 54, 68):
        face = font(size, True)
        block = {}
        for char in sorted(alphabet):
            mask = face.getmask(char, mode="L")
            width, height = mask.size
            left, top, _, _ = face.getbbox(char)
            # Four-bit text would add color bands to the file. Store only covered spans.
            pixels = bytes((value+16)//32 if value < 240 else 8 for value in bytes(mask))
            block[char] = [round(face.getlength(char)), left, top, width, height, b64encode(pixels).decode("ascii")]
        glyphs[size] = block
    OUT.joinpath("atlas-v1.json").write_text(json.dumps({
        "palette": list(palette), "glyphs": glyphs,
    }, ensure_ascii=False, separators=(",", ":")) + "\n")


def city_cards():
    registry = json.loads((SITE / "assets/data/weather-places.json").read_text())
    cities = {row[0]: row for row in registry["places"]}
    sources = json.loads((SITE / "_data/weather_city_images.json").read_text())
    for slug, photo in sources.items():
        if slug not in cities:
            continue
        place = cities[slug]
        im = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
        with Image.open(SITE / photo["src"].lstrip("/")) as original:
            art = ImageOps.fit(original.convert("RGB"), (618, 570), Image.Resampling.LANCZOS)
            mask = Image.new("L", art.size)
            ImageDraw.Draw(mask).rounded_rectangle((0, 0, 617, 569), 30, fill=255)
            im.paste(art, (551,30), mask)
        d = ImageDraw.Draw(im)
        weather_mark(d, WHITE, GOLD)
        d.text((126, 67), "KALENDORIUS365", font=font(24, True), fill=GOLD)
        d.text((62, 188), "ORŲ PROGNOZĖ", font=font(26, True), fill=GOLD)
        title = "Orai " + place[5] if place[5] else place[1]
        d.text((56, 234), title, font=font(65 if len(title)<15 else 53, True), fill=WHITE)
        d.text((61, 340), "Valandomis ir iki 15 dienų", font=font(30), fill=MUTED)
        d.line((62, 484, 506, 484), fill=MUTED, width=1)
        latitude, longitude = (f"{number:.3f}".replace(".", ",") for number in place[3:5])
        coords = f"{latitude}° š. pl.  ·  {longitude}° r. ilg."
        d.text((62, 510), coords, font=font(24), fill=WHITE)
        d.text((62, 566), "kalendorius365.lt", font=font(21), fill=MUTED)
        im.save(OUT / f"{slug}-v1.jpg", quality=88, optimize=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    atlas()
    city_cards()
