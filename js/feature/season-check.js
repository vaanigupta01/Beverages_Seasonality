// Smart order on screen. The numbers all come from season-engine.js (need() and check());
// this file decides where they show and says them in short, plain words. It adds three
// app-level checks the engine leaves to the screens: stock cover vs shelf life, "shops nearby
// also take", and next week's outlook after submit.
//
// Slots: outlet-season (Outlet details), booking-season + sku-hint (Order booking),
// review-check (Order review), saved-outlook (after submit), route-badge (Landing).
// Every cart change re-runs check(), so the advice follows the basket live.

import { app, router, session } from '../app.js';
import * as data from '../data.js';
import * as orders from '../orders.js';
import { cart } from '../cart.js';
import * as fmt from '../format.js';
import { t } from '../i18n.js';
import { html, raw, mount, icon, openSheet, pill } from '../ui.js';
import * as season from './season-engine.js';
import * as metrics from './metrics.js';
import * as store from './store.js';
import { isOrderable } from './sku-info.js';

const WHAT_IF = { forecastMaxC: 43 };        // the labelled heat-wave what-if from the algorithm doc
const COVER_WARN_DAYS = () => data.config().seasonCheck?.guardrails?.safeCapMaxDaysCover ?? 21;
const TOGETHER = { weeks: 12, minOrders: 20, minShare: 0.4 };   // "shops nearby also take" at review
const TIPS_SHOWN = 2;                        // booking: tips shown before "more tips"
const TYPE = {                               // what kind of advice each rule is
  block: 'warning', warn: 'warning',
  threshold: 'scheme', 'cap-reached': 'scheme', 'not-eligible': 'scheme', 'first-order': 'scheme',
  'pace-gap': 'reco', 'missing-regular': 'reco', together: 'reco',
};
const TYPE_ICON = { warning: 'alert', scheme: 'tag', reco: 'plus', info: 'info' };
const QUIET = new Set(['suggested-order', 'event-ahead', 'thin-history', 'heat', 'deload']);   // shown in the Smart order card instead
const typeOf = (f) => TYPE[f.rule] ?? (f.level === 'block' || f.level === 'warn' ? 'warning' : 'info');

let whatIf = false;                          // what-if heat wave, per session
let offCart = null;                          // the live-cart subscription of the current screen
const offered = new Map();                   // outlet → opportunities already offered for this cart

export function install() {
  cart.subscribe(({ type, cart: c }) => { if (type === 'start' && c.outletId) offered.delete(c.outletId); });   // a new cart starts fresh
  app.on('screen:rendered', ({ screen, outletId, root }) => {
    offCart?.();
    offCart = null;
    if (screen === 'home') return routeBadges(root);
    const o = outletId ? data.outlet(outletId) : null;
    if (!o) return;
    if (screen === 'outlet') outletCard(root, o);
    if (screen === 'book') booking(root, o);
    if (screen === 'review') review(root, o);
    if (screen === 'saved') afterSubmit(root, o);
  });
}

/** A little crate of bottles, the Smart order mark (instead of a generic box icon). */
const CRATE = raw(`<svg class="so-art" viewBox="0 0 48 48" aria-hidden="true">
  <rect x="9" y="7" width="7" height="16" rx="3" fill="#ff5a3c"/><rect x="11" y="3" width="3" height="5" rx="1" fill="#b3121f"/>
  <rect x="20.5" y="5" width="7" height="18" rx="3" fill="#ffb400"/><rect x="22.5" y="1.5" width="3" height="5" rx="1" fill="#c47a00"/>
  <rect x="32" y="8" width="7" height="15" rx="3" fill="#35c3ff"/><rect x="34" y="4" width="3" height="5" rx="1" fill="#0b63c9"/>
  <path d="M5 21h38l-3 22a3 3 0 01-3 2.6H11a3 3 0 01-3-2.6z" fill="#0f2a5c"/>
  <path d="M8.5 27h31M9.3 33h29.4M10 39h28" stroke="#3f63b5" stroke-width="1.6"/>
  <rect x="17" y="24.5" width="14" height="5" rx="2.5" fill="#ffd166"/>
</svg>`);

