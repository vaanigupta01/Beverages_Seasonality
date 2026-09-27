"""Part 3: demand model, order history, visits, stock, credit, peers, derived index."""
import json, os, math, random, zlib, datetime as dt
from collections import defaultdict

SEED = 20260428
random.seed(SEED)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
DEMO = dt.date(2026, 4, 28)
HIST_START = dt.date(2024, 1, 1)
D = lambda d: d.isoformat()

def load(n):
    with open(os.path.join(DATA, n)) as f: return json.load(f)
def dump(n, o):
    p = os.path.join(DATA, n)
    with open(p, "w") as f: json.dump(o, f, separators=(",", ":"))
    print(f"  {n:26s} {os.path.getsize(p)/1024:9.1f} KB")

OUT = load("outlets.json")["outlets"]
SKUS = load("skus.json")["skus"]
SKUMAP = {s["sku"]: s for s in SKUS}
SCHEMES = load("schemes.json")["schemes"]
EVENTS = load("events.json")["events"]
DSTOCK = load("distributor_stock.json")

FOCUS = ["CL250", "CL200G", "MG150T", "WT1000"]
SS_SKUS = ["CL250", "LL250", "CL200G"]
MANGO = ["MG150T", "MG200T", "MG250", "MG600", "MG1000"]
DIW = ["OR1250", "CL2250", "CL1250", "OR2250"]

# ───────────────────────────────────────────────────── seasonal curves
HEAT = {1: .06, 2: .18, 3: .60, 4: .95, 5: 1.00, 6: .50, 7: .10, 8: .08, 9: .15, 10: .35, 11: .20, 12: .05}
SWING_SCALE = float(os.environ.get('SWING_SCALE', '0.52'))
def pk_eff(p): return 1 + (p - 1) * SWING_SCALE
MONSOON = {2024: dt.date(2024, 6, 10), 2025: dt.date(2025, 5, 26), 2026: dt.date(2026, 6, 9)}
WEDDING = {1: .80, 2: .85, 3: .30, 4: .85, 5: .80, 6: .05, 7: .05, 8: .10, 9: .15, 10: .50, 11: 1.00, 12: 1.00}

def _anchor(y, m):
    return dt.date(y, m, 15)

def heat_raw(d):
    """Linear interpolation between mid-month anchors."""
    if d.day == 15: return HEAT[d.month]
    if d.day < 15:
        pm = d.month - 1 or 12; py = d.year if d.month > 1 else d.year - 1
        a, b = HEAT[pm], HEAT[d.month]
        span = (_anchor(d.year, d.month) - _anchor(py, pm)).days
        t = (d - _anchor(py, pm)).days / span
    else:
        nm = d.month + 1 if d.month < 12 else 1; ny = d.year if d.month < 12 else d.year + 1
        a, b = HEAT[d.month], HEAT[nm]
        span = (_anchor(ny, nm) - _anchor(d.year, d.month)).days
        t = (d - _anchor(d.year, d.month)).days / span
    return a + (b - a) * t

EV_TERR = [e for e in EVENTS if e.get("scope") == "territory"]
EV_PERS = [e for e in EVENTS if e.get("scope") == "persona"]
EV_OUT = defaultdict(list)
for e in EVENTS:
    if e.get("scope") == "outlet": EV_OUT[e["outletId"]].append(e)

def in_ev(e, d): return dt.date.fromisoformat(e["startDate"]) <= d <= dt.date.fromisoformat(e["endDate"])

def heat_adj(d):
    h = heat_raw(d)
    ons = MONSOON.get(d.year)
    if ons and d >= ons:
        damp = 0.32 + 0.68 * math.exp(-(d - ons).days / 9)
        h *= damp
    for e in EV_TERR:
        if e["type"] == "weather" and e.get("demandMultiplier", 1) > 1 and in_ev(e, d):
            h = min(1.0, h * e["demandMultiplier"])
    return max(0.0, h)

def terr_mult(d):
    m = 1.0
    for e in EV_TERR:
        if e["type"] in ("festival", "long-weekend", "sport") and in_ev(e, d):
            m *= e["demandMultiplier"]
    return m

def pers_factor(o, d):
    """Closures, exam ramps, releases, adhik month, for this outlet's persona/shopType."""
    f, closed = 1.0, False
    for e in EV_PERS:
        if e.get("personaId") != o["persona"]["id"]: continue
        if e.get("shopType") and e["shopType"] != o["shopType"]: continue
        if not in_ev(e, d): continue
        m = e.get("demandMultiplier", 1.0)
        if m == 0.0: closed = True
        f *= m
    for e in EV_OUT[o["outletId"]]:
        if e["type"] == "power-cut" and in_ev(e, d): f *= e.get("demandMultiplier", 1.0)
    return f, closed

