> **Superseded (27 Sep 2026):** this prompt was replaced by the round-2 change list in PROGRESS.md. gt-app.html is now GENERATED from js/, css/ and data/, so do not edit it by hand as this prompt says. Kept for reference only.

You are fixing the base version of my FieldAssist APM take-home prototype. Work only in this file:

`/Users/apple/Documents/gt-app-prototype/gt-app.html`

It is a single self-contained HTML file. The CSS is inline, the JS is split into `modules['name'] = (() => {…})()` blocks, and the data sits in `<script type="application/json" id="data-<name>">` blocks at the bottom. **This file is now the source of truth.** Edit it directly. Do not run or rely on `scripts/build_single.py`, `index.html`, `js/`, `css/` or `data/`: the build script would overwrite your edits.

The spec for the base app is `/Users/apple/Downloads/01_BASE_APP_CONTEXT.md`. Read §3 "Each screen", "Situations the base must handle", "Checks before calling the base done" and "Shared · Data contract". Where the spec's "Look" section conflicts with the design direction in Part 2, Part 2 wins.

## Ground rules
- Keep the flow and scope: Login → Landing → Outlet list → Outlet details → Order booking → Order review → submit → saved → back to route or list. Add no features. Build nothing from "Do not build in the base".
- Keep every hook working, in its current position:
  - `window.gtApp` (app, router, cart, data, orders, schemes, fmt);
  - `app.on('screen:rendered')`, `cart.subscribe` and `router.go`;
  - the six empty, hidden slots: landing-top, route-badge, outlet-brief, booking-live, sku-hint, review-check.
- Keep these rules:
  - the demo date comes from config (never `new Date()` or `Date.now()`);
  - Reset demo is on every screen;
  - money is ₹ with Indian grouping;
  - tap targets are at least 48 px and contrast at least 4.5:1;
  - body text is 16 px;
  - no libraries, web fonts, images or real brand names.
- Make small, targeted edits. Don't rewrite the file wholesale. Work through the parts in order. After each part, stop and summarise it in 5 lines or fewer so I can check.

## Part 1: Bugs (fix these first)
1. **Tapping a product filters the list (HIGH).** In `modules['screens/book']`, the click handler matches `closest('[data-cat]')`. Every SKU `<li>` also carries `data-cat`, so tapping a row's name, quantity box or scheme chip switches the category to that row's and hides the other SKUs. Scope the handler to the chip buttons only (e.g. `.chip[data-cat]`) or rename the row attribute. This is why SKUs look "missing".
2. **The Landing page scrolls 16 px sideways at 390 px (HIGH).** The "See all outlets" button combines `.page-end` margins with `.btn-block { width: 100% }`. Fix it so its right edge is at most 374 px.
3. **The quantity field accepts decimals and negatives (MEDIUM).** "12.5" becomes 125 and "-5" becomes 5. Keep only the leading whole number (12.5 → 12, -5 → 0) and clamp to 0–999. When something is dropped, show a brief inline hint: "Whole cases only".
4. **Reset leaves old state behind (LOW).** Reset demo must also clear the outlet list's remembered search and filter, and `nav.hub`.
5. **The single file shows the wrong help text (LOW).** The data-error screen and some comments mention `python3 -m http.server` and `js/`. In this file, the error must name the broken data block (e.g. "data-products: …") and say how to fix it. Update the comments to match.
6. **Crates vs cases (LOW).** Glass SKUs (caseLabel "crate") must say "crates" everywhere, not only on Review. That includes the booking footer, the free-case text, the Landing status, toasts and the saved screen (e.g. "12 cases + 2 crates").
7. **Footer separator (LOW).** The booking footer reads "14 cases ₹6,664". Make it "14 cases · ₹6,664".
8. **Scheme wording (LOW).**
   - The purity program says "Enrolled" even when the last audit failed (Shubh Mangal: pure = false). Say "Eligible" and show the last audit result.
   - For SCH-NEW, check registration age before "First order only". An old outlet should read "Only in the first 90 days".
9. **Base for the New Outlet 12% (LOW, a decision).** Today it is 12% of (gross − Mango discount). The spec says "12% off the whole order", so use 12% of the gross order value unless I say otherwise. Put the rule in a comment so the data generator can match it.

## Part 2: Design refresh (base screens only)
Replace the current "field notebook" styling with this direction:

> premium modern B2B mobile app, 390px-first, extremely clean and fast for one-handed field use. Strong hierarchy, generous whitespace, crisp cards, restrained colour palette, clear typography, subtle elevation, polished but not decorative. Prioritise scanability and speed over visual novelty. Make the base screens intentionally simple so the product feature feels like the hero.

Concretely:
- **Tokens.** Redefine the tokens in `:root` (colour, type, spacing, radius, elevation) and restyle everything through them.
  - Colours: cool-neutral surfaces on white or near-white; one action colour (blue is fine); one attention colour for dues and warnings; quiet success and neutral tints.
  - Keep the colour rules: the action colour is for actions and selection only, the attention colour is for attention only, and colour is never used alone (always text plus an icon).
- **Type.** Use one sans-serif family (the system UI stack) everywhere. Remove all decoration:
  - the serif display font;
  - the monospace uppercase section labels;
  - the lined-paper and margin-rule login background;
  - the hatched month bar.

  Use a tight type scale (12/14/16/18/22/28) with clear weights.
