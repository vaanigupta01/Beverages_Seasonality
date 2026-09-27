# Outlet personas and the data plan

Eight outlets on one pre-seller's Tuesday route in Pune West (Kothrud, Warje, Bavdhan, Pashan). The demo date is **Tuesday 28 April 2026**, a peak week. The feature is **Season Check**. All outlets, owners and numbers are fictional, and every modelled number is an estimate.

> **Updated 28 Sep 2026** for the Season Check dataset (`fa-data/`, seed 20260428) and the Season Check engine v2 (`js/feature/season-engine.js`). The numbers below replace the ones from the earlier 8-outlet data (`scripts/generate_data.py`). What changed is listed at the end.

- **Persona sheets:** `~/Downloads/Outlet_Personas_Pune_West.pdf` and the Design canvas "Outlet Personas · Pune West" (<https://claude.ai/artifact/NGxFvxkv6ai47m41Vvy5V9>). Each sheet describes a **type** of outlet at the top; our demo shop appears lower down, boxed, as "Example in our data". **The sheets still show the earlier numbers**: redraw them from the tables below.
- **Data:** `fa-data/data/*.json` is the source (240 outlets, 60 SKUs, 12,324 orders from 1 Jan 2024 to 27 Apr 2026). `scripts/import_fa_data.py` reshapes it into the 12 files the app reads in `data/`.
- **Season inputs** (forecast, region index, pack season multipliers, cooler capacity) come from the engine: `data-source/season-inputs.json`.
- **Checks:** `fa-data/docs/validation.json` (34 checks on the dataset, all passing) and `node test/season-engine.test.mjs` (17 checks on the engine, all passing).

```bash
python3 scripts/import_fa_data.py     # fa-data/ + data-source/ → data/
python3 scripts/build_single.py       # → index.html, gt-app.html
node test/season-engine.test.mjs      # the results table and checks below
```

## How the data is built

Everything below comes from the dataset's generators (`fa-data/scripts/gen_1_master.py` … `gen_4_validate.py`), not from this app.

- **Weekly demand at each outlet** = its January 2024 base × a channel peak × the seasonal shape.
- **Seasonal amplitude:** `SWING_SCALE = 0.52`, tuned so the territory's median summer swing is 2.2×.
- **Each outlet's calendar then applies:** school terms and closures, wedding bookings, month-end loads and dated events.
- **At each planned visit the owner orders whole cases.** How the order is sized depends on the timing type:
  - `planner`: sizes on the days ahead;
  - `reactive-N`: sizes on the last N days, so orders lag;
  - `reactive-then-planner`: OUT-01, which was late in 2024–25 and plans ahead in 2026;
  - `calendar`, `bookings`, `trade`: the institution, event-led and wholesale types.
- **Caps on the order:** credit, carrying capacity and distributor supply. Short-filled lines are kept as booked vs delivered, and volume that couldn't be booked is kept as `blockedLines`.
- **Every outlet has a persona type.** The same 8 types cover all 240 outlets, not just the 8 demo shops, so any outlet opened in the app behaves correctly.

## Decisions (final)

| # | Topic | Decision |
|---|---|---|
| 1 | Set | The 8 personas below; no NH-48 fuel-station store. |
| 2 | Demo date, feature | Tue 28 Apr 2026; Season Check. |
| 3 | History | **2024, 2025 and 2026 to date** (two prior seasons). Counts are **by order date**, as the app counts. Lift = best 2025 month ÷ the Jan–Feb 2025 average. |
| 4 | OUT-08 | Registered 2026-04-22. No orders and no visits before today; `history.json` holds `"OUT-08": {}`. Its estimate comes from `peers.json` (42 similar kiranas without a cooler). |
| 5 | Prices, schemes | `ptrPerCase = mrp × unitsPerCase × (1 − margin)`. Summer Single-Serve is pooled across CL250, LL250 and CL200G; uses are counted by order date within the calendar month; free cases don't count against the 6-case ration on 250 ml cola. **Schemes are informational:** the distributor settles them later. The app books the full value and shows the benefit as an estimate. |
| 6 | Credit | 01 ₹18,000 · 02 ₹4,500 with ₹1,800 due (₹2,700 room) · 03 ₹15,000 · 04 ₹1,500, cash above it · 05 ₹5,000 · 06 ₹12,000, asking for ₹18,000 · 07 ₹75,000 with ₹16,500 due, cash above the limit · 08 ₹5,000. **Credit is advisory:** the rep may book beyond the limit. |
| 7 | Owner names | 01 Vilas Kale · 02 Sadashiv Mane · 03 Imran Shaikh · 04 Balu Waghmare · 05 Kavita Joshi · 06 Prakash Kulkarni · 07 Mahesh Agarwal · 08 Nitin Salunkhe. |
| 8 | Scheme uses | OUT-03 spent all 4 April uses. OUT-01 has all 4 left. |
| 9 | School dates | Exams 15–30 Apr 2026 (demand × 0.6). Shut 1 May – 14 Jun 2026, reopens 15 Jun. Also shut 1 May – 14/15 Jun in 2024 and 2025, and for the Diwali break (16 Oct – 5 Nov). |
| 10 | OUT-06 bookings | 14 bookings from 29 Apr to 16 May 2026, needing 55 cases. **8 of them (29 cases) fall before the next delivery on 8 May.** The adhik month (17 May – 15 Jun) has no wedding dates. |
| 11 | OUT-05 range | Water 500 ml 50%, water 1 L 20%, mango Tetra 30%. Season Check never suggests sparkling or energy drinks at outlets tagged `school` (FSSAI 2020 school rules). |
| 12 | Distributor, 28 Apr | CL250 is rationed to 6 paid cases per outlet (free cases exempt). MG600 is out (back 2 May). CL200G is released only against empties. WT500 and EN300C are low. |

## Key numbers (from the data)

2025 figures by order date. "Typical" orders are the dataset's own figures (`fa-data/docs/PERSONA_REFRESH.md`). "Today" is Season Check engine v2 on the demo date. Expected = what the outlet should sell before the next delivery. Order = what the engine suggests, after the stock already on the shelf and the gates.

<!-- numbers:start -->
| Outlet | 2025 cases by month (Jan → Dec) | Jan–Apr 2026 (to 27 Apr) | Best month | Lift | Typical winter order | Typical peak order | Largest 2025 order | 2026 vs 2025 to date | Today: expected → order |
|---|---|---|---|---|---|---|---|---|---|
| OUT-01 | 34 40 50 79 70 48 47 34 46 39 37 44 | 40 47 82 42 | Apr | 2.14× | 9.6 cases, ₹5,926 | 15.2 cases, ₹7,777 | 19 (6 May 2025) | +14.7% | 16.1 → **10** to 5 May (6 on the shelf) |
| OUT-02 | 6 6 8 12 8 6 6 6 9 6 6 6 | 7 6 12 4 | Apr | 2.0× | 3.1 cases, ₹2,141 | 3.9 cases, ₹2,416 | 4 (27 May 2025) | +3.6% | 4.1 → **2** to 12 May (2 on the shelf) |
| OUT-03 | 38 45 68 91 71 44 45 36 45 41 39 43 | 43 49 95 75 | Apr | 2.19× | 10.4 cases, ₹4,903 | 18.8 cases, ₹8,950 | 22 (15 Apr 2025) | +16.4% | 25.3 → **13** to 5 May (12 on the shelf) |
| OUT-04 | 2 3 3 9 6 3 3 2 2 3 3 3 | 2 3 9 0 | Apr | 3.6× | 2.5 cases, ₹906 | 4.8 cases, ₹1,691 | 6 (27 May 2025) | +16.7% | 10.3 → **6** to 26 May (estimate; ice box and credit trim it) |
| OUT-05 | 10 11 11 8 0 7 11 10 15 2 11 11 | 9 10 12 5 | Sep | 1.43× | 3.3 cases, ₹804 | 2.9 cases, ₹703 | 4 (29 Dec 2025) | −10.0% | 0.5 → **0**: closes 1 May, 2 selling days left |
| OUT-06 | 34 39 24 50 50 9 9 9 20 33 43 41 | 45 41 32 45 | Apr | 1.37× | 12.6 cases, ₹6,692 | 16.2 cases, ₹7,992 | 20 (23 Apr 2025) | +10.9% | 29 (8 bookings) → **25** to 8 May (4 on the shelf; ₹798 over credit, flagged) |
| OUT-07 | 185 238 311 317 209 130 198 173 211 181 182 220 | 199 192 380 175 | Apr | 1.5× | 49.5 cases, ₹31,044 | 56.9 cases, ₹35,411 | 168 (25 Mar 2025) | +1.9% | computed (88.6), **not shown**: wholesale |
| OUT-08 | no history (registered 2026-04-22) | — | — | — | — | — | — | — | 8.2 (peers) → **7** to 12 May (first order at 80%, top up 12 May) |
<!-- numbers:end -->

**The heat term on 28 Apr:** the forecast is +1.6 to +2°C above the Pune normal, and so were the last 4 weeks (+1.5°C), so heat is neutral for shops with their own history. It adds a little at the two estimate-based shops, whose peer rates start from normal-year figures. In the **43°C what-if**, expected demand rises: OUT-01 16.1 → 18.4 (+14%), OUT-03 25.3 → 28.5 (+13%), OUT-04 10.3 → 12.5, and OUT-08 8.2 → 9.3. "Heat-wave conditions" is flagged.

## The eight personas

Each persona is a **type** of outlet. The shop in our data is only its example. Tags: G = cause in research Table G (why demand goes unmet); § = Industry_Context.

| # | Type | Also covers | Season driver · normal-year peak (Table D) | Example in our data (order date) | Outlets of this type (of 240) |
|---|---|---|---|---|---|
| 01 · **primary** | **Flagship Kirana** · helps most. Busy main-road kiranas, company cooler, top tier, weekly. | Self-service mini-marts | Heat · ≈ 2.5–3.0× | Mauli General Stores: 2025 peak April, 2.14×; 2026 +14.7%; all 4 April scheme uses left | 86 |
| 02 | **Cautious Kirana** · handle with care. Small lane kiranas, no cooler, low tier, take-home bottles, tight cash. | Kiranas under ₹1 lakh a month | Heat, muted · ≈ 1.6–2.0× | Samarth Kirana: 2025 peak April, 2.0×; ₹1,800 overdue, ₹2,700 room | 67 |
| 03 · **primary** | **Cold-Drink Shop** · helps most. Chilled-first impulse shops near colleges, offices, transit. | Juice shops | Heat, steepest · ≈ 3.5–4.5× | Thanda Corner: 2025 peak April, 2.19×; 2026 +16.4%; 4 of 4 April uses gone; afternoon load-shedding 6 Apr – 31 May | 16 |
| 04 | **Lakeside Snack Stall** · thin data. Footfall-led stalls; lowest tier; monthly visits; ice box; cash above ₹1,500. | Paan/tea stalls; highway dhabas on long weekends | Heat × weekends · ≈ 3–5× on peak weekends | Lakeside Bhel: April is its biggest month (3.6×); biggest order 27 May 2025 (6 cases) | 43 |
| 05 | **School Canteen** · stays quiet. Season follows an institution's calendar. | College canteens, hostel-belt shops | School calendar · ≈ 1.2× April, ≈ 0 in vacation | Sunrise School Canteen: 0 cases in May 2025, 2 in Oct 2025 (Diwali break); shut 1 May – 14 Jun 2026 | 7 |
| 06 | **Banquet Hall** · own calendar. Event-led: halls, wedding lawns, caterers, cinemas. | Cinemas; dhabas in wedding season | Bookings × weather · ≈ 1–3×; no wedding dates 17 May – 15 Jun 2026 | Shubh Mangal: 2025 peak April (Dec close behind); monsoon lull 9 cases a month Jun–Aug; 14 bookings ≈ 55 cases | 9 |
| 07 | **Beverage Wholesaler** · stays quiet. Sells on to other shops; big packs; deals; month-end loads. | Sub-stockists, market traders | Deals and month-end targets · ≈ 2–3×, front-loaded | Mahalaxmi: loads at every month-end; biggest order 168 cases on 25 Mar 2025 (financial year-end) | 4 |
| 08 | **New Owner** · thin data. Any outlet with no usable history. | New and re-coded outlets | Unknown; from similar shops (est.) | Ashirwad General Store: registered 22 Apr 2026; no orders yet | 8 |

**General concerns (each tied to a cause):**
- 01: stocking up in time, since orders follow last week (G2); clear scheme terms (G9); best seller short at the distributor (G3); cooler space and buyers lost to the shop opposite (G1).
- 02: won't load up after leftovers (G7); cash, credit and dues (G4); 250 ml buyers go to shops with coolers (G1); trust in the rep's numbers (§3).
- 03: keeping drinks cold through power cuts (G1); running out before the next visit (G2); peak packs rationed (G3); scheme uses gone early (G9).
- 04: runs out between visits (G5); peak order above the limit (G4); ice box only (G1); restocks at the wholesale market (§1).
- 05: leftovers through the closure (G7); range limited by school rules (G6); restocking before reopening and wasted visits (G5).
- 06: stock a day before each event (G5); credit too small for peak weeks (G4); heat-based advice and last-minute gaps (G2).
- 07: best rate (G8); fast booking (G10); stock limits up front (G3); deals honoured, large credit with dues (G4).
- 08: no numbers (G2); fear of over-ordering (G7); doesn't know the schemes (G9); trust still to build (§3).

**Season Check on each example (engine v2, 28 Apr, as the app shows it):**

| # | Mode | What the rep sees |
|---|---|---|
| 01 | forward | "Order about 10 cases to last until Tue 5 May": 16 expected, less 6 on the shelf. The IPL match and Maharashtra Day are included. In the cart: pace gaps, missing regulars, "1 more case earns a free case" (all 4 April uses left), and a swap if CL250 goes above the ration of 6. |
| 02 | forward | "Order about 2 cases to last until Tue 12 May". Credit room is ₹2,700: a bigger cart triggers the credit warning (rep only) and "larger than usual". No cooler, so cold packs get the no-cooler note. Summer Single-Serve is not for Bronze. |
| 03 | forward | "Order about 13 cases": 25 expected, less 12 on the shelf. Above 6 cases of CL250, the swap to CL200G still counts toward the free case, but the April uses are gone ("this month's 4 free cases are used up"). The cooler warning fires on a doubled order. |
| 04 | peers | "Order about 6 cases to last until Tue 26 May", labelled an estimate from 42 similar shops. The ice box trims cold packs; cash is due above ₹1,500. The long weekend is included. |
| 05 | closing | "Order little or nothing before the closure": 2 selling days. Any sparkling drink in the cart gets the school rule. |
| 06 | bookings | "Order about 25 cases to last until Fri 8 May": 8 bookings need 29, less 4 on the shelf. ₹798 over credit is flagged, never cut from event stock. |
| 07 | silent | "No suggestion for this outlet": only stock limits and credit are checked. |
| 08 | peers (new) | "Order about 7 cases to last until Tue 12 May": 80% of the similar-shop estimate, top up on 12 May. The New Outlet 12% applies to this first order. |

**How we'd check them:**

| # | We'd check by |
|---|---|
| 01 | Ride-alongs at main-road kiranas in peak week; the bottler's weekly sales by beat |
| 02 | Ride-alongs at no-cooler kiranas; distributor records of dues against order size |
| 03 | Cooler temperature logs and MSEDCL outage records |
| 04 | Peak-weekend ride-alongs; checks on wholesale-market purchases |
| 05 | School calendars for the beat; interviews with canteen contractors |
| 06 | Hall booking calendars; caterers' cases per 100 guests |
| 07 | Distributor invoices showing where wholesaler volume goes |
| 08 | The first 3 orders of new outlets against the peer estimate |

## Persona settings (from `fa-data/data/outlets.json → model`)

<!-- settings:start -->
| Outlet | Base cases/week (Jan 2024) | Channel peak | Timing | Cadence | Cooler (cases of 250 ml chilled) | Mix (% of cases) |
|---|---|---|---|---|---|---|
| OUT-01 | 6.67 | 2.7 | reactive in 2024–25, planner in 2026 | 7 d | company, 1 × 300 L (10) | CL250 22, CL2250 18, CL750 12, OR1250 10, LL250 8, CL200G 8, MG150T 8, WT1000 8, MG600 6 |
| OUT-02 | 1.30 | 1.6 | reactive, 14 days | 14 d | none | CL2250 35, OR1250 25, CL750 15, CL250 15, MG150T 10 |
| OUT-03 | 6.20 | 3.8 | planner | 7 d | company, 2 × 300 L (20) | CL250 25, CL300C 12, EN250 12, LL250 10, CL200G 10, WT500 10, OR250 8, MG150T 8, WT1000 5 |
| OUT-04 | 0.46 | 3.5 | reactive, 28 days | 28 d | ice box (1) | CL250 35, WT500 25, WT1000 15, MG150T 15, LL250 10 |
| OUT-05 | 2.50 | 1.2 | calendar (term, exams × 0.6, closures × 0) | 10 d | company, 1 × 150 L (5) | WT500 50, MG150T 30, WT1000 20 |
| OUT-06 | 7.78 | 1.4 | bookings | 10 d | company, 1 × 150 L (5) | CL2250 30, OR1250 20, WT1000 20, CL200G 15, CL250 15 |
| OUT-07 | 25.65 | 2.0 | trade (month-end loads) | 7 d | none | CL2250 40, OR1250 20, CL750 15, WT1000 15, CL250 10 |
| OUT-08 | 2.22 | 1.8 | new (no orders before the demo date) | 14 d | none | CL2250 35, OR1250 20, CL750 15, CL250 15, MG150T 15 |
<!-- settings:end -->

## Scope and why these eight

**Scope.** General-trade outlets on one Pune West route, in the summer season, for one decision: how much to order today. The rep uses the app; these are the outlets he serves. **Primary: 01 and 03**, where the value is. The other six are cases the feature must handle without doing harm. The dataset gives every one of the 240 outlets one of these 8 types, so the feature is exercised well beyond the 8 examples.

**How we chose them.**
1. **Define** what the brief asks for: span channels, tiers, cold chain, places and owners, and cover where the feature helps, where it stays quiet, and where data is thin.
2. **List** 15 outlet types from Industry_Context §3 and Table D.
3. **Merge** look-alikes.
4. **Check** that every Season Check rule fires somewhere and stays silent somewhere.

**Not covered:** modern trade and chains; quick-commerce dark stores; key accounts served by a key-account team; outlets that buy only from a wholesaler.

**Considered, folded in:** self-service mini-mart → 01; paan or tea stall → 04; cinema → 06; highway dhaba → 04 + 06.

## What changed from the earlier version

| Item | Before (8-outlet data) | Now (Season Check dataset) |
|---|---|---|
| Scale | 8 outlets, 13 SKUs, 343 orders from 30 Dec 2024 | **240 outlets, 60 SKUs, 12,324 orders from 1 Jan 2024** |
| History | 2025 plus 2026 to date | **2024, 2025 and 2026 to date** |
| OUT-01 | 2.7× lift; 2026 +12% | **2.14×; +14.7%** |
| OUT-03 | 3.1×; 2026 +11% | **2.19×; +16.4%** |
| OUT-06 best month | December | **April**, with December close behind; a real monsoon lull |
| OUT-07 biggest order | 102 cases, 25 Mar 2025 | **168 cases**, same date |
| Peers | 2 hand-made groups (14 and 6 outlets) | The dataset's 8 groups (min. 8 outlets), plus one **derived** group for OUT-04's type (42 snack stalls), because the dataset has none for its channel |
| Season inputs | from the earlier generator | **The engine's** (`data-source/season-inputs.json`): forecast 38–40°C to 4 May and 39–41°C to 11 May; research region index; pack season multipliers (engine values for 13 packs, the other 47 derived from their 2025 swing) |
| Stock on hand | not modelled | `current_stock.json` (estimated). **The engine nets it off the order** (app addition, `PARAMS.netOnHand`) |
| Distributor stock | weekly report of Sat 25 Apr | **Morning sync on Tue 28 Apr**: reliable for in or out of stock, not quantity |
| Schemes | applied at booking | **Informational**: settled later by the distributor; shown as an estimate |
| Territory | one rep | A 10-outlet beat in Someshwarwadi belongs to a neighbouring rep (demo addition) |

## Still to do

- **Redraw the persona sheets** (PDF and Design canvas) from the tables above. They still show the earlier numbers.
- **Pune normals** in the engine come from a secondary source (the Wikipedia climate table). Replace them with IMD Shivajinagar station normals.
- **Translations:** new channel and shop-type names, and the new screens' text, are English-only in Marathi and Hindi.
