#!/usr/bin/env python3
"""
Generates the prototype's dataset from the eight outlet personas.

Writes data/*.json exactly as in the data contract (PROGRESS.md -> "Shared · Data contract"),
plus two files for the persona work (not read by the app):
  docs/validation/summary.json  the numbers the persona sheets are drawn from
  docs/validation/checks.md     every check in "Validation and coverage", with its result

Every number is an estimate (est) built from the research: the Pune West weekly demand index
(Table A), the channel peak multipliers (Table D) and the dated events (Table C). The sample data
is not used. A fixed seed makes the output the same on every run. Standard library only.

Run from the project root:  python3 scripts/generate_data.py
"""
import json
import math
import random
import re
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

SEED = 20260428
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
VALID = ROOT / "docs" / "validation"
PERSONAS_MD = ROOT / "docs" / "personas.md"

DEMO = date(2026, 4, 28)          # Tuesday, 2026-W18
HIST_FROM = date(2024, 12, 30)    # Monday that starts 2025-W01
HIST_TO = date(2026, 4, 26)       # Sunday that ends 2026-W17

# =====================================================================================
# PERSONA SETTINGS (copied into docs/personas.md by this script)
#   base      cases a week in January 2025
#   peak      channel peak vs January in a normal year (research Table D); k = (peak - 1) / 1.8
#   timing    planner: sizes on the coming days · reactive: sizes on the last gap's sales
#             (lagDays) · bookings: sizes on the event calendar · front-loaded: buys ahead
#   cadence   days between visits (Diamond/Gold 7, Silver 10, Bronze 14, Iron 28)
#   mix       share of cases by SKU, %
# =====================================================================================
PERSONAS = {
    "OUT-01": dict(base=7.2, peak=2.7, timing="reactive in 2025 (lag 10 days, waits for scheme terms); planner in 2026",
                   cadence=7, mix=dict(CL250=22, LL250=8, CL200G=8, MG150T=8, MG600=6, WT1000=8, CL750=12, CL2250=18, OR1250=10),
                   story="No 250 ml cola in 2025-W16 (distributor out); 2026 runs ahead of 2025"),
    "OUT-02": dict(base=1.4, peak=1.6, timing="reactive (lag 14 days); capped at ₹2,700 of credit room",
                   cadence=14, mix=dict(CL2250=35, OR1250=25, CL750=15, CL250=15, MG150T=10),
                   story="Unplanned 5-case order on 19 May 2025, a week before the rain; June dip"),
    "OUT-03": dict(base=6.7, peak=3.8, timing="planner",
                   cadence=7, mix=dict(CL250=25, LL250=10, OR250=8, CL300C=12, EN250=12, CL200G=10, MG150T=8, WT500=10, WT1000=5),
                   story="Cold-pack dip in the power-cut week 2025-W18; all 4 April 2026 scheme uses spent"),
    "OUT-04": dict(base=0.5, peak=3.5, timing="reactive (lag 28 days); carries at most 9 cases; cash above his limit",
                   cadence=28, mix=dict(CL250=35, WT500=25, WT1000=15, MG150T=15, LL250=10),
                   story="Single-digit monthly orders that trail demand; the rest bought at the wholesale market"),
    "OUT-05": dict(base=2.7, peak=1.2, timing="calendar (term, exams ×0.6, closures ×0)",
                   cadence=10, mix=dict(WT500=50, WT1000=20, MG150T=30),
                   story="Zero orders while the school is shut; smaller orders in exam weeks"),
    "OUT-06": dict(base=8.4, peak=None, timing="bookings (monthly wedding index × a small heat effect)",
                   cadence=10, mix=dict(CL2250=30, OR1250=20, WT1000=20, CL200G=15, CL250=15),
                   story="December peak, monsoon lull; 14 bookings 29 Apr – 16 May 2026, then the adhik month"),
    "OUT-07": dict(base=27.7, peak=2.0, timing="front-loaded (buys 14 days ahead); month-end loads",
                   cadence=7, mix=dict(CL2250=40, OR1250=20, CL750=15, WT1000=15, CL250=10),
                   story="Month-end loads every month; the biggest at the financial year-end (25 Mar 2025, 102 cases)"),
    "OUT-08": dict(base=None, peak=1.8, timing="new: no orders before the demo date; estimate from peers.json",
                   cadence=14, mix=dict(CL2250=35, OR1250=20, CL750=15, CL250=15, MG150T=15),
                   story="Registered 22 Apr 2026; no orders and no visits yet"),
}

# Region index (Table A plus the values outside it). January's average week = 1.0. All est.
I25 = {w: 1.0 for w in range(1, 5)}
I25.update({5: 1.05, 6: 1.05, 7: 1.1, 8: 1.2})
for i, v in enumerate([1.3, 1.4, 1.5, 1.7, 1.9, 2.1, 2.4, 2.5, 2.4, 2.2, 2.0, 1.8, 1.6, 1.3, 1.2, 1.1, 1.1, 1.0, 1.0]):
    I25[9 + i] = v
I25.update({w: 0.9 for w in range(28, 36)})
I25.update({w: 0.95 for w in range(36, 39)})
I25.update({39: 1.0, 40: 1.05, 41: 1.1, 42: 1.1, 43: 1.1, 44: 1.05})
I25.update({w: 1.0 for w in range(45, 53)})
I26 = {1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.05, 6: 1.05, 7: 1.1, 8: 1.2}
for i, v in enumerate([1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.6, 2.8, 2.8, 2.7]):
    I26[9 + i] = v

# Week-to-week noise on order size (lognormal sigma). Small, cautious shops repeat the same basket.
NOISE = {"OUT-02": 0.05, "OUT-04": 0.08}

PHASES = {
    2025: [(1, 8, "off-season"), (9, 10, "pre-season"), (11, 14, "ramp"), (15, 19, "peak"), (20, 21, "decline"),
           (22, 38, "monsoon"), (39, 52, "off-season")],
    2026: [(1, 8, "off-season"), (9, 10, "pre-season"), (11, 14, "ramp"), (15, 18, "peak")],
}

# Wedding bookings index for the banquet hall, by month (est; 2025 wedding dates not researched).
BOOK = {2025: {1: 1.05, 2: 1.0, 3: 0.45, 4: 0.85, 5: 0.75, 6: 0.25, 7: 0.12, 8: 0.10, 9: 0.15, 10: 0.55, 11: 1.1, 12: 1.3},
        2026: {1: 1.05, 2: 1.0, 3: 0.45, 4: 0.95}}

# The 14 events the rep has recorded for the banquet hall (est).
BOOKINGS_06 = [
    ("2026-04-29", "Engagement, ~150 guests", 2), ("2026-04-30", "Wedding, ~350 guests", 5),
    ("2026-05-01", "Haldi, ~120 guests", 2), ("2026-05-02", "Wedding, ~450 guests", 6),
    ("2026-05-03", "Reception, ~300 guests", 4), ("2026-05-05", "Thread ceremony, ~150 guests", 2),
    ("2026-05-07", "Wedding, ~400 guests", 5), ("2026-05-08", "Sangeet, ~200 guests", 3),
    ("2026-05-09", "Wedding, ~500 guests", 7), ("2026-05-10", "Reception, ~250 guests", 3),
    ("2026-05-13", "Engagement, ~150 guests", 2), ("2026-05-14", "Haldi, ~120 guests", 2),
    ("2026-05-15", "Wedding, ~450 guests", 6), ("2026-05-16", "Wedding, ~400 guests", 6),
]

# School calendar for the canteen (2025 est; 2026 from Lokmat Times, 30 Mar 2026).
EXAMS = [(date(2025, 4, 15), date(2025, 4, 30)), (date(2026, 4, 15), date(2026, 4, 30))]
CLOSURES_05 = [
    (date(2025, 5, 1), date(2025, 6, 15), "Maharashtra Day holiday, then school summer vacation (reopened 16 Jun; 2025 dates est.)", True),
    (date(2025, 10, 16), date(2025, 11, 5), "Diwali break (dates est.)", True),
    (date(2026, 5, 1), date(2026, 6, 14), "Maharashtra Day holiday, then school summer vacation (reopens 15 Jun)", False),
]
REOPEN_RAMP = [(date(2025, 6, 16), date(2025, 6, 29))]

# Distributor supply events.
CL250_OUT = (date(2025, 4, 14), date(2025, 4, 20))   # no 250 ml cola for a week (est)
RATION_FROM = date(2026, 4, 20)                       # 250 ml cola rationed to 6 paid cases an order
MG600_OUT_FROM = date(2026, 4, 20)                    # mango 600 ml out at the distributor

