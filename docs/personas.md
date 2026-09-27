# Outlet personas and the data plan

Eight outlets on one pre-seller's Tuesday route in Pune West (Kothrud, Warje, Bavdhan, Pashan). The demo date is **Tuesday 28 April 2026**, a peak week. The feature is **Season Check**. All outlets, owners and numbers are fictional, and every modelled number is an estimate (`est`).

- **Persona sheets:** `~/Downloads/Outlet_Personas_Pune_West.pdf` (9 A4 pages) and the Design canvas "Outlet Personas · Pune West" (<https://claude.ai/artifact/NGxFvxkv6ai47m41Vvy5V9>). Each sheet describes a **type** of outlet at the top; our demo shop appears lower down, boxed, as "Example in our data".
- **Data:** `data/*.json` (10 files), written by `scripts/generate_data.py` (seed 20260428, standard library only).
- **Sheets:** `scripts/persona_sheets/build.py` reads every example number from `data/*.json` and `docs/validation/summary.json` (order-date method, as the app counts). The type text lives in `scripts/persona_sheets/content.py` and carries no shop-specific numbers. Re-run both after any change:

```bash
python3 scripts/generate_data.py
python3 scripts/persona_sheets/build.py
```

- **Checks:** `docs/validation/checks.md` (16 checks, all passing).

## How the data is built

Weekly demand at each outlet = its January base × the Pune West demand index (research Table A), scaled by the outlet's channel peak (Table D) as `1 + (index − 1) × (peak − 1) / 1.8`, where 2.8 is a normal year's regional peak. Then each outlet's own calendar applies: school terms and closures, wedding bookings, month-end loads, and dated events (Table C). At each planned visit, the owner orders whole cases for the days until the next delivery:

- planners size on the coming days;
- reactive owners size on the last gap's sales, so their orders lag by a visit;
- then credit, carrying capacity and distributor supply cap the order.

The sample data is not used.

## Decisions (final)

| # | Topic | Decision |
|---|---|---|
| 1 | Set | The 8 personas below; no NH-48 fuel-station store. |
| 2 | Demo date, feature | Tue 28 Apr 2026; Season Check. Both decided. |
| 3 | Last year | 2025 rebuilt from the research index. Sheets, charts and lifts count cases **by order date**, as the app does. Lift = peak month ÷ Jan–Feb average. (`summary.json` also keeps a spread-over-cover series, used only for context.) |
| 4 | OUT-08 | Registered 2026-04-22. No orders and no visits before today; `history.json` holds `"OUT-08": {}`. His estimate comes from `peers.json`. |
| 5 | Prices, scheme | 15% margin (20% for water). Summer Single-Serve pooled across CL250, LL250 and CL200G; uses counted by order date within the calendar month; free cases don't count against the 6-case ration on 250 ml cola. |
| 6 | Order values | Re-priced at these margins (numbers below). |
| 7 | Credit | 01 ₹18,000 · 02 ₹4,500 with ₹1,800 due · 03 ₹15,000 · 04 ₹1,500, cash above it · 05 ₹5,000 · 06 ₹12,000, asking for ₹18,000 · 07 ₹75,000 with ₹16,500 due · 08 ₹5,000. |
| 8 | Owner names | 01 Vilas Kale · 02 Sadashiv Mane · 03 Imran Shaikh · 04 Balu Waghmare · 05 Kavita Joshi · 06 Prakash Kulkarni · 07 Mahesh Agarwal · 08 Nitin Salunkhe. |
| 9 | Scheme uses | OUT-03 spent all 4 April uses (7, 14 and 21 Apr; 21 pooled cases on 14 Apr). OUT-01 has all 4 left. "One case short" fires at 01 only; at 03 the message is "April cap reached". |
| 10 | 2025 dates (est) | Exams 15–30 Apr; school shut 1 May – 15 Jun 2025, reopened 16 Jun; Diwali break 16 Oct – 5 Nov. 2026: shut 1 May – 14 Jun, reopens 15 Jun. |
| 11 | OUT-06 bookings | 14 events, 29 Apr – 16 May 2026, 55 cases, stored in `outlets[].bookings` (each `est`). No new file. |
| 12 | OUT-05 mix | Water 500 ml 50%, water 1 L 20%, mango Tetra 30%. The range follows the school's rules; FSSAI's 2020 school-food regulations restrict foods high in fat, sugar or salt, which rules out sugary sparkling drinks (mango drinks are sugar-sweetened too, so kept small). Season Check never suggests sparkling drinks at outlets tagged `school`. |
| 13 | Script | `scripts/generate_data.py` writes all data files; the sheets are redrawn from its output. |

## Key numbers (from the data)

<!-- numbers:start -->
| Outlet | 2025 cases by month (order date) | Jan–Apr 2026 (to 26 Apr) | Peak month | Peak ÷ Jan–Feb | Winter order | Peak-month order | Today's order should cover |
|---|---|---|---|---|---|---|---|
| OUT-01 | 30 32 39 85 50 32 26 25 32 34 35 31 | 27 35 67 56 | Apr | 2.7× | 7.6 cases, ₹4,028 | 17.0 cases, ₹9,394 | 19.7 cases, ₹10,777, to 2026-05-05 |
| OUT-02 | 6 6 7 9 8 3 5 5 8 6 6 6 | 6 6 10 4 | Apr | 1.5× | 3.0 cases, ₹2,121 | 3.0 cases, ₹2,001 | 4.6 cases, ₹2,985, to 2026-05-12 |
| OUT-03 | 27 33 60 94 55 26 27 27 30 28 30 35 | 28 38 76 82 | Apr | 3.1× | 7.3 cases, ₹3,213 | 18.8 cases, ₹8,077 | 24.4 cases, ₹10,508, to 2026-05-05 |
| OUT-04 | 2 2 3 10 4 2 2 2 2 2 2 2 | 2 3 7 0 | Apr | 5.0× | 2.0 cases, ₹668 | 5.0 cases, ₹1,650 | 7.3 cases, ₹2,536, to 2026-05-26 |
| OUT-05 | 13 12 12 10 0 3 10 10 13 2 13 13 | 13 14 11 8 | Jan | 1.0× | 4.2 cases, ₹1,021 | 4.3 cases, ₹1,077 | 0.6 cases, ₹135, to 2026-05-08 |
| OUT-06 | 32 38 21 41 36 10 4 6 12 23 39 42 | 39 32 26 35 | Dec | 1.2× | 11.7 cases, ₹5,794 | 14.0 cases, ₹6,977 | 29 cases, ₹14,520 (8 events), to 2026-05-08 |
| OUT-07 | 109 138 210 222 143 113 106 108 153 127 121 131 | 128 122 271 141 | Apr | 1.8× | 32.3 cases, ₹20,414 | 44.4 cases, ₹28,073 | 53.9 cases, ₹33,900, to 2026-05-05 |
| OUT-08 | no history (registered 2026-04-22) | — | — | — | — | — | first order; peers ≈ 4.9 cases a fortnight (est.) |
<!-- numbers:end -->

## The eight personas

Each persona is a **type** of outlet. The shop in our data is only its example. Tags: G = cause in research Table G (why demand goes unmet); § = Industry_Context.

| # | Type | Also covers | Season driver · normal-year peak (Table D) | Example in our data (order date) | Confidence |
|---|---|---|---|---|---|
| 01 · **primary** | **Flagship Kirana** · helps most. Busy main-road kiranas (₹3–10 lakh a month), company cooler, top tier, weekly. | Self-service mini-marts | Heat · ≈ 2.5–3.0× | Mauli General Stores: 2025 peak April, 2.7× Jan–Feb; 0 of 4 April scheme uses taken | High |
| 02 | **Cautious Kirana** · handle with care. Small lane kiranas, no cooler, low tier, take-home bottles, tight cash. | Kiranas under ₹1 lakh a month | Heat, muted · ≈ 1.6–2.0× | Samarth Kirana: 2025 peak April, 1.5×; ₹1,800 overdue, ₹2,700 room | High |
| 03 · **primary** | **Cold-Drink Shop** · helps most. Chilled-first impulse shops near colleges, offices, transit. | Juice shops | Heat, steepest · ≈ 3.5–4.5× | Thanda Corner: 2025 peak April, 3.1×; 4 of 4 April uses gone | Medium |
| 04 | **Lakeside Snack Stall** · thin data. Footfall-led stalls; lowest tier; monthly visits; ice box; cash. | Paan/tea stalls; highway dhabas on long weekends | Heat × weekends · ≈ 3–5× on peak weekends | Lakeside Bhel: April is his biggest month (5.0×); biggest order 29 Apr 2025, ≈ 2 weeks after the route's peak week | Medium |
| 05 | **School Canteen** · stays quiet. Season follows an institution's calendar. | College canteens, hostel-belt shops | School calendar · ≈ 1.2× April, ≈ 0 in vacation | Sunrise School Canteen: 0 cases in May 2025; shut 1 May – 14 Jun 2026 | High |
| 06 | **Banquet Hall** · own calendar. Event-led: halls, wedding lawns, caterers. | Cinemas; dhabas in wedding season | Bookings × weather · ≈ 1–3×; no wedding dates 17 May – 15 Jun 2026 | Shubh Mangal: 2025 peak December, 1.2×; 14 bookings ≈ 55 cases (est.) | Medium |
| 07 | **Beverage Wholesaler** · stays quiet. Sells on to other shops, some off the route; big packs; deals. | Sub-stockists, market traders | Deals and month-end targets · ≈ 2–3×, front-loaded | Mahalaxmi: loads up at every month-end; biggest order 25 Mar 2025 (102 cases, financial year-end); no separate Diwali load | Medium |
| 08 | **New Owner** · thin data. Any outlet with no usable history. | New and re-coded outlets | Unknown; ≈ 1.6× from similar shops (est.) | Ashirwad General Store: registered 22 Apr 2026; no orders yet | Medium |

**General concerns (each tied to a cause):**
- 01: stocking up in time, since orders follow last week (G2); clear scheme terms (G9); best seller short at the distributor (G3); cooler space and buyers lost to the shop opposite (G1).
- 02: won't load up after leftovers (G7); cash, credit and dues (G4); 250 ml buyers go to shops with coolers (G1); trust in the rep's numbers (§3).
- 03: keeping drinks cold through power cuts (G1); running out before the next visit (G2); peak packs rationed (G3); scheme uses gone early (G9).
- 04: runs out between visits (G5); peak order above the limit (G4); ice box only (G1); restocks at the wholesale market (§1).
- 05: leftovers through the closure (G7); range limited by school rules (G6); restocking before reopening and wasted visits (G5).
- 06: stock a day before each event (G5); credit too small for peak weeks (G4); heat-based advice and last-minute gaps (G2).
- 07: best rate (G8); fast booking (G10); stock limits up front (G3); deals honoured, large credit with dues (G4).
- 08: no numbers (G2); fear of over-ordering (G7); doesn't know the schemes (G9); trust still to build (§3).

**Season Check on each sheet** (rules v1.1):
- 01 fires forward baseline, pace gap, missing regular, threshold, distributor short.
- 02 fires credit headroom, safe cap, no cooler, not eligible; it's often silent.
- 03 fires cooler cap, distributor short, threshold (uses gone), pace gap.
- 04 fires thin history, event ahead, credit headroom, cooler cap (ice box).
- 05 fires closing soon, which is first in rule order.
- 06 fires event ahead (bookings), missing regular, larger than usual (legitimate), credit headroom.
- 07 stays silent.
- 08 fires thin history (from peers.json), no cooler, not eligible.

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

## Persona settings (copied from the top of `scripts/generate_data.py`)

<!-- settings:start -->
| Outlet | Base cases/week (Jan 2025) | Channel peak | Timing | Cadence | Mix (% of cases) | Story the history shows |
|---|---|---|---|---|---|---|
| OUT-01 | 7.2 | 2.7 | reactive in 2025 (lag 10 days, waits for scheme terms); planner in 2026 | 7 d | CL250 22, LL250 8, CL200G 8, MG150T 8, MG600 6, WT1000 8, CL750 12, CL2250 18, OR1250 10 | No 250 ml cola in 2025-W16 (distributor out); 2026 runs ahead of 2025 |
| OUT-02 | 1.4 | 1.6 | reactive (lag 14 days); capped at ₹2,700 of credit room | 14 d | CL2250 35, OR1250 25, CL750 15, CL250 15, MG150T 10 | Unplanned 5-case order on 19 May 2025, a week before the rain; June dip |
| OUT-03 | 6.7 | 3.8 | planner | 7 d | CL250 25, LL250 10, OR250 8, CL300C 12, EN250 12, CL200G 10, MG150T 8, WT500 10, WT1000 5 | Cold-pack dip in the power-cut week 2025-W18; all 4 April 2026 scheme uses spent |
| OUT-04 | 0.5 | 3.5 | reactive (lag 28 days); carries at most 9 cases; cash above his limit | 28 d | CL250 35, WT500 25, WT1000 15, MG150T 15, LL250 10 | Single-digit monthly orders that trail demand; the rest bought at the wholesale market |
| OUT-05 | 2.7 | 1.2 | calendar (term, exams ×0.6, closures ×0) | 10 d | WT500 50, WT1000 20, MG150T 30 | Zero orders while the school is shut; smaller orders in exam weeks |
| OUT-06 | 8.4 | bookings | bookings (monthly wedding index × a small heat effect) | 10 d | CL2250 30, OR1250 20, WT1000 20, CL200G 15, CL250 15 | December peak, monsoon lull; 14 bookings 29 Apr – 16 May 2026, then the adhik month |
| OUT-07 | 27.7 | 2.0 | front-loaded (buys 14 days ahead); month-end loads | 7 d | CL2250 40, OR1250 20, CL750 15, WT1000 15, CL250 10 | Month-end loads every month; the biggest at the financial year-end (25 Mar 2025, 102 cases) |
| OUT-08 | — | 1.8 | new: no orders before the demo date; estimate from peers.json | 14 d | CL2250 35, OR1250 20, CL750 15, CL250 15, MG150T 15 | Registered 22 Apr 2026; no orders and no visits yet |
<!-- settings:end -->

## Scope and why these eight

**Scope.** General-trade outlets on one Pune West route, in the summer season, for one decision: how much to order today. The rep uses the app; these are the outlets he serves. **Primary: 01 and 03**, where the value is. The other six are cases the feature must handle without doing harm.

**How we chose them.**
1. **Define** what the brief asks for: span channels, tiers, cold chain, places and owners, and cover where the feature helps, where it stays quiet, and where data is thin.
2. **List** 15 outlet types from Industry_Context §3 and Table D.
3. **Merge** look-alikes.
4. **Check** that every Season Check rule fires somewhere and stays silent somewhere.

**Not covered:** modern trade and chains; quick-commerce dark stores; key accounts served by a key-account team; outlets that buy only from a wholesaler.

**Considered, folded in:** self-service mini-mart → 01; paan or tea stall → 04; cinema → 06; highway dhaba → 04 + 06.

## Data contract: what changed (tell the base-app chat)

The contract is otherwise as in PROGRESS.md → "Shared · Data contract".

1. **`peers.json` is required**, not optional. Groups: `kirana|Bronze|no-cooler` (14 outlets, for OUT-08) and `leisure|Iron|ice-box` (6 outlets, for OUT-04). The weekly cases cover 2026-W18 to W20; W19–W20 assume a normal year's peak (index 2.8), not a forecast.
2. **OUT-08** has no orders and an empty `visits` list. `history.json` holds `"OUT-08": {}`, and `registeredOn` is `2026-04-22`.
3. **Scheme rules** (additive fields; the app's current logic already matches the first):
   - `schemes[SCH-SS26].rule.usesCountedBy = "order-date-calendar-month"`;
   - `rule.freeCasesCountAgainstRation = false`;
   - `distributor_stock` CL250 carries `"rationAppliesTo": "paid-cases"`.

   When the feature enforces the 6-case ration, it must count paid cases only.
4. **`history.json` counts paid cases** (free scheme cases are not included).
5. **Extra fields**, all optional to read:
   - `outlets[].closures[].est` and `outlets[].bookings[].est`;
   - `calendar.events[].anchor: true` marks 2025 events used to build history;
   - `calendar.schools[*].examsFrom`;
   - `visits[].planned: false` appears once: OUT-02's unplanned order on 2025-05-19.
6. **Values the app now shows:**
   - `credit.paymentMode` is `credit` or `cash-and-credit` (04, 07);
   - the ice box is `count: 1, litres: 40`;
   - route order is unchanged from the stub.
7. **Season Check:** never suggest sparkling drinks at outlets tagged `school`.

## Needs a decision

Nothing here changes Shared · Decisions or the data contract. One data point conflicts with the corrected story:

- **OUT-07's visit note on 28 Oct 2025** (`data/visits.json`) still says "Diwali month-end load". In the data, the October load (57 cases) is no bigger than September's (60) or November's (53). The sheet now says "loads up at every month-end; no separate Diwali load". Options:
  - (a) reword the note to "Month-end load: big packs only";
  - (b) give October's load a real bump in the generator.

  Recommendation: (a). It's a one-line change in `notes_for()` in `scripts/generate_data.py`, and it changes only that note.

## Still to do

- `docs/validation/` charts (one per persona, plus an overview): matplotlib isn't installed here. Install it, or draw them another way.
- `docs/test-matrix.md` skeleton: personas × the brief's cart types. Known cells: "one case short" at 01; "April cap reached" at 03; "over credit headroom" at 02, 04 (cash) and 06.
- `docs/research.md`: the research facts used, with sources and confidence.
- Rebuild `gt-app.html` (`python3 scripts/build_single.py`) so the single-file version carries the real data.
