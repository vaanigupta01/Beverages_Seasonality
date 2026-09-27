// Season Check on screen: the order assistant. The numbers all come from season-engine.js
// (need() and check()); this file decides where they show and adds three app-level checks
// the engine leaves to the screens: stock cover vs shelf life, a "bought together" idea at
// review, and next week's outlook after submit.
//
// Slots: outlet-season (Outlet details), booking-season + sku-hint (Order booking),
// review-check (Order review), saved-outlook (after submit), route-badge (Landing).
// Every cart change re-runs check(), so the advice follows the basket live.

import { app, router } from '../app.js';
import * as data from '../data.js';
import * as orders from '../orders.js';
import { cart } from '../cart.js';
import * as fmt from '../format.js';
import { t } from '../i18n.js';
import { html, mount, icon, openSheet, pill } from '../ui.js';
import * as season from './season-engine.js';
import { isOrderable } from './sku-info.js';

const WHAT_IF = { forecastMaxC: 43 };        // the labelled heat-wave what-if from the algorithm doc
const COVER_WARN_DAYS = () => data.config().seasonCheck?.guardrails?.safeCapMaxDaysCover ?? 21;
const TOGETHER = { weeks: 12, minOrders: 20, minShare: 0.4 };   // "bought together" at review
const TYPE = {                               // what kind of advice each engine rule is
  block: 'warning', warn: 'warning',
  threshold: 'scheme', 'cap-reached': 'scheme', 'not-eligible': 'scheme', 'first-order': 'scheme',
  'pace-gap': 'reco', 'missing-regular': 'reco', 'suggested-order': 'reco', together: 'reco',
};
const typeOf = (f) => TYPE[f.rule] ?? (f.level === 'block' || f.level === 'warn' ? 'warning' : 'info');

let whatIf = false;                          // what-if heat wave, per session
let offCart = null;                          // the live-cart subscription of the current screen
const offered = new Set();                   // outlets where the offer pop-up already showed

export function install() {
  app.on('screen:rendered', ({ screen, outletId, root }) => {
    offCart?.();
    offCart = null;
    if (screen === 'home') return routeBadges(root);
    const o = outletId ? data.outlet(outletId) : null;
    if (!o) return;
    if (screen === 'outlet') outletCard(root, o);
    if (screen === 'book') booking(root, o);
    if (screen === 'review') review(root, o);
    if (screen === 'saved') outlook(root, o);
  });
}

const opts = () => (whatIf ? { whatIf: WHAT_IF } : {});
const name = (sku) => data.product(sku)?.name ?? sku;
const until = (N) => fmt.shortDate(N.cover.until);
const applyAction = (a) => Object.entries(a?.set ?? {}).forEach(([sku, n]) => cart.set(sku, n));

/** Packs worth showing: suggested or realisable, biggest first. */
const packsOf = (N) => Object.entries(N.skus)
  .filter(([, s]) => s.suggested > 0 || s.realisable > 0)
  .sort((a, b) => b[1].realisable - a[1].realisable || b[1].expected - a[1].expected);

// ---- Outlet details: the suggestion -------------------------------------------------------

function gateText(g, N) {
  switch (g.rule) {
    case 'closing-soon': return t('f.sc.gate.closing', { range: fmt.dateRange(g.from, g.to, N.cover.today), n: g.sellingDays });
    case 'deload': return t('f.sc.gate.deload');
    case 'distributor': return g.swap
      ? t('f.sc.gate.swap', { from: name(g.sku), max: g.max, to: name(g.swap.to), n: g.swap.cases })
      : t(g.status === 'out' ? 'f.sc.gate.out' : 'f.sc.gate.ration', { name: name(g.sku), max: g.max });
    case 'cooler': return t('f.sc.gate.cooler', { cap: Math.floor(g.capacity250) });
    case 'credit': return g.action === 'trimmed' ? t('f.sc.gate.creditTrim', { room: fmt.rupees(g.room) }) : t('f.sc.gate.creditFlag', { over: fmt.rupees(g.over) });
    case 'safe-cap': return t('f.sc.gate.cap', { best: g.best, cap: g.cap });
    case 'on-hand': return t('f.sc.gate.onHand', { cases: fmt.casesText(g.cases) });
    case 'ordered-today': return t('f.sc.gate.today', { cases: fmt.casesText(g.cases) });
    default: return '';
  }
}

