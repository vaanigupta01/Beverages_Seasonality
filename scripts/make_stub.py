#!/usr/bin/env python3
"""
STUB dataset for the GT App base.

Writes data/*.json in exactly the shape of the data contract
(PROGRESS.md -> "Shared · Data contract"), but small: orders only for
2026-W10 ... 2026-W17, and just enough to exercise every base-screen situation
(no orders, dues, closures, a used-up scheme cap, cooler-only schemes, a first order).

The personas chat's scripts/generate_data.py replaces all of it. Dropping its files
into data/ must need no code changes; if it does, the contract was broken.

Run from the project root:  python3 scripts/make_stub.py
"""
import json
import random
from datetime import date, timedelta
from pathlib import Path

SEED = 428
rng = random.Random(SEED)
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data"

DEMO = date(2026, 4, 28)          # Tuesday, 2026-W18
HIST_FROM = date(2024, 12, 30)    # Monday that starts 2025-W01
HIST_TO = date(2026, 4, 26)       # Sunday that ends 2026-W17
STUB_FROM = date(2026, 3, 2)      # Monday that starts 2026-W10


def meta(note=""):
    return {
        "generatedBy": "scripts/make_stub.py",
        "seed": SEED,
        "est": True,
        "note": ("STUB: replace with the personas chat's files. " + note).strip(),
    }


def iso(d):
    return d.isoformat()


def week_label(d):
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


# ---------------------------------------------------------------- products
# sku, name, category, flavour, pack, ml, units/case, litres/case, MRP/unit, PTR/case,
# shelf days, chilled, single-serve, returnable, focus, summer multiplier (est)
P = [
    ("CL200G", "Cola 200 ml returnable glass", "Sparkling", "Cola", "glass", 200, 24, 4.8, 10, 204, 180, "yes", True, True, True, 3.0),
    ("CL250", "Cola 250 ml PET", "Sparkling", "Cola", "PET", 250, 28, 7.0, 20, 476, 120, "yes", True, False, True, 3.0),
    ("LL250", "Lemon-lime 250 ml PET", "Sparkling", "Lemon-lime", "PET", 250, 28, 7.0, 20, 476, 120, "yes", True, False, False, 3.2),
    ("OR250", "Orange 250 ml PET", "Sparkling", "Orange", "PET", 250, 28, 7.0, 20, 476, 120, "yes", True, False, False, 2.5),
    ("CL300C", "Cola 300 ml can", "Sparkling", "Cola", "can", 300, 24, 7.2, 40, 816, 240, "yes", True, False, False, 2.0),
    ("CL750", "Cola 750 ml PET", "Sparkling", "Cola", "PET", 750, 24, 18.0, 40, 816, 120, "partly", False, False, False, 2.2),
    ("OR1250", "Orange 1.25 L PET", "Sparkling", "Orange", "PET", 1250, 12, 15.0, 65, 663, 180, "no", False, False, False, 1.8),
    ("CL2250", "Cola 2.25 L PET", "Sparkling", "Cola", "PET", 2250, 9, 20.25, 95, 727, 180, "no", False, False, False, 1.8),
    ("MG150T", "Mango drink 150 ml Tetra", "Juice drinks", "Mango", "tetra", 150, 40, 6.0, 10, 340, 180, "yes", True, False, True, 3.0),
    ("MG600", "Mango drink 600 ml PET", "Juice drinks", "Mango", "PET", 600, 24, 14.4, 38, 775, 120, "yes", True, False, False, 2.5),
    ("WT1000", "Packaged water 1 L PET", "Water", "Water", "PET", 1000, 15, 15.0, 20, 240, 365, "yes", False, False, True, 2.75),
    ("WT500", "Packaged water 500 ml PET", "Water", "Water", "PET", 500, 24, 12.0, 10, 192, 365, "yes", True, False, False, 3.0),
    ("EN250", "Energy drink 250 ml PET", "Energy", "Energy", "PET", 250, 24, 6.0, 20, 408, 270, "yes", True, False, False, 1.5),
]
PRODUCTS = []
for (sku, name, cat, flav, ptype, ml, units, litres, mrp, ptr, shelf, chilled, single, ret, focus, mult) in P:
    PRODUCTS.append({
        "sku": sku, "name": name, "category": cat, "flavour": flav,
        "pack": {"type": ptype, "ml": ml}, "unitsPerCase": units,
        "caseLabel": "crate" if ret else "case", "litresPerCase": litres,
        "mrpPerUnit": mrp, "ptrPerCase": ptr, "marginPct": 20 if cat == "Water" else 15,
        "shelfLifeDays": shelf, "chilled": chilled, "singleServe": single, "returnable": ret,
        "depositPerCrate": None, "focus": focus, "summerMultiplier": mult, "est": ["summerMultiplier"],
    })
