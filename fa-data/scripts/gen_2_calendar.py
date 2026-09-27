"""Part 2: schemes, events calendar, distributor stock, demo config."""
import json, os, datetime as dt, random

random.seed(20260428)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
DEMO = dt.date(2026, 4, 28)
D = lambda d: d.isoformat()

def dump(name, obj):
    p = os.path.join(DATA, name)
    with open(p, "w") as f: json.dump(obj, f, separators=(",", ":"))
    print(f"  {name:26s} {os.path.getsize(p)/1024:9.1f} KB")

SS = ["CL250", "LL250", "CL200G"]
MANGO = ["MG150T", "MG200T", "MG250", "MG600", "MG1000"]
TAKEHOME_DIW = ["OR1250", "CL2250", "CL1250", "OR2250"]

# ───────────────────────────────────────────────────────────────── schemes
def ss_scheme(code, y):
    return {"schemeId": code, "name": "Summer Single-Serve Surge", "type": "free-case",
        "applicableSkus": SS, "thresholdCases": 10, "freeCases": 1,
        "thresholdBasis": "combined cases across applicable SKUs in one order",
        "eligibleTiers": ["Diamond", "Gold", "Silver"], "maxTriggersPerOutletPerMonth": 4,
        "triggerCountedBy": "order date", "validFrom": f"{y}-03-01", "validTo": f"{y}-05-31",
        "applicationMode": "informational",
        "settlement": "Claimed by the distributor and credited within 30 days. Not applied at booking.",
        "additionalBenefit": "Branded cooler shelf-strip with the first qualifying order",
        "freeCasesExemptFromRation": True}

def mango_scheme(code, y):
    return {"schemeId": code, "name": "Juice Drink Push", "type": "percent-off",
        "applicableSkus": MANGO, "thresholdCases": 5, "discountPct": 8,
        "thresholdBasis": "combined mango cases in one order", "eligibleTiers": "all",
        "maxTriggersPerOutletPerMonth": None, "validFrom": f"{y}-04-01", "validTo": f"{y}-06-30",
        "applicationMode": "informational",
        "settlement": "Deducted by the distributor at invoice. Not applied at booking."}

schemes = [
    ss_scheme("SCH-SS24", 2024), mango_scheme("SCH-MG24", 2024),
    ss_scheme("SCH-SS25", 2025), mango_scheme("SCH-MG25", 2025),
    ss_scheme("SCH-SS26", 2026), mango_scheme("SCH-MG26", 2026),
    {"schemeId": "SCH-WT26", "name": "Water Summer", "type": "free-case",
     "applicableSkus": ["WT1000"], "thresholdCases": 8, "freeCases": 1,
     "thresholdBasis": "cases of WT1000 in one order", "eligibleTiers": "all",
     "requiresBottlerCooler": True, "maxTriggersPerOutletPerMonth": 2,
     "validFrom": "2026-03-15", "validTo": "2026-06-30", "applicationMode": "informational",
     "settlement": "Claimed by the distributor and credited within 30 days."},
    {"schemeId": "SCH-NEW", "name": "New Outlet Activation", "type": "percent-off",
     "applicableSkus": "all", "thresholdCases": 0, "discountPct": 12,
     "eligibility": "First order within 90 days of registration", "eligibleTiers": "all",
     "validFrom": "2024-01-01", "validTo": "2026-12-31", "applicationMode": "informational",
     "settlement": "Deducted at invoice."},
    {"schemeId": "PRG-PURITY", "name": "Cooler Purity Program", "type": "monthly-payout",
     "payoutPerMonth": 300, "eligibility": "Outlets with a bottler-owned visi-cooler whose cooler holds only our products at the monthly photo audit",
     "validFrom": "2024-01-01", "validTo": "2026-12-31",
     "coolerPlacementPolicy": "New coolers are placed only at Diamond, Gold and Silver outlets"},
]
for y, code in ((2024, "SCH-DIW24"), (2025, "SCH-DIW25")):
    schemes.append({"schemeId": code, "name": "Diwali Take-Home Booster", "type": "free-case",
        "applicableSkus": TAKEHOME_DIW, "thresholdCases": 8, "freeCases": 1,
        "thresholdBasis": "combined cases across applicable SKUs in one order",
        "eligibleTiers": ["Diamond", "Gold"], "maxTriggersPerOutletPerMonth": 3,
        "validFrom": f"{y}-10-01", "validTo": f"{y}-11-15", "applicationMode": "informational",
        "settlement": "Claimed by the distributor and credited within 45 days.",
        "additionalBenefit": "Diwali standee, limited stock, first 50 orders across the distributor"})

