# Season Check prototype dataset

Synthetic field data for a soft-drinks bottler's general-trade territory, built to run the
Season Check feature inside a basic GT App flow.

**Demo date:** Tuesday 28 April 2026 (a peak week).
**Territory:** Pune West — Kothrud, Warje, Bavdhan, Pashan.
**Rep:** Rohit Jagtap, pre-seller. Distributor delivers next day.
**Scale:** 240 outlets, 60 SKUs, 12,324 orders, 42,527 order lines, 1 Jan 2024 to 27 Apr 2026.

Every outlet, owner, brand and number is fictional. **240 outlets and 60 SKUs are our own
synthetic scope, not figures supplied by the brief.** The brief's own material describes a rep
covering 20 to 40 outlets a day carrying 200 to 400 SKUs across categories, and its sample
extract is 35 outlets with a partial SKU list.

Reproduce with `python3 scripts/gen_1_master.py && gen_2_calendar.py && gen_3_orders.py && gen_4_validate.py`.
Seed 20260428. `SWING_SCALE=0.52` is the tuned seasonal amplitude.

---

## Load order

The app never needs the full archive to run a visit. Load the small files plus the three
route-scoped ones, and fetch the archive only if someone opens a non-route outlet.

| Load | File | Size |
|---|---|---|
| on start | `demo_config.json`, `skus.json`, `schemes.json`, `distributor_stock.json`, `credit.json`, `peers.json`, `events.json`, `outlets.json` | ~320 KB |
| on start | `orders_route.json`, `visits_route.json`, `current_stock_route.json` | ~825 KB |
| on start | `orders_index.json` — monthly and weekly aggregates for the 12-month strip | 2.1 MB |
| on demand | `orders_history.json`, `visits.json`, `current_stock.json` — every outlet | 6.2 MB |

Roughly 538 KB gzipped for everything. Static hosts gzip by default.

---

## Files

### `outlets.json`
240 outlets. Each carries `channel`, `shopType`, `area`, `tier`, `visitsPerMonth`,
`visitCadenceDays`, `cooler` (count, litres, owner, **`coolerSlots`** = how many cases of
250 ml PET fit chilled), `glassCratesHeld`, `registeredOn`, `onTodaysRoute`, `routeSequence`,
`carryLimitCases`, `paysCashAboveLimit`, and:

- `persona` — `{id, label, role, group}`. Every outlet is typed, not just the eight demo ones,
  so the panel can open any outlet and get correct behaviour.
- `model` — the generator's settings, kept in the file so the seasonal shape is auditable:
  `baseCasesPerWeekJan2024`, `channelPeakMultiplier`, `timing`, `seasonDriver`,
  `skuMixPct` (sparse: mean 5.5 SKUs of 60), `structuralDecline`, `singleServeBias`.

`timing` is what produces early and late loaders: `planner` sizes the order for the window
**ahead** of the visit; `reactive-7/10/14/21` sizes it from a window that many days **behind**.
`OUT-01` is `reactive-then-planner`: it loaded late in 2024 and 2025, and plans ahead in 2026.

`seasonDriver` is `heat`, `calendar` (institutions), `bookings` (events) or `trade` (wholesale).

### `skus.json`
60 SKUs across sparkling, juice drinks, water, energy, sports, iced tea and dairy.
`ptrPerCase = mrp x unitsPerCase x (1 - margin)`, which reconciles for every row.
`coolerSlotsPerCase` drives the cooler guardrail. `isFocusSku` marks CL250, CL200G, MG150T, WT1000.

### `orders_history.json` / `orders_route.json`
Order and line level. Compact keys, documented in the file's own `keys` block:
`i` orderId, `o` outletId, `d` orderDate, `dd` deliveryDate, `l` lines, `c` totalCasesBooked,
`fc` totalFreeCases, `t` orderValue, `pm` paymentMode, `sc` schemesApplied, `bl` blockedLines,
`me` monthEndLoad. Lines: `s` sku, `b` casesBooked, `dl` casesDelivered, `f` freeCases,
`dp` discountPct, `p` ptrPerCase, `v` lineValue.

`b` and `dl` differ where the distributor short-filled, which is what makes the peak-month
fill rate dip to 92% against 98% off-season. `bl` records volume the rep could not book at all.

**There is no order dated 28 April 2026.** Today's order is the one the rep is about to place.

### `orders_index.json`
Derived aggregates so the app does not re-aggregate 12,324 orders on load.
`monthlyByOutletSku` covers the full catalogue; `weeklyByOutletSku` covers the focus SKUs only,
which is what the forward baseline needs. Nothing here is a recommendation.

### `current_stock.json` / `current_stock_route.json`
Estimated cases on hand per outlet and SKU on the demo date.
`estimatedCasesOnHand = lastDeliveredCases - modelled sales since delivery`, with `confidence`
high, medium or low by how stale the last delivery is. Where `repCountedCases` is present the
rep counted the shelf and that overrides the estimate. **Estimated, never measured** — this is
the field the two-tap rep count corrects.

