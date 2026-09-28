#!/usr/bin/env python3
"""
Turns the Season Check dataset in fa-data/data/ into the files the app reads in data/.

    python3 scripts/import_fa_data.py && python3 scripts/build_single.py

fa-data/ is the source of truth (240 outlets, 60 SKUs, orders 1 Jan 2024 to 27 Apr 2026;
see fa-data/docs/DATA_README.md). This script only reshapes it into the data contract in
PROGRESS.md ("Shared · Data contract"). It never invents numbers. Where the contract needs a
field the dataset doesn't carry, the field is derived from the dataset (noted below) or left
empty so the screen shows its "none" state.

Derived fields:
- outlets[].persona       only on the 8 demo personas (drives the "Demo · Persona" tag);
                          every outlet keeps its type in outlets[].segment.
- outlets[].closures      persona-scoped closure events (the school canteens).
- outlets[].bookings      outlet-scoped booking events (the banquet hall).
- outlets[].tags          "persona:P0x" and "persona:P0x|shop:<shopType>", so the calendar
                          events below can target personas the way the dataset scopes them.
- outlets[].cooler        type from cooler.ownedBy; afternoonOutage from power-cut events.
                          No audit data in the dataset, so lastAudit is null.
- calendar.forecast, climatology, regionIndex, phases
                          from data-source/season-inputs.json (the Season Check engine's inputs).
- calendar.events         territory and persona events. IPL: one event per match day (quiet),
                          plus one display-only summary per season (anchor).
- products[].chilled, summerMultiplier
                          the engine's values for its 13 packs; the others derived (see products).
- history.json            weekly paid cases summed from orders.json, 2024-W01 to 2026-W17.
- peers.json              the dataset's groups, one entry per (tier, cooler) found among the
                          members; the group's median cases a week is split across SKUs by
                          the members' own mix over the 8 weeks before the demo date.
"""
import datetime as dt
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "fa-data" / "data"
OUT = ROOT / "data"
META = {"generatedBy": "scripts/import_fa_data.py", "source": "fa-data/data", "seed": 20260428, "est": True}


def load(name):
    return json.loads((SRC / f"{name}.json").read_text(encoding="utf-8"))