const opts = () => (whatIf ? { whatIf: WHAT_IF } : {});
/** "Cola 250 ml" from "Cola 250 ml PET": the pack type adds little on a phone screen. */
const name = (sku) => String(data.product(sku)?.name ?? sku).replace(/\s+(PET|Tetra)$/i, '').replace(/\s+returnable glass$/i, ' glass');
const until = (N) => fmt.shortDate(N.cover.until);
const applyAction = (a) => Object.entries(a?.set ?? {}).forEach(([sku, n]) => cart.set(sku, n));
const cases = (n) => fmt.casesText(n);

/** Packs worth showing: suggested or realisable, biggest first. */
const packsOf = (N) => Object.entries(N.skus)
  .filter(([, s]) => s.suggested > 0 || s.realisable > 0)
  .sort((a, b) => b[1].realisable - a[1].realisable || b[1].expected - a[1].expected);

// ---- plain words -----------------------------------------------------------------------------

/** Short reasons, each with an icon, for the Smart order card. */
function reasons(N) {
  const out = [];
  const rate = Object.values(N.skus).reduce((a, s) => a + (s.rate ?? 0), 0);
  if (N.mode === 'forward' && rate) out.push({ icon: 'history', text: t('f.so.r.rate', { n: Math.round(rate) }) });
  if (N.mode === 'bookings') out.push({ icon: 'calendar', text: t('f.so.r.bookings', { n: (data.outlet(N.outletId)?.bookings ?? []).filter((b) => b.date >= N.cover.delivery && b.date <= N.cover.until).length }) });
  if (N.mode === 'peers') out.push({ icon: 'store', text: t('f.so.r.peers', { n: N.peers?.outlets ?? '' }) });
  const r = N.season.ratio;
  out.push({ icon: 'trend', text: t(r > 1.05 ? 'f.so.r.seasonUp' : r < 0.95 ? 'f.so.r.seasonDown' : 'f.so.r.seasonPeak') });
  if (N.weather.maxC != null) out.push({ icon: 'sun', text: t(N.weather.anomaly >= 3 ? 'f.so.r.hot' : 'f.so.r.normal', { c: Math.round(N.weather.maxC) }) });
  if (N.events.length) out.push({ icon: 'calendar', text: [...new Set(N.events.map((e) => e.name))].slice(0, 2).join(', ') });
  N.gates.forEach((g) => {
    if (g.rule === 'on-hand') out.push({ icon: 'box', text: t('f.so.r.onHand', { cases: cases(g.cases) }), tone: 'ok' });
    if (g.rule === 'closing-soon') out.push({ icon: 'calendarX', text: t('f.so.r.closing', { date: fmt.shortDate(g.from), n: g.sellingDays }), tone: 'warn' });
    if (g.rule === 'deload') out.push({ icon: 'info', text: t('f.so.r.rain'), tone: 'warn' });
    if (g.rule === 'distributor') out.push({ icon: 'truck', text: g.swap ? t('f.so.r.swap', { from: name(g.sku), to: name(g.swap.to) }) : t(g.status === 'out' ? 'f.so.r.out' : 'f.so.r.ration', { name: name(g.sku), n: g.max }), tone: 'warn' });
    if (g.rule === 'cooler') out.push({ icon: 'cooler', text: t('f.so.r.cooler'), tone: 'warn' });
    if (g.rule === 'credit') out.push({ icon: 'wallet', text: g.action === 'trimmed' ? t('f.so.r.creditTrim') : t('f.so.r.creditCash', { amt: fmt.rupees(g.over) }), tone: 'warn' });
    if (g.rule === 'safe-cap') out.push({ icon: 'alert', text: t('f.so.r.cap', { n: g.cap }), tone: 'warn' });
    if (g.rule === 'ordered-today') out.push({ icon: 'check', text: t('f.so.r.today', { cases: cases(g.cases) }), tone: 'ok' });
  });
  if (N.newOutlet) out.push({ icon: 'store', text: t('f.so.r.newOutlet', { date: fmt.shortDate(N.cover.nextVisit) }) });
  return out;
}