dump("schemes.json", {"asOf": D(DEMO),
    "assumption": "Schemes shown on a SKU are informational. Thresholds and benefits are settled later by the distributor and are NOT auto-applied during order booking. Season Check therefore shows an estimated benefit and names who settles it.",
    "schemes": schemes})

# ───────────────────────────────────────────────────────────────── events
events = []
def ev(**k): events.append(k)

# weather / season anchors
for y, onset, note in ((2024, "2024-06-10", "normal onset"),
                       ("2025", "2025-05-26", "early onset, season cut short"),
                       (2026, "2026-06-09", "forecast onset")):
    ev(eventId=f"EV-MONSOON-{y}", type="weather", scope="territory", startDate=onset,
       endDate=f"{str(y)[:4]}-10-08", label=f"Monsoon onset ({note})", demandMultiplier=0.45,
       confidence="high" if str(y) != "2026" else "forecast")
ev(eventId="EV-HEATWAVE-2026-A", type="weather", scope="territory", startDate="2026-04-20",
   endDate="2026-05-06", label="Heatwave spell, 40-42 C", demandMultiplier=1.18, confidence="observed")
ev(eventId="EV-HEATWAVE-2025-A", type="weather", scope="territory", startDate="2025-04-18",
   endDate="2025-04-30", label="Heatwave spell, 40-41 C", demandMultiplier=1.15, confidence="observed")

# holidays and festivals
HOL = [("2024-03-25","Holi",1.10),("2024-04-09","Gudi Padwa",1.08),("2024-05-01","Maharashtra Day",1.12),
       ("2024-09-07","Ganesh Chaturthi",1.15),("2024-11-01","Diwali",1.20),
       ("2025-03-14","Holi",1.10),("2025-03-30","Gudi Padwa",1.08),("2025-05-01","Maharashtra Day",1.12),
       ("2025-08-27","Ganesh Chaturthi",1.15),("2025-10-20","Diwali",1.20),
       ("2026-03-04","Holi",1.10),("2026-03-19","Gudi Padwa",1.08),("2026-05-01","Maharashtra Day",1.12),
       ("2026-09-15","Ganesh Chaturthi",1.15),("2026-11-08","Diwali",1.20)]
for d, label, m in HOL:
    ev(eventId=f"EV-HOL-{d}", type="festival", scope="territory", startDate=d, endDate=d,
       label=label, demandMultiplier=m, confidence="high")
ev(eventId="EV-LONGWEEKEND-2026-MAYDAY", type="long-weekend", scope="territory",
   startDate="2026-05-01", endDate="2026-05-03", label="Maharashtra Day long weekend",
   demandMultiplier=1.35, affectsPersonas=["P04", "P06"], confidence="high",
   note="Falls inside the cover window on the demo date")

# IPL evenings, Apr-May
for y in (2024, 2025, 2026):
    d = dt.date(y, 3, 26)
    i = 0
    while d <= dt.date(y, 5, 26):
        if d.weekday() in (2, 5, 6):
            i += 1
            ev(eventId=f"EV-IPL-{y}-{i:02d}", type="sport", scope="territory", startDate=D(d),
               endDate=D(d), label="IPL evening match", demandMultiplier=1.12,
               affectsPersonas=["P01", "P03", "P04", "P06"], confidence="high")
        d += dt.timedelta(days=1)

# institution calendars
ev(eventId="EV-SCH-EXAM-2026", type="closure-ramp", scope="persona", personaId="P05",
   shopType="School", startDate="2026-04-15", endDate="2026-04-30",
   label="Board and internal exams", demandMultiplier=0.6, confidence="high")
for y, s, e in ((2024, "2024-05-01", "2024-06-14"), (2025, "2025-05-01", "2025-06-15"),
                (2026, "2026-05-01", "2026-06-14")):
    ev(eventId=f"EV-SCH-CLOSE-{y}", type="closure", scope="persona", personaId="P05",
       shopType="School", startDate=s, endDate=e, label="Summer vacation, school shut",
       demandMultiplier=0.0, reopensOn=D(dt.date.fromisoformat(e) + dt.timedelta(days=1)),
       confidence="high", source="Maharashtra state board calendar")
