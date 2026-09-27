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
- calendar.forecast       from the 2026 heatwave event that spans the demo date.
- calendar.climatology    from the monsoon onset events.
- calendar.events         territory and persona events, with the IPL match days of each
                          year folded into one "IPL evening matches" entry.
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

# ---- outlets -------------------------------------------------------------------
COOLER = {"bottler": "bottler", "outlet-icebox": "ice-box", "outlet": "own-fridge", None: "none"}
PAYMENT = {"credit": "credit", "cash": "cash"}
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
                   "lastPaymentDate": c["lastPaymentDate"], "paymentMode": PAYMENT.get(c["paymentMode"], c["paymentMode"]),
                   "paysCashAboveLimit": c["paysCashAboveLimit"], "requestedLimit": c["requestedLimit"]},
        "carryLimitCases": o["carryLimitCases"],
        "tags": [f"persona:{p['id']}", f"persona:{p['id']}|shop:{o['shopType']}"],
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
           "minutes": v["durationMin"], "outcome": v["outcome"], "orderId": v["orderId"], "note": v["note"]}
    by_outlet[v["outletId"]].append({k: x for k, x in row.items() if x is not None})   # nulls dropped to save space
visits = {o["outletId"]: {
    "cadenceDays": o["visitCadenceDays"], "todayOnRoute": o["onTodaysRoute"], "routeOrder": o["routeSequence"],
    "nextVisitAfterToday": visits_src["nextPlannedVisit"].get(o["outletId"]),
    "visits": sorted((v for v in by_outlet[o["outletId"]] if v["date"] < TODAY), key=lambda v: v["date"]),
} for o in outlets_src}

# ---- distributor stock -----------------------------------------------------------
stock_src = load("distributor_stock")
STATUS = {"rationed": "rationed", "out-of-stock": "out"}
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
            "casesAvailable": s["casesAvailable"], "note": s["note"]}
    if status == "rationed":
        item["rationAppliesTo"] = "paid-cases"
    stock_items.append(item)

# ---- calendar --------------------------------------------------------------------
heat = next((e for e in events if e["type"] == "weather" and "Heatwave" in e["label"]
             and e["startDate"] <= TODAY <= e["endDate"]), None)
forecast = {"asOf": TODAY, "est": True, "periods": [], "monsoonSignalNext14Days": False}
if heat:
    temps = [int(x) for x in re.findall(r"\d+", heat["label"])[:2]]
    forecast["periods"].append({"from": (D(TODAY) + dt.timedelta(days=1)).isoformat(), "to": heat["endDate"],
                                "maxC": temps if len(temps) == 2 else temps * 2, "rainChance": "none",
                                "source": heat["eventId"]})
monsoons = sorted((e for e in events if e["type"] == "weather" and e["label"].startswith("Monsoon")), key=lambda e: e["startDate"])
normal = next((e for e in monsoons if "normal" in e["label"]), monsoons[0])
climatology = {"normalOnsetPune": normal["startDate"][5:], "plusMinusDays": 3,
               "onsets": {e["startDate"][:4]: e["startDate"] for e in monsoons if e["startDate"] < TODAY},
               "forecastOnset": next((e["startDate"] for e in monsoons if e["startDate"] >= TODAY), None)}
forecast["monsoonSignalNext14Days"] = bool(climatology["forecastOnset"] and D(climatology["forecastOnset"]) <= D(TODAY) + dt.timedelta(days=14))


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
                       "source": days[0].get("confidence"), "est": True})
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
    "seasonWindowLabel": cfg.get("seasonWindowLabel"),
    "dataProvenance": cfg.get("dataProvenance"),
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
dump("calendar", {"forecast": forecast, "climatology": climatology, "events": cal_events},
     "Dated events from events.json. Forecast derived from the heatwave event spanning the demo date.")
dump("peers", {"minimumGroupSize": 8, "groups": groups}, "Peer groups from peers.json. Aggregated and anonymised.")
dump("current_stock", {"asOf": cs["asOf"], "method": cs["method"], "rows": cs["rows"]},
     "Estimated cases on hand per outlet and SKU on the demo date, from current_stock.json. Estimated, never measured.")
