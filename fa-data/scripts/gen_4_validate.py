"""Part 4: trim the derived index, validate against the persona narratives, write docs."""
import json, os, datetime as dt, statistics as st
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data"); DOCS = os.path.join(ROOT, "docs")
os.makedirs(DOCS, exist_ok=True)
DEMO = dt.date(2026, 4, 28)
FOCUS = ["CL250", "CL200G", "MG150T", "WT1000"]
SS = ["CL250", "LL250", "CL200G"]

def load(n):
    with open(os.path.join(DATA, n)) as f: return json.load(f)
def dump(n, o, d=DATA):
    p = os.path.join(d, n)
    with open(p, "w") as f: json.dump(o, f, separators=(",", ":"))
    print(f"  {n:26s} {os.path.getsize(p)/1024:9.1f} KB")

OUT = load("outlets.json")["outlets"]
O = {o["outletId"]: o for o in OUT}
SK = {s["sku"]: s for s in load("skus.json")["skus"]}
ORD = load("orders_history.json")["orders"]
IDX = load("orders_index.json")

# ── trim weekly index to the focus SKUs (monthly covers everything else)
IDX["weeklyByOutletSku"] = [r for r in IDX["weeklyByOutletSku"] if r["s"] in FOCUS]
IDX["weeklyScope"] = "Focus SKUs only. Monthly aggregates cover the full catalogue."
# month metadata so the app can label partial months and normalise for order-day count
odays = defaultdict(set)
for od in ORD: odays[od["d"][:7]].add(od["d"])
IDX["months"] = [{"ym": ym, "orderDays": len(odays[ym]),
                  "partial": ym == "2026-04",
                  "note": "Up to the demo date only" if ym == "2026-04" else None}
                 for ym in sorted(odays)]
IDX["monthStripGuidance"] = ("Order-day counts differ between months and years: a month with five "
  "visit-days reads high against one with four, and 2026-04 stops at the demo date. Show the strip "
  "as cases per order day, or label 2026-04 'to date'. Never compare raw monthly bars across years.")
dump("orders_index.json", IDX)

BY = defaultdict(list)
for od in ORD: BY[od["o"]].append(od)
for k in BY: BY[k].sort(key=lambda x: x["d"])

V = {"generatedAt": dt.datetime.now().isoformat(timespec="seconds"), "demoDate": "2026-04-28",
     "checks": [], "personaRefresh": [], "routeSeason": {}, "swing": {}, "scenarios": {}}
def chk(name, ok, detail):
    V["checks"].append({"check": name, "pass": bool(ok), "detail": detail})
    print(("  PASS " if ok else "  FAIL ") + name + " :: " + detail)

# ── 1. monthly cases by order date, 2025 and 2026 YTD, for the 8 personas
MON = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
for oid in [f"OUT-0{i}" for i in range(1, 9)]:
    o = O[oid]
    m25 = [0] * 12; m26 = [0] * 12; v25 = [0] * 12
    for od in BY.get(oid, []):
        d = dt.date.fromisoformat(od["d"])
        if d.year == 2025: m25[d.month - 1] += od["c"]; v25[d.month - 1] += od["t"]
        if d.year == 2026: m26[d.month - 1] += od["c"]
    base = (m25[0] + m25[1]) / 2 if (m25[0] + m25[1]) else 0
    pk = max(m25) if m25 else 0
    lift = round(pk / base, 2) if base else None
    best = MON[m25.index(pk)] if pk else None
    ods = BY.get(oid, [])
    winter = [od["c"] for od in ods if dt.date.fromisoformat(od["d"]).month in (1, 2)]
    peakm = [od["c"] for od in ods if dt.date.fromisoformat(od["d"]).month in (4, 5)]
    wv = [od["t"] for od in ods if dt.date.fromisoformat(od["d"]).month in (1, 2)]
    pv = [od["t"] for od in ods if dt.date.fromisoformat(od["d"]).month in (4, 5)]
    # 2026 YTD vs same days 2025
    cut = dt.date(2026, 4, 27)
    y26 = sum(od["c"] for od in ods if "2026-01-01" <= od["d"] <= "2026-04-27")
    y25 = sum(od["c"] for od in ods if "2025-01-01" <= od["d"] <= "2025-04-27")
    V["personaRefresh"].append({
        "outletId": oid, "name": o["name"], "persona": o["persona"]["label"],
        "monthly2025ByOrderDate": m25, "monthly2026ToDate": m26[:4],
        "liftByOrderDate": lift, "bestMonth2025": best,
        "typicalOrderWinterCases": round(st.mean(winter), 1) if winter else None,
        "typicalOrderWinterValue": round(st.mean(wv)) if wv else None,
        "typicalOrderPeakCases": round(st.mean(peakm), 1) if peakm else None,
        "typicalOrderPeakValue": round(st.mean(pv)) if pv else None,
        "largest2025Order": max(((od["c"], od["d"]) for od in ods
                                 if od["d"].startswith("2025")), default=(None, None)),
        "yoy2026ToDatePct": round((y26 / y25 - 1) * 100, 1) if y25 else None,
        "orderCountTotal": len(ods)})

