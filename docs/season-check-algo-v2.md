# Season Check · demand algorithm v2

> **Status:** built on the earlier 8-outlet data; **re-run and wired into the app on the Season Check dataset (240 outlets, seed 20260428) on Mon 28 Sep 2026.** §6 and §7 now show the results on that data.
> **Code:** `js/feature/season-engine.js` (plain ES module, no DOM, safe for `scripts/build_single.py`). One app addition, marked `APP:` in the code: stock on hand is netted off the order (§3.6, gate 0).
> **Screens:** `js/feature/season-check.js` (§9).
> **Tests:** `node test/season-engine.test.mjs` (17 checks, all passing; add `--verbose` for every message, `--heatwave` for the 43°C what-if). `node test/persona-cart-matrix.mjs` prints §7.
> **Data contract:** as in PROGRESS.md, plus `current_stock.json`. The season inputs the engine was built on (forecast, region index, phases, pack season multipliers, cooler capacity) are in `data-source/season-inputs.json` and replace the figures earlier derived from the dataset's weather events. The Pune normals and recent weekly temperatures live in `PARAMS`, with their sources.
> **Units:** the paper's heat effect is **per °F** (US data). Our temperatures are °C, so the engine uses 2.1% × 1.8 = **3.78% per °C** (1 °C = 1.8 °F).

---

## 0. What changed from the previous version

| Previous | Now | Why |
|---|---|---|
| Baseline × Level × Week × Trend | **Last 4 weeks' rate × season ratio** (the rules v1.1 forward baseline) | Matches the data within ±11% for the shops with their own history, exactly for the school and the banquet hall, and +8% / +21% for the two estimate-based shops (§6). Four unsourced terms become one observed rate |
| The whole shop's base used as one pack (e.g. "26.7 cases of CL250") | **Per pack**, from `history.json` | OUT-03 sells about 7 cases of CL250 a week, not 27. "21 cases leaked" became about 1 case, which is swapped |
| Examples used a 43°C heat wave | **Forecast from `calendar.json`** (29 Apr–4 May: 38–40°C, no rain) | The demo must run on our data. 43°C is now a labelled what-if (`opts.whatIf`) |
| Level read today's apparent temperature | **Dropped.** Heat = departure from normal (dry bulb) only, relative to the recent weeks | Level double-counted a hot day. There's no humidity in our data |
| Trend +0.21%/yr | **Dropped** | The paper's 0.21% is warming, already inside the temperatures. The recent rate carries this year's growth |
| 2.1% read as per °C | **2.1% per °F = 3.78% per °C** | The paper uses US data in °F; our temperatures are °C (1 °C = 1.8 °F) |
| Cold waves 0.3%/°C | **0.4% per °F = 0.72% per °C** | The paper's figure, converted the same way |
| Heat wave = +4.5°C | **IMD rule:** max ≥ 40°C and ≥ 4.5°C above normal (severe > 6.4), or max ≥ 45°C | A single forecast shows "heat-wave conditions", not an IMD declaration |
| Cooler: "free slots", one pack at a time | **All cold single-serve packs** vs cooler capacity × days × 0.25 turns a day | A normal peak order fits; a doubled one doesn't |
| No credit gate | **Credit gate** (rules v1.1 order) | OUT-02's order must stay within ₹2,700 |
| Cover = cadence + 1 day | **Delivery → next delivery** (7 / 10 / 14 / 28 days) | Same window the data uses |
| Exposure slopes normalised over 5 examples; one row wrong (0.9%) | **Normalised over the real volume mix** | Volume-weighted mean slope = 3.78% per °C (2.1% per °F) exactly |

---

## 1. In one paragraph