/** The engine's finding, in a few plain words. Falls back to the engine's own text. */
function simple(f, N, lines) {
  const set = Object.entries(f.action?.set ?? {});
  const have = (sku) => lines[sku] ?? 0;
  const scheme = (f.text.match(/\(([^)]+)\)\.?$/) ?? [])[1] ?? f.text.split(':')[0];
  switch (f.rule) {
    case 'distributor': {
      const alt = set.find(([sku]) => sku !== f.sku);
      const max = f.action?.set?.[f.sku] ?? 0;
      if (!max) return alt ? t('f.tip.outSwap', { name: name(f.sku), alt: name(alt[0]), n: alt[1] - have(alt[0]) }) : t('f.tip.out', { name: name(f.sku) });
      return alt ? t('f.tip.ration', { n: max, name: name(f.sku), move: have(f.sku) - max, alt: name(alt[0]) }) : t('f.tip.rationOnly', { n: max, name: name(f.sku) });
    }
    case 'pace-gap': { const [[sku, n]] = set; return t('f.tip.pace', { n: n - have(sku), name: name(sku), date: until(N) }); }
    case 'missing-regular': return t('f.tip.regular', { name: name(f.sku) });
    case 'threshold': {
      const [[sku, n]] = set.length ? set : [[null, 0]];
      const pct = (f.text.match(/(\d+)% off/) ?? [])[1];
      return sku ? t(pct ? 'f.tip.thresholdPct' : 'f.tip.thresholdFree', { n: n - have(sku), name: name(sku), pct, scheme }) : f.text;
    }
    case 'cap-reached': return t('f.tip.cap', { scheme: f.text.split(':')[0] });
    case 'larger-than-usual': return t('f.tip.larger', { n: Object.values(lines).reduce((a, b) => a + b, 0), need: Math.round(N.totals.expected) });
    case 'cooler': return t('f.tip.cooler', { n: Math.floor(season.coolerCap(data.outlet(N.outletId), N.cover.sellingDays || N.cover.days)) });
    case 'no-cooler': return t('f.tip.noCooler');
    case 'closing-soon': return t('f.tip.closing', { n: (N.gates.find((g) => g.rule === 'closing-soon') ?? {}).sellingDays ?? 0 });
    default: return f.text;
  }
}

// ---- Outlet details: the suggestion -------------------------------------------------------------

function outletCard(root, o) {
  const slot = root.querySelector('[data-slot="outlet-season"]');
  if (!slot) return;
  const draw = () => {
    const N = season.need(o.id, opts());
    if (!N.display) {
      mount(slot, html`<section class="so so-quiet"><div class="so-head"><span class="so-icon">${icon('store')}</span>
        <div><p class="so-eyebrow">${t('f.so.eyebrow')}</p><p class="so-line">${t('f.so.silent')}</p></div></div></section>`);
      slot.hidden = false;
      return;
    }
    const packs = N.totals.realisable ? packsOf(N).filter(([, s]) => s.realisable > 0).slice(0, 6) : [];
    const why = reasons(N);
    const tags = why.filter((r) => r.tone);
    const special = N.mode === 'closing' ? t('f.so.subClosing') : N.mode === 'peers' && N.newOutlet ? t('f.so.subNew', { date: fmt.shortDate(N.cover.nextVisit) }) : '';
    mount(slot, html`<section class="so" aria-labelledby="so-title">
      <div class="so-head">
        <span class="so-icon is-art">${CRATE}</span>
        <div class="so-text">
          <p class="so-eyebrow">${t('f.so.eyebrow')}${N.mode === 'peers' ? html`<span class="so-tag">${t('f.so.guess')}</span>` : ''}${whatIf ? html`<span class="so-tag is-hot">43°C</span>` : ''}</p>
          <h2 class="so-big" id="so-title">${N.totals.realisable}<small> ${t('f.so.cases')} · ${t('f.so.till', { date: until(N) })}</small></h2>
          ${special ? html`<p class="so-sub">${special}</p>` : ''}
        </div>
      </div>
      ${packs.length ? html`<div class="so-packs">${packs.map(([sku, s]) => html`<span class="so-pack ${data.product(sku)?.focus ? 'is-focus' : ''}">${name(sku)}<b>${s.realisable}</b></span>`)}</div>` : ''}
      ${tags.length ? html`<div class="so-tags">${tags.map((r) => html`<span class="so-tagline tone-${r.tone}">${icon(r.icon)}${r.text}</span>`)}</div>` : ''}
      <details class="so-why"><summary>${icon('info')}<span>${t('f.so.why')}</span>${icon('chevron', 'collapse-chev')}</summary>
        <ul>${why.filter((r) => !r.tone).map((r) => html`<li>${icon(r.icon)}<span>${r.text}</span></li>`)}</ul>
        <button type="button" class="link-btn so-whatif" data-whatif>${icon('sun')}<span>${whatIf ? t('f.so.whatIfOff') : t('f.so.whatIf')}</span></button>
      </details>
      ${N.totals.realisable ? html`<button type="button" class="btn btn-primary btn-block so-cta" data-use>${t('f.so.use', { n: N.totals.realisable })}</button>` : ''}
    </section>`);
    slot.hidden = false;
    slot.querySelector('[data-whatif]')?.addEventListener('click', () => { whatIf = !whatIf; draw(); slot.querySelector('.so-why')?.setAttribute('open', ''); });
    slot.querySelector('[data-use]')?.addEventListener('click', () => {
      if (cart.outletId !== o.id || cart.isEmpty()) {
        if (cart.outletId !== o.id) cart.start(o.id);
        packsOf(N).forEach(([sku, s]) => { if (s.realisable > 0) cart.set(sku, s.realisable); });
      }
      router.go(`#/book/${o.id}`);
    });
  };
  draw();
}

