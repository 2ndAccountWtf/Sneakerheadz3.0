#!/usr/bin/env python3
"""
Turn raw generated art into sprites this game can actually use.

Image generation is the easy 20%. The other 80% is that raw model output is
not a game asset: the character drifts inside its cell, the background is
"looks transparent" rather than real alpha, and an attack sheet comes back at
a different scale from the idle sheet it has to cut with. Drop those frames
in unchanged and the character bobs, shifts and resizes while standing still.

So this does the unglamorous part, adapted from the pipeline published in
chongdashu/ai-game-spritesheets (MIT, explicitly free to reuse). Two changes
matter for us:

  * Their runtime cell is a 5x2 grid of 256x256. Ours is a SINGLE ROW of
    equal-width frames with no padding, named `<id>.png` or `<id>@<n>.png`,
    because that is what `systems/sprites/registry.ts` globs and bakes.

  * They deliberately ship "mixels" — downscaled AI art that reads as pixel
    art. We already have a fixed 32-colour palette in
    `systems/sprites/palette.ts` that every coded sprite draws from, so
    `--palette` snaps generated art onto those exact colours. Art that skips
    this step is the thing that looks obviously bolted on next to the sprites
    around it.

Usage
-----
    python3 tools/sprite-normalize.py IN OUT --id player-hoops --frames 6 \
        --cell 32x32 [--sheet 5x2] [--palette] [--chroma FF00FF]

IN may be a folder of frames, or one spritesheet plus `--sheet COLSxROWS`.
OUT is a directory; it receives `<id>@<n>.png`, a contact sheet and a GIF.

Nothing here is destructive and nothing is written into assets/ — look at the
contact sheet and the GIF first, then move the strip into
`assets/art/<category>/` yourself.
"""
from __future__ import annotations
import argparse, re, sys
from pathlib import Path
from PIL import Image

# --------------------------------------------------------------------------
# Palette
# --------------------------------------------------------------------------

def load_palette(repo_root: Path) -> list[tuple[int, int, int]]:
    """The game's colours, straight from the TS so the two cannot drift."""
    src = (repo_root / 'systems/sprites/palette.ts').read_text()
    hexes = re.findall(r"'(#[0-9a-fA-F]{6})'", src)
    seen: list[tuple[int, int, int]] = []
    for h in hexes:
        rgb = (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))
        if rgb not in seen:
            seen.append(rgb)
    return seen


def snap_to_palette(img: Image.Image, palette: list[tuple[int, int, int]]) -> Image.Image:
    """Nearest colour per pixel, alpha preserved. Small images, so a plain
    loop is fine and avoids a numpy dependency this container lacks."""
    img = img.convert('RGBA')
    px = img.load()
    cache: dict[tuple[int, int, int], tuple[int, int, int]] = {}
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            key = (r, g, b)
            hit = cache.get(key)
            if hit is None:
                hit = min(palette, key=lambda c: (c[0]-r)**2 + (c[1]-g)**2 + (c[2]-b)**2)
                cache[key] = hit
            px[x, y] = (hit[0], hit[1], hit[2], a)
    return img

# --------------------------------------------------------------------------
# Step 2 — background to real alpha
# --------------------------------------------------------------------------

def key_out(img: Image.Image, chroma: tuple[int, int, int] | None, tol: int) -> Image.Image:
    """Chroma key, plus a flood from the corners for art that came back on a
    flat but un-keyed background. Deliberately conservative: it is better to
    leave a halo for a human to notice than to eat the character's outline."""
    img = img.convert('RGBA')
    if chroma is None:
        corners = [img.getpixel(p)[:3] for p in
                   ((0, 0), (img.width - 1, 0), (0, img.height - 1), (img.width - 1, img.height - 1))]
        if len(set(corners)) != 1:
            return img                      # already transparent, or a real scene
        chroma = corners[0]
    px = img.load()
    cr, cg, cb = chroma
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a and abs(r - cr) <= tol and abs(g - cg) <= tol and abs(b - cb) <= tol:
                px[x, y] = (0, 0, 0, 0)
    return img

# --------------------------------------------------------------------------
# Steps 1, 3-5 — recover, measure, correct, re-pad
# --------------------------------------------------------------------------

def split_sheet(img: Image.Image, cols: int, rows: int) -> list[Image.Image]:
    w, h = img.width // cols, img.height // rows
    return [img.crop((c * w, r * h, (c + 1) * w, (r + 1) * h))
            for r in range(rows) for c in range(cols)]


