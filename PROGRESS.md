# PROGRESS · GT App base (FieldAssist APM take-home)

This file lets a new chat carry on without the earlier conversation. It holds the status, every decision, what changed from the plan, the feature hooks and the checks. After those come the sections from `01_BASE_APP_CONTEXT.md`, copied word for word.

**Status (Sun 27 Sep 2026, round 3):** round 3 added the changes listed below (languages, scheme pages, talking points and more). **Round 2 status:** the base is **built and checked locally on the personas chat's real data**. Round 2 is the change list below. **Hosting:** `index.html` (= `gt-app.html`) with `data/` next to it on GitHub Pages; **not deployed yet**. Offline: double-click `gt-app.html`.

| Stage | What | Status |
|---|---|---|
| 1 | Skeleton, data loading, demo bar, Login, Landing | Done |
| 2 | Outlet list and Outlet details | Done |
| 3 | Order booking, the cart and `schemes.js` | Done |
| 4 | Order review, submit, saved orders, Reset demo | Done |
| 5 | README (run locally, deploy) | Done |
| — | Deploy to GitHub Pages | **Waiting:** needs the GitHub account and repository name |
| — | Swap the stub for the personas chat's `data/` | Done (round 2): `scripts/generate_data.py` output, 16/16 of its checks pass |
| — | Round 2 change list (A1–A7, B, C) | Done, see "Round 2" below |

---

## Decisions taken in this build ("Confirm these first", answered with the proposals)

The interview was skipped: every item below was already proposed in the context file, so the proposal was used. Each one lives in one place and is easy to change.

| # | Item | Used | Where to change it |
|---|---|---|---|
| 1 | Demo date | Tue 28 Apr 2026 | `data/config.json` → `demoDate` |
| 2 | Look | "Field notebook" (tokens exactly as proposed) | `css/styles.css` → `:root` |
| 3 | Stack and hosting | Plain HTML, CSS and JS with ES modules; hash routing; no build step; GitHub Pages | — (account and repository still **open**) |
| 4 | Rep's name | Rohit Jagtap | `data/config.json` → `rep.name` |
| 5 | "Demo persona" tag | Yes: muted, dashed, monospace ("Demo · Persona 01 · Flagship Kirana") on Outlet list rows and Outlet details. Not on route rows. | `js/ui.js` → `personaTag()` |
| 6 | Summer scheme counting | Pooled across CL250, LL250 and CL200G; free case as the largest line; a use = one free case; 4 uses per calendar month | `js/schemes.js` → `price()`; mirrored in `scripts/make_stub.py` |
| 7 | Data | Personas data not delivered → built on a stub | `scripts/make_stub.py` |

## What differs from the plan (tell the personas chat where marked ⚑)

- **The stub has all 8 outlets, not 3**, so every base situation can be tested: the April cap already used (OUT-03: 4 of 4), one use left (OUT-01: 3 of 4), a closure ahead (OUT-05), dues (OUT-02 ₹1,600; OUT-07 ₹14,000), a first order (OUT-08), cooler-only schemes at an outlet with no cooler (OUT-07), and an ice box (OUT-04). Orders cover 2026-W10 to W17 only. Attributes come from the persona table below. Owner names, addresses and notes are placeholders for the personas chat to replace.
- **Extra route `#/saved/<orderId>`**: the confirmation after submit ("Back to route" / "Outlet list" / "View outlet"). Submit uses `location.replace`, so the browser's back button never lands on an empty review.
- **Data contract: unchanged.** ⚑ How the app reads a few fields the contract leaves open:
  - `schemes[].payout` is shown as the offer text for `program` schemes (e.g. PRG-PURITY "₹300 a month if the cooler holds only our drinks at the monthly photo audit"). The contract has no description field.
  - `schemes[].validFrom` / `validTo` may be `null` (= ongoing).
  - `outlets[].owner.name` is shown as "Owner: …" in details when present.
  - `outlets[].bookings` with `date` ≥ demo date appear in an "Upcoming bookings" card.
  - `credit.paymentMode` values `credit`, `cash` and `cash-and-credit` get friendly labels; any other value is shown as is.
  - `cooler.type: "ice-box"` in the stub uses `count: 1, litres: 40, lastAudit: null`.
- **Stacking order (assumption):** free cases first, then percent-off on the scheme's own lines (Mango Push), then New Outlet 12% on what is left. Rupees are rounded to whole numbers at each discount.
- **Counting uses (assumption):** uses in the demo date's calendar month = free cases on the scheme's SKUs, in that outlet's orders (past + demo) whose `schemeIds` include the scheme.
- **Cart events:** `start` (new order for an outlet), `add` (+), `remove` (−), `set` (typed quantity), `clear` (after submit or Reset). The cart lives in memory only: a full page reload empties it, while saved orders survive in localStorage.
- **Small additions inside the base's scope:** Review shows the delivery date (demo date + `distributor.deliveryLeadDays`, "Wed 29 Apr · tomorrow"). Booking shows a one-line note when New Outlet Activation applies, because that scheme has no SKU to hang a chip on. The Landing card says "The prototype shows 8 of the 27 outlets on today's route". "Last visit" in details reads "today" once a demo order is saved there.
- **STUB badge:** the demo bar shows STUB while any data file's `meta.note` starts with "STUB". It disappears when the real files land.
- **Single-file version `gt-app.html`** (added 27 Sep 2026): the whole app in one file, with the data embedded as `<script type="application/json" id="data-<name>">` blocks. It opens with a double-click and no server. It is generated by `scripts/build_single.py`, so rebuild it after any change to `css/`, `js/` or `data/`. Since round 2: hosted it reads `data/*.json`, and the embedded blocks are used only when there is no server (see "Round 2").
- **Navigation goes through `router.go('#/…')`** (`js/app.js`; also `gtApp.router`). In-app links (`<a href="#/…">`) are routed automatically. The router updates the URL when the page may change it, and otherwise keeps the route in memory, so the app still works where a preview blocks URL changes. Feature code should use `router.go()` or plain links, never `location.hash = …`.

## Round 3 (27 Sep 2026): changes requested after reviewing the app

> Some of these were on the context file's "Do not build in the base" list: suggested quantities, Marathi and Hindi labels, and a pre-visit brief. You asked for them explicitly, so they are built. The talking points are the start of the feature; they sit in the feature slots.

