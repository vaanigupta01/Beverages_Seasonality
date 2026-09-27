# Builds the persona sheets: an overview plus one A4 page per persona (a Design canvas of 9 artboards),
# and print.html for the PDF.
#   Top of each sheet   = the TYPE (content.py; no shop-specific numbers).
#   Boxed, lower down   = EXAMPLE IN OUR DATA: every number read here from data/*.json and
#                         docs/validation/summary.json (order-date method, as the app counts).
# Run after scripts/generate_data.py:  python3 scripts/persona_sheets/build.py [output folder]
import json, math, sys, datetime as dt
from datetime import date
from pathlib import Path
from content import PERSONAS, ROLES, TYPE_MAP
from illos import ILLOS

REPO = Path(__file__).resolve().parents[2]
D = {n: json.loads((REPO / 'data' / f'{n}.json').read_text(encoding='utf-8'))
     for n in ('config', 'outlets', 'orders', 'visits', 'schemes', 'distributor_stock', 'peers', 'calendar')}
S = json.loads((REPO / 'docs' / 'validation' / 'summary.json').read_text(encoding='utf-8'))['outlets']
ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / 'build' / 'persona-sheets'
W, H = 794, 1123   # A4 portrait at 96 px/in
DEMO = date.fromisoformat(D['config']['demoDate'])

PAPER = '#f6eee4'; PANEL = '#fdf9f3'; INK = '#2b211b'; SOFT = '#5e5047'; MAROON = '#9b1c23'
PINK = '#f5e1db'; SAGE = '#e9ecdf'; OLIVE = '#56642f'; LINE = '#e6d8c8'; C25 = '#8a9a5b'; C26 = '#9b1c23'
DISPLAY = "'DM Serif Display', Georgia, serif"
BODY = "'Source Serif 4', Georgia, serif"
FONTS = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display'
         '&amp;family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400'
         '&amp;family=Tiro+Devanagari+Marathi&amp;display=swap">')
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

ICONS = {
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    'list': '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    'target': '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3"/>',
    'alert': '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5"/><path d="M12 17.2v.3"/>',
    'cart': '<path d="M3 4h2.5l2.2 10.5h10.3L20 7.5H6.4"/><circle cx="9.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/>',
    'bulb': '<path d="M9 17.5h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    'gauge': '<path d="M3.5 17a8.5 8.5 0 1 1 17 0"/><path d="M12 17l4.5-5.5"/><circle cx="12" cy="17" r="1.3"/>',
}


def icon(name, size, color, sw=1.8):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0;">{ICONS[name]}</svg>')


def esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def rs(x, step=100):
    """Rupees rounded to `step`, with Indian grouping."""
    s = str(int(math.floor(x / step + 0.5) * step))   # round half up
    if len(s) <= 3:
        return f'₹{s}'
    head, tail, parts = s[:-3], s[-3:], []
    while len(head) > 2:
        parts.insert(0, head[-2:])
        head = head[:-2]
    if head:
        parts.insert(0, head)
    return '₹' + ','.join(parts + [tail])


def dshort(iso):
    d = date.fromisoformat(iso)
    return f'{d.strftime("%a")} {d.day} {d.strftime("%b")}'