PTR = {p["sku"]: p["ptrPerCase"] for p in PRODUCTS}

# ---------------------------------------------------------------- schemes
SCHEMES = [
    {"id": "SCH-SS26", "name": "Summer Single-Serve", "type": "free-goods",
     "skus": ["CL250", "LL250", "CL200G"],
     "rule": {"buyCases": 10, "freeCases": 1, "pooled": True, "freeSku": "largest-line"},
     "eligibleTiers": ["Diamond", "Gold", "Silver"], "requiresBottlerCooler": False,
     "capUsesPerMonth": 4, "validFrom": "2026-03-01", "validTo": "2026-05-31",
     "payout": "Free case comes with the delivery; the bottler credits the distributor within 30 days of the claim",
     "extras": "Free cooler shelf-strip with the first qualifying order", "est": False},
    {"id": "SCH-MG26", "name": "Mango Push", "type": "percent-off",
     "skus": ["MG150T", "MG600"], "rule": {"minCases": 5, "percent": 8, "pooled": True},
     "eligibleTiers": "all", "requiresBottlerCooler": False, "capUsesPerMonth": None,
     "validFrom": "2026-04-01", "validTo": "2026-06-30",
     "payout": "Taken off the invoice", "extras": None, "est": False},
    {"id": "SCH-WT26", "name": "Water Summer", "type": "free-goods",
     "skus": ["WT1000"], "rule": {"buyCases": 8, "freeCases": 1, "pooled": False, "freeSku": "same"},
     "eligibleTiers": "all", "requiresBottlerCooler": True, "capUsesPerMonth": None,
     "validFrom": "2026-04-01", "validTo": "2026-06-30",
     "payout": "Free case comes with the delivery", "extras": None, "est": True},
    {"id": "SCH-NEW", "name": "New Outlet Activation", "type": "first-order",
     "skus": "all", "rule": {"percent": 12, "withinDaysOfRegistration": 90},
     "eligibleTiers": "all", "requiresBottlerCooler": False, "capUsesPerMonth": None,
     "validFrom": None, "validTo": None,
     "payout": "Taken off the invoice", "extras": None, "est": False},
    {"id": "PRG-PURITY", "name": "Cooler Purity Program", "type": "program",
     "skus": "all", "rule": None, "eligibleTiers": "all", "requiresBottlerCooler": True,
     "capUsesPerMonth": None, "validFrom": None, "validTo": None,
     "payout": "₹300 a month if the cooler holds only our drinks at the monthly photo audit",
     "extras": "New coolers are placed only at Diamond, Gold and Silver outlets", "est": False},
]

# ---------------------------------------------------------------- outlets
def cooler(kind, count=0, litres=0, audit=None, outage=False):
    return {"type": kind, "count": count, "litres": litres, "afternoonOutage": outage, "lastAudit": audit}


def credit(limit, due=0, last=None, mode="credit"):
    return {"limit": limit, "outstanding": due, "overdue": due, "lastPaymentDate": last, "paymentMode": mode}


def booking(d, event, cases):
    return {"date": d, "event": event, "expectedCases": cases, "est": True}


def persona(no, label, role, one):
    return {"no": no, "label": label, "role": role, "oneLine": one}