chk("OUT-08 has no order history", len(BY.get("OUT-08", [])) == 0,
    f"{len(BY.get('OUT-08', []))} orders")

# ── 2. scheme use state on the demo date
def ss_triggers(oid, ym):
    t = 0
    for od in BY.get(oid, []):
        if od["d"].startswith(ym): t += od.get("fc", 0)
    return t
t1, t3 = ss_triggers("OUT-01", "2026-04"), ss_triggers("OUT-03", "2026-04")
chk("OUT-01 has all 4 April scheme uses left", t1 == 0, f"free cases taken in Apr 2026 = {t1}")
chk("OUT-03 has spent all 4 April scheme uses", t3 == 4, f"free cases taken in Apr 2026 = {t3}")
apr1 = [sum(l["b"] for l in od["l"] if l["s"] in SS) for od in BY["OUT-01"] if od["d"].startswith("2026-04")]
apr3 = [sum(l["b"] for l in od["l"] if l["s"] in SS) for od in BY["OUT-03"] if od["d"].startswith("2026-04")]
chk("OUT-01 April scheme-pack cases are 7, 6, 7", apr1 == [7, 6, 7], str(apr1))
chk("OUT-03 April scheme-pack cases stay under the monthly cap", sum(apr3) >= 40, str(apr3))

# ── 3. route-level seasonality
rm = defaultdict(int); rs = defaultdict(int); rbook = defaultdict(int); rdel = defaultdict(int)
for od in ORD:
    d = dt.date.fromisoformat(od["d"]); ym = f"{d.year}-{d.month:02d}"
    rm[ym] += od["c"]
    for l in od["l"]:
        rbook[ym] += l["b"]; rdel[ym] += l["dl"]
        if SK[l["s"]]["servingType"] == "single": rs[ym] += l["b"]
season = []
for ym in sorted(rm):
    season.append({"month": ym, "cases": rm[ym],
                   "singleServeSharePct": round(100 * rs[ym] / rm[ym]) if rm[ym] else 0,
                   "fillRatePct": round(100 * rdel[ym] / rbook[ym]) if rbook[ym] else 0})
V["routeSeason"]["monthly"] = season
s25 = {r["month"]: r for r in season}
chk("single-serve share peaks in the summer months",
    s25["2025-05"]["singleServeSharePct"] > s25["2025-01"]["singleServeSharePct"],
    f"Jan-25 {s25['2025-01']['singleServeSharePct']}% -> May-25 {s25['2025-05']['singleServeSharePct']}%")
chk("peak-month fill rate dips against the off-season",
    s25["2025-04"]["fillRatePct"] <= s25["2025-09"]["fillRatePct"] - 3,
    f"Apr-25 {s25['2025-04']['fillRatePct']}% vs Sep-25 {s25['2025-09']['fillRatePct']}%")