YOY2026 = {"OUT-01": 1.12, "OUT-02": 1.04, "OUT-03": 1.11, "OUT-04": 1.09,
           "OUT-05": 0.98, "OUT-06": 1.15, "OUT-07": 1.09}
for o in OUT:
    o["_yoy26"] = YOY2026.get(o["outletId"], round(random.gauss(1.08, .07), 3))

def level(o, d):
    y = min(2026, max(2024, d.year))
    f = {2024: 1.0, 2025: 1.08, 2026: 1.08 * o["_yoy26"]}[y]
    if o["model"].get("structuralDecline"):
        f *= (1 - 0.16 * ((d - HIST_START).days / 365.0))
    return f

DOW = {"P04": [.75, .75, .80, .85, 1.05, 1.85, 1.90], "P03": [.95, .95, 1.0, 1.0, 1.10, 1.25, 1.20],
       "P05": [1.05, 1.05, 1.05, 1.05, 1.05, .55, .10], "P06": [.60, .60, .65, .75, 1.35, 1.85, 1.70],
       "P07": [1.0] * 7, "P01": [.95, .95, 1.0, 1.0, 1.08, 1.20, 1.10],
       "P02": [.95, .95, 1.0, 1.0, 1.05, 1.15, 1.05], "P08": [.95, .95, 1.0, 1.0, 1.05, 1.15, 1.05]}

BOOKINGS = defaultdict(float)
for e in EVENTS:
    if e["type"] == "booking":
        BOOKINGS[(e["outletId"], e["startDate"])] += e["expectedCases"]

def daily(o, d):
    """Expected cases of demand at this outlet on this day."""
    if d < dt.date.fromisoformat(o["registeredOn"]): return 0.0
    drv = o["model"]["seasonDriver"]; peak = o["model"]["channelPeakMultiplier"]
    base = o["model"]["baseCasesPerWeekJan2024"] / 7.0
    pf, closed = pers_factor(o, d)
    if closed: return 0.0
    if drv == "bookings":
        bk = BOOKINGS.get((o["outletId"], D(d)))
        if bk: return bk * pf
        if o["shopType"] == "Cinema":
            si = 0.55 + 0.45 * heat_adj(d)
            for e in EV_PERS:
                if e["type"] == "release" and e.get("shopType") == "Cinema" and in_ev(e, d):
                    si *= e["demandMultiplier"]
        else:
            si = (0.15 + 0.85 * WEDDING[d.month]) * (1 + 0.35 * heat_adj(d))
    elif drv == "trade":
        si = 1 + (pk_eff(peak) - 1) * heat_adj(d + dt.timedelta(days=14)) ** .9
    elif drv == "calendar":
        si = 1 + (pk_eff(peak) - 1) * heat_adj(d) * .5
    else:
        g = .85 if peak >= 3.0 else (1.25 if peak < 1.8 else 1.0)
        si = 1 + (pk_eff(peak) - 1) * heat_adj(d) ** g
    v = base * si * level(o, d) * terr_mult(d) * pf * DOW[o["persona"]["id"]][d.weekday()]
    n = zlib.crc32(f"{o['outletId']}|{d.isoformat()}".encode()) / 0xFFFFFFFF
    return max(0.0, v * (0.94 + 0.12 * n))

