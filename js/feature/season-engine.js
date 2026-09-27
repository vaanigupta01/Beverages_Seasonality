// Season Check engine v2: how much an outlet should order today, pack by pack, and what in the
// live cart needs a word. Pure calculation (no DOM): screens call need() and check() and render.
//
//   Expected(pack) = recent rate × season ratio × heat × rain × events, over the selling days
//                    this order must cover (delivery → the next delivery).
//   Modes:  forward (normal) · closing (closure ahead: selling days only) · bookings (event-led)
//           · peers (thin history: similar shops) · silent (wholesale).
//   Realisable = Expected after the gates, in rules v1.1 order:
//                closure → de-load → distributor → cooler → credit → safe cap.
//   Leaked = Expected − Realisable (before and after swaps).
//
// Only three numbers come from the paper (Keleş, Gómez-Acevedo & Shaikh 2018, IJPE 195), which uses
// US data in °F: +2.1% per °F in a heat wave (= 3.78% per °C), −0.4% per °F in a cold wave
// (= 0.72% per °C), and the asymmetry. 1 °C = 1.8 °F, so per-°C effects are 1.8 × the per-°F ones. Everything else is
// in PARAMS and labelled. Full spec: docs/season-check-algo-v2.md.
//
// APP ADDITION (marked "APP:" below): stock already on the shelf (current_stock.json, the rep's
// count where there is one) is netted off each pack after rounding and before the gates, and
// reported as `totals.onHand`, not as leak. Switch it off with PARAMS.netOnHand = false.

import * as data from '../data.js';
import * as orders from '../orders.js';
import * as schemes from '../schemes.js';
import * as fmt from '../format.js';

export const PARAMS = {
  rateWeeks: 4,                     // v1.1 forward baseline: the last 4 complete weeks of this year
  seasonRatioClamp: [0.5, 2.0],     // guard against a bad index week
  amplitudeClamp: [0.2, 2.0],       // outlet's season amplitude vs the region's (from its own 2025 history)
  heat: {
    paperPerF: 0.021,               // PAPER: +2.1% weekly demand per °F above normal, in a heat wave (US data)
    paperColdPerF: 0.004,           // PAPER: −0.4% per °F below normal, in a cold wave
    slopeAvg: 0.021 * 1.8,          // = 0.0378 per °C (our temperatures are °C; 1 °C = 1.8 °F)
    coldSlope: 0.004 * 1.8,         // = 0.0072 per °C
    slopeClamp: [0.009, 0.072],     // ASSUMPTION: exposure scaling kept within 0.9–7.2%/°C (0.5–4%/°F)
    // Pune mean daily maximum by month, 1991–2020 (IMD via the Wikipedia climate table). Verify
    // against IMD's Shivajinagar station normals before quoting.
    normalMaxC: [29.8, 32.2, 35.6, 37.9, 37.3, 32.0, 28.3, 27.8, 29.5, 31.5, 30.7, 29.5],
    // Weekly maxima for the rate window (research Table A; IMD readings where found, else estimates).
    recentMaxC: { '2026-W14': 37.5, '2026-W15': 39.8, '2026-W16': 39.5, '2026-W17': 39.0 },
    // IMD heat-wave criteria (plains). A single forecast only shows "heat-wave conditions".
    imd: { minMaxC: 40, departure: 4.5, severeDeparture: 6.4, absoluteC: 45, severeAbsoluteC: 47 },
  },
  rain: { none: 1.0, low: 1.0, moderate: 0.85, high: 0.6 },   // ASSUMPTION (expected factor per day)
  deloadFactor: 0.7,                // ASSUMPTION: rain or monsoon phase inside the cover window
  thin: { minAgeDays: 90, minInSeasonOrders: 3 },           // v1.1 thin-history rule
  newOutletStart: 0.8,              // ASSUMPTION: first order = 80% of the similar-shop estimate, top up next visit
  coolerTurnsPerDay: 0.25,          // CALIBRATED: a normal peak order fits, a doubled one doesn't (research Table F turns don't fit our volumes)
  safeCap: 1.5,                     // v1.1: a suggestion ≤ 1.5 × the best order in the last 8 weeks
  largerThanUsual: 1.5,             // v1.1: cart > 1.5 × expected → rep-only note
  pace: { minGap: 1, pct: 0.15, maxFindings: 3 },           // a pace gap must be ≥ 1 case and ≥ 15%
  missingRegular: { lastOrders: 4, minHits: 3 },            // v1.1
  thresholdWithin: 2,               // nudge when 1–2 cases short of a scheme the outlet can get
  substitutes: { CL250: ['CL200G', 'LL250', 'CL300C'], MG600: ['MG150T'] },   // first in stock wins; CL200G keeps Summer Single-Serve
  noFizzTags: ['school'],           // FSSAI 2020 school rule: no sparkling or energy drinks suggested
  noFizzCategories: ['Sparkling', 'Energy'],
  netOnHand: true,                  // APP: subtract estimated stock on hand (current_stock.json) from the order
};

// ---- small helpers -------------------------------------------------------------------------

const clamp = (x, [lo, hi]) => Math.min(hi, Math.max(lo, x));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const multOf = (m) => (Array.isArray(m) ? mean(m.filter((v) => v != null)) : Number(m ?? 1));
const r1 = (x) => Math.round(x * 10) / 10;
const productName = (sku) => data.product(sku)?.name ?? sku;
const isChilledSS = (p) => p?.chilled === 'yes' && p?.singleServe;
const isFizz = (p) => PARAMS.noFizzCategories.includes(p?.category);

const eventApplies = (e, o) => {
  const ch = e.appliesTo?.channels ?? [];
  const tags = e.appliesTo?.tags ?? [];
  return (!ch.length || ch.includes(o.channel)) && (!tags.length || tags.some((x) => (o.tags ?? []).includes(x)));
};
const isLocationEvent = (e) => !(e.appliesTo?.channels ?? []).length && (e.appliesTo?.tags ?? []).length > 0;

function daysFrom(from, n) {
  return Array.from({ length: Math.max(0, n) }, (_, i) => fmt.addDays(from, i));
}

