# Flat storefront illustrations, one per persona. viewBox 0 0 500 300.
import random

MAROON = '#9b1c23'; MAROON_D = '#761419'; OLIVE = '#56642f'; OLIVE_L = '#8b9a5a'
SAGE = '#cfd6b6'; OCHRE = '#d49a3a'; OCHRE_D = '#b07a24'; INK = '#2b211b'
CREAM = '#fcf6ec'; SKY = '#f3dfcf'; SUN = '#f0b35a'; WALL = '#ecd6bb'; WALL_D = '#dcc19f'
GLASS = '#d5e3de'; DARK = '#4a3326'; SLATE = '#3f5566'; WATER = '#9fb7bf'
BOTTLES = ['#5a2e1c', '#c2412f', '#e07b2e', '#6b8e3a', '#e8b64a', '#6f8fa6', '#9b1c23']
DEVA = "'Tiro Devanagari Marathi', 'Noto Sans Devanagari', serif"


def r(x, y, w, h, fill, rx=0, extra=''):
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" {extra}/>'


def c(cx, cy, rad, fill, extra=''):
    return f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{rad:.1f}" fill="{fill}" {extra}/>'


def t(x, y, s, size, fill, family=DEVA, anchor='middle', weight=400, extra=''):
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" fill="{fill}" '
            f'text-anchor="{anchor}" font-weight="{weight}" {extra}>{s}</text>')


def sky(sun=(70, 62), sunr=30, heat=False):
    out = [r(0, 0, 500, 300, SKY)]
    out.append(c(sun[0], sun[1], sunr + 14, '#f6cf94', 'opacity="0.45"'))
    out.append(c(sun[0], sun[1], sunr, SUN))
    if heat:
        for i in range(3):
            y = 120 + i * 14
            out.append(f'<path d="M20 {y} q10 -6 20 0 t20 0 t20 0" fill="none" stroke="#e7a45a" stroke-width="2" stroke-linecap="round" opacity="0.7"/>')
    return ''.join(out)


def tree(x, y, s=1.0):
    return (r(x - 5 * s, y, 10 * s, 70 * s, '#7a5436') +
            c(x, y - 10 * s, 38 * s, OLIVE) + c(x - 30 * s, y + 8 * s, 26 * s, OLIVE_L) +
            c(x + 30 * s, y + 4 * s, 28 * s, '#6f7f40'))


def awning(x, y, w, h, n, c1, c2):
    sw = w / n
    out = []
    for i in range(n):
        col = c1 if i % 2 == 0 else c2
        out.append(f'<path d="M{x + i * sw:.1f} {y} h{sw:.1f} l{sw * 0.12:.1f} {h} h{-sw * 1.24:.1f} z" fill="{col}"/>')
    # scalloped edge
    for i in range(n):
        col = c1 if i % 2 == 0 else c2
        cx = x + i * sw + sw / 2
        out.append(f'<path d="M{cx - sw / 2 - sw * 0.12:.1f} {y + h} a{sw / 2 + sw * 0.12:.1f} 9 0 0 0 {sw + sw * 0.24:.1f} 0 z" fill="{col}"/>')
    return ''.join(out)


def goods_shelf(x, y, w, h, rows, seed, big=False, sparse=0.0):
    rnd = random.Random(seed)
    out = [r(x, y, w, h, DARK)]
    rh = h / rows
    for i in range(rows):
        by = y + (i + 1) * rh - 4
        out.append(r(x, by, w, 4, '#8a5f3f'))
        cx = x + 4
        while cx < x + w - 10:
            pw = rnd.choice([7, 8, 10, 12]) if not big else rnd.choice([9, 11])
            ph = rh * rnd.uniform(0.45, 0.8) if not big else rh * 0.82
            if rnd.random() < sparse:
                cx += pw + 3
                continue
            col = rnd.choice(BOTTLES + ['#e6c88a', '#d9d2c3'])
            if big:
                out.append(r(cx, by - ph + 6, pw, ph - 6, col, 3))
                out.append(r(cx + pw / 2 - 2, by - ph, 4, 7, col, 1))
            else:
                out.append(r(cx, by - ph, pw, ph, col, 1.5))
            cx += pw + 2
    return ''.join(out)