# ───────────────────────────────────────────────────── SKU mixes
POOLS = {
 "single": ["CL250", "LL250", "OR250", "CD250", "CL300C", "CL250C", "CL600", "LL600", "OR600",
            "CL200G", "LL200G", "OR200G", "MG150T", "MG200T", "MG600", "MF150T", "GV150T",
            "NB250", "NB600", "JR250", "WT250", "WT500", "EN250", "EN300C", "IT250T", "IT400",
            "MS180T", "LS180T", "BM200T", "CW200T", "SP500", "CLZ250", "AP200T", "CF180C",
            "MG250", "MF600", "GV600", "IT600", "EN500", "SP250T", "MS200", "CLZ300C"],
 "take-home": ["CL750", "CL1250", "CL2250", "LL750", "LL2250", "OR1250", "OR2250", "CD2250",
               "WT1000", "WT2000", "WT5000", "MG1000", "SD600G", "SD750", "CLZ750", "CLZ2250"],
}
CH_PREF = {
 "Traditional Kirana": (["CL250", "CL2250", "OR1250", "CL750", "MG150T", "WT1000", "LL250"], .9),
 "Convenience": (["CL250", "WT500", "CL300C", "EN250", "MG150T", "LL250", "WT1000", "CL200G"], 1.2),
 "Paan/Cigarette shop": (["CL250", "CL200G", "EN250", "MG150T", "WT250", "LL250"], 1.3),
 "Eating & Drinking (seating)": (["CL2250", "WT1000", "CL200G", "CL250", "OR1250", "SD750"], .9),
 "Eating & Drinking (standing)": (["CL200G", "CL250", "MG150T", "WT500", "LS180T", "BM200T"], 1.1),
 "Education": (["WT500", "WT1000", "MG150T", "MF150T", "GV150T", "CW200T"], 1.0),
 "At-work": (["WT500", "CL250", "MG150T", "IT250T", "WT1000", "CL300C"], 1.0),
 "Entertainment & Leisure": (["CL250", "WT500", "MG150T", "CL300C", "WT1000", "EN250"], 1.2),
 "Wholesale": (["CL2250", "OR1250", "CL750", "WT1000", "CL250", "LL2250"], .6),
 "Modern Trade (small format)": (["CL2250", "CL250", "OR1250", "WT1000", "MG600", "CLZ750", "EN300C"], .9),
}
for o in OUT:
    if o["model"].get("skuMixPct"): continue
    pref, _ = CH_PREF[o["channel"]]
    ssb = o["model"]["singleServeBias"]
    n = {"Diamond": 8, "Gold": 7, "Silver": 6, "Bronze": 5, "Iron": 4}[o["tier"]]
    chosen = list(pref[:min(len(pref), n - 1)])
    extra_pool = POOLS["single"] if random.random() < ssb else POOLS["take-home"]
    while len(chosen) < n:
        c = random.choice(extra_pool)
        if c not in chosen: chosen.append(c)
    w = {}
    for i, s in enumerate(chosen):
        base_w = max(4.0, 30.0 / (i + 1.4))
        base_w *= (1.5 if SKUMAP[s]["servingType"] == "single" else 1.0) if ssb > .6 else \
                  (1.0 if SKUMAP[s]["servingType"] == "single" else 1.5)
        w[s] = base_w * random.uniform(.75, 1.25)
    tot = sum(w.values())
    o["model"]["skuMixPct"] = {k: round(v / tot * 100, 1) for k, v in w.items()}

# ───────────────────────────────────────────────────── distributor status
CUR_STATUS = {c["sku"]: c for c in DSTOCK["current"]}
HIST_C = DSTOCK["historicalConstraints"]

def stock_status(sku, d):
    """Status of a SKU on a given delivery date."""
    if d >= dt.date(2026, 4, 25) and sku in CUR_STATUS:
        c = CUR_STATUS[sku]
        return c["status"], c.get("rationPerOutletCases")
    for c in HIST_C:
        if c["sku"] == sku and dt.date.fromisoformat(c["fromDate"]) <= d <= dt.date.fromisoformat(c["toDate"]):
            return c["status"], None
    return "available", None

# ───────────────────────────────────────────────────── visit schedule
def visit_dates(o):
    cad = o["visitCadenceDays"]
    start = max(HIST_START, dt.date.fromisoformat(o["registeredOn"]))
    if cad in (7, 14) and o.get("visitWeekday") is not None:
        wd = o["visitWeekday"]
        while start.weekday() != wd: start += dt.timedelta(days=1)
        if cad == 14:
            # anchor fortnightlies so the last visit before DEMO is one cadence back
            k = (DEMO - start).days // 14
            start = DEMO - dt.timedelta(days=14 * k)
    else:
        k = (DEMO - start).days // cad
        start = DEMO - dt.timedelta(days=cad * k)
    out, d = [], start
    while d <= DEMO:
        out.append(d + dt.timedelta(days=1) if d.weekday() == 6 else d)
        d += dt.timedelta(days=cad)
    return sorted(set(out))

# ───────────────────────────────────────────────────── scheme engine
def active_schemes(o, d):
    res = []
    for s in SCHEMES:
        if s.get("type") == "monthly-payout": continue
        if not (dt.date.fromisoformat(s["validFrom"]) <= d <= dt.date.fromisoformat(s["validTo"])): continue
        et = s.get("eligibleTiers")
        if et != "all" and et is not None and o["tier"] not in et: continue
        if s.get("requiresBottlerCooler") and o["cooler"]["ownedBy"] != "bottler": continue
        if s["schemeId"] == "SCH-NEW":
            if (d - dt.date.fromisoformat(o["registeredOn"])).days > 90: continue
        res.append(s)
    return res