OUTLETS = [
    {"id": "OUT-01", "name": "Mauli General Stores",
     "persona": persona(1, "The Flagship Kirana", "helps-most", "Big summer, but stocks up late when scheme details are late."),
     "channel": "Traditional Kirana", "shopType": "Traditional Kirana", "area": "Kothrud",
     "address": "Karve Road, Kothrud", "locationContext": "Busy residential main road",
     "tier": "Diamond", "visitsPerMonth": 4, "registeredOn": "2019-06-01",
     "owner": {"name": "Vilas Kale", "behaviour": "Plans with the rep; waits for scheme terms", "usuallyPresent": True},
     "cooler": cooler("bottler", 1, 300, {"date": "2026-04-15", "pure": True, "fillPct": 82, "tempC": 5}),
     "credit": credit(18000, 0, "2026-04-21"),
     "tags": ["residential", "main-road"], "closures": [], "bookings": [], "empties": {"cratesHeld": 5}},
    {"id": "OUT-02", "name": "Samarth Kirana",
     "persona": persona(2, "The Cautious Kirana", "handle-with-care", "Small, careful orders; dues make him wary of stocking up."),
     "channel": "Traditional Kirana", "shopType": "Traditional Kirana", "area": "Warje",
     "address": "Ganpati Chowk lane, Warje", "locationContext": "Inner residential lane",
     "tier": "Bronze", "visitsPerMonth": 2, "registeredOn": "2021-02-10",
     "owner": {"name": "Sadashiv Mane", "behaviour": "Orders small; worried about dues", "usuallyPresent": True},
     "cooler": cooler("none"), "credit": credit(4500, 1800, "2026-03-31"),
     "tags": ["residential", "price-sensitive"], "closures": [], "bookings": []},
    {"id": "OUT-03", "name": "Thanda Corner Cold Drinks",
     "persona": persona(3, "The Cold-Drink Shop", "helps-most", "Lives on chilled single-serve; power cuts warm the coolers."),
     "channel": "Convenience", "shopType": "Cold-drink shop", "area": "Kothrud",
     "address": "College Road, Kothrud", "locationContext": "Opposite a college gate",
     "tier": "Gold", "visitsPerMonth": 4, "registeredOn": "2020-11-05",
     "owner": {"name": "Imran Shaikh", "behaviour": "Orders big, fast decisions", "usuallyPresent": True},
     "cooler": cooler("bottler", 2, 300, {"date": "2026-04-15", "pure": True, "fillPct": 64, "tempC": 8}, outage=True),
     "credit": credit(15000, 0, "2026-04-21"),
     "tags": ["college", "footfall-evening"], "closures": [], "bookings": [], "empties": {"cratesHeld": 6}},
    {"id": "OUT-04", "name": "Lakeside Bhel & Snacks",
     "persona": persona(4, "The Lakeside Snack Stall", "thin-data", "Tiny, irregular orders; weekend crowds by the lake."),
     "channel": "Entertainment & Leisure", "shopType": "Snack stall", "area": "Pashan",
     "address": "Lake promenade, Pashan", "locationContext": "Lakeside walking path",
     "tier": "Iron", "visitsPerMonth": 1, "registeredOn": "2022-03-14",
     "owner": {"name": "Balu Waghmare", "behaviour": "Pays cash above his limit", "usuallyPresent": False},
     "cooler": cooler("ice-box", 1, 40), "credit": credit(1500, 0, "2026-03-31", "cash-and-credit"),
     "tags": ["tourist-spot", "weekend-crowds"], "closures": [], "bookings": []},
    {"id": "OUT-05", "name": "Sunrise School Canteen",
     "persona": persona(5, "The School Canteen", "stays-quiet", "Busy on school days; shut for the summer vacation."),
     "channel": "Education", "shopType": "School canteen", "area": "Bavdhan",
     "address": "Sunrise School campus, Bavdhan", "locationContext": "Inside a school",
     "tier": "Silver", "visitsPerMonth": 3, "registeredOn": "2018-07-01",
     "owner": {"name": "Kavita Joshi", "role": "Canteen contractor", "behaviour": "Follows the school calendar", "usuallyPresent": True},
     "cooler": cooler("bottler", 1, 150, {"date": "2026-04-16", "pure": True, "fillPct": 70, "tempC": 6}),
     "credit": credit(5000, 0, "2026-04-18"),
     "tags": ["school"],
     "closures": [
         {"from": "2025-05-01", "to": "2025-06-15", "reason": "Maharashtra Day holiday, then school summer vacation (reopened 16 Jun)"},
         {"from": "2026-05-01", "to": "2026-06-14", "reason": "Maharashtra Day holiday, then school summer vacation (reopens 15 Jun)"},
     ], "bookings": []},
    {"id": "OUT-06", "name": "Shubh Mangal Banquets",
     "persona": persona(6, "The Banquet Hall", "own-calendar", "Orders follow the wedding bookings, not the weather."),
     "channel": "Eating & Drinking (Seated)", "shopType": "Banquet hall", "area": "Bavdhan",
     "address": "Chandani Chowk road, Bavdhan", "locationContext": "Near the highway exit",
     "tier": "Silver", "visitsPerMonth": 3, "registeredOn": "2021-10-20",
     "owner": {"name": "Prakash Kulkarni", "role": "Manager", "behaviour": "Shares the booking calendar; asks for more credit", "usuallyPresent": False},
     "cooler": cooler("bottler", 1, 150, {"date": "2026-04-16", "pure": False, "fillPct": 55, "tempC": 6}),
     "credit": credit(12000, 0, "2026-04-18"),
     "tags": ["events"], "closures": [],
     "bookings": [booking(d, e, c) for d, e, c in [
         ("2026-04-28", "Engagement lunch, ~120 guests", 3),
         ("2026-04-30", "Birthday party, ~80 guests", 2),
         ("2026-05-01", "Wedding reception, ~350 guests", 6),
         ("2026-05-02", "Wedding, ~400 guests", 7),
         ("2026-05-03", "Munj (thread ceremony), ~150 guests", 3),
         ("2026-05-03", "Anniversary dinner, ~100 guests", 2),
         ("2026-05-06", "Corporate lunch, ~60 guests", 2),
         ("2026-05-08", "Haldi and sangeet, ~200 guests", 4),
         ("2026-05-09", "Wedding, ~300 guests", 5),
         ("2026-05-10", "Engagement, ~150 guests", 3),
         ("2026-05-10", "Naming ceremony (barsa), ~70 guests", 2),
         ("2026-05-13", "Retirement party, ~90 guests", 2),
         ("2026-05-15", "Sangeet, ~180 guests", 4),
         ("2026-05-16", "Wedding, ~500 guests", 10),
     ]],
     "empties": {"cratesHeld": 4}},
    {"id": "OUT-07", "name": "Mahalaxmi Beverage Agency",
     "persona": persona(7, "The Beverage Wholesaler", "stays-quiet", "Very large take-home loads for small shops around Warje."),
     "channel": "Wholesale", "shopType": "Beverage wholesaler", "area": "Warje",
     "address": "Market Yard lane, Warje", "locationContext": "Wholesale market",
     "tier": "Diamond", "visitsPerMonth": 4, "registeredOn": "2016-04-01",
     "owner": {"name": "Mahesh Agarwal", "behaviour": "Negotiates on rate; pays at month end", "usuallyPresent": True},
     "cooler": cooler("none"), "credit": credit(75000, 16500, "2026-04-14"),
     "tags": ["market", "month-end-loads"], "closures": [], "bookings": []},
    {"id": "OUT-08", "name": "Ashirwad General Store",
     "persona": persona(8, "The New Owner", "thin-data", "New owner, registered 22 Apr; no orders or visits yet."),
     "channel": "Traditional Kirana", "shopType": "Traditional Kirana", "area": "Pashan",
     "address": "NCL Road, Pashan", "locationContext": "Residential colony corner",
     "tier": "Bronze", "visitsPerMonth": 2, "registeredOn": "2026-04-22",
     "owner": {"name": "Nitin Salunkhe", "behaviour": "New to the trade; wants rates first", "usuallyPresent": True},
     "cooler": cooler("none"), "credit": credit(5000, 0, None),
     "tags": ["residential", "new-owner"], "closures": [], "bookings": []},
]
BY_ID = {o["id"]: o for o in OUTLETS}