/** Pune normal max for a date: monthly means pinned to mid-month, linearly interpolated. */
function normalMax(iso) {
  const N = PARAMS.heat.normalMaxC;
  const d = fmt.parseISO(iso);
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const [a, b, w] = day >= 15 ? [m, (m + 1) % 12, (day - 15) / 30] : [(m + 11) % 12, m, (day + 15) / 30];
  return N[a] + (N[b] - N[a]) * w;
}

// ---- the order window ----------------------------------------------------------------------

/** { today, delivery, nextVisit, nextDelivery, days[] }: the days today's order must last. */
export function coverFor(o) {
  const today = data.demoDate();
  const lead = data.config().distributor?.deliveryLeadDays ?? 1;
  const v = data.visits(o.id);
  const nextVisit = v?.nextVisitAfterToday ?? fmt.addDays(today, v?.cadenceDays ?? Math.round(28 / (o.visitsPerMonth || 4)));
  const delivery = fmt.addDays(today, lead);
  const nextDelivery = fmt.addDays(nextVisit, lead);
  return { today, delivery, nextVisit, nextDelivery, days: daysFrom(delivery, fmt.daysBetween(delivery, nextDelivery)) };
}

// ---- season index and amplitude ------------------------------------------------------------

function indexFor(week) {
  const ri = data.calendar()?.regionIndex ?? {};
  const year = week.slice(0, 4);
  const byYear = ri[year] ?? {};
  if (byYear[week] != null) return byYear[week];
  // No index past the demo week (no hindsight): hold the latest known week.
  const known = Object.keys(byYear).filter((k) => k <= week).sort();
  return known.length ? byYear[known.at(-1)] : 1;
}

const weekIdx = () => data.historyWeeks().weeks;
const weekStart = (i) => data.historyWeeks().weekStarts?.[i];

function totalsByWeek(outletId) {
  const h = data.history(outletId);
  const n = weekIdx().length;
  const out = Array(n).fill(0);
  Object.values(h).forEach((arr) => arr.forEach((v, i) => { out[i] += v || 0; }));
  return out;
}

const rolling4 = (xs) => xs.map((_, i) => (i >= 3 ? mean(xs.slice(i - 3, i + 1)) : null)).filter((x) => x != null);

/** Lift in 2025: best 4-week average ÷ Jan–Feb average. */
function lift2025(series) {
  const weeks = weekIdx();
  const jf = [];
  const yr = [];
  weeks.forEach((w, i) => {
    if (!w.startsWith('2025')) return;
    yr.push(series[i]);
    const ws = weekStart(i) ?? '';
    if (ws.startsWith('2025-01') || ws.startsWith('2025-02') || (!ws && Number(w.slice(6)) <= 9)) jf.push(series[i]);
  });
  const base = mean(jf);
  const peak = Math.max(0, ...rolling4(yr));
  return base > 0 ? peak / base : null;
}

const memo = new Map();
const cached = (key, fn) => (memo.has(key) ? memo.get(key) : (memo.set(key, fn()), memo.get(key)));

function regionLift() {
  return cached('regionLift', () => {
    const ri = data.calendar()?.regionIndex?.['2025'] ?? {};
    return lift2025(weekIdx().map((w) => ri[w] ?? 0)) ?? 2.2;
  });
}

/** How strongly this outlet's season follows the region's (k = 1: same shape). */
function amplitude(o) {
  return cached(`k:${o.id}`, () => {
    const L = lift2025(totalsByWeek(o.id));
    if (!L) return 1;
    return clamp((L - 1) / (regionLift() - 1), PARAMS.amplitudeClamp);
  });
}

// ---- heat exposure (per outlet × pack) -----------------------------------------------------

function sigma(sku) {
  const ps = data.products();
  const avg = mean(ps.map((p) => p.summerMultiplier ?? 1));
  const p = data.product(sku);
  return avg > 1 ? Math.max(0, ((p?.summerMultiplier ?? avg) - 1) / (avg - 1)) : 1;
}

function exposure(o, sku) {
  const L = lift2025(totalsByWeek(o.id));
  return Math.max(0, (L ?? regionLift()) - 1) * sigma(sku);
}

/** Volume-weighted normaliser so the average slope stays at the paper's 2.1%/°F (3.78%/°C). */
function exposureNorm() {
  return cached('Ebar', () => {
    let sw = 0;
    let swr = 0;
    data.outlets().forEach((o) => {
      const h = data.history(o.id);
      Object.entries(h).forEach(([sku, arr]) => {
        const w = arr.reduce((a, b) => a + (b || 0), 0);
        if (!w) return;
        sw += w;
        swr += w * Math.sqrt(exposure(o, sku));
      });
    });
    return sw ? (swr / sw) ** 2 : 1;
  });
}

function slopeFor(o, sku) {
  const E = exposure(o, sku);
  return clamp(PARAMS.heat.slopeAvg * Math.sqrt(E / exposureNorm()), PARAMS.heat.slopeClamp);
}

const heatOf = (slope, a) => 1 + slope * Math.max(0, a) - PARAMS.heat.coldSlope * Math.max(0, -a);

// ---- weather ---------------------------------------------------------------------------------

function forecastFor(iso, whatIf) {
  if (whatIf?.forecastMaxC != null) return { maxC: whatIf.forecastMaxC, rainChance: whatIf.rainChance ?? 'none' };
  const p = (data.calendar()?.forecast?.periods ?? []).find((x) => x.from <= iso && iso <= x.to);
  if (!p) return null;
  const maxC = Array.isArray(p.maxC) ? mean(p.maxC) : p.maxC;
  return { maxC, rainChance: p.rainChance ?? 'none' };
}

function heatWaveFlag(maxC, anomaly) {
  const k = PARAMS.heat.imd;
  if (maxC >= k.severeAbsoluteC || (maxC >= k.minMaxC && anomaly > k.severeDeparture)) return 'severe';
  if (maxC >= k.absoluteC || (maxC >= k.minMaxC && anomaly >= k.departure)) return 'conditions';
  return 'none';
}