PRODUCTS = [
    # sku, name, category, flavour, pack, ml, units, litres, mrp, shelf, chilled, single-serve, returnable, focus, summer mult, est fields
    ("CL200G", "Cola 200 ml returnable glass", "Sparkling", "Cola", "glass", 200, 24, 4.8, 10, 180, "yes", True, True, True, 3.0, ["summerMultiplier", "depositPerCrate"]),
    ("CL250", "Cola 250 ml PET", "Sparkling", "Cola", "PET", 250, 28, 7.0, 20, 120, "yes", True, False, True, 3.0, ["summerMultiplier"]),
    ("LL250", "Lemon-lime 250 ml PET", "Sparkling", "Lemon-lime", "PET", 250, 28, 7.0, 20, 120, "yes", True, False, False, 3.2, ["summerMultiplier"]),
    ("OR250", "Orange 250 ml PET", "Sparkling", "Orange", "PET", 250, 28, 7.0, 20, 120, "yes", True, False, False, 2.5, ["summerMultiplier"]),
    ("CL300C", "Cola 300 ml can", "Sparkling", "Cola", "can", 300, 24, 7.2, 40, 240, "yes", True, False, False, 2.0, ["summerMultiplier"]),
    ("CL750", "Cola 750 ml PET", "Sparkling", "Cola", "PET", 750, 24, 18.0, 40, 120, "partly", False, False, False, 2.2, ["summerMultiplier"]),
    ("OR1250", "Orange 1.25 L PET", "Sparkling", "Orange", "PET", 1250, 12, 15.0, 65, 180, "no", False, False, False, 1.8, ["summerMultiplier"]),
    ("CL2250", "Cola 2.25 L PET", "Sparkling", "Cola", "PET", 2250, 9, 20.25, 95, 180, "no", False, False, False, 1.8, ["summerMultiplier"]),
    ("MG150T", "Mango drink 150 ml Tetra", "Juice drinks", "Mango", "tetra", 150, 40, 6.0, 10, 180, "yes", True, False, True, 3.0, ["summerMultiplier"]),
    ("MG600", "Mango drink 600 ml PET", "Juice drinks", "Mango", "PET", 600, 24, 14.4, 38, 120, "yes", True, False, False, 2.5, ["summerMultiplier", "mrpPerUnit"]),
    ("WT1000", "Packaged water 1 L PET", "Water", "Water", "PET", 1000, 15, 15.0, 20, 365, "yes", False, False, True, 2.75, ["summerMultiplier"]),
    ("WT500", "Packaged water 500 ml PET", "Water", "Water", "PET", 500, 24, 12.0, 10, 365, "yes", True, False, False, 3.0, ["summerMultiplier", "shelfLifeDays"]),
    ("EN250", "Energy drink 250 ml PET", "Energy", "Energy", "PET", 250, 24, 6.0, 20, 270, "yes", True, False, False, 1.5, ["summerMultiplier", "shelfLifeDays"]),
]
PTR = {}
for p in PRODUCTS:
    margin = 0.20 if p[2] == "Water" else 0.15
    PTR[p[0]] = round(p[8] * p[6] * (1 - margin))
SKU_ORDER = [p[0] for p in PRODUCTS]
SS_SKUS = ["CL250", "LL250", "CL200G"]
CHILLED_SINGLE = {p[0] for p in PRODUCTS if p[11]}
TAKE_HOME = {"CL750", "OR1250", "CL2250", "WT1000"}

rng = random.Random(SEED)


# ------------------------------------------------------------------------------ helpers

def iso(d):
    return d.isoformat()


def wlabel(d):
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def days(a, b):
    """Dates a..b inclusive."""
    return [a + timedelta(n) for n in range((b - a).days + 1)]


def region_index(d):
    y, w, _ = d.isocalendar()
    if y <= 2025:
        return I25.get(w, 1.0)
    return I26.get(w, I26[18])   # beyond the demo week: hold the last known value, never hindsight


def k_of(peak):
    return (peak - 1) / 1.8


def in_ranges(d, ranges):
    return any(a <= d <= b for a, b, *_ in ranges)


def meta(note):
    return {"generatedBy": "scripts/generate_data.py", "seed": SEED, "est": True, "note": note}


# ------------------------------------------------------------------------------ demand (expected cases a day)

def demand(oid, d, shift_days=0):
    """Expected cases a day at outlet oid on date d (before noise and rounding)."""
    p = PERSONAS[oid]
    I = region_index(d + timedelta(shift_days))
    if oid == "OUT-06":
        b = BOOK.get(d.year, BOOK[2026]).get(d.month, 1.0)
        return p["base"] / 7 * b * (1 + (I - 1) * 0.25)
    if oid == "OUT-05":
        if in_ranges(d, CLOSURES_05):
            return 0.0
        f = 0.6 if in_ranges(d, EXAMS) else (0.7 if in_ranges(d, REOPEN_RAMP) else 1.0)
        return p["base"] / 7 * (1 + (I - 1) * k_of(p["peak"])) * f
    base = p["base"] if p["base"] is not None else 1.3
    x = base / 7 * (1 + (I - 1) * k_of(p["peak"]))
    if oid in ("OUT-01", "OUT-02", "OUT-08"):
        if date(2025, 10, 13) <= d <= date(2025, 10, 26):        # Diwali (20 Oct 2025): take-home bump
            x *= 1 + 0.3 * 0.55
        if date(2026, 3, 28) <= d <= date(2026, 5, 31):          # IPL 2026 evening take-home
            x *= 1.05
    return x


def cover_sum(oid, start, end, lag=0, shift=0):
    return sum(demand(oid, t - timedelta(lag), shift) for t in days(start, end))


# ------------------------------------------------------------------------------ visits

def planned_dates(cadence):
    out, n = [], 1
    while True:
        d = DEMO - timedelta(cadence * n)
        if d < HIST_FROM:
            break
        if d.weekday() == 6:     # no Sunday visits: move to Saturday
            d -= timedelta(1)
        out.append(d)
        n += 1
    return sorted(out)


def next_after_today(cadence):
    d = DEMO + timedelta(cadence)
    return d - timedelta(1) if d.weekday() == 6 else d


# ------------------------------------------------------------------------------ orders

def split_cases(n, mix, jitter=0.18):
    """Whole cases by SKU: largest-remainder split of n cases by the mix, with a little seeded jitter."""
    total = sum(mix.values())
    quotas = {s: max(0.0, n * v / total + rng.uniform(-jitter, jitter)) for s, v in mix.items()}
    floors = {s: int(math.floor(q)) for s, q in quotas.items()}
    left = n - sum(floors.values())
    order = sorted(quotas, key=lambda s: quotas[s] - floors[s], reverse=True)
    i = 0
    while left > 0:
        floors[order[i % len(order)]] += 1
        left -= 1
        i += 1
    while left < 0:
        s = max(floors, key=floors.get)
        floors[s] -= 1
        left += 1
    return {s: c for s, c in floors.items() if c > 0}


def stochastic_round(x):
    f = math.floor(x)
    return int(f + (1 if rng.random() < x - f else 0))


def value(lines):
    return sum(PTR[s] * c for s, c in lines.items())


def size_order(oid, d, nxt):
    """Expected cases for the visit on d, covering d+1 .. nxt (delivery is next day)."""
    p = PERSONAS[oid]
    start, end = d + timedelta(1), nxt
    if oid == "OUT-01":
        return cover_sum(oid, start, end, lag=10) if d.year == 2025 else cover_sum(oid, start, end)
    if oid == "OUT-02":
        return cover_sum(oid, start, end, lag=p["cadence"])
    if oid == "OUT-04":
        return cover_sum(oid, start, end, lag=p["cadence"])
    if oid == "OUT-07":
        return cover_sum(oid, start, end, shift=14)
    return cover_sum(oid, start, end)


def month_end_factor(d, dates):
    """OUT-07: the last visit of each month carries the month-end load."""
    later_same_month = [x for x in dates if x > d and x.month == d.month and x.year == d.year]
    if DEMO > d and DEMO.month == d.month and DEMO.year == d.year:
        later_same_month.append(DEMO)
    if later_same_month:
        return 0.8
    return 2.3 if d.month in (3, 10) else 1.8