def dump(name, body, note):
    path = OUT / f"{name}.json"
    path.write_text(json.dumps({"meta": {**META, "note": note}, **body}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  data/{name + '.json':24s} {path.stat().st_size / 1024:8.1f} KB")


D = dt.date.fromisoformat
iso_week = lambda d: "{}-W{:02d}".format(*D(d).isocalendar()[:2])

cfg = load("demo_config")
TODAY = cfg["demoDate"]
skus = [s for s in load("skus")["skus"] if s.get("active", True)]
outlets_src = load("outlets")["outlets"]
credit = {r["outletId"]: r for r in load("credit")["rows"]}
events = load("events")["events"]
visits_src = load("visits")
orders_src = load("orders_history")["orders"]
SEASON = json.loads((ROOT / "data-source" / "season-inputs.json").read_text(encoding="utf-8"))

# ---- products ----------------------------------------------------------------
CATEGORY = {"Juice drink": "Juice drinks"}          # the app's translations use the plural
PACK = {"PET": "PET", "Returnable glass": "glass", "Can": "can", "Tetra": "tetra"}


def flavour(name):
    return re.split(r"\s+\d", name, maxsplit=1)[0].strip()


products = [{
    "sku": s["sku"], "name": s["name"], "brand": s["brand"],
    "category": CATEGORY.get(s["category"], s["category"]), "flavour": flavour(s["name"]),
    "pack": {"type": PACK.get(s["packType"], s["packType"]), "ml": s["packSizeMl"]},
    "unitsPerCase": s["unitsPerCase"], "caseLabel": "crate" if s["returnable"] else "case",
    "litresPerCase": s["caseLitres"], "mrpPerUnit": s["mrp"], "ptrPerCase": s["ptrPerCase"],
    "marginPct": s["retailerMarginPct"], "shelfLifeDays": s["shelfLifeDays"],
    "singleServe": s["servingType"] == "single", "returnable": s["returnable"], "depositPerCrate": None,
    "focus": s["isFocusSku"], "coolerSlotsPerCase": s["coolerSlotsPerCase"],
} for s in skus]
categories = list(dict.fromkeys(p["category"] for p in products))

# ---- schemes -----------------------------------------------------------------


def scheme(s):
    base = {"id": s["schemeId"], "name": s["name"], "validFrom": s.get("validFrom"), "validTo": s.get("validTo"),
            "eligibleTiers": s.get("eligibleTiers", "all"), "requiresBottlerCooler": bool(s.get("requiresBottlerCooler")),
            "capUsesPerMonth": s.get("maxTriggersPerOutletPerMonth"), "applicationMode": s.get("applicationMode"),
            "payout": s.get("settlement"), "extras": s.get("additionalBenefit"), "est": False}
    if s["type"] == "free-case":
        pooled = "combined" in (s.get("thresholdBasis") or "")
        return {**base, "type": "free-goods", "skus": s["applicableSkus"],
                "rule": {"buyCases": s["thresholdCases"], "freeCases": s["freeCases"], "pooled": pooled,
                         "freeSku": "largest-line" if pooled else s["applicableSkus"][0],
                         "usesCountedBy": "order-date-calendar-month",
                         "freeCasesCountAgainstRation": not s.get("freeCasesExemptFromRation", False)}}
    if s["type"] == "percent-off" and s["applicableSkus"] == "all":   # New Outlet Activation
        days = int(re.search(r"(\d+) days", s.get("eligibility", "90 days")).group(1))
        return {**base, "type": "first-order", "skus": "all", "rule": {"percent": s["discountPct"], "withinDaysOfRegistration": days}}
    if s["type"] == "percent-off":
        return {**base, "type": "percent-off", "skus": s["applicableSkus"],
                "rule": {"minCases": s["thresholdCases"], "percent": s["discountPct"], "pooled": True}}
    if s["type"] == "monthly-payout":
        return {**base, "type": "program", "skus": [], "rule": None, "requiresBottlerCooler": True,
                "payout": f"₹{s['payoutPerMonth']} a month if the cooler holds only our drinks at the monthly photo audit",
                "extras": s.get("coolerPlacementPolicy")}
    raise SystemExit(f"schemes.json: unknown scheme type {s['type']!r} on {s['schemeId']}")


schemes = [scheme(s) for s in load("schemes")["schemes"]]

# ---- orders and history --------------------------------------------------------
orders = []
for o in orders_src:
    gross = sum(l["b"] * l["p"] for l in o["l"])
    order = {"id": o["i"], "outletId": o["o"], "date": o["d"],
             "lines": [{"sku": l["s"], "cases": l["b"], "freeCases": l["f"], **({"delivered": l["dl"]} if l["dl"] != l["b"] else {})} for l in o["l"]],
             "grossValue": gross, "discountValue": gross - o["t"], "netValue": o["t"],
             "schemeIds": o["sc"] or [], "source": "history"}
    if o["bl"]:
        order["blockedLines"] = o["bl"]
    if o["me"]:
        order["monthEndLoad"] = True
    orders.append(order)
orders.sort(key=lambda x: (x["date"], x["id"]))

first_monday = D(orders[0]["date"]) - dt.timedelta(days=D(orders[0]["date"]).weekday())
last_sunday = D(TODAY) - dt.timedelta(days=D(TODAY).weekday() + 1)
week_starts = []
d = first_monday
while d <= last_sunday:
    week_starts.append(d)
    d += dt.timedelta(days=7)
week_keys = [iso_week(w.isoformat()) for w in week_starts]
week_pos = {k: i for i, k in enumerate(week_keys)}
hist = defaultdict(lambda: defaultdict(lambda: [0] * len(week_keys)))
for o in orders:
    i = week_pos.get(iso_week(o["date"]))
    if i is None:
        continue                     # the demo week (Mon 27 Apr) is not a finished week
    for l in o["lines"]:
        hist[o["outletId"]][l["sku"]][i] += l["cases"]

# ---- products: season fields for the engine ---------------------------------------
# chilled and summerMultiplier: the engine's own values for its 13 packs (data-source/season-inputs.json).
# Other packs: summerMultiplier = the pack's 2025 swing across the territory (best 4 weeks ÷ Jan–Feb),
# scaled so the 13 known packs' median ratio holds; chilled from the pack (single-serve → yes,
# 600 ml–1 L → partly, larger → no). Marked in products[].est.
MONTHLY_2025 = defaultdict(lambda: [0.0] * 12)
for o in orders:
    if o["date"][:4] == "2025":
        for l in o["lines"]:
            MONTHLY_2025[l["sku"]][int(o["date"][5:7]) - 1] += l["cases"]


def swing_2025(sku):
    """Best 2025 month ÷ the Jan–Feb average; None when Jan–Feb sold under 5 cases (too thin to trust)."""
    m = MONTHLY_2025.get(sku)
    if not m or m[0] + m[1] < 5:
        return None
    return max(m) / ((m[0] + m[1]) / 2)


KNOWN = SEASON["products"]
ratios = sorted(KNOWN[k]["summerMultiplier"] / sw for k in KNOWN if (sw := swing_2025(k)))
scale = ratios[len(ratios) // 2] if ratios else 1
for p in products:
    if p["sku"] in KNOWN:
        p.update(KNOWN[p["sku"]])
    else:
        sw = swing_2025(p["sku"])
        p["summerMultiplier"] = round(min(3.5, max(1.0, sw * scale)), 2) if sw else None
        p["chilled"] = "yes" if p["singleServe"] else ("partly" if p["pack"]["ml"] <= 1000 else "no")
        p["est"] = ["summerMultiplier", "chilled"]
# Too thin to measure: the median of the same category's measured packs.
for p in products:
    if p["summerMultiplier"] is None:
        same = sorted(q["summerMultiplier"] for q in products if q["category"] == p["category"] and q["summerMultiplier"] is not None)
        p["summerMultiplier"] = same[len(same) // 2] if same else 2.0

# ---- outlets -------------------------------------------------------------------
# DEMO ADDITION: one beat of the territory belongs to a neighbouring rep, so the
# cross-territory warning can be shown. Not in fa-data.
NEIGHBOUR = {"id": "REP-02", "name": "Sagar Deshmukh", "subAreas": ["Someshwarwadi"]}
COOLER = {"bottler": "bottler", "outlet-icebox": "ice-box", "outlet": "own-fridge", None: "none"}
PAYMENT = {"credit": "credit", "cash": "cash"}
# Outlets that pay cash above their limit are "cash-and-credit" in the app's contract: the engine
# then asks for the excess in cash instead of trimming the order.
def payment_mode(c):
    return "cash-and-credit" if c["paysCashAboveLimit"] else PAYMENT.get(c["paymentMode"], c["paymentMode"])
power_cuts = {e["outletId"]: e for e in events if e["type"] == "power-cut" and e["endDate"] >= TODAY}


def cooler(o):
    c = o["cooler"]
    kind = COOLER.get(c["ownedBy"], c["ownedBy"])
    if kind == "none" and c["count"]:
        kind = "own-fridge"
    cut = power_cuts.get(o["outletId"])
    return {"type": kind, "count": c["count"], "litres": c["litresEach"], "slots": c["coolerSlots"],
            "afternoonOutage": bool(cut), **({"outageNote": cut.get("note")} if cut else {}), "lastAudit": None}


def closures(o):
    pid = o["persona"]["id"]
    return [{"from": e["startDate"], "to": e["endDate"], "reason": e["label"], "reopensOn": e.get("reopensOn")}
            for e in events if e["type"] == "closure" and e.get("personaId") == pid
            and e.get("shopType") in (None, o["shopType"])]


def bookings(o):
    return [{"date": e["startDate"], "event": e["label"], "expectedCases": e.get("expectedCases", 0), "est": True}
            for e in sorted(events, key=lambda e: e["startDate"])
            if e["type"] == "booking" and e.get("outletId") == o["outletId"]]


def outlet(o):
    c = credit[o["outletId"]]
    p = o["persona"]
    row = {
        "id": o["outletId"], "name": o["name"],
        **({"persona": {"no": int(p["id"][1:]), "label": p["label"], "role": p["role"], "oneLine": p["group"]}} if o["isDemoPersona"] else {}),
        "segment": p,
        "channel": o["channel"], "shopType": o["shopType"], "area": o["area"],
        "address": f"{o['subArea']}, {o['area']}", "locationContext": None,
        "tier": o["tier"], "visitsPerMonth": o["visitsPerMonth"], "visitCadenceDays": o["visitCadenceDays"],
        "registeredOn": o["registeredOn"],
        "owner": {"name": o["ownerName"]},
        "cooler": cooler(o),
        "credit": {"limit": c["creditLimit"], "outstanding": c["outstanding"], "overdue": c["overdue"],
                   "overdueDays": c["overdueDays"], "headroom": c["headroom"], "creditDays": c["creditDays"],
                   "lastPaymentDate": c["lastPaymentDate"], "paymentMode": payment_mode(c),
                   "paysCashAboveLimit": c["paysCashAboveLimit"], "requestedLimit": c["requestedLimit"]},
        "carryLimitCases": o["carryLimitCases"],
        "repId": NEIGHBOUR["id"] if o["subArea"] in NEIGHBOUR["subAreas"] and not o["onTodaysRoute"] else "REP-01",
        "tags": [f"persona:{p['id']}", f"persona:{p['id']}|shop:{o['shopType']}"] + (["school"] if o["shopType"] == "School" else []),
        "closures": closures(o),
        "bookings": bookings(o),
    }
    if o["glassCratesHeld"]:
        row["empties"] = {"cratesHeld": o["glassCratesHeld"]}
    return row


outlets = [outlet(o) for o in outlets_src]

# ---- visits --------------------------------------------------------------------
by_outlet = defaultdict(list)
for v in visits_src["visits"]:
    row = {"date": v["date"], "planned": v["planned"], "done": v["completed"],
           "minutes": v["durationMin"], "outcome": v["outcome"], "orderId": v["orderId"], "note": v["note"],
           "checkIn": (v.get("checkIn") or "")[11:16] or None}
    by_outlet[v["outletId"]].append({k: x for k, x in row.items() if x is not None})   # nulls dropped to save space
visits = {o["outletId"]: {
    "cadenceDays": o["visitCadenceDays"], "todayOnRoute": o["onTodaysRoute"], "routeOrder": o["routeSequence"],
    "nextVisitAfterToday": visits_src["nextPlannedVisit"].get(o["outletId"]),
    "visits": sorted((v for v in by_outlet[o["outletId"]] if v["date"] < TODAY), key=lambda v: v["date"]),
} for o in outlets_src}

# ---- distributor stock -----------------------------------------------------------
stock_src = load("distributor_stock")
STATUS = {"rationed": "rationed", "out-of-stock": "out"}
NOTE_PLAIN = {   # distributor notes in the rep's words
    "Below one day of peak cover.": "Distributor has less than one day's stock left at summer sales.",
}
current = {s["sku"]: s for s in stock_src["current"]}
stock_items = []
for p in products:
    s = current.get(p["sku"])
    if not s:
        stock_items.append({"sku": p["sku"], "status": "ok", "maxCasesPerOutlet": None, "note": ""})
        continue
    status = STATUS.get(s["status"], "ok")      # "low" and "against empties" still sell: shown as notes
    item = {"sku": p["sku"], "status": status, "sourceStatus": s["status"],
            "maxCasesPerOutlet": 0 if status == "out" else s["rationPerOutletCases"],
            "casesAvailable": s["casesAvailable"], "note": NOTE_PLAIN.get(s["note"], s["note"])}
    if status == "rationed":
        item["rationAppliesTo"] = "paid-cases"
    stock_items.append(item)

# ---- calendar --------------------------------------------------------------------
# Season inputs come from the Season Check engine v2 (data-source/season-inputs.json): forecast,
# climatology, region season index and phases. They replace the figures this script used to derive
# from fa-data's weather events (a 40-42 C heatwave label), so the engine runs on the data it was built for.
forecast = SEASON["forecast"]
climatology = SEASON["climatology"]

def applies(e):
    if e.get("scope") == "persona":
        tag = f"persona:{e['personaId']}" + (f"|shop:{e['shopType']}" if e.get("shopType") else "")
        return {"channels": [], "tags": [tag]}
    return {"channels": [], "tags": [f"persona:{p}" for p in e.get("affectsPersonas", [])]}


cal_events = []
ipl = defaultdict(list)
for e in events:
    if e["type"] in ("closure", "booking", "power-cut"):
        continue                    # carried on the outlets instead
    if e["type"] == "weather":
        continue                    # carried in forecast and climatology instead
    if e["type"] == "sport":
        ipl[e["startDate"][:4]].append(e)
        # Each match day is its own event, so the engine lifts demand only on match days.
        # "quiet": the talking points show the season summary below instead of every match.
        cal_events.append({"id": e["eventId"], "type": "sport", "name": e["label"], "from": e["startDate"], "to": e["endDate"],
                           "appliesTo": applies(e), "packs": None, "multiplier": e["demandMultiplier"],
                           "source": e.get("confidence"), "quiet": True, "est": True})
        continue
    cal_events.append({"id": e["eventId"], "type": e["type"], "name": e["label"], "from": e["startDate"], "to": e["endDate"],
                       "appliesTo": applies(e), "packs": None, "multiplier": e["demandMultiplier"],
                       "source": e.get("source") or e.get("confidence"), "note": e.get("note"), "est": True})
for year, days in ipl.items():
    days.sort(key=lambda e: e["startDate"])
    later = [e["startDate"] for e in days if e["startDate"] >= TODAY]
    cal_events.append({"id": f"EV-IPL-{year}", "type": "sport", "name": "IPL evening matches",
                       "from": later[0] if later else days[0]["startDate"], "to": days[-1]["endDate"],
                       "matchDays": [e["startDate"] for e in days],
                       "appliesTo": applies(days[0]), "packs": None, "multiplier": days[0]["demandMultiplier"],
                       "source": days[0].get("confidence"), "anchor": True, "est": True})   # display only; the engine skips anchors
cal_events.sort(key=lambda e: (e["from"], e["id"]))

# ---- peers ------------------------------------------------------------------------
app_outlet = {o["id"]: o for o in outlets}
recent_from = (D(TODAY) - dt.timedelta(days=56)).isoformat()
groups = []
for g in load("peers")["groups"]:
    mix = defaultdict(float)
    for o in orders:
        if o["outletId"] in g["members"] and recent_from <= o["date"] < TODAY:
            for l in o["lines"]:
                mix[l["sku"]] += l["cases"]
    total = sum(mix.values()) or 1
    median = g["casesPerWeekNow"]["median"]
    weekly = {sku: {iso_week(TODAY): round(median * n / total, 2)} for sku, n in sorted(mix.items(), key=lambda x: -x[1])}
    kinds = sorted({(app_outlet[m]["tier"], app_outlet[m]["cooler"]["type"]) for m in g["members"]})
    for tier, cool in kinds:
        groups.append({"key": f"{g['peerGroupId']}|{tier}|{cool}", "peerGroupId": g["peerGroupId"],
                       "channel": g["channel"], "tier": tier, "cooler": cool, "tierBand": g["tierBand"],
                       "outletsInGroup": g["memberCount"], "casesPerWeekNow": g["casesPerWeekNow"],
                       "weeklyCasesBySku": weekly, "est": True})

# Route outlets whose channel has no group in peers.json (e.g. the lakeside snack stall) would
# otherwise borrow a group of bigger shops. For them, derive one from the data: outlets of the
# same persona type and cooler kind (at least peers.json's minimum group size), per-outlet cases a
# week over the last 4 complete weeks. Labelled "derived" in the file.
MIN_GROUP = load("peers").get("minimumGroupSize", 8)
last4_from = (D(TODAY) - dt.timedelta(days=D(TODAY).weekday() + 28)).isoformat()
last4_to = (D(TODAY) - dt.timedelta(days=D(TODAY).weekday())).isoformat()
have = {(g["channel"], g["tier"], g["cooler"]) for g in groups}
for o in outlets:
    key = (o["channel"], o["tier"], o["cooler"]["type"])
    if not visits[o["id"]]["todayOnRoute"] or any(g["channel"] == o["channel"] for g in groups):
        continue
    same = [m for m in outlets if m["segment"]["id"] == o["segment"]["id"] and m["id"] != o["id"]]
    members = [m for m in same if m["cooler"]["type"] == o["cooler"]["type"]]
    basis = "same cooler kind"
    if len(members) < MIN_GROUP:
        members, basis = same, "any cooler"
    if len(members) < MIN_GROUP:
        continue
    ids = {m["id"] for m in members}
    per = defaultdict(float); mix = defaultdict(float)
    for x in orders:
        if x["outletId"] in ids and last4_from <= x["date"] < last4_to:
            for l in x["lines"]:
                per[x["outletId"]] += l["cases"] / 4
                mix[l["sku"]] += l["cases"]
    weeks = sorted(per.get(i, 0.0) for i in ids)
    q = lambda f: round(weeks[min(len(weeks) - 1, int(f * len(weeks)))], 1)
    median = weeks[len(weeks) // 2]
    total = sum(mix.values()) or 1
    groups.append({"key": f"DERIVED-{o['segment']['id']}|{o['tier']}|{o['cooler']['type']}", "peerGroupId": f"DERIVED-{o['segment']['id']}-{o['cooler']['type']}",
                   "channel": o["channel"], "tier": o["tier"], "cooler": o["cooler"]["type"], "tierBand": None,
                   "outletsInGroup": len(members), "casesPerWeekNow": {"p25": q(0.25), "median": round(median, 1), "p75": q(0.75)},
                   "weeklyCasesBySku": {sku: {iso_week(TODAY): round(median * n / total, 2)} for sku, n in sorted(mix.items(), key=lambda x: -x[1])},
                   "derived": f"{len(members)} {o['segment']['label'].removeprefix('The ')} shops ({basis}), last 4 complete weeks",
                   "est": True})

# ---- stock on hand (not in the original contract; for Season Check) ----------------
cs = load("current_stock")

# ---- config -----------------------------------------------------------------------
rep = cfg["rep"]
config = {
    "demoDate": TODAY,
    "region": {"name": rep["territory"], "city": "Pune", "state": "Maharashtra", "areas": rep["areas"]},
    "rep": {"id": "REP-01", "name": rep["name"], "role": "Pre-seller", "routeOutletsToday": rep["outletsOnTodaysRoute"],
            "languages": rep["languages"]},
    "distributor": {"id": cfg["distributor"]["id"], "name": cfg["distributor"]["name"],
                    "deliveryLeadDays": cfg["distributor"]["deliveryLagDays"]},
    "history": {"fromWeek": week_keys[0], "toWeek": week_keys[-1], "weekStartsOn": "Monday"},
    "focusSkus": cfg["focusSkus"],
    "seasonCheck": cfg["seasonCheck"],
    "assumptions": SEASON["coolerAssumptions"],
    "seasonWindowLabel": cfg.get("seasonWindowLabel"),
    "dataProvenance": cfg.get("dataProvenance"),
}

# ---- field.json: DEMO ADDITIONS (not in fa-data) ---------------------------------------
# Everything below is synthetic and labelled so on screen. It covers what the prototype asks for
# and the dataset doesn't carry: a district of reps, the pre-season target, newer-SKU evidence and
# yesterday's distributor stock (to detect changes). Rohit's own leaderboard figures are NOT stored:
# the app computes them from orders.json plus the orders placed in the demo.
import random
rng = random.Random(20260428)
FOCUS = cfg["focusSkus"]
PRE = {"from": "2026-03-01", "to": "2026-05-15"}
PRE_LY = {"from": "2025-03-01", "to": "2025-05-15"}
MINE = {o["outletId"] for o in outlets_src if not (o["subArea"] in NEIGHBOUR["subAreas"] and not o["onTodaysRoute"])}
my_orders = [o for o in orders if o["outletId"] in MINE]
focus_ly = sum(l["cases"] for o in my_orders if PRE_LY["from"] <= o["date"] <= PRE_LY["to"] for l in o["lines"] if l["sku"] in FOCUS)
month_ly = sum(l["cases"] for o in my_orders if o["date"][:7] == "2025-04" for l in o["lines"])
# Rohit's cases since 1 Mar, only to scale the synthetic reps so the board compares like with like.
my_cases = sum(l["cases"] for o in my_orders if PRE["from"] <= o["date"] < TODAY for l in o["lines"])
REP_NAMES = ["Sagar Deshmukh", "Pooja Kulkarni", "Amit Pawar", "Neha Bhosale", "Rahul Shinde", "Snehal Jadhav",
             "Vikas More", "Kiran Gaikwad", "Ashwini Patil", "Tushar Chavan", "Manoj Salve"]
TERRITORIES = ["Pune West · Pashan beat", "Aundh", "Baner", "Hadapsar", "Kharadi", "Viman Nagar", "Katraj",
               "Sinhagad Road", "Pimpri", "Chinchwad", "Wakad"]
leader = []
for i, (name, terr) in enumerate(zip(REP_NAMES, TERRITORIES)):
    outlets_n = rng.randint(150, 260)
    leader.append({
        "repId": f"REP-{i + 2:02d}", "name": name, "territory": terr, "outlets": outlets_n,
        "preSeasonPct": rng.randint(52, 84), "productiveCallsPct": rng.randint(72, 92),
        "activeOutletsPct": rng.randint(76, 95), "focusCoveragePct": rng.randint(84, 99),
        "casesOrdered": round(my_cases * outlets_n / len(MINE) * rng.uniform(0.75, 1.2)),
        "monthTargetPct": rng.randint(55, 92),
    })
new_skus = [
    {"sku": "CLZ750", "label": "Newer pack", "pushFrom": "2026-03-01",
     "offtake": {"region": "Nagpur", "units": 540, "unitLabel": "bottles", "weeks": 4, "synthetic": True,
                 "text": "Sold to consumers in Nagpur's pilot kiranas in the first 4 weeks"}},
    {"sku": "OR2250", "label": "Newer pack", "pushFrom": "2026-03-01",
     "offtake": {"region": "Nashik", "units": 310, "unitLabel": "bottles", "weeks": 4, "synthetic": True,
                 "text": "Sold to consumers in Nashik's pilot kiranas in the first 4 weeks"}},
]
field = {
    "syntheticNote": "Demo additions for the prototype, not part of the Season Check dataset.",
    "reps": [{"id": "REP-01", "name": cfg["rep"]["name"], "territory": cfg["rep"]["territory"]},
             {"id": NEIGHBOUR["id"], "name": NEIGHBOUR["name"], "territory": "Pune West · Pashan beat",
              "subAreas": NEIGHBOUR["subAreas"]}],
    "crossTerritory": {"incentiveCreditPct": 50,
                       "rule": "Orders booked at another rep's outlet count 50% towards your incentive; the other 50% goes to the outlet's own rep."},
    "targets": {
        "preSeason": {"label": "Pre-season placement", "measure": "Cases of the focus SKUs booked across your outlets",
                      "skus": FOCUS, **PRE, "target": round(focus_ly * 1.10 / 10) * 10,
                      "basis": f"Last year's same window at your outlets ({focus_ly:,} cases) + 10%"},
        "month": {"label": "April volume", "measure": "All cases booked in April", "from": "2026-04-01", "to": "2026-04-30",
                  "target": round(month_ly * 1.05 / 10) * 10, "basis": f"April 2025 at your outlets ({month_ly:,} cases) + 5%"},
    },
    "leaderboard": {"district": "Pune district", "period": PRE, "reps": leader,
                    "definitions": {
                        "preSeasonPct": "Focus-SKU cases booked since 1 Mar, as a share of the pre-season target",
                        "productiveCallsPct": "Visits in the last 30 days that ended in an order",
                        "activeOutletsPct": "Outlets that ordered at least once in the last 30 days",
                        "focusCoveragePct": "Active outlets that bought at least one focus SKU in the last 30 days",
                        "casesOrdered": "All cases booked since 1 Mar",
                        "monthTargetPct": "April cases against the April target"}},
    "newSkus": new_skus,
    # Retailer issues already open before today (demo), so the outlet profile has some to show.
    "issues": {
        "OUT-01": [{"id": "ISS-D1", "date": "2026-04-14", "categories": ["scheme"], "status": "open",
                    "text": "March free case (Summer Single-Serve) still not credited by the distributor."}],
        "OUT-02": [{"id": "ISS-D2", "date": "2026-04-21", "categories": ["billing"], "status": "open",
                    "text": "Bill showed Rs 20 more per case of 2.25 L than the rate card."},
                   {"id": "ISS-D3", "date": "2026-03-31", "categories": ["missing"], "status": "resolved",
                    "text": "One case short on delivery. Replaced on the next trip."}],
        "OUT-06": [{"id": "ISS-D4", "date": "2026-04-18", "categories": ["delay", "missing"], "status": "open",
                    "text": "Order for the 17 Apr wedding came a day late and 2 crates of glass were cracked."}],
        "OUT-03": [{"id": "ISS-D5", "date": "2026-04-21", "categories": ["quality"], "status": "open",
                    "text": "Afternoon power cuts: 250 ml cola going flat in the cooler, customers complaining."}],
    },
    "stockYesterday": {"asOf": "2026-04-27", "items": [
        {"sku": "CL250", "status": "rationed", "rationPerOutletCases": 8, "note": "Ration of 8 paid cases per outlet"},
        {"sku": "MG600", "status": "out-of-stock", "note": "Out since 24 Apr"},
        {"sku": "CL200G", "status": "rationed-against-empties", "note": "Crate float short through the peak"},
        {"sku": "EN300C", "status": "low", "note": "Slow-moving; limited holding"}]},
}

# ---- write ----------------------------------------------------------------------------
print("Writing data/ from fa-data/data/")
dump("config", config, "Demo settings, from fa-data demo_config.json.")
dump("outlets", {"outlets": outlets}, f"{len(outlets)} outlets. Fictional names. Credit merged from credit.json; closures and bookings from events.json.")
dump("products", {"categories": categories, "products": products}, f"{len(products)} SKUs, from skus.json.")
dump("schemes", {"assumption": load("schemes")["assumption"], "schemes": schemes}, "Schemes 2024-2026, from schemes.json, in the app's scheme types.")
dump("orders", {"orders": orders}, f"Every booked order {orders[0]['date']} to {orders[-1]['date']} ({len(orders)}), from orders_history.json.")
dump("history", {"weeks": week_keys, "weekStarts": [w.isoformat() for w in week_starts],
                 "outlets": {o["id"]: dict(hist.get(o["id"], {})) for o in outlets}},
     "Weekly paid cases booked, by outlet and SKU, summed from orders.json (free cases not included). SKUs never bought are left out.")
dump("visits", {"outlets": visits}, "Planned visits (rolling 400 days) before the demo date, from visits.json.")
dump("distributor_stock", {"asOf": stock_src["syncedAt"][:10], "syncedAt": stock_src["syncedAt"],
                           "assumption": stock_src["assumption"], "items": stock_items,
                           "historicalConstraints": stock_src["historicalConstraints"]},
     "Morning sync on the demo date, from distributor_stock.json. Reliable for in or out of stock, not for quantity.")
dump("calendar", {"regionIndex": SEASON["regionIndex"], "phases": SEASON["phases"],
                  "forecast": forecast, "climatology": climatology, "events": cal_events},
     "Dated events from events.json. Forecast derived from the heatwave event spanning the demo date.")
dump("peers", {"minimumGroupSize": 8, "groups": groups}, "Peer groups from peers.json. Aggregated and anonymised.")
dump("field", field, "DEMO ADDITIONS, synthetic: territory split, district reps, targets, newer-SKU evidence, yesterday's stock.")
dump("current_stock", {"asOf": cs["asOf"], "method": cs["method"], "rows": cs["rows"]},
     "Estimated cases on hand per outlet and SKU on the demo date, from current_stock.json. Estimated, never measured.")