| # | Request | What was built | Where |
|---|---|---|---|
| 1 | The rep's name must come from the username; don't hardcode "Rohit" | The signed-in username is the rep's name everywhere, formatted as a display name (`sachin.patil` → "Sachin Patil"). Landing shows "Hi, Sachin". Login no longer shows `config.rep.name`, which is now unused by the UI. | `js/app.js` `session.name()`, `js/screens/home.js`, `login.js` |
| 2 | Remove "Pays by · Credit (udhaar)" | Removed from the Payment card. | `js/screens/outlet.js` |
| 3 | "Applicable" instead of "Applies"; tapping a scheme opens a detail page | Scheme rows link to `#/scheme/<schemeId>/<outletId>`. The page shows: status at the outlet, the offer, type, validity with days left, who can get it, monthly limit and uses this month, which product the free case is given as, how it's paid, extras, products with rates, the cooler audit (programs), and the orders that used it. The bottom button is "Book with this scheme" or "Back to outlet". | `js/screens/scheme.js`, route in `js/main.js` |
| 4 | Enrolled and Applicable must look different | Enrolled: solid green pill with a check, on a green-edged, green-tinted row. Applicable: light blue tag pill, blue edge. Used up this month: grey "4 of 4 used". Not applicable: dashed, with the reason. A one-line legend sits under the list. | `schemePill()` in `js/ui.js`, `schemes.statusFor()` |
| 5 | Make Cooler collapsible | Collapsed by default. The summary row still shows the cooler type and flags a failed audit, a warm cooler or power cuts. | `js/screens/outlet.js` |
| 6 | Google Maps navigation to the outlet | "Directions" button in the outlet header: Google Maps, two-wheeler mode, destination = address + city + state. It uses `outlets[].geo {lat,lng}` when the data has it (it doesn't yet ⚑). | `directionsUrl()` in `js/screens/outlet.js` |
| 7 | Tapping "Buy 10, get 1 free · mix" adds 10; same for the other schemes | Applicable scheme chips are buttons with a "+N" badge. A tap adds the scheme's threshold of that product (buy 10 → +10, buy 8 → +8, 5+ cases → +5), capped at 999, and shows a toast. Chips for schemes that are used up or not applicable stay plain labels. | `js/screens/book.js`, `schemes.quickAdd()` |
| 8 | Marathi and Hindi, in their scripts | English · मराठी · हिंदी. A language button (🌐 EN / मरा / हिं) in every app bar opens a sheet; Login has a segmented control. All interface text, dates (day and month names), counts (पेटी/पेट्या) and common data values (tiers, channels, categories, areas, region, roles) are translated. Outlet, product and scheme names, visit notes and event names stay as written in the data. Numbers stay in Western digits. The choice is remembered per viewer; Reset demo keeps it. Devanagari typography: no letter-spacing or caps, a little more leading. | `js/i18n.js`, `js/strings.js`, `js/format.js`, CSS `:lang(mr/hi)` |
| 9 | A recommendations window with talking points for the owner | "Talking points" card on Outlet details (`outlet-brief` slot), and a "Talking points · N" button on Order booking (`booking-live` slot) that opens them in a sheet. Details below. | `js/feature/talking-points.js` |

**Talking points (item 9).** Up to 6 owner-safe points; 3 show first, with "Show N more".
- **What they cover** (only when they apply): a closure ahead, bookings before the next visit, the heat forecast, last year's cases in these same days (364 days back keeps the weekdays) against the same span just gone, schemes worth using (uses left, or "used up, next visit counts for May"), rationed or out-of-stock SKUs the outlet buys (with a same-flavour alternative), dated local events with their usual lift, similar shops' weekly sales for thin-history outlets (`peers.json`), the cooler (a warm or low audit, or the purity reward), and empties.
- **Ordering:** schemes, stock and events take turns, so the top points cover different things.
- **Before a closure:** no scheme or stock pushes.
- **For you only:** dues and cash terms sit in a collapsed "For you only · Not for the owner's eyes" section.
- **Sources:** each point names its source (forecast date, your orders, stock report date, and so on), and scheme points link to the scheme page. Everything is computed from the data and the demo date. `gtApp.talkingPoints.pointsFor(outlet)` returns the points.

**Checks (Chrome at 390 × 844, real data, hosted and offline):**
- **Every screen in English, Marathi and Hindi:** `scrollWidth` 390, no tap target under 44 px, no text under 12 px. The screens checked were Landing, Outlets, 5 outlet details, 3 scheme pages, Booking and Review.
- **No console errors.** `i18n.missing('mr')` and `i18n.missing('hi')` are both empty.
- **Earlier checks still pass:**
  - Mauli: 10 cases, ₹4,488, +1 free case.
  - Samarth: "not for Bronze".
  - Ashirwad's first order: 12% (₹174).
  - Thanda Corner: "4 of 4 uses this month, no free case".
  - "12.5" typed gives 12, with the hint.
  - Tapping a row doesn't filter.
  - A double tap saves once.
  - Reset returns to Login.
- **Quick add:** "+10" on 250 ml cola at Mauli gives 10 cases, ₹4,760, +1 free case; "+5" on mango Tetra gives ₹136 off.
- **Offline** (`gt-app.html` from disk): 0 network requests; the username becomes the name; talking points and Hindi work.

**Known and not changed:**
- ⚑ **Quick add ignores the distributor's ration.** "+10" on 250 ml cola adds 10 cases, while the stock talking point says at most 6 per order. Say if quick add should cap at the ration.
- **The translations should be checked by a native speaker** before the demo. They use the research's trade words.
- **The generated files are now about 450 KB each** (the Devanagari text is most of the growth). The hosted page loads one of them plus about 208 KB of data. GitHub Pages gzips both, so the transfer is far smaller.
- ⚑ **Contact roles:** for "Manager" or "Canteen contractor" instead of "Owner", the data needs `owner.role`. The app already reads it.

## Round 2 (27 Sep 2026): changes

**Hosting model.** `gt-app.html` is the only app page. The build (`scripts/build_single.py`) writes it twice, as `gt-app.html` and `index.html` (identical). `scripts/shell.html` is the page template; the old multi-file `index.html` moved there, so the site root has no second app page. `js/`, `css/`, `scripts/shell.html` and `data/` stay the source. `scripts/serve.py` was removed, and the README has no Python steps.

| # | Item | What changed | Verified (Chrome, 390 × 844) |
|---|---|---|---|
| A1 | Data files | `js/data.js`: served over http(s), the page fetches `data/<name>.json` (`cache: 'no-cache'`). Opened any other way (`file:`, or a preview snapshot `data:`), it reads the embedded copy. A missing or bad file shows an error naming it. Logs `[data] 10 files loaded from …`. | Hosted: all 10 `data/*.json` requests in the network log; changing OUT-01's limit to ₹18,750 in `data/outlets.json` and reloading showed ₹18,750 (reverted afterwards). Offline: 0 network requests. |
| A2 | Typed quantity | Whole cases 0–999 only. A refused character ("." "," "-" or a letter) keeps the last valid value and shows "Whole cases only". Digits typed right after a refused character are ignored too, until the rep deletes or taps the field again. More than 999 keeps the last value and shows "999 cases max". Leading zeros are dropped. | 12.5 → 12 · 1,200 → 1 · -5 → 0 · 12a3 → 12 · 0045 → 45 · 1000 → 100 · 999 → 999 · pasted "12.5" → unchanged |
| A3 | Landing overflow | "See all outlets" is `display:flex` with margins and no `width:100%`. | `scrollWidth` = 390 on Landing, Outlets, all 8 Outlet details, Booking, Review and Saved |
| A4 | Tap targets | Chips `min-height: 44px`. The demo bar is 52 px tall and the Reset demo button is 44 px, text only (the icon was dropped so "Pune West" fits). Bar-chart values 12 px. The `::before` hit-area tricks are gone. | No button, link or input under 44 px on any screen; no text under 12 px; the full "Demo · Tue 28 Apr 2026 · Pune West" at 390 px |
| A5 | `peers.json` required | It is in the required list in `data.js` (validated: `groups[]`), and the build refuses to run without it. | Loads hosted and offline; no 404 |
| A6 | New Outlet wording | `eligibility()` checks registration age before "first order": established outlets read "Only for outlets in their first 90 days". | OUT-01 shows it; OUT-08 is eligible (registered 22 Apr) |
| A7 | Bookings | Outlet details shows the next 3 bookings (date, event, ~cases) and "Next 3 of 14 bookings till Sat 16 May · ~55 cases in all". | OUT-06 |
| + | Tap-to-filter bug (not on the list, but it hid SKUs) | SKU rows use `data-category`; only `.chip[data-cat]` buttons change the category. | Tapping a row's name, quantity box or scheme chip keeps all 13 SKUs and "All" selected |
| + | Review cap wording | "Summer Single-Serve: 4 of 4 uses this month, no free case" (the month name removed, to match the spec). | OUT-03 |
| + | Contact role | Outlet details shows `owner.role` when present ("Manager: …"); otherwise "Owner: …". ⚑ The personas data has no `role` field, so it shows "Owner: Kavita Joshi" and "Owner: Prakash Kulkarni". Add `role` in `generate_data.py` to show "Canteen contractor" and "Manager". | — |

**B · Data.** `data/` is the personas chat's output (`python3 scripts/generate_data.py`, seed 20260428):
- 343 orders from 31 Dec 2024 to 21 Apr 2026 and 355 visits;
- all 16 generator checks pass;
- no STUB note, so the STUB badge is gone.

It carries the decided values: owners; credit (01 ₹18,000 · 02 ₹4,500 / ₹1,800 due · 04 ₹1,500, cash above · 07 ₹75,000 / ₹16,500 due …); OUT-08 registered 2026-04-22 with no orders or visits and `history "OUT-08": {}`; OUT-06's 14 bookings (~55 cases); empties OUT-03 6 and OUT-06 4; `peers.json` with "Bronze · traditional kirana · no cooler" (14 outlets).

*Incident, resolved:* at 15:34 `scripts/make_stub.py` overwrote the `data/` that `generate_data.py` had written at 15:26. The generator was re-run. Its validation output was byte-identical to the 15:26 run, so the restored data is the same. `make_stub.py` was also updated to the decided values, but it is now only a fallback: **don't run it over real data.**

**C · Checks** (hosted, fresh tab, clean storage):
- no console errors;
- 13 SKUs listed;
- OUT-01: 6 CL250 + 3 LL250 + 1 CL200G = 10 cases, ₹4,488, +1 free case;
- OUT-02: "Summer Single-Serve · not for Bronze";
- OUT-08's first order: 12% off (₹174 on ₹1,454);
- OUT-03 review: "4 of 4 uses this month, no free case";
- a double tap on Submit saves once;
- Reset demo from booking clears orders, empties the cart and returns to Login;
- offline (`gt-app.html` from disk) runs the same flow with 0 network requests.

**Known and not changed (not on the round 2 list):**
- At 390 px, the fifth category chip (Energy) sits partly off-screen; the chip row scrolls sideways. The outlet list's 8 channel chips scroll the same way.
- Crates are called "cases" outside Review.
- New Outlet 12% is taken after the Mango discount, not on gross.
- Purity says "Enrolled" even after a failed audit.
- Reset keeps the outlet list's last search.
- ⚑ Checked against the real data: a few past orders are above the outlet's credit limit.
  - OUT-03: 1 of 69 (max ₹15,504 against ₹15,000).
  - OUT-07: 2 of 67 (max ₹84,467 against ₹75,000).
  - OUT-02: 1 of 35 above today's headroom (₹3,320 against ₹2,700).
  - OUT-04 is intended (cash above ₹1,500).

  Past orders were placed when dues may have been lower, so this may be fine. It's for the personas chat to judge.
- Size: each generated HTML is ~324 KB and the data ~208 KB. The hosted page loads both (≈530 KB raw, far less gzipped by GitHub Pages).

## Feature hooks (for Season Check)

```js
// Everything is on window.gtApp: { app, cart, data, orders, schemes, fmt }
const { app, cart, data, orders, schemes } = window.gtApp;

// 1. After every render (screens: login, home, outlets, outlet, book, review, saved)
app.on('screen:rendered', ({ screen, outletId, root }) => {
  if (screen !== 'outlet') return;
  const slot = root.querySelector('[data-slot="outlet-brief"]');
  slot.innerHTML = '…';      // build from data.* and orders.allOrdersFor(outletId)
  slot.hidden = false;       // slots are hidden until the feature fills them
});

// 2. Every cart change → { type: start|add|remove|set|clear, sku, cases, cart: { outletId, lines, totalCases } }
const off = cart.subscribe(({ type, sku, cases, cart: c }) => { /* recompute the live check */ });
```

| Slot | Screen | Where | Extra attribute |
|---|---|---|---|
| `landing-top` | home | above the route list | — |
| `route-badge` | home | inside each route row | `data-outlet-id` |
| `outlet-brief` | outlet | between the header and the first card | — |
| `booking-live` | book | between the search/chips toolbar and the list | — |
| `sku-hint` | book | inside each SKU row (full width, under the chips) | `data-sku` |
| `review-check` | review | directly above the Submit bar | — |

- **Selectors** (`js/data.js`): `config`, `demoDate`, `outlets`, `outlet`, `products`, `product`, `categories`, `schemes`, `pastOrders`, `history`, `historyWeeks`, `visits`, `route`, `stock`, `stockFor`, `calendar`, `peers`, `isStub`.
- **Orders** (`js/orders.js`): `allOrdersFor` (past + demo, newest first), `lastOrder`, `demoOrders`, `demoOrdersOn`, `paidCases`, `freeCases`.
- **Schemes** (`js/schemes.js`): `activeSchemes`, `eligibility`, `usesThisMonth`, `price(cart, outlet, date, orders)`, `offerText`, `chipText`. `price()` is pure, so the feature can price hypothetical carts.
- **Booking doesn't re-render on cart changes.** Rows and the footer update in place, so slot content survives every tap; listen to `cart.subscribe` to refresh `booking-live` and `sku-hint`. **Review re-renders on any cart change** and fires `screen:rendered` again. After "Discard it and start here", booking also fires `screen:rendered` again.
- Write the feature as its own module(s) under `js/` (e.g. `js/feature/season-check.js`), imported from `js/main.js`, so `scripts/build_single.py` bundles it into `gt-app.html` / `index.html`. The bundler follows imports from `main.js`. Keep the base files untouched except for that one import line.

## Checks done in round 1 (Chrome, 390 × 844, stub data; see "Round 2" for the current results)

- [x] Demo date on every screen (demo bar); no `new Date()` without arguments and no `Date.now()` in `js/` (searched with grep)
- [x] Any non-empty login works; empty fields show inline errors
- [x] Route lists the 8 outlets from `data/`; "0 visited" → "1 visited" and "Order saved · 37 cases · ₹13,964" after a submit
- [x] Outlet list: search, "No outlet matches 'xyz'" with Clear, channel chips, "3 of 8 outlets"
- [x] Details fill from data: no orders (OUT-08), overdue in orange with an icon (OUT-02), closure ahead (OUT-05), ineligible schemes muted with a reason, purity program only with a company cooler, upcoming bookings (OUT-06), 13-month strip with the current month hatched
- [x] Booking: steppers; typed quantities ("1,200" → 999, "0007" → 7); 999 disables +; Review disabled at 0; category chips and search with an empty state
- [x] Schemes: free case at 10 pooled cases; OUT-01 at 20 pooled gets 1 (cap reached, "4 of 4 uses"); OUT-03 already capped → "4 of 4 uses this month (April), no free case"; Water Summer +1 per 8 with a cooler, "needs a company cooler" without; Mango Push 8% (₹136 on ₹1,700); New Outlet 12% on OUT-08's first order (₹520 on ₹4,336)
- [x] Switching outlets with an unsaved cart → sheet (keep editing / discard and start here)
- [x] Double tap on Submit saves once; toast; saved screen; the order shows as the last order; "Book another order"
- [x] Saved orders survive a reload; Reset demo clears them, clears the cart, signs out and lands on Login
- [x] `cart.subscribe` logs every change (`[cart] add CL250 → 6 · …`); a test listener filled `outlet-brief` and all 8 `route-badge` slots; slots are empty and hidden otherwise
- [x] ~~No sideways scroll on any screen at 390 px~~. Wrong in round 1: the check compared against `innerWidth`, which grows with the page. Landing overflowed by 16 px; fixed in round 2 (A3).
- [x] Size: about 190 KB in total (data about 80 KB); no libraries, no web fonts, no images
- [ ] Opens from the public link in a private window on a phone (after deploy)
- [x] Runs unchanged on the personas chat's `data/` (round 2)

## Next

1. **Deploy.** Choose the GitHub account and repository name, push, and turn on Pages (README → "Host it on GitHub Pages"). Open the link in a private window on a phone and check that the Network tab shows `data/*.json`.
2. **Optional polish** from "Known and not changed" in Round 2 (the Energy chip off-screen matters most for the panel).
3. **Feature.** In a new chat (stronger model), send: *"Read PROGRESS.md in full and follow its rules. Don't change the base screens except to load feature modules. Plan Season Check first (the four slots, the data it reads, the states and the retailer-safe view), wait for my 'go', then build it in stages, updating PROGRESS.md after each."*

---

The sections below are copied word for word from `01_BASE_APP_CONTEXT.md` (and its Appendix A, the prompt from Base_App_Prompt.md).

## Shared · Decisions so far

> This section is **identical in both context files** (base app and personas), so the two chats stay in step. If a chat changes anything here, it must say so clearly so I can tell the other chat.

**Status key.** **Decided** = used in all the work so far; change it only if I say so. **Proposed** = recommended but I haven't confirmed it yet. **Open** = I still have to choose.

| Topic | Status | Value | Why, and where it comes from |
|---|---|---|---|
| Region | Decided | Pune West, Maharashtra: Kothrud, Warje, Bavdhan, Pashan | The research, the analysis and the persona sheets are all specific to Pune (monsoon dates, heat, school calendar). |
| Years | Proposed | "This year" (TY) = 2026. "Last year" (LY) = 2025. | The monsoon reached Pune on 26 May 2025, its earliest onset in the recent record (IMD called the same day's arrival in Mumbai the earliest in 75 years). 2026 had record heat and a late monsoon (22 June). Two very different summers make the prototype's point. |
| Demo date ("today") | Proposed | **Tuesday 28 April 2026** (ISO week 18) | The brief says "anywhere from about a week before the local peak of summer demand to the peak itself". In the research, Pune's peak phase began around 6 April 2026, and the hottest fortnight (4–17 May) starts a week after 28 April. (The exact peak weeks are hindsight; on 28 April the forecast showed 38–41°C and no rain.) The days until the next visit then include the 1–3 May long weekend (Maharashtra Day is Fri 1 May), schools closing for summer from Sat 2 May, and IPL evenings. Alternative: Tue 5 May 2026, inside the hottest fortnight, but the long weekend and the school closure would then be behind it, not ahead. |
| Rep | Proposed | One pre-seller with a **fictional name** (for example "Rohit Jagtap"). He books orders during the visit and the distributor delivers the next day. He covers 25–30 outlets a day, talks to retailers in Marathi and Hindi, uses the app in English, and has a mid-range Android phone with patchy 4G in parts of Bavdhan and Pashan. | Industry_Context §2 (reps cover 20–40 outlets a day). Sample_Data §1 (25–30 a day; patchy 4G in Bavdhan and Pashan) describes this kind of rep; don't reuse the sample rep's name. |
| Outlets in the prototype | Proposed | The 8 personas (see the persona list in each file), all on today's route. The prototype shows 8 of the rep's ~27 outlets for the day. | Base_App_Prompt: "keep the number of rows small (for example, up to 8 outlets and 15 products)". |
| Feature | Proposed (working name, not yet confirmed by me) | **Season Check** (two-line description below) | Research findings tab, "What changes in the plan". |
| Stack and hosting | Proposed | Plain HTML, CSS and JavaScript with ES modules. No build step. Hash routing (`#/outlet/OUT-01`). Hosted on GitHub Pages. | The brief allows only a static front end. With no build step, nothing can break between the laptop and the panel's phone. |
| Look | Open (a proposal is in the base-app file) | Reuse the persona sheets' look: warm paper background, dark ink text, one blue for actions, one burnt orange for attention. | One visual identity across the app, the persona sheets and the deck. |
| Data | Proposed | 9 JSON files in `data/`, plus an optional `peers.json`. The exact format is in "Shared · Data contract". Every modelled number is flagged `est`. | Research findings tab. Base_App_Prompt rule: "All data comes from files in the data folder." |
| Deadline | Open | 72 hours from when the brief arrived. If it arrived on the morning of Fri 25 Sep 2026 (IST), the deadline is about the same time on Mon 28 Sep 2026. **Check the recruiter's email for the exact time** and keep 2 hours of buffer. | Assignment.md: "Submission Window: 72 hours from receipt". |
| GitHub account and repository name | Open | — | Needed to host the prototype. |

**Season Check in two lines**, so the app knows what it is making room for. At the counter, it tells the rep how much of each key pack this outlet needs until the next visit. It works this out from where the season is now (ramp, peak, decline or monsoon), the weather forecast and dated events. It then caps the amount at what the outlet can keep chilled, pay for, and has sold before. It recomputes on every cart change, has a view that is safe to show the retailer, and says nothing where it has nothing useful to add (for example at a wholesaler). It appears in four places: a badge next to each outlet in the Landing page's route list; a "season brief" in Outlet details; a live check inside Order booking; and a checklist in Order review, just before submit.

**What the recruiter's email said, word for word.** "The sample data is for context only. Don't analyse or build on it. Research seasonality yourself, and create your own outlet personas and data." And: "The basic app can stay simple in scope, but make it look good. Use your own design style throughout. The features you build on top must be complete: no dead ends, broken states or placeholder text."
So our season shapes, demand numbers and events come from our research, and Sample_Data.md is used to check that formats and ranges look real. Where the research had no better source, a few things still follow the sample: the price list's margins, shelf lives and 1 L case size; the scheme structures; and some persona credit figures. They are marked where they appear, and the personas chat will confirm or change them.

---

## Pre-filled interview answers (Base_App_Prompt Phase 1)

### 1 · Setup

- **Stack:** plain HTML, CSS and JavaScript with ES modules; no build step; hash routing; GitHub Pages. (Proposed; confirm.)
- **Design guidelines:** see "Look" below. (Open; the proposal is ready.)
- **Region:** Pune West, Maharashtra (Kothrud, Warje, Bavdhan, Pashan).
- **Demo date ("today"):** Tuesday 28 April 2026 (proposed), shown on every screen. All date logic reads it from `config.json`, never from the device clock.

### 2 · My outlet personas (what the base needs to know)

The personas chat owns the final numbers. These are the eight persona sheets as they stand (names are fictional; IDs are ours).

| ID | Outlet (area) | Persona | Channel | Tier · visits a month | Cold storage | Credit | What the base screens must show or handle |
|---|---|---|---|---|---|---|---|
| OUT-01 | Mauli General Stores (Kothrud) | The Flagship Kirana · helps most | Traditional kirana | Diamond · 4 | One 300 L company cooler | ₹15,000 limit, no dues | A long order history and big orders (about 18 cases in peak). Eligible for the summer scheme. |
| OUT-02 | Samarth Kirana (Warje) | The Cautious Kirana · handle with care | Traditional kirana | Bronze · 2 | None, shelf only | ₹4,000 limit, ₹1,600 due | Dues shown clearly (rep-facing). The summer scheme shows as "not for Bronze". Mostly large take-home bottles. |
| OUT-03 | Thanda Corner Cold Drinks (Kothrud, college road) | The Cold-Drink Shop · helps most | Convenience (cold-drink shop) | Gold · 4 | Two 300 L company coolers | ₹15,000 limit, no dues | Large single-serve carts (20+ cases); cans and energy drinks. A note about afternoon power cuts. |
| OUT-04 | Lakeside Bhel & Snacks (Pashan, by the lake) | The Lakeside Snack Stall · thin data | Entertainment & leisure (snack stall) | Iron · 1 | His own ice box | ₹3,000 limit, no dues | Tiny, irregular orders; a peak order bigger than his whole limit (he pays the rest in cash; the personas chat must keep his peak order above the limit). Not eligible for the summer scheme. |
| OUT-05 | Sunrise School Canteen (Bavdhan) | The School Canteen · stays quiet | Education (school canteen) | Silver · 3 | One 150 L company cooler | ₹6,000 limit, no dues | A closure shown in details: school shut from Fri 1 May 2026 (Maharashtra Day, then vacation), reopening 15 June. |
| OUT-06 | Shubh Mangal Banquets (Bavdhan) | The Banquet Hall · own calendar | Eating & drinking, seated (banquet hall) | Silver · 3 | One 150 L company cooler | ₹10,000 limit (he asks for ₹15,000) | Orders follow event bookings. A note about his booking calendar. |
| OUT-07 | Mahalaxmi Beverage Agency (Warje, market) | The Beverage Wholesaler · stays quiet | Wholesale (drinks only) | Diamond · 4 | None (a warehouse) | ₹60,000 limit, ₹14,000 due | Very large take-home orders (30–50+ cases). Nothing special in the base. |
| OUT-08 | Ashirwad General Store (Pashan) | The New Owner · thin data | Traditional kirana | Bronze · 2 | None | ₹6,000 limit, no dues | Little or no order history, so the empty states must look designed ("No orders yet"). May qualify for the new-outlet 12% on his first order. |

### 3 · Each screen: the minimum, what else, and the situations to handle

Across the app:
- **Demo bar**, a thin strip at the very top of every screen: "Demo · Tue 28 Apr 2026 · Pune West", with a **Reset demo** button on the right. Reset opens a small confirmation sheet (built in the app, not a browser pop-up), then clears saved orders and returns to Login.
- **App bar** under it: back button, screen title.
- Money is shown as ₹ with Indian grouping (₹1,23,456). Glass bottles come in crates; every other pack comes in cases.

**Login**
- *Minimum:* username and password fields; any non-empty values work.
- *Also:* app name ("GT App · prototype"), the demo bar, and a hint: "Any username and password works."
- *Situations:* an empty field shows an inline message. After Reset demo, the app lands here.

**Landing page**
- *Minimum:* the rep's name, the demo date, today's route (a list of outlets to visit) and a button to the full outlet list.
- *Also (all from data):* "8 outlets today · 0 visited", updating as orders are submitted. Each route row shows name, area, channel, a tier badge and a status: "To visit", or "Order saved · 12 cases · ₹6,540".
- *Situations:* nothing visited yet; some visited; all visited ("Route done"); several orders at one outlet on the same day.
- *Feature slots:* `landing-top` above the route list; `route-badge` inside each route row.

**Outlet list**
- *Minimum:* a searchable list with name, channel and segment (tier); tapping a row opens Outlet details.
- *Also:* the area; filter chips (All · Today's route · by channel); the demo persona tag (if confirmed).
- *Situations:* a search with no results ("No outlet matches 'xyz'", with a clear button); long names wrap cleanly.

**Outlet details**
- *Minimum:* the outlet's attributes, last order date and value, a short order history summary, outstanding payment, applicable schemes, and a "Book order" button.
- *Also (all from data):*
  - Header: name; area and location; channel · shop type; tier badge with visits a month.
  - Last order and last visit: date, cases, ₹; "Order saved today" if a demo order exists.
  - Order history: the last 3 orders (date, cases, ₹), and optionally a small 13-month bar strip of cases per month (current month partial, labelled).
  - Payment: credit limit, outstanding, overdue (burnt orange when above 0), last payment date. Compact, rep-facing.
  - Schemes: every scheme valid on the demo date. Eligible ones show their offer; ineligible ones are muted with the reason, e.g. "Summer Single-Serve · not for Bronze". The cooler purity program shows only where there is a company cooler.
  - Cooler: type and size; last audit (pure, fill %, temperature). Optional.
  - Notes: the last two visit notes, with dates.
  - Closures ahead, e.g. "School closed 1 May – 14 Jun".
  - A sticky "Book order" button at the bottom.
- *Situations:* no order history ("No orders yet"); overdue dues; a scheme that doesn't apply; a closure ahead; an order already saved today (show it and allow another).
- *Feature slot:* `outlet-brief`, between the header and the first card.

**Order booking**
- *Minimum:* search or browse by category; + / − steppers; schemes shown on a product; a running total; a "Review" button.
- *Also:*
  - Category chips: All · Sparkling · Juice drinks · Water · Energy.
  - Each SKU row: name; pack, e.g. "28 × 250 ml"; "₹476 / case · MRP ₹20"; scheme chip(s); stepper. Tapping the number lets the rep type a quantity (whole numbers 0–999).
  - A sticky footer: "14 cases · ₹6,664", plus "+1 free case" when a scheme adds one, and the Review button (disabled at 0 cases).
- *Situations:* empty cart; a search with no results; a very large quantity; a scheme chip the outlet can't use (muted, "not for Bronze"); opening booking at another outlet while the cart has items (a sheet asks: keep editing, or discard and start the new order).
- *Feature slots:* `booking-live`, between the search bar and the list (the feature decides whether it shows); `sku-hint` inside each SKU row (optional).

**Order review**
- *Minimum:* lines, quantities and totals; edit; submit. On submit, save the order and return to the Landing page or Outlet list.
- *Also:* free-case lines ("+1 free · Cola 250 ml"); discount lines (Mango Push 8%; new outlet 12%); gross, discount and net totals; total cases (paid + free).
- *After submit:* save to localStorage in the orders shape with `source: "demo"`, show a toast ("Order saved for Mauli General Stores"), and offer "Back to route" or "Outlet list".
- *Situations:* the summer scheme's 4 uses for the month already taken (the line reads "Summer Single-Serve: 4 of 4 uses this month, no free case"); a double tap on Submit (save once).
- *Feature slot:* `review-check`, directly above the Submit button.

### 4 · My feature, in two lines (only so you know where to leave space)

Season Check sizes the order for the days until the next visit from where the season is now (and the forecast and events ahead), and caps it at what the outlet can chill, pay for and has sold before. It is live on every cart change and has a retailer-safe view. **Don't build it.** Leave the four slots empty and expose these hooks:

- `cart.subscribe(listener)` → `listener({ type, sku, cases, cart })` for `start`, `set`, `add`, `remove` and `clear`. It returns an unsubscribe function.
- `app.on('screen:rendered', ({ screen, outletId, root }) => …)`, fired after every render so feature code can fill the slots.
- Data selectors the feature can reuse: outlet, products, schemes, all orders for an outlet (past and demo), history, visits, calendar, stock, and `demoDate`.
- The slots in HTML: `<!-- FEATURE SLOT: outlet-brief --> <section data-slot="outlet-brief" hidden></section>`. The same pattern for `landing-top`, `route-badge`, `booking-live`, `sku-hint` and `review-check`. They show nothing until the feature fills them.

---

## Look: proposed design direction ("field notebook")

- **Feel:** calm, warm and easy to read in sunlight, like a well-kept order book. It reuses the persona sheets' palette, so the app, the persona sheets and the deck look like one piece of work.
- **Type:** the system sans-serif for all body text (fastest on a mid-range Android phone). Optional: Fraunces, one self-hosted font file, only for large screen titles and outlet names, to echo the persona sheets. Small labels (dates, IDs) in the system monospace. Sizes 12 / 14 / 16 / 18 / 22 / 28 px; body 16 px, line height 1.45.
- **Spacing:** 4 / 8 / 12 / 16 / 24 / 32 px. Radius 8 / 12 / 16 px and pill. Tap targets at least 48 px tall.

```css
:root {
  --paper: #f3f1ea;  --card: #fcfbf7;  --ink: #1b1a17;  --ink-2: #4a4842;  --muted: #666359;
  --line: #ece9e1;   --line-strong: #d9d4c7;
  --accent: #2d5fcf; --accent-ink: #ffffff; --accent-tint: #e6ecf8;   /* actions, links, selection */
  --warm: #b04722;                                                    /* attention: dues, stock issues */
  --info-bg: #e3ebfb;    --info-ink: #1d3f8f;
  --caution-bg: #f6ead6; --caution-ink: #74460f;
  --neutral-bg: #ebe8df; --neutral-ink: #3d3b36;
  --ok-bg: #dff0e6;      --ok-ink: #1f5a3a;
  --thin-bg: #ece6f6;    --thin-ink: #4b3a78;
  --font-body: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif;
  --font-display: "Fraunces", Georgia, serif;          /* optional, titles only */
  --font-mono: ui-monospace, "IBM Plex Mono", Menlo, monospace;
  --tap: 48px;
}
```

- **Contrast (measured, WCAG):** ink on paper 15.4:1 · ink-2 on paper 8.1:1 · muted on paper 5.3:1 · accent text on card 5.6:1 · white on an accent button 5.8:1 · warm on card 5.4:1 · warm on paper 4.9:1 · all five pill pairs 6.7:1 or better · accent on the accent tint 4.9:1. Everything passes 4.5:1.
- **Components (define once):** demo bar; app bar; route row and outlet row; tier badge; attribute chips; section card; SKU row with stepper; scheme chip (eligible and ineligible); sticky cart footer; bottom sheet (confirmations); toast; empty state; inline error; slot container.
- **Colour means something:** the accent blue is for actions only; burnt orange is for attention only; never colour alone (always an icon plus text).
- **Copy:** short, plain, trade words; numbers in cases and rupees; no acronyms on screen except MRP.
- Use no FieldAssist logo and no real drink brands or logos.

---

## Build plan

**Files (about 10, plus data)**

```
index.html
css/styles.css      tokens at the top, then components
js/main.js          boot, hash router, demo bar, app bar, small event bus (on/emit)
js/data.js          loads data/*.json (relative paths); selectors
js/cart.js          one cart state object; subscribe()
js/orders.js        demo orders in localStorage; merge with past orders; reset
js/schemes.js       pure functions: which schemes apply, free cases, discounts, monthly cap
js/format.js        ₹ with Indian grouping; dates; everything computed from config.demoDate
js/screens.js       the six screens (split into js/screens/*.js if it grows past ~600 lines)
data/               the 9 JSON files (+ optional peers.json) from the personas chat
README.md, PROGRESS.md
```

**Routes:** `#/login`, `#/home`, `#/outlets`, `#/outlet/OUT-01`, `#/book/OUT-01`, `#/review/OUT-01`. A "signed in" flag in sessionStorage; Reset demo clears it.

**`schemes.js` (the base computes the order correctly; the feature reuses it).**
- `activeSchemes(date)`: the schemes valid on that date.
- `eligibility(scheme, outlet, date, pastOrders)` → `{ eligible, reason }`, where the reason is the tier, no company cooler, not a first order, or outside the dates.
- `price(cart, outlet, date, pastOrders)` → the lines with their free cases, the discounts, gross, net, and uses this month per scheme.
- Rules: Summer Single-Serve is pooled across its SKUs, 1 free case per full 10, delivered as the largest line, at most 4 uses a month (a use = one free case). Water Summer: 1 free per full 8 cases of 1 L water, company cooler required. Mango Push: 8% off the mango lines when they total 5 or more cases. New outlet: 12% off the whole order (the first order only, within 90 days of registration). Schemes stack.

**Stages** (Base_App_Prompt's five, with what I can check after each)
1. **Skeleton, data loading, demo bar, Login, Landing.** Check: at 390 px the demo date shows; any login works; the route lists the outlets from `data/`; changing a name in `outlets.json` and reloading changes the screen. **Deploy to GitHub Pages now and open it on my phone.**
2. **Outlet list and Outlet details.** Check: search and the filter chips work; every card fills from data; an outlet with no orders shows the designed empty state; the slots exist in the code but show nothing.
3. **Order booking, the cart and `schemes.js`.** Check: the steppers and typed quantities work; the totals are right; eligible and ineligible scheme chips; a free case appears at 10 pooled cases; `cart.subscribe` logs every change in the console.
4. **Order review, submit, saved orders, Reset demo.** Check: after submit, Landing shows "Order saved"; Outlet details shows it as the last order; Reset clears it and returns to Login.
5. **README.** Run locally with `python3 -m http.server 8000` and open `http://localhost:8000`. ES modules don't load from `file://`. Deploy: push to GitHub → Settings → Pages → deploy from the `main` branch, root folder.

---

## Situations the base must handle (checklist)

- [ ] An outlet with no orders ("No orders yet"; no crash on empty arrays)
- [ ] Overdue dues shown (rep-facing), with no blocking
- [ ] A scheme that doesn't apply (by tier, by cooler, or not a first order)
- [ ] The summer scheme's monthly cap already used
- [ ] A closure ahead shown in details
- [ ] Empty cart: Review disabled
- [ ] Very large quantities (up to 999 cases); only whole numbers
- [ ] Switching outlets with an unsaved cart
- [ ] A second order at the same outlet on the same day
- [ ] A search with no results
- [ ] Reset demo from any screen
- [ ] An outlet opened from the full list that isn't on today's route (booking still works)

---

## Do not build in the base

The feature itself (badges, season brief, live check, checklist); suggested quantities of any kind; distributor stock warnings; credit blocking or approvals; a retailer-view toggle; weather; target or incentive views; manager dashboards; real login; offline sync; Marathi or Hindi labels (deferred); any chart other than the optional small bar strip; real brand names or logos; heavy animation or large images.

---

## Checks before calling the base done

- [ ] The demo date is visible on every screen, and the code never calls `new Date()` without an argument or `Date.now()` (search the code for them)
- [ ] Reset demo clears saved orders and returns to Login
- [ ] Nothing that should come from `data/` is typed into the HTML (change a value, reload, see it change)
- [ ] At 390 × 844: no sideways scrolling; tap targets at least 48 px; body text 16 px
- [ ] Every button leads somewhere; no placeholder text; empty and error states designed
- [ ] Light: no heavy libraries; the whole app under about 500 KB; quick first load on a throttled 4G connection
- [ ] Opens from the public link in a private (incognito) window on a phone
- [ ] Cases and rupees formatted the same way everywhere
- [ ] The slots exist in the code and show nothing; `cart.subscribe` and `screen:rendered` work

---

## Shared · Products, schemes, distributor stock and forecast

### Product catalogue: 13 SKUs (recommended)

Prices: MRP is per unit and PTR (price to retailer) is per case. PTR = MRP × units per case × 0.85 (a 15% retailer margin) for sparkling drinks, juice drinks and energy drinks, and × 0.80 (20%) for water, rounded to whole rupees. The brand names are generic (Cola, Lemon-lime, Orange, Mango drink); no real brands or logos.

| Code | Product | Category | Units per case | Litres per case | MRP ₹/unit | PTR ₹/case | Shelf life (days) | Chilled | Single-serve | Focus | Summer multiplier (est) | Where the numbers come from |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CL200G | Cola 200 ml returnable glass | Sparkling | 24 (crate) | 4.8 | 10 | 204, plus a crate and empties deposit (amount unknown) | 180 | yes | yes | yes | 3.0 | MRP ₹10 is from the research: the 200 ml glass bottle went from ₹15 to ₹10 in Maharashtra (Business Standard, 15 Mar 2023). The sample's master still says ₹15. |
| CL250 | Cola 250 ml PET | Sparkling | 28 | 7.0 | 20 | 476 | 120 | yes | yes | yes | 3.0 | The research confirms ₹20 and 28 per case. |
| LL250 | Lemon-lime 250 ml PET | Sparkling | 28 | 7.0 | 20 | 476 | 120 | yes | yes | no | 3.2 | As CL250. |
| OR250 | Orange 250 ml PET | Sparkling | 28 | 7.0 | 20 | 476 | 120 | yes | yes | no | 2.5 | Added by the research (not in the sample). |
| CL300C | Cola 300 ml can | Sparkling | 24 | 7.2 | 40 | 816 | 240 | yes | yes | no | 2.0 | Research: ₹40, 24 per case. |
| CL750 | Cola 750 ml PET | Sparkling | 24 | 18.0 | 40 | 816 | 120 | partly | no | no | 2.2 | — |
| OR1250 | Orange 1.25 L PET | Sparkling | 12 | 15.0 | 65 | 663 | 180 | no | no | no | 1.8 | Online listings range ₹50–70. |
| CL2250 | Cola 2.25 L PET | Sparkling | 9 | 20.25 | 95 | 727 | 180 | no | no | no | 1.8 | Online listings range ₹85–100. |
| MG150T | Mango drink 150 ml Tetra | Juice drinks | 40 | 6.0 | 10 | 340 | 180 | yes | yes | yes | 3.0 | Research: ₹10, 40 per case. |
| MG600 | Mango drink 600 ml PET | Juice drinks | 24 | 14.4 | 38 | 775 | 120 | yes | yes | no | 2.5 | The research estimated about ₹40. |
| WT1000 | Packaged water 1 L PET | Water | 15 | 15.0 | 20 | 240 | 365 | yes | no (over 600 ml) | yes | 2.5–3.0 | The research table said 12 per case, without a source. |
| WT500 | Packaged water 500 ml PET | Water | 24 | 12.0 | 10 | 192 | 365 (est) | yes | yes | no | 3.0 | Added by the research. |
| EN250 | Energy drink 250 ml PET | Energy | 24 | 6.0 | 20 | 408 | 270 (est) | yes | yes | no | 1.5 | Research: ₹20 energy drinks in 250 ml PET are the common price point. This replaces the sample's ₹75 can. |

**Pricing and shelf life: a choice to confirm.** The earlier plan (research findings tab) used PTR = MRP × units × 0.88–0.90, a 10–12% margin. That figure came from a single online B2B listing (₹505 for 28 × 250 ml). Industry_Context §3 says kirana margins on FMCG run 8–15%, and the sample's master uses 15% (20% for water). The recommendation above uses 15% and 20%. The shelf lives and the 15-per-case count for 1 L water also follow the sample's format; the research's alternatives (6–8 months for PET, 12 per case) came from weak sources. Changing this later means editing one table in `products.json`.

**Summer multiplier** = how much a pack's weekly volume rises at the peak compared with January, in a normal year (research Table E, an estimate).

### Schemes valid in 2026 (recommended)

| ID | Name | Type | SKUs | Offer | Who can get it | Monthly cap | Valid | How it is paid | Source |
|---|---|---|---|---|---|---|---|---|---|
| SCH-SS26 | Summer Single-Serve | Free cases | CL250, LL250, CL200G | Buy 10 cases, get 1 free | Diamond, Gold, Silver | 4 uses per outlet per month | 1 Mar – 31 May 2026 | The free case comes with the delivery; the bottler credits the distributor within 30 days of the claim. Free branded cooler shelf-strip with the first qualifying order. | Same structure as the bottler scheme format in Sample_Data §14 (S-001/S-005) |
| SCH-MG26 | Mango Push | % off | MG150T, MG600 | 8% off when the order has 5 or more cases of these SKUs combined | All tiers | — | 1 Apr – 30 Jun 2026 | Taken off the invoice | Same format as Sample_Data §14 (S-002/S-006) |
| SCH-WT26 | Water Summer | Free cases | WT1000 | Buy 8 cases, get 1 free | Outlets with a bottler cooler (any tier) | none | 1 Apr – 30 Jun 2026 | With the delivery | **Our addition (est), not in the sample.** It tests a rule where eligibility depends on the cooler, not the tier. |
| SCH-NEW | New Outlet Activation | % off | Any SKU | 12% off the first order | Outlets registered in the last 90 days, first order only | — | Ongoing | Taken off the invoice | Same format as Sample_Data §14 (S-004) |
| PRG-PURITY | Cooler Purity Program | Program (not applied at the cart) | — | ₹300 a month if the cooler holds only our products at the monthly photo audit | Outlets with a bottler cooler. New coolers are placed only at Diamond, Gold and Silver outlets. | — | Ongoing | Monthly | Same format as Sample_Data §14 |

**How Summer Single-Serve is counted (proposed, confirm).** Any mix of the three listed SKUs counts towards the 10 cases in one order (pooled). Each full 10 cases earns 1 free case, and the free case is delivered as the listed SKU with the most cases in that order. A **use** is one free case earned, so a 20-case order uses 2. Uses are counted per calendar month across all of that outlet's orders (past orders and orders made in the demo); after 4 uses in a month, no more free cases that month. The personas chat should seed the data so that at least one eligible outlet has already used all 4 April uses before the demo date, and at least one still has uses left. *Why pooled:* 250 ml cola is rationed to 6 cases per outlet (see "Distributor stock" below), so if each SKU were counted separately, a cola-only order could never reach 10 cases. The sample doesn't say which way it works. Whichever I choose, both chats must use the same rule, written once in one function.

**Focus SKUs for summer 2026:** CL250, CL200G, MG150T, WT1000. (Research findings tab. Water was added because it holds up when it rains: VBL's water share rose 200 bps in the rain-hit April–June 2025 quarter.)

### Distributor stock as of Saturday 25 April 2026 (est)

| SKU | Status |
|---|---|
| CL250 (Cola 250 ml PET) | Rationed: at most 6 cases per outlet per order |
| MG600 (Mango drink 600 ml) | Out of stock |
| Everything else | Available |

The distributor reports stock to FieldAssist about once a week, so this can be several days old and is not always accurate (Industry_Context §5; Sample_Data §10). Wherever this status appears, show its "as of" date.

### Weather forecast as of Tuesday 28 April 2026 (est: a stand-in for an IMD district forecast)

- 29 April – 4 May: highs of 38–40°C, no rain.
- 5 – 11 May: highs of 39–41°C. A stray pre-monsoon shower is possible, but there is no sign of the monsoon.
- No sign of the monsoon in the next 14 days.
- The monsoon normally reaches Pune around 10 June (±3 days). Onsets from 2017 to 2025 were spread over 29 days: 26 May 2025 at the earliest, 24 June 2023 at the latest.
- Hindsight, **for the deck only, never in the app's data**: May 2026 brought record heat (43.8°C at Lohegaon on 11 May) and the monsoon arrived on 22 June 2026.

---

## Shared · Data contract (the files the app reads)

> The personas chat **writes** these files; the base-app chat **reads** them. Both must follow this contract exactly. If either chat needs to change it, it must say so plainly so I can update the other chat.

### General rules

- All files live in `data/` and are loaded with **relative** paths (`data/outlets.json`, never `/data/...`), so the app still works in a GitHub Pages subfolder.
- Dates are `YYYY-MM-DD` (India time; no clock times needed). Weeks are ISO weeks written `2025-W01`, starting on Monday.
- **"Today" is `config.demoDate`.** No code, and no data, may depend on the device clock.
- Money is in whole rupees (integers). Quantities are whole cases (integers of 0 or more).
- IDs: outlets `OUT-01` … `OUT-08`; SKUs use the codes in the catalogue; past orders `ORD-<outlet no>-<yyyymmdd>` (e.g. `ORD-01-20260421`); orders placed in the demo `DEMO-<outlet no>-<counter>`. Don't use the sample's `OT-0xx` codes.
- Every file starts with `"meta": { "generatedBy": "scripts/generate_data.py", "seed": <number>, "est": true, "note": "..." }`. Any record or field that mixes sourced and modelled values carries its own `"est": true`.
- **Nothing from after the demo date**, except what was really known in advance: the weather forecast; school and holiday dates, the IPL schedule and the adhik month; the next planned visit; closures and event bookings the rep has recorded; and peer benchmarks for the current and next two weeks. The real 2026 monsoon date (22 June) and May's record heat are hindsight: they belong in the deck, not the data.
- Target size: everything in `data/` under about 250 KB, so the whole app stays under 500 KB.

### 1. `config.json`

```json
{
  "meta": {},
  "demoDate": "2026-04-28",
  "region": { "name": "Pune West", "city": "Pune", "state": "Maharashtra",
              "areas": ["Kothrud", "Warje", "Bavdhan", "Pashan"] },
  "rep": { "id": "REP-01", "name": "Rohit Jagtap", "role": "Pre-seller",
           "routeOutletsToday": 27, "languages": ["Marathi", "Hindi", "English (app)"] },
  "distributor": { "name": "Kothrud Beverage Distributors", "deliveryLeadDays": 1 },
  "history": { "fromWeek": "2025-W01", "toWeek": "2026-W17", "weekStartsOn": "Monday" },
  "focusSkus": ["CL250", "CL200G", "MG150T", "WT1000"],
  "assumptions": { "est": true,
                   "coolerCases250ByLitres": { "60": 2, "150": 5, "300": 10 },
                   "iceBoxCases250": 1 }
}
```

### 2. `outlets.json`

```json
{
  "meta": {},
  "outlets": [{
    "id": "OUT-01",
    "name": "Mauli General Stores",
    "persona": { "no": 1, "label": "The Flagship Kirana", "role": "helps-most",
                 "oneLine": "Big summer, but stocks up late when scheme details are late." },
    "channel": "Traditional Kirana",
    "shopType": "Traditional Kirana",
    "area": "Kothrud",
    "address": "Karve Road, Kothrud",
    "locationContext": "Busy residential main road",
    "tier": "Diamond",
    "visitsPerMonth": 4,
    "registeredOn": "2019-06-01",
    "owner": { "name": "…", "behaviour": "Plans with the rep; waits for scheme terms", "usuallyPresent": true },
    "cooler": { "type": "bottler", "count": 1, "litres": 300, "afternoonOutage": false,
                "lastAudit": { "date": "2026-04-15", "pure": true, "fillPct": 82, "tempC": 5 } },
    "credit": { "limit": 15000, "outstanding": 0, "overdue": 0,
                "lastPaymentDate": "2026-04-21", "paymentMode": "credit" },
    "tags": ["residential", "main-road"],
    "closures": [],
    "bookings": [],
    "empties": { "cratesHeld": 5 }
  }]
}
```

- `persona.role` is one of `helps-most`, `handle-with-care`, `stays-quiet`, `own-calendar`, `thin-data`.
- `credit`: for personas with dues, set `outstanding` equal to `overdue` (our simplification), so headroom = limit − outstanding gives the same answer as the research rule (limit − overdue).
- `cooler.type` is one of `bottler`, `own-fridge`, `ice-box`, `none`. For `none`: `count` 0, `litres` 0, `lastAudit` null.
- `closures`: `[{ "from": "2026-05-01", "to": "2026-06-14", "reason": "Maharashtra Day holiday, then school summer vacation (reopens 15 Jun)" }]`. Include last year's closures too.
- `bookings` (only for outlets that order by events, like the banquet hall): `[{ "date": "2026-05-02", "event": "Wedding, ~400 guests", "expectedCases": 14 }]`. These are recorded by the rep; flag them `est`.
- `tags` are location or behaviour tags that events can match, for example `tourist-spot`, `weekend-crowds`, `school`, `highway`, `month-end-loads`.
- `empties` only for outlets that buy returnable glass.
- `address` is fictional. No real people's names anywhere.

### 3. `products.json`

```json
{
  "meta": {},
  "categories": ["Sparkling", "Juice drinks", "Water", "Energy"],
  "products": [{
    "sku": "CL250", "name": "Cola 250 ml PET", "category": "Sparkling", "flavour": "Cola",
    "pack": { "type": "PET", "ml": 250 }, "unitsPerCase": 28, "caseLabel": "case",
    "litresPerCase": 7.0, "mrpPerUnit": 20, "ptrPerCase": 476, "marginPct": 15,
    "shelfLifeDays": 120, "chilled": "yes", "singleServe": true, "returnable": false,
    "depositPerCrate": null, "focus": true, "summerMultiplier": 3.0, "est": ["summerMultiplier"]
  }]
}
```

- `pack.type` is one of `PET`, `glass`, `can`, `tetra`. `caseLabel` is `crate` for returnable glass and `case` otherwise. `chilled` is `yes`, `partly` or `no`.
- The values are exactly the catalogue table in "Shared · Products, schemes, distributor stock and forecast".

### 4. `schemes.json`

```json
{
  "meta": {},
  "schemes": [{
    "id": "SCH-SS26", "name": "Summer Single-Serve", "type": "free-goods",
    "skus": ["CL250", "LL250", "CL200G"],
    "rule": { "buyCases": 10, "freeCases": 1, "pooled": true, "freeSku": "largest-line" },
    "eligibleTiers": ["Diamond", "Gold", "Silver"], "requiresBottlerCooler": false,
    "capUsesPerMonth": 4, "validFrom": "2026-03-01", "validTo": "2026-05-31",
    "payout": "Free case delivered; the bottler credits the distributor within 30 days of the claim",
    "extras": "Free cooler shelf-strip with the first qualifying order", "est": false
  }]
}
```

- `type` is one of `free-goods`, `percent-off`, `first-order`, `program`.
- `capUsesPerMonth`: a use = one free case earned (a 20-case pooled order uses 2).
- `percent-off` rule: `{ "minCases": 5, "percent": 8, "pooled": true }`. `first-order` rule: `{ "percent": 12, "withinDaysOfRegistration": 90 }`. For `program`: `rule` null, and it is never applied at the cart.
- `skus` may be `"all"`. `eligibleTiers` may be `"all"`.

### 5. `orders.json` (every past order; the source for history)

```json
{
  "meta": {},
  "orders": [{
    "id": "ORD-01-20260421", "outletId": "OUT-01", "date": "2026-04-21",
    "lines": [ { "sku": "CL250", "cases": 6, "freeCases": 1 },
               { "sku": "LL250", "cases": 4, "freeCases": 0 } ],
    "grossValue": 4760, "discountValue": 0, "netValue": 4760,
    "schemeIds": ["SCH-SS26"], "source": "history"
  }]
}
```

- Covers every booked order from 2024-12-30 (the Monday that starts 2025-W01) to 2026-04-26 (the Sunday that ends 2026-W17), so it matches `history.json` exactly. There are no orders on Mon 27 April (the demo week). These are cases **booked**, not delivered.
- `grossValue` = Σ(cases × PTR). Free cases carry no value. `netValue` = `grossValue` − `discountValue`.
- **The app saves orders placed in the demo** in the browser's localStorage, in this same shape with `"source": "demo"` and `"date": config.demoDate`. "Reset demo" deletes only those. "Last order" on screen = the latest order from either source.

### 6. `history.json` (weekly cases, derived from `orders.json`)

```json
{
  "meta": {},
  "weeks": ["2025-W01", "…", "2026-W17"],
  "weekStarts": ["2024-12-30", "…", "2026-04-20"],
  "outlets": { "OUT-01": { "CL250": [0, 3, 0, 4, "… 69 integers"], "CL2250": ["…"] } }
}
```

- 69 weeks: 52 of 2025 (2025-W01 starts Mon 30 Dec 2024) plus 17 of 2026 (2026-W17 ends Sun 26 Apr 2026).
- Each value = cases of that SKU booked in that week. The generator builds this from `orders.json`, and the two must agree exactly. SKUs an outlet never bought are left out (read them as zeros).
- An outlet visited every two weeks or every month shows zeros between visits. Use rolling averages over the visit gap, not single weeks, when computing rates.

### 7. `visits.json`

```json
{
  "meta": {},
  "outlets": {
    "OUT-01": {
      "cadenceDays": 7, "todayOnRoute": true, "routeOrder": 1,
      "nextVisitAfterToday": "2026-05-05",
      "visits": [ { "date": "2026-04-21", "planned": true, "done": true, "minutes": 9,
                    "orderId": "ORD-01-20260421",
                    "note": "Cooler full at 9 am; owner expects a rush over the 1–3 May holiday weekend." } ]
    }
  }
}
```

- Past visits from 2024-12-30 to 2026-04-26, the same range as orders. `done: false` for missed visits and visits when the outlet was closed. `note` is null on most visits; each outlet has 2–3 dated notes in the rep's voice.
- `nextVisitAfterToday` sets the days of cover. Cadence by tier: Diamond and Gold every 7 days, Silver every 10, Bronze every 14, Iron about every 28.

### 8. `distributor_stock.json`

```json
{
  "meta": {},
  "asOf": "2026-04-25",
  "items": [ { "sku": "CL250", "status": "rationed", "maxCasesPerOutlet": 6, "note": "Allocation cut for peak weeks" },
             { "sku": "MG600", "status": "out", "maxCasesPerOutlet": 0, "note": "" } ]
}
```

- `status` is one of `ok`, `rationed`, `out`. List every SKU.

### 9. `calendar.json`

```json
{
  "meta": {},
  "regionIndex": { "est": true, "basis": "January average week = 1.0",
                   "2025": { "2025-W01": 1.0, "…": "…", "2025-W52": 1.0 },
                   "2026": { "2026-W01": 1.1, "…": "…", "2026-W18": 2.7 } },
  "phases": { "2025": { "2025-W09": "pre-season", "2025-W15": "peak", "2025-W22": "monsoon" },
              "2026": { "2026-W15": "peak", "2026-W18": "peak" } },
  "forecast": { "asOf": "2026-04-28", "est": true,
                "periods": [ { "from": "2026-04-29", "to": "2026-05-04", "maxC": [38, 40], "rainChance": "none" },
                             { "from": "2026-05-05", "to": "2026-05-11", "maxC": [39, 41], "rainChance": "low" } ],
                "monsoonSignalNext14Days": false },
  "climatology": { "normalOnsetPune": "06-10", "plusMinusDays": 3,
                   "onsets": { "2024": "2024-06-06", "2025": "2025-05-26" } },
  "events": [ { "id": "EV-MHDAY-26", "name": "Maharashtra Day long weekend", "from": "2026-05-01",
                "to": "2026-05-03",
                "appliesTo": { "channels": [], "tags": ["highway", "petrol-pump", "tourist-spot"] },
                "packs": null, "multiplier": [1.5, 2.0], "source": "State holiday calendar", "est": true } ],
  "schools": { "2025": { "vacationFrom": "2025-05-02", "reopen": "2025-06-16", "est": true },
               "2026": { "vacationFrom": "2026-05-02", "reopen": "2026-06-15",
                         "source": "Lokmat Times, 30 Mar 2026" } }
}
```

- The 2026 index runs only to week 18 (the demo week). Beyond that, the app uses the forecast, the dated events and the normal monsoon onset. It must never know the future.
- `phases` uses these words: `pre-season`, `ramp`, `peak`, `decline`, `monsoon`, `off-season`.
- Each event says what it applies to (`appliesTo.channels` uses the `channel` values in `outlets.json`; `appliesTo.tags` matches `outlets[].tags`), an optional list of packs, a multiplier (a number or a `[low, high]` range) and a source.

### 10. `peers.json` (optional)

```json
{
  "meta": {},
  "groups": [ { "key": "kirana|Bronze|no-cooler", "channel": "Traditional Kirana", "tier": "Bronze",
                "cooler": "none", "outletsInGroup": 14,
                "weeklyCasesBySku": { "CL2250": { "2026-W18": 1.2 }, "CL250": { "2026-W18": 0.8 } },
                "est": true } ]
}
```

- "Similar shops nearby" on the rep's wider route (not only the 8 in the prototype). Use these when an outlet's own history is thin, and label the result as an estimate.

### What the app keeps in the browser

- One localStorage key, for example `gtapp.demo.v1`, holding `{ "orders": [ … ] }`: demo orders in the `orders.json` shape. Nothing else needs saving.
- "Reset demo" clears this key and returns to Login.

---

## Appendix A · The prompt from Base_App_Prompt.md (verbatim)

> I'm building a prototype for a take-home assignment. I need a **basic, mobile-first web app** that imitates the core flow of a field sales app used by a soft-drinks bottler's sales reps when they visit retail outlets. My own feature will be built on top of it later, so the base must stay simple, and it must be easy to add screens, panels and steps to.
>
> **Work in three phases. Do not skip ahead.**
>
> ### Phase 1 — Interview me
>
> Do not write any code yet. Ask me questions, at most 3 at a time, and wait for my answers before asking more. Cover:
>
> 1. **Setup:** my preferred stack (default: plain HTML, CSS and JavaScript, with no build step), my design guidelines (colours, type, spacing, components, or a product it should feel like; if I have none, propose two or three clear directions for me to choose from), the region my rep works in, and the demo date ("today"). The demo date is in the summer peak season, between about a week before the local peak and the peak itself.
> 2. **My outlet personas:** the outlets I want in the app, and what makes each one different (channel, segment, cooler, credit, owner behaviour, seasonal pattern).
> 3. **Each screen, one at a time**, in the order listed under "Screens" below. For each one, tell me the minimum it will show, then ask what else I want on it based on my research, and what situations it must handle (for example: no order history, an overdue balance, a scheme that doesn't apply).
> 4. **My feature, in one or two lines:** only so that you know where to leave space for it. Do not build it.
>
> If an answer of mine is vague, ask one follow-up question. If I'm unsure, suggest two or three options and let me choose. Don't decide for me silently. Keep your questions and options short.
>
> ### Phase 2 — Show me a plan
>
> When the interview is done, write a short plan and wait for me to say "go". When I say "go", write `PROGRESS.md`, then stop and give me the exact message to start Stage 1 in a new chat. Do not start building in this chat unless I ask you to. The plan must include:
>
> - each screen, and exactly what it will show and do
> - the design system you will apply: colours, type, spacing and key components
> - each data file in the `data` folder, with its fields and how many sample rows it will have
> - the file structure, kept small (about 10 files is plenty for the base)
> - the build stages (see Phase 3), with what I will be able to see and test after each
> - anything you are assuming that I didn't tell you
>
> If I ask for changes, update the plan and wait again.
>
> ### Phase 3 — Build in stages
>
> Build **one stage at a time.** After each stage, update `PROGRESS.md`, then stop and tell me, in no more than 5 lines: what you built, how to open or refresh it to see it, what to check, and what the next stage is. End with the exact message I can paste into a **new chat** to start the next stage (for example: "Read PROGRESS.md, follow its rules, build Stage 3 only, then stop."). I may continue here or start a new chat to save usage; either way, pick up from `PROGRESS.md`.
>
> Suggested stages:
> 1. Project skeleton, data loading and the demo date bar, plus Login and the Landing page
> 2. Outlet list and Outlet details
> 3. Order booking with the cart
> 4. Order review, submit, saved orders and Reset demo
> 5. README: how to run it locally and deploy it
>
> ### Screens (the minimum for each)
>
> 1. **Login** — username and password fields. Any non-empty values are accepted.
> 2. **Landing page** — the rep's name, the demo date, today's route (a list of outlets to visit) and a button to open the full outlet list.
> 3. **Outlet list** — a searchable list of outlets showing name, channel and segment. Tapping an outlet opens its details.
> 4. **Outlet details** — the outlet's attributes, last order date and value, a short order history summary, outstanding payment, and applicable schemes. A "Book order" button.
> 5. **Order booking** — search or browse products by category, set quantities with + / − steppers, see applicable schemes on a product, and see a running total. A "Review" button.
> 6. **Order review** — lines, quantities and totals, with edit and submit. On submit, save the order to the session's order history and return to the Landing page or Outlet list.
>
> ### Rules for the whole build
>
> - **Static front end only:** no backend, no database, no API keys. It must deploy as static files to GitHub Pages, Netlify or Vercel.
> - **Designed for a 390px-wide phone screen**, with touch-sized targets.
> - **Looks polished and modern.** Apply my design guidelines consistently on every screen: a clear visual hierarchy, generous spacing, one type scale, consistent components and considered empty and error states. Define colours, type and spacing once (for example as CSS variables) so I can restyle the whole app in one place. Keep the base's scope simple, not its look.
> - **All data comes from files in the `data` folder.** Screens read from these files, never from values typed into the markup. Load them with relative paths (`data/...`, not `/data/...`) so the app still works when hosted in a subfolder, as on GitHub Pages.
> - **A fixed demo date** read from my data and shown on screen. All date logic uses it, not the device clock.
> - **A visible "Reset demo" control** that clears anything stored during the session (for example, submitted orders in localStorage).
> - **Ready for my feature:** keep the cart in one state object with a way to subscribe to every change (add, remove, quantity edit). Leave clearly marked places **in the code** (empty containers with comments, nothing visible on screen) for extra content on the Landing page, in Outlet details, inside Order booking, and in Order review before submit. Keep data loading, cart logic and screen code in separate files.
>
> ### Keep the build small and recoverable
>
> - Use my personas for the sample outlets and keep the number of rows small (for example, up to 8 outlets and 15 products). Design the order history files so they can hold at least last year's full season, even if the sample only fills a few months.
> - Build only what the plan says. Suggest extras, but don't add them unless I say yes.
> - For small changes, edit the file in place. Don't regenerate whole files.
> - If a stage turns out bigger than planned, stop and propose splitting it.
> - Write `PROGRESS.md` when the plan is approved, and update it after every stage: the full plan, every decision from the interview, what is done and what is next. Also copy into it the "Rules for the whole build", the "Keep the build small and recoverable" rules and the Phase 3 per-stage steps (build one stage, update `PROGRESS.md`, stop, 5-line summary, next-chat message). It must be complete enough that a new chat can carry on from it alone, without this conversation.
> - If you notice you are running low on space in this conversation, stop at a clean point, update `PROGRESS.md`, and tell me.
>
> Start Phase 1 now with your first questions.