function outletCard(root, o) {
  const slot = root.querySelector('[data-slot="outlet-season"]');
  if (!slot) return;
  const draw = () => {
    const N = season.need(o.id, opts());
    if (!N.display) {
      mount(slot, html`<section class="sc sc-quiet"><div class="sc-head">${icon('spark')}<div><p class="sc-eyebrow">${t('f.sc.eyebrow')}</p><p class="sc-title">${t('f.sc.silentTitle')}</p></div></div>
        <p class="sc-sub">${t('f.sc.silentBody')}</p></section>`);
      slot.hidden = false;
      return;
    }
    const packs = N.totals.realisable ? packsOf(N).filter(([, s]) => s.realisable > 0 || s.suggested > 0).slice(0, 5) : [];
    const gates = N.gates.map((g) => gateText(g, N)).filter(Boolean);
    const lessThanUsual = N.mode === 'closing' || N.gates.some((g) => g.rule === 'deload');
    mount(slot, html`<section class="sc" aria-labelledby="sc-title">
      <div class="sc-head">
        <span class="sc-mark">${icon('spark')}</span>
        <div>
          <p class="sc-eyebrow">${t('f.sc.eyebrow')}${N.mode === 'peers' ? html` · <span class="sc-est">${t('f.sc.estimate')}</span>` : ''}${whatIf ? html` · <span class="sc-whatif">${t('f.sc.whatIfOn')}</span>` : ''}</p>
          <h2 class="sc-title" id="sc-title">${N.totals.realisable
            ? t('f.sc.orderAbout', { n: N.totals.realisable, date: until(N) })
            : t(lessThanUsual ? 'f.sc.orderNothingClosing' : 'f.sc.orderNothing', { date: until(N) })}</h2>
          <p class="sc-sub">${t(`f.sc.mode.${N.mode}`, { days: N.cover.days, selling: N.cover.sellingDays, expected: N.totals.expected, next: fmt.shortDate(N.cover.nextVisit) })}</p>
        </div>
      </div>
      ${packs.length ? html`<ul class="sc-packs">${packs.map(([sku, s]) => html`<li>
        <span class="sc-pack">${name(sku)}${data.product(sku)?.focus ? html` <span class="focus-dot" title="${t('f.sku.focus')}">★</span>` : ''}</span>
        <span class="sc-qty num">${s.realisable}${s.suggested !== s.realisable ? html`<span class="sc-was"> / ${s.suggested}</span>` : ''}</span>
      </li>`)}</ul>` : ''}
      ${gates.length ? html`<ul class="sc-gates">${gates.map((g) => html`<li>${icon('info')}<span>${g}</span></li>`)}</ul>` : ''}
      <details class="sc-why"><summary>${t('f.sc.why')}${icon('chevron', 'collapse-chev')}</summary>
        <ul>${N.explain.map((x) => html`<li>${x}</li>`)}</ul>
        ${N.events.length ? html`<p class="fine">${t('f.sc.events', { list: N.events.slice(0, 3).map((e) => `${e.name} ×${e.factor}`).join(', ') })}</p>` : ''}
        <p class="fine">${t('f.sc.method')}</p>
        <button type="button" class="btn btn-ghost btn-compact" data-whatif>${icon('sun')}<span>${whatIf ? t('f.sc.whatIfOff') : t('f.sc.whatIf', { c: WHAT_IF.forecastMaxC })}</span></button>
      </details>
      ${N.totals.realisable ? html`<button type="button" class="btn btn-primary btn-block sc-cta" data-use>${t('f.sc.use', { n: N.totals.realisable })}</button>` : ''}
    </section>`);
    slot.hidden = false;
    slot.querySelector('[data-whatif]')?.addEventListener('click', () => { whatIf = !whatIf; draw(); slot.querySelector('.sc-why')?.setAttribute('open', ''); });
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

// ---- Order booking: live findings, per-pack hints, "Suggested" filter -----------------------

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
      out.push({ rule: 'shelf-life', level: 'warn', sku, text: t('f.sc.shelf', { name: p.name, days: cover, life: p.shelfLifeDays }), action: { set: { [sku]: Math.max(0, Math.round(perDay * COVER_WARN_DAYS() - (onHand[sku] ?? 0))) } } });
    } else if (cover > Math.max(COVER_WARN_DAYS(), N.cover.days * 2)) {
      out.push({ rule: 'overstock', level: 'warn', sku, text: t('f.sc.cover', { name: p.name, days: cover, max: COVER_WARN_DAYS() }), action: { set: { [sku]: Math.max(0, Math.round(perDay * N.cover.days - (onHand[sku] ?? 0))) } } });
    }
  });
  return out;
}