- **Surfaces.** Use subtle elevation: a 1 px border or a soft shadow, not both heavy. Use a consistent 12–16 px radius and 16 px screen gutters.
- **Order booking must be scannable:**
  - All five category chips (All · Sparkling · Juice drinks · Water · Energy) are fully visible at both 360 px and 390 px. No chip hides behind a horizontal scroll: wrap them, tighten them or use a segmented control.
  - SKU rows are compact enough that at least 7 SKUs show above the sticky footer at 390 × 844. For example: the name on one line, pack and rate on one line, a small scheme chip, and the stepper still 48 px.
  - Search stays first, and the sticky toolbar is as short as possible.
- **Outlet list.** No filter may hide off-screen without a visible cue. Either wrap the chips, or keep All and Today's route as chips and move channels into a compact "Channel" filter.
- **Outlet details, simpler:**
  - Keep these visible: header; order-saved and closure callouts; last order and visit; payment; schemes; the last 3 orders; visit notes.
  - Move cooler, upcoming bookings and the 13-month strip into one "More details" section, collapsed by default.
  - Keep the `outlet-brief` slot directly under the header.
- **Landing, Review, Saved and Login.** Use the same system with a simpler hero (no big greeting treatment) and one clear primary action per screen.
- **Demo bar.** It stays visible on every screen. At 390 px it must show the full "Demo · Tue 28 Apr 2026 · Pune West" without truncating the date, with Reset demo one tap away. Keep it visually distinct from the app, since it is a demo aid.
- Don't change the meaning of any copy, remove any required field or move the slots.

## Part 3: Data
The data in the file is still a STUB. Every `meta.note` starts with "STUB", which is why a STUB badge shows. The real persona dataset comes from a separate chat and must follow "Shared · Data contract" in the spec.

1. **Loading, for brief compliance.** The brief says persona data must "sit in data files that the prototype reads". Change loading as follows:
   - When the page is served over http(s), first fetch `data/config.json` next to the HTML. If it exists, load every file from `data/<name>.json`, falling back to the embedded block for any file that fails. If `data/config.json` is missing, use the embedded blocks for everything, with no further requests.
   - When the file is opened from disk, use the embedded blocks.
   - Keep one embedded block per file, with the same ids.
   - Log where each file came from, e.g. `[data] products ← data/products.json`.
2. **If I give you the real `data/*.json` files,** paste each into its embedded block, escaping `</` as `<\/`. Then check:
   - the STUB badge is gone;
   - every screen renders for all 8 outlets;
   - history.json matches orders.json week by week;
   - nothing is dated after 2026-04-28 except the items the contract allows.
3. **If I don't give you the files,** don't invent persona data. Leave the stub, but list these gaps in your final summary so I can hand them to the data chat:
   - Orders, visits and history must cover 2024-12-30 → 2026-04-26. The stub only covers 3 Mar – 21 Apr 2026.
   - Credit consistency:
     - OUT-04 needs a peak order above its ₹3,000 limit;
     - OUT-02's orders (about ₹5,200) exceed its ₹4,000 limit while ₹1,600 is due;
     - OUT-03 has an order of ₹16,882 against a ₹15,000 limit.

     Make these consistent with the personas.
   - Add at least one outlet not on today's route, or confirm that having all 8 on the route is intended. Right now "Not on today's route" can never be shown.
   - Calendar:
     - real regionIndex and phases (these are placeholders now);
     - more dated events (IPL evenings, 2025 events);
     - a `highway` tag on OUT-06.
   - `peers.json`: optional, but needed later for the thin-data outlets.
   - `meta.generatedBy` should be `scripts/generate_data.py`. Add est flags for the WT500 and EN250 shelf lives.

## Part 4: Verify, and report the numbers
Check at 390 × 844 and at 360 × 780:
- **Width.** Compare `document.documentElement.scrollWidth` with the fixed width (390 or 360), not with `window.innerWidth`, which grows with the page and hides overflow. They must be equal on every screen.
- **Sizes.** Every tap target is at least 48 px tall, body text is at least 16 px, and no text is under 12 px.
- **Booking.**
  - Tapping a row, quantity box or scheme chip never changes the category.
  - All 13 SKUs are reachable, and at least 7 show without scrolling.
  - Typing "12.5" gives 12, and "1,200" gives 999.
- **Flow checks.** Walk the flow at:
  - Mauli: a free case at 10 pooled cases, and the cap reached at 20.
  - Thanda Corner: 4 of 4 uses taken, so no free case.
  - Ashirwad: the first-order 12%.
  - Samarth: overdue shown in the attention colour.
  - Sunrise: the closure.

  Also:
  - switch outlets with an unsaved cart;
  - double-tap Submit;
  - use Reset from the booking screen.
- **From disk.** Open the file by double-clicking it in Finder (file://) and confirm it runs.

Finish with a table of every item in Parts 1–4, each marked fixed, changed or left as is (with the reason).

## For later: do not build now
When the feature is built later, it keeps the same visual system. Make the seasonal recommendation feel like a high-confidence decision aid, not a dashboard. At a glance it shows the recommendation, the quantity, a concise reason and the key guardrail. It uses retailer-readable language and has an obvious edit or accept path. Live cart changes must visibly recalculate the recommendation. **Do not redesign the whole app when building the feature. Preserve the basic flow and invest the polish in the ordering and recommendation experience.**