// ---- Order booking: live tips, "Suggested" filter, per-pack add -----------------------------------

/** App-level check: cart + stock on hand vs the pack's selling rate and shelf life. */
function coverFindings(o, N, lines) {
  const out = [];
  const onHand = Object.fromEntries(data.onHand(o.id).map((r) => [r.sku, r.repCountedCases ?? r.estimatedCasesOnHand ?? 0]));
  const days = Math.max(1, N.cover.sellingDays || N.cover.days);
  Object.entries(lines).forEach(([sku, n]) => {
    const s = N.skus[sku];
    const p = data.product(sku);
    if (!n || !s || !p || !(s.expected > 0)) return;
    const perDay = s.expected / days;
    const cover = Math.round((n + (onHand[sku] ?? 0)) / perDay);
    if (cover > p.shelfLifeDays) {
      out.push({ rule: 'shelf-life', level: 'warn', sku, text: t('f.tip.shelf', { name: name(sku), days: cover, life: p.shelfLifeDays }), action: { set: { [sku]: Math.max(0, Math.round(perDay * COVER_WARN_DAYS() - (onHand[sku] ?? 0))) } } });
    } else if (cover > Math.max(COVER_WARN_DAYS(), N.cover.days * 2)) {
      out.push({ rule: 'overstock', level: 'warn', sku, text: t('f.tip.cover', { name: name(sku), days: cover }), action: { set: { [sku]: Math.max(0, Math.round(perDay * N.cover.days - (onHand[sku] ?? 0))) } } });
    }
  });
  return out;
}

/** "1 more case earns a free case": top up a scheme pack already in the cart (within any
 *  distributor limit) rather than the scheme's first pack, so the rep adds what they were building. */
function topUpInCart(f, lines) {
  if (f.rule !== 'threshold' || !f.action?.set) return f;
  const [[sku, n]] = Object.entries(f.action.set);
  const short = n - (lines[sku] ?? 0);
  const name = (f.text.match(/\(([^)]+)\)\.?$/) ?? [])[1];
  const scheme = data.schemes().find((s) => s.name === name && Array.isArray(s.skus) && s.skus.includes(sku));
  const pick = scheme?.skus.find((k) => (lines[k] ?? 0) > 0 && isOrderable(k)
    && (!data.stockFor(k)?.maxCasesPerOutlet || data.stockFor(k).status !== 'rationed' || lines[k] + short <= data.stockFor(k).maxCasesPerOutlet));
  return pick && pick !== sku ? { ...f, action: { set: { [pick]: lines[pick] + short } } } : f;
}

