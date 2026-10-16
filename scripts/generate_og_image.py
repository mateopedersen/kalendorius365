#!/usr/bin/env python3
"""Render the site's social-sharing image as a compact 1200 x 630 PNG."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "site/assets/visuals/kalendorius365-lietuviskas-kalendorius-1200x630.png"
W, H, S = 1200, 630, 2
SIZE = (W * S, H * S)


def color(hex_color, alpha=255):
    raw = hex_color.lstrip("#")
    return tuple(int(raw[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def font(path, size):
    return ImageFont.truetype(str(path), round(size * S))


REGULAR = font(ROOT / "site/assets/fonts/Inter-Regular.ttf", 14)
BOLD = font(ROOT / "site/assets/fonts/Inter-Bold.ttf", 14)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(tuple(round(v * S) for v in box), round(radius * S), fill=fill, outline=outline, width=round(width * S))


def line(draw, points, fill, width=1):
    draw.line([(round(x * S), round(y * S)) for x, y in points], fill=fill, width=max(1, round(width * S)), joint="curve")


def ellipse(draw, box, fill=None, outline=None, width=1):
    draw.ellipse(tuple(round(v * S) for v in box), fill=fill, outline=outline, width=max(1, round(width * S)))


def gradient_background():
    image = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    left, right = (235, 246, 239), (248, 245, 236)
    for x in range(W * S):
        t = x / (W * S - 1)
        rgb = tuple(round(left[i] + (right[i] - left[i]) * t) for i in range(3)) + (255,)
        d.line((x, 0, x, H * S), fill=rgb)
    return image


def calendar_sheet():
    w, h = 510, 560
    page = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(page)
    rounded(d, (2, 2, w - 2, h - 2), 26, color("#fffefa"), color("#dce7df"), 1.2)

    # Deep evergreen header with a restrained, warm highlight.
    header = Image.new("RGBA", (w * S, 116 * S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(header)
    for y in range(0, 116 * S):
        t = y / (116 * S)
        a, b = (7, 105, 72), (4, 81, 57)
        c = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
        hd.line((0, y, w * S, y), fill=c)
    mask = Image.new("L", header.size, 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, w * S, 116 * S), 26 * S, fill=255)
    # Square off only the lower corners, leaving the paper's rounded top corners intact.
    md.rectangle((0, 26 * S, w * S, 116 * S), fill=255)
    header.putalpha(mask)
    page.alpha_composite(header)
    d = ImageDraw.Draw(page)
    # Keep the paper edge crisp above the grid.
    rounded(d, (2, 2, w - 2, h - 2), 26, None, color("#dce7df"), 1.2)
    line(d, [(0, 116), (w, 116)], color("#d7e7de"), 1)

    # Seven brass binding loops, inset into the top strip.
    for x in (43, 112, 181, 250, 319, 388, 457):
        rounded(d, (x - 7, 16, x + 7, 48), 7, color("#e7c36b"), color("#f4df9f"), 1)
        rounded(d, (x - 2, 20, x + 2, 42), 2, color("#086344"))
        ellipse(d, (x - 2.5, 51, x + 2.5, 56), color("#d7e6dc"))

    # Quiet calendar cues in the header rather than a promotional text overlay.
    rounded(d, (38, 70, 202, 79), 4, color("#d8efe1", 210))
    rounded(d, (38, 88, 144, 94), 3, color("#9dd0b4", 180))
    for i, c in enumerate(("#f2c94c", "#08754e", "#c63138")):
        rounded(d, (433 + i * 19, 70, 448 + i * 19, 82), 3, color(c))

    days = ("Pr", "An", "Tr", "Kt", "Pn", "Št", "Sk")
    x0, top, cw, rh = 39, 139, 61, 67
    for col, label in enumerate(days):
        box = d.textbbox((0, 0), label, font=BOLD)
        tx = round((x0 + col * cw + (cw - (box[2] - box[0]) / S) / 2) * S)
        ty = round(top * S)
        d.text((tx, ty), label, font=BOLD, fill=color("#718277"))
    line(d, [(30, 168), (w - 30, 168)], color("#e8eee9"), 1)

    # A real calendar grid: clean weekdays, subtle weekend tint and selected dates.
    grid_y = 180
    for row in range(5):
        y1 = grid_y + row * rh
        if row % 2 == 1:
            rounded(d, (31, y1, w - 31, y1 + rh - 2), 9, color("#fafbf8"))
        for col in range(7):
            day = row * 7 + col - 1
            if day < 1 or day > 31:
                continue
            cx = x0 + col * cw + cw / 2
            cy = y1 + 27
            if day == 17:
                ellipse(d, (cx - 19, cy - 19, cx + 19, cy + 19), color("#08754e"))
            elif day in (1, 11, 24):
                ellipse(d, (cx - 18, cy - 18, cx + 18, cy + 18), color("#fff0ed"))
            ink = "#fffefa" if day == 17 else ("#c94743" if day in (1, 11, 24) else "#25384a")
            text = str(day)
            box = d.textbbox((0, 0), text, font=BOLD if day == 17 else REGULAR)
            tw, th = box[2] - box[0], box[3] - box[1]
            d.text((round(cx * S - tw / 2), round(cy * S - th / 2 - box[1])), text, font=BOLD if day == 17 else REGULAR, fill=color(ink))
            if day in (6, 17, 28):
                ellipse(d, (cx - 2.2, y1 + 51, cx + 2.2, y1 + 55), color("#e6b742"))

    # Small ruled notes area at the foot of the sheet.
    line(d, [(34, 521), (w - 34, 521)], color("#e3ebe5"), 1)
    for x, width in ((36, 166), (224, 118), (372, 92)):
        rounded(d, (x, 533, x + width, 539), 3, color("#edf1ec"))
    return page


def brand_mark(canvas):
    # A compact, bespoke rendition of the site's green calendar-and-check mark.
    layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = 100, 385
    ellipse(d, (x - 14, y - 14, x + 108, y + 108), color("#0a744e", 18))
    rounded(d, (x, y, x + 92, y + 92), 27, color("#e0efe7"))
    rounded(d, (x + 5, y + 4, x + 87, y + 86), 24, color("#08754e"))
    line(d, [(x + 24, y + 14), (x + 24, y + 7)], color("#c7f0dc"), 4)
    line(d, [(x + 68, y + 14), (x + 68, y + 7)], color("#c7f0dc"), 4)
    rounded(d, (x + 17, y + 19, x + 75, y + 70), 12, color("#fffefa"))
    line(d, [(x + 18, y + 33), (x + 74, y + 33)], color("#bddccb"), 2)
    for yy in (44, 56):
        for xx in (30, 44, 58):
            ellipse(d, (x + xx - 2, y + yy - 2, x + xx + 2, y + yy + 2), color("#86b69a"))
    ellipse(d, (x + 52, y + 51, x + 86, y + 85), color("#0a8a5d"), color("#fffefa"), 2)
    line(d, [(x + 60, y + 67), (x + 67, y + 74), (x + 79, y + 60)], color("#fffefa"), 4)
    for i, c in enumerate(("#f2c94c", "#08754e", "#c63138")):
        rounded(d, (x + 68, y + 76 + i * 6, x + 97, y + 82 + i * 6), 1, color(c))
    canvas.alpha_composite(layer)


def render():
    canvas = gradient_background()
    decor = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    d = ImageDraw.Draw(decor)
    # Airy, low-contrast circular geometry gives the composition depth without noise.
    ellipse(d, (745, -175, 1350, 430), color("#d9ebe1", 120))
    ellipse(d, (796, -122, 1288, 372), outline=color("#a8cfba", 72), width=1)
    ellipse(d, (827, -92, 1258, 338), outline=color("#c0dacb", 100), width=1)
    ellipse(d, (50, 70, 510, 530), outline=color("#8ab69b", 35), width=1)
    ellipse(d, (72, 92, 488, 508), outline=color("#8ab69b", 25), width=1)
    # A restrained star/season compass balances the paper calendar on the left.
    cx, cy, r1, r2 = 283, 281, 58, 72
    ellipse(d, (cx - r2, cy - r2, cx + r2, cy + r2), fill=color("#f8faf5", 190), outline=color("#d4e4d8", 225), width=1.4)
    ellipse(d, (cx - r1, cy - r1, cx + r1, cy + r1), outline=color("#0b704d", 80), width=1.2)
    for a in range(0, 360, 30):
        ra = math.radians(a)
        x1, y1 = cx + math.cos(ra) * 62, cy + math.sin(ra) * 62
        x2, y2 = cx + math.cos(ra) * (70 if a % 90 == 0 else 66), cy + math.sin(ra) * (70 if a % 90 == 0 else 66)
        line(d, [(x1, y1), (x2, y2)], color("#ad7921", 180), 1.4)
    ellipse(d, (cx - 18, cy - 18, cx + 18, cy + 18), color("#f1c35b"), color("#d3a144"), 1)
    ellipse(d, (cx - 8, cy - 8, cx + 8, cy + 8), color("#fff5dc"))
    canvas.alpha_composite(decor)

    # A folded calendar leaf behind the featured page adds a second paper layer.
    back = Image.new("RGBA", (430 * S, 500 * S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(back)
    rounded(bd, (0, 0, 430, 500), 25, color("#f6f7f1"), color("#d7e2d9"), 1)
    rounded(bd, (0, 0, 430, 105), 25, color("#d8e8dd"))
    rounded(bd, (0, 78, 430, 106), 0, color("#d8e8dd"))
    for yy in (163, 235, 307, 379):
        line(bd, [(30, yy), (400, yy)], color("#e0e8e1"), 1)
        for xx in (53, 104, 155, 206, 257, 308, 359):
            ellipse(bd, (xx - 3, yy - 18, xx + 3, yy - 12), color("#7ba98d", 145))
    back = back.rotate(-6, resample=Image.Resampling.BICUBIC, expand=True)
    canvas.alpha_composite(back, (round(635 * S), round(95 * S)))

    sheet = calendar_sheet()
    angle = 2.7
    rotated = sheet.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    shadow = Image.new("RGBA", rotated.size, (16, 50, 37, 0))
    shadow.putalpha(rotated.getchannel("A").point(lambda a: round(a * 0.22)))
    shadow = shadow.filter(ImageFilter.GaussianBlur(21 * S))
    x, y = 589, 21
    canvas.alpha_composite(shadow, (round((x + 14) * S), round((y + 21) * S)))
    canvas.alpha_composite(rotated, (round(x * S), round(y * S)))

    # Small amber details echo the product's holiday markers, not a generic logo card.
    d = ImageDraw.Draw(canvas)
    for bx, by, radius in ((530, 138, 4), (1110, 495, 5), (582, 530, 3), (1035, 74, 3)):
        ellipse(d, (bx - radius, by - radius, bx + radius, by + radius), color("#eab64b", 225))
    line(d, [(523, 195), (540, 178), (556, 195)], color("#d79b29", 100), 1.2)
    brand_mark(canvas)

    # Gentle grain preserves the matte-paper feel after social platforms recompress the PNG.
    rgb = canvas.convert("RGB").resize((W, H), Image.Resampling.LANCZOS)
    rgb.save(OUTPUT, format="PNG", optimize=True, compress_level=9)
    return OUTPUT


if __name__ == "__main__":
    path = render()
    image = Image.open(path)
    print(f"Created {path.relative_to(ROOT)} — {image.width}×{image.height}, {path.stat().st_size:,} bytes")