/** Average anomaly of the rate window (recent weeks already carry their own weather). */
function recentAnomaly(weeks) {
  const rec = PARAMS.heat.recentMaxC;
  const xs = weeks.filter((w) => rec[w] != null).map((w) => {
    const i = weekIdx().indexOf(w);
    const mid = weekStart(i) ? fmt.addDays(weekStart(i), 3) : null;
    return mid ? rec[w] - normalMax(mid) : null;
  }).filter((x) => x != null);
  return xs.length ? mean(xs) : 0;
}

// ---- events ------------------------------------------------------------------------------------

function eventFactor(o, sku, iso, { locationOnly = false } = {}) {
  let f = 1;
  (data.calendar()?.events ?? []).forEach((e) => {
    if (e.anchor || !(e.from <= iso && iso <= e.to) || !eventApplies(e, o)) return;
    if (locationOnly && !isLocationEvent(e)) return;
    if (Array.isArray(e.packs) && e.packs.length && !e.packs.includes(sku)) return;
    f *= multOf(e.multiplier);
  });
  return f;
}

function eventsIn(o, days, { locationOnly = false } = {}) {
  const from = days[0];
  const to = days.at(-1);
  if (!from) return [];
  return (data.calendar()?.events ?? [])
    .filter((e) => !e.anchor && e.from <= to && e.to >= from && eventApplies(e, o) && (!locationOnly || isLocationEvent(e)))
    .map((e) => ({ id: e.id, name: e.name, from: e.from, to: e.to, factor: r1(multOf(e.multiplier) * 100) / 100, packs: e.packs ?? null }));
}

// ---- history helpers -------------------------------------------------------------------------

const pastOnly = (o, today) => orders.allOrdersFor(o.id).filter((x) => x.source !== 'demo' && x.date < today);
const paid = (x) => orders.paidCases(x);

function isClosed(o, iso) {
  return (o.closures ?? []).some((c) => c.from <= iso && iso <= c.to);
}

function inSeasonOrders(o, today) {
  const ph = data.calendar()?.phases?.[today.slice(0, 4)] ?? {};
  const start = Object.keys(ph).sort().find((w) => ph[w] && ph[w] !== 'off-season');
  const past = pastOnly(o, today);
  if (!start) return past.length;
  return past.filter((x) => fmt.isoWeek(x.date) >= start).length;
}

function peerGroup(o) {
  const groups = data.peers()?.groups ?? [];
  const cool = o.cooler?.type ?? 'none';
  const coolKey = cool === 'none' ? 'none' : cool;
  return groups.find((g) => g.channel === o.channel && g.tier === o.tier && (g.cooler ?? 'none') === coolKey)
    ?? groups.find((g) => g.channel === o.channel && g.tier === o.tier)
    ?? groups.find((g) => (g.cooler ?? 'none') === coolKey && g.tier === o.tier)
    ?? null;
}

function recentMix(o, weeks = 12) {
  const h = data.history(o.id);
  const n = weekIdx().length;
  const mix = {};
  let tot = 0;
  Object.entries(h).forEach(([sku, arr]) => {
    const s = arr.slice(Math.max(0, n - weeks)).reduce((a, b) => a + (b || 0), 0);
    if (s > 0) { mix[sku] = s; tot += s; }
  });
  Object.keys(mix).forEach((k) => { mix[k] /= tot || 1; });
  return mix;
}

// ---- mode ------------------------------------------------------------------------------------

function modeFor(o, cover) {
  const today = cover.today;
  if (o.channel === 'Wholesale') return 'silent';
  if ((o.bookings ?? []).length) return 'bookings';
  if (cover.days.some((d) => isClosed(o, d))) return 'closing';
  const age = o.registeredOn ? fmt.daysBetween(o.registeredOn, today) : Infinity;
  if ((age < PARAMS.thin.minAgeDays || inSeasonOrders(o, today) < PARAMS.thin.minInSeasonOrders) && peerGroup(o)) return 'peers';
  return 'forward';
}

// ---- need(): the suggestion ------------------------------------------------------------------

/**
 * How much this outlet should order today, per pack, with the reasons.
 * opts.whatIf = { forecastMaxC, rainChance } replaces the forecast (for "what if a heat wave").
 */