function findingsFor(o, lines) {
  const C = season.check(o.id, lines, opts());
  const extra = C.need.display ? coverFindings(o, C.need, lines) : [];
  const order = { block: 0, warn: 1, nudge: 2, info: 3 };
  const all = [...C.findings, ...extra.map((f) => ({ audience: 'both', ...f }))].sort((a, b) => order[a.level] - order[b.level]);
  return { C, all };
}

const actionLabel = (f) => {
  if (!f.action?.set) return '';
  if (f.rule === 'suggested-order') return t('f.sc.act.fill');
  if (f.rule === 'distributor') return t('f.sc.act.swap');
  if (f.rule === 'shelf-life' || f.rule === 'overstock') return t('f.sc.act.trim');
  const [[sku, n]] = Object.entries(f.action.set);
  const diff = n - (cart.get(sku) ?? 0);
  return diff > 0 ? t('f.sc.act.add', { n: diff }) : t('f.sc.act.set', { n });
};

const findingHtml = (f, i) => html`<li class="fd lvl-${f.level} typ-${typeOf(f)}">
  <span class="fd-tag">${t(`f.sc.type.${typeOf(f)}`)}</span>
  <p class="fd-text">${f.text}</p>
  ${f.action?.set ? html`<button type="button" class="btn btn-secondary btn-compact fd-act" data-act="${i}">${actionLabel(f)}</button>` : ''}
</li>`;

function listHtml(list, { limit = 3, repTitle = true } = {}) {
  const both = list.filter((f) => f.audience !== 'rep');
  const rep = list.filter((f) => f.audience === 'rep');
  const shown = both.slice(0, limit);
  return html`${shown.length ? html`<ul class="fd-list">${shown.map((f) => findingHtml(f, list.indexOf(f)))}</ul>` : ''}
    ${rep.length ? html`<details class="tp-rep fd-rep"${repTitle ? '' : ' open'}><summary>${icon('lock')}<span class="tp-rep-title">${t('tp.forYou')}</span><span class="tp-rep-note">${t('tp.forYouNote')}</span>${icon('chevron', 'collapse-chev')}</summary>
      <ul class="fd-list">${rep.map((f) => findingHtml(f, list.indexOf(f)))}</ul></details>` : ''}`;
}

function booking(root, o) {
  const slot = root.querySelector('[data-slot="booking-season"]');
  if (!slot) return;
  const N0 = season.need(o.id, opts());
  const suggested = N0.display ? packsOf(N0).filter(([, s]) => s.realisable > 0) : [];

  // "Suggested" chip: the packs the assistant would order, first in the list.
  const chips = root.querySelector('.chips');
  if (chips && suggested.length && !chips.querySelector('[data-cat="suggested"]')) {
    suggested.forEach(([sku]) => { const li = root.querySelector(`.sku[data-sku="${sku}"]`); if (li) li.dataset.tags = `${li.dataset.tags ?? ''} suggested`.trim(); });
    chips.children[0].insertAdjacentHTML('afterend', String(html`<button type="button" class="chip chip-suggested" data-cat="suggested" aria-pressed="false">${icon('spark')}<span>${t('f.sc.chip')}</span><span class="chip-count">${suggested.length}</span></button>`));
    if (cart.isEmpty()) chips.querySelector('[data-cat="suggested"]').click();
  }

  const draw = () => {
    const lines = cart.lines();
    const { C, all } = findingsFor(o, lines);
    const N = C.need;
    const have = Object.values(lines).reduce((a, b) => a + b, 0);
    const target = N.totals.realisable;
    const pct = target ? Math.min(100, Math.round((have / target) * 100)) : 0;
    mount(slot, html`<section class="sc sc-live" aria-live="polite">
      ${N.display && target ? html`<div class="sc-progress">
        <p><strong>${t('f.sc.cartOf', { have, target })}</strong> <span class="muted">· ${t('f.sc.toDate', { date: until(N) })}</span></p>
        <div class="meter is-small"><span class="meter-fill ${have > target * 1.5 ? 'is-over' : ''}" style="width:${pct}%"></span></div>
      </div>` : ''}
      ${all.length ? listHtml(all) : html`<p class="sc-ok">${icon('check')}<span>${t('f.sc.allGood')}</span></p>`}
    </section>`);
    slot.hidden = false;
    slot.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => applyAction(all[Number(b.dataset.act)].action)));
    // Per-pack hints under each SKU.
    root.querySelectorAll('[data-slot="sku-hint"]').forEach((h) => {
      const sku = h.dataset.sku;
      const s = N.display ? N.skus[sku] : null;
      if (!s || !(s.realisable > 0 || s.suggested > 0)) { h.hidden = true; return; }
      const inCart = lines[sku] ?? 0;
      const tags = (s.gates ?? []).filter((g) => ['distributor', 'cooler', 'on-hand', 'credit', 'safe-cap'].includes(g));
      mount(h, html`<p class="sku-sug ${inCart >= s.realisable && s.realisable ? 'is-met' : ''}">${icon('spark')}<span>${t('f.sc.skuHint', { n: s.realisable, date: until(N) })}${tags.length ? html` <span class="muted">· ${tags.map((g) => t(`f.sc.tag.${g}`, { n: s.onHand ?? 0 })).join(', ')}</span>` : ''}</span></p>`);
      h.hidden = false;
    });
  };
  draw();
  offCart = cart.subscribe(() => draw());
}

