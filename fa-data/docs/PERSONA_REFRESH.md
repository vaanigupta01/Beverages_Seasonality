# Persona number refresh for `personas_v2.md`

Generated from the prototype dataset (seed 20260428, 240 outlets, 2024-01-01 to 2026-04-27).
These replace the figures in `personas_v2.md` section 7 and the "Example in our data" tables.
All counted **by order date**, which is the method the app's 12-month strip uses.

## Section 7 replacement table

| Outlet | 2025 monthly cases (Jan -> Dec) | Lift | Best month | Typical winter order | Typical peak order | Largest 2025 order | 2026 to date vs 2025 | Orders on file |
|---|---|---|---|---|---|---|---|---|
| OUT-01 | 34 40 50 79 70 48 47 34 46 39 37 44 | 2.14 | Apr | 9.6 / Rs 5926 | 15.2 / Rs 7777 | 19 on 2025-05-06 | +14.7% | 121 |
| OUT-02 | 6 6 8 12 8 6 6 6 9 6 6 6 | 2.0 | Apr | 3.1 / Rs 2141 | 3.9 / Rs 2416 | 4 on 2025-05-27 | +3.6% | 60 |
| OUT-03 | 38 45 68 91 71 44 45 36 45 41 39 43 | 2.19 | Apr | 10.4 / Rs 4903 | 18.8 / Rs 8950 | 22 on 2025-04-15 | +16.4% | 121 |
| OUT-04 | 2 3 3 9 6 3 3 2 2 3 3 3 | 3.6 | Apr | 2.5 / Rs 906 | 4.8 / Rs 1691 | 6 on 2025-05-27 | +16.7% | 30 |
| OUT-05 | 10 11 11 8 0 7 11 10 15 2 11 11 | 1.43 | Sep | 3.3 / Rs 804 | 2.9 / Rs 703 | 4 on 2025-12-29 | -10.0% | 73 |
| OUT-06 | 34 39 24 50 50 9 9 9 20 33 43 41 | 1.37 | Apr | 12.6 / Rs 6692 | 16.2 / Rs 7992 | 20 on 2025-04-23 | +10.9% | 84 |
| OUT-07 | 185 238 311 317 209 130 198 173 211 181 182 220 | 1.5 | Apr | 49.5 / Rs 31044 | 56.9 / Rs 35411 | 168 on 2025-03-25 | +1.9% | 121 |
| OUT-08 | 0 0 0 0 0 0 0 0 0 0 0 0 | - | - | - / Rs - | - / Rs - | - | -% | 0 |

**Lift** = best month / average of January and February.

## Territory figures for the deck

| Measure | Value |
|---|---|
| Summer swing, definition | peak-month cases / average of Jan and Feb cases |
| Summer swing, outlets of meaningful size (>= 4 cases/month base) | n=155, median **2.22x**, range 1.29x to 8.92x, p25 1.86x, p75 2.84x |
| Summer swing, small-base outlets reported separately | n=25, median 4.67x, up to 11.33x |
| March readiness, definition | March cases / that outlet's own peak-month cases |
| March readiness | median **58%**, range 0% to 98%, spread **98 points** |

**Important for the deck.** These are our synthetic territory's figures. The numbers on the
Research slides come from the provided field data (median swing 1.9x, March readiness median 70%,
range 26-88%, a 62-point spread). Keep the two sources labelled separately. Our synthetic route
ramps a little later than the sample route, which is deliberate: it gives the feature outlets to help.

## What changed against `personas_v2.md`

| Item | v2 said | Dataset now says |
|---|---|---|
| History depth | 2025 plus 2026 to date | **2024, 2025 and 2026 to date.** Two prior seasons, so the forward baseline can take a median across years instead of trusting one |
| OUT-06 best month | December | **April**, with December close behind. The monsoon lull is real (9 cases in Jun, Jul and Aug against 41 in Dec) |
| OUT-07 best month | March weighted, April by order date | **April by order date**, March second. Unchanged in substance |
| OUT-05 | Zero in May | **Confirmed.** Zero in May, and the Diwali break shows too |
| Focus packs | CL250, CL200G, MG150T, WT1000 | **Unchanged** |
| 2026 to date | OUT-01 +12%, OUT-03 +11% | +14.7%, +16.4%. Update the sheets |