export function need(outletId, opts = {}) {
  const o = data.outlet(outletId);
  if (!o) return null;
  const cover = coverFor(o);
  const mode = modeFor(o, cover);
  const weeks = weekIdx();
  const nW = weeks.length;
  const rateWeeks = weeks.slice(Math.max(0, nW - PARAMS.rateWeeks));
  const rateDays = rateWeeks.flatMap((w) => {
    const i = weeks.indexOf(w);
    return weekStart(i) ? daysFrom(weekStart(i), 7) : [];
  });
  const selling = cover.days.filter((d) => !isClosed(o, d));
  const h = data.history(o.id);
  const k = amplitude(o);
  const m = (idx) => 1 + k * (idx - 1);
  const explain = [];
  const skus = {};
  let peers = null;

  // Weather over the cover window (for display, and the heat factor).
  const fc = cover.days.map((d) => ({ d, f: forecastFor(d, opts.whatIf), n: normalMax(d) }));
  const withFc = fc.filter((x) => x.f);
  const aFc = (x) => (x.f ? x.f.maxC - x.n : 0);
  const aRecent = mode === 'forward' || mode === 'closing' ? recentAnomaly(rateWeeks) : 0;
  const maxFc = withFc.length ? Math.max(...withFc.map((x) => x.f.maxC)) : null;
  const worst = withFc.reduce((acc, x) => {
    const flag = heatWaveFlag(x.f.maxC, aFc(x));
    return flag === 'severe' || (flag === 'conditions' && acc !== 'severe') ? flag : acc;
  }, 'none');
  const rainDay = (x) => PARAMS.rain[x.f?.rainChance ?? 'none'] ?? 1;
  const phaseWeek = fmt.isoWeek(cover.delivery);
  const phase = data.calendar()?.phases?.[phaseWeek.slice(0, 4)]?.[phaseWeek] ?? null;
  const deload = ['decline', 'monsoon'].includes(phase)
    || withFc.some((x) => ['moderate', 'high'].includes(x.f.rainChance))
    || Boolean(data.calendar()?.forecast?.monsoonSignalNext14Days);

  // Season ratio: the index over the cover days vs the index over the rate window, scaled to this outlet.
  const idxCover = mean(cover.days.map((d) => m(indexFor(fmt.isoWeek(d)))));
  const idxRecent = mean(rateWeeks.map((w) => m(indexFor(w))));
  const seasonRatio = clamp(idxRecent > 0 ? idxCover / idxRecent : 1, PARAMS.seasonRatioClamp);

  if (mode === 'forward' || mode === 'closing' || mode === 'silent') {
    Object.entries(h).forEach(([sku, arr]) => {
      const recent = arr.slice(Math.max(0, nW - PARAMS.rateWeeks)).reduce((a, b) => a + (b || 0), 0);
      if (!recent) return;
      const rate = recent / (rateDays.length || 28);
      const slope = slopeFor(o, sku);
      const evRecent = mean(rateDays.map((d) => eventFactor(o, sku, d)));
      let exp = 0;
      selling.forEach((d) => {
        const x = fc.find((y) => y.d === d);
        const heat = heatOf(slope, aFc(x)) / heatOf(slope, aRecent);
        exp += rate * seasonRatio * heat * rainDay(x) * (eventFactor(o, sku, d) / (evRecent || 1));
      });
      skus[sku] = { rate: r1(rate * 7), slope: Math.round(slope * 1000) / 10, expected: exp };
    });
    explain.push(`Last ${PARAMS.rateWeeks} weeks: ${r1(Object.values(skus).reduce((a, s) => a + s.rate, 0))} cases a week`);
    explain.push(`Season: region index ${r1(mean(rateWeeks.map(indexFor)))} → ${r1(mean(cover.days.map((d) => indexFor(fmt.isoWeek(d)))))}; this outlet ×${seasonRatio.toFixed(2)}`);
  } else if (mode === 'bookings') {
    const booked = (o.bookings ?? []).filter((b) => b.date >= cover.delivery && b.date < cover.nextDelivery);
    const total = booked.reduce((n, b) => n + (b.expectedCases ?? 0), 0);
    const mix = recentMix(o);
    Object.entries(mix).forEach(([sku, share]) => { skus[sku] = { rate: null, slope: null, expected: total * share }; });
    explain.push(`${booked.length} bookings before the next delivery need ${total} cases`);
  } else if (mode === 'peers') {
    const g = peerGroup(o);
    Object.entries(g.weeklyCasesBySku ?? {}).forEach(([sku, byWeek]) => {
      const keys = Object.keys(byWeek).sort();
      const weekly = (w) => byWeek[w] ?? byWeek[keys.filter((x) => x <= w).at(-1) ?? keys[0]] ?? 0;
      const slope = slopeFor(o, sku);
      let exp = 0;
      selling.forEach((d) => {
        const x = fc.find((y) => y.d === d);
        exp += (weekly(fmt.isoWeek(d)) / 7) * heatOf(slope, aFc(x)) * rainDay(x) * eventFactor(o, sku, d, { locationOnly: true });
      });
      skus[sku] = { rate: r1(weekly(fmt.isoWeek(cover.delivery))), slope: Math.round(slope * 1000) / 10, expected: exp };
    });
    explain.push(`Estimate from ${g.outletsInGroup} similar shops nearby`);
    peers = { key: g.key, outlets: g.outletsInGroup };
  }

  // School rule: nothing sparkling suggested.
  const school = (o.tags ?? []).some((x) => PARAMS.noFizzTags.includes(x));
  if (school) Object.keys(skus).forEach((sku) => { if (isFizz(data.product(sku))) delete skus[sku]; });

  // Round to whole cases, keeping the total (largest remainder).
  const totalExp = Object.values(skus).reduce((a, s) => a + s.expected, 0);
  allocate(skus, totalExp);
  Object.values(skus).forEach((s) => { s.realisable = s.suggested; s.gates = []; });

  // New outlet: start below the estimate, top up at the next visit.
  const age = o.registeredOn ? fmt.daysBetween(o.registeredOn, cover.today) : Infinity;
  const newOutlet = mode === 'peers' && age < PARAMS.thin.minAgeDays && pastOnly(o, cover.today).length === 0;
  if (newOutlet) {
    allocate(skus, totalExp * PARAMS.newOutletStart, 'realisable');
    explain.push(`First order: ${Math.round(PARAMS.newOutletStart * 100)}% of the estimate, top up on ${fmt.shortDate(cover.nextVisit)}`);
  }

  // ---- gates, in rules v1.1 order -----------------------------------------------------------
  const gates = [];
  // APP: stock already on the shelf covers part of the need (rep's count, else the estimate).
  let onHand = 0;
  if (PARAMS.netOnHand && mode !== 'silent') {
    data.onHand(o.id).forEach((r) => {
      const s = skus[r.sku];
      const have = Math.max(0, Math.round(r.repCountedCases ?? r.estimatedCasesOnHand ?? 0));
      const take = s ? Math.min(s.realisable, have) : 0;
      if (take <= 0) return;
      s.realisable -= take;
      s.onHand = take;
      s.gates.push('on-hand');
      onHand += take;
    });
    if (onHand) {
      gates.push({ rule: 'on-hand', cases: onHand });
      explain.push(`About ${onHand} case${onHand === 1 ? '' : 's'} already on the shelf (estimated), so not re-ordered`);
    }
  }
  if (mode === 'closing') {
    const c = (o.closures ?? []).find((x) => cover.days.some((d) => x.from <= d && d <= x.to));
    gates.push({ rule: 'closing-soon', from: c?.from, to: c?.to, sellingDays: selling.length, days: cover.days.length });
  }
  if (deload && mode !== 'silent') {
    const all = Object.entries(skus);
    scaleTo(all, all.reduce((a, [, s]) => a + s.realisable, 0) * PARAMS.deloadFactor, 'deload');
    gates.push({ rule: 'deload', phase });
  }
  const swaps = distributorGate(skus, gates, school);
  if (mode === 'forward' || mode === 'peers') coolerGate(o, cover, skus, gates, selling.length);
  creditGate(o, cover, skus, gates, mode);
  if (mode === 'forward' || mode === 'closing') safeCapGate(o, cover, skus, gates);

  // Already booked today in the demo (the rep submitted, then came back): suggest only the rest.
  const bookedToday = {};
  orders.demoOrdersOn(o.id, cover.today).forEach((x) => x.lines.forEach((l) => { bookedToday[l.sku] = (bookedToday[l.sku] ?? 0) + (l.cases || 0); }));
  const bookedCases = Object.values(bookedToday).reduce((a, b) => a + b, 0);
  if (bookedCases > 0) {
    Object.entries(bookedToday).forEach(([sku, n]) => {
      if (!skus[sku]) return;
      skus[sku].realisable = Math.max(0, skus[sku].realisable - n);
      skus[sku].gates.push('ordered-today');
    });
    gates.push({ rule: 'ordered-today', cases: bookedCases });
    explain.push(`Already booked today: ${bookedCases} cases`);
  }

  const sum = (key) => Object.values(skus).reduce((a, s) => a + (s[key] || 0), 0);
  const expected = sum('expected');
  const realisable = sum('realisable');
  const swapped = swaps.reduce((a, s) => a + s.cases, 0);
  const value = priceOf(o, skus, 'realisable', cover.today);

  Object.values(skus).forEach((s) => { s.expected = r1(s.expected); });
  const weather = {
    maxC: maxFc,
    normalC: r1(normalMax(cover.delivery)),
    anomaly: withFc.length ? r1(mean(withFc.map(aFc))) : null,
    recentAnomaly: r1(aRecent),
    heatWave: worst,
    rain: withFc.map((x) => x.f.rainChance).includes('high') ? 'high' : withFc.map((x) => x.f.rainChance).includes('moderate') ? 'moderate' : withFc.length ? 'none/low' : 'no forecast',
    whatIf: Boolean(opts.whatIf),
  };
  if (weather.anomaly != null) explain.push(`Forecast ${r1(maxFc)}°C max, ${weather.anomaly >= 0 ? '+' : ''}${weather.anomaly}°C vs normal (recent weeks ${weather.recentAnomaly >= 0 ? '+' : ''}${weather.recentAnomaly}°C)`);

  return {
    outletId: o.id,
    mode,
    display: mode !== 'silent',       // wholesale: computed for analysis, never shown as advice
    newOutlet,
    peers,
    cover: { today: cover.today, delivery: cover.delivery, nextVisit: cover.nextVisit, until: cover.days.at(-1), days: cover.days.length, sellingDays: selling.length },
    phase,
    season: {
      k: Math.round(k * 100) / 100,
      regionRecent: r1(mean(rateWeeks.map(indexFor))),
      regionCover: r1(mean(cover.days.map((d) => indexFor(fmt.isoWeek(d))))),
      ratio: Math.round(seasonRatio * 100) / 100,
    },
    weather,
    events: mode === 'peers' ? eventsIn(o, selling, { locationOnly: true }) : eventsIn(o, selling),
    skus,
    totals: {
      expected: r1(expected),                                        // cases the outlet should sell to the next delivery
      suggested: sum('suggested'),                                   // the same, in whole cases
      realisable,                                                    // what can actually be supplied and sold (after gates and swaps)
      value,                                                         // ₹ net of schemes, for the realisable order
      swapped,                                                       // cases moved to a substitute pack
      onHand,                                                        // APP: cases covered by stock already on the shelf
      leaked: Math.max(0, sum('suggested') - onHand - realisable),   // demand the gates leave unserved (after swaps)
      leakedBeforeSwaps: Math.max(0, sum('suggested') - onHand - (realisable - swapped)),
    },
    swaps,
    gates,
    explain,
  };
}