// ---- Order review: opportunities and warnings, plus the offer pop-up --------------------------

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
      if (!best || share > best.share) best = { sku, with: a, share, orders: withA.length };
    });
  });
  if (!best) return null;
  return { rule: 'together', level: 'nudge', audience: 'both', sku: best.sku,
    text: t('f.sc.together', { name: name(best.sku), pct: Math.round(best.share * 100), with: name(best.with), area: o.area }),
    action: { set: { [best.sku]: 1 } } };
}

function review(root, o) {
  const slot = root.querySelector('[data-slot="review-check"]');
  if (!slot || cart.outletId !== o.id || cart.isEmpty()) return;
  const lines = cart.lines();
  const { C, all } = findingsFor(o, lines);
  if (!C.need.display) { slot.hidden = true; return; }
  const tog = boughtTogether(o, lines);
  const list = [...all.filter((f) => f.level !== 'info' || typeOf(f) === 'scheme'), ...(tog ? [tog] : [])];
  if (!list.length) {
    mount(slot, html`<section class="card rc"><p class="sc-ok">${icon('check')}<span>${t('f.sc.reviewOk', { date: until(C.need) })}</span></p></section>`);
    slot.hidden = false;
    return;
  }
  mount(slot, html`<section class="card rc">
    <h2 class="card-title">${icon('spark')}<span>${t('f.sc.reviewTitle')}</span></h2>
    ${listHtml(list, { limit: 5 })}
    <p class="fine">${t('f.sc.reviewNote')}</p>
  </section>`);
  slot.hidden = false;
  slot.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => applyAction(list[Number(b.dataset.act)].action)));

  // The offer pop-up: once per outlet visit, for a scheme the order is 1–2 cases short of.
  const offer = list.find((f) => f.rule === 'threshold' && f.action?.set);
  if (offer && !offered.has(o.id)) {
    offered.add(o.id);
    const [[sku, n]] = Object.entries(offer.action.set);
    const add = n - (lines[sku] ?? 0);
    openSheet({
      title: t('f.offer.title'),
      body: html`<div class="offer-art" aria-hidden="true">${icon('tag')}</div>
        <p class="offer-text">${offer.text}</p>
        <p class="fine">${t('f.offer.note')}</p>`,
      actions: [{ key: 'add', label: t('f.offer.add', { n: add, name: name(sku) }), tone: 'primary' }, { key: 'close', label: t('common.close'), tone: 'secondary' }],
      dismissKey: 'close',
    }).then((k) => { if (k === 'add') applyAction(offer.action); });
  }
}

// ---- After submit: next week's outlook --------------------------------------------------------

