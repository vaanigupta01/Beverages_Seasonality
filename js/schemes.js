// Scheme rules, written once. The base uses them to price the cart; the feature reuses them.
//
// Rules (PROGRESS.md → build plan):
// - Free goods: 1 free per full `buyCases`. Pooled schemes count any mix of their SKUs and
//   deliver the free case(s) as the largest line. A "use" = one free case; the monthly cap
//   counts uses across all of the outlet's orders that month (past + demo).
// - Percent off: taken off the scheme's lines when they total `minCases` or more.
// - First order: % off the whole order (after other discounts), first order only, within
//   N days of registration.
// - Programs (e.g. cooler purity) are never applied at the cart.
// - Schemes stack. Money is rounded to whole rupees.

import * as data from './data.js';
import { daysBetween, monthKey } from './format.js';
import { t, label, lang } from './i18n.js';

export const isActive = (s, date) => (!s.validFrom || s.validFrom <= date) && (!s.validTo || date <= s.validTo);
export const coversSku = (s, sku) => s.skus === 'all' || (Array.isArray(s.skus) && s.skus.includes(sku));

/** Schemes valid on a date (default: the demo date). */
export const activeSchemes = (date = data.demoDate()) => data.schemes().filter((s) => isActive(s, date));

/** SKU-level schemes to show on a product row (not programs or whole-order offers). */
export const schemesForSku = (sku, date = data.demoDate()) =>
  activeSchemes(date).filter((s) => Array.isArray(s.skus) && s.skus.includes(sku) && s.type !== 'program');

/** → { eligible, reason }. `orders` = the outlet's orders (past + demo). */
export function eligibility(scheme, outlet, date, orders = []) {
  if (!isActive(scheme, date)) return { eligible: false, reason: t('sch.reason.dates') };
  const tiers = scheme.eligibleTiers;
  if (Array.isArray(tiers) && !tiers.includes(outlet.tier)) return { eligible: false, reason: t('sch.reason.tier', { tier: label('tier', outlet.tier) }) };
  if (scheme.requiresBottlerCooler && outlet.cooler?.type !== 'bottler') return { eligible: false, reason: t('sch.reason.cooler') };
  if (scheme.type === 'first-order') {
    // Age first: an established outlet should read "first 90 days", not "first order only".
    const limit = scheme.rule?.withinDaysOfRegistration ?? 90;
    const age = outlet.registeredOn ? daysBetween(outlet.registeredOn, date) : Infinity;
    if (!(age >= 0 && age <= limit)) return { eligible: false, reason: t('sch.reason.age', { days: limit }) };
    if (orders.length > 0) return { eligible: false, reason: t('sch.reason.first') };
  }
  return { eligible: true, reason: '' };
}

/** Free cases this scheme already gave the outlet in the date's calendar month. */
export function usesThisMonth(scheme, orders, date) {
  const month = monthKey(date);
  return orders
    .filter((o) => monthKey(o.date) === month && (!Array.isArray(o.schemeIds) || o.schemeIds.includes(scheme.id)))
    .reduce((n, o) => n + o.lines.filter((l) => coversSku(scheme, l.sku)).reduce((m, l) => m + (l.freeCases || 0), 0), 0);
}

/**
 * The scheme's state for one outlet today:
 *   'enrolled'   a program the outlet already receives (e.g. cooler purity)
 *   'applicable' can be used on an order ({ cap, used } when it has a monthly cap)
 *   'used'       eligible, but this month's cap is used up ({ cap, used })
 *   'not'        not for this outlet ({ reason })
 */
export function statusFor(scheme, outlet, date, orders = []) {
  const el = eligibility(scheme, outlet, date, orders);
  if (!el.eligible) return { kind: 'not', reason: el.reason };
  if (scheme.type === 'program') return { kind: 'enrolled' };
  const cap = scheme.capUsesPerMonth || null;
  const used = cap ? usesThisMonth(scheme, orders, date) : 0;
  if (cap && used >= cap) return { kind: 'used', cap, used };
  return { kind: 'applicable', cap, used };
}