/** Scales the chosen packs' `realisable` so they total `target` whole cases (largest remainder). */
function scaleTo(entries, target, gate) {
  const now = entries.reduce((a, [, s]) => a + s.realisable, 0);
  if (now <= target) return;
  const f = now > 0 ? target / now : 0;
  const parts = entries.map(([sku, s]) => [s, s.realisable * f]);
  parts.forEach(([s, x]) => { s.realisable = Math.floor(x); if (!s.gates.includes(gate)) s.gates.push(gate); });
  let left = Math.floor(target) - parts.reduce((a, [s]) => a + s.realisable, 0);
  parts.sort((a, b) => (b[1] - Math.floor(b[1])) - (a[1] - Math.floor(a[1]))).forEach(([s]) => { if (left > 0) { s.realisable += 1; left -= 1; } });
}

/** Whole cases per pack whose sum is the rounded total (largest remainder). */
function allocate(skus, total, key = 'suggested') {
  const entries = Object.entries(skus);
  const target = Math.round(total);
  const raw = entries.map(([sku, s]) => [sku, total > 0 ? (s.expected / (Object.values(skus).reduce((a, x) => a + x.expected, 0) || 1)) * total : 0]);
  const floors = raw.map(([sku, x]) => [sku, Math.floor(x), x - Math.floor(x)]);
  let left = target - floors.reduce((a, f) => a + f[1], 0);
  floors.sort((a, b) => b[2] - a[2]).forEach((f) => { if (left > 0) { f[1] += 1; left -= 1; } });
  floors.forEach(([sku, n]) => { skus[sku][key] = n; });
}

function distributorGate(skus, gates, school) {
  const swaps = [];
  Object.entries(skus).forEach(([sku, s]) => {
    const st = data.stockFor(sku);
    if (!st || st.status === 'ok') return;
    const cap = st.status === 'out' ? 0 : (st.maxCasesPerOutlet ?? Infinity);
    if (s.realisable <= cap) return;
    const short = s.realisable - cap;
    s.realisable = cap;
    s.gates.push('distributor');
    // Swap the shortfall into the first substitute in stock, by servings (units).
    const p = data.product(sku);
    const alt = (PARAMS.substitutes[sku] ?? []).map((x) => data.product(x))
      .find((q) => q && data.stockFor(q.sku)?.status !== 'out' && !(school && isFizz(q)));
    let swap = null;
    if (alt) {
      const cases = Math.max(1, Math.round((short * (p?.unitsPerCase ?? 1)) / (alt.unitsPerCase || 1)));
      if (!skus[alt.sku]) skus[alt.sku] = { rate: null, slope: null, expected: 0, suggested: 0, realisable: 0, gates: [] };
      skus[alt.sku].realisable += cases;
      swap = { from: sku, to: alt.sku, cases, forCases: short };
      swaps.push(swap);
    }
    gates.push({ rule: 'distributor', sku, status: st.status, max: cap, short, swap });
  });
  return swaps;
}