def cooler(x, y, w, h, dim=False, seed=1):
    rnd = random.Random(seed)
    out = [r(x, y, w, h, MAROON, 7), r(x + 6, y + 6, w - 12, 18, MAROON_D, 4)]
    # snowflake mark on the header
    cx, cy = x + w / 2, y + 15
    out.append(f'<g stroke="{CREAM}" stroke-width="1.6" stroke-linecap="round"><path d="M{cx} {cy - 6} v12 M{cx - 5.2} {cy - 3} l10.4 6 M{cx + 5.2} {cy - 3} l-10.4 6"/></g>')
    gx, gy, gw, gh = x + 8, y + 30, w - 16, h - 48
    out.append(r(gx, gy, gw, gh, '#8fa7a8' if dim else GLASS, 4))
    rows = 4
    for i in range(rows):
        by = gy + (i + 1) * gh / rows - 3
        out.append(r(gx, by, gw, 2.5, '#a9bcbc' if not dim else '#7b9192'))
        bx = gx + 4
        while bx < gx + gw - 8:
            col = rnd.choice(BOTTLES)
            bh = gh / rows - 9
            out.append(r(bx, by - bh, 6, bh, col, 2))
            out.append(r(bx + 1.5, by - bh - 3, 3, 3, col, 1))
            bx += 9
    if not dim:
        out.append(f'<path d="M{gx + 6} {gy + 4} l14 0 l-22 {gh - 10} l-6 0 z" fill="#ffffff" opacity="0.35"/>')
    out.append(r(x + w - 7, y + h / 2 - 14, 3, 28, CREAM, 1.5))
    out.append(r(x + 4, y + h - 14, w - 8, 8, MAROON_D, 3))
    return ''.join(out)