function findingsFor(o, lines) {
  const C = season.check(o.id, lines, opts());
  const N = C.need;
  const extra = N.display ? coverFindings(o, N, lines) : [];
  const order = { block: 0, warn: 1, nudge: 2, info: 3 };
  const all = [...C.findings.filter((f) => !QUIET.has(f.rule)).map((f) => topUpInCart(f, lines)).map((f) => ({ ...f, text: simple(f, N, lines) })), ...extra.map((f) => ({ audience: 'both', ...f }))]
    .sort((a, b) => order[a.level] - order[b.level]);
  return { C, all };
}

const actionLabel = (f) => {
  if (!f.action?.set) return '';
  if (f.rule === 'distributor') return t('f.act.swap');
  if (f.rule === 'shelf-life' || f.rule === 'overstock') return t('f.act.trim');
  const [[sku, n]] = Object.entries(f.action.set);
  const diff = n - (cart.get(sku) ?? 0);
  return diff > 0 ? t('f.act.add', { n: diff }) : t('f.act.set', { n });
};

const tipHtml = (f, i) => html`<li class="tip typ-${typeOf(f)} lvl-${f.level}">
  <span class="tip-ico">${icon(TYPE_ICON[typeOf(f)])}</span>
  <span class="tip-body"><span class="tip-tag">${t(`f.type.${typeOf(f)}`)}</span><span class="tip-text">${f.text}</span></span>
  ${f.action?.set ? html`<button type="button" class="tip-act" data-act="${i}">${actionLabel(f)}</button>` : ''}
</li>`;

function tipsHtml(list, { limit = TIPS_SHOWN } = {}) {
  const both = list.filter((f) => f.audience !== 'rep');
  const rep = list.filter((f) => f.audience === 'rep');
  const first = both.slice(0, limit);
  const rest = both.slice(limit);
  return html`${first.length ? html`<ul class="tips">${first.map((f) => tipHtml(f, list.indexOf(f)))}</ul>` : ''}
    ${rest.length ? html`<details class="tips-more"><summary>${t('f.tips.more', { n: rest.length })}${icon('chevron', 'collapse-chev')}</summary><ul class="tips">${rest.map((f) => tipHtml(f, list.indexOf(f)))}</ul></details>` : ''}
    ${rep.length ? html`<details class="tips-more is-rep"><summary>${icon('lock')}<span>${t('tp.forYou')} · ${rep.length}</span>${icon('chevron', 'collapse-chev')}</summary><ul class="tips">${rep.map((f) => tipHtml(f, list.indexOf(f)))}</ul></details>` : ''}`;
}