# ---------------------------------------------------------------- visit plan and order templates
# cadence days by tier: Diamond/Gold 7, Silver 10, Bronze 14, Iron ~28
PLAN = {
    "OUT-01": {"cadence": 7, "routeOrder": 1, "lines": {"CL250": (6, 0), "LL250": (4, 1), "CL200G": (3, 1), "MG150T": (3, 1), "WT1000": (2, 1), "CL2250": (2, 1), "OR1250": (1, 1)}},
    "OUT-03": {"cadence": 7, "routeOrder": 2, "lines": {"CL300C": (5, 1), "EN250": (4, 1), "CL250": (6, 0), "LL250": (5, 1), "WT500": (4, 1), "MG600": (2, 1), "OR250": (2, 1)}},
    "OUT-07": {"cadence": 7, "routeOrder": 3, "lines": {"CL2250": (10, 2), "OR1250": (7, 2), "CL750": (8, 2), "WT1000": (10, 2), "CL250": (6, 0), "LL250": (4, 1), "MG150T": (4, 1)}},
    "OUT-02": {"cadence": 14, "routeOrder": 4, "lines": {"CL2250": (3, 1), "OR1250": (2, 1), "CL750": (1, 0), "WT1000": (1, 0)}},
    "OUT-05": {"cadence": 10, "routeOrder": 5, "lines": {"MG150T": (3, 1), "WT500": (3, 1), "WT1000": (2, 1)}},
    "OUT-06": {"cadence": 10, "routeOrder": 6, "lines": {"WT1000": (8, 2), "CL2250": (3, 1), "WT500": (3, 1), "CL250": (2, 1), "CL200G": (2, 1)}},
    "OUT-08": {"cadence": 14, "routeOrder": 7, "lines": {}},
    "OUT-04": {"cadence": 28, "routeOrder": 8, "lines": {"CL250": (2, 1), "WT500": (1, 0), "MG150T": (1, 0)}},
}
# fixed quantities on specific visits (sku -> cases)
OVERRIDES = {
    ("OUT-03", "2026-04-21"): {"LL250": 10, "CL200G": 4},   # 20 pooled -> 2 uses: April cap (4) now used up
    ("OUT-06", "2026-04-18"): {"WT1000": 12, "CL2250": 5},  # wedding weekend
}
NO_ORDER = {("OUT-06", "2026-03-29"), ("OUT-06", "2026-03-09")}  # no events booked
MISSED = {("OUT-02", "2026-03-03")}                               # shop shut when the rep came
NOTES = {  # latest first, attached to the last two done visits
    "OUT-01": ["Cooler full at 9 am; owner expects a rush over the 1–3 May holiday weekend.",
               "Asked when the May scheme letter comes; wants terms before stocking up."],
    "OUT-02": ["Paid ₹1,000 cash; ₹1,800 still due. Asked to keep the order small.",
               "Mostly sells 2.25 L and 1.25 L; no space for a cooler."],
    "OUT-03": ["Power cut 2–5 pm most days; coolers warm by evening. Cans sell fastest.",
               "College exams end 30 Apr; evening crowd for the cricket on TV."],
    "OUT-04": ["Pays cash for anything above his limit. Weekend crowd by the lake.",
               "Buys ice every morning; the ice box holds about one case."],
    "OUT-05": ["School closes 1 May for Maharashtra Day, then summer vacation till 14 June.",
               "Tetra mango sells most at the lunch break."],
    "OUT-06": ["Manager shared the booking calendar: 14 functions from 28 Apr to 16 May.",
               "Manager wants the credit limit raised to ₹15,000 for the wedding season."],
    "OUT-07": ["Month-end loads for small shops around Warje; ₹16,500 still due.",
               "Asked for more 250 ml cola; allocation is tight."],
    "OUT-08": [],   # registered 22 Apr: not visited yet
}