def crate(x, y, w, h, col=OCHRE, tops=True):
    out = [r(x, y, w, h, col, 2), r(x, y + h * 0.45, w, 2.5, OCHRE_D), r(x + w * 0.1, y + h * 0.2, w * 0.8, 3, OCHRE_D, 1)]
    if tops:
        n = int(w // 9)
        for i in range(n):
            out.append(c(x + 5 + i * (w - 10) / max(n - 1, 1), y - 2, 2.6, '#5a2e1c'))
    return ''.join(out)


def pack(x, y, w, h, col):
    # shrink-wrapped pack of big bottles
    out = [r(x, y, w, h, col, 3)]
    n = int(w // 12)
    for i in range(n):
        bx = x + 4 + i * (w - 8) / n
        out.append(r(bx, y + 6, (w - 8) / n - 3, h - 10, '#ffffff', 3, 'opacity="0.22"'))
    out.append(r(x, y + h * 0.35, w, 6, '#ffffff', 0, 'opacity="0.35"'))
    return ''.join(out)


def sack(x, y, w, h, fill='#e2cfa6'):
    return (f'<path d="M{x} {y + h} q-4 {-h * 0.6} {w * 0.12} {-h * 0.85} q{w * 0.38} -14 {w * 0.76} 0 '
            f'q{w * 0.16} {h * 0.25} {w * 0.12} {h * 0.85} z" fill="{fill}"/>'
            f'<path d="M{x + w * 0.14} {y + h * 0.2} q{w * 0.36} -10 {w * 0.72} 0" fill="none" stroke="#b89a66" stroke-width="2"/>'
            f'<ellipse cx="{x + w * 0.5:.1f}" cy="{y + h * 0.16:.1f}" rx="{w * 0.3:.1f}" ry="5" fill="#f1e2c0"/>')


def jar(x, y, w, h, fill):
    return (r(x, y + 6, w, h - 6, '#e9efe9', 5, 'opacity="0.9"') + r(x + 3, y + h * 0.35, w - 6, h * 0.6, fill, 3) +
            r(x - 1, y, w + 2, 8, MAROON, 2))


def toran(x, y, w, n=14):
    out = [f'<path d="M{x} {y} q{w / 2} 26 {w} 0" fill="none" stroke="{OLIVE}" stroke-width="2"/>']
    for i in range(n + 1):
        f = i / n
        px = x + f * w
        py = y + 52 * f * (1 - f)
        out.append(c(px, py + 4, 5, '#e98b22' if i % 2 else OCHRE))
        if i % 2 == 0:
            out.append(f'<path d="M{px:.1f} {py + 8:.1f} l-3 10 l3 -2 l3 2 z" fill="{OLIVE}"/>')
    return ''.join(out)


def signboard(x, y, w, h, text, size, fill=MAROON, tcol=CREAM, family=DEVA):
    return r(x, y, w, h, fill, 4) + r(x + 4, y + 4, w - 8, h - 8, 'none', 3, f'stroke="{tcol}" stroke-opacity="0.35" stroke-width="1.2"') + \
        t(x + w / 2, y + h / 2 + size * 0.36, text, size, tcol, family)


def ground(y=262, fill='#d9c2a2'):
    return r(0, y, 500, 300 - y, fill) + r(0, y, 500, 3, '#c6a985')


def svg(inner, label):
    return (f'<svg viewBox="0 0 500 300" width="500" height="300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{label}" '
            f'preserveAspectRatio="xMidYMid slice" style="display: block;">{inner}</svg>')


# ---------------------------------------------------------------- personas

def illo_01():
    s = [sky((58, 58), 26), tree(470, 70, 1.1)]
    s.append(r(60, 40, 440, 230, WALL))
    s.append(signboard(92, 52, 380, 46, 'मौली जनरल स्टोअर्स', 30))
    s.append(awning(80, 104, 404, 26, 12, MAROON, CREAM))
    s.append(goods_shelf(104, 140, 250, 122, 4, 11))
    s.append(cooler(372, 136, 92, 128, seed=3))
    s.append(ground())
    s.append(r(96, 226, 272, 40, '#b98a5c', 3) + r(96, 226, 272, 7, '#a0724a'))
    for i, col in enumerate(['#e8b64a', '#c2412f', '#6b8e3a', '#e07b2e']):
        s.append(jar(120 + i * 34, 198, 24, 30, col))
    s.append(sack(20, 222, 58, 50) + sack(62, 232, 50, 40, '#d8c294'))
    # chalkboard
    s.append(r(10, 128, 58, 80, '#2f3a2e', 4) + r(10, 128, 58, 80, 'none', 4, f'stroke="#8a5f3f" stroke-width="4"'))
    for i, w in enumerate(['थंड पेय', 'पाणी', 'सरबत']):
        s.append(t(39, 152 + i * 20, w, 13, '#f1ead8'))
    return svg(''.join(s), 'A busy kirana with a striped awning, full shelves, a company cooler and sacks of grain')


def illo_02():
    s = [sky((440, 60), 24)]
    s.append(r(110, 52, 300, 216, WALL_D))
    s.append(signboard(130, 62, 260, 42, 'समर्थ किराणा', 28, OLIVE))
    s.append(awning(120, 110, 280, 22, 8, OLIVE, CREAM))
    # half-down shutter
    s.append(r(146, 140, 228, 40, '#b8ada0'))
    for i in range(7):
        s.append(r(146, 143 + i * 5.5, 228, 1.4, '#9b8f82'))
    s.append(goods_shelf(146, 180, 228, 82, 2, 22, big=True))
    s.append(ground())
    s.append(r(140, 234, 240, 32, '#b98a5c', 3) + r(140, 234, 240, 6, '#a0724a'))
    # credit ledger on the counter
    s.append(r(290, 222, 46, 14, '#c2412f', 2) + r(292, 219, 42, 4, '#f1ead8', 1))
    # classic "cash today, credit tomorrow" sign
    s.append(r(18, 120, 82, 58, CREAM, 4, f'stroke="{INK}" stroke-width="1.5"'))
    s.append(t(59, 144, 'आज रोख', 15, INK) + t(59, 166, 'उद्या उधार', 15, MAROON))
    s.append(r(412, 190, 60, 72, '#e9dcc8', 3) + t(442, 214, '२.२५ L', 12, INK, extra='opacity="0.8"'))
    for i in range(3):
        s.append(r(420 + i * 16, 222, 11, 36, BOTTLES[i + 1], 3) + r(423 + i * 16, 216, 5, 7, BOTTLES[i + 1], 1))
    return svg(''.join(s), 'A narrow neighbourhood kirana with a half-closed shutter, big bottles on the shelf and no cooler')


def illo_03():
    s = [sky((70, 70), 36, heat=True)]
    s.append(r(120, 36, 380, 234, WALL))
    s.append(signboard(146, 48, 330, 48, 'ठंडा कॉर्नर', 32, SLATE))
    s.append(awning(132, 102, 356, 22, 10, SLATE, CREAM))
    s.append(r(146, 132, 330, 132, DARK))
    s.append(cooler(166, 128, 120, 136, seed=5))
    s.append(cooler(300, 128, 120, 136, dim=True, seed=8))
    # lightning bolt tag on the dim cooler: power cut
    s.append(c(418, 142, 13, OCHRE) + f'<path d="M420 133 l-7 11 h5 l-2 8 l8 -11 h-5 z" fill="{INK}"/>')
    s.append(ground())
    # ice box
    s.append(r(430, 222, 56, 40, '#e8eef0', 5) + r(430, 222, 56, 10, '#c9d6db', 5) + r(452, 214, 12, 8, '#9fb0b7', 2))
    s.append(r(30, 200, 80, 64, '#b98a5c', 3))
    for i in range(4):
        s.append(r(38 + i * 18, 176, 11, 26, BOTTLES[(i + 2) % 7], 3) + r(41 + i * 18, 170, 5, 7, BOTTLES[(i + 2) % 7], 1))
    return svg(''.join(s), 'A cold-drink shop with two company coolers under a hot sun; one cooler is dim from a power cut')


def illo_04():
    s = [r(0, 0, 500, 300, SKY), c(420, 60, 30, SUN), c(420, 60, 44, '#f6cf94', 'opacity="0.45"')]
    # far bank and lake
    s.append(f'<path d="M0 150 q60 -26 120 -8 q70 -30 150 -4 q80 -26 140 0 q50 -14 90 -4 V190 H0z" fill="{OLIVE_L}"/>')
    s.append(tree(60, 118, 0.6) + tree(300, 116, 0.55))
    s.append(r(0, 176, 500, 124, WATER))
    for i in range(6):
        y = 196 + i * 16
        x0 = (i * 57) % 120
        s.append(f'<path d="M{x0} {y} q12 -5 24 0 t24 0 M{x0 + 200} {y + 6} q12 -5 24 0 t24 0" fill="none" stroke="#e9f0f1" stroke-width="2" stroke-linecap="round" opacity="0.8"/>')
    s.append(r(0, 250, 500, 50, '#d9c2a2') + r(0, 250, 500, 3, '#c6a985'))
    # umbrella
    s.append(r(236, 100, 4, 130, '#6d4b31'))
    for i in range(8):
        a0 = 3.14159 * i / 8
        import math
        x1 = 238 - 110 * math.cos(a0); y1 = 104 - 60 * math.sin(a0)
        a1 = 3.14159 * (i + 1) / 8
        x2 = 238 - 110 * math.cos(a1); y2 = 104 - 60 * math.sin(a1)
        col = MAROON if i % 2 == 0 else CREAM
        s.append(f'<path d="M238 104 L{x1:.1f} {y1:.1f} L{x2:.1f} {y2:.1f} z" fill="{col}"/>')
    # cart
    s.append(r(150, 176, 180, 62, '#c98b4a', 4) + r(150, 176, 180, 12, '#a86f38', 4))
    s.append(r(176, 196, 128, 30, CREAM, 3) + t(240, 218, 'भेळ · थंड पेय', 18, MAROON))
    s.append(c(175, 246, 14, INK) + c(175, 246, 5, '#b8ada0') + c(305, 246, 14, INK) + c(305, 246, 5, '#b8ada0'))
    for i in range(5):
        s.append(r(160 + i * 13, 152, 9, 24, BOTTLES[(i * 2) % 7], 3) + r(162 + i * 13, 146, 5, 7, BOTTLES[(i * 2) % 7], 1))
    s.append(r(268, 160, 50, 16, '#e8b64a', 3))
    # ice box
    s.append(r(346, 206, 70, 46, '#eef3f4', 6) + r(346, 206, 70, 12, '#c9d6db', 6) + r(372, 198, 18, 8, '#9fb0b7', 2))
    return svg(''.join(s), 'A snack cart under a striped umbrella by the lake, with an ice box beside it')


def illo_05():
    s = [sky((60, 56), 24)]
    s.append(r(40, 60, 460, 210, '#f0e2c8'))
    s.append(f'<path d="M30 64 L270 22 L510 64 z" fill="{MAROON}"/>')
    s.append(signboard(176, 70, 188, 30, 'SUNRISE SCHOOL', 15, MAROON, CREAM, "'Source Serif 4', Georgia, serif"))
    # clock
    s.append(c(270, 44, 12, CREAM) + f'<path d="M270 37 v7 h5" stroke="{INK}" stroke-width="2" fill="none"/>')
    for row in range(2):
        for col in range(5):
            if row == 1 and col in (1, 2):
                continue
            s.append(r(62 + col * 86, 112 + row * 70, 50, 44, '#9fb7bf', 3) + r(62 + col * 86, 132 + row * 70, 50, 2, CREAM))
    # canteen window
    s.append(r(140, 176, 150, 88, DARK, 3))
    s.append(awning(132, 166, 166, 16, 6, OLIVE, CREAM))
    s.append(t(215, 200, 'CANTEEN', 13, CREAM, "'Source Serif 4', Georgia, serif", weight=600, extra='letter-spacing="2"'))
    s.append(cooler(236, 206, 44, 58, seed=12))
    for i in range(3):
        s.append(r(152 + i * 22, 236, 16, 22, ['#e8b64a', '#e07b2e', '#6f8fa6'][i], 2))
    s.append(r(132, 258, 166, 8, '#a0724a'))
    s.append(ground(266))
    # vacation notice
    s.append(r(330, 186, 120, 70, CREAM, 3, f'stroke="{INK}" stroke-width="1.5"'))
    s.append(r(330, 186, 120, 18, MAROON, 3))
    s.append(t(390, 199, 'सुट्टी', 13, CREAM))
    s.append(t(390, 224, '२ मे – १४ जून', 14, INK) + t(390, 245, 'शाळा बंद', 13, MAROON))
    return svg(''.join(s), 'A school building with a small canteen window and a notice: school closed 2 May to 14 June')


def illo_06():
    s = [r(0, 0, 500, 300, '#f1dccb')]
    for i in range(7):
        s.append(c(40 + i * 72, 30 + (i % 2) * 8, 3, OCHRE, 'opacity="0.8"'))
    s.append(r(50, 70, 450, 200, '#f6ead6'))
    s.append(f'<path d="M40 74 L275 30 L510 74 z" fill="{MAROON}"/>')
    s.append(signboard(150, 78, 250, 44, 'शुभ मंगल', 30, MAROON))
    for i in range(3):
        x = 104 + i * 118
        s.append(f'<path d="M{x} 262 V172 a42 42 0 0 1 84 0 V262 z" fill="{DARK}"/>')
        s.append(f'<path d="M{x + 8} 262 V174 a34 34 0 0 1 68 0 V262 z" fill="#6b4a36"/>')
        for k in range(5):
            s.append(c(x + 20 + k * 11, 200 + (k % 2) * 6, 2.2, SUN))
    s.append(toran(92, 130, 350, 18))
    # banana leaves at the entrance
    for x in (84, 452):
        s.append(f'<path d="M{x} 262 q-18 -60 4 -110 q10 50 -4 110 z" fill="{OLIVE}"/>')
        s.append(f'<path d="M{x + 4} 262 q20 -52 0 -100" fill="none" stroke="{OLIVE_L}" stroke-width="3"/>')
    s.append(ground())
    s.append(pack(20, 226, 54, 36, '#c2412f') + pack(20, 192, 54, 34, '#e07b2e'))
    return svg(''.join(s), 'A wedding hall with three arches, a marigold garland and banana leaves at the entrance')


def illo_07():
    s = [sky((60, 54), 22)]
    s.append(f'<path d="M40 92 L270 40 L500 92 z" fill="#8a7a6a"/>')
    for i in range(12):
        s.append(f'<path d="M{60 + i * 38} {88 - i * 0} L{270 + (i - 6) * 8} 44" stroke="#a09080" stroke-width="1.2"/>')
    s.append(r(50, 90, 450, 180, '#d8cbb8'))
    s.append(signboard(120, 100, 320, 40, 'महालक्ष्मी एजन्सी', 26, OCHRE_D))
    s.append(r(86, 150, 380, 116, '#5d4a3c'))
    s.append(r(86, 150, 380, 14, '#b8ada0'))
    for i in range(3):
        s.append(r(86, 150 + i * 4, 380, 1.2, '#9b8f82'))
    # stacks of packs
    cols = ['#c2412f', '#e07b2e', '#5a2e1c', '#6f8fa6']
    for sx, n in ((100, 3), (170, 3), (240, 2), (310, 3)):
        for k in range(n):
            s.append(pack(sx, 232 - k * 30, 62, 28, cols[(sx // 70 + k) % 4]))
    for k in range(3):
        s.append(crate(390, 234 - k * 24, 60, 22))
    s.append(r(96, 262, 360, 6, '#a0724a'))
    s.append(ground(266))
    # hand truck
    s.append(f'<path d="M470 190 V262 h18" stroke="{INK}" stroke-width="4" fill="none" stroke-linecap="round"/>' + c(476, 264, 7, INK))
    return svg(''.join(s), 'A drinks warehouse with its shutter up and stacks of big-bottle packs and crates')


def illo_08():
    s = [sky((450, 54), 24)]
    s.append(r(70, 50, 360, 220, '#f2e4cc'))
    s.append(signboard(96, 60, 308, 44, 'आशीर्वाद जनरल स्टोअर', 25, OLIVE))
    s.append(toran(96, 102, 308, 16))
    s.append(goods_shelf(116, 138, 268, 124, 4, 81, sparse=0.55))
    s.append(ground())
    s.append(r(108, 230, 284, 36, '#c9a172', 3) + r(108, 230, 284, 6, '#b08758'))
    # "new owner" banner
    s.append(f'<path d="M300 170 h120 l-12 16 l12 16 h-120 z" fill="{MAROON}"/>')
    s.append(t(354, 192, 'नवीन मालक', 16, CREAM))
    # paint can and brush: fresh paint
    s.append(r(22, 222, 34, 40, '#9fb7bf', 3) + r(22, 222, 34, 8, '#6f8fa6', 3) + f'<path d="M50 214 l20 -40" stroke="#8a5f3f" stroke-width="4" stroke-linecap="round"/>' + r(64, 166, 14, 12, '#e8b64a', 2, 'transform="rotate(26 71 172)"'))
    # coconut and kalash (opening puja)
    s.append(c(446, 240, 16, OCHRE) + r(434, 222, 24, 6, OCHRE_D, 2) + c(446, 216, 10, '#6d4b31'))
    return svg(''.join(s), 'A freshly painted shop with a marigold garland, sparse shelves and a banner saying new owner')


ILLOS = {1: illo_01, 2: illo_02, 3: illo_03, 4: illo_04, 5: illo_05, 6: illo_06, 7: illo_07, 8: illo_08}
