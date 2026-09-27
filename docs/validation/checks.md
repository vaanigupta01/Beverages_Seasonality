# Data checks

Written by `scripts/generate_data.py` (seed 20260428). Re-run the script to refresh.

| # | Check | Result | Detail |
|---|---|---|---|
| 1 | history.json equals orders.json summed by week and SKU | PASS | 40 outlet-SKU series × 69 weeks |
| 2 | No order, past visit or history week after 2026-04-26 | PASS | future dates only in nextVisitAfterToday, closures, bookings, forecast, events and peers |
| 3 | calendar.json stops at 2026-W18; no hindsight (22 Jun onset, May record heat) | PASS |  |
| 4 | Tier ↔ visits a month ↔ visit cadence agree | PASS | OUT-01 Diamond, OUT-02 Bronze, OUT-03 Gold, OUT-04 Iron, OUT-05 Silver, OUT-06 Silver, OUT-07 Diamond, OUT-08 Bronze |
| 5 | Scheme eligibility and caps: free cases only where the tier/cooler allows; ≤ 4 Summer Single-Serve uses per outlet per month (by order date) | PASS | OUT-03 2026-04: 4; OUT-07 2026-03: 1 |
| 6 | Closures ↔ zero orders (OUT-05), and visits in closures are done: false | PASS | 7 visits fell in closures |
| 7 | No cooler ↔ a flatter summer and a take-home mix (OUT-02 vs OUT-01, OUT-03) | PASS | lifts by order date 02 1.5× · 01 2.7× · 03 3.1×; OUT-02 take-home share 80% |
| 8 | One-off events show in the weekly data | PASS | OUT-01 CL250 in 2025-W16: 0 (W15 4, W17 4) · OUT-02 19 May 2025: 5 cases · OUT-03 cold packs W17/W18/W19: 16/11/16 |
| 9 | Credit matches each story | PASS | 04 peak order ₹1,916 vs ₹1,500 limit · 02 largest order ₹2,682 vs ₹2,700 room · 06 today's cover ₹14,520 vs ₹12,000 room |
| 10 | OUT-03 has used all 4 April uses (7, 14, 21 Apr; one order ≥ 20 pooled); OUT-01 still has uses left | PASS | 03: [{'date': '2026-04-07', 'pooled': 10, 'free': 1}, {'date': '2026-04-14', 'pooled': 21, 'free': 2}, {'date': '2026-04-21', 'pooled': 10, 'free': 1}] · 01 uses: 0 |
| 11 | From 20 Apr 2026: ≤ 6 paid cases of 250 ml cola per order; no mango 600 ml | PASS |  |
| 12 | OUT-08: no orders, no visits, history {}, registered 2026-04-22 | PASS |  |
| 13 | Every file flagged est; no OT-0xx codes; replaced names absent | PASS |  |
| 14 | PTR = MRP × units × 0.85 (0.80 water), rounded | PASS | CL200G ₹204, CL250 ₹476, LL250 ₹476, OR250 ₹476, CL300C ₹816, CL750 ₹816, OR1250 ₹663, CL2250 ₹727, MG150T ₹340, MG600 ₹775, WT1000 ₹240, WT500 ₹192, EN250 ₹408 |
| 15 | All of data/ under about 250 KB | PASS | 208 KB |
| 16 | No two personas share a shape (peak month, lift; by order date) | PASS | 01: month 4, 2.7×; 02: month 4, 1.5×; 03: month 4, 3.1×; 04: month 4, 5.0×; 05: month 1, 1.0×; 06: month 12, 1.2×; 07: month 4, 1.8× |

Not automated: "each persona is recognisable from its chart alone" is checked by eye on the persona sheets, which are drawn from `summary.json`.
