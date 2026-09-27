"""
Season Check prototype dataset - Part 1: masters (SKUs, outlets, schemes, events, peers).
Territory: Pune West. Demo date: Tue 28 Apr 2026.
All outlets, owners and numbers are fictional. Synthetic scope: 240 outlets, 60 SKUs.
Persona settings follow docs/personas_v2.md Appendix A.
"""
import json, random, datetime as dt, os, math

SEED = 20260428
random.seed(SEED)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
os.makedirs(DATA, exist_ok=True)

DEMO = dt.date(2026, 4, 28)
HIST_START = dt.date(2024, 1, 1)          # two full prior seasons + current YTD
D = lambda d: d.isoformat()

def dump(name, obj):
    p = os.path.join(DATA, name)
    with open(p, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    print(f"  {name:26s} {os.path.getsize(p)/1024:9.1f} KB")

# ─────────────────────────────────────────────────────────────── SKUs (60)
# ptrPerCase = mrp * unitsPerCase * (1 - margin), rounded — matches Sample_Data arithmetic.
# slots = cooler space of one case, in units of "one case of CL250".
SKU_SPEC = [
    # code, name, brand, category, pack, ml, units, mrp, margin, shelfLife, serving, slots
    ("CL200G","Cola 200 ml returnable glass","Thums Cola","Sparkling","Returnable glass",200,24,15,.15,180,"single",1.4),
    ("CL250","Cola 250 ml PET","Thums Cola","Sparkling","PET",250,28,20,.15,120,"single",1.0),
    ("CL250C","Cola 250 ml can","Thums Cola","Sparkling","Can",250,24,35,.15,240,"single",0.8),
    ("CL300C","Cola 300 ml can","Thums Cola","Sparkling","Can",300,24,40,.15,240,"single",0.9),
    ("CL600","Cola 600 ml PET","Thums Cola","Sparkling","PET",600,24,35,.15,120,"single",1.3),
    ("CL750","Cola 750 ml PET","Thums Cola","Sparkling","PET",750,24,40,.15,120,"take-home",1.6),
    ("CL1250","Cola 1.25 L PET","Thums Cola","Sparkling","PET",1250,12,65,.15,180,"take-home",2.0),
    ("CL2250","Cola 2.25 L PET","Thums Cola","Sparkling","PET",2250,9,95,.15,180,"take-home",3.0),
    ("CLZ250","Cola No Sugar 250 ml PET","Thums Cola Zero","Sparkling","PET",250,28,20,.15,120,"single",1.0),
    ("CLZ300C","Cola No Sugar 300 ml can","Thums Cola Zero","Sparkling","Can",300,24,40,.15,240,"single",0.9),
    ("CLZ750","Cola No Sugar 750 ml PET","Thums Cola Zero","Sparkling","PET",750,24,40,.15,120,"take-home",1.6),
    ("CLZ2250","Cola No Sugar 2.25 L PET","Thums Cola Zero","Sparkling","PET",2250,9,95,.15,180,"take-home",3.0),
    ("LL200G","Lemon-lime 200 ml returnable glass","Limcool","Sparkling","Returnable glass",200,24,15,.15,180,"single",1.4),
    ("LL250","Lemon-lime 250 ml PET","Limcool","Sparkling","PET",250,28,20,.15,120,"single",1.0),
    ("LL300C","Lemon-lime 300 ml can","Limcool","Sparkling","Can",300,24,40,.15,240,"single",0.9),
    ("LL600","Lemon-lime 600 ml PET","Limcool","Sparkling","PET",600,24,35,.15,120,"single",1.3),
    ("LL750","Lemon-lime 750 ml PET","Limcool","Sparkling","PET",750,24,40,.15,120,"take-home",1.6),
    ("LL2250","Lemon-lime 2.25 L PET","Limcool","Sparkling","PET",2250,9,95,.15,180,"take-home",3.0),
    ("OR200G","Orange 200 ml returnable glass","Fizzo Orange","Sparkling","Returnable glass",200,24,15,.15,180,"single",1.4),
    ("OR250","Orange 250 ml PET","Fizzo Orange","Sparkling","PET",250,28,20,.15,120,"single",1.0),
    ("OR600","Orange 600 ml PET","Fizzo Orange","Sparkling","PET",600,24,35,.15,120,"single",1.3),
    ("OR1250","Orange 1.25 L PET","Fizzo Orange","Sparkling","PET",1250,12,65,.15,180,"take-home",2.0),
    ("OR2250","Orange 2.25 L PET","Fizzo Orange","Sparkling","PET",2250,9,95,.15,180,"take-home",3.0),
    ("CD250","Cloudy lemon 250 ml PET","Nimbooz Fizz","Sparkling","PET",250,28,20,.15,120,"single",1.0),
    ("CD600","Cloudy lemon 600 ml PET","Nimbooz Fizz","Sparkling","PET",600,24,35,.15,120,"single",1.3),
    ("CD2250","Cloudy lemon 2.25 L PET","Nimbooz Fizz","Sparkling","PET",2250,9,95,.15,180,"take-home",3.0),
    ("JR250","Jeera masala soda 250 ml PET","Jeera Jhatka","Sparkling","PET",250,28,20,.15,120,"single",1.0),
    ("SD600G","Club soda 600 ml glass","Aqua Soda","Sparkling","Returnable glass",600,24,20,.15,365,"take-home",1.7),
    ("SD750","Club soda 750 ml PET","Aqua Soda","Sparkling","PET",750,24,25,.15,365,"take-home",1.6),
    ("MG150T","Mango drink 150 ml Tetra","Aamras","Juice drink","Tetra",150,40,10,.15,180,"single",0.7),
    ("MG200T","Mango drink 200 ml Tetra","Aamras","Juice drink","Tetra",200,27,15,.15,180,"single",0.7),
    ("MG250","Mango drink 250 ml PET","Aamras","Juice drink","PET",250,28,20,.15,120,"single",1.0),
    ("MG600","Mango drink 600 ml PET","Aamras","Juice drink","PET",600,24,38,.15,120,"single",1.3),
    ("MG1000","Mango drink 1 L PET","Aamras","Juice drink","PET",1000,12,90,.15,180,"take-home",1.8),
    ("MF150T","Mixed fruit 150 ml Tetra","Aamras Mixed","Juice drink","Tetra",150,40,10,.15,180,"single",0.7),
    ("MF600","Mixed fruit 600 ml PET","Aamras Mixed","Juice drink","PET",600,24,38,.15,120,"single",1.3),
    ("GV150T","Guava 150 ml Tetra","Aamras Guava","Juice drink","Tetra",150,40,10,.15,180,"single",0.7),
    ("GV600","Guava 600 ml PET","Aamras Guava","Juice drink","PET",600,24,38,.15,120,"single",1.3),
    ("AP200T","Apple 200 ml Tetra","Aamras Apple","Juice drink","Tetra",200,27,15,.15,180,"single",0.7),
    ("CW200T","Coconut water 200 ml Tetra","Naral","Juice drink","Tetra",200,27,25,.15,180,"single",0.7),
    ("NB250","Lemon drink 250 ml PET","Nimbooz Still","Juice drink","PET",250,28,20,.15,120,"single",1.0),
    ("NB600","Lemon drink 600 ml PET","Nimbooz Still","Juice drink","PET",600,24,35,.15,120,"single",1.3),
    ("WT250","Packaged water 250 ml PET","Zaara","Water","PET",250,24,5,.20,365,"single",0.8),
    ("WT500","Packaged water 500 ml PET","Zaara","Water","PET",500,24,10,.20,365,"single",1.1),
    ("WT1000","Packaged water 1 L PET","Zaara","Water","PET",1000,15,20,.20,365,"take-home",1.2),
    ("WT2000","Packaged water 2 L PET","Zaara","Water","PET",2000,9,30,.20,365,"take-home",2.2),
    ("WT5000","Packaged water 5 L jar","Zaara","Water","PET",5000,4,60,.20,365,"take-home",3.4),
    ("EN250","Energy drink 250 ml PET","Volt","Energy","PET",250,24,20,.15,240,"single",1.0),
    ("EN300C","Energy drink 300 ml can","Volt","Energy","Can",300,24,75,.15,240,"single",0.9),
    ("EN500","Energy drink 500 ml PET","Volt","Energy","PET",500,12,50,.15,240,"single",1.1),
    ("SP500","Isotonic sports 500 ml PET","Replenish","Sports","PET",500,12,50,.15,270,"single",1.1),
    ("SP250T","Isotonic sports 250 ml Tetra","Replenish","Sports","Tetra",250,27,25,.15,270,"single",0.8),
    ("IT250T","Iced tea lemon 250 ml Tetra","Chai Chill","Iced tea","Tetra",250,27,20,.15,180,"single",0.8),
    ("IT400","Iced tea peach 400 ml PET","Chai Chill","Iced tea","PET",400,24,30,.15,180,"single",1.1),
    ("IT600","Iced tea lemon 600 ml PET","Chai Chill","Iced tea","PET",600,24,40,.15,180,"single",1.3),
    ("MS180T","Milkshake 180 ml Tetra","Creamo","Dairy","Tetra",180,27,30,.15,120,"single",0.7),
    ("MS200","Milkshake 200 ml PET","Creamo","Dairy","PET",200,24,35,.15,90,"single",0.8),
    ("LS180T","Lassi 180 ml Tetra","Creamo Lassi","Dairy","Tetra",180,27,25,.15,120,"single",0.7),
    ("BM200T","Buttermilk 200 ml Tetra","Creamo Taak","Dairy","Tetra",200,27,15,.15,120,"single",0.7),
    ("CF180C","Cold coffee 180 ml can","Creamo Coffee","Dairy","Can",180,24,50,.15,240,"single",0.7),
]
assert len(SKU_SPEC) == 60, len(SKU_SPEC)

FOCUS = ["CL250", "CL200G", "MG150T", "WT1000"]
SCHEME_SS_SKUS = ["CL250", "LL250", "CL200G"]
MANGO_SKUS = ["MG150T", "MG200T", "MG250", "MG600", "MG1000"]

skus = []
for (c, n, br, cat, pack, ml, u, mrp, mg, sl, serv, slots) in SKU_SPEC:
    skus.append({
        "sku": c, "name": n, "brand": br, "category": cat, "packType": pack,
        "packSizeMl": ml, "unitsPerCase": u, "mrp": mrp,
        "ptrPerCase": round(mrp * u * (1 - mg)),
        "retailerMarginPct": round(mg * 100), "shelfLifeDays": sl,
        "servingType": serv, "isFocusSku": c in FOCUS,
        "returnable": pack == "Returnable glass",
        "coolerSlotsPerCase": slots,
        "caseLitres": round(ml * u / 1000, 2), "active": True,
    })
SKUMAP = {s["sku"]: s for s in skus}
dump("skus.json", {"generatedFor": "Season Check prototype", "count": len(skus),
                   "focusSkus": FOCUS, "note": "Synthetic 60-SKU catalogue. ptrPerCase = mrp x unitsPerCase x (1 - margin).",
                   "skus": skus})

# ─────────────────────────────────────────────────────────── outlet templates
# channel -> (shopTypes, seasonDriver, peakRange, baseWeeklyRange, coolerProb, singleServeBias)
CH = {
 "Traditional Kirana": (["Traditional Kirana","General Store","Provision Store"],"heat",(1.5,2.8),(1.2,9.0),.45,.45),
 "Convenience": (["Cold Drink Shop","Tea / Coffee shop","Bus Stand-Convenience","Outlet in Petrol Pump","Chemist","Stationery & Telecom"],"heat",(2.2,4.2),(0.6,7.5),.62,.80),
 "Paan/Cigarette shop": (["Paan/Cigarette shop"],"heat",(2.0,3.4),(0.5,2.4),.22,.88),
 "Eating & Drinking (seating)": (["Highway Dhaba/Restaurant","QSR","Hotel","Food Court"],"heat",(1.4,2.4),(2.5,9.0),.70,.55),
 "Eating & Drinking (standing)": (["Sweet/Chaat/Bakery","Juice Stall"],"heat",(1.8,3.0),(1.5,5.5),.55,.70),
 "Education": (["School","College Canteen / Cafeteria"],"calendar",(1.1,1.5),(1.8,6.0),.60,.72),
 "At-work": (["Office canteen"],"heat",(1.4,1.8),(2.5,6.5),.72,.68),
 "Entertainment & Leisure": (["Cinema","Snack Stall","Water Park","Resort"],"bookings",(1.3,3.2),(0.6,7.0),.55,.78),
 "Wholesale": (["Beverages only","General wholesale"],"trade",(1.7,2.4),(14.0,30.0),.05,.15),
 "Modern Trade (small format)": (["Self-Service Supermarket"],"heat",(1.5,2.0),(6.0,11.0),.85,.42),
}
CH_COUNTS = {"Traditional Kirana":108,"Convenience":43,"Paan/Cigarette shop":24,
 "Eating & Drinking (seating)":24,"Eating & Drinking (standing)":14,"Education":7,
 "At-work":6,"Entertainment & Leisure":5,"Wholesale":4,"Modern Trade (small format)":5}
assert sum(CH_COUNTS.values()) == 240

AREAS = {"Kothrud":["Karve Road","Dahanukar Colony","Ideal Colony","Paud Road","Shivtirth Nagar"],
         "Warje":["Warje Market","Malwadi","NH-48 Service Road","Ram Nagar","Lane 7"],
         "Bavdhan":["Bavdhan Khurd","Chandni Chowk Road","Pashan Link Road","Sus Gaon","NDA Road"],
         "Pashan":["Pashan Road","Sus Road","Lake Promenade","Someshwarwadi","Bhugaon"]}
TIER_VISITS = {"Diamond":4,"Gold":4,"Silver":3,"Bronze":2,"Iron":1}
TIER_WEIGHTS = [("Diamond",.05),("Gold",.15),("Silver",.30),("Bronze",.30),("Iron",.20)]
FIRST = ["Vilas","Sadashiv","Imran","Balu","Kavita","Prakash","Mahesh","Nitin","Sunil","Rekha","Ganesh",
 "Anil","Shalini","Datta","Pravin","Manisha","Sachin","Jyoti","Ramdas","Ashok","Vaishali","Nilesh",
 "Suresh","Pooja","Hemant","Smita","Bhau","Kiran","Yogesh","Archana","Rajesh","Shobha","Deepak","Tanvi"]
LAST = ["Kale","Mane","Shaikh","Waghmare","Joshi","Kulkarni","Agarwal","Salunkhe","Pawar","Jadhav",
 "Deshmukh","Shinde","Gaikwad","Bhosale","Chavan","Patil","More","Kadam","Sawant","Thorat","Naik","Lokhande"]
NAME_A = ["Mauli","Samarth","Thanda","Lakeside","Sunrise","Shubh Mangal","Mahalaxmi","Ashirwad","Sai",
 "Vighnahar","Datta","Tulja","Om","Krishna","Shivneri","Jai","Navnath","Ekvira","Renuka","Panchvati",
 "Sahyadri","Balaji","Gurukrupa","Yashoda","Siddhi","Anand","Vitthal","Shri","Prabhat","Nandan",
 "Chintamani","Aditya","Maruti","Vishwas","Rohan","Manas","Sparsh","Trimurti","Kamal","Nisarg"]
NAME_B = {"Traditional Kirana":["General Stores","Kirana","Provision Stores","Super Shoppe","General Store"],
 "Convenience":["Cold Drinks","Tea Stall","Cool Corner","Mini Store","Chemist","Point"],
 "Paan/Cigarette shop":["Paan Centre","Pan Stall","Paan Shop"],
 "Eating & Drinking (seating)":["Dhaba","Restaurant","Family Hotel","Biryani House","Cafe"],
 "Eating & Drinking (standing)":["Sweets & Chaat","Bakery","Juice Centre","Farsan Mart"],
 "Education":["School Canteen","College Canteen"],"At-work":["Office Cafeteria","Tech Park Canteen"],
 "Entertainment & Leisure":["Cinema Canteen","Snack Stall","Lake View Stall","Resort Kiosk"],
 "Wholesale":["Beverage Agency","Traders","Distributors"],
 "Modern Trade (small format)":["Mini Mart","Daily Needs","Fresh Mart"]}

PERSONA = {  # id -> (label, role, group)
 "P01":("The Flagship Kirana","helps-most","Helps most"),
 "P02":("The Cautious Kirana","handle-with-care","Handle with care"),
 "P03":("The Cold-Drink Shop","helps-most","Helps most"),
 "P04":("The Lakeside Snack Stall","thin-data","Thin data"),
 "P05":("The School Canteen","stays-quiet","Stays quiet"),
 "P06":("The Banquet Hall","own-calendar","Own calendar"),
 "P07":("The Beverage Wholesaler","stays-quiet","Stays quiet"),
 "P08":("The New Owner","thin-data","Thin data"),
}

def assign_persona(channel, shop_type, tier, has_cooler, base_weekly, registered):
    if channel == "Wholesale": return "P07"
    if channel == "Education": return "P05"
    if (registered is not None and (DEMO - registered).days <= 90): return "P08"
    if channel == "Entertainment & Leisure" or shop_type in ("Cinema","Hotel","Resort Kiosk","Water Park","Resort"):
        return "P06"
    # P04 is the passing-crowd stall, not every small outlet: keep it to footfall-driven types
    if shop_type in ("Snack Stall","Lake View Stall","Paan/Cigarette shop","Paan Centre",
                     "Pan Stall","Paan Shop","Tea / Coffee shop","Tea Stall",
                     "Outlet in Petrol Pump","Bus Stand-Convenience"):
        return "P04"
    if shop_type in ("Cold Drink Shop","Juice Stall","Juice Centre","Cool Corner") or (has_cooler and base_weekly >= 5 and channel == "Convenience"):
        return "P03"
    if has_cooler and tier in ("Diamond","Gold") and base_weekly >= 4: return "P01"
    if not has_cooler and tier in ("Bronze","Iron"): return "P02"
    return "P01" if has_cooler else "P02"

# ───────────────────────────────────────── the eight demo outlets (Appendix A)
DEMO_OUTLETS = [
 # id, name, owner, channel, shopType, area, subArea, tier, cadence, baseWeekly, peak,
 # timing, coolers(count,litres), credit(limit,outstanding,lastPay), crates, registered, mix
 ("OUT-01","Mauli General Stores","Vilas Kale","Traditional Kirana","Traditional Kirana","Kothrud","Karve Road",
  "Diamond",7,7.2,2.7,"reactive-then-planner",(1,300),(18000,0,"2026-04-14"),5,"2014-06-11",
  {"CL250":22,"LL250":8,"CL200G":8,"MG150T":8,"MG600":6,"WT1000":8,"CL750":12,"CL2250":18,"OR1250":10}),
 ("OUT-02","Samarth Kirana","Sadashiv Mane","Traditional Kirana","Traditional Kirana","Warje","Lane 7",
  "Bronze",14,1.4,1.6,"reactive-14",(0,0),(4500,1800,"2026-03-24"),0,"2017-02-20",
  {"CL2250":35,"OR1250":25,"CL750":15,"CL250":15,"MG150T":10}),
 ("OUT-03","Thanda Corner Cold Drinks","Imran Shaikh","Convenience","Cold Drink Shop","Kothrud","Paud Road",
  "Gold",7,6.7,3.8,"planner",(2,300),(15000,0,"2026-04-21"),6,"2019-03-04",
  {"CL250":25,"LL250":10,"OR250":8,"CL300C":12,"EN250":12,"CL200G":10,"MG150T":8,"WT500":10,"WT1000":5}),
 ("OUT-04","Lakeside Bhel & Snacks","Balu Waghmare","Entertainment & Leisure","Snack Stall","Pashan","Lake Promenade",
  "Iron",28,0.5,3.5,"reactive-28",(0,0),(1500,0,"2026-03-31"),0,"2021-11-08",
  {"CL250":35,"WT500":25,"WT1000":15,"MG150T":15,"LL250":10}),
 ("OUT-05","Sunrise School Canteen","Kavita Joshi","Education","School","Bavdhan","Bavdhan Khurd",
  "Silver",10,2.7,1.2,"calendar",(1,150),(5000,0,"2026-04-09"),0,"2018-07-02",
  {"WT500":50,"WT1000":20,"MG150T":30}),
 ("OUT-06","Shubh Mangal Banquets","Prakash Kulkarni","Eating & Drinking (seating)","Hotel","Bavdhan","Chandni Chowk Road",
  "Silver",10,8.4,1.4,"bookings",(1,150),(12000,0,"2026-04-17"),4,"2016-01-19",
  {"CL2250":30,"OR1250":20,"WT1000":20,"CL200G":15,"CL250":15}),
 ("OUT-07","Mahalaxmi Beverage Agency","Mahesh Agarwal","Wholesale","Beverages only","Warje","Warje Market",
  "Diamond",7,27.7,2.0,"trade",(0,0),(75000,16500,"2026-04-07"),0,"2012-09-14",
  {"CL2250":40,"OR1250":20,"CL750":15,"WT1000":15,"CL250":10}),
 ("OUT-08","Ashirwad General Store","Nitin Salunkhe","Traditional Kirana","Traditional Kirana","Pashan","Sus Road",
  "Bronze",14,2.4,1.8,"new",(0,0),(5000,0,None),0,"2026-04-22",
  {"CL2250":35,"OR1250":20,"CL750":15,"CL250":15,"MG150T":15}),
]
DEMO_PERSONA = {"OUT-01":"P01","OUT-02":"P02","OUT-03":"P03","OUT-04":"P04",
                "OUT-05":"P05","OUT-06":"P06","OUT-07":"P07","OUT-08":"P08"}

def cooler_slots(count, litres):
    if count == 0: return 0
    per = {300: 10, 150: 5, 60: 2, 40: 1}.get(litres, max(1, round(litres / 30)))
    return per * count

outlets = []
used_names = set()

for (oid, nm, own, ch, st, ar, sub, tier, cad, bw, peak, timing, (cc, cl), (lim, outs, lastpay),
     crates, reg, mix) in DEMO_OUTLETS:
    regd = dt.date.fromisoformat(reg)
    outlets.append({
        "outletId": oid, "name": nm, "ownerName": own, "channel": ch, "shopType": st,
        "area": ar, "subArea": sub, "tier": tier, "visitsPerMonth": TIER_VISITS[tier],
        "visitCadenceDays": cad, "visitWeekday": 1 if cad in (7, 14) else None,
        "cooler": {"count": cc, "litresEach": cl, "ownedBy": "bottler" if cc else
                   ("outlet-icebox" if oid == "OUT-04" else None),
                   "coolerSlots": 1 if oid == "OUT-04" else cooler_slots(cc, cl)},
        "glassCratesHeld": crates, "registeredOn": reg, "isDemoPersona": True,
        "persona": {"id": DEMO_PERSONA[oid], "label": PERSONA[DEMO_PERSONA[oid]][0],
                    "role": PERSONA[DEMO_PERSONA[oid]][1], "group": PERSONA[DEMO_PERSONA[oid]][2]},
        "model": {"baseCasesPerWeekJan2024": round(bw / 1.08, 2), "channelPeakMultiplier": peak,
                  "timing": timing, "skuMixPct": mix,
                  "seasonDriver": {"calendar": "calendar", "bookings": "bookings",
                                   "trade": "trade"}.get(timing, "heat")},
        "carryLimitCases": 9 if oid == "OUT-04" else None,
        "paysCashAboveLimit": oid in ("OUT-04", "OUT-07"),
    })
    used_names.add(nm)

# ───────────────────────────────────────── the remaining 232 outlets
def pick_tier():
    r = random.random(); c = 0
    for t, w in TIER_WEIGHTS:
        c += w
        if r <= c: return t
    return "Bronze"

seq = 9
for ch, n in CH_COUNTS.items():
    made = sum(1 for o in outlets if o["channel"] == ch)
    shop_types, driver, pk, bwr, cprob, ssb = CH[ch]
    for _ in range(n - made):
        tier = "Diamond" if ch == "Wholesale" else ("Gold" if ch == "Modern Trade (small format)" else pick_tier())
        st = random.choice(shop_types)
        ar = random.choice(list(AREAS)); sub = random.choice(AREAS[ar])
        tw = {"Diamond": 1.7, "Gold": 1.25, "Silver": 1.0, "Bronze": .62, "Iron": .38}[tier]
        bw = round(random.uniform(*bwr) * tw, 2)
        cp = cprob + {"Diamond": .35, "Gold": .2, "Silver": 0, "Bronze": -.25, "Iron": -.35}[tier]
        has_cooler = random.random() < cp
        cc = (2 if (tier in ("Diamond", "Gold") and random.random() < .3) else 1) if has_cooler else 0
        litres = random.choice([300, 300, 150]) if cc else (60 if random.random() < .12 else 0)
        if litres == 60: cc = 1
        icebox = (not cc) and random.random() < .18
        peak = round(random.uniform(*pk), 2)
        # a handful of structurally declining outlets
        decline = (ch == "At-work" and random.random() < .5) or (random.random() < .03)
        # new outlets (thin data)
        if random.random() < .045:
            reg = DEMO - dt.timedelta(days=random.randint(12, 88))
        else:
            reg = dt.date(random.randint(2011, 2025), random.randint(1, 12), random.randint(1, 28))
        cad = {4: 7, 3: 10, 2: 14, 1: 28}[TIER_VISITS[tier]]
        for _ in range(40):
            nm = f"{random.choice(NAME_A)} {random.choice(NAME_B[ch])}"
            if nm not in used_names: break
        used_names.add(nm)
        lim = {"Diamond": random.choice([14000, 18000, 22000]), "Gold": random.choice([9000, 12000, 15000]),
               "Silver": random.choice([6000, 8000, 10000]), "Bronze": random.choice([3000, 4500, 6000]),
               "Iron": random.choice([1500, 2500, 3500])}[tier]
        if ch == "Wholesale": lim = random.choice([55000, 60000, 75000])
        od = 0
        if random.random() < .26: od = round(lim * random.uniform(.12, .55) / 100) * 100
        pid = assign_persona(ch, st, tier, bool(cc) or icebox, bw, reg)
        oid = f"OUT-{seq:03d}"; seq += 1
        outlets.append({
            "outletId": oid, "name": nm, "ownerName": f"{random.choice(FIRST)} {random.choice(LAST)}",
            "channel": ch, "shopType": st, "area": ar, "subArea": sub, "tier": tier,
            "visitsPerMonth": TIER_VISITS[tier], "visitCadenceDays": cad,
            "visitWeekday": random.randint(0, 5) if cad in (7, 14) else None,
            "cooler": {"count": cc, "litresEach": litres if cc else 0,
                       "ownedBy": "bottler" if cc else ("outlet-icebox" if icebox else None),
                       "coolerSlots": 1 if (icebox and not cc) else cooler_slots(cc, litres)},
            "glassCratesHeld": random.choice([0, 0, 0, 2, 4, 6]) if tier != "Iron" else 0,
            "registeredOn": D(reg), "isDemoPersona": False,
            "persona": {"id": pid, "label": PERSONA[pid][0], "role": PERSONA[pid][1], "group": PERSONA[pid][2]},
            "model": {"baseCasesPerWeekJan2024": bw, "channelPeakMultiplier": peak,
                      "timing": ("planner" if random.random() < .3 else f"reactive-{random.choice([7,10,14,21])}")
                                 if driver == "heat" else driver,
                      "skuMixPct": None, "seasonDriver": driver, "structuralDecline": decline,
                      "singleServeBias": round(min(.95, max(.08, random.gauss(ssb, .09))), 2)},
            "carryLimitCases": 9 if (tier == "Iron" and random.random() < .5) else None,
            "paysCashAboveLimit": ch == "Wholesale" or tier == "Iron",
            "_credit": {"limit": lim, "overdue": od},
        })

print(f"Outlets: {len(outlets)}")

# today's route: 27 outlets, includes all 8 demo personas, weighted to Tuesday-cadence outlets
route = [o["outletId"] for o in outlets[:8]]
pool = [o for o in outlets[8:] if o["visitsPerMonth"] >= 2]
random.shuffle(pool)
route += [o["outletId"] for o in pool[:19]]
for o in outlets:
    o["onTodaysRoute"] = o["outletId"] in route
    o["routeSequence"] = route.index(o["outletId"]) + 1 if o["outletId"] in route else None

dump("outlets.json", {"territory": "Pune West", "areas": list(AREAS), "count": len(outlets),
     "note": "Synthetic territory. 240 outlets is our assumption, not a figure supplied by the brief.",
     "personaLegend": {k: {"label": v[0], "role": v[1], "group": v[2]} for k, v in PERSONA.items()},
     "outlets": outlets})

# hand state to part 2
with open(os.path.join(ROOT, "scripts", "_state.json"), "w") as f:
    json.dump({"outlets": outlets, "seed": SEED}, f)
print("Part 1 done.")
