"""Build transparent logo.png + favicons/app icons from the official Voltrix mark."""
from __future__ import annotations

import os
from collections import deque

from PIL import Image, ImageDraw

SRC = (
    r"C:\Users\Ahmed\.cursor\projects\c-Users-Ahmed-Desktop-voltrix\assets"
    r"\c__Users_Ahmed_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"8d92d5a1656944ce3a9bbeb91d588b1a_images_logo-e2b37f58-e13c-4982-9917-a02eabc4732e.png"
)
OUT = r"c:\Users\Ahmed\Desktop\voltrix\public"


def is_blackish(r: int, g: int, b: int, a: int, threshold: int) -> bool:
    if a < 12:
        return True
    return max(r, g, b) <= threshold


def flood_clear_background(img: Image.Image, threshold: int = 6) -> Image.Image:
    """Clear only near-pure-black edge-connected background (keep dark wordmark)."""
    img = img.convert("RGBA")
    w, h = img.size
    px = img.load()
    assert px is not None
    visited = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_push(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= w or y >= h or visited[y][x]:
            return
        r, g, b, a = px[x, y]
        if not is_blackish(r, g, b, a, threshold):
            return
        visited[y][x] = True
        q.append((x, y))

    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            try_push(nx, ny)
    return img


def recolor_wordmark(img: Image.Image) -> Image.Image:
    """Make nearly-invisible dark wordmark readable on light UI."""
    px = img.load()
    assert px is not None
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            mx = max(r, g, b)
            # dark gray/black letterforms (not cyan/teal strokes)
            if mx < 55 and (g < r + 25 or g < 70):
                # skip if clearly teal-leaning
                if g > r + 8 and g > b + 8 and g > 40:
                    continue
                px[x, y] = (15, 105, 100, 255)
    return img


def fit_square(src: Image.Image, size: int, padding_ratio: float = 0.14) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    max_inner = int(size * (1 - 2 * padding_ratio))
    ratio = min(max_inner / src.width, max_inner / src.height)
    nw = max(1, int(src.width * ratio))
    nh = max(1, int(src.height * ratio))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def rounded_square(size: int, radius_ratio: float = 0.22, color=(13, 107, 103, 255)) -> Image.Image:
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=color)
    return base


def icon_on_brand(mark: Image.Image, size: int) -> Image.Image:
    bg = rounded_square(size, 0.22, (13, 107, 103, 255))
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    cx = cy = size // 2
    for scale, alpha in ((0.55, 40), (0.35, 55)):
        rad = int(size * scale)
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(26, 159, 154, alpha))
    bg = Image.alpha_composite(bg, overlay)
    return Image.alpha_composite(bg, fit_square(mark, size, padding_ratio=0.18))


def main() -> None:
    img = flood_clear_background(Image.open(SRC).convert("RGBA"), threshold=4)
    img = recolor_wordmark(img)

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    pad = 10
    logo = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
    logo.paste(img, (pad, pad), img)
    logo.save(os.path.join(OUT, "logo.png"), "PNG", optimize=True)
    opaque = sum(1 for p in logo.getdata() if p[3] > 20)
    print("logo.png", logo.size, "opaque", opaque)

    cut_y = int(logo.height * 0.70)
    mark = logo.crop((0, 0, logo.width, cut_y))
    mb = mark.getbbox()
    if mb:
        mark = mark.crop(mb)

    for name, size in (("favicon-16x16.png", 16), ("favicon-32x32.png", 32)):
        fit_square(mark, size, padding_ratio=0.08).save(os.path.join(OUT, name), "PNG", optimize=True)
        print(name)

    for name, size in (
        ("apple-touch-icon.png", 180),
        ("android-chrome-192x192.png", 192),
        ("android-chrome-512x512.png", 512),
        ("app-icon-1024.png", 1024),
    ):
        icon_on_brand(mark, size).save(os.path.join(OUT, name), "PNG", optimize=True)
        print(name)

    images = [
        fit_square(mark, 16, padding_ratio=0.08),
        fit_square(mark, 32, padding_ratio=0.08),
        fit_square(mark, 48, padding_ratio=0.08),
        icon_on_brand(mark, 64),
    ]
    images[0].save(
        os.path.join(OUT, "favicon.ico"),
        format="ICO",
        sizes=[(im.width, im.height) for im in images],
        append_images=images[1:],
    )
    print("favicon.ico")

    og = Image.new("RGBA", (1200, 630), (255, 255, 255, 255))
    wash = Image.new("RGBA", (1200, 630), (0, 0, 0, 0))
    d = ImageDraw.Draw(wash)
    d.ellipse([-100, -200, 700, 500], fill=(26, 159, 154, 28))
    d.ellipse([700, 200, 1400, 900], fill=(26, 159, 154, 18))
    og = Image.alpha_composite(og, wash)
    lw = 440
    ratio = lw / logo.width
    lh = int(logo.height * ratio)
    resized = logo.resize((lw, lh), Image.Resampling.LANCZOS)
    og.paste(resized, ((1200 - lw) // 2, (630 - lh) // 2), resized)
    og.convert("RGB").save(os.path.join(OUT, "og-image.png"), "PNG", optimize=True)
    print("og-image.png")
    print("done")


if __name__ == "__main__":
    main()