# ───────────────────────────────────────────────────── credit state
DEMO_CREDIT = {"OUT-01": (18000, 0, "2026-04-14"), "OUT-02": (4500, 1800, "2026-03-24"),
               "OUT-03": (15000, 0, "2026-04-21"), "OUT-04": (1500, 0, "2026-03-31"),
               "OUT-05": (5000, 0, "2026-04-09"), "OUT-06": (12000, 0, "2026-04-17"),
               "OUT-07": (75000, 16500, "2026-04-07"), "OUT-08": (5000, 0, None)}
for o in OUT:
    if o["outletId"] in DEMO_CREDIT:
        lim, od, lp = DEMO_CREDIT[o["outletId"]]
    else:
        c = o.pop("_credit"); lim, od = c["limit"], c["overdue"]
        lp = D(DEMO - dt.timedelta(days=random.randint(3, 70))) if od or random.random() < .9 else None
    o["_cr"] = {"limit": lim, "overdue": od, "lastPayment": lp}

# ───────────────────────────────────────────────────── order generation
orders, visits = [], []
trig = defaultdict(int)          # (outlet, scheme, yyyy-mm) -> triggers used
first_order_done = set()
oid_n = 0

for o in OUT:
    tim = o["model"]["timing"]
    if tim == "new":
        for v in visit_dates(o):
            if v < dt.date.fromisoformat(o["registeredOn"]): continue
            visits.append({"visitId": f"V-{o['outletId']}-{D(v)}", "outletId": o["outletId"],
                           "date": D(v), "planned": True, "completed": v < DEMO,
                           "checkIn": f"{D(v)}T11:20:00+05:30" if v < DEMO else None,
                           "durationMin": 6 if v < DEMO else None,
                           "outcome": "no-order" if v < DEMO else "planned", "orderId": None,
                           "note": "New owner since 22 Apr. Registered on the route, no order yet." if v < DEMO else None})
        continue
    vds = visit_dates(o)
    cad = o["visitCadenceDays"]
    for idx, v in enumerate(vds):
        if v >= DEMO:
            visits.append({"visitId": f"V-{o['outletId']}-{D(v)}", "outletId": o["outletId"],
                           "date": D(v), "planned": True, "completed": False, "checkIn": None,
                           "durationMin": None, "outcome": "due-today", "orderId": None,
                           "note": None})
            continue
        cover = cad + 1
        if tim == "planner": w0 = v + dt.timedelta(days=1)
        elif tim == "trade": w0 = v + dt.timedelta(days=15)
        elif tim in ("calendar", "bookings"): w0 = v + dt.timedelta(days=1)
        elif tim == "reactive-then-planner":
            w0 = v + dt.timedelta(days=1) if v.year == 2026 else v - dt.timedelta(days=9)
        elif tim.startswith("reactive-"):
            w0 = v + dt.timedelta(days=1 - int(tim.split("-")[1]))
        else: w0 = v + dt.timedelta(days=1)
        need = sum(daily(o, w0 + dt.timedelta(days=k)) for k in range(cover))

        if o["model"]["seasonDriver"] == "trade" and v.day >= 25:
            mon = v.month
            load = {1: 40, 2: 60, 3: 102, 4: 74, 5: 66, 6: 48, 7: 40, 8: 38,
                    9: 44, 10: 57, 11: 52, 12: 46}[mon]
            need += load * (o["model"]["baseCasesPerWeekJan2024"] / 27.7) * level(o, v) * random.uniform(.92, 1.08)

        cases = need * random.uniform(.9, 1.1)
        if o.get("carryLimitCases"): cases = min(cases, o["carryLimitCases"])
        p_prod = min(.94, .70 + .10 * heat_adj(v) + {"Diamond": .12, "Gold": .10, "Silver": .06,
                                                      "Bronze": .02, "Iron": -.02}[o["tier"]])
        if o["_cr"]["overdue"] > 0: p_prod -= .10
        if o["isDemoPersona"]: p_prod = 1.0
        pr = random.Random(zlib.crc32(f"{o['outletId']}|{D(v)}|prod".encode()))
        if cases < 0.8 or pr.random() > p_prod:
            visits.append({"visitId": f"V-{o['outletId']}-{D(v)}", "outletId": o["outletId"],
                           "date": D(v), "planned": True,
                           "completed": v < DEMO and random.random() < .93,
                           "checkIn": f"{D(v)}T10:05:00+05:30" if v < DEMO else None,
                           "durationMin": random.randint(3, 7) if v < DEMO else None,
                           "outcome": "no-order" if v < DEMO else "planned", "orderId": None, "note": None})
            continue
        cases = max(1, int(round(cases)))

        # ── split across SKUs
        mix = dict(o["model"]["skuMixPct"])
        h = heat_adj(v)
        for s in list(mix):
            st = SKUMAP[s]["servingType"]
            mix[s] *= (1 + .55 * h) if st == "single" else (1 - .18 * h)
            if dt.date(v.year, 10, 1) <= v <= dt.date(v.year, 11, 15) and s in DIW: mix[s] *= 1.7
        tot = sum(mix.values())
        mix = {k: val / tot for k, val in mix.items()}
        nlines = min(len(mix), 2 if cases < 4 else 3 if cases < 9 else 4 if cases < 16 else
                     5 if cases < 32 else 6 if cases < 70 else 7)
        ranked = sorted(mix, key=lambda s: -mix[s] * random.uniform(.7, 1.35))[:nlines]
        rw = sum(mix[s] for s in ranked)
        alloc = {}
        left = cases
        for i, s in enumerate(ranked):
            q = cases - sum(alloc.values()) if i == len(ranked) - 1 else max(1, int(round(cases * mix[s] / rw)))
            q = max(0, min(q, left)); left -= q
            if q: alloc[s] = q
        if not alloc: continue

        # ── distributor constraints on the delivery date
        deliver_on = v + dt.timedelta(days=1)
        final, blocked = {}, []
        for s, q in alloc.items():
            status, ration = stock_status(s, deliver_on)
            if status == "out-of-stock":
                blocked.append({"sku": s, "cases": q, "reason": "distributor out of stock"}); continue
            if status == "rationed" and ration is not None and q > ration:
                blocked.append({"sku": s, "cases": q - ration, "reason": f"rationed to {ration} cases"})
                q = ration
            if status == "rationed-against-empties" and SKUMAP[s]["returnable"]:
                cap = max(0, o.get("glassCratesHeld", 0))
                if q > cap:
                    blocked.append({"sku": s, "cases": q - cap, "reason": "crates released only against empties"})
                    q = cap
            if q: final[s] = final.get(s, 0) + q
        # substitute a share of blocked volume into an available same-serving SKU
        for b in blocked:
            st = SKUMAP[b["sku"]]["servingType"]
            cands = [s for s in mix if SKUMAP[s]["servingType"] == st and s != b["sku"]
                     and stock_status(s, deliver_on)[0] in ("available", "low")]
            if cands and random.random() < .55:
                sub = max(cands, key=lambda s: mix[s])
                final[sub] = final.get(sub, 0) + max(1, int(b["cases"] * random.uniform(.4, .8)))
        if not final:
            visits.append({"visitId": f"V-{o['outletId']}-{D(v)}", "outletId": o["outletId"],
                           "date": D(v), "planned": True, "completed": True,
                           "checkIn": f"{D(v)}T10:05:00+05:30", "durationMin": random.randint(4, 8),
                           "outcome": "no-order", "orderId": None,
                           "note": "Wanted the focus pack; distributor was out. Could not book."})
            continue

        # ── schemes
        ym = f"{v.year}-{v.month:02d}"
        lines, free_total, sch_ids = [], 0, set()
        acts = active_schemes(o, v)
        ss_cases = sum(q for s, q in final.items() if s in SS_SKUS)
        mg_cases = sum(q for s, q in final.items() if s in MANGO)
        wt_cases = final.get("WT1000", 0)
        dw_cases = sum(q for s, q in final.items() if s in DIW)
        ss_free = mg_disc = wt_free = dw_free = 0
        new_disc = False
        for s in acts:
            sid = s["schemeId"]
            if sid.startswith("SCH-SS") and ss_cases >= 10:
                room = 4 - trig[(o["outletId"], "SS", ym)]
                t = min(ss_cases // 10, max(0, room))
                if t: ss_free = t; trig[(o["outletId"], "SS", ym)] += t; sch_ids.add(sid)
            if sid.startswith("SCH-MG") and mg_cases >= 5: mg_disc = 8; sch_ids.add(sid)
            if sid == "SCH-WT26" and wt_cases >= 8:
                room = 2 - trig[(o["outletId"], "WT", ym)]
                t = min(wt_cases // 8, max(0, room))
                if t: wt_free = t; trig[(o["outletId"], "WT", ym)] += t; sch_ids.add(sid)
            if sid.startswith("SCH-DIW") and dw_cases >= 8:
                room = 3 - trig[(o["outletId"], "DIW", ym)]
                t = min(dw_cases // 8, max(0, room))
                if t: dw_free = t; trig[(o["outletId"], "DIW", ym)] += t; sch_ids.add(sid)
            if sid == "SCH-NEW" and o["outletId"] not in first_order_done:
                new_disc = True; sch_ids.add(sid)
        first_order_done.add(o["outletId"])

        value = 0
        for s, q in sorted(final.items(), key=lambda kv: -kv[1]):
            ptr = SKUMAP[s]["ptrPerCase"]
            fr = 0
            if ss_free and s == max((k for k in final if k in SS_SKUS), key=lambda k: final[k], default=None):
                fr += ss_free
            if wt_free and s == "WT1000": fr += wt_free
            if dw_free and s == max((k for k in final if k in DIW), key=lambda k: final[k], default=None):
                fr += dw_free
            disc = 0
            if mg_disc and s in MANGO: disc = mg_disc
            if new_disc: disc = max(disc, 12)
            lv = round(q * ptr * (1 - disc / 100))
            # fill rate: short-fill when a constraint window is live
            dstat = stock_status(s, deliver_on)[0]
            delivered = q
            hs = heat_adj(deliver_on)
            p_short = .025 + .20 * hs
            if dstat in ("low", "rationed", "rationed-against-empties"): p_short += .25
            if random.random() < p_short:
                delivered = max(0, q - max(1, int(round(q * random.uniform(.10, .45)))))
            lines.append({"s": s, "b": q, "dl": delivered, "f": fr,
                          "dp": disc or None, "p": ptr, "v": lv})
            value += lv; free_total += fr

        oid_n += 1
        ordid = f"ORD-{oid_n:06d}"
        pm = "cash" if (o.get("paysCashAboveLimit") and random.random() < .6) else "credit"
        orders.append({"i": ordid, "o": o["outletId"], "d": D(v), "dd": D(deliver_on),
                       "l": lines, "c": sum(l["b"] for l in lines), "fc": free_total,
                       "t": value, "pm": pm,
                       "sc": sorted(sch_ids) or None,
                       "bl": blocked or None,
                       "me": True if (o["model"]["seasonDriver"] == "trade" and v.day >= 25) else None})
        visits.append({"visitId": f"V-{o['outletId']}-{D(v)}", "outletId": o["outletId"], "date": D(v),
                       "planned": True, "completed": True, "checkIn": f"{D(v)}T10:05:00+05:30",
                       "durationMin": random.randint(4, 14) if o["tier"] in ("Diamond", "Gold") else random.randint(3, 9),
                       "outcome": "order", "orderId": ordid, "note": None})

print(f"Orders: {len(orders)}  lines: {sum(len(o['l']) for o in orders)}  visits: {len(visits)}")

# ═══════════════════════════════════ pin the demo-date state to the personas
BY_OUTLET = defaultdict(list)
for od in orders: BY_OUTLET[od["o"]].append(od)
for k in BY_OUTLET: BY_OUTLET[k].sort(key=lambda x: x["d"])

def set_ss_cases(order, target):
    """Force the combined Summer Single-Serve pack cases in one order to `target`."""
    ss = [l for l in order["l"] if l["s"] in SS_SKUS]
    if not ss:
        base = SKUMAP["CL250"]
        order["l"].append({"s": "CL250", "b": target, "dl": target, "f": 0, "dp": None,
                           "p": base["ptrPerCase"], "v": target * base["ptrPerCase"]})
        ss = [order["l"][-1]]
    lead = max(ss, key=lambda l: l["b"])
    for l in ss:
        if l is not lead: l["b"] = 0
    lead["b"] = target
    lead["dl"] = target
    lead["v"] = round(target * lead["p"] * (1 - (lead["dp"] or 0) / 100))
    order["l"] = [l for l in order["l"] if l["b"] > 0]
    order["c"] = sum(l["b"] for l in order["l"])
    order["t"] = sum(l["v"] for l in order["l"])

APR26 = ("2026-04-07", "2026-04-14", "2026-04-21")
# OUT-01: three April orders of 7, 6 and 7 scheme-pack cases -> no trigger, all 4 uses left
for d, tgt in zip(APR26, (7, 6, 7)):
    for od in BY_OUTLET["OUT-01"]:
        if od["d"] == d:
            set_ss_cases(od, tgt)
            for l in od["l"]: l["f"] = 0
            od["fc"] = 0
            od["sc"] = [s for s in (od["sc"] or []) if not s.startswith("SCH-SS")] or None
# OUT-03: three April orders spending all 4 monthly uses (11 + 21 + 12 = 4 triggers)
for d, tgt, tr in zip(APR26, (11, 21, 12), (1, 2, 1)):
    for od in BY_OUTLET["OUT-03"]:
        if od["d"] == d:
            set_ss_cases(od, tgt)
            lead = max((l for l in od["l"] if l["s"] in SS_SKUS), key=lambda l: l["b"])
            for l in od["l"]: l["f"] = 0
            lead["f"] = tr
            od["fc"] = tr
            od["sc"] = sorted(set((od["sc"] or []) + ["SCH-SS26"]))
trig[("OUT-01", "SS", "2026-04")] = 0
trig[("OUT-03", "SS", "2026-04")] = 4

# OUT-11-style overstock scar: leave one mid-size kirana with near-expiry take-home last June
SCARRED = [o["outletId"] for o in OUT if o["persona"]["id"] == "P02"][:14]

# ═══════════════════════════════════════════════════════════ estimated stock
def sku_daily_share(o, sku, d):
    mix = o["model"]["skuMixPct"]
    if sku not in mix: return 0.0
    h = heat_adj(d); adj = {}
    for s, w in mix.items():
        adj[s] = w * ((1 + .55 * h) if SKUMAP[s]["servingType"] == "single" else (1 - .18 * h))
    t = sum(adj.values())
    return adj[sku] / t if t else 0.0

stock_rows, rep_counts = [], []
for o in OUT:
    ods = BY_OUTLET.get(o["outletId"], [])
    if not ods:
        continue
    last = ods[-1]
    per_sku_last = defaultdict(lambda: {"cases": 0, "date": None})
    for od in ods[-6:]:
        for l in od["l"]:
            per_sku_last[l["s"]] = {"cases": l["dl"], "date": od["dd"]}
    has_count = random.random() < .18
    for sku, rec in per_sku_last.items():
        dd = dt.date.fromisoformat(rec["date"])
        days = max(0, (DEMO - dd).days)
        sold = sum(daily(o, dd + dt.timedelta(days=k)) * sku_daily_share(o, sku, dd + dt.timedelta(days=k))
                   for k in range(days))
        est = max(0.0, rec["cases"] - sold)
        conf = "high" if days <= 3 else "medium" if days <= 10 else "low"
        row = {"outletId": o["outletId"], "sku": sku, "lastDeliveredOn": rec["date"],
               "lastDeliveredCases": rec["cases"], "daysSinceDelivery": days,
               "estimatedSoldSinceCases": round(sold, 1),
               "estimatedCasesOnHand": round(est, 1), "confidence": conf,
               "basis": "lastDeliveredCases - modelled sales since delivery"}
        if has_count and sku in FOCUS and days >= 2:
            counted = max(0, round(est * random.uniform(.55, 1.4), 1))
            cd = D(DEMO - dt.timedelta(days=random.randint(0, 6)))
            row.update({"repCountedCases": counted, "repCountedOn": cd, "confidence": "high"})
            rep_counts.append({"outletId": o["outletId"], "sku": sku, "cases": counted, "countedOn": cd})
        stock_rows.append(row)

dump("current_stock.json", {"asOf": D(DEMO),
    "method": "Estimated, not measured. estimatedCasesOnHand = last delivered cases minus modelled sales since delivery. A rep count, where present, overrides the estimate.",
    "repCountsPresent": len(rep_counts), "rows": stock_rows})

# ════════════════════════════════════════════════════════════════ credit
credit = []
for o in OUT:
    cr = o.pop("_cr")
    od = cr["overdue"]
    lp = cr["lastPayment"]
    credit.append({"outletId": o["outletId"], "creditLimit": cr["limit"],
        "outstanding": od, "overdue": od,
        "overdueDays": (DEMO - dt.date.fromisoformat(lp)).days if (od and lp) else 0,
        "lastPaymentDate": lp, "headroom": cr["limit"] - od,
        "creditDays": {"Diamond": 14, "Gold": 14, "Silver": 10, "Bronze": 7, "Iron": 0}[o["tier"]],
        "paymentMode": "cash" if o.get("paysCashAboveLimit") and o["tier"] == "Iron" else "credit",
        "paysCashAboveLimit": bool(o.get("paysCashAboveLimit")),
        "requestedLimit": 18000 if o["outletId"] == "OUT-06" else None})
dump("credit.json", {"asOf": D(DEMO),
    "assumption": "The rep may book beyond an outlet's credit limit. Credit is advisory in the GT App, not a hard system block. Season Check therefore warns and shows headroom rather than capping the order.",
    "rows": credit})

# ════════════════════════════════════════════════════════════════ visits
visits.sort(key=lambda v: (v["outletId"], v["date"]))
NEXT = {}
for o in OUT:
    NEXT[o["outletId"]] = D(DEMO + dt.timedelta(days=o["visitCadenceDays"]))
keep_from = D(DEMO - dt.timedelta(days=400))
vkeep = [v for v in visits if v["date"] >= keep_from]
dump("visits.json", {"asOf": D(DEMO), "note": "Rolling 400 days. Visit check-in and check-out are recorded by the app in the background.",
    "nextPlannedVisit": NEXT, "visits": vkeep})

# ════════════════════════════════════════════════════════════ orders + index
dump("orders_history.json", {
    "asOf": D(DEMO), "from": D(HIST_START), "orderCount": len(orders),
    "keys": {"i": "orderId", "o": "outletId", "d": "orderDate", "dd": "deliveryDate",
             "l": "lines", "s": "sku", "b": "casesBooked", "dl": "casesDelivered",
             "f": "freeCases", "dp": "discountPct", "p": "ptrPerCase", "v": "lineValue",
             "c": "totalCasesBooked", "fc": "totalFreeCases", "t": "orderValue",
             "pm": "paymentMode", "sc": "schemesApplied", "bl": "blockedLines",
             "me": "monthEndLoad"},
    "orders": orders})

monthly = defaultdict(int); monthly_val = defaultdict(int)
weekly = defaultdict(int)
for od in orders:
    d = dt.date.fromisoformat(od["d"]); ym = f"{d.year}-{d.month:02d}"
    iy, iw, _ = d.isocalendar()
    for l in od["l"]:
        monthly[(od["o"], ym, l["s"])] += l["b"]
        monthly_val[(od["o"], ym, l["s"])] += l["v"]
        weekly[(od["o"], f"{iy}-W{iw:02d}", l["s"])] += l["b"]
dump("orders_index.json", {
    "derivedFrom": "orders_history.json", "asOf": D(DEMO),
    "note": "Convenience aggregates so the app does not re-aggregate every order on load. Nothing here is a recommendation.",
    "monthlyByOutletSku": [{"o": k[0], "ym": k[1], "s": k[2], "c": v, "v": monthly_val[k]}
                            for k, v in sorted(monthly.items())],
    "weeklyByOutletSku": [{"o": k[0], "wk": k[1], "s": k[2], "c": v}
                           for k, v in sorted(weekly.items())],
})

# ═════════════════════════════════════════════════════════════════ peers
groups = defaultdict(list)
for o in OUT:
    key = (o["channel"], "cooler" if o["cooler"]["ownedBy"] == "bottler" else "no-cooler",
           "top" if o["tier"] in ("Diamond", "Gold") else "mid" if o["tier"] == "Silver" else "small")
    groups[key].append(o["outletId"])
recent_from = DEMO - dt.timedelta(days=28)
recent = defaultdict(int)
for od in orders:
    if dt.date.fromisoformat(od["d"]) >= recent_from: recent[od["o"]] += od["c"]
peers = []
for key, members in groups.items():
    rates = [recent[m] / 4.0 for m in members if recent.get(m)]
    if len(members) < 8: continue
    rates.sort()
    peers.append({"peerGroupId": f"PG-{abs(hash(key)) % 100000:05d}",
        "channel": key[0], "coldChain": key[1], "tierBand": key[2],
        "memberCount": len(members), "reportingMembers": len(rates),
        "casesPerWeekNow": {"p25": round(rates[len(rates)//4], 1) if rates else None,
                            "median": round(rates[len(rates)//2], 1) if rates else None,
                            "p75": round(rates[3*len(rates)//4], 1) if rates else None},
        "disclosure": "Aggregated and anonymised. Minimum group size 8. Never show a named outlet.",
        "members": members})
dump("peers.json", {"asOf": D(DEMO), "minimumGroupSize": 8,
    "usage": "Thin-history outlets borrow a starting rate from their peer group. Retailer-facing copy quotes a range, never a shop name.",
    "groups": peers})

# refresh outlets.json with generated mixes and route flags
dump("outlets.json", {"territory": "Pune West", "count": len(OUT),
    "note": "Synthetic territory. 240 outlets is our assumption, not a figure supplied by the brief.",
    "outlets": [{k: v for k, v in o.items() if not k.startswith("_")} for o in OUT]})

with open(os.path.join(ROOT, "scripts", "_orders.json"), "w") as f:
    json.dump({"orders": orders}, f)
print("Part 3 done.")
