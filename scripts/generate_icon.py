#!/usr/bin/env python3
"""
Generate ScrollGuard launcher icons for all Android mipmap densities.

Design:
  - Background : deep indigo-navy  #1A1F3C  (rounded square)
  - Shield     : #7C8FF5 outline + near-transparent fill  (protection)
  - Eye        : #A8B4F8 ellipse + iris + pupil            (calm awareness)
  - Scroll arc : #7C8FF5 semi-transparent double arc       (scroll reference)
"""

import math
import os
from PIL import Image, ImageDraw

# ── Colours ────────────────────────────────────────────────────────────────
BG          = (26,  31,  60,  255)   # #1A1F3C
SHIELD      = (124, 143, 245, 255)   # #7C8FF5
SHIELD_FILL = (124, 143, 245,  18)
EYE         = (168, 180, 248, 255)   # #A8B4F8
EYE_FILL    = (168, 180, 248,  22)
PUPIL       = (26,  31,  60,  255)   # same as BG
ARC         = (124, 143, 245, 120)
HL          = (255, 255, 255, 200)   # iris highlight dot

RENDER = 512   # master canvas; downscaled per density for antialiasing

# ── Helpers ────────────────────────────────────────────────────────────────
def qbez(p0, p1, p2, steps=20):
    """Points along a quadratic Bezier from p0 to p2 with control p1."""
    pts = []
    for i in range(steps + 1):
        t = i / steps
        x = (1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t**2*p2[0]
        y = (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t**2*p2[1]
        pts.append((x, y))
    return pts

def shield_pts(s):
    """
    Classic heraldic shield polygon on a canvas of size s.
    Rounded top corners, straight sides, converging to a bottom tip.
    """
    cx   = s / 2
    top  = s * 0.225
    tl_x = s * 0.205
    tr_x = s * 0.795
    mid_y = s * 0.595
    tip_y = s * 0.845
    cr    = s * 0.065   # corner radius

    pts = []
    # top-left rounded corner: arc from left-edge → top-edge
    pts += qbez((tl_x, top + cr), (tl_x, top), (tl_x + cr, top))
    # straight top to top-right corner start
    pts.append((tr_x - cr, top))
    # top-right rounded corner: arc from top-edge → right-edge
    pts += qbez((tr_x - cr, top), (tr_x, top), (tr_x, top + cr))
    # right side down
    pts.append((tr_x, mid_y))
    # converge to bottom tip
    pts.append((cx, tip_y))
    # left side up
    pts.append((tl_x, mid_y))
    return pts

# ── Main draw ──────────────────────────────────────────────────────────────
def draw_master():
    s = RENDER
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d   = ImageDraw.Draw(img)

    cx = s / 2

    # ── Background ──────────────────────────────────────────────────────────
    bg_r = s * 0.22
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=bg_r, fill=BG)

    # ── Shield ──────────────────────────────────────────────────────────────
    sp   = shield_pts(s)
    closed = sp + [sp[0]]
    lw   = max(3, int(s * 0.023))

    d.polygon(sp, fill=SHIELD_FILL)
    d.line(closed, fill=SHIELD, width=lw)

    # ── Eye ─────────────────────────────────────────────────────────────────
    eye_cx = cx
    eye_cy = s * 0.455
    eye_rx = s * 0.158
    eye_ry = s * 0.097

    d.ellipse(
        [eye_cx - eye_rx, eye_cy - eye_ry, eye_cx + eye_rx, eye_cy + eye_ry],
        fill=EYE_FILL, outline=EYE, width=lw
    )

    # Iris
    iris_r = s * 0.060
    d.ellipse(
        [eye_cx - iris_r, eye_cy - iris_r, eye_cx + iris_r, eye_cy + iris_r],
        fill=EYE
    )

    # Pupil
    pupil_r = s * 0.029
    d.ellipse(
        [eye_cx - pupil_r, eye_cy - pupil_r, eye_cx + pupil_r, eye_cy + pupil_r],
        fill=PUPIL
    )

    # Highlight dot
    hl_r = s * 0.013
    hl_x = eye_cx + iris_r * 0.38
    hl_y = eye_cy - iris_r * 0.38
    d.ellipse([hl_x - hl_r, hl_y - hl_r, hl_x + hl_r, hl_y + hl_r], fill=HL)

    # ── Double scroll arc (bottom half of shield) ────────────────────────────
    arc_lw  = max(2, int(s * 0.017))
    arc_cx  = cx
    arc_cy  = s * 0.675

    # outer arc
    r1 = s * 0.092
    d.arc(
        [arc_cx - r1, arc_cy - r1, arc_cx + r1, arc_cy + r1],
        start=205, end=335, fill=ARC, width=arc_lw
    )
    # inner arc (offset downward slightly)
    r2   = r1 * 0.60
    off  = s * 0.028
    d.arc(
        [arc_cx - r2, arc_cy - r2 + off, arc_cx + r2, arc_cy + r2 + off],
        start=205, end=335, fill=ARC, width=arc_lw
    )

    return img

def make_round(img):
    sz = img.size[0]
    hi = sz * 4
    mask = Image.new('L', (hi, hi), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, hi - 1, hi - 1], fill=255)
    mask = mask.resize((sz, sz), Image.LANCZOS)
    out  = img.copy().convert('RGBA')
    out.putalpha(mask)
    return out

# ── Sizes & paths ──────────────────────────────────────────────────────────
DENSITIES = {
    'mipmap-mdpi':    48,
    'mipmap-hdpi':    72,
    'mipmap-xhdpi':   96,
    'mipmap-xxhdpi':  144,
    'mipmap-xxxhdpi': 192,
}

BASE = os.path.join(
    os.path.dirname(__file__),
    '..', 'android', 'app', 'src', 'main', 'res'
)

if __name__ == '__main__':
    master = draw_master()

    for folder, px in DENSITIES.items():
        icon = master.resize((px, px), Image.LANCZOS)

        sq_path    = os.path.join(BASE, folder, 'ic_launcher.png')
        round_path = os.path.join(BASE, folder, 'ic_launcher_round.png')

        icon.save(sq_path,    'PNG')
        make_round(icon).save(round_path, 'PNG')

        print(f'  {folder:20s}  {px}×{px}  ✓')

    # Also save a 512×512 preview alongside the script
    preview = os.path.join(os.path.dirname(__file__), 'icon_preview_512.png')
    master.save(preview, 'PNG')
    print(f'\n  Preview → scripts/icon_preview_512.png')
    print('Done.')