def normalize(frames: list[Image.Image], cell: tuple[int, int],
              foot_pad: int) -> tuple[list[Image.Image], list[str]]:
    """Measure every frame by its ALPHA BOUNDING BOX rather than trusting the
    nominal grid, scale them to one shared visible height, then re-paste each
    onto a fresh cell with the same centre-x and the same foot baseline. That
    last part is the whole point: it is what stops the character sliding
    around inside its own frame."""
    cw, ch = cell
    boxes = [f.getbbox() for f in frames]
    live = [(f, b) for f, b in zip(frames, boxes) if b]
    if not live:
        return [], ['every frame is empty after background removal']

    notes: list[str] = []
    heights = [b[3] - b[1] for _, b in live]
    target_h = max(1, min(max(heights), ch - foot_pad))
    spread = (max(heights) - min(heights)) / max(1, max(heights))
    if spread > 0.12:
        notes.append(f'frames differed in height by {spread * 100:.0f}% before correction '
                     f'(tallest {max(heights)}px, shortest {min(heights)}px) — scaled to match')

    out: list[Image.Image] = []
    for f, b in zip(frames, boxes):
        cell_img = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        if b:
            crop = f.crop(b)
            scale = target_h / crop.height
            nw = max(1, round(crop.width * scale))
            nh = max(1, round(crop.height * scale))
            crop = crop.resize((nw, nh), Image.NEAREST)
            cell_img.paste(crop, ((cw - nw) // 2, ch - foot_pad - nh), crop)
        out.append(cell_img)
    return out, notes

# --------------------------------------------------------------------------
# Steps 6-7 — repack, and prove it worked before anything ships
# --------------------------------------------------------------------------

def strip(frames: list[Image.Image]) -> Image.Image:
    if not frames:
        raise SystemExit('no frames to pack')
    w, h = frames[0].size
    sheet = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * w, 0), f)
    return sheet


def contact(frames: list[Image.Image], scale: int = 4) -> Image.Image:
    """Every frame side by side on a grid, big enough to actually see drift."""
    w, h = frames[0].size
    sheet = Image.new('RGBA', (w * len(frames) * scale, h * scale), (24, 26, 32, 255))
    for i, f in enumerate(frames):
        big = f.resize((w * scale, h * scale), Image.NEAREST)
        sheet.paste(big, (i * w * scale, 0), big)
    return sheet


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src'); ap.add_argument('out')
    ap.add_argument('--id', required=True, help='sprite id — becomes <id>@<n>.png')
    ap.add_argument('--cell', default='32x32', help='runtime cell size, e.g. 32x32 or 64x64')
    ap.add_argument('--sheet', help='COLSxROWS when src is one spritesheet')
    ap.add_argument('--frames', type=int, help='keep only the first N frames')
    ap.add_argument('--palette', action='store_true', help='snap to the game\'s 32 colours')
    ap.add_argument('--chroma', help='background hex to key out, e.g. FF00FF')
    ap.add_argument('--tol', type=int, default=40)
    ap.add_argument('--foot-pad', type=int, default=0, help='pixels of floor beneath the feet')
    a = ap.parse_args()

    cw, ch = (int(v) for v in a.cell.lower().split('x'))
    src, out = Path(a.src), Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    if src.is_dir():
        files = sorted(p for p in src.iterdir() if p.suffix.lower() in {'.png', '.webp'})
        if not files:
            print(f'no images in {src}', file=sys.stderr); return 1
        frames = [Image.open(p).convert('RGBA') for p in files]
        print(f'recovered {len(frames)} frames from {len(files)} files')
    else:
        img = Image.open(src).convert('RGBA')
        if not a.sheet:
            print('a single image needs --sheet COLSxROWS', file=sys.stderr); return 1
        cols, rows = (int(v) for v in a.sheet.lower().split('x'))
        frames = split_sheet(img, cols, rows)
        print(f'split {src.name} into {len(frames)} cells ({cols}x{rows})')

    if a.frames:
        frames = frames[:a.frames]

    chroma = None
    if a.chroma:
        h = a.chroma.lstrip('#')
        chroma = (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    frames = [key_out(f, chroma, a.tol) for f in frames]

    frames, notes = normalize(frames, (cw, ch), a.foot_pad)
    if not frames:
        print('\n'.join(notes), file=sys.stderr); return 1

    if a.palette:
        pal = load_palette(Path(__file__).resolve().parent.parent)
        frames = [snap_to_palette(f, pal) for f in frames]
        print(f'snapped to the game\'s {len(pal)} palette colours')

    name = f'{a.id}@{len(frames)}.png'
    strip(frames).save(out / name)
    contact(frames).save(out / f'{a.id}-contact.png')
    frames[0].resize((cw * 4, ch * 4), Image.NEAREST).save(
        out / f'{a.id}-preview.gif', save_all=True, loop=0, duration=110,
        append_images=[f.resize((cw * 4, ch * 4), Image.NEAREST) for f in frames[1:]])

    for n in notes:
        print(f'  note: {n}')
    print(f'\nwrote {out / name}  ({len(frames)} frames, {cw}x{ch} each)')
    print(f'check {a.id}-contact.png for drift and {a.id}-preview.gif for motion,')
    print(f'then move the strip into assets/art/<category>/ to have the game pick it up.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