for y, s, e in ((2024, "2024-10-16", "2024-11-05"), (2025, "2025-10-16", "2025-11-05")):
    ev(eventId=f"EV-SCH-DIWALI-{y}", type="closure", scope="persona", personaId="P05",
       shopType="School", startDate=s, endDate=e, label="Diwali break, school shut",
       demandMultiplier=0.0, confidence="medium")
for y, s, e in ((2024, "2024-05-10", "2024-06-15"), (2025, "2025-05-10", "2025-06-15"),
                (2026, "2026-05-10", "2026-06-15")):
    ev(eventId=f"EV-COL-CLOSE-{y}", type="closure", scope="persona", personaId="P05",
       shopType="College Canteen / Cafeteria", startDate=s, endDate=e,
       label="College shut after exams", demandMultiplier=0.0,
       reopensOn=D(dt.date.fromisoformat(e) + dt.timedelta(days=1)), confidence="high")

# adhik month 2026: no wedding dates
ev(eventId="EV-ADHIK-2026", type="no-wedding-window", scope="persona", personaId="P06",
   startDate="2026-05-17", endDate="2026-06-15", label="Adhik month, no wedding dates",
   demandMultiplier=0.05, confidence="high",
   note="Weddings pulled forward into late April and the first half of May")

# OUT-06 booking calendar: 14 events 29 Apr - 16 May 2026 needing 55 cases
bk = [("2026-04-29",3),("2026-04-30",2),("2026-05-01",5),("2026-05-02",5),("2026-05-03",5),
      ("2026-05-05",3),("2026-05-06",3),("2026-05-07",3),("2026-05-09",5),("2026-05-10",4),
      ("2026-05-12",4),("2026-05-13",4),("2026-05-15",4),("2026-05-16",5)]
assert sum(c for d, c in bk if d < "2026-05-08") == 29, "first 8 events must need 29 cases"
assert sum(c for _, c in bk) == 55
for i, (d, c) in enumerate(bk, 1):
    ev(eventId=f"EV-BOOK-OUT-06-{i:02d}", type="booking", scope="outlet", outletId="OUT-06",
       startDate=d, endDate=d, label="Wedding function", expectedCases=c, confidence="high",
       source="outlet booking calendar")

# cinema releases
for y in (2024, 2025, 2026):
    for mth in range(1, 13):
        for wk in (1, 3):
            try: d = dt.date(y, mth, 1 + 7 * wk)
            except ValueError: continue
            while d.weekday() != 4: d += dt.timedelta(days=1)
            if d > dt.date(2026, 6, 30): continue
            ev(eventId=f"EV-REL-{D(d)}", type="release", scope="persona", personaId="P06",
               shopType="Cinema", startDate=D(d), endDate=D(d + dt.timedelta(days=2)),
               label="Big release weekend", demandMultiplier=1.55, confidence="medium")

# power cuts
for oid, s, e in (("OUT-03", "2026-04-06", "2026-05-31"), ("OUT-03", "2025-04-28", "2025-05-12")):
    ev(eventId=f"EV-POWER-{oid}-{s}", type="power-cut", scope="outlet", outletId=oid,
       startDate=s, endDate=e, label="Afternoon load-shedding, 2-4 hours",
       coolerTempImpactC=4, demandMultiplier=0.88, confidence="observed",
       note="Cooler runs above 8 C in the afternoon; 4-8 hours to recover")

dump("events.json", {"asOf": D(DEMO), "count": len(events),
    "usage": "Season Check applies scope=outlet and scope=persona events to the cover window; scope=territory events scale the whole route.",
    "events": events})

# ─────────────────────────────────────────────────── distributor stock
cur = [
 ("CL250", "rationed", 142, 6, "Plant allocation short against the heatwave spell. Free scheme cases are exempt from the ration."),
 ("MG600", "out-of-stock", 0, 0, "Out since 24 Apr. Expected back 2 May."),
 ("CL200G", "rationed-against-empties", 96, None, "Full crates released only against empties returned, plus crates paid for by deposit."),
 ("WT500", "low", 58, None, "Below one day of peak cover."),
 ("EN300C", "low", 21, None, "Slow-moving; limited holding."),
]
ds = {"syncedAt": "2026-04-28T07:10:00+05:30", "sourceSystem": "Distributor DMS",
 "assumption": "Stock syncs to the GT App every morning. Reliable for in-stock versus out-of-stock; the quantity can drain during the day, so Season Check never presents it as a guaranteed quantity.",
 "distributorId": "DIST-PW-014", "distributorName": "Sahyadri Beverages Distributors",
 "current": [], "historicalConstraints": []}