/** Cases a tap on the scheme's chip adds: its threshold (buy 10 → 10, 5+ cases → 5). */
export const quickAdd = (s) => s.rule?.buyCases ?? s.rule?.minCases ?? 1;

const productName = (sku) => data.product(sku)?.name ?? sku;

/** "Cola 250 ml PET, Lemon-lime 250 ml PET and Cola 200 ml returnable glass" in the current language. */
export function listNames(skus) {
  const names = (Array.isArray(skus) ? skus : []).map(productName);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} ${t('common.and')} ${names.at(-1)}` : names[0] ?? '';
}

/** Money amount written in a program's payout, e.g. "₹300". */
export const payoutAmount = (s) => (String(s.payout ?? '').match(/₹\s?[\d,]+/) ?? [''])[0].replace(/\s/, '');

/** Short chip text, e.g. "Buy 10, get 1 free". */
export function chipText(s) {
  const r = s.rule ?? {};
  switch (s.type) {
    case 'free-goods': return t('sch.chip.free', { buy: r.buyCases, free: r.freeCases }) + (r.pooled && s.skus.length > 1 ? t('sch.chip.mix') : '');
    case 'percent-off': return t('sch.chip.pct', { pct: r.percent, min: r.minCases });
    case 'first-order': return t('sch.chip.first', { pct: r.percent });
    default: return s.name;
  }
}

/** One plain sentence describing the offer. */
export function offerText(s) {
  const r = s.rule ?? {};
  switch (s.type) {
    case 'free-goods':
      return r.pooled && s.skus.length > 1
        ? t('sch.offer.freePooled', { buy: r.buyCases, free: r.freeCases, skus: listNames(s.skus) })
        : t('sch.offer.free', { buy: r.buyCases, free: r.freeCases, skus: listNames(s.skus) });
    case 'percent-off':
      return t('sch.offer.pct', { pct: r.percent, min: r.minCases, skus: listNames(s.skus) });
    case 'first-order':
      return t('sch.offer.first', { pct: r.percent, days: r.withinDaysOfRegistration });
    default: {
      // Programs describe themselves in the data; translated when the dictionary knows the scheme.
      const translated = label('schOffer', s.id);
      return lang() !== 'en' && translated !== s.id ? translated.replace('{amt}', payoutAmount(s)) : s.payout ?? '';
    }
  }
}

/** The scheme's "also" line (e.g. a free shelf-strip), translated when known. */
export function extrasText(s) {
  if (!s.extras) return '';
  const translated = label('schExtras', s.id);
  return lang() !== 'en' && translated !== s.id ? translated : s.extras;
}

/**
 * Prices a cart for an outlet on a date.
 * cart: { SKU: cases } · orders: the outlet's orders so far (past + demo), for caps and first-order.
 * → { lines, gross, discount, net, paidCases, freeCases, totalCases, schemes, schemeIds }
 *   lines:   [{ sku, product, cases, freeCases, rate, gross }] in catalogue order
 *   schemes: one entry per active scheme that touches the cart:
 *            { scheme, kind: 'free'|'discount', eligible, reason, qualifyingCases,
 *              earned, granted, freeSku, cap, usedBefore, usedAfter, capHit, amount }
 */
export function price(cart, outlet, date = data.demoDate(), orders = []) {
  const lines = data.products()
    .filter((p) => (cart[p.sku] ?? 0) > 0)
    .map((p) => ({ sku: p.sku, product: p, cases: cart[p.sku], freeCases: 0, rate: p.ptrPerCase, gross: cart[p.sku] * p.ptrPerCase }));
  Object.keys(cart).forEach((sku) => { if (!data.product(sku) && cart[sku] > 0) console.warn(`[schemes] unknown SKU in cart: ${sku}`); });

  const gross = lines.reduce((n, l) => n + l.gross, 0);
  const result = [];
  let discount = 0;
  const active = activeSchemes(date).filter((s) => s.type !== 'program');

  for (const s of active.filter((x) => x.type === 'free-goods')) {
    const scoped = lines.filter((l) => coversSku(s, l.sku));
    if (!scoped.length) continue;
    const { eligible, reason } = eligibility(s, outlet, date, orders);
    const r = s.rule;
    const qualifyingCases = scoped.reduce((n, l) => n + l.cases, 0);
    const earned = r.pooled
      ? Math.floor(qualifyingCases / r.buyCases) * r.freeCases
      : scoped.reduce((n, l) => n + Math.floor(l.cases / r.buyCases) * r.freeCases, 0);
    const cap = s.capUsesPerMonth || null;
    const usedBefore = cap ? usesThisMonth(s, orders, date) : 0;
    const granted = eligible ? Math.min(earned, cap ? Math.max(0, cap - usedBefore) : earned) : 0;
    let freeSku = null;
    if (granted > 0) {
      if (r.pooled) {
        const order = Array.isArray(s.skus) ? s.skus : [];
        const pick = data.product(r.freeSku) && r.freeSku !== 'largest-line'
          ? (lines.find((l) => l.sku === r.freeSku) ?? addZeroLine(lines, r.freeSku))
          : [...scoped].sort((a, b) => b.cases - a.cases || order.indexOf(a.sku) - order.indexOf(b.sku))[0];
        pick.freeCases += granted;
        freeSku = pick.sku;
      } else {
        let left = granted;
        for (const l of scoped) {
          const give = Math.min(left, Math.floor(l.cases / r.buyCases) * r.freeCases);
          l.freeCases += give;
          left -= give;
          if (give && !freeSku) freeSku = l.sku;
        }
      }
    }
    result.push({
      scheme: s, kind: 'free', eligible, reason, qualifyingCases, earned, granted, freeSku,
      cap, usedBefore, usedAfter: usedBefore + granted, capHit: Boolean(cap && eligible && earned > granted), amount: 0,
    });
  }

  for (const s of active.filter((x) => x.type === 'percent-off')) {
    const scoped = lines.filter((l) => coversSku(s, l.sku));
    if (!scoped.length) continue;
    const { eligible, reason } = eligibility(s, outlet, date, orders);
    const qualifyingCases = scoped.reduce((n, l) => n + l.cases, 0);
    const meets = qualifyingCases >= (s.rule.minCases ?? 0);
    const amount = eligible && meets ? Math.round(scoped.reduce((n, l) => n + l.gross, 0) * s.rule.percent / 100) : 0;
    discount += amount;
    result.push({ scheme: s, kind: 'discount', eligible, reason, qualifyingCases, amount });
  }

  for (const s of active.filter((x) => x.type === 'first-order')) {
    if (!lines.length) continue;
    const { eligible, reason } = eligibility(s, outlet, date, orders);
    const amount = eligible ? Math.round((gross - discount) * s.rule.percent / 100) : 0;
    discount += amount;
    result.push({ scheme: s, kind: 'discount', eligible, reason, qualifyingCases: null, amount });
  }

  const paidCases = lines.reduce((n, l) => n + l.cases, 0);
  const freeCases = lines.reduce((n, l) => n + l.freeCases, 0);
  return {
    lines,
    gross,
    discount,
    net: gross - discount,
    paidCases,
    freeCases,
    totalCases: paidCases + freeCases,
    schemes: result,
    schemeIds: result.filter((x) => x.granted > 0 || x.amount > 0).map((x) => x.scheme.id),
  };
}

function addZeroLine(lines, sku) {
  const p = data.product(sku);
  const line = { sku, product: p, cases: 0, freeCases: 0, rate: p.ptrPerCase, gross: 0 };
  lines.push(line);
  return line;
}