function coolerCapacity(o) {
  const c = o.cooler ?? {};
  const a = data.config().assumptions ?? {};
  if (c.type === 'ice-box') return (a.iceBoxCases250 ?? 1) * (c.count || 1);
  if (c.type !== 'bottler') return 0;
  const byL = a.coolerCases250ByLitres ?? { 60: 2, 150: 5, 300: 10 };
  const sizes = Object.keys(byL).map(Number).sort((x, y) => x - y);
  const size = sizes.reduce((best, s) => (Math.abs(s - c.litres) < Math.abs(best - c.litres) ? s : best), sizes[0]);
  return (byL[size] ?? 0) * (c.count || 1);
}

/** 250 ml-case equivalents of a pack (by litres), for the cooler. */
const eq250 = (sku) => (data.product(sku)?.litresPerCase ?? 7) / (data.product('CL250')?.litresPerCase ?? 7);

export function coolerCap(o, days) {
  const cap = coolerCapacity(o);
  return cap ? cap * days * PARAMS.coolerTurnsPerDay : 0;
}

function coolerGate(o, cover, skus, gates, days) {
  const cap = coolerCap(o, days);
  if (!cap) return;
  const chilled = Object.entries(skus).filter(([sku]) => isChilledSS(data.product(sku)));
  const load = chilled.reduce((a, [sku, s]) => a + s.realisable * eq250(sku), 0);
  if (load <= cap) return;
  // Trim the cold single-serve packs to what the cooler can turn (in cases of those packs).
  const cases = chilled.reduce((a, [, s]) => a + s.realisable, 0);
  scaleTo(chilled, cases * (cap / load), 'cooler');
  gates.push({ rule: 'cooler', capacity250: r1(cap), load250: r1(load) });
}

function priceOf(o, skus, key, today) {
  const lines = {};
  Object.entries(skus).forEach(([sku, s]) => { if (s[key] > 0) lines[sku] = s[key]; });
  return schemes.price(lines, o, today, orders.allOrdersFor(o.id)).net;
}

function creditGate(o, cover, skus, gates, mode) {
  const c = o.credit ?? {};
  const room = Math.max(0, (c.limit ?? 0) - (c.outstanding ?? 0));
  const value = priceOf(o, skus, 'realisable', cover.today);
  if (value <= room) return;
  if (c.paymentMode === 'cash-and-credit' || mode === 'bookings') {
    gates.push({ rule: 'credit', room, value, over: value - room, action: c.paymentMode === 'cash-and-credit' ? 'cash' : 'split-or-limit' });
    return;
  }
  // Credit-only: trim the least important packs first (not focus, smallest need) until it fits.
  const focus = new Set(data.config().focusSkus ?? []);
  const order = Object.entries(skus).filter(([, s]) => s.realisable > 0)
    .sort(([a, x], [b, y]) => (focus.has(a) - focus.has(b)) || (x.expected - y.expected));
  let guard = 200;
  while (priceOf(o, skus, 'realisable', cover.today) > room && guard-- > 0) {
    const next = order.find(([, s]) => s.realisable > 0);
    if (!next) break;
    next[1].realisable -= 1;
    if (!next[1].gates.includes('credit')) next[1].gates.push('credit');
  }
  gates.push({ rule: 'credit', room, value, over: value - room, action: 'trimmed' });
}

function bestRecentOrder(o, today) {
  const from = fmt.addDays(today, -56);
  return Math.max(0, ...pastOnly(o, today).filter((x) => x.date >= from).map(paid));
}

function safeCapGate(o, cover, skus, gates) {
  const best = bestRecentOrder(o, cover.today);
  if (!best) return;
  const cap = Math.floor(best * PARAMS.safeCap);
  const tot = Object.values(skus).reduce((a, s) => a + s.realisable, 0);
  if (tot <= cap) return;
  scaleTo(Object.entries(skus), cap, 'safe-cap');
  gates.push({ rule: 'safe-cap', best, cap });
}

// ---- check(): the live cart ------------------------------------------------------------------

const LEVEL = { block: 0, warn: 1, nudge: 2, info: 3 };

/**
 * What in this cart needs a word. lines = { SKU: cases } (the cart's lines).
 * → { need, priced, findings: [{ rule, level, audience, sku?, text, action? }], silent }
 * Findings come in rules v1.1 order; `audience: 'rep'` items are for the rep only (money).
 */