for sku, status, avail, ration, note in cur:
    ds["current"].append({"sku": sku, "status": status, "casesAvailable": avail,
                          "rationPerOutletCases": ration, "note": note})
ds["defaultStatus"] = "available"
for sku, s, e, kind, note in (
 ("CL250", "2025-04-09", "2025-04-15", "out-of-stock", "Out for 7 days, the week before peak heat"),
 ("WT1000", "2025-04-14", "2025-04-18", "out-of-stock", "Out for 5 days"),
 ("MG600", "2025-05-02", "2025-05-04", "out-of-stock", "Out for 3 days"),
 ("CL200G", "2025-05-01", "2025-05-20", "rationed-against-empties", "New crates rationed"),
 ("CL250", "2024-05-06", "2024-05-11", "out-of-stock", "Out for 6 days"),
 ("MG150T", "2024-04-22", "2024-04-25", "out-of-stock", "Out for 4 days"),
 ("CL200G", "2026-04-20", "2026-05-31", "rationed-against-empties", "Crate float short through the peak"),
):
    ds["historicalConstraints"].append({"sku": sku, "fromDate": s, "toDate": e, "status": kind, "note": note})
dump("distributor_stock.json", ds)

# ─────────────────────────────────────────────────────────── demo config
dump("demo_config.json", {
 "demoDate": "2026-04-28", "demoDateWeekday": "Tuesday",
 "seasonWindowLabel": "Peak week. Pune's hottest spell ran 20 Apr to 6 May.",
 "rep": {"name": "Rohit Jagtap", "role": "Pre-seller for the bottler's appointed distributor",
         "experienceYears": 4, "territory": "Pune West",
         "areas": ["Kothrud", "Warje", "Bavdhan", "Pashan"],
         "languages": ["Marathi", "Hindi", "English (basic)"],
         "outletsOnTodaysRoute": 27, "dailyRouteLoad": "25-30"},
 "distributor": {"id": "DIST-PW-014", "name": "Sahyadri Beverages Distributors",
                 "deliveryLagDays": 1, "deliveryNote": "Orders booked today are delivered next day"},
 "focusSkus": ["CL250", "CL200G", "MG150T", "WT1000"],
 "seasonCheck": {
   "coverWindow": {"formula": "daysToNextPlannedVisit + deliveryLagDays + bufferDays", "bufferDays": 2},
   "forwardBaseline": {
     "formula": "expectedWeeklyCases = historicalSameWeekRate x levelFactor",
     "historicalSameWeekRate": "median of the same ISO week across available prior seasons (2024, 2025)",
     "levelFactor": "last 4 weeks this year / same 4 weeks prior year",
     "netOf": "estimatedCasesOnHand from current_stock.json, correctable by a rep count"},
   "ruleOrder": ["closure", "de-load", "distributor", "cooler", "credit", "safe-cap", "forward-baseline"],
   "guardrails": {
     "safeCapMaxDaysCover": 21, "safeCapMaxDaysCoverIfOverstockHistory": 12,
     "shelfLifeGuard": "never recommend more than sellable before expiry or the season taper",
     "creditMode": "warning-only",
     "creditAssumption": "The rep may book beyond the credit limit. Credit is advisory, not a hard block.",
     "coolerMode": "cap chilled packs to available cooler slots",
     "thresholdNudgeWithinCases": 2,
     "peerGroupMinimumOutlets": 8,
     "peerDisclosure": "Aggregated and anonymised only. Never a named outlet."},
   "deLoadTriggers": ["monsoon onset forecast inside the window", "closure inside the window",
                      "structural decline", "overstock history with high days of cover"],
   "excludedFromConsumptionSizing": ["Wholesale", "onward-selling volume"]},
 "resetDemoClearsKeys": ["seasoncheck.orders", "seasoncheck.repCounts", "seasoncheck.overrides"],
 "dataProvenance": "Synthetic. 240 outlets and 60 SKUs are our assumptions, not figures supplied by the brief. Persona settings follow docs/personas_v2.md Appendix A.",
})
print("Part 2 done.")