def wrap_dc(title, inner):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{esc(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
{FONTS}
<style>
body{{margin:0;background:{PAPER};font-family:{BODY};color:{INK}}}
a{{color:{MAROON}}}a:hover{{color:#761419}}
</style>
</helmet>
{inner}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{W},"height":{H}}}}}'>
class Component extends DCLogic {{
  renderVals() {{
    return {{}};
  }}
}}
</script>
</body>
</html>
'''


def pill(text, bg, size=11.5, fg='#fcf6ec', border=None):
    b = f'border: 1px solid {border};' if border else ''
    return (f'<span style="display: inline-flex; padding: 2px 9px; border-radius: 999px; background: {bg}; color: {fg}; {b}'
            f'font-size: {size}px; font-weight: 600; letter-spacing: 0.02em; white-space: nowrap;">{esc(text)}</span>')


def role_pill(role, size=11.5):
    label, col = ROLES[role]
    return pill(label, col, size)


def primary_pill(size=11.5):
    return pill('Primary', 'transparent', size, MAROON, MAROON)


# ------------------------------------------------------------------ example facts (all from data/)

def outlet(oid):
    return next(o for o in D['outlets']['outlets'] if o['id'] == oid)


def cadence_text(days):
    return {7: 'weekly visits', 14: 'visits every 2 weeks', 10: 'visits every 10 days', 28: 'visits every 4 weeks'}[days]


def cooler_text(c):
    if c['type'] == 'bottler':
        return f'{"One" if c["count"] == 1 else "Two"} {c["litres"]} L company cooler{"s" if c["count"] > 1 else ""}'
    return {'ice-box': 'His own ice box', 'none': 'None, shelf only', 'own-fridge': 'Own fridge'}[c['type']]


def credit_text(c):
    return f'{rs(c["limit"], 1)} limit · ' + (f'{rs(c["overdue"], 1)} overdue' if c['overdue'] else 'no dues')


def april_uses(oid):
    month = DEMO.strftime('%Y-%m')
    return sum(l['freeCases'] for o in D['orders']['orders'] if o['outletId'] == oid and o['date'].startswith(month)
               and 'SCH-SS26' in o['schemeIds'] for l in o['lines'] if l['sku'] in ('CL250', 'LL250', 'CL200G'))


def example(p):
    oid = p['id']
    o, v, s = outlet(oid), D['visits']['outlets'][oid], S[oid]
    nxt = dshort(v['nextVisitAfterToday'])
    rows = [('Tier', f'{o["tier"]} · {cadence_text(v["cadenceDays"])}'),
            ('Cold storage', cooler_text(o['cooler'])),
            ('Credit', credit_text(o['credit']))]
    if s.get('winterOrder'):
        pk = MONTHS[s['peakMonthByOrderDate'] - 1]
        rows.append(('Typical order', f'winter ≈ {rs(s["winterOrder"]["value"])} · {pk} 2025 ≈ {rs(s["peakMonthOrderByDate"]["value"])}'))
    else:
        rows.append(('Typical order', 'none yet: today is the first'))
    stock = {i['sku']: i for i in D['distributor_stock']['items']}
    if oid == 'OUT-01':
        f = [f'Summer Single-Serve: {april_uses(oid)} of 4 April uses taken',
             f'250 ml cola rationed to {stock["CL250"]["maxCasesPerOutlet"]} cases; mango 600 ml out', f'Next visit {nxt}']
    elif oid == 'OUT-02':
        room = o['credit']['limit'] - o['credit']['outstanding']
        f = [f'Credit room {rs(room, 1)}', 'Unplanned 5-case order on 19 May 2025, a week before the rain', f'Next visit {nxt}']
    elif oid == 'OUT-03':
        a = o['cooler']['lastAudit']
        f = [f'Summer Single-Serve: {april_uses(oid)} of 4 April uses taken',
             f'Cooler at {a["tempC"]}°C at the {dshort(a["date"])} audit (standard 6°C)', f'Next visit {nxt}']
    elif oid == 'OUT-04':
        b = s['biggestOrder2025']
        f = [f'Next visit {nxt}, four weeks away', '1–3 May long weekend ahead (tourist spot)',
             f'Biggest 2025 order {dshort(b["date"])}: {b["cases"]} cases, over his limit']
    elif oid == 'OUT-05':
        c = [x for x in o['closures'] if x['to'] >= DEMO.isoformat()][0]
        f = [f'Shut {date.fromisoformat(c["from"]).day} May – {date.fromisoformat(c["to"]).day} Jun; reopens 15 Jun',
             'A delivery on Wed 29 Apr has two days to sell', 'Stocks water and mango drinks only']
    elif oid == 'OUT-06':
        b, until = o['bookings'], v['nextVisitAfterToday']
        near = [x for x in b if x['date'] <= until]
        f = [f'{len(b)} bookings to {dshort(b[-1]["date"])}, ≈ {sum(x["expectedCases"] for x in b)} cases (est.)',
             f'{len(near)} before the next visit ({dshort(until)}): ≈ {sum(x["expectedCases"] for x in near)} cases, '
             f'≈ {rs(s["todayCover"]["value"], 500)} (est.), over his limit',
             'Asked for an ₹18,000 limit (rep’s note)']
    elif oid == 'OUT-07':
        b = s['biggestOrder2025']
        f = [f'Biggest 2025 order {dshort(b["date"])}: {b["cases"]} cases (financial year-end)',
             'Loads up at every month-end; today is April’s last visit', f'Next visit {nxt}']
    else:
        g = next(x for x in D['peers']['groups'] if x['key'] == 'kirana|Bronze|no-cooler')
        fort = sum(w['2026-W18'] + w['2026-W19'] for w in g['weeklyCasesBySku'].values())
        f = [f'Registered {dshort(o["registeredOn"])} 2026; no orders or visits yet',
             f'{g["outletsInGroup"]} similar shops nearby: ≈ {fort:.0f} cases a fortnight (est.)', 'First order gets 12% off (New Outlet)']
    return o, rows, f


def lift_line(p):
    s = S[p['id']]
    if not s.get('monthlyByOrderDate2025'):
        return 'No history yet, so the chart is empty on purpose.'
    pk = MONTHS[s['peakMonthByOrderDate'] - 1]
    if p['id'] == 'OUT-05':
        return f'No summer peak: {s["monthlyByOrderDate2025"][4]} cases in May, while the school was shut.'
    if p['id'] == 'OUT-04':
        return f'2025 peak: {pk}, {s["liftByOrderDate"]}× Jan–Feb. His biggest order came ≈ 2 weeks after the route’s peak week.'
    if p['id'] == 'OUT-06':
        return f'2025 peak: {pk} (weddings), {s["liftByOrderDate"]}× Jan–Feb. Monsoon months near zero.'
    return f'2025 peak: {pk}, {s["liftByOrderDate"]}× the Jan–Feb average.'


def chart(p, w=318, h=126):
    s = S[p['id']]
    has = bool(s.get('monthlyByOrderDate2025'))
    m25 = s.get('monthlyByOrderDate2025') or [0] * 12
    m26 = s.get('monthlyByOrderDate2026JanApr') or [0] * 4
    x0, x1, top, base = 6, w - 4, 16, h - 18
    slot = (x1 - x0) / 12
    vmax = max(m25 + m26 + [1]) * 1.12
    y = lambda v: base - (base - top) * v / vmax
    out = [f'<line x1="{x0}" y1="{base}" x2="{x1}" y2="{base}" stroke="#b3a591" stroke-width="1"/>']
    pk = s.get('peakMonthByOrderDate', 0) - 1
    for i in range(12):
        cx = x0 + slot * i + slot / 2
        if i < 4:
            bw = slot * 0.36
            out.append(f'<rect x="{cx - bw - 1:.1f}" y="{y(m25[i]):.1f}" width="{bw:.1f}" height="{base - y(m25[i]):.1f}" fill="{C25}" rx="1.5"/>')
            out.append(f'<rect x="{cx + 1:.1f}" y="{y(m26[i]):.1f}" width="{bw:.1f}" height="{base - y(m26[i]):.1f}" fill="{C26}" rx="1.5"/>')
            lx = cx - bw / 2 - 1
        else:
            bw = slot * 0.5
            out.append(f'<rect x="{cx - bw / 2:.1f}" y="{y(m25[i]):.1f}" width="{bw:.1f}" height="{base - y(m25[i]):.1f}" fill="{C25}" rx="1.5"/>')
            lx = cx
        if has and i == pk:
            ly = min(y(m25[i]), y(m26[i])) if i < 4 else y(m25[i])
            out.append(f'<text x="{cx:.1f}" y="{ly - 4:.1f}" font-family="{BODY}" font-size="11" font-weight="700" fill="{INK}" text-anchor="middle" stroke="{PANEL}" stroke-width="3" paint-order="stroke">{m25[i]}</text>')
        out.append(f'<text x="{cx:.1f}" y="{base + 13:.1f}" font-family="{BODY}" font-size="10" fill="{SOFT}" text-anchor="middle">{MONTHS[i][0]}</text>')
    if not has:
        out.append(f'<text x="{w / 2}" y="{h / 2}" font-family="{BODY}" font-size="13" font-style="italic" fill="{SOFT}" text-anchor="middle">No orders before 28 Apr 2026</text>')
    return (f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" role="img" '
            f'aria-label="Cases booked each month, 2025 and January to April 2026" style="display: block;">{"".join(out)}</svg>')


# ------------------------------------------------------------------ persona sheet

def bullets(items, size=13.5, gap=5):
    lis = ''.join(
        f'<li style="display: flex; gap: 8px; align-items: flex-start; font-size: {size}px; line-height: 1.36; text-wrap: pretty;">'
        f'<span style="width: 4px; height: 4px; margin-top: {size * 0.55:.1f}px; border-radius: 50%; background: currentColor; opacity: 0.7; flex-shrink: 0;"></span>'
        f'<span>{esc(t)}</span></li>' for t in items)
    return f'<ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: {gap}px; color: {INK};">{lis}</ul>'


def small_card(ic, title, items, sage):
    bg, tc, icc = (SAGE, INK, OLIVE) if sage else (PINK, MAROON, MAROON)
    return (f'<section style="box-sizing: border-box; background: {bg}; border-radius: 12px; padding: 11px 14px; display: flex; flex-direction: column; gap: 7px;">'
            f'<div style="display: flex; align-items: center; gap: 8px;">{icon(ic, 18, icc)}'
            f'<h3 style="margin: 0; font-family: {DISPLAY}; font-weight: 400; font-size: 17px; line-height: 1.1; color: {tc};">{title}</h3></div>'
            f'{bullets(items)}</section>')


def persona_sheet(p):
    no = f'{p["no"]:02d}'
    pills = role_pill(p['role']) + (primary_pill() if p['primary'] else '')
    header = (
        f'<div style="position: absolute; top: 0; right: 0; width: 290px; height: 176px; border-bottom-left-radius: 26px; overflow: hidden;">'
        f'{ILLOS[p["no"]]().replace("width=\"500\" height=\"300\"", "width=\"294\" height=\"176\"")}</div>'
        f'<div style="position: absolute; top: 26px; left: 32px; width: 440px; display: flex; flex-direction: column; gap: 7px;">'
        f'<div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 11.5px; letter-spacing: 0.38em; font-weight: 600; margin-right: 4px;">PERSONA {no}</span>{pills}</div>'
        f'<h1 style="margin: 0; font-family: {DISPLAY}; font-weight: 400; font-size: 31px; line-height: 1.05; color: {MAROON};">{esc(p["label"])}</h1>'
        f'<p style="margin: 0; font-size: 14.5px; line-height: 1.38; text-wrap: pretty;">{esc(p["definition"])}</p>'
        f'<p style="margin: 0; font-size: 12.5px; line-height: 1.35; color: {SOFT};"><b style="color: {INK};">Also covers · </b>{esc(p["also"])}</p>'
        f'</div>')
    quote = (f'<div style="position: relative; box-sizing: border-box; background: {PINK}; border-radius: 12px; padding: 10px 16px 10px 48px;">'
             f'<span style="position: absolute; left: 14px; top: 0; font-family: {DISPLAY}; font-size: 44px; line-height: 1; color: {MAROON};">“</span>'
             f'<p style="margin: 0; font-style: italic; font-size: 15px; line-height: 1.4;">{esc(p["quote"])}</p></div>')
    driver = (f'<div style="box-sizing: border-box; background: {PANEL}; border: 1px solid {LINE}; border-radius: 12px; '
              f'padding: 8px 14px; display: flex; align-items: center; gap: 10px;">{icon("sun", 20, MAROON)}'
              f'<span style="font-size: 14px; line-height: 1.35;"><b style="color: {MAROON};">Season driver · </b>{esc(p["driver"])}'
              f'<span style="color: {SOFT};"> · typical peak in a normal year {esc(p["lift"])} (research Table D)</span></span></div>')
    conc = ''.join(
        f'<li style="display: flex; gap: 8px; align-items: flex-start; font-size: 13.5px; line-height: 1.36;">'
        f'<span style="flex-shrink: 0; width: 26px; margin-top: 1px; text-align: center; font-size: 10.5px; font-weight: 700; color: {MAROON}; '
        f'border: 1px solid #d9b3ab; border-radius: 6px; padding: 0 2px; line-height: 16px;">{tag}</span>'
        f'<span>{esc(t)}</span></li>'
        for t, tag in p['concerns'])
    concerns = (f'<section style="box-sizing: border-box; background: {PANEL}; border: 1px solid {LINE}; '
                f'border-radius: 12px; padding: 11px 14px; display: flex; flex-direction: column; gap: 8px;">'
                f'<div style="display: flex; align-items: center; gap: 8px;">{icon("list", 18, MAROON)}'
                f'<h3 style="margin: 0; font-family: {DISPLAY}; font-weight: 400; font-size: 17px; color: {INK};">General concerns of this type</h3>'
                f'<span style="margin-left: auto; font-size: 11px; color: {SOFT};">G = cause in research Table G · § = Industry_Context</span></div>'
                f'<ul style="margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 22px;">{conc}</ul></section>')
    grid = (f'<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); '
            f'grid-template-rows: repeat(2, auto); gap: 10px;">'
            f'{small_card("target", "Goals", p["goals"], True)}{small_card("alert", "Frustrations", p["frustrations"], False)}'
            f'{small_card("cart", "How they buy", p["buy"], False)}{small_card("bulb", "What they need from the rep", p["needs"], True)}</div>')

    o, rows, facts = example(p)
    kv = ''.join(f'<div style="display: flex; gap: 8px; font-size: 13px; line-height: 1.35;"><span style="width: 86px; flex-shrink: 0; color: {SOFT};">{esc(k)}</span>'
                 f'<span style="font-weight: 600;">{esc(val)}</span></div>' for k, val in rows)
    ex = (f'<section style="box-sizing: border-box; background: {PANEL}; '
          f'border: 1.5px dashed #b7a58f; border-radius: 14px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px;">'
          f'<div style="display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;">'
          f'<span style="font-size: 11px; letter-spacing: 0.2em; font-weight: 700; color: {MAROON};">EXAMPLE IN OUR DATA</span>'
          f'<span style="font-family: {DISPLAY}; font-size: 17px;">{esc(o["name"])}</span>'
          f'<span style="font-size: 12.5px; color: {SOFT};">{esc(o["area"])} · owner {esc(o["owner"]["name"])}</span></div>'
          f'<div style="display: flex; gap: 18px;">'
          f'<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 5px; min-width: 0;">{kv}'
          f'<div style="margin-top: 4px; font-size: 11.5px; letter-spacing: 0.1em; font-weight: 700; color: {SOFT};">AS OF TUE 28 APR 2026</div>'
          f'{bullets(facts, 13, 3)}</div>'
          f'<div style="width: 318px; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px;">'
          f'<div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: {SOFT};">'
          f'<span>Cases a month, by order date</span><span style="display: flex; gap: 10px; align-items: center;">'
          f'<span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 9px; height: 9px; background: {C25}; border-radius: 2px;"></span>2025</span>'
          f'<span style="display: inline-flex; align-items: center; gap: 4px;"><span style="width: 9px; height: 9px; background: {C26}; border-radius: 2px;"></span>2026 to 26 Apr</span></span></div>'
          f'{chart(p)}'
          f'<span style="font-size: 12px; line-height: 1.35; color: {INK};">{esc(lift_line(p))}</span></div></div></section>')

    sc = (f'<section style="box-sizing: border-box; background: {INK}; color: #fcf6ec; border-radius: 12px; '
          f'padding: 10px 16px; display: flex; gap: 12px; align-items: flex-start;">{icon("gauge", 22, "#f5e1db")}'
          f'<div style="display: flex; flex-direction: column; gap: 3px; font-size: 13px; line-height: 1.38;">'
          f'<span><b>Season Check here · fires </b>{esc(p["fires"])}<span style="opacity: 0.8;"> · stays silent on {esc(p["silent"])}</span></span>'
          f'<span><b>The rep sees · </b><i>“{esc(p["sees"])}”</i></span></div></section>')
    conf_col = {'High': OLIVE, 'Medium': '#8a5512', 'Low': MAROON}[p['confidence']]
    ev = (f'<div style="display: flex; flex-direction: column; gap: 3px; font-size: 12px; line-height: 1.4; color: {SOFT};">'
          f'<span><b style="color: {INK};">Based on · </b>{esc(p["based"])}</span>'
          f'<span><b style="color: {INK};">Confidence · </b><b style="color: {conf_col};">{p["confidence"]}</b>'
          f'<span> · <b style="color: {INK};">We’d check by · </b>{esc(p["check"])}</span></span></div>')
    footer = (f'<div style="position: absolute; top: 1086px; left: 32px; width: 730px; display: flex; justify-content: space-between; font-size: 10.5px; color: {SOFT};">'
              f'<span>Fictional outlet and owner · numbers are estimates (est.) modelled from research · demo date Tue 28 Apr 2026</span><span>Persona {no} of 08</span></div>')
    return (f'<div style="position: relative; width: {W}px; height: {H}px; overflow: hidden; background: {PAPER}; font-family: {BODY}; color: {INK};">'
            f'{header}<div style="position: absolute; top: 186px; left: 32px; width: 730px; display: flex; flex-direction: column; gap: 10px;">'
            f'{quote}{driver}{concerns}{grid}{ex}{sc}{ev}</div>{footer}</div>')


# ------------------------------------------------------------------ overview

def overview():
    head_cells = ['Persona', 'Season set by', 'Cold storage', 'Cash room', 'Visits', 'History', 'Owner']
    widths = ['24%', '13%', '13%', '14%', '11%', '11%', '14%']
    th = ''.join(f'<th style="width: {w}; text-align: left; font-size: 11px; letter-spacing: 0.06em; font-weight: 700; color: {SOFT}; padding: 0 6px 7px 0;">{h.upper()}</th>'
                 for h, w in zip(head_cells, widths))
    trs = []
    for p in PERSONAS:
        name = (f'<div style="display: flex; flex-direction: column; gap: 3px;"><span style="display: flex; align-items: baseline; gap: 6px;">'
                f'<span style="font-family: {DISPLAY}; font-size: 15px; color: {MAROON};">{p["no"]:02d}</span>'
                f'<span style="font-size: 13.5px; font-weight: 700;">{esc(p["label"].replace("The ", ""))}</span></span>'
                f'<span style="display: flex; gap: 4px;">{role_pill(p["role"], 10)}{primary_pill(10) if p["primary"] else ""}</span></div>')
        tds = ''.join(f'<td style="font-size: 12.5px; line-height: 1.3; padding: 5px 6px 5px 0; border-top: 1px solid {LINE}; vertical-align: middle;">{esc(c)}</td>'
                      for c in TYPE_MAP[p['no']])
        trs.append(f'<tr><td style="padding: 5px 6px 5px 0; border-top: 1px solid {LINE};">{name}</td>{tds}</tr>')
    table = f'<table style="border-collapse: collapse; width: 100%; table-layout: fixed;"><thead><tr>{th}</tr></thead><tbody>{"".join(trs)}</tbody></table>'
    steps = [('Define', 'What the brief asks: span channels, tiers, cold chain, places and owners; show where the feature helps, stays quiet, and where data is thin.'),
             ('List', '15 outlet types from Industry_Context §3 and research Table D.'),
             ('Merge', 'Fold look-alikes together, so each persona behaves differently in season.'),
             ('Check', 'Every Season Check rule fires somewhere and stays silent somewhere.')]
    st = ''.join(f'<div style="display: flex; flex-direction: column; gap: 5px;"><div style="display: flex; align-items: center; gap: 8px;">'
                 f'<span style="width: 22px; height: 22px; border-radius: 50%; background: {MAROON}; color: #fcf6ec; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center;">{i + 1}</span>'
                 f'<b style="font-size: 14px;">{a}</b></div><span style="font-size: 12.5px; line-height: 1.38; color: {SOFT};">{esc(b)}</span></div>'
                 for i, (a, b) in enumerate(steps))
    out_scope = ['Modern trade and chains', 'Quick-commerce dark stores', 'Key accounts served by a key-account team', 'Outlets that buy only from a wholesaler']
    folded = [('Self-service mini-mart', '01'), ('Paan or tea stall', '04'), ('Cinema', '06'), ('Highway dhaba', '04 + 06')]
    return (
        f'<div style="position: relative; width: {W}px; height: {H}px; overflow: hidden; background: {PAPER}; font-family: {BODY}; color: {INK}; '
        f'box-sizing: border-box; padding: 30px 32px 24px; display: flex; flex-direction: column; gap: 12px;">'
        f'<div style="display: flex; flex-direction: column; gap: 7px;">'
        f'<span style="font-size: 11.5px; letter-spacing: 0.38em; font-weight: 600;">OUTLET PERSONAS</span>'
        f'<h1 style="margin: 0; font-family: {DISPLAY}; font-weight: 400; font-size: 32px; line-height: 1.05; color: {MAROON};">Eight types of outlet on one route</h1>'
        f'<p style="margin: 0; font-size: 15px; line-height: 1.45;"><b>Scope · </b>General-trade outlets on one Pune West route, in the summer season, for one decision: how much to order today. '
        f'The rep uses the app; these are the outlets he serves.</p>'
        f'<p style="margin: 0; font-size: 14px; line-height: 1.45; color: {SOFT};"><b style="color: {MAROON};">Primary: 01 and 03,</b> where the value is. '
        f'The other six are cases the feature must handle without doing harm.</p></div>'
        f'<section style="box-sizing: border-box; background: {PANEL}; border: 1px solid {LINE}; border-radius: 14px; padding: 14px 16px 6px;">'
        f'<h2 style="margin: 0 0 10px; font-family: {DISPLAY}; font-weight: 400; font-size: 19px;">Type map</h2>{table}</section>'
        f'<section style="box-sizing: border-box; background: {SAGE}; border-radius: 14px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;">'
        f'<h2 style="margin: 0; font-family: {DISPLAY}; font-weight: 400; font-size: 19px;">How we chose them</h2>'
        f'<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px;">{st}</div></section>'
        f'<section style="box-sizing: border-box; background: {PINK}; border-radius: 14px; padding: 14px 16px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px;">'
        f'<div style="display: flex; flex-direction: column; gap: 8px;"><h2 style="margin: 0; font-family: {DISPLAY}; font-weight: 400; font-size: 19px; color: {MAROON};">Not covered</h2>'
        f'{bullets(out_scope, 13.5, 4)}</div>'
        f'<div style="display: flex; flex-direction: column; gap: 8px;"><h2 style="margin: 0; font-family: {DISPLAY}; font-weight: 400; font-size: 19px; color: {MAROON};">Considered, folded in</h2>'
        f'{bullets([f"{a} → covered by {b}" for a, b in folded], 13.5, 4)}</div></section>'
        f'<div style="margin-top: auto; display: flex; justify-content: space-between; font-size: 10.5px; color: {SOFT};">'
        f'<span>All outlets and owners are fictional; numbers are estimates. Pune West · demo date Tue 28 Apr 2026.</span><span>Overview</span></div>'
        f'</div>')


# ------------------------------------------------------------------ write

def main():
    proj = ROOT / 'project'
    proj.mkdir(parents=True, exist_ok=True)
    for old in proj.glob('*.dc.html'):
        old.unlink()
    boards, order, pages = {}, [], []

    def add(fname, title, inner, x, y):
        (proj / fname).write_text(wrap_dc(title, inner), encoding='utf-8')
        boards[fname] = {'x': x, 'y': y, 'w': W, 'h': H, 'title': title}
        order.append(fname)
        pages.append((fname, inner))

    add('Main.dc.html', 'Overview · eight types of outlet', overview(), 0, 0)
    rows = [H + 420, 2 * (H + 420)]
    for i, p in enumerate(PERSONAS):
        add(p['file'] + '.dc.html', f'{p["no"]:02d} · {p["label"]}', persona_sheet(p), (i % 4) * (W + 80), rows[i // 4])
    row_w = 4 * W + 3 * 80
    canvas = {'v': 3, 'createdOnFiles': {'v': 1, 'at': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')},
              'title': 'Outlet Personas · Pune West', 'launch': {'view': 'canvas'}, 'pages': [], 'boards': boards, 'order': order,
              'notes': {'rowOverview': {'x': 0, 'y': -300, 'text': 'Outlet personas · Pune West', 'kind': 'title1', 'maxW': row_w},
                        'rowOne': {'x': 0, 'y': rows[0] - 300, 'text': 'Personas 01–04', 'kind': 'title1', 'maxW': row_w},
                        'rowTwo': {'x': 0, 'y': rows[1] - 300, 'text': 'Personas 05–08', 'kind': 'title1', 'maxW': row_w}},
              'designSystems': []}
    (proj / 'canvas.json').write_text(json.dumps(canvas, indent=1, ensure_ascii=False), encoding='utf-8')
    body = ''.join(f'<div class="sheet" data-name="{n}">{inner}</div>' for n, inner in pages)
    (ROOT / 'print.html').write_text(
        f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Outlet personas</title>{FONTS}'
        f'<style>@page{{size:{W}px {H}px;margin:0}}html,body{{margin:0;padding:0;background:{PAPER};font-family:{BODY};color:{INK}}}'
        f'.sheet{{break-after:page}}.sheet:last-child{{break-after:auto}}</style></head><body>{body}</body></html>', encoding='utf-8')
    print('wrote', len(order), 'artboards and print.html')


if __name__ == '__main__':
    main()