For each pack, Season Check takes what the outlet sold over the last 4 weeks and projects it over the days today's order must last (delivery to the next delivery). That projection is adjusted by:
- how the season moves in those days (the region index, scaled to this outlet's own swing);
- how much hotter than normal the forecast is (the paper's +2.1% per °F, which is 3.78% per °C);
- rain;
- dated local events.

Outlets that don't fit this get their own mode:

| Mode | Outlets | How the need is worked out |
|---|---|---|
| closing | School canteen | Selling days only |
| bookings | Banquet hall | The booked events |
| peers | Stall, new owner (thin history) | Similar shops nearby, labelled as an estimate |
| silent | Wholesaler | No advice |

The suggestion then passes the gates in rules v1.1 order: closure → de-load → distributor → cooler → credit → safe cap. Whatever the gates remove is the leak. The live cart is compared with the result, and the rep sees only what needs a word.

---

## 2. Inputs (all read through `js/data.js`)

| File | Fields used |
|---|---|
| `config.json` | `demoDate`, `distributor.deliveryLeadDays`, `focusSkus`, `assumptions.coolerCases250ByLitres`, `assumptions.iceBoxCases250` |
| `outlets.json` | `channel`, `tier`, `tags`, `registeredOn`, `cooler` (type, count, litres), `credit` (limit, outstanding, paymentMode), `closures`, `bookings` |
| `visits.json` | `nextVisitAfterToday`, `cadenceDays` |
| `history.json` | Weekly paid cases per pack (the rate and the outlet's 2025 swing) |
| `orders.json` + demo orders | Last orders (missing regular, safe cap), scheme uses (via `schemes.js`) |
| `current_stock.json` | **App addition:** estimated cases on hand per pack (the rep's count where there is one), netted off the order |
| `products.json` | `ptrPerCase`, `unitsPerCase`, `litresPerCase`, `chilled`, `singleServe`, `category`, `summerMultiplier` |
| `schemes.json` | Through `schemes.price()` and `schemes.eligibility()`, so the engine never disagrees with the cart's pricing |
| `distributor_stock.json` | `status`, `maxCasesPerOutlet` |
| `calendar.json` | `regionIndex`, `phases`, `forecast`, `events` (non-anchor) |
| `peers.json` | Group weekly cases by pack (thin-history outlets). On the Season Check dataset: its 8 groups, with the group median split by the members' pack mix, plus a **derived** group for route outlets whose channel has none (OUT-04: 42 snack stalls, last 4 complete weeks) |

---

## 3. The algorithm, step by step

### 3.1 Window
- `delivery = today + lead` (29 Apr).
- `nextDelivery = nextVisitAfterToday + lead`.
- Cover days = `delivery … nextDelivery − 1`. This gives 29 Apr – 5 May for weekly outlets, and 29 Apr – 8 May for OUT-06 (so the 8 May booking counts).

### 3.2 Mode (checked in this order)
1. Wholesale channel → **silent**.
2. Has bookings → **bookings**.
3. A closure falls inside the window → **closing**.
4. Under 90 days old, or fewer than 3 in-season orders, and a matching peer group exists → **peers**.
5. Otherwise → **forward**.

### 3.3 Forward mode (also used by closing and silent), per pack `s` and selling day `d`
```
rate(s)     = cases of s in the last 4 complete weeks (history.json) ÷ 28
season      = mean over cover days of m(I) ÷ mean over the 4 weeks of m(I),   m(I) = 1 + k·(I − 1)
              I = calendar.regionIndex for the week; after the demo week (no index, no hindsight), hold the last known week
k           = (L_outlet − 1) ÷ (L_region − 1),  L = best 4-week average in 2025 ÷ Jan–Feb 2025 average  (clamped 0.2–2.0)
heat(s,d)   = h(a_forecast(d)) ÷ h(a_recent),   h(a) = 1 + slope·max(0, a) − 0.0072·max(0, −a)
              a = forecast max − Pune normal max for the date (dry bulb). a_recent = the same for the 4 rate weeks
slope(o,s)  = 0.0378 × √(E ÷ Ē),  E = (L_outlet − 1) × σ(s),  σ(s) from products.summerMultiplier   (clamped 0.9–7.2%/°C)
              0.0378 = the paper's 0.021 per °F × 1.8, and 0.0072 = its 0.004 per °F × 1.8 (all temperatures here are °C)
              Ē is set so the volume-weighted mean slope over all outlets × packs = 3.78%/°C (the paper's 2.1%/°F)
rain(d)     = 1.0 (none/low) · 0.85 (moderate) · 0.6 (high)
events(s,d) = product of calendar event multipliers active on d for this outlet (channel AND tag) and pack,
              ÷ their average over the 4 rate weeks. The rate already contains the recent events (IPL; the 12–19 Apr heat spell)
Expected(s) = Σ over selling days d of  rate(s) × season × heat(s,d) × rain(d) × events(s,d)
```

### 3.4 Special modes

| Mode | Base | Notes |
|---|---|---|
| **closing** (OUT-05) | Forward, but only the selling days before the closure | 2 of 10 days on 28 Apr |
| **bookings** (OUT-06) | Σ `expectedCases` of bookings dated inside the window, split by the outlet's 12-week pack mix | No heat or season factor: the bookings are the demand |
| **peers** (OUT-04, OUT-08) | The peer group's weekly cases per pack for each week in the window (holds the last week past W20) × heat vs normal × rain × *location* events only (tag-only events, e.g. the 1–3 May long weekend) | Peer rates are already season-level estimates. **New outlet** (< 90 days, no orders): start at 80% of the estimate and top up at the next visit |
| **silent** (OUT-07) | Computed for analysis, `display: false` | Month-end loads distort it. Only stock limits and credit reach the rep |

**School rule:** no sparkling or energy packs are suggested at outlets tagged `school`.

### 3.5 Whole cases
Expected is rounded to whole cases by largest remainder, so the per-pack cases add up to the rounded total.

### 3.6 Gates (rules v1.1 order)

| # | Gate | What it does |
|---|---|---|
| 0 | **On hand** (app addition) | Estimated cases already on the shelf (`current_stock.json`; the rep's count overrides) are taken off each pack before the gates. Reported as `totals.onHand`, not as leak. Off with `PARAMS.netOnHand = false`. Not applied in silent mode |
| 1 | **Closure** | Already applied (selling days only). Reported as `closing-soon` |
| 2 | **De-load** | Decline or monsoon phase, rain moderate or high, or a monsoon signal → × 0.7. Not active on 28 Apr |
| 3 | **Distributor** | `out` → 0. `rationed` → cap at `maxCasesPerOutlet` (paid cases). The shortfall is swapped by servings to the first in-stock substitute (CL250 → CL200G, which keeps Summer Single-Serve → LL250 → CL300C; MG600 → MG150T) |
| 4 | **Cooler** (forward and peers) | 250 ml-equivalents of all cold single-serve packs ≤ capacity × selling days × 0.25. Capacity = 10 cases per 300 L, 5 per 150 L, 1 per ice box. Only the cold packs are trimmed |
| 5 | **Credit** | Credit-only outlets: trim the least important packs (not focus, smallest need) until the net value (after schemes) ≤ limit − outstanding. Cash-and-credit outlets: show the cash part. Bookings: flag it, never cut event stock |
| 6 | **Safe cap** (forward and closing) | Total ≤ 1.5 × the best order in the last 8 weeks |
| 7 | **Already booked today** | Cases in today's demo orders for this outlet are taken off, so a rep who submits and comes back isn't told to order it all again |

**Leak** = suggested − on hand − realisable, after swaps. `leakedBeforeSwaps` is also returned for the deck.

---

## 4. The live cart check: `check(outletId, cart.lines())`

Each finding has a `level`:
- **block:** stops the booking as it stands;
- **warn:** needs attention;
- **nudge:** a suggestion to add or change something;
- **info:** context.

Its `audience` is `both` or `rep` (money: show it behind a lock, like the "For you only" part of the talking points). An `action: { set: { SKU: cases } }` applies with `cart.set()`.

| Order | Rule | Fires when | Example message |
|---|---|---|---|
| 1 | `closing-soon` | Closure inside the window | "Closes 1 May – 14 Jun: only 2 selling days before then. About 3 of these cases would sit through the closure." |
| 1 | `school-rules` | Sparkling or energy drinks in the cart at a `school` outlet | "School rules: Cola 250 ml PET shouldn't be sold here." |
| 2 | `deload` | Rain or monsoon inside the window | "Rain or the monsoon is due inside this order's window: order for the next few days only." |
| 3 | `distributor` (block) | Cart above the ration, or the pack is out | "Only 6 cases of Cola 250 ml PET available: move the other 2 to Cola 200 ml returnable glass (2 cases, still counts toward the free case)." |
| 4 | `cooler` | Cold packs > 1.1 × the cooler cap | "More cold packs than the cooler can turn before Tue 5 May: about 17 cases of 250 ml fit this window, the cart has about 38." |
| 4 | `no-cooler` (info) | No cooler and ≥ 2 cold cases | "No cooler here: cold packs sell warm, so keep them small and lead with take-home bottles." |
| 5 | `credit` (rep) | Net value > credit room | "₹1,712 over credit room: limit ₹4,500 − dues ₹1,800 = ₹2,700. Collect dues, trim the order, or ask for a higher limit." |
| 6 | `larger-than-usual` (rep) | Cart > 1.5 × expected | "Larger than usual: 40 cases against about 19 expected to Tue 5 May. Check before submitting." |
| 7 | `suggested-order` | Empty cart | "Suggested order: 19 cases to last until Tue 5 May." (action: fill the cart) |
| 7 | `pace-gap` | A pack is ≥ 1 case and ≥ 15% below its suggestion (focus packs first, max 3; not cold packs at no-cooler outlets) | "Add 2 × Cola 250 ml PET: expected to sell about 4 by Tue 5 May." |
| 8 | `missing-regular` | In ≥ 3 of the last 4 orders but not in the cart (max 2) | "Lemon-lime 250 ml PET is missing: it was in 4 of the last 4 orders." |
| 9 | `threshold` | 1–2 cases short of a scheme the outlet can get; names only packs that can be supplied | "1 more case of Lemon-lime 250 ml PET and Cola 200 ml returnable glass earns a free case (Summer Single-Serve)." |
| 9 | `cap-reached` | This month's uses are gone | "Summer Single-Serve: this month's 4 free cases are used up. Orders from the 1st of next month qualify again." |
| 10 | `not-eligible` (info) | A scheme pack is in the cart but the outlet can't get it | "Summer Single-Serve: Not for Bronze." · "Water Summer: Needs a company cooler." |
| 10 | `first-order` (info) | New Outlet discount applies | "New Outlet Activation: ₹265 off this first order." |
| 11 | `event-ahead` (info) | Empty cart and an event in the window (always for bookings) | "8 bookings before the next delivery need 29 cases (to Fri 8 May)." |
| 12 | `thin-history` (info) | Peers mode | "Estimate from 14 similar shops nearby … Start small and top up on Tue 12 May." |
| — | `ordered-today` (info) | A demo order was already submitted today | "Already booked today: 19 cases. Suggestions show only what's still needed." |
| — | `heat` (info) | Forecast meets the IMD heat-wave thresholds | "Heat-wave conditions forecast (43°C, 5.4°C above normal)." |
| — | **silence** | Wholesale: only `distributor` and `credit` are kept. `silent: true` when nothing above info level remains | — |

---

## 5. PARAMS (every number, with where it comes from)

| Name | Value | Source |
|---|---|---|
| `rateWeeks` | 4 | Rules v1.1 (forward baseline) |
| `heat.paperPerF` | 0.021 per °F | **Paper**: weekly demand +2.1% per °F above normal in a heat wave (US data) |
| `heat.slopeAvg` | 0.0378 per °C | The paper's figure converted: 0.021 × 1.8 |
| `heat.paperColdPerF` | 0.004 per °F | **Paper**: −0.4% per °F below normal in a cold wave |
| `heat.coldSlope` | 0.0072 per °C | The paper's figure converted: 0.004 × 1.8 |
| `heat.slopeClamp` | 0.9–7.2% per °C (0.5–4% per °F) | Assumption |
| `heat.normalMaxC` | 29.8, 32.2, 35.6, 37.9, 37.3, 32.0, 28.3, 27.8, 29.5, 31.5, 30.7, 29.5 | Pune mean daily max 1991–2020 (IMD, via the Wikipedia climate table). **Verify against IMD station normals** |
| `heat.recentMaxC` | W14 37.5 · W15 39.8 · W16 39.5 · W17 39.0 | Research Table A (IMD readings where found, else estimates) |
| `heat.imd` | 40°C and 4.5 / 6.4°C; 45 / 47°C | IMD heat-wave criteria (plains) |
| `rain` | none/low 1.0 · moderate 0.85 · high 0.6 | Assumption |
| `deloadFactor` | 0.7 | Assumption |
| `thin` | < 90 days or < 3 in-season orders | Rules v1.1 |
| `newOutletStart` | 0.8 | Assumption (start small, top up) |
| `coolerTurnsPerDay` | 0.25 | Calibrated: a normal peak order fits, a doubled one doesn't. Research Table F's 0.8–3 turns don't fit our volumes |
| Cooler capacity | 10 / 5 / 2 cases of 250 ml per 300 / 150 / 60 L; ice box 1 | `config.json` assumptions (estimate) |
| `safeCap` | 1.5 × best order in 8 weeks | Rules v1.1 |
| `largerThanUsual` | 1.5 × expected | Rules v1.1 |
| `pace` | ≥ 1 case and ≥ 15% below; max 3 | Assumption |
| `missingRegular` | 3 of the last 4 orders | Rules v1.1 |
| `thresholdWithin` | 2 cases | Rules v1.1 |
| `substitutes` | CL250 → CL200G, LL250, CL300C · MG600 → MG150T | Assumption (CL200G first: it keeps Summer Single-Serve) |
| `netOnHand` | true | **App addition.** Subtract estimated stock on hand (`current_stock.json`) |
| Pack season multiplier (σ) | `products.summerMultiplier` | The engine's values for its 13 packs. The other 47 packs of the 60-pack catalogue: the pack's 2025 swing (best month ÷ Jan–Feb) × the median ratio of the 13; packs too thin to measure take their category's median (`scripts/import_fa_data.py`) |
| Season index, events | `calendar.json` | Research Tables A and C (estimates) |

---

## 6. Results on the demo date (Tue 28 Apr 2026)

On the Season Check dataset. "Typical peak order" is the dataset's own figure (`fa-data/docs/PERSONA_REFRESH.md`: the average order in the 2025 peak months), shown only for scale. The engine never reads it, and it is a per-order figure, not demand over this window. The earlier "data says" yardstick came from the old generator, so it no longer applies.

| Outlet | Mode | Covers to | Expected | 43°C what-if | Typical peak order | On hand | Suggest | Realisable | Binding |
|---|---|---|---|---|---|---|---|---|---|
| OUT-01 | forward | 5 May (7/7 d) | 16.1 | 18.4 (+14%) | 15.2 | 6 | 16 | 10 | on hand |
| OUT-02 | forward | 12 May (14/14 d) | 4.1 | 4.4 (+7%) | 3.9 | 2 | 4 | 2 | on hand (credit room ₹2,700 not reached) |
| OUT-03 | forward | 5 May (7/7 d) | 25.3 | 28.5 (+13%) | 18.8 | 12 | 25 | 13 | on hand; at 43°C also the CL250 ration (swap to CL200G) |
| OUT-04 | peers | 26 May (28/28 d) | 10.3 | 12.5 (+21%) | 4.8 | 1 | 10 | 6 | ice box, then credit (cash above ₹1,500) |
| OUT-05 | closing | 8 May (2/10 d) | 0.5 | 0.5 | 2.9 | 0 | 0 | 0 | closing soon |
| OUT-06 | bookings | 8 May (10/10 d) | 29 | 29 | 16.2 | 4 | 29 | 25 | on hand; credit ₹798 over (flag, not cut) |
| OUT-07 | silent | 5 May | not shown (88.6) | (96.2) | 56.9 | — | — | — | silent |
| OUT-08 | peers | 12 May (14/14 d) | 8.2 | 9.3 (+13%) | — | 0 | 8 | 7 | new outlet: start at 80%, top up 12 May |

**What moved compared with the earlier data:**
- **OUT-03** runs above its 2025 typical order. Its last 4 weeks averaged 24.2 cases a week, and 2026 is +16.4% on 2025.
- **OUT-04**'s estimate comes from a derived group of 42 snack stalls, because the dataset has no peer group for its channel.
- **OUT-08** uses the dataset's no-cooler kirana group, whose median is 3.8 cases a week, so the estimate is higher than before.
- **Every shop with stock on the shelf now orders less than it will sell** (the on-hand gate).

**The heat term on the demo date:**
- The forecast is +1.6 to +2°C above normal, and the last 4 weeks were +1.5°C, so heat is neutral for shops with their own history. It isn't a heat-wave week.
- The two estimate-based shops (04, 08) start from normal-year figures, so the +2°C forecast adds a little there.
- **What-if 43°C** (`--heatwave`): the forward shops rise 7–14%, and the estimate-based shops 13–21%. "Heat-wave conditions" is flagged. The volume-weighted mean slope on this data is 3.74% per °C (target 3.78).

**Same season, different shops.** Region lift in 2025 is 2.18×. Each shop's own swing sets k:
- OUT-01: 0.84
- OUT-03: 0.72
- OUT-02: 0.28
- OUT-04: 1.18

A territory-level "summer is 2.7×" still gets them wrong in different directions.

## 7. Persona × cart type (rules that fire)

Generated by `node test/persona-cart-matrix.mjs` on the Season Check dataset. The carts are built from each outlet's **last real order** ("Usual"); OUT-08 has none, so it uses the engine's own suggestion. Definitions:
- **Larger ×2 / Smaller ×½:** the usual order doubled or halved.
- **Missing a regular:** the pack most often ordered in the last 4 orders is dropped.
- **One case short:** one case below the first free-goods scheme the outlet can use.
- **Over cooler:** Cola 200 ml glass added to about twice the cooler cap for the window.
- **Over credit:** scaled to 20% above the credit room.
- **Out at distributor:** 2 cases of MG600 added.
- **Scheme it can't get:** water for Water Summer without a company cooler, or Lemon-lime 250 ml at Bronze or Iron.

| Outlet | Empty | Usual | Larger ×2 | Smaller ×½ | Missing a regular | One case short | Over cooler | Over credit | Out at distributor | Scheme it can't get |
|---|---|---|---|---|---|---|---|---|---|---|
| OUT-01 | suggest · event | stock · pace · short | stock · larger · pace | pace | pace · short | stock · pace · short | stock · cooler · credit · larger · pace · short · cap | stock · cooler · credit · larger · pace · short | stock · pace | stock · pace · short |
| OUT-02 | suggest · event | regular · not-elig | credit · larger · regular · no-cooler · not-elig | regular | pace · regular · not-elig | regular · not-elig | credit · larger · regular · no-cooler · not-elig | regular · not-elig | stock · credit · regular · short · no-cooler · not-elig | credit · larger · regular · not-elig |
| OUT-03 | suggest · event | stock · pace · cap | stock · cooler · credit · larger · pace · cap | pace | pace | stock · pace · cap | stock · cooler · credit · larger · pace · cap | stock · credit · pace · cap | stock · pace · cap | stock · pace · cap |
| OUT-04 | suggest · event · thin | credit · pace · not-elig · thin | cooler · credit · pace · not-elig · thin | pace · not-elig · thin | pace · thin | credit · pace · not-elig · thin | cooler · credit · larger · pace · not-elig · thin | credit · pace · not-elig · thin | stock · cooler · credit · pace · short · not-elig · thin | credit · pace · not-elig · thin |
| OUT-05 | closing | closing | closing | closing | closing | closing · school | closing · school | closing · credit | stock · closing | closing |
| OUT-06 | suggest · event | pace · event | stock · credit · larger · cap · event | pace · event | pace · event | pace · event | credit · larger · pace · cap · event | credit · pace · event | stock · credit · pace · event | pace · event |
| OUT-07 | — | stock | stock · credit | — | stock | stock | stock | stock · credit | stock | stock |
| OUT-08 | suggest · thin | no-cooler · not-elig · first · thin | stock · credit · larger · no-cooler · not-elig · first · thin | pace · no-cooler · not-elig · first · thin | first · thin | no-cooler · not-elig · first · thin | credit · larger · no-cooler · not-elig · first · thin | no-cooler · not-elig · first · thin | stock · credit · no-cooler · not-elig · first · thin | credit · larger · no-cooler · not-elig · first · thin |

The app adds two checks the engine leaves to the screens:
- **Stock cover vs shelf life:** cart plus stock on hand, against the pack's selling rate. It warns above 21 days' cover (`config.seasonCheck.guardrails`) or above the shelf life.
- **Bought together:** at review, the pack most often ordered with this basket at outlets in the same area in the last 12 weeks. It needs at least 20 orders and a 40% share, and must be orderable.

Key:

| Code | Meaning | Code | Meaning |
|---|---|---|---|
| short | one or two cases short of a scheme | cap | this month's cap reached |
| stock | distributor | regular | missing regular |
| event | event ahead | thin | thin history |
| first | New Outlet discount | closing / school | closure ahead / school rules |
| cooler / no-cooler | over the cooler / no cooler here | credit / larger | over credit / larger than usual (rep only) |

---

## 8. Output shape (for the screens)

```js
need(outletId, { whatIf }) → {
  outletId, mode: 'forward'|'closing'|'bookings'|'peers'|'silent', display, newOutlet, peers: { key, outlets } | null,
  cover: { today, delivery, nextVisit, until, days, sellingDays },
  phase, season: { k, regionRecent, regionCover, ratio },
  weather: { maxC, normalC, anomaly, recentAnomaly, heatWave: 'none'|'conditions'|'severe', rain, whatIf },
  events: [{ id, name, from, to, factor, packs }],
  skus: { SKU: { rate /* cases a week */, slope /* % per °C (paper's per-°F figure × 1.8) */, expected, suggested, realisable, gates: [] } },
  totals: { expected, suggested, realisable, value, swapped, leaked, leakedBeforeSwaps },
  swaps: [{ from, to, cases, forCases }],
  gates: [{ rule, … }],            // closing-soon · deload · distributor · cooler · credit · safe-cap · ordered-today
  explain: ['Last 4 weeks: 18.8 cases a week', 'Season: region index 2.6 → 2.7; this outlet ×1.04', 'Forecast 40°C max, +1.6°C vs normal (recent weeks +1.5°C)'],
}
check(outletId, lines, { whatIf }) → {
  need, priced: { net, discount, paidCases, freeCases },
  findings: [{ rule, level: 'block'|'warn'|'nudge'|'info', audience: 'both'|'rep', sku?, text, action?: { set: { SKU: cases } } }],
  silent,
}
```

---

## 9. Wiring it into the app (as built)

`js/feature/season-check.js` calls `need()` and `check()`, and re-runs `check()` on every cart change.

| Slot | What shows |
|---|---|
| `outlet-season` (Outlet details) | "Order about **{totals.realisable}** cases to last until {cover.until}". Below it: the top packs (realisable / suggested), the gates in plain words, and "Why this number" (the `explain` lines, the events, the method, and the **43°C what-if** toggle). For peers, an "estimate" label. For silent, "No suggestion for this outlet". A button starts the order with the suggestion |
| `booking-season` (Order booking) | Cart vs the suggestion (a meter), then the top 3 findings, each tagged Warning, Scheme opportunity or Recommendation, with its action as a button (Swap, Add n, Use suggestion, Trim). `audience: 'rep'` findings sit behind the "For you only" lock |
| `sku-hint` (each SKU row) | "Suggest {realisable} to last until {until}", plus the gates on that pack (distributor limit, cooler, on the shelf, credit, safe cap). A **Suggested** filter chip lists only these packs, and is selected when the cart is empty |
| `review-check` (Order review) | Warnings, scheme opportunities and recommendations, plus a "bought together" idea. The **offer pop-up** ("Don't leave this offer behind") appears once per outlet visit, for a scheme 1–2 cases short |
| `saved-outlook` (after submit) | Next week's outlook: the demand direction, the next visit and the expected cases, likely top packs, stock to watch, the monsoon, and what to prepare |
| `route-badge` (Landing) | "Suggest ~{n}" or "Closing soon" on each route stop |

**Notes:**
- **Text:** the engine returns English text plus a `rule` code. Screen labels are in `js/feature/strings-en.js`. Marathi and Hindi fall back to English until they're translated.
- **Talking points window:** `talking-points.js` now uses `season.coverFor(o)`. OUT-06 counts 8 bookings (29 cases), as the order does.
- **Events:** IPL match days are separate events, so the engine lifts demand only on match days. A display-only season summary (`anchor: true`) is kept for the talking points.
- **Bundler:** `python3 scripts/build_single.py` bundles the engine through the imports from `main.js`.

## 10. What to say when challenged
- "Only three numbers come from the paper: +2.1% per °F in a heat wave (3.8% per °C), −0.4% per °F in a cold wave, and the asymmetry. It's US weekly market data in Fahrenheit, so we convert to Celsius (× 1.8). Using it per shop and pack is our assumption, and every other number is in one PARAMS block with its source."
- "The base is the shop's own last 4 weeks. It isn't a model we invented. On the earlier data it matched the demand the data was built from within ±11%. On the 240-outlet dataset, the forward shops' expected demand sits at or somewhat above their typical 2025 peak order, as 2026 runs 15–16% ahead of 2025."
- "The order is smaller than the demand when the shop still has stock: we subtract the estimated stock on hand, and the rep's shelf count overrides the estimate."
- "Heat is neutral on 28 April because the forecast is only about 1.6°C above normal, as the last 4 weeks were. Turn on the 43°C what-if and the shops with their own history go up 7–14%, the estimate-based ones 13–21%."
- "It knows when to be quiet: the school gets 'order little or nothing', the wholesaler gets no advice, and the new owner gets a labelled estimate with a planned top-up."

## 11. Known limits and next steps
- **Pune normals:** taken from a secondary source. Replace them with IMD station normals when available.
- **Recent temperatures:** partly estimates (Table A).
- **CL250's recent rate** is already capped by the ration in W17, so it understates demand slightly.
- **Peer and generated data are estimates.** The first real test is the bottler's weekly sales by beat.
- **Stock on hand is itself an estimate** (last delivery minus modelled sales). Netting it off makes the order smaller when the estimate is high: the rep's two-tap count fixes that.
- **47 of the 60 packs** have a season multiplier derived from their 2025 swing, not researched.
- **Heat term:** the paper's figure is per °F on US weekly market data. Converting it to °C (× 1.8) is exact; applying it to Pune shops is our assumption. Its per-pack scaling (exposure) is the weakest link. Validate both against real sales before trusting them outside the demo.

## Sources
- Keleş, B., Gómez-Acevedo, P. & Shaikh, N. I. (2018). *The impact of systematic changes in weather on the supply and demand of beverages.* International Journal of Production Economics 195: 186–197. <https://ideas.repec.org/a/eee/proeco/v195y2018icp186-197.html>
- IMD, FAQ on heat waves (criteria). <https://internal.imd.gov.in/section/nhac/dynamic/FAQ_heat_wave.pdf>
- Pune climate table, 1991–2020 (IMD data via Wikipedia). <https://en.wikipedia.org/wiki/Pune>
- Varun Beverages, Q2 CY2025 press release (India volumes −7.1% on unseasonal rain). <https://www.varunbeverages.com/wp-content/uploads/2025/07/4.-PressRelease.pdf>
- Project files: rules v1.1 and research Tables A, C, D, F, G (`02_OUTLET_PERSONAS_CONTEXT.md`), `data/*.json`, `docs/validation/summary.json`.