function outlook(root, o) {
  const slot = root.querySelector('[data-slot="saved-outlook"]');
  if (!slot) return;
  const N = season.need(o.id);
  if (!N.display) return;
  const cal = data.calendar() ?? {};
  const from = N.cover.nextVisit;
  const to = fmt.addDays(from, Math.max(7, N.cover.days));
  const events = (cal.events ?? []).filter((e) => !e.quiet && e.from <= to && e.to >= from && (!(e.appliesTo?.tags ?? []).length || (e.appliesTo.tags ?? []).some((x) => (o.tags ?? []).includes(x))));
  const closure = (o.closures ?? []).find((c) => c.from <= to && c.to >= from);
  const bookings = (o.bookings ?? []).filter((b) => b.date >= from && b.date < to);
  const fc = (cal.forecast?.periods ?? []).filter((p) => p.to >= from && p.from <= to);
  const rain = fc.some((p) => ['moderate', 'high'].includes(p.rainChance));
  const onset = cal.climatology?.normalOnsetPune ? `${data.demoDate().slice(0, 4)}-${cal.climatology.normalOnsetPune}` : null;
  const up = events.filter((e) => Number(Array.isArray(e.multiplier) ? e.multiplier[1] : e.multiplier) > 1);
  const down = events.filter((e) => Number(Array.isArray(e.multiplier) ? e.multiplier[0] : e.multiplier) < 1);
  const dir = closure || down.length ? 'down' : up.length || bookings.length ? 'up' : 'steady';
  const top = packsOf(N).slice(0, 3).map(([sku]) => name(sku));
  // Packs this outlet needs that the distributor has limited or out this morning.
  const limited = packsOf(N).map(([sku]) => ({ sku, it: data.stockFor(sku) }))
    .filter((x) => x.it && (x.it.status !== 'ok' || x.it.sourceStatus)).slice(0, 2);
  const prep = [];
  if (closure) prep.push(t('f.out.prepClosure', { date: fmt.shortDate(closure.from) }));
  if (bookings.length) prep.push(t('f.out.prepBookings', { n: bookings.length, cases: bookings.reduce((a, b) => a + (b.expectedCases ?? 0), 0) }));
  if (limited.length) prep.push(t('f.out.prepStock', { list: limited.map((x) => name(x.sku)).join(', ') }));
  if (rain) prep.push(t('f.out.prepRain'));
  prep.push(t('f.out.prepCall', { date: fmt.shortDate(fmt.addDays(from, -1)) }));
  mount(slot, html`<section class="card outlook" aria-labelledby="outlook-title">
    <h2 class="card-title" id="outlook-title">${icon('trend')}<span>${t('f.out.title')}</span></h2>
    <p class="outlook-dir dir-${dir}">${t(`f.out.dir.${dir}`)}</p>
    <dl class="kv">
      <div><dt>${t('f.out.next')}</dt><dd>${fmt.shortDate(from)} <span class="muted">· ${t('f.out.expect', { n: Math.round(N.totals.expected) })}</span></dd></div>
      ${top.length ? html`<div><dt>${t('f.out.focus')}</dt><dd>${top.join(', ')}</dd></div>` : ''}
      ${up.length || down.length ? html`<div><dt>${t('f.out.events')}</dt><dd>${[...up, ...down].slice(0, 2).map((e) => e.name).join(', ')}</dd></div>` : ''}
      ${limited.length ? html`<div><dt>${t('f.out.stock')}</dt><dd>${limited.map((x) => `${name(x.sku)} (${x.it.note || x.it.sourceStatus || x.it.status})`).join('; ')}</dd></div>` : ''}
      ${onset ? html`<div><dt>${t('f.out.monsoon')}</dt><dd>${t('f.out.monsoonIn', { days: fmt.daysBetween(data.demoDate(), onset) })}</dd></div>` : ''}
    </dl>
    <p class="sub-title">${t('f.out.prep')}</p>
    <ul class="prep">${prep.map((x) => html`<li>${icon('check')}<span>${x}</span></li>`)}</ul>
    <p class="fine">${t('f.out.note')}</p>
  </section>`);
  slot.hidden = false;
}

// ---- Landing: a small suggestion badge on each route stop -------------------------------------

function routeBadges(root) {
  root.querySelectorAll('[data-slot="route-badge"]').forEach((el) => {
    const N = season.need(el.dataset.outletId);
    if (!N?.display) return;
    const closing = N.mode === 'closing';
    mount(el, closing ? pill(t('f.sc.badgeClosing'), 'caution', 'calendarX')
      : N.totals.realisable ? pill(t('f.sc.badge', { n: N.totals.realisable }), 'info', 'spark') : '');
    el.hidden = false;
  });
}