function booking(root, o) {
  const slot = root.querySelector('[data-slot="booking-season"]');
  if (!slot) return;
  const N0 = season.need(o.id, opts());
  const suggested = N0.display ? packsOf(N0).filter(([, s]) => s.realisable > 0) : [];

  // "Suggested" chip: only the packs Smart order would order. Chosen first when the cart is empty.
  const chips = root.querySelector('.chips');
  if (chips && suggested.length && !chips.querySelector('[data-cat="suggested"]')) {
    suggested.forEach(([sku]) => { const li = root.querySelector(`.sku[data-sku="${sku}"]`); if (li) li.dataset.tags = `${li.dataset.tags ?? ''} suggested`.trim(); });
    chips.children[0].insertAdjacentHTML('afterend', String(html`<button type="button" class="chip chip-suggested" data-cat="suggested" aria-pressed="false">${icon('box')}<span>${t('f.so.chip')}</span><span class="chip-count">${suggested.length}</span></button>`));
    if (cart.isEmpty()) chips.querySelector('[data-cat="suggested"]').click();
  }

  const draw = () => {
    const lines = cart.lines();
    const { C, all } = findingsFor(o, lines);
    const N = C.need;
    const have = Object.values(lines).reduce((a, b) => a + b, 0);
    const target = N.totals.realisable;
    const missing = N.display ? packsOf(N).filter(([sku, s]) => s.realisable > (lines[sku] ?? 0)) : [];
    const pct = target ? Math.min(100, Math.round((have / target) * 100)) : 0;
    mount(slot, html`<section class="so-live" aria-live="polite">
      ${N.display && target ? html`<div class="so-live-head">
        <span class="so-icon is-small is-art">${CRATE}</span>
        <div class="so-live-text"><p><b>${t('f.so.liveTitle', { n: target })}</b> <span class="muted">· ${t('f.so.sub', { date: until(N) })}</span></p>
          <div class="meter is-small"><span class="meter-fill ${have > target * 1.5 ? 'is-over' : ''}" style="width:${pct}%"></span></div>
          <p class="so-live-count">${t('f.so.inCart', { have, target })}</p></div>
        ${missing.length ? html`<button type="button" class="btn btn-primary btn-compact" data-addall>${t('f.so.addAll')}</button>` : html`<span class="so-done">${icon('check')}</span>`}
      </div>` : ''}
      ${all.length ? tipsHtml(all) : have ? html`<p class="sc-ok">${icon('check')}<span>${t('f.so.allGood')}</span></p>` : ''}
    </section>`);
    slot.hidden = false;
    slot.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => applyAction(all[Number(b.dataset.act)].action)));
    slot.querySelector('[data-addall]')?.addEventListener('click', () => missing.forEach(([sku, s]) => cart.set(sku, s.realisable)));
    // Per-pack: "Suggested 5 · Add" under each suggested SKU.
    root.querySelectorAll('[data-slot="sku-hint"]').forEach((h) => {
      const sku = h.dataset.sku;
      const s = N.display ? N.skus[sku] : null;
      if (!s || !(s.realisable > 0)) { h.hidden = true; return; }
      const inCart = lines[sku] ?? 0;
      const met = inCart >= s.realisable;
      mount(h, html`<div class="sku-sug ${met ? 'is-met' : ''}">${icon(met ? 'check' : 'box')}<span>${t('f.so.skuHint', { n: s.realisable })}${s.onHand ? html` <span class="muted">· ${t('f.so.skuShelf', { n: s.onHand })}</span>` : ''}</span>
        ${met ? '' : html`<button type="button" class="sug-add" data-sug="${sku}" data-n="${s.realisable}">${t('f.act.add', { n: s.realisable - inCart })}</button>`}</div>`);
      h.hidden = false;
      h.querySelector('[data-sug]')?.addEventListener('click', (e) => cart.set(sku, Number(e.currentTarget.dataset.n)));
    });
  };
  draw();
  offCart = cart.subscribe(() => draw());
}

// ---- Order review: tips and the opportunity pop-up ------------------------------------------------

const togetherMemo = new Map();
/** The pack most often bought with this basket at nearby outlets (last 12 weeks), not in the cart. */
function boughtTogether(o, lines) {
  const inCart = Object.keys(lines).filter((k) => lines[k] > 0);
  if (!inCart.length) return null;
  const key = `${o.area}`;
  if (!togetherMemo.has(key)) {
    const from = fmt.addDays(data.demoDate(), -7 * TOGETHER.weeks);
    const list = data.outlets().filter((x) => x.area === o.area).flatMap((x) => data.pastOrders(x.id)).filter((x) => x.date >= from)
      .map((x) => new Set(x.lines.filter((l) => l.cases > 0).map((l) => l.sku)));
    togetherMemo.set(key, list);
  }
  const baskets = togetherMemo.get(key);
  const school = (o.tags ?? []).includes('school');
  let best = null;
  inCart.forEach((a) => {
    const withA = baskets.filter((b) => b.has(a));
    if (withA.length < TOGETHER.minOrders) return;
    const counts = new Map();
    withA.forEach((b) => b.forEach((x) => { if (!inCart.includes(x)) counts.set(x, (counts.get(x) ?? 0) + 1); }));
    counts.forEach((n, sku) => {
      const p = data.product(sku);
      const share = n / withA.length;
      if (share < TOGETHER.minShare || !isOrderable(sku) || (school && ['Sparkling', 'Energy'].includes(p?.category))) return;
      if (!best || share > best.share) best = { sku, with: a, share };
    });
  });
  if (!best) return null;
  return { rule: 'together', level: 'nudge', audience: 'both', sku: best.sku,
    text: t('f.tip.together', { name: name(best.sku), with: name(best.with), pct: Math.round(best.share * 100) }),
    action: { set: { [best.sku]: 1 } } };
}