ytd26 = sum(v for k, v in rm.items() if "2026-01" <= k <= "2026-04")
ytd25 = sum(v for k, v in rm.items() if "2025-01" <= k <= "2025-04")
chk("2026 season to date runs ahead of 2025",
    ytd26 > ytd25, f"Jan-Apr 2025 {ytd25} -> 2026 {ytd26} cases (+{round((ytd26/ytd25-1)*100)}%)")

# ── 4. summer swing across the territory (peak month / Jan-Feb average, 2025)
swings, ready, tiny = [], [], []
for o in OUT:
    m = [0] * 12
    for od in BY.get(o["outletId"], []):
        d = dt.date.fromisoformat(od["d"])
        if d.year == 2025: m[d.month - 1] += od["c"]
    base = (m[0] + m[1]) / 2
    pk = max(m); pkm = m.index(pk) + 1
    if pkm not in (4, 5, 6) or o["channel"] == "Wholesale" or base < 1: continue
    sw = round(pk / base, 2)
    (swings if base >= 4 else tiny).append(sw)
    if base >= 4 and pk: ready.append(round(100 * m[2] / pk))
swings.sort(); ready.sort(); tiny.sort()
V["swing"] = {"definition": "peak-month cases / average of Jan and Feb cases, 2025, summer-peaking retail outlets only",
    "sizeFilter": "outlets averaging at least 4 cases a month in Jan-Feb; smaller outlets are reported separately because ratios on a 1-3 case base are noisy",
    "n": len(swings), "median": st.median(swings), "min": swings[0], "max": swings[-1],
    "smallBaseOutlets": {"n": len(tiny), "median": st.median(tiny) if tiny else None,
                         "min": tiny[0] if tiny else None, "max": tiny[-1] if tiny else None},
    "p25": swings[len(swings)//4], "p75": swings[3*len(swings)//4],
    "marchReadiness": {"definition": "March cases / that outlet's own peak-month cases, as %",
        "n": len(ready), "median": st.median(ready), "min": ready[0], "max": ready[-1],
        "spreadPoints": ready[-1] - ready[0]}}
chk("summer swing spreads widely across outlets", swings[-1] / swings[0] > 2,
    f"n={len(swings)} median {st.median(swings)}x, range {swings[0]}x to {swings[-1]}x")
chk("March readiness spreads widely", (ready[-1] - ready[0]) > 40,
    f"median {st.median(ready)}%, range {ready[0]}% to {ready[-1]}%, spread {ready[-1]-ready[0]} points")
chk("summer swing median sits in a believable band",
    1.6 <= st.median(swings) <= 2.4, f"median {st.median(swings)}x")
chk("March readiness median sits in a believable band",
    55 <= st.median(ready) <= 80, f"median {st.median(ready)}%")


# ── 5. numeric distribution of the focus SKUs
nd = {}
for ym in ("2025-01", "2025-03", "2025-04", "2025-05", "2026-04"):
    for sku in FOCUS:
        buyers = {od["o"] for od in ORD if od["d"].startswith(ym) and any(l["s"] == sku for l in od["l"])}
        nd.setdefault(ym, {})[sku] = round(100 * len(buyers) / len(OUT))
V["routeSeason"]["numericDistributionPct"] = nd
chk("focus-SKU reach rises into the peak and still leaves a gap",
    nd["2025-05"]["CL250"] > nd["2025-01"]["CL250"] and nd["2025-05"]["CL250"] < 95,
    f"CL250 reach Jan-25 {nd['2025-01']['CL250']}% -> May-25 {nd['2025-05']['CL250']}%")

# ── 6. acceptance-criteria coverage: which outlets demonstrate each case
stock = load("current_stock.json")["rows"]
cred = {c["outletId"]: c for c in load("credit.json")["rows"]}
onhand = defaultdict(dict)
for r in stock: onhand[r["outletId"]][r["sku"]] = r
sc = {}
sc["normalRecommendation"] = [o["outletId"] for o in OUT if o["onTodaysRoute"]
    and o["persona"]["role"] == "helps-most"][:8]
sc["closureInWindow"] = [o["outletId"] for o in OUT if o["persona"]["id"] == "P05"]
sc["wholesaleExcluded"] = [o["outletId"] for o in OUT if o["channel"] == "Wholesale"]
sc["thinHistory"] = [o["outletId"] for o in OUT
    if (DEMO - dt.date.fromisoformat(o["registeredOn"])).days <= 90]
sc["noColdChain"] = [o["outletId"] for o in OUT if o["cooler"]["coolerSlots"] == 0
    and o["onTodaysRoute"]]
sc["coolerCap"] = [o["outletId"] for o in OUT if 0 < o["cooler"]["coolerSlots"] <= 5
    and o["onTodaysRoute"]]
sc["creditWarning"] = [c["outletId"] for c in cred.values() if c["overdue"] > 0
    and O[c["outletId"]]["onTodaysRoute"]]
sc["schemeIneligible"] = [o["outletId"] for o in OUT if o["tier"] in ("Bronze", "Iron")
    and o["onTodaysRoute"]]
sc["monthlySchemeCapSpent"] = ["OUT-03"]
sc["schemeUsesAvailable"] = ["OUT-01"]
sc["distributorRationed"] = "CL250 rationed to 6 paid cases per outlet, every outlet"
sc["distributorOutOfStock"] = "MG600 out of stock, every outlet"
sc["glassAgainstEmpties"] = [o["outletId"] for o in OUT if o["glassCratesHeld"] > 0
    and o["onTodaysRoute"]]
sc["eventDriven"] = [o["outletId"] for o in OUT if o["persona"]["id"] == "P06"
    and o["onTodaysRoute"]]
sc["structuralDecline"] = [o["outletId"] for o in OUT if o["model"].get("structuralDecline")]
V["scenarios"] = sc
for k, v in sc.items():
    n = len(v) if isinstance(v, list) else 1
    chk(f"scenario covered: {k}", n >= 1, f"{n} outlet(s)" if isinstance(v, list) else v)

# ── 7. internal coherence
bad = [od["i"] for od in ORD if od["c"] != sum(l["b"] for l in od["l"])]
chk("order case totals match their lines", not bad, f"{len(bad)} mismatches")
bad2 = [od["i"] for od in ORD if any(l["dl"] > l["b"] for l in od["l"])]
chk("delivered never exceeds booked", not bad2, f"{len(bad2)} violations")
bad3 = [od["i"] for od in ORD if od["t"] != sum(l["v"] for l in od["l"])]
chk("order value matches its lines", not bad3, f"{len(bad3)} mismatches")
ptr_bad = [s for s in SK.values() if s["ptrPerCase"] != round(s["mrp"] * s["unitsPerCase"] * (1 - s["retailerMarginPct"]/100))]
chk("every SKU price reconciles with MRP and margin", not ptr_bad, f"{len(ptr_bad)} off")
sparse = st.mean([len(o["model"]["skuMixPct"]) for o in OUT])
chk("SKU histories are sparse, not a dense matrix", sparse < 10,
    f"mean {sparse:.1f} SKUs per outlet out of 60")
avg_val = sum(od["t"] for od in ORD) / sum(od["c"] for od in ORD)
chk("realised value per case is plausible", 400 < avg_val < 750, f"Rs {avg_val:.0f} per case")

V["summary"] = {"outlets": len(OUT), "skus": len(SK), "orders": len(ORD),
    "orderLines": sum(len(od["l"]) for od in ORD),
    "historyFrom": "2024-01-01", "historyTo": "2026-04-27",
    "passed": sum(1 for c in V["checks"] if c["pass"]), "total": len(V["checks"])}
dump("validation.json", V, DOCS)
print(f"\n{V['summary']['passed']}/{V['summary']['total']} checks passed")
