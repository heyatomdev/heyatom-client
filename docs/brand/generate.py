"""README banner generator. Usage: python generate.py <Manrope-800.woff2> <JetBrainsMono-400.woff2>

Writes banner.svg (text outlined, no font needed) and banner.png next to this file.
Needs fonttools, brotli, resvg_py. Symbol and colors from the HeyAtom site.
"""
import os, sys
import resvg_py
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

SANS, MONO = sys.argv[1], sys.argv[2]
OUT = os.path.dirname(os.path.abspath(__file__))

W, H = 1280, 400
BG, INK, GREEN, INK3 = "#1e201e", "#eef1ef", "#00a86b", "#a1a6a2"
SYMBOL = ("M1037.1 449.6 820 789.1l-87.6 169.1c-8 15.4-21.8 27.1-38.3 32.4l-269.8 86.3c-13.8 4.5-28.8 4.1-42.5-.8l-236.6-85.8c-13.9-5.1-25.5-15.3-32.1-28.6L46.9 829.8c-4.5-8.9-6.6-18.9-6.1-28.9l12.3-253.7 15.7-436c.2-4.8 2.1-9.2 5.5-12.6l8.6-8.6c8-8 18.7-12.5 30-12.6l23.5-.3c7.1 0 13.5-4.100 16.7-10.5l30.6-62.2c1.6-3.300 5.4-4.9 8.9-3.8l62.1 19.3c7.4 2.3 12.9 8.6 14.1 16.3l82.5 489.6c1.5 8.6-4.4 16.8-13 18.4l-71.6 12.6c-7 1.3-13.1 5.4-16.7 11.5l-10.7 18.1c-5.8 9.7 2.4 21.8 13.6 20l141.1-23c5.8-1 11.8-1 17.6 0l141.1 23c11.2 1.8 19.3-10.2 13.6-20l-10.7-18.1c-3.6-6.1-9.8-10.3-16.7-11.5l-71.6-12.6c-8.6-1.5-14.4-9.7-13-18.4L536.6 36c1.3-7.4 6.6-13.6 13.8-15.8l59.7-18.7c5.1-1.6 10.5.7 12.9 5.5l29.8 60.7c2.9 5.7 8.7 9.5 15.1 9.5l44.9.4c4.9 0 9.3 2.7 11.8 6.8l9.9 16.6c1.2 2 1.9 4.4 2 6.7l15.7 433.5c.1 4 2.1 7.8 5.3 10.1 5.2 3.7 12.3 3.2 16.9-1.3l137.4-137.4c2.7-2.7 6.5-4 10.2-3.8l94.2 7.4c3.6.3 7 2.1 9.2 5l10.7 13.9c3.4 4.4 3.6 10.3.6 15Z")


def text(font_path, s, size, x, baseline, fill, tracking=0.0):
    """Outline `s` as one <path>; returns (svg, advance width). No kerning."""
    font = TTFont(font_path)
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    scale = size / font["head"].unitsPerEm
    pen, cx = SVGPathPen(glyphs), x
    for ch in s:
        name = cmap[ord(ch)]
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cx, baseline)))
        cx += glyphs[name].width * scale + tracking * size
    return f'<path fill="{fill}" d="{pen.getCommands()}"/>', cx - x


sym = 220
name, name_w = text(SANS, "HeyAtom", 132, 0, 0, INK, -0.02)
pkg, _ = text(MONO, "@heyatom/client", 40, 0, 0, GREEN)
tag, _ = text(MONO, "fileharbor · articuno · beacon · gatherly", 22, 0, 0, INK3)

gap = 44
x0 = (W - (sym + gap + name_w)) / 2
tx = x0 + sym + gap
svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
    f'<rect width="{W}" height="{H}" fill="{BG}"/>'
    f'<path fill="{GREEN}" transform="translate({x0} {(H - sym) / 2}) scale({sym / 1080})" d="{SYMBOL}"/>'
    f'<g transform="translate({tx} 222)">{name}</g>'
    f'<g transform="translate({tx + 6} 278)">{pkg}</g>'
    f'<g transform="translate({tx + 6} 318)">{tag}</g>'
    "</svg>"
)

with open(os.path.join(OUT, "banner.svg"), "w") as f:
    f.write(svg)
with open(os.path.join(OUT, "banner.png"), "wb") as f:
    f.write(bytes(resvg_py.svg_to_bytes(svg_string=svg, zoom=2)))