/** The best thing to offer at review, most valuable first: a scheme close by, then a pack the
 *  outlet will run out of, then a regular that's missing, then what nearby shops also take. */
const OFFER_ORDER = ['threshold', 'pace-gap', 'missing-regular', 'together'];

function review(root, o) {
  const slot = root.querySelector('[data-slot="review-check"]');
  if (!slot || cart.outletId !== o.id || cart.isEmpty()) return;
  const lines = cart.lines();
  const { C, all } = findingsFor(o, lines);
  if (!C.need.display) { slot.hidden = true; return; }
  const tog = boughtTogether(o, lines);
  const list = [...all.filter((f) => f.level !== 'info' || typeOf(f) === 'scheme'), ...(tog ? [tog] : [])];
  mount(slot, list.length
    ? html`<section class="card rc"><h2 class="card-title">${icon('check')}<span>${t('f.rc.title')}</span></h2>${tipsHtml(list, { limit: 3 })}</section>`
    : html`<p class="strip-ok">${icon('check')}<span>${t('f.rc.ok', { date: until(C.need) })}</span></p>`);
  slot.hidden = false;
  slot.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => applyAction(list[Number(b.dataset.act)].action)));

  // The pop-up shows the best opportunity (never a warning), once for each different one: going
  // back, taking a scheme to 1–2 cases short and returning offers that scheme even if another
  // idea was offered before.
  const offer = OFFER_ORDER.map((r) => list.find((f) => f.rule === r && f.action?.set)).find(Boolean);
  const key = offer ? `${offer.rule}:${Object.keys(offer.action.set).map((k) => `${k}:${lines[k] ?? 0}>${offer.action.set[k]}`).join(',')}` : null;
  const shown = offered.get(o.id) ?? new Set();
  if (offer && !shown.has(key)) {
    shown.add(key);
    offered.set(o.id, shown);
    const [[sku, n]] = Object.entries(offer.action.set);
    const add = Math.max(1, n - (lines[sku] ?? 0));
    const isScheme = offer.rule === 'threshold';
    const first = session.name().split(' ')[0];
    openSheet({
      title: isScheme ? t('f.offer.titleScheme', { name: first }) : t('f.offer.titleReco', { name: first }),
      body: html`<div class="offer-art ${isScheme ? '' : 'is-reco'}" aria-hidden="true">${icon(isScheme ? 'tag' : 'box')}</div>
        <p class="offer-kind">${t(`f.type.${typeOf(offer)}`)}</p>
        <p class="offer-text">${offer.text}</p>`,
      actions: [{ key: 'add', label: t('f.offer.add', { n: add, name: name(sku) }), tone: 'primary' }, { key: 'close', label: t('f.offer.skip'), tone: 'secondary' }],
      dismissKey: 'close',
    }).then((k) => { if (k === 'add') applyAction(offer.action); });
  }
}

// ---- After submit: small wins and next week's outlook ------------------------------------------------

function afterSubmit(root, o) {
  const slot = root.querySelector('[data-slot="saved-outlook"]');
  if (!slot) return;
  const wins = metrics.milestones().filter((w) => !store.seen(`ms:${w.id}`));
  wins.forEach((w) => store.markSeen(`ms:${w.id}`));
  const gain = metrics.targetToday();
  const N = season.need(o.id);
  mount(slot, html`
    ${wins.map((w) => html`<p class="win is-new">${icon(w.icon)}<span>${t(w.key, w.vars ?? {})}</span></p>`)}
    <p class="gain-line">${icon('target')}<span>${gain ? t('f.saved.gain', { n: fmt.num(gain) }) : t('f.saved.noGain')}</span></p>
    ${N.display ? outlookHtml(o, N) : ''}`);
  slot.hidden = false;
}

