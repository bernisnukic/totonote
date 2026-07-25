#!/usr/bin/env python3
"""
Builds the app icon from the splash animation, so the two can't drift apart.

    python3 assets/generate-icon.py

Takes the settled last frame of `src/renderer/assets/intro.gif` — the TOTO NOTE wordmark —
and sets it on the app's own dark background, then writes every format the packagers need:

    assets/icon.png    Linux (and the master image)
    assets/icon.icns   macOS
    assets/icon.ico    Windows

Re-run this if the splash changes. Requires Pillow; macOS `iconutil` is used for the .icns
when available, with a Pillow fallback so it still runs elsewhere.
"""
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageSequence

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GIF = os.path.join(ROOT, 'src', 'renderer', 'assets', 'intro.gif')

SIZE = 1024
# The app's own palette (renderer/styles/tokens.css).
BG_TOP = (18, 18, 20)
BG_BOTTOM = (8, 8, 10)
ACCENT = (72, 219, 251)
# macOS icons sit inside a rounded square with clear space around the artwork.
CORNER_RADIUS = int(SIZE * 0.2237)
# Generous: macOS icons want clear space, and the wordmark otherwise runs into the
# rounded corners and reads as clipped.
MARGIN = int(SIZE * 0.19)


def wordmark() -> Image.Image:
    """The splash's final frame as a white mark on transparency."""
    with Image.open(GIF) as gif:
        frames = list(ImageSequence.Iterator(gif))
        frame = frames[-1].convert('RGBA')

    # The GIF may carry no usable alpha, in which case the mark is white on black —
    # use brightness as the mask so the letters keep their shape either way.
    alpha = frame.getchannel('A')
    if alpha.getextrema()[0] == 255:  # fully opaque, so alpha tells us nothing
        alpha = frame.convert('L')

    white = Image.new('RGBA', frame.size, (255, 255, 255, 255))
    white.putalpha(alpha)
    return white.crop(white.getbbox() or (0, 0, *frame.size))


def background() -> Image.Image:
    """Rounded square with a soft vertical gradient and a thin accent edge."""
    gradient = Image.new('RGBA', (1, SIZE))
    for y in range(SIZE):
        t = y / (SIZE - 1)
        gradient.putpixel(
            (0, y),
            tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)) + (255,),
        )
    canvas = gradient.resize((SIZE, SIZE))

    mask = Image.new('L', (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), CORNER_RADIUS, fill=255)
    canvas.putalpha(mask)

    # A hairline of the accent colour, so the icon reads as *this* app at small sizes.
    edge = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle(
        (2, 2, SIZE - 3, SIZE - 3), CORNER_RADIUS, outline=ACCENT + (90,), width=5
    )
    return Image.alpha_composite(canvas, edge)


def build() -> Image.Image:
    icon = background()
    mark = wordmark()

    box = SIZE - MARGIN * 2
    scale = min(box / mark.width, box / mark.height)
    mark = mark.resize((max(1, round(mark.width * scale)), max(1, round(mark.height * scale))), Image.LANCZOS)
    icon.alpha_composite(mark, ((SIZE - mark.width) // 2, (SIZE - mark.height) // 2))
    return icon


def write_icns(master: Image.Image, path: str) -> None:
    if not shutil.which('iconutil'):
        master.save(path, format='ICNS')
        return
    with tempfile.TemporaryDirectory() as tmp:
        iconset = os.path.join(tmp, 'icon.iconset')
        os.makedirs(iconset)
        for size in (16, 32, 64, 128, 256, 512):
            master.resize((size, size), Image.LANCZOS).save(os.path.join(iconset, f'icon_{size}x{size}.png'))
            master.resize((size * 2, size * 2), Image.LANCZOS).save(
                os.path.join(iconset, f'icon_{size}x{size}@2x.png')
            )
        subprocess.run(['iconutil', '-c', 'icns', iconset, '-o', path], check=True)


def main() -> int:
    if not os.path.exists(GIF):
        print(f'Splash not found at {GIF}', file=sys.stderr)
        return 1

    master = build()
    png = os.path.join(HERE, 'icon.png')
    master.save(png)
    print(f'wrote {png} ({SIZE}x{SIZE})')

    icns = os.path.join(HERE, 'icon.icns')
    write_icns(master, icns)
    print(f'wrote {icns}')

    ico = os.path.join(HERE, 'icon.ico')
    master.save(ico, format='ICO', sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
    print(f'wrote {ico}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
