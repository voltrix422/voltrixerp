"""Generate uniquely named PWA icons from the official Voltrix mark (breaks Android cache)."""
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
BRAND = (13, 107, 103, 255)


def flood_clear(img: Image.Image, threshold: int = 4) -> Image.Image:
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
        if a >= 12 and max(r, g, b) > threshold:
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


def extract_mark(logo: Image.Image) -> Image.Image:
    cut_y = int(logo.height * 0.70)
    mark = logo.crop((0, 0, logo.width, cut_y))
    bbox = mark.getbbox()
    return mark.crop(bbox) if bbox else mark


def fit(src: Image.Image, size: int, pad: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * (1 - 2 * pad))
    ratio = min(inner / src.width, inner / src.height)
    nw, nh = max(1, int(src.width * ratio)), max(1, int(src.height * ratio))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def brand_plate(size: int, mark: Image.Image, pad: float) -> Image.Image:
    base = Image.new("RGBA", (size, size), BRAND)
    overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    cx = cy = size // 2
    for scale, alpha in ((0.55, 40), (0.35, 55)):
        rad = int(size * scale)
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=(26, 159, 154, alpha))
    base = Image.alpha_composite(base, overlay)
    return Image.alpha_composite(base, fit(mark, size, pad))


def main() -> None:
    raw = flood_clear(Image.open(SRC).convert("RGBA"))
    bbox = raw.getbbox()
    if bbox:
        raw = raw.crop(bbox)
    pad = 10
    logo = Image.new("RGBA", (raw.width + pad * 2, raw.height + pad * 2), (0, 0, 0, 0))
    logo.paste(raw, (pad, pad), raw)
    mark = extract_mark(logo)

    # Full-bleed any icons (launcher)
    for name, size, p in (
        ("voltrix-pwa-192.png", 192, 0.16),
        ("voltrix-pwa-512.png", 512, 0.16),
        ("voltrix-pwa-1024.png", 1024, 0.16),
        ("android-chrome-192x192.png", 192, 0.16),
        ("android-chrome-512x512.png", 512, 0.16),
        ("app-icon-1024.png", 1024, 0.16),
        ("apple-touch-icon.png", 180, 0.16),
    ):
        brand_plate(size, mark, p).save(os.path.join(OUT, name), "PNG", optimize=True)
        print("wrote", name)

    # Maskable: extra safe-zone padding (~20% per Android guidance)
    for name, size in (
        ("voltrix-pwa-maskable-192.png", 192),
        ("voltrix-pwa-maskable-512.png", 512),
    ):
        brand_plate(size, mark, 0.22).save(os.path.join(OUT, name), "PNG", optimize=True)
        print("wrote", name)

    print("done")


if __name__ == "__main__":
    main()
