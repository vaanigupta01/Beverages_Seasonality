// The rep's own numbers: pre-season placement, month progress, today's calls and the
// leaderboard figures. Always computed from orders.json + visits.json + the orders placed
// in the demo, so they move when the rep submits an order. Other reps' figures are the
// synthetic ones in data/field.json (labelled on screen).

import * as data from '../data.js';
import * as orders from '../orders.js';
import * as fmt from '../format.js';

const LOOKBACK = 30;   // "last 30 days" for calls and coverage

/** Outlets assigned to the signed-in rep. */
export const myOutlets = () => data.outlets().filter((o) => (o.repId ?? data.myRepId()) === data.myRepId());
const isMine = (outletId) => (data.outlet(outletId)?.repId ?? data.myRepId()) === data.myRepId();

/** Every order the rep gets credit for: past orders at their outlets, plus demo orders
 *  (at another rep's outlet a demo order earns 50% credit, per field.crossTerritory). */
function creditedOrders() {
  const share = (data.field().crossTerritory?.incentiveCreditPct ?? 50) / 100;
  const past = myOutlets().flatMap((o) => data.pastOrders(o.id)).map((o) => ({ order: o, weight: 1 }));
  const demo = orders.demoOrders().map((o) => ({ order: o, weight: isMine(o.outletId) ? 1 : share }));
  return [...past, ...demo];
}

const casesIn = (list, { from, to, skus = null }) => list
  .filter(({ order }) => order.date >= from && order.date <= to)
  .reduce((n, { order, weight }) => n + weight * order.lines
    .filter((l) => !skus || skus.includes(l.sku))
    .reduce((m, l) => m + (l.cases || 0), 0), 0);

function progress(target, achieved, to) {
  const today = data.demoDate();
  const pct = target ? Math.round((achieved / target) * 100) : 0;
  const daysLeft = Math.max(0, fmt.daysBetween(today, to));
  const remaining = Math.max(0, Math.round(target - achieved));
  return { target, achieved: Math.round(achieved), remaining, pct, daysLeft, perDay: daysLeft ? Math.ceil(remaining / daysLeft) : remaining };
}

/** Pre-season placement: focus-SKU cases booked across the rep's outlets in the window. */
export function preSeason() {
  const t = data.field().targets.preSeason;
  const to = t.to < data.demoDate() ? t.to : data.demoDate();
  return { ...t, ...progress(t.target, casesIn(creditedOrders(), { from: t.from, to, skus: t.skus }), t.to) };
}

export function month() {
  const t = data.field().targets.month;
  return { ...t, ...progress(t.target, casesIn(creditedOrders(), { from: t.from, to: data.demoDate() }), t.to) };
}

/** Today's route work: visits with an order, focus SKUs placed. */
export function today() {
  const d = data.demoDate();
  const route = data.route();
  const todays = orders.demoOrders().filter((o) => o.date === d);
  const visited = new Set(todays.map((o) => o.outletId));
  const focus = data.config().focusSkus;
  const withFocus = new Set(todays.filter((o) => o.lines.some((l) => focus.includes(l.sku) && l.cases)).map((o) => o.outletId));
  const focusCases = todays.reduce((n, o) => n + o.lines.filter((l) => focus.includes(l.sku)).reduce((m, l) => m + l.cases, 0), 0);
  const next = route.find((o) => !visited.has(o.id)) ?? null;
  return { routeCount: route.length, visited: visited.size, productive: todays.length ? visited.size : 0, withFocus: withFocus.size, focusCases, next };
}

/** The leaderboard metrics for the signed-in rep (definitions in field.json). */
export function myMetrics() {
  const d = data.demoDate();
  const from = fmt.addDays(d, -LOOKBACK);
  const mine = myOutlets();
  const focus = data.config().focusSkus;
  const all = creditedOrders();
  const recent = all.filter(({ order }) => order.date >= from && order.date <= d);
  const active = new Set(recent.map(({ order }) => order.outletId));
  const withFocus = new Set(recent.filter(({ order }) => order.lines.some((l) => focus.includes(l.sku) && l.cases)).map(({ order }) => order.outletId));
  let calls = 0; let productive = 0;
  mine.forEach((o) => (data.visits(o.id)?.visits ?? []).forEach((v) => {
    if (v.date >= from && v.date < d && v.done) { calls += 1; if (v.outcome === 'order') productive += 1; }
  }));
  const todayOrders = orders.demoOrders().filter((o) => o.date === d);
  calls += new Set(todayOrders.map((o) => o.outletId)).size;
  productive += new Set(todayOrders.map((o) => o.outletId)).size;
  const pre = preSeason();
  return {
    repId: data.myRepId(), name: null, isMe: true, outlets: mine.length,
    preSeasonPct: pre.pct,
    productiveCallsPct: calls ? Math.round((productive / calls) * 100) : 0,
    activeOutletsPct: Math.round((active.size / mine.length) * 100),
    focusCoveragePct: active.size ? Math.round((withFocus.size / active.size) * 100) : 0,
    casesOrdered: Math.round(casesIn(all, { from: pre.from, to: d })),
    monthTargetPct: month().pct,
  };
}

/** → { rows (ranked), me, rank, total, metric } ranked by pre-season placement %, the priority metric. */
export function leaderboard(name) {
  const lb = data.field().leaderboard;
  const me = { ...myMetrics(), name, territory: data.config().region.name };
  const rows = [...lb.reps.map((r) => ({ ...r, isMe: false })), me]
    .sort((a, b) => b.preSeasonPct - a.preSeasonPct || b.productiveCallsPct - a.productiveCallsPct);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return { rows, me, rank: me.rank, total: rows.length, lb };
}

// ---- today's gain and milestones ---------------------------------------------------------

/** Focus-pack cases added to the summer target by today's orders (demo orders only). */
export function targetToday() {
  const d = data.demoDate();
  const t = data.field().targets.preSeason;
  const share = (data.field().crossTerritory?.incentiveCreditPct ?? 50) / 100;
  return Math.round(orders.demoOrders().filter((o) => o.date === d)
    .reduce((n, o) => n + (isMine(o.outletId) ? 1 : share) * o.lines.filter((l) => t.skus.includes(l.sku)).reduce((m, l) => m + l.cases, 0), 0));
}

/**
 * Small wins for today, in the order they are usually reached. Each is { id, icon, text key, vars }.
 * Test them in the demo: book the first order; book at 3 outlets with a focus pack; reach 5 outlets;
 * add 100 focus cases in a day; every 5% step of the summer target.
 */
export function milestones() {
  const day = today();
  const pre = preSeason();
  const gain = targetToday();
  const startPct = pre.target ? Math.floor(((pre.achieved - gain) / pre.target) * 100) : 0;
  const out = [];
  if (day.visited >= 1) out.push({ id: 'first-order', icon: 'check', key: 'f.ms.first' });
  if (day.withFocus >= 3) out.push({ id: 'focus-3', icon: 'target', key: 'f.ms.focus3' });
  if (day.visited >= 5) out.push({ id: 'five', icon: 'route', key: 'f.ms.five' });
  if (day.visited >= 10) out.push({ id: 'ten', icon: 'route', key: 'f.ms.ten' });
  if (gain >= 100) out.push({ id: 'gain-100', icon: 'trend', key: 'f.ms.gain100' });
  for (let step = Math.ceil((startPct + 1) / 5) * 5; step <= pre.pct; step += 5) {
    out.push({ id: `step-${step}`, icon: 'trophy', key: 'f.ms.step', vars: { pct: step } });
  }
  return out;
}