export function check(outletId, lines = {}, opts = {}) {
  const o = data.outlet(outletId);
  if (!o) return null;
  const N = need(outletId, opts);
  const today = N.cover.today;
  const all = orders.allOrdersFor(o.id);
  const priced = schemes.price(lines, o, today, all);
  const cartCases = Object.values(lines).reduce((a, b) => a + (b || 0), 0);
  const F = [];
  const add = (f) => F.push({ audience: 'both', ...f });
  const until = fmt.shortDate(N.cover.until);
  const school = (o.tags ?? []).some((x) => PARAMS.noFizzTags.includes(x));

  // 1. Closure ahead
  const cg = N.gates.find((g) => g.rule === 'closing-soon');
  if (cg) {
    const extra = cartCases - Math.max(0, N.totals.realisable);
    add({ rule: 'closing-soon', level: extra > 0 ? 'warn' : 'info',
      text: `Closes ${fmt.dateRange(cg.from, cg.to, today)}: only ${cg.sellingDays} selling day${cg.sellingDays === 1 ? '' : 's'} before then.`
        + (extra > 0 ? ` About ${extra} of these cases would sit through the closure.` : '') });
  }
  if (school) {
    const fizz = Object.keys(lines).filter((sku) => lines[sku] > 0 && isFizz(data.product(sku)));
    if (fizz.length) add({ rule: 'school-rules', level: 'warn', text: `School rules: ${fizz.map(productName).join(', ')} shouldn't be sold here.` });
  }
  // 2. De-load
  if (N.gates.some((g) => g.rule === 'deload')) add({ rule: 'deload', level: 'info', text: 'Rain or the monsoon is due inside this order\'s window: order for the next few days only.' });

  // 3. Distributor
  Object.entries(lines).forEach(([sku, n]) => {
    const st = data.stockFor(sku);
    if (!n || !st || st.status === 'ok') return;
    const max = st.status === 'out' ? 0 : st.maxCasesPerOutlet;
    if (n <= max) return;
    const p = data.product(sku);
    const alt = (PARAMS.substitutes[sku] ?? []).map((x) => data.product(x))
      .find((q) => q && data.stockFor(q.sku)?.status !== 'out' && !(school && isFizz(q)));
    const short = n - max;
    const swapCases = alt ? Math.max(1, Math.round((short * p.unitsPerCase) / alt.unitsPerCase)) : 0;
    const keepsScheme = alt && schemes.activeSchemes(today).some((s) => schemes.coversSku(s, alt.sku) && schemes.coversSku(s, sku)
      && s.type !== 'first-order' && schemes.eligibility(s, o, today, all).eligible);
    add({ rule: 'distributor', level: 'block', sku,
      text: st.status === 'out'
        ? `${p.name} is out at the distributor.` + (alt ? ` Offer ${swapCases} × ${alt.name} instead.` : '')
        : `Only ${max} cases of ${p.name} available: move the other ${short} to ${alt ? `${alt.name} (${swapCases} case${swapCases === 1 ? '' : 's'}${keepsScheme ? ', still counts toward the free case' : ''})` : 'another pack'}.`,
      action: alt ? { set: { [sku]: max, [alt.sku]: (lines[alt.sku] ?? 0) + swapCases } } : { set: { [sku]: max } } });
  });

  // 4. Cooler
  const cap = coolerCap(o, N.cover.sellingDays);
  const load = Object.entries(lines).filter(([sku]) => isChilledSS(data.product(sku))).reduce((a, [sku, n]) => a + n * eq250(sku), 0);
  if (N.mode === 'closing' || N.mode === 'silent' || N.mode === 'bookings') {
    // the closure note already covers it; wholesale gets no advice
  } else if (cap && load > cap * 1.1) {
    add({ rule: 'cooler', level: 'warn', text: `More cold packs than the cooler can turn before ${until}: about ${Math.floor(cap)} cases of 250 ml fit this window, the cart has about ${Math.round(load)}. The rest will sell warm or sit.` });
  } else if (!cap && load >= 2 && o.cooler?.type !== 'ice-box') {
    add({ rule: 'no-cooler', level: 'info', text: 'No cooler here: cold packs sell warm, so keep them small and lead with take-home bottles.' });
  }

  // 5. Credit (rep only)
  const c = o.credit ?? {};
  const room = Math.max(0, (c.limit ?? 0) - (c.outstanding ?? 0));
  if (priced.net > room) {
    const over = priced.net - room;
    add({ rule: 'credit', level: 'warn', audience: 'rep',
      text: c.paymentMode === 'cash-and-credit'
        ? `${fmt.rupees(over)} above the credit limit: collect it in cash.`
        : (c.outstanding ?? 0) > 0
          ? `${fmt.rupees(over)} over credit room: limit ${fmt.rupees(c.limit ?? 0)} − dues ${fmt.rupees(c.outstanding)} = ${fmt.rupees(room)}. Collect dues, trim the order, or ask for a higher limit.`
          : `${fmt.rupees(over)} over the ${fmt.rupees(room)} credit limit. Trim or split the order, or ask for a higher limit.` });
  }

  // 6. Larger than usual (rep only)
  if (N.mode !== 'silent' && N.totals.expected >= 1 && cartCases > PARAMS.largerThanUsual * N.totals.expected) {
    add({ rule: 'larger-than-usual', level: 'warn', audience: 'rep',
      text: `Larger than usual: ${cartCases} cases against about ${Math.round(N.totals.expected)} expected to ${until}. Check before submitting.` });
  }

  if (N.mode !== 'silent' && N.mode !== 'closing') {
    // 7. Pace gap (focus packs and the biggest sellers; not chilled packs where there's no cooler)
    const focus = new Set(data.config().focusSkus ?? []);
    const gaps = Object.entries(N.skus)
      .filter(([sku, s]) => s.realisable >= 1 && !(cap === 0 && o.cooler?.type !== 'ice-box' && isChilledSS(data.product(sku)) && N.mode !== 'bookings'))
      .map(([sku, s]) => ({ sku, want: s.realisable, have: lines[sku] ?? 0, focus: focus.has(sku) }))
      .filter((g) => g.want - g.have >= PARAMS.pace.minGap && (g.want - g.have) / g.want >= PARAMS.pace.pct)
      .sort((a, b) => (b.focus - a.focus) || ((b.want - b.have) - (a.want - a.have)))
      .slice(0, cartCases ? PARAMS.pace.maxFindings : 0);
    if (!cartCases && N.totals.realisable > 0) {
      add({ rule: 'suggested-order', level: 'nudge',
        text: `Suggested order: ${N.totals.realisable} cases to last until ${until}${N.mode === 'peers' ? ' (estimate from similar shops)' : ''}.`,
        action: { set: Object.fromEntries(Object.entries(N.skus).filter(([, s]) => s.realisable > 0).map(([sku, s]) => [sku, s.realisable])) } });
    }
    gaps.forEach((g) => add({ rule: 'pace-gap', level: 'nudge', sku: g.sku,
      text: `Add ${g.want - g.have} × ${productName(g.sku)}: expected to sell about ${g.want} by ${until}.`,
      action: { set: { [g.sku]: g.want } } }));

    // 8. Missing regular
    const past = pastOnly(o, today).slice(0, PARAMS.missingRegular.lastOrders);
    if (past.length >= PARAMS.missingRegular.minHits && cartCases) {
      const hits = {};
      past.forEach((x) => x.lines.forEach((l) => { if (l.cases > 0) hits[l.sku] = (hits[l.sku] ?? 0) + 1; }));
      Object.entries(hits)
        .filter(([sku, n]) => n >= PARAMS.missingRegular.minHits && !(lines[sku] > 0) && !gaps.some((g) => g.sku === sku) && data.stockFor(sku)?.status !== 'out')
        .sort((a, b) => b[1] - a[1]).slice(0, 2)
        .forEach(([sku, n]) => add({ rule: 'missing-regular', level: 'nudge', sku,
          text: `${productName(sku)} is missing: it was in ${n} of the last ${past.length} orders.`,
          action: N.skus[sku]?.realisable ? { set: { [sku]: N.skus[sku].realisable } } : null }));
    }
  }

  // 9–10. Schemes: one case short, cap reached, not eligible
  priced.schemes.forEach((r) => {
    const s = r.scheme;
    if (!r.qualifyingCases && s.type !== 'first-order') return;
    if (!r.eligible) {
      if (r.qualifyingCases > 0) add({ rule: 'not-eligible', level: 'info', text: `${s.name}: ${r.reason}.` });
      return;
    }
    if (N.mode === 'silent' || N.mode === 'closing') return;
    if (r.kind === 'free') {
      const cap = r.cap;
      const usedAll = cap && r.usedAfter >= cap;
      const buy = s.rule.buyCases;
      const short = buy - (r.qualifyingCases % buy);
      if (r.capHit || (usedAll && r.qualifyingCases >= buy - PARAMS.thresholdWithin)) {
        add({ rule: 'cap-reached', level: 'info',
          text: `${s.name}: this month's ${cap} free cases are used up.` + (s.validTo && fmt.addMonths(fmt.monthKey(today), 1) <= fmt.monthKey(s.validTo) ? ' Orders from the 1st of next month qualify again.' : '') });
      } else if (!usedAll && short >= 1 && short <= PARAMS.thresholdWithin && r.qualifyingCases > 0) {
        const pool = (s.skus ?? []).filter((x) => {
          const st = data.stockFor(x);
          return st?.status === 'ok' || (st?.status === 'rationed' && (lines[x] ?? 0) + short <= st.maxCasesPerOutlet);
        });
        const pick = pool[0];
        add({ rule: 'threshold', level: 'nudge',
          text: `${short} more case${short === 1 ? '' : 's'} of ${pool.length ? schemes.listNames(pool) : schemes.listNames(s.skus)} ${short === 1 ? 'earns' : 'earn'} a free case (${s.name}).`,
          action: pick ? { set: { [pick]: (lines[pick] ?? 0) + short } } : null });
      }
    } else if (r.kind === 'discount' && s.type === 'percent-off') {
      const short = (s.rule.minCases ?? 0) - r.qualifyingCases;
      if (short >= 1 && short <= PARAMS.thresholdWithin) {
        const pool = (s.skus ?? []).filter((x) => data.stockFor(x)?.status !== 'out');
        add({ rule: 'threshold', level: 'nudge', text: `${short} more case${short === 1 ? '' : 's'} of ${schemes.listNames(pool.length ? pool : s.skus)} ${short === 1 ? 'gets' : 'get'} ${s.rule.percent}% off (${s.name}).`,
          action: pool[0] ? { set: { [pool[0]]: (lines[pool[0]] ?? 0) + short } } : null });
      }
    } else if (r.kind === 'discount' && s.type === 'first-order' && r.amount > 0) {
      add({ rule: 'first-order', level: 'info', text: `${s.name}: ${fmt.rupees(r.amount)} off this first order.` });
    }
  });

  const ot = N.gates.find((g) => g.rule === 'ordered-today');
  if (ot) add({ rule: 'ordered-today', level: 'info', text: `Already booked today: ${ot.cases} cases. Suggestions show only what's still needed.` });

  // 11. Events ahead
  if (N.mode === 'bookings') {
    add({ rule: 'event-ahead', level: 'info', text: `${N.explain[0]} (to ${until}).` });
  } else if (N.mode !== 'silent' && N.mode !== 'closing' && !cartCases) {
    N.events.filter((e) => e.factor > 1 && e.from >= N.cover.delivery).slice(0, 2)
      .forEach((e) => add({ rule: 'event-ahead', level: 'info', text: `${e.name} (${e.from === e.to ? fmt.shortDate(e.from) : fmt.dateRange(e.from, e.to, today)}): included in the suggestion.` }));
  }
  // 12. Thin history
  if (N.mode === 'peers') add({ rule: 'thin-history', level: 'info', text: `${N.explain[0]}: an estimate, not this shop's own history.` + (N.newOutlet ? ` Start small and top up on ${fmt.shortDate(N.cover.nextVisit)}.` : '') });
  // Heat-wave conditions (display only)
  if (N.weather.heatWave !== 'none' && N.mode !== 'silent') add({ rule: 'heat', level: 'info', text: `${N.weather.heatWave === 'severe' ? 'Severe heat-wave' : 'Heat-wave'} conditions forecast (${N.weather.maxC}°C, ${N.weather.anomaly}°C above normal).` });

  const kept = N.mode === 'silent' ? F.filter((f) => f.rule === 'distributor' || f.rule === 'credit') : F;
  kept.sort((a, b) => LEVEL[a.level] - LEVEL[b.level]);
  const silent = !kept.some((f) => f.level !== 'info');
  return { need: N, priced: { net: priced.net, discount: priced.discount, paidCases: priced.paidCases, freeCases: priced.freeCases }, findings: kept, silent };
}

/** For the deck and tests: the numbers behind the heat and season terms. */
export function diagnostics() {
  const rows = data.outlets().map((o) => ({
    outlet: o.id,
    k: Math.round(amplitude(o) * 100) / 100,
    lift2025: Math.round((lift2025(totalsByWeek(o.id)) ?? 0) * 100) / 100,
    slopes: Object.fromEntries(Object.keys(data.history(o.id)).map((sku) => [sku, Math.round(slopeFor(o, sku) * 1000) / 10])),
  }));
  let w = 0;
  let ws = 0;
  data.outlets().forEach((o) => Object.entries(data.history(o.id)).forEach(([sku, arr]) => {
    const v = arr.reduce((a, b) => a + (b || 0), 0);
    w += v;
    ws += v * slopeFor(o, sku);
  }));
  return { regionLift2025: Math.round(regionLift() * 100) / 100, exposureNorm: Math.round(exposureNorm() * 1000) / 1000, weightedMeanSlopePct: Math.round((ws / (w || 1)) * 10000) / 100, rows };
}