### `visits.json` / `visits_route.json`
Rolling 400 days of planned versus completed visits, check-in time, duration and outcome
(`order`, `no-order`, `due-today`). `nextPlannedVisit` per outlet feeds the cover window.
A few visits carry a note, including outlets where the rep could not book because the
distributor was out.

### `credit.json`
`creditLimit`, `outstanding`, `overdue`, `overdueDays`, `lastPaymentDate`, `headroom`,
`creditDays`, `paymentMode`, `paysCashAboveLimit`, `requestedLimit`.

Assumption recorded in the file: **the rep may book beyond the credit limit.** Credit is
advisory in the GT App, not a hard block. Season Check warns and shows headroom; it does not cap.

### `schemes.json`
Thirteen schemes across 2024, 2025 and 2026, including the two prior-year summer schemes so the
history is coherent. Each carries `applicableSkus`, `thresholdCases`, `thresholdBasis`,
`eligibleTiers`, `maxTriggersPerOutletPerMonth`, `validFrom/To` and `settlement`.

Assumption recorded in the file: **`applicationMode` is `informational` on every scheme.**
Thresholds and benefits are settled later by the distributor, not applied at booking. Season
Check therefore shows an estimated benefit and names who settles it.

### `events.json`
Dated, scoped events. `scope: territory` scales the whole route (monsoon onset per year,
heatwave spells, festivals, the 1 to 3 May 2026 long weekend, IPL evenings).
`scope: persona` covers institution calendars (school closures and exam ramps, college
closures, the 17 May to 15 Jun 2026 adhik month with no wedding dates, cinema release weekends).
`scope: outlet` covers the booking calendar and power-cut windows.

`OUT-06` has 14 wedding bookings from 29 Apr to 16 May 2026 needing 55 cases, of which
8 events needing 29 cases fall before its next visit on 8 May.

### `distributor_stock.json`
Morning sync on the demo date, plus historical constraint windows for 2024, 2025 and 2026.

Assumption recorded in the file: **stock syncs every morning; reliable for in-stock versus
out-of-stock, not for quantity.** Season Check never presents it as guaranteed.

On the demo date: **CL250 rationed to 6 paid cases per outlet** (free scheme cases exempt),
**MG600 out of stock**, **CL200G released only against empties returned**, WT500 and EN300C low.

### `peers.json`
Peer groups by channel, cold chain and tier band, with p25, median and p75 cases a week now.
Minimum group size 8. For thin-history outlets. Retailer-facing copy quotes a range, never a shop name.

### `demo_config.json`
Demo date, rep, distributor, focus SKUs, and the Season Check parameters: the cover-window
formula, the forward-baseline formula, the rule order
(`closure -> de-load -> distributor -> cooler -> credit -> safe-cap -> forward-baseline`),
every guardrail threshold, and what Reset demo clears.

---

## Nothing is precomputed

No recommendation, days-of-cover figure, shortfall, scheme nudge or guardrail message is stored
anywhere in this dataset. Each one is computed at run time from these files plus the live cart.
The formulas live in `demo_config.json` so the app and the deck cannot drift apart.

---

## Acceptance-criteria coverage

`docs/validation.json -> scenarios` lists, by outlet id, which outlets demonstrate each case.
All are live on the demo date:

| Case | Where |
|---|---|
| Normal recommendation | 8 route outlets in the helps-most group |
| Large cart, safe cap | any outlet; the cap is days-of-cover based |
| Small cart, shortfall | any outlet |
| Just short of a scheme threshold | OUT-01 has all 4 April uses left |
| Monthly scheme cap already spent | OUT-03 spent all 4 in April |
| Scheme-ineligible outlet | 12 Bronze and Iron outlets on the route |
| Distributor rationed | CL250, every outlet |
| Distributor out of stock | MG600, every outlet |
| Glass against empties | 12 route outlets holding crates |
| Closure inside the window | 7 Education outlets |
| Event-driven | 3 route outlets on the bookings driver |
| Structural decline | 13 outlets |
| No cold chain | 13 route outlets |
| Cooler cap | 10 route outlets with 5 slots or fewer |
| Credit warning | 6 route outlets carrying an overdue |
| Thin history | 9 outlets registered within 90 days, including OUT-08 with no orders at all |
| Wholesale excluded from sizing | 4 wholesale outlets |

## Validation

`docs/validation.json` holds 34 automated checks, all passing: internal coherence (case totals
match lines, delivered never exceeds booked, values match lines, every price reconciles with MRP
and margin, histories stay sparse, realised value per case lands at Rs 548), seasonal realism
(single-serve share rises from 47% in January to 60% in May, peak-month fill rate dips, 2026 runs
ahead of 2025, focus-SKU reach rises into the peak and still leaves a gap), persona coherence
(OUT-08 has no history, OUT-01 has its scheme uses left, OUT-03 has spent its), and scenario coverage.