function outlookHtml(o, N) {
  const cal = data.calendar() ?? {};
  const from = N.cover.nextVisit;
  const to = fmt.addDays(from, Math.max(7, N.cover.days));
  const events = (cal.events ?? []).filter((e) => !e.quiet && e.from <= to && e.to >= from && (!(e.appliesTo?.tags ?? []).length || (e.appliesTo.tags ?? []).some((x) => (o.tags ?? []).includes(x))));
  const closure = (o.closures ?? []).find((c) => c.from <= to && c.to >= from);
  const bookings = (o.bookings ?? []).filter((b) => b.date >= from && b.date < to);
  const fc = (cal.forecast?.periods ?? []).filter((p) => p.to >= from && p.from <= to);
  const rain = fc.some((p) => ['moderate', 'high'].includes(p.rainChance));
  const up = events.filter((e) => Number(Array.isArray(e.multiplier) ? e.multiplier[1] : e.multiplier) > 1);
  const down = events.filter((e) => Number(Array.isArray(e.multiplier) ? e.multiplier[0] : e.multiplier) < 1);
  const dir = closure || down.length ? 'down' : up.length || bookings.length ? 'up' : 'steady';
  const top = packsOf(N).slice(0, 3).map(([sku]) => name(sku));
  const limited = packsOf(N).map(([sku]) => ({ sku, it: data.stockFor(sku) })).filter((x) => x.it && (x.it.status !== 'ok' || x.it.sourceStatus)).slice(0, 2);
  const prep = [];
  if (closure) prep.push(t('f.out.prepClosure', { date: fmt.shortDate(closure.from) }));
  if (bookings.length) prep.push(t('f.out.prepBookings', { n: bookings.length }));
  if (limited.length) prep.push(t('f.out.prepStock', { list: limited.map((x) => name(x.sku)).join(', ') }));
  if (rain) prep.push(t('f.out.prepRain'));
  prep.push(t('f.out.prepCall', { date: fmt.shortDate(fmt.addDays(from, -1)) }));
  return html`<section class="outlook" aria-labelledby="outlook-title">
    <div class="outlook-head dir-${dir}">
      <span class="outlook-ico">${icon(dir === 'down' ? 'calendarX' : 'trend')}</span>
      <div><p class="outlook-eyebrow" id="outlook-title">${t('f.out.title')}</p><p class="outlook-dir">${t(`f.out.dir.${dir}`)}</p></div>
    </div>
    <div class="outlook-rows">
      <p>${icon('calendar')}<span>${t('f.out.next', { date: fmt.shortDate(from), n: Math.round(N.totals.expected) })}</span></p>
      ${top.length ? html`<p>${icon('box')}<span>${t('f.out.top', { list: top.join(', ') })}</span></p>` : ''}
      ${[...up, ...down].length ? html`<p>${icon('calendar')}<span>${[...new Set([...up, ...down].map((e) => e.name))].slice(0, 2).join(', ')}</span></p>` : ''}
      ${limited.length ? html`<p class="is-warn">${icon('truck')}<span>${t('f.out.stock', { list: limited.map((x) => name(x.sku)).join(', ') })}</span></p>` : ''}
    </div>
    <details class="outlook-prep"><summary>${icon('check')}<span>${t('f.out.prep', { n: prep.length })}</span>${icon('chevron', 'collapse-chev')}</summary>
      <ul>${prep.map((x) => html`<li>${x}</li>`)}</ul></details>
  </section>`;
}

// ---- Landing: a small suggestion badge on each route stop ---------------------------------------------

function routeBadges(root) {
  root.querySelectorAll('[data-slot="route-badge"]').forEach((el) => {
    const N = season.need(el.dataset.outletId);
    if (!N?.display || orders.demoOrdersOn(el.dataset.outletId, data.demoDate()).length) return;
    mount(el, N.mode === 'closing' ? pill(t('f.so.badgeClosing'), 'caution', 'calendarX')
      : N.totals.realisable ? pill(t('f.so.badge', { n: N.totals.realisable }), 'info', 'box') : '');
    el.hidden = false;
  });
}