def build_orders():
    orders, visit_plan = [], {}
    for oid, p in PERSONAS.items():
        if oid == "OUT-08":
            visit_plan[oid] = []
            continue
        dates = planned_dates(p["cadence"])
        extra = [date(2025, 5, 19)] if oid == "OUT-02" else []
        protected = {date(2025, 4, 15), date(2025, 4, 29), date(2025, 3, 25), date(2025, 10, 28)} | set(extra)
        plan = []
        for i, d in enumerate(dates):
            nxt = dates[i + 1] if i + 1 < len(dates) else DEMO
            closed = oid == "OUT-05" and in_ranges(d, CLOSURES_05)
            recent = (DEMO - d).days <= 30
            off_season = d.month in (6, 7, 8, 9, 10, 11, 12, 1, 2)
            missed = (off_season and not closed and not recent and d not in protected and rng.random() < 0.03)
            plan.append(dict(date=d, planned=True, done=not closed and not missed, closed=closed, nxt=nxt))
        for d in extra:
            plan.append(dict(date=d, planned=False, done=True, closed=False, nxt=d + timedelta(8)))
        plan.sort(key=lambda v: v["date"])
        visit_plan[oid] = plan

        for v in plan:
            if not v["done"]:
                continue
            d = v["date"]
            if oid == "OUT-02" and d == date(2025, 5, 19):
                lines = {"CL2250": 3, "OR1250": 1, "CL250": 1}
            else:
                x = size_order(oid, d, v["nxt"])
                if oid == "OUT-07":
                    x *= month_end_factor(d, [w["date"] for w in plan])
                if oid == "OUT-02" and date(2025, 5, 26) <= d <= date(2025, 6, 24):
                    x *= 0.5                       # leftovers after the rain
                x *= math.exp(rng.gauss(0, NOISE.get(oid, 0.12)))
                n = stochastic_round(x)
                if oid == "OUT-04":
                    n = min(n, 9)
                if n <= 0:
                    v["orderId"] = None
                    continue
                lines = split_cases(n, p["mix"])
            # supply events
            if CL250_OUT[0] <= d <= CL250_OUT[1] and "CL250" in lines:
                lost = lines.pop("CL250")
                if oid == "OUT-03":                # half switches to other 250 ml flavours
                    lines["LL250"] = lines.get("LL250", 0) + lost // 2
                    lines["OR250"] = lines.get("OR250", 0) + (lost - lost // 2) // 2
            if oid == "OUT-03" and d == date(2025, 4, 29):   # power cuts: he cut the cold order
                for s in list(lines):
                    if s in CHILLED_SINGLE:
                        lines[s] = int(round(lines[s] * 0.6))
            if d >= RATION_FROM and lines.get("CL250", 0) > 6:
                lines["CL250"] = 6
            if d >= MG600_OUT_FROM:
                lines.pop("MG600", None)
            if oid == "OUT-02" and d != date(2025, 5, 19):
                cap = 2700                                         # today's room: ₹4,500 limit − ₹1,800 due
                if date(2025, 4, 15) <= d <= date(2025, 5, 18):
                    cap = 800 if d == date(2025, 5, 13) else 2000  # dues building through the 2025 peak
                while value(lines) > cap and sum(lines.values()) > 1:
                    s = min((k for k in lines if lines[k] > 0), key=lambda k: (lines[k], -PTR[k]))
                    lines[s] -= 1
            lines = {s: c for s, c in lines.items() if c > 0}
            if not lines:
                v["orderId"] = None
                continue
            oid_no = oid[-2:]
            order = dict(id=f"ORD-{oid_no}-{d.strftime('%Y%m%d')}", outletId=oid, date=iso(d),
                         lines=lines, schemeIds=[], source="history")
            v["orderId"] = order["id"]
            orders.append(order)
    return orders, visit_plan


def force_03_april(orders):
    """OUT-03 spends all 4 April uses: 7 Apr >= 10 pooled, 14 Apr >= 20 pooled, 21 Apr >= 10 pooled."""
    need = {"2026-04-07": 10, "2026-04-14": 21, "2026-04-21": 10}
    for o in orders:
        if o["outletId"] == "OUT-03" and o["date"] in need:
            ln = o["lines"]
            while sum(ln.get(s, 0) for s in SS_SKUS) < need[o["date"]]:
                if o["date"] < iso(RATION_FROM) and ln.get("CL250", 0) < 12:
                    ln["CL250"] = ln.get("CL250", 0) + 1
                elif ln.get("LL250", 0) <= ln.get("CL200G", 0):
                    ln["LL250"] = ln.get("LL250", 0) + 1
                else:
                    ln["CL200G"] = ln.get("CL200G", 0) + 1


def apply_schemes(orders, outlets_by_id):
    """2026 schemes on past orders, with the same rules as js/schemes.js."""
    used = defaultdict(int)   # (outlet, scheme, yyyy-mm) -> free cases
    for o in sorted(orders, key=lambda x: x["date"]):
        d = date.fromisoformat(o["date"])
        out = outlets_by_id[o["outletId"]]
        ln = o["lines"]
        free = defaultdict(int)
        discount = 0
        month = o["date"][:7]
        # Summer Single-Serve: pooled, 1 free per 10, largest line, 4 uses a month by order date
        if date(2026, 3, 1) <= d <= date(2026, 5, 31) and out["tier"] in ("Diamond", "Gold", "Silver"):
            pooled = sum(ln.get(s, 0) for s in SS_SKUS)
            earned = pooled // 10
            key = (o["outletId"], "SCH-SS26", month)
            granted = min(earned, max(0, 4 - used[key]))
            if granted:
                pick = sorted([s for s in SS_SKUS if ln.get(s, 0) > 0], key=lambda s: (-ln[s], SS_SKUS.index(s)))[0]
                free[pick] += granted
                used[key] += granted
                o["schemeIds"].append("SCH-SS26")
        # Water Summer: 1 free per 8 cases of 1 L water, company cooler required, no cap
        if date(2026, 4, 1) <= d <= date(2026, 6, 30) and out["cooler"]["type"] == "bottler" and ln.get("WT1000", 0) >= 8:
            free["WT1000"] += ln["WT1000"] // 8
            o["schemeIds"].append("SCH-WT26")
        # Mango Push: 8% off the mango lines at 5+ cases combined, any tier
        mango = ln.get("MG150T", 0) + ln.get("MG600", 0)
        if date(2026, 4, 1) <= d <= date(2026, 6, 30) and mango >= 5:
            discount += round((ln.get("MG150T", 0) * PTR["MG150T"] + ln.get("MG600", 0) * PTR["MG600"]) * 0.08)
            o["schemeIds"].append("SCH-MG26")
        gross = value(ln)
        o["lines"] = [{"sku": s, "cases": ln[s], "freeCases": free.get(s, 0)} for s in SKU_ORDER if ln.get(s, 0) > 0]
        o["grossValue"] = gross
        o["discountValue"] = discount
        o["netValue"] = gross - discount
        # key order as in the contract
        for k in ("schemeIds", "source"):
            o[k] = o.pop(k)
    return used


# ------------------------------------------------------------------------------ static files

def outlets_json():
    def cooler(t, count, litres, outage=False, audit=None):
        return {"type": t, "count": count, "litres": litres, "afternoonOutage": outage, "lastAudit": audit}

    def credit(limit, due, last, mode):
        return {"limit": limit, "outstanding": due, "overdue": due, "lastPaymentDate": last, "paymentMode": mode}

    def persona(no, label, role, one):
        return {"no": no, "label": label, "role": role, "oneLine": one}

    O = [
        dict(id="OUT-01", name="Mauli General Stores",
             persona=persona(1, "The Flagship Kirana", "helps-most", "Big summer, but stocks up late when scheme details are late."),
             channel="Traditional Kirana", shopType="Traditional Kirana", area="Kothrud", address="Karve Road, Kothrud",
             locationContext="Busy residential main road", tier="Diamond", visitsPerMonth=4, registeredOn="2014-06-10",
             owner={"name": "Vilas Kale", "behaviour": "Plans with the rep; waits for scheme terms", "usuallyPresent": True},
             cooler=cooler("bottler", 1, 300, False, {"date": "2026-04-15", "pure": True, "fillPct": 85, "tempC": 5}),
             credit=credit(18000, 0, "2026-04-21", "credit"), tags=["residential", "main-road"], closures=[], bookings=[],
             empties={"cratesHeld": 5}),
        dict(id="OUT-02", name="Samarth Kirana",
             persona=persona(2, "The Cautious Kirana", "handle-with-care", "Customers want cold drinks; no cooler, tight credit and last year’s leftovers hold him back."),
             channel="Traditional Kirana", shopType="Traditional Kirana", area="Warje", address="Lane 7, Warje",
             locationContext="Quiet residential lane", tier="Bronze", visitsPerMonth=2, registeredOn="2017-03-02",
             owner={"name": "Sadashiv Mane", "behaviour": "Careful and short of cash; wary after last summer’s leftovers", "usuallyPresent": True},
             cooler=cooler("none", 0, 0), credit=credit(4500, 1800, "2026-03-24", "credit"),
             tags=["residential"], closures=[], bookings=[]),
        dict(id="OUT-03", name="Thanda Corner Cold Drinks",
             persona=persona(3, "The Cold-Drink Shop", "helps-most", "Summer is the whole year: order size and cold coolers decide it."),
             channel="Convenience", shopType="Cold-drink shop", area="Kothrud", address="Near the college gate, Paud Road, Kothrud",
             locationContext="College road", tier="Gold", visitsPerMonth=4, registeredOn="2019-02-15",
             owner={"name": "Imran Shaikh", "behaviour": "Knows his trade; plans around summer", "usuallyPresent": True},
             cooler=cooler("bottler", 2, 300, True, {"date": "2026-04-15", "pure": True, "fillPct": 90, "tempC": 9}),
             credit=credit(15000, 0, "2026-04-21", "credit"), tags=["college", "main-road"], closures=[], bookings=[],
             empties={"cratesHeld": 6}),
        dict(id="OUT-04", name="Lakeside Bhel & Snacks",
             persona=persona(4, "The Lakeside Snack Stall", "thin-data", "Weekend crowds, one visit a month, and sales we never see."),
             channel="Entertainment & Leisure", shopType="Snack stall", area="Pashan", address="Lake promenade, Pashan",
             locationContext="By the lake, busiest at weekends", tier="Iron", visitsPerMonth=1, registeredOn="2021-11-05",
             owner={"name": "Balu Waghmare", "behaviour": "Buys what he can carry; pays cash above his limit; tops up at the wholesale market", "usuallyPresent": True},
             cooler=cooler("ice-box", 1, 40), credit=credit(1500, 0, "2026-03-31", "cash-and-credit"),
             tags=["tourist-spot", "weekend-crowds"], closures=[], bookings=[]),
        dict(id="OUT-05", name="Sunrise School Canteen",
             persona=persona(5, "The School Canteen", "stays-quiet", "Shuts on 1 May, just as the route peaks."),
             channel="Education", shopType="School canteen", area="Bavdhan", address="Inside Sunrise School, Bavdhan",
             locationContext="Inside a school", tier="Silver", visitsPerMonth=3, registeredOn="2018-06-12",
             owner={"name": "Kavita Joshi", "behaviour": "Canteen contractor; orders by term, exams and holidays", "usuallyPresent": True},
             cooler=cooler("bottler", 1, 150, False, {"date": "2026-04-15", "pure": True, "fillPct": 55, "tempC": 6}),
             credit=credit(5000, 0, "2026-04-18", "credit"), tags=["school"],
             closures=[{"from": iso(a), "to": iso(b), "reason": r, **({"est": True} if e else {})} for a, b, r, e in CLOSURES_05],
             bookings=[]),
        dict(id="OUT-06", name="Shubh Mangal Banquets",
             persona=persona(6, "The Banquet Hall", "own-calendar", "Follows wedding bookings, not the weather."),
             channel="Eating & Drinking", shopType="Banquet hall", area="Bavdhan", address="Chandni Chowk road, Bavdhan",
             locationContext="Wedding and events venue", tier="Silver", visitsPerMonth=3, registeredOn="2016-10-20",
             owner={"name": "Prakash Kulkarni", "behaviour": "Manager; orders event by event from the booking calendar", "usuallyPresent": True},
             cooler=cooler("bottler", 1, 150, False, {"date": "2026-04-15", "pure": True, "fillPct": 70, "tempC": 6}),
             credit=credit(12000, 0, "2026-04-18", "credit"), tags=["events"], closures=[],
             bookings=[{"date": d, "event": e, "expectedCases": c, "est": True} for d, e, c in BOOKINGS_06],
             empties={"cratesHeld": 4}),
        dict(id="OUT-07", name="Mahalaxmi Beverage Agency",
             persona=persona(7, "The Beverage Wholesaler", "stays-quiet", "Month-end loads that look like demand but aren’t retail."),
             channel="Wholesale", shopType="Beverage wholesaler", area="Warje", address="Warje market",
             locationContext="Drinks wholesaler in the market", tier="Diamond", visitsPerMonth=4, registeredOn="2012-04-02",
             owner={"name": "Mahesh Agarwal", "behaviour": "Volume trader; buys month-end deals and sells on, some off the route", "usuallyPresent": True},
             cooler=cooler("none", 0, 0), credit=credit(75000, 16500, "2026-04-07", "cash-and-credit"),
             tags=["month-end-loads", "market"], closures=[], bookings=[]),
        dict(id="OUT-08", name="Ashirwad General Store",
             persona=persona(8, "The New Owner", "thin-data", "No history at all: today is his first order."),
             channel="Traditional Kirana", shopType="Traditional Kirana", area="Pashan", address="Sus Road, Pashan",
             locationContext="Neighbourhood shop under a new owner", tier="Bronze", visitsPerMonth=2, registeredOn="2026-04-22",
             owner={"name": "Nitin Salunkhe", "behaviour": "New and careful; wants numbers before he commits", "usuallyPresent": True},
             cooler=cooler("none", 0, 0), credit=credit(5000, 0, None, "credit"),
             tags=["residential", "new-outlet"], closures=[], bookings=[]),
    ]
    return O


def products_json():
    out = []
    for (sku, name, cat, flav, pack, ml, units, litres, mrp, shelf, chilled, single, ret, focus, mult, est) in PRODUCTS:
        margin = 20 if cat == "Water" else 15
        out.append({"sku": sku, "name": name, "category": cat, "flavour": flav, "pack": {"type": pack, "ml": ml},
                    "unitsPerCase": units, "caseLabel": "crate" if ret else "case", "litresPerCase": litres,
                    "mrpPerUnit": mrp, "ptrPerCase": PTR[sku], "marginPct": margin, "shelfLifeDays": shelf,
                    "chilled": chilled, "singleServe": single, "returnable": ret, "depositPerCrate": None,
                    "focus": focus, "summerMultiplier": mult, "est": est})
    return {"meta": meta("13 SKUs. PTR = MRP × units × 0.85 (0.80 for water), rounded. Summer multipliers from research Table E (est)."),
            "categories": ["Sparkling", "Juice drinks", "Water", "Energy"], "products": out}


def schemes_json():
    return {"meta": meta("Schemes valid in 2026. Summer Single-Serve is pooled; uses are free cases, counted by order date within the calendar month; free cases don't count against the 250 ml ration."),
            "schemes": [
        {"id": "SCH-SS26", "name": "Summer Single-Serve", "type": "free-goods", "skus": SS_SKUS,
         "rule": {"buyCases": 10, "freeCases": 1, "pooled": True, "freeSku": "largest-line",
                  "usesCountedBy": "order-date-calendar-month", "freeCasesCountAgainstRation": False},
         "eligibleTiers": ["Diamond", "Gold", "Silver"], "requiresBottlerCooler": False, "capUsesPerMonth": 4,
         "validFrom": "2026-03-01", "validTo": "2026-05-31",
         "payout": "Free case delivered; the bottler credits the distributor within 30 days of the claim",
         "extras": "Free cooler shelf-strip with the first qualifying order", "est": False},
        {"id": "SCH-MG26", "name": "Mango Push", "type": "percent-off", "skus": ["MG150T", "MG600"],
         "rule": {"minCases": 5, "percent": 8, "pooled": True}, "eligibleTiers": "all", "requiresBottlerCooler": False,
         "capUsesPerMonth": None, "validFrom": "2026-04-01", "validTo": "2026-06-30",
         "payout": "Taken off the invoice", "extras": None, "est": False},
        {"id": "SCH-WT26", "name": "Water Summer", "type": "free-goods", "skus": ["WT1000"],
         "rule": {"buyCases": 8, "freeCases": 1, "pooled": False, "freeSku": "WT1000"},
         "eligibleTiers": "all", "requiresBottlerCooler": True, "capUsesPerMonth": None,
         "validFrom": "2026-04-01", "validTo": "2026-06-30", "payout": "Free case delivered with the order",
         "extras": None, "est": True},
        {"id": "SCH-NEW", "name": "New Outlet Activation", "type": "first-order", "skus": "all",
         "rule": {"percent": 12, "withinDaysOfRegistration": 90}, "eligibleTiers": "all", "requiresBottlerCooler": False,
         "capUsesPerMonth": None, "validFrom": None, "validTo": None, "payout": "Taken off the invoice",
         "extras": None, "est": False},
        {"id": "PRG-PURITY", "name": "Cooler Purity Program", "type": "program", "skus": [], "rule": None,
         "eligibleTiers": "all", "requiresBottlerCooler": True, "capUsesPerMonth": None, "validFrom": None, "validTo": None,
         "payout": "₹300 a month if the cooler holds only our drinks at the monthly photo audit",
         "extras": "New coolers are placed only at Diamond, Gold and Silver outlets", "est": False},
    ]}


def stock_json():
    items = []
    for s in SKU_ORDER:
        if s == "CL250":
            items.append({"sku": s, "status": "rationed", "maxCasesPerOutlet": 6, "rationAppliesTo": "paid-cases",
                          "note": "Allocation cut for peak weeks; free scheme cases don't count"})
        elif s == "MG600":
            items.append({"sku": s, "status": "out", "maxCasesPerOutlet": 0, "note": "Out at the distributor"})
        else:
            items.append({"sku": s, "status": "ok", "maxCasesPerOutlet": None, "note": ""})
    return {"meta": meta("Stock as the distributor reported it on Sat 25 Apr 2026 (weekly report; may be days old)."),
            "asOf": "2026-04-25", "items": items}


def config_json():
    return {"meta": meta("Demo settings."), "demoDate": iso(DEMO),
            "region": {"name": "Pune West", "city": "Pune", "state": "Maharashtra", "areas": ["Kothrud", "Warje", "Bavdhan", "Pashan"]},
            "rep": {"id": "REP-01", "name": "Rohit Jagtap", "role": "Pre-seller", "routeOutletsToday": 27,
                    "languages": ["Marathi", "Hindi", "English (app)"]},
            "distributor": {"name": "Kothrud Beverage Distributors", "deliveryLeadDays": 1},
            "history": {"fromWeek": "2025-W01", "toWeek": "2026-W17", "weekStartsOn": "Monday"},
            "focusSkus": ["CL250", "CL200G", "MG150T", "WT1000"],
            "assumptions": {"est": True, "coolerCases250ByLitres": {"60": 2, "150": 5, "300": 10}, "iceBoxCases250": 1}}


def calendar_json():
    ri25 = {f"2025-W{w:02d}": I25[w] for w in range(1, 53)}
    ri26 = {f"2026-W{w:02d}": I26[w] for w in range(1, 19)}
    ph = {}
    for y, spans in PHASES.items():
        ph[str(y)] = {f"{y}-W{w:02d}": name for a, b, name in spans for w in range(a, b + 1)}

    def ev(i, name, a, b, channels, tags, packs, mult, source, **extra):
        return {"id": i, "name": name, "from": a, "to": b, "appliesTo": {"channels": channels, "tags": tags},
                "packs": packs, "multiplier": mult, "source": source, "est": True, **extra}
    kir = ["Traditional Kirana"]
    events = [
        ev("EV-HOLI-26", "Holi", "2026-03-03", "2026-03-04", kir + ["Convenience"], [], None, 1.2, "Free Press Journal, Mar 2026"),
        ev("EV-GUDI-26", "Gudi Padwa", "2026-03-19", "2026-03-19", kir, ["residential"], ["CL750", "OR1250", "CL2250"], 1.15, "Hindu calendar"),
        ev("EV-EIDF-26", "Eid al-Fitr", "2026-03-21", "2026-03-21", kir, [], ["CL750", "OR1250", "CL2250"], 1.3, "India.com, Mar 2026"),
        ev("EV-IPL-26", "IPL 2026 (evening matches)", "2026-03-28", "2026-05-31", kir, ["residential"], ["CL750", "OR1250", "CL2250"], [1.1, 1.2], "Olympics.com, 2026"),
        ev("EV-HEAT-26", "First 40°C spell", "2026-04-12", "2026-04-19", kir + ["Convenience", "Entertainment & Leisure"], [], None, [1.3, 1.5], "Bridge Chronicle; Punekar News"),
        ev("EV-AMBEDKAR-26", "Ambedkar Jayanti", "2026-04-14", "2026-04-14", ["Convenience"], [], None, 1.3, "State holiday calendar"),
        ev("EV-MHDAY-26", "Maharashtra Day long weekend", "2026-05-01", "2026-05-03", [], ["highway", "petrol-pump", "tourist-spot"], None, [1.5, 2.0], "State holiday calendar"),
        ev("EV-SCHOOLVAC-26", "School summer vacation (schools)", "2026-05-02", "2026-06-14", ["Education"], ["school"], None, 0.1, "Lokmat Times, 30 Mar 2026"),
        ev("EV-SCHOOLVAC-KIR-26", "School summer vacation (families at home)", "2026-05-02", "2026-06-14", kir, ["residential"], None, 1.15, "Lokmat Times, 30 Mar 2026"),
        ev("EV-ADHIK-26", "Adhik Jyeshtha: no wedding dates", "2026-05-17", "2026-06-15", ["Eating & Drinking"], ["events"], None, 0.5, "AstroSage (Hindu Panchang)"),
        ev("EV-EIDA-26", "Eid al-Adha", "2026-05-28", "2026-05-28", kir, [], ["CL750", "OR1250", "CL2250"], 1.3, "timeanddate.com"),
        ev("EV-IPLFINAL-26", "IPL final", "2026-05-31", "2026-05-31", kir, ["residential"], ["CL750", "OR1250", "CL2250"], 1.3, "Olympics.com, 2026"),
        ev("EV-SCHOOLOPEN-26", "Schools reopen", "2026-06-15", "2026-06-15", ["Education"], ["school"], None, 0.8, "Lokmat Times, 30 Mar 2026"),
        ev("EV-RAIN-25", "Heavy pre-monsoon rain", "2025-05-24", "2025-05-26", [], [], None, 0.6, "Deccan Herald, 26 May 2025", anchor=True),
        ev("EV-MONSOON-25", "Monsoon onset over Pune", "2025-05-26", "2025-05-26", [], [], None, None, "IMD via Deccan Herald", anchor=True),
        ev("EV-MHDAY-25", "Maharashtra Day (a Thursday: no long weekend)", "2025-05-01", "2025-05-01", [], [], None, 1.0, "State holiday calendar", anchor=True),
        ev("EV-DIWALI-25", "Diwali", "2025-10-13", "2025-10-26", kir, ["residential"], ["CL750", "OR1250", "CL2250"], 1.3, "Hindu calendar (20 Oct 2025)", anchor=True),
        ev("EV-WEDDINGS-25", "November wedding season", "2025-11-02", "2025-11-30", ["Eating & Drinking"], ["events"], None, 1.1, "Research findings (est)", anchor=True),
    ]
    return {"meta": meta("Region index to the demo week only; events known in advance, plus 2025 anchors (anchor: true) used to build history. No hindsight."),
            "regionIndex": {"est": True, "basis": "January average week = 1.0", "2025": ri25, "2026": ri26},
            "phases": ph,
            "forecast": {"asOf": iso(DEMO), "est": True, "periods": [
                {"from": "2026-04-29", "to": "2026-05-04", "maxC": [38, 40], "rainChance": "none"},
                {"from": "2026-05-05", "to": "2026-05-11", "maxC": [39, 41], "rainChance": "low"}],
                "monsoonSignalNext14Days": False},
            "climatology": {"normalOnsetPune": "06-10", "plusMinusDays": 3,
                            "onsets": {"2017": "2017-06-10", "2018": "2018-06-08", "2019": "2019-06-20", "2020": "2020-06-11",
                                       "2021": "2021-06-09", "2022": "2022-06-10", "2023": "2023-06-24", "2024": "2024-06-06",
                                       "2025": "2025-05-26"}},
            "events": events,
            "schools": {"2025": {"vacationFrom": "2025-05-02", "reopen": "2025-06-16", "examsFrom": "2025-04-15", "est": True},
                        "2026": {"vacationFrom": "2026-05-02", "reopen": "2026-06-15", "examsFrom": "2026-04-15",
                                 "source": "Lokmat Times, 30 Mar 2026 (exam start est.)"}}}


def peers_json():
    def group_weeks(base, peak, mix, weeks_idx, extra=1.0):
        k = k_of(peak)
        total = sum(mix.values())
        out = {}
        for s, v in mix.items():
            out[s] = {wk: round(base * (1 + (I - 1) * k) * extra * v / total, 2) for wk, I in weeks_idx}
        return out
    # current week from the index; the next two weeks use a normal year's peak shape (2.8), not a forecast of this year
    wk = [("2026-W18", I26[18]), ("2026-W19", 2.8), ("2026-W20", 2.8)]
    return {"meta": meta("Similar shops nearby on the rep's wider route (not only the 8 in the prototype). Per-outlet average weekly cases. W19-W20 assume a normal year's peak (index 2.8)."),
            "groups": [
        {"key": "kirana|Bronze|no-cooler", "channel": "Traditional Kirana", "tier": "Bronze", "cooler": "none", "outletsInGroup": 14,
         "weeklyCasesBySku": group_weeks(1.3, 1.8, PERSONAS["OUT-08"]["mix"], wk, 1.05), "est": True},
        {"key": "leisure|Iron|ice-box", "channel": "Entertainment & Leisure", "tier": "Iron", "cooler": "ice-box", "outletsInGroup": 6,
         "weeklyCasesBySku": group_weeks(0.55, 3.5, PERSONAS["OUT-04"]["mix"], wk), "est": True},
    ]}


# ------------------------------------------------------------------------------ notes (rep's voice)

def notes_for(orders_by_id):
    return {
        "OUT-01": [("2025-03-18", "Customers are asking for cold 250 ml already. Owner won't take a big order until the summer scheme letter arrives."),
                   ("2025-04-15", "No 250 ml cola at the distributor this week. He says customers went to the shop opposite."),
                   ("2026-04-21", "Cooler full at 9 am. Expects a rush over the 1–3 May holiday weekend and IPL evenings. Only 6 cases of 250 ml cola allowed.")],
        "OUT-02": [("2025-05-19", "Owner called after two hot weeks. Paid ₹1,500 of his dues and took 5 cases, mostly 2.25 L."),
                   ("2025-06-24", "Rain since 26 May. Four 2.25 L bottles still unsold; he let them go at ₹80 (MRP ₹95). Says never again."),
                   ("2026-04-14", "₹1,800 still due, so I held back the summer push. He ran out of 250 ml again last week.")],
        "OUT-03": [("2025-04-29", "Afternoon power cuts all week. Coolers at 11°C by 4 pm and customers leaving. He cut the cold order."),
                   ("2026-04-14", "First 40°C weekend. Took extra lemon-lime and 200 ml glass to earn two free cases."),
                   ("2026-04-21", "Two-hour outage on Saturday afternoon; the cooler read 9°C at the 15 Apr audit. Asked again for an ice box.")],
        "OUT-04": [("2025-04-29", None),   # filled below with the cash amount
                   ("2025-05-27", "Rain since the weekend; the lakeside is empty."),
                   ("2026-03-31", "Asked for a second visit in summer. Last month he ran out in about ten days.")],
        "OUT-05": [("2025-04-22", "Exams from the 15th. Small quantities only; the school shuts after 30 April."),
                   ("2025-06-20", "School reopened on 16 June. Restocked water and mango."),
                   ("2026-04-18", "Exams on. Water and mango only till 30 April; the school doesn't allow fizzy drinks in the canteen.")],
        "OUT-06": [("2025-05-28", "Rain on two wedding days this month; events moved indoors, fewer guests, fewer cases."),
                   ("2025-11-10", "Twelve weddings booked for November and December. Asked for his limit to go up to ₹18,000."),
                   ("2026-04-18", "14 events booked from 29 Apr to 16 May, then nothing in the adhik month. Needs about 29 cases before 8 May.")],
        "OUT-07": [("2025-03-25", "Year-end load at the special rate. Says most of it goes to shops on Paud Road, off our route."),
                   ("2025-10-28", "Diwali month-end load: big packs only."),
                   ("2026-04-21", "₹16,500 still due. Wants the month-end rate again next week.")],
    }


def build_visits(visit_plan, orders_by_id):
    minutes_range = {"OUT-01": (8, 12), "OUT-02": (4, 6), "OUT-03": (8, 12), "OUT-04": (4, 6),
                     "OUT-05": (6, 9), "OUT-06": (7, 10), "OUT-07": (13, 17), "OUT-08": (5, 8)}
    route = ["OUT-01", "OUT-03", "OUT-07", "OUT-02", "OUT-05", "OUT-06", "OUT-08", "OUT-04"]
    notes = notes_for(orders_by_id)
    out = {}
    for oid in route:
        p = PERSONAS[oid]
        plan = visit_plan[oid]
        vs = []
        for v in plan:
            vs.append({"date": iso(v["date"]), "planned": v["planned"], "done": v["done"],
                       "minutes": rng.randint(*minutes_range[oid]) if v["done"] else None,
                       "orderId": v.get("orderId") if v["done"] else None, "note": None})
            if v["closed"]:
                vs[-1]["note"] = None
        for target, text in notes.get(oid, []):
            t = date.fromisoformat(target)
            cands = [x for x in vs if x["done"] and abs((date.fromisoformat(x["date"]) - t).days) <= 6]
            assert cands, f"no visit near {target} for {oid}"
            best = min(cands, key=lambda x: abs((date.fromisoformat(x["date"]) - t).days))
            if text is None and oid == "OUT-04":
                o = orders_by_id.get(best["orderId"])
                cash = max(0, o["netValue"] - 1500) if o else 0
                text = (f"Ran out mid-April and bought water and cola at the wholesale market. This order is over his limit; "
                        f"paid ₹{cash:,} in cash.")
            best["note"] = text
        out[oid] = {"cadenceDays": p["cadence"], "todayOnRoute": True, "routeOrder": route.index(oid) + 1,
                    "nextVisitAfterToday": iso(next_after_today(p["cadence"])), "visits": vs}
    return out


# ------------------------------------------------------------------------------ history

def weeks_axis():
    wk, starts = [], []
    d = HIST_FROM
    while d <= HIST_TO:
        wk.append(wlabel(d))
        starts.append(iso(d))
        d += timedelta(7)
    return wk, starts


def build_history(orders):
    wk, starts = weeks_axis()
    pos = {w: i for i, w in enumerate(wk)}
    h = {oid: defaultdict(lambda: [0] * len(wk)) for oid in PERSONAS}
    for o in orders:
        i = pos[wlabel(date.fromisoformat(o["date"]))]
        for ln in o["lines"]:
            h[o["outletId"]][ln["sku"]][i] += ln["cases"]
    return {"meta": meta("Weekly paid cases booked, by outlet and SKU, summed from orders.json (free scheme cases not included). SKUs never bought are left out."),
            "weeks": wk, "weekStarts": starts,
            "outlets": {oid: {s: h[oid][s] for s in SKU_ORDER if s in h[oid]} for oid in PERSONAS}}


# ------------------------------------------------------------------------------ writing

def dumps_compact_list(key_obj_pairs):
    return json.dumps(key_obj_pairs, ensure_ascii=False, separators=(",", ":"))


def write(name, obj, per_line=None):
    path = DATA / f"{name}.json"
    if per_line == "orders":
        body = ",\n".join("  " + dumps_compact_list(o) for o in obj["orders"])
        text = '{\n "meta": ' + json.dumps(obj["meta"], ensure_ascii=False) + ',\n "orders": [\n' + body + "\n ]\n}\n"
    elif per_line == "history":
        parts = []
        for oid, skus in obj["outlets"].items():
            inner = ",\n".join(f'   "{s}": ' + dumps_compact_list(v) for s, v in skus.items())
            parts.append(f'  "{oid}": {{' + ("\n" + inner + "\n  " if inner else "") + "}")
        text = ('{\n "meta": ' + json.dumps(obj["meta"], ensure_ascii=False) + ',\n "weeks": ' + dumps_compact_list(obj["weeks"]) +
                ',\n "weekStarts": ' + dumps_compact_list(obj["weekStarts"]) + ',\n "outlets": {\n' + ",\n".join(parts) + "\n }\n}\n")
    elif per_line == "visits":
        parts = []
        for oid, v in obj["outlets"].items():
            head = {k: val for k, val in v.items() if k != "visits"}
            rows = ",\n".join("    " + dumps_compact_list(x) for x in v["visits"])
            head_txt = json.dumps(head, ensure_ascii=False)[1:-1]
            parts.append(f'  "{oid}": {{{head_txt}, "visits": [' + ("\n" + rows + "\n  " if rows else "") + "]}")
        text = '{\n "meta": ' + json.dumps(obj["meta"], ensure_ascii=False) + ',\n "outlets": {\n' + ",\n".join(parts) + "\n }\n}\n"
    else:
        text = json.dumps(obj, ensure_ascii=False, indent=1) + "\n"
    json.loads(text)
    path.write_text(text, encoding="utf-8")
    return path


# ------------------------------------------------------------------------------ summary for the sheets

def monthly(orders, oid, year):
    """Cases by order date (month of booking)."""
    m = [0] * 12
    for o in orders:
        if o["outletId"] == oid and o["date"].startswith(str(year)):
            m[int(o["date"][5:7]) - 1] += sum(l["cases"] for l in o["lines"])
    return m


def daily_spread(orders, visits, oid):
    """{date: cases} with each order spread over the days it covers, weighted by expected demand."""
    vdates = sorted(date.fromisoformat(v["date"]) for v in visits["outlets"][oid]["visits"])
    out = defaultdict(float)
    for o in orders:
        if o["outletId"] != oid:
            continue
        d = date.fromisoformat(o["date"])
        nxt = next((x for x in vdates if x > d), DEMO)
        span = days(d + timedelta(1), nxt)
        w = [demand(oid, t) for t in span]
        tot = sum(w)
        if tot <= 0:
            span, w, tot = [d], [1.0], 1.0
        cases = sum(l["cases"] for l in o["lines"])
        for t, wt in zip(span, w):
            out[t] += cases * wt / tot
    return out


def monthly_spread(orders, visits, oid, year):
    """Cases by month, with each order counted over the days it covers (delivery to the next visit),
    weighted by expected daily demand. Removes the swing from 2 vs 3 visits in a month."""
    vdates = sorted(date.fromisoformat(v["date"]) for v in visits["outlets"][oid]["visits"])
    m = [0.0] * 12
    for o in orders:
        if o["outletId"] != oid:
            continue
        d = date.fromisoformat(o["date"])
        nxt = next((x for x in vdates if x > d), DEMO)
        span = days(d + timedelta(1), nxt)
        w = [demand(oid, t) for t in span]
        tot = sum(w)
        cases = sum(l["cases"] for l in o["lines"])
        if tot <= 0:
            span, w, tot = [d], [1.0], 1.0
        for t, wt in zip(span, w):
            if t.year == year:
                m[t.month - 1] += cases * wt / tot
    return [round(x, 1) for x in m]


def summarise(orders, visits, outlets):
    S = {}
    by = defaultdict(list)
    for o in orders:
        by[o["outletId"]].append(o)
    for oid, p in PERSONAS.items():
        os_ = sorted(by[oid], key=lambda o: o["date"])
        s = {"orders": len(os_)}
        if os_:
            cases = lambda o: sum(l["cases"] for l in o["lines"])
            avg = lambda xs, f: sum(f(x) for x in xs) / len(xs) if xs else 0
            m25 = monthly_spread(orders, visits, oid, 2025)
            jf = (m25[0] + m25[1]) / 2
            best = max(range(12), key=lambda i: m25[i])
            win = [o for o in os_ if o["date"] < "2025-03-01"]
            pk = [o for o in os_ if o["date"][:7] == f"2025-{best + 1:02d}"]
            cases = lambda o: sum(l["cases"] for l in o["lines"])
            avg = lambda xs, f: sum(f(x) for x in xs) / len(xs) if xs else 0
            w25 = sum(cases(o) for o in os_ if "2025-01-01" <= o["date"] <= "2025-04-26")
            w26 = sum(cases(o) for o in os_ if "2026-01-01" <= o["date"] <= "2026-04-26")
            od = monthly(orders, oid, 2025)
            od26 = monthly(orders, oid, 2026)[:4]
            od_jf = (od[0] + od[1]) / 2
            od_pk = max(range(12), key=lambda i: od[i])
            s.update(monthlyByOrderDate2026JanApr=od26, peakMonthByOrderDate=od_pk + 1,
                     liftByOrderDate=round(od[od_pk] / od_jf, 1) if od_jf else None,
                     peakMonthOrderByDate={"cases": round(avg([o for o in os_ if o["date"][:7] == f"2025-{od_pk + 1:02d}"], cases), 1),
                                           "value": round(avg([o for o in os_ if o["date"][:7] == f"2025-{od_pk + 1:02d}"], lambda o: o["netValue"]))},
                     biggestOrder2025={"date": max((o for o in os_ if o["date"] < "2026"), key=cases)["date"],
                                       "cases": cases(max((o for o in os_ if o["date"] < "2026"), key=cases))})
            s.update(monthly2025=[round(x) for x in m25], monthlyByOrderDate2025=od,
                     janFebAvg=round(jf, 1), bestMonth=best + 1, bestMonthCases=round(m25[best]),
                     lift=round(m25[best] / jf, 1) if jf else None,
                     winterOrder={"cases": round(avg(win, cases), 1), "value": round(avg(win, lambda o: o["netValue"]))},
                     peakOrder={"cases": round(avg(pk, cases), 1), "value": round(avg(pk, lambda o: o["netValue"]))},
                     maxOrder2025={"cases": max(cases(o) for o in os_ if o["date"] < "2026"), "value": max(o["netValue"] for o in os_ if o["date"] < "2026")},
                     sameDays2026vs2025=round(w26 / w25 - 1, 2) if w25 else None,
                     aprilUses2026=sum(l["freeCases"] for o in os_ if o["date"].startswith("2026-04") and "SCH-SS26" in o["schemeIds"]
                                       for l in o["lines"] if l["sku"] in SS_SKUS),
                     aprilOrders2026=[{"date": o["date"], "pooled": sum(l["cases"] for l in o["lines"] if l["sku"] in SS_SKUS),
                                       "free": sum(l["freeCases"] for l in o["lines"])} for o in os_ if o["date"].startswith("2026-04")])
        # what this visit should cover (forward, from today's delivery to the next delivery)
        nxt = next_after_today(p["cadence"])
        if oid == "OUT-06":
            ev = [b for b in BOOKINGS_06 if "2026-04-29" <= b[0] <= iso(nxt)]
            need = sum(b[2] for b in ev)
            s["todayCover"] = {"events": len(ev), "cases": need, "value": round(need * vpc(p["mix"])), "until": iso(nxt)}
            s["bookingsTotal"] = {"events": len(BOOKINGS_06), "cases": sum(b[2] for b in BOOKINGS_06)}
            sp = daily_spread(orders, visits, oid)
            same25 = sum(v for t, v in sp.items() if date(2025, 4, 28) <= t <= date(2025, 5, 16))
            dem25 = sum(demand(oid, t) for t in days(date(2025, 4, 28), date(2025, 5, 16)))
            s["sameDays2025"] = {"cases": round(same25, 1), "demandCases": round(dem25, 1),
                                 "ratio2026": round(sum(b[2] for b in BOOKINGS_06) / same25, 1)}
        elif oid == "OUT-08":
            pass
        else:
            x = cover_sum(oid, DEMO + timedelta(1), nxt)
            if oid == "OUT-04":   # 1–3 May long weekend at a tourist spot (1.75×, mid of 1.5–2.0)
                x += sum(demand(oid, t) * 0.75 for t in days(date(2026, 5, 1), date(2026, 5, 3)))
            s["todayCover"] = {"cases": round(x, 1), "value": round(x * vpc(p["mix"])), "until": iso(nxt)}
        s["valuePerCase"] = round(vpc(p["mix"]))
        if oid == "OUT-07" and os_:
            vd = [date.fromisoformat(v["date"]) for v in visits["outlets"][oid]["visits"]]
            def is_month_end(o):
                d = date.fromisoformat(o["date"])
                return not any(x > d and x.month == d.month and x.year == d.year for x in vd) and not (d.month == DEMO.month and d.year == DEMO.year)
            y25 = [o for o in os_ if o["date"] < "2026"]
            normal = [o for o in y25 if not is_month_end(o)]
            me = [o for o in y25 if is_month_end(o) and o["date"][5:7] not in ("03", "10")]
            big = [o for o in y25 if is_month_end(o) and o["date"][5:7] in ("03", "10")]
            ca = lambda o: sum(l["cases"] for l in o["lines"])
            s["orderTypes2025"] = {k: {"cases": round(sum(ca(o) for o in v) / len(v)), "value": round(sum(o["netValue"] for o in v) / len(v))}
                                   for k, v in (("normal", normal), ("monthEnd", me), ("yearEndAndDiwali", big))}
        if os_:
            allc = sum(l["cases"] for o in os_ for l in o["lines"])
            s["takeHomeShare"] = round(sum(l["cases"] for o in os_ for l in o["lines"] if l["sku"] in TAKE_HOME) / allc, 2)
        if oid == "OUT-02" and os_:
            reg = [o for o in os_ if o["date"] != "2025-05-19"]
            top = max(reg, key=lambda o: o["netValue"])
            s["maxRegularOrder"] = {"date": top["date"], "cases": sum(l["cases"] for l in top["lines"]), "value": top["netValue"]}
        if oid == "OUT-03" and os_:
            wk = weeks_axis()[0]
            h = build_history(orders)["outlets"]["OUT-03"]
            cold = lambda w: sum(v[wk.index(w)] for k2, v in h.items() if k2 in CHILLED_SINGLE)
            s["powerCutWeek"] = {"w17": cold("2025-W17"), "w18": cold("2025-W18"), "w19": cold("2025-W19")}
        if oid in ("OUT-01", "OUT-03") and os_:
            s["marchVsJanFeb"] = round(s["monthly2025"][2] / s["janFebAvg"], 1)
            s["mayVsApril"] = round(s["monthly2025"][4] / s["monthly2025"][3], 2)
        S[oid] = s
    # sheet-only lines: 04's estimated demand, 08's peers
    S["OUT-04"]["demand2025"] = [round(sum(demand("OUT-04", t) for t in days(date(2025, m, 1), (date(2025, m + 1, 1) if m < 12 else date(2026, 1, 1)) - timedelta(1))), 1) for m in range(1, 13)]
    S["OUT-08"]["peers2025"] = [round(sum(demand("OUT-08", t) for t in days(date(2025, m, 1), (date(2025, m + 1, 1) if m < 12 else date(2026, 1, 1)) - timedelta(1))), 1) for m in range(1, 13)]
    pw = peers_json()["groups"][0]["weeklyCasesBySku"]
    S["OUT-08"]["peerWeekW18"] = round(sum(v["2026-W18"] for v in pw.values()), 2)
    S["OUT-08"]["peerFortnight"] = round(sum(v["2026-W18"] + v["2026-W19"] for v in pw.values()), 1)
    return S


def vpc(mix):
    t = sum(mix.values())
    return sum(PTR[s] * v for s, v in mix.items()) / t


# ------------------------------------------------------------------------------ checks

def run_checks(files, orders, hist, visits, outlets, S):
    res = []

    def check(name, ok, detail=""):
        res.append((name, bool(ok), detail))

    # 1 history == orders
    rebuilt = build_history(orders)
    check("history.json equals orders.json summed by week and SKU", rebuilt["outlets"] == hist["outlets"],
          f"{sum(len(v) for v in hist['outlets'].values())} outlet-SKU series × {len(hist['weeks'])} weeks")
    # 2 dates
    late = [o["id"] for o in orders if o["date"] > iso(HIST_TO)]
    late += [f"{k}:{v['date']}" for k, x in visits["outlets"].items() for v in x["visits"] if v["date"] > iso(HIST_TO)]
    check("No order, past visit or history week after 2026-04-26", not late and hist["weeks"][-1] == "2026-W17" and len(hist["weeks"]) == 69,
          "future dates only in nextVisitAfterToday, closures, bookings, forecast, events and peers")
    idx = files["calendar"]["regionIndex"]["2026"]
    check("calendar.json stops at 2026-W18; no hindsight (22 Jun onset, May record heat)",
          max(idx) == "2026-W18" and "2026-06-22" not in json.dumps(files["calendar"]), "")
    # 3 tier ↔ visits ↔ cadence
    tier_ok = {"Diamond": (4, 7), "Gold": (4, 7), "Silver": (3, 10), "Bronze": (2, 14), "Iron": (1, 28)}
    bad = [o["id"] for o in outlets if (o["visitsPerMonth"], visits["outlets"][o["id"]]["cadenceDays"]) != tier_ok[o["tier"]]]
    check("Tier ↔ visits a month ↔ visit cadence agree", not bad, ", ".join(f"{o['id']} {o['tier']}" for o in outlets))
    # 4 scheme eligibility and caps
    tiers = {o["id"]: o["tier"] for o in outlets}
    cool = {o["id"]: o["cooler"]["type"] for o in outlets}
    bad = [o["id"] for o in orders if "SCH-SS26" in o["schemeIds"] and tiers[o["outletId"]] not in ("Diamond", "Gold", "Silver")]
    bad += [o["id"] for o in orders if "SCH-WT26" in o["schemeIds"] and cool[o["outletId"]] != "bottler"]
    per_month = defaultdict(int)
    for o in orders:
        if "SCH-SS26" in o["schemeIds"]:
            per_month[(o["outletId"], o["date"][:7])] += sum(l["freeCases"] for l in o["lines"] if l["sku"] in SS_SKUS)
    over = [k for k, v in per_month.items() if v > 4]
    check("Scheme eligibility and caps: free cases only where the tier/cooler allows; ≤ 4 Summer Single-Serve uses per outlet per month (by order date)",
          not bad and not over, "; ".join(f"{k[0]} {k[1]}: {v}" for k, v in sorted(per_month.items())))
    # 5 closures
    closed_orders = [o["id"] for o in orders if o["outletId"] == "OUT-05" and in_ranges(date.fromisoformat(o["date"]), CLOSURES_05)]
    closed_visits = [v for v in visits["outlets"]["OUT-05"]["visits"] if in_ranges(date.fromisoformat(v["date"]), CLOSURES_05)]
    check("Closures ↔ zero orders (OUT-05), and visits in closures are done: false", not closed_orders and all(not v["done"] for v in closed_visits),
          f"{len(closed_visits)} visits fell in closures")
    # 6 no cooler flatter + take-home mix
    th = lambda oid: sum(l["cases"] for o in orders if o["outletId"] == oid for l in o["lines"] if l["sku"] in TAKE_HOME) / max(1, sum(l["cases"] for o in orders if o["outletId"] == oid for l in o["lines"]))
    check("No cooler ↔ a flatter summer and a take-home mix (OUT-02 vs OUT-01, OUT-03)",
          S["OUT-02"]["liftByOrderDate"] < S["OUT-01"]["liftByOrderDate"] < S["OUT-03"]["liftByOrderDate"] and th("OUT-02") >= 0.6,
          f"lifts by order date 02 {S['OUT-02']['liftByOrderDate']}× · 01 {S['OUT-01']['liftByOrderDate']}× · 03 {S['OUT-03']['liftByOrderDate']}×; OUT-02 take-home share {th('OUT-02'):.0%}")
    # 7 one-off events visible weekly
    wk = hist["weeks"]
    h01 = hist["outlets"]["OUT-01"].get("CL250", [0] * 69)
    o02 = [o for o in orders if o["outletId"] == "OUT-02" and o["date"] == "2025-05-19"]
    ch = lambda w: sum(v[wk.index(w)] for s, v in hist["outlets"]["OUT-03"].items() if s in CHILLED_SINGLE)
    check("One-off events show in the weekly data", h01[wk.index("2025-W16")] == 0 and o02 and sum(l["cases"] for l in o02[0]["lines"]) == 5
          and ch("2025-W18") < min(ch("2025-W17"), ch("2025-W19")),
          f"OUT-01 CL250 in 2025-W16: {h01[wk.index('2025-W16')]} (W15 {h01[wk.index('2025-W15')]}, W17 {h01[wk.index('2025-W17')]}) · "
          f"OUT-02 19 May 2025: {sum(l['cases'] for l in o02[0]['lines']) if o02 else 0} cases · "
          f"OUT-03 cold packs W17/W18/W19: {ch('2025-W17')}/{ch('2025-W18')}/{ch('2025-W19')}")
    # 8 credit stories
    c = {o["id"]: o["credit"] for o in outlets}
    head = lambda oid: c[oid]["limit"] - c[oid]["outstanding"]
    max02 = max((o["netValue"] for o in orders if o["outletId"] == "OUT-02" and o["date"] != "2025-05-19"), default=0)
    check("Credit matches each story", S["OUT-04"]["maxOrder2025"]["value"] > c["OUT-04"]["limit"] and max02 <= head("OUT-02")
          and S["OUT-06"]["todayCover"]["value"] > head("OUT-06"),
          f"04 peak order ₹{S['OUT-04']['maxOrder2025']['value']:,} vs ₹{c['OUT-04']['limit']:,} limit · 02 largest order ₹{max02:,} vs ₹{head('OUT-02'):,} room · "
          f"06 today's cover ₹{S['OUT-06']['todayCover']['value']:,} vs ₹{head('OUT-06'):,} room")
    # 9 April uses
    a03 = S["OUT-03"]["aprilOrders2026"]
    check("OUT-03 has used all 4 April uses (7, 14, 21 Apr; one order ≥ 20 pooled); OUT-01 still has uses left",
          S["OUT-03"]["aprilUses2026"] == 4 and any(x["pooled"] >= 20 for x in a03) and S["OUT-01"]["aprilUses2026"] < 4,
          f"03: {a03} · 01 uses: {S['OUT-01']['aprilUses2026']}")
    # 10 ration and MG600
    bad = [o["id"] for o in orders if o["date"] >= iso(RATION_FROM) and any(l["sku"] == "CL250" and l["cases"] > 6 for l in o["lines"])]
    bad += [o["id"] for o in orders if o["date"] >= iso(MG600_OUT_FROM) and any(l["sku"] == "MG600" for l in o["lines"])]
    check("From 20 Apr 2026: ≤ 6 paid cases of 250 ml cola per order; no mango 600 ml", not bad, "")
    # 11 OUT-08
    o8 = next(o for o in outlets if o["id"] == "OUT-08")
    check("OUT-08: no orders, no visits, history {}, registered 2026-04-22",
          not [o for o in orders if o["outletId"] == "OUT-08"] and visits["outlets"]["OUT-08"]["visits"] == []
          and hist["outlets"]["OUT-08"] == {} and o8["registeredOn"] == "2026-04-22", "")
    # 12 est, names, codes
    blob = json.dumps(files, ensure_ascii=False)
    check("Every file flagged est; no OT-0xx codes; replaced names absent",
          all(f["meta"]["est"] for f in files.values()) and "OT-0" not in blob and "Gaikwad" not in blob and "Suresh" not in blob, "")
    # 13 prices
    check("PTR = MRP × units × 0.85 (0.80 water), rounded", all(PTR[p[0]] == round(p[8] * p[6] * (0.80 if p[2] == "Water" else 0.85)) for p in PRODUCTS),
          ", ".join(f"{s} ₹{v}" for s, v in PTR.items()))
    # 14 size
    total = sum((DATA / f"{n}.json").stat().st_size for n in files)
    check("All of data/ under about 250 KB", total < 256_000, f"{total / 1024:.0f} KB")
    # 15 distinct shapes
    shapes = {oid: (S[oid].get("peakMonthByOrderDate"), S[oid].get("liftByOrderDate")) for oid in PERSONAS if S[oid].get("monthly2025")}
    check("No two personas share a shape (peak month, lift; by order date)", len(set(shapes.values())) == len(shapes),
          "; ".join(f"{k[-2:]}: month {v[0]}, {v[1]}×" for k, v in shapes.items()))
    return res


def write_checks(res):
    VALID.mkdir(parents=True, exist_ok=True)
    lines = ["# Data checks", "", f"Written by `scripts/generate_data.py` (seed {SEED}). Re-run the script to refresh.", "",
             "| # | Check | Result | Detail |", "|---|---|---|---|"]
    for i, (name, ok, detail) in enumerate(res, 1):
        lines.append(f"| {i} | {name} | {'PASS' if ok else 'FAIL'} | {detail.replace('|', '/')} |")
    lines += ["", "Not automated: \"each persona is recognisable from its chart alone\" is checked by eye on the persona sheets, which are drawn from `summary.json`."]
    (VALID / "checks.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def settings_table_md():
    rows = ["| Outlet | Base cases/week (Jan 2025) | Channel peak | Timing | Cadence | Mix (% of cases) | Story the history shows |",
            "|---|---|---|---|---|---|---|"]
    for oid, p in PERSONAS.items():
        mix = ", ".join(f"{s} {v}" for s, v in p["mix"].items())
        rows.append(f"| {oid} | {p['base'] if p['base'] is not None else '—'} | {p['peak'] if p['peak'] else 'bookings'} | {p['timing']} | {p['cadence']} d | {mix} | {p['story']} |")
    return "\n".join(rows)


def numbers_table_md(S):
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    rs = lambda v: f"₹{v:,}"
    rows = ["| Outlet | 2025 cases by month (order date) | Jan–Apr 2026 (to 26 Apr) | Peak month | Peak ÷ Jan–Feb | Winter order | Peak-month order | Today's order should cover |",
            "|---|---|---|---|---|---|---|---|"]
    for oid, s in S.items():
        if not s.get("monthly2025"):
            rows.append(f"| {oid} | no history (registered 2026-04-22) | — | — | — | — | — | first order; peers ≈ {S[oid].get('peerFortnight')} cases a fortnight (est.) |")
            continue
        tc = s.get("todayCover", {})
        cover = f"{tc.get('cases')} cases, {rs(tc.get('value', 0))}" + (f" ({tc['events']} events)" if "events" in tc else "") + f", to {tc.get('until')}"
        rows.append(f"| {oid} | {' '.join(str(x) for x in s['monthlyByOrderDate2025'])} | {' '.join(str(x) for x in s['monthlyByOrderDate2026JanApr'])} | "
                    f"{months[s['peakMonthByOrderDate'] - 1]} | {s['liftByOrderDate']}× | "
                    f"{s['winterOrder']['cases']} cases, {rs(s['winterOrder']['value'])} | {s['peakMonthOrderByDate']['cases']} cases, {rs(s['peakMonthOrderByDate']['value'])} | "
                    f"{cover} |")
    return "\n".join(rows)


def sync_personas_md(S):
    if not PERSONAS_MD.exists():
        return False
    text = PERSONAS_MD.read_text(encoding="utf-8")
    new = re.sub(r"<!-- settings:start -->.*?<!-- settings:end -->",
                 lambda m: "<!-- settings:start -->\n" + settings_table_md() + "\n<!-- settings:end -->", text, flags=re.S)
    new = re.sub(r"<!-- numbers:start -->.*?<!-- numbers:end -->",
                 lambda m: "<!-- numbers:start -->\n" + numbers_table_md(S) + "\n<!-- numbers:end -->", new, flags=re.S)
    PERSONAS_MD.write_text(new, encoding="utf-8")
    return new != text


# ------------------------------------------------------------------------------ main

def main():
    DATA.mkdir(exist_ok=True)
    outlets = outlets_json()
    by_id = {o["id"]: o for o in outlets}
    orders, plan = build_orders()
    force_03_april(orders)
    apply_schemes(orders, by_id)
    orders.sort(key=lambda o: (o["outletId"], o["date"]))
    orders_by_id = {o["id"]: o for o in orders}
    visits = {"meta": meta("Planned visits from 2024-12-30 to 2026-04-26, every cadenceDays back from the demo date (Sunday visits moved to Saturday). done: false = missed or closed."),
              "outlets": build_visits(plan, orders_by_id)}
    hist = build_history(orders)
    files = {
        "config": config_json(),
        "outlets": {"meta": meta("8 persona outlets. Fictional names and addresses. Bookings and closures are recorded by the rep (est where flagged)."), "outlets": outlets},
        "products": products_json(),
        "schemes": schemes_json(),
        "orders": {"meta": meta("Every booked order 2024-12-30 to 2026-04-26 (cases booked, not delivered). 2026 schemes applied with the rules in js/schemes.js."), "orders": orders},
        "history": hist,
        "visits": visits,
        "distributor_stock": stock_json(),
        "calendar": calendar_json(),
        "peers": peers_json(),
    }
    per_line = {"orders": "orders", "history": "history", "visits": "visits"}
    for n, obj in files.items():
        write(n, obj, per_line.get(n))
    S = summarise(orders, visits, outlets)
    VALID.mkdir(parents=True, exist_ok=True)
    (VALID / "summary.json").write_text(json.dumps({"seed": SEED, "outlets": S}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    res = run_checks(files, orders, hist, visits, outlets, S)
    write_checks(res)
    synced = sync_personas_md(S)

    print(f"seed {SEED}")
    for n in files:
        size = (DATA / f"{n}.json").stat().st_size
        rows = {"orders": len(orders), "visits": sum(len(v["visits"]) for v in visits["outlets"].values()),
                "outlets": len(outlets), "products": len(PRODUCTS), "schemes": 5,
                "history": sum(len(v) for v in hist["outlets"].values())}.get(n, "")
        print(f"  data/{n}.json  {size / 1024:6.1f} KB  {rows}")
    print(f"  total {sum((DATA / f'{n}.json').stat().st_size for n in files) / 1024:.0f} KB")
    fails = [r for r in res if not r[1]]
    print(f"checks: {len(res) - len(fails)}/{len(res)} pass" + ("" if not fails else " · FAIL: " + "; ".join(r[0] for r in fails)))
    if synced:
        print("docs/personas.md tables updated")


if __name__ == "__main__":
    main()