def active(s, d):
    return (s["validFrom"] is None or s["validFrom"] <= d) and (s["validTo"] is None or d <= s["validTo"])


def price(outlet, cart, d, prior):
    """Mirror of js/schemes.js price(): same rules, so history and the app agree."""
    lines = [{"sku": k, "cases": v, "freeCases": 0} for k, v in cart.items() if v > 0]
    by = {l["sku"]: l for l in lines}
    gross = sum(l["cases"] * PTR[l["sku"]] for l in lines)
    discount, ids = 0, []
    for s in SCHEMES:
        if not active(s, d) or s["type"] == "program":
            continue
        tiers = s["eligibleTiers"]
        ok = (tiers == "all" or outlet["tier"] in tiers) and \
             (not s["requiresBottlerCooler"] or outlet["cooler"]["type"] == "bottler")
        scoped = [l for l in lines if s["skus"] == "all" or l["sku"] in s["skus"]]
        if s["type"] == "free-goods" and scoped and ok:
            r = s["rule"]
            if r["pooled"]:
                earned = sum(l["cases"] for l in scoped) // r["buyCases"] * r["freeCases"]
            else:
                earned = sum(l["cases"] // r["buyCases"] * r["freeCases"] for l in scoped)
            if s["capUsesPerMonth"]:
                month = d[:7]
                used = sum(l.get("freeCases", 0) for o in prior if o["date"][:7] == month and s["id"] in o["schemeIds"]
                           for l in o["lines"] if l["sku"] in s["skus"])
                earned = min(earned, max(0, s["capUsesPerMonth"] - used))
            if earned > 0:
                if r["pooled"]:
                    target = max(scoped, key=lambda l: (l["cases"], -s["skus"].index(l["sku"])))
                    target["freeCases"] += earned
                else:
                    for l in scoped:
                        l["freeCases"] += l["cases"] // r["buyCases"] * r["freeCases"]
                ids.append(s["id"])
        elif s["type"] == "percent-off" and scoped and ok:
            if sum(l["cases"] for l in scoped) >= s["rule"]["minCases"]:
                amt = round(sum(l["cases"] * PTR[l["sku"]] for l in scoped) * s["rule"]["percent"] / 100)
                discount += amt
                ids.append(s["id"])
    for s in SCHEMES:  # first-order discounts come last, on what is left
        if s["type"] == "first-order" and active(s, d) and lines and not prior:
            days = (date.fromisoformat(d) - date.fromisoformat(outlet["registeredOn"])).days
            if 0 <= days <= s["rule"]["withinDaysOfRegistration"]:
                discount += round((gross - discount) * s["rule"]["percent"] / 100)
                ids.append(s["id"])
    order_lines = [{"sku": l["sku"], "cases": l["cases"], "freeCases": l["freeCases"]} for l in lines]
    return order_lines, gross, discount, ids


SKU_ORDER = [p["sku"] for p in PRODUCTS]
orders, visits = [], {}
for oid, plan in PLAN.items():
    outlet = BY_ID[oid]
    start = max(STUB_FROM, date.fromisoformat(outlet["registeredOn"]))
    dates = []
    d = DEMO - timedelta(days=plan["cadence"])
    while d >= start:
        if d <= HIST_TO:
            dates.append(d)
        d -= timedelta(days=plan["cadence"])
    dates.sort()
    prior, vlist = [], []
    for d in dates:
        ds = iso(d)
        done = (oid, ds) not in MISSED
        order_id = None
        if done and plan["lines"] and (oid, ds) not in NO_ORDER:
            cart = {sku: max(0, base + rng.randint(-j, j)) for sku, (base, j) in plan["lines"].items()}
            cart.update(OVERRIDES.get((oid, ds), {}))
            cart = {k: cart[k] for k in SKU_ORDER if cart.get(k, 0) > 0}
            lines, gross, disc, ids = price(outlet, cart, ds, prior)
            order_id = f"ORD-{oid[-2:]}-{d.strftime('%Y%m%d')}"
            order = {"id": order_id, "outletId": oid, "date": ds, "lines": lines,
                     "grossValue": gross, "discountValue": disc, "netValue": gross - disc,
                     "schemeIds": ids, "source": "history"}
            orders.append(order)
            prior.append(order)
        vlist.append({"date": ds, "planned": True, "done": done,
                      "minutes": rng.randint(4, 10) if done else 0, "orderId": order_id, "note": None})
    done_visits = [v for v in vlist if v["done"]]
    for v, note in zip(reversed(done_visits), NOTES[oid]):
        v["note"] = note
    visits[oid] = {"cadenceDays": plan["cadence"], "todayOnRoute": True, "routeOrder": plan["routeOrder"],
                   "nextVisitAfterToday": iso(DEMO + timedelta(days=plan["cadence"])), "visits": vlist}

orders.sort(key=lambda o: (o["date"], o["outletId"]))

# ---------------------------------------------------------------- history (derived from orders)
week_starts = []
d = HIST_FROM
while d <= HIST_TO:
    week_starts.append(d)
    d += timedelta(days=7)
assert len(week_starts) == 69, len(week_starts)
week_idx = {week_label(ws): i for i, ws in enumerate(week_starts)}
hist = {o["id"]: {} for o in OUTLETS}
for o in orders:
    i = week_idx[week_label(date.fromisoformat(o["date"]))]
    for l in o["lines"]:
        row = hist.setdefault(o["outletId"], {}).setdefault(l["sku"], [0] * 69)
        row[i] += l["cases"]

# ---------------------------------------------------------------- calendar (stub shapes, est)
def index_2025(w):
    shape = {1: 1.0, 5: 1.1, 9: 1.4, 12: 2.0, 15: 2.6, 19: 2.8, 22: 1.4, 27: 1.1, 31: 1.0, 40: 1.3, 45: 1.1, 49: 1.0}
    keys = sorted(shape)
    val = shape[1]
    for k in keys:
        if w >= k:
            val = shape[k]
    return val


def index_2026(w):
    shape = {1: 1.1, 5: 1.2, 9: 1.5, 12: 2.0, 14: 2.3, 15: 2.5, 17: 2.6, 18: 2.7}
    val = 1.1
    for k in sorted(shape):
        if w >= k:
            val = shape[k]
    return val


CALENDAR = {
    "meta": meta("Index and phases are placeholder shapes, not the research's Table A."),
    "regionIndex": {"est": True, "basis": "January average week = 1.0",
                    "2025": {f"2025-W{w:02d}": index_2025(w) for w in range(1, 53)},
                    "2026": {f"2026-W{w:02d}": index_2026(w) for w in range(1, 19)}},
    "phases": {"2025": {"2025-W01": "off-season", "2025-W09": "pre-season", "2025-W12": "ramp",
                        "2025-W15": "peak", "2025-W22": "monsoon", "2025-W40": "off-season"},
               "2026": {"2026-W01": "off-season", "2026-W09": "pre-season", "2026-W12": "ramp",
                        "2026-W15": "peak", "2026-W18": "peak"}},
    "forecast": {"asOf": "2026-04-28", "est": True,
                 "periods": [{"from": "2026-04-29", "to": "2026-05-04", "maxC": [38, 40], "rainChance": "none"},
                             {"from": "2026-05-05", "to": "2026-05-11", "maxC": [39, 41], "rainChance": "low"}],
                 "monsoonSignalNext14Days": False},
    "climatology": {"normalOnsetPune": "06-10", "plusMinusDays": 3,
                    "onsets": {"2023": "2023-06-24", "2024": "2024-06-06", "2025": "2025-05-26"}},
    "events": [
        {"id": "EV-MHDAY-26", "name": "Maharashtra Day long weekend", "from": "2026-05-01", "to": "2026-05-03",
         "appliesTo": {"channels": [], "tags": ["highway", "petrol-pump", "tourist-spot"]},
         "packs": None, "multiplier": [1.5, 2.0], "source": "State holiday calendar", "est": True},
        {"id": "EV-SCHOOL-26", "name": "School summer vacation", "from": "2026-05-02", "to": "2026-06-14",
         "appliesTo": {"channels": ["Education"], "tags": ["school"]},
         "packs": None, "multiplier": 0, "source": "STUB (est)", "est": True},
    ],
    "schools": {"2025": {"vacationFrom": "2025-05-02", "reopen": "2025-06-16", "est": True},
                "2026": {"vacationFrom": "2026-05-02", "reopen": "2026-06-15", "source": "Lokmat Times, 30 Mar 2026"}},
}

CONFIG = {
    "meta": meta(),
    "demoDate": iso(DEMO),
    "region": {"name": "Pune West", "city": "Pune", "state": "Maharashtra",
               "areas": ["Kothrud", "Warje", "Bavdhan", "Pashan"]},
    "rep": {"id": "REP-01", "name": "Rohit Jagtap", "role": "Pre-seller", "routeOutletsToday": 27,
            "languages": ["Marathi", "Hindi", "English (app)"]},
    "distributor": {"name": "Kothrud Beverage Distributors", "deliveryLeadDays": 1},
    "history": {"fromWeek": "2025-W01", "toWeek": "2026-W17", "weekStartsOn": "Monday"},
    "focusSkus": ["CL250", "CL200G", "MG150T", "WT1000"],
    "assumptions": {"est": True, "coolerCases250ByLitres": {"60": 2, "150": 5, "300": 10}, "iceBoxCases250": 1},
}

STOCK = {
    "meta": meta(),
    "asOf": "2026-04-25",
    "items": [{"sku": p["sku"], "status": "ok", "maxCasesPerOutlet": None, "note": ""} for p in PRODUCTS],
}
for it in STOCK["items"]:
    if it["sku"] == "CL250":
        it.update(status="rationed", maxCasesPerOutlet=6, note="Allocation cut for peak weeks")
    if it["sku"] == "MG600":
        it.update(status="out", maxCasesPerOutlet=0)

PEERS = {
    "meta": meta("Peer benchmark: similar shops on the rep's wider route (weekly cases per outlet)."),
    "groups": [{
        "key": "kirana|Bronze|no-cooler", "label": "Bronze · traditional kirana · no cooler",
        "channel": "Traditional Kirana", "tier": "Bronze", "cooler": "none", "outletsInGroup": 14,
        "weeklyCasesBySku": {
            "CL2250": {"2026-W18": 1.2, "2026-W19": 1.3, "2026-W20": 1.3},
            "OR1250": {"2026-W18": 0.8, "2026-W19": 0.9, "2026-W20": 0.9},
            "CL750": {"2026-W18": 0.5, "2026-W19": 0.5, "2026-W20": 0.6},
            "CL250": {"2026-W18": 0.8, "2026-W19": 0.9, "2026-W20": 0.9},
            "WT1000": {"2026-W18": 0.6, "2026-W19": 0.7, "2026-W20": 0.7},
            "MG150T": {"2026-W18": 0.4, "2026-W19": 0.5, "2026-W20": 0.5},
        },
        "est": True,
    }],
}

FILES = {
    "config": CONFIG,
    "outlets": {"meta": meta("All 8 personas, attributes from the persona table in the base-app context file."), "outlets": OUTLETS},
    "products": {"meta": meta(), "categories": ["Sparkling", "Juice drinks", "Water", "Energy"], "products": PRODUCTS},
    "schemes": {"meta": meta(), "schemes": SCHEMES},
    "orders": {"meta": meta("Orders only for 2026-W10 to 2026-W17."), "orders": orders},
    "history": {"meta": meta("Derived from orders.json."), "weeks": [week_label(w) for w in week_starts],
                "weekStarts": [iso(w) for w in week_starts], "outlets": hist},
    "visits": {"meta": meta(), "outlets": visits},
    "distributor_stock": STOCK,
    "calendar": CALENDAR,
    "peers": PEERS,
}

OUT.mkdir(exist_ok=True)
total = 0
for name, body in FILES.items():
    text = json.dumps(body, ensure_ascii=False, indent=1)
    (OUT / f"{name}.json").write_text(text + "\n", encoding="utf-8")
    total += len(text.encode("utf-8"))
print(f"Wrote {len(FILES)} files to {OUT.relative_to(ROOT)}/ ({total / 1024:.0f} KB), {len(orders)} orders.")
