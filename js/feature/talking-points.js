// Talking points: short, data-backed things the rep can raise with the owner at this visit —
// the closure or bookings ahead, the weather, what sold last year in these same days,
// schemes worth using, what's coming up locally, stock limits, the cooler — plus a few
// points "for you only" (dues, cash terms) kept apart because the owner may see the screen.
//
// Fills two feature slots: `outlet-brief` on Outlet details (the card) and `booking-live`
// on Order booking (a button that opens the same points in a sheet).
// Everything is computed from the data and the demo date; nothing is typed in.

import { app } from '../app.js';
import * as data from '../data.js';
import * as orders from '../orders.js';
import * as schemes from '../schemes.js';
import * as fmt from '../format.js';
import { t } from '../i18n.js';
import { html, mount, icon, openSheet } from '../ui.js';

const VISIBLE = 3;          // points shown before "Show more"
const MAX_POINTS = 6;       // one visit, a few points: the most useful first
const HORIZON_DAYS = 21;    // how far ahead dated events are mentioned
const RECENT_DAYS = 84;     // what "the outlet buys" means: ordered in the last 12 weeks

export function install() {
  app.on('screen:rendered', ({ screen, outletId, root }) => {
    const o = outletId ? data.outlet(outletId) : null;
    if (!o) return;
    if (screen === 'outlet') fillCard(root, o);
    if (screen === 'book') fillBookingButton(root, o);
  });
}

// ---- rendering -------------------------------------------------------------

function fillCard(root, o) {
  const slot = root.querySelector('[data-slot="outlet-brief"]');
  if (!slot) return;
  const P = pointsFor(o);
  mount(slot, html`<section class="tp" aria-labelledby="tp-title">
    <header class="tp-head">
      <span class="tp-mark">${icon('chat')}</span>
      <div>
        <h2 class="tp-title" id="tp-title">${t('tp.title')}</h2>
        <p class="tp-sub">${t('tp.sub', { date: fmt.shortDate(P.cover.nextVisit) })}</p>
      </div>
    </header>
    ${listHtml(P)}
  </section>`);
  slot.hidden = false;
  slot.addEventListener('click', (e) => {
    const more = e.target.closest('[data-tp-more]');
    if (!more) return;
    const open = slot.querySelector('.tp-list').classList.toggle('is-open');
    more.textContent = open ? t('tp.less') : t('tp.more', { n: Number(more.dataset.n) });
    more.setAttribute('aria-expanded', String(open));
  });
}

function fillBookingButton(root, o) {
  const slot = root.querySelector('[data-slot="booking-live"]');
  if (!slot) return;
  const P = pointsFor(o);
  const n = P.owner.length + P.rep.length;
  if (!n) return;
  mount(slot, html`<button type="button" class="tp-open" data-tp-open>
    <span class="tp-open-mark">${icon('chat')}</span>
    <span>${t('tp.open', { n: P.owner.length })}</span>
    ${icon('chevron', 'tp-open-chev')}
  </button>`);
  slot.hidden = false;
  slot.querySelector('[data-tp-open]').addEventListener('click', () => openSheet({
    title: t('tp.title'),
    body: html`<p class="tp-sub">${t('tp.sub', { date: fmt.shortDate(P.cover.nextVisit) })}</p>${listHtml(P, { all: true })}`,
    actions: [{ key: 'close', label: t('common.close'), tone: 'secondary' }],
    dismissKey: 'close',
  }));
}

function listHtml(P, { all = false } = {}) {
  const extra = all ? 0 : Math.max(0, P.owner.length - VISIBLE);
  return html`
    ${P.owner.length
      ? html`<ol class="tp-list">${P.owner.map((p, i) => itemHtml(p, !all && i >= VISIBLE))}</ol>`
      : html`<p class="tp-empty">${t('tp.none')}</p>`}
    ${extra ? html`<button type="button" class="tp-more" data-tp-more data-n="${extra}" aria-expanded="false">${t('tp.more', { n: extra })}</button>` : ''}
    ${P.rep.length ? html`<details class="tp-rep">
      <summary>${icon('lock')}<span class="tp-rep-title">${t('tp.forYou')}</span><span class="tp-rep-note">${t('tp.forYouNote')}</span>${icon('chevron', 'collapse-chev')}</summary>
      <ol class="tp-list is-open">${P.rep.map((p) => itemHtml(p))}</ol>
    </details>` : ''}`;
}

function itemHtml(p, extra = false) {
  return html`<li class="tp-item tone-${p.tone} ${extra ? 'tp-extra' : ''}">
    <span class="tp-icon">${icon(p.icon)}</span>
    <div class="tp-text">
      <p class="tp-cat">${t(`tp.cat.${p.cat}`)}</p>
      <p class="tp-point">${p.title}</p>
      ${p.body ? html`<p class="tp-detail">${p.body}</p>` : ''}
      <p class="tp-src">${p.source}${p.href ? html` · <a href="${p.href}">${t('tp.seeScheme')}</a>` : ''}</p>
    </div>
  </li>`;
}

// ---- the points ------------------------------------------------------------

/** → { owner: [point], rep: [point], cover: { today, delivery, nextVisit } }, most useful first. */
export function pointsFor(o) {
  const today = data.demoDate();
  const cfg = data.config();
  const nextVisit = data.visits(o.id)?.nextVisitAfterToday ?? fmt.addDays(today, 7);
  const delivery = fmt.addDays(today, cfg.distributor?.deliveryLeadDays ?? 1);
  const cover = { today, delivery, nextVisit };
  const all = orders.allOrdersFor(o.id);
  const past = all.filter((x) => x.source !== 'demo' && x.date < today);
  const bought = boughtSkus(past, cover);
  const cal = data.calendar() ?? {};
  const closure = (o.closures ?? []).filter((c) => c.to >= today && c.from <= nextVisit).sort((a, b) => (a.from < b.from ? -1 : 1))[0];

  // Most useful first; schemes, stock and events take turns so the top few cover different things.
  // Before a closure, don't talk the owner into buying more: no scheme or stock pushes.
  const [sch = [], stk = [], evt = []] = closure
    ? [[], [], eventPoints(o, cal, cover, true)]
    : [schemePoints(o, all, bought, cover), stockPoints(bought), eventPoints(o, cal, cover, false)];
  const owner = [
    closure && closurePoint(closure, cover),
    bookingsPoint(o, cover),
    !closure && weatherPoint(o, cal, cover),
    !closure && lastYearPoint(past, cover),
    sch[0], stk[0], evt[0],
    sch[1], stk[1], evt[1],
    peersPoint(o, past, cover),
    coolerPoint(o),
    emptiesPoint(o, bought),
  ].filter(Boolean).slice(0, MAX_POINTS);
  const rep = [paymentPoint(o)].filter(Boolean);
  return { owner, rep, cover };
}

const paidOf = (list) => list.reduce((n, x) => n + orders.paidCases(x), 0);
const inRange = (x, from, to) => x.date >= from && x.date < to;
const productName = (sku) => data.product(sku)?.name ?? sku;

/** SKUs the outlet bought in the last 12 weeks, or in the same days last year. */
function boughtSkus(past, { today, nextVisit }) {
  const from = fmt.addDays(today, -RECENT_DAYS);
  const lyFrom = fmt.addDays(today, -364);
  const lyTo = fmt.addDays(nextVisit, -364);
  const set = new Set();
  past.filter((x) => inRange(x, from, today) || inRange(x, lyFrom, lyTo))
    .forEach((x) => x.lines.forEach((l) => { if (l.cases > 0) set.add(l.sku); }));
  return set;
}

function topSkus(list, count = 2) {
  const tally = new Map();
  list.forEach((x) => x.lines.forEach((l) => tally.set(l.sku, (tally.get(l.sku) ?? 0) + (l.cases || 0))));
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, count).map(([sku]) => productName(sku));
}

const joinNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} ${t('common.and')} ${names.at(-1)}` : names[0] ?? '');

function closurePoint(c, { today, delivery }) {
  const range = fmt.dateRange(c.from, c.to, today);
  const sellingDays = fmt.daysBetween(delivery, c.from);
  return {
    cat: 'closure', icon: 'calendarX', tone: 'warn',
    title: t('tp.closure.title', { range }),
    body: c.from > today && sellingDays > 0
      ? t('tp.closure.soon', { n: sellingDays })
      : t('tp.closure.now', { date: fmt.shortDate(fmt.addDays(c.to, 1)) }),
    source: t('tp.src.calendar'),
  };
}

function bookingsPoint(o, { today, nextVisit }) {
  const list = (o.bookings ?? []).filter((b) => b.date >= today && b.date < nextVisit);
  if (!list.length) return null;
  const cases = list.reduce((n, b) => n + (b.expectedCases ?? 0), 0);
  const big = [...list].sort((a, b) => (b.expectedCases ?? 0) - (a.expectedCases ?? 0))[0];
  return {
    cat: 'bookings', icon: 'calendar', tone: 'ok',
    title: t('tp.bookings.title', { functions: t('n.function', { n: list.length }), cases: fmt.casesText(cases) }),
    body: t('tp.bookings.body', { date: fmt.shortDate(big.date), event: big.event }),
    source: t('tp.src.bookings'),
  };
}

function weatherPoint(o, cal, { today, delivery, nextVisit }) {
  const periods = (cal.forecast?.periods ?? []).filter((p) => p.from <= nextVisit && p.to >= delivery && Array.isArray(p.maxC));
  if (!periods.length) return null;
  const lo = Math.min(...periods.map((p) => p.maxC[0]));
  const hi = Math.max(...periods.map((p) => p.maxC[1] ?? p.maxC[0]));
  if (hi < 35) return null;
  const until = periods.at(-1).to < nextVisit ? periods.at(-1).to : nextVisit;
  const dry = periods.every((p) => p.rainChance === 'none');
  const onsetMd = cal.climatology?.normalOnsetPune;
  const onset = onsetMd ? fmt.date(`${today.slice(0, 4)}-${onsetMd}`, { weekday: false, year: false }) : '';
  const cold = ['bottler', 'own-fridge', 'ice-box'].includes(o.cooler?.type);
  return {
    cat: 'weather', icon: 'sun', tone: 'sun',
    title: t(dry ? 'tp.heat.title' : 'tp.heat.titleShower', { date: fmt.shortDate(until), min: lo, max: hi }),
    body: t(cold ? 'tp.heat.chilled' : 'tp.heat.takehome', { onset }),
    source: t('tp.src.forecast', { date: fmt.shortDate(cal.forecast.asOf ?? today) }),
  };
}

/** The same days last year (364 days back keeps the weekdays), against the same span just gone. */
function lastYearPoint(past, { today, nextVisit }) {
  const days = fmt.daysBetween(today, nextVisit);
  if (days <= 0) return null;
  const ly = past.filter((x) => inRange(x, fmt.addDays(today, -364), fmt.addDays(nextVisit, -364)));
  const lyCases = paidOf(ly);
  if (!lyCases) return null;
  const recent = paidOf(past.filter((x) => inRange(x, fmt.addDays(today, -days), today)));
  const skus = joinNames(topSkus(ly));
  return {
    cat: 'history', icon: 'history', tone: 'thin',
    title: t('tp.ly.title', { days, cases: fmt.casesText(lyCases) }),
    body: recent ? t('tp.ly.body', { days, recent: fmt.casesText(recent), skus }) : t('tp.ly.bodyNoRecent', { skus }),
    source: t('tp.src.orders'),
  };
}

function schemePoints(o, all, bought, { today, nextVisit }) {
  const month = fmt.monthName(today, true);
  const out = [];
  for (const s of schemes.activeSchemes(today)) {
    if (s.type === 'program') continue;
    const relevant = s.type === 'first-order' || (Array.isArray(s.skus) && s.skus.some((k) => bought.has(k)));
    if (!relevant) continue;
    const st = schemes.statusFor(s, o, today, all);
    const base = { cat: 'scheme', icon: 'tag', tone: 'info', source: t('tp.src.scheme'), href: `#/scheme/${s.id}/${o.id}` };
    const names = schemes.listNames(s.skus);
    if (st.kind === 'applicable' && s.type === 'first-order') {
      const until = fmt.addDays(o.registeredOn, s.rule?.withinDaysOfRegistration ?? 90);
      out.push({ ...base, rank: 0, title: `${s.name}: ${schemes.chipText(s)}`, body: t('tp.scheme.first', { date: fmt.shortDate(until) }) });
    } else if (st.kind === 'applicable' && s.type === 'free-goods' && st.cap) {
      const left = st.cap - st.used;
      out.push({ ...base, rank: 1, title: `${s.name}: ${schemes.chipText(s)}`,
        body: s.skus.length > 1 ? t('tp.scheme.left', { left, cap: st.cap, skus: names }) : t('tp.scheme.leftSingle', { left, cap: st.cap }) });
    } else if (st.kind === 'used' && s.validTo >= nextVisit && fmt.monthKey(nextVisit) !== fmt.monthKey(today)) {
      out.push({ ...base, rank: 2, title: t('tp.scheme.usedTitle', { name: s.name, month }),
        body: t('tp.scheme.nextMonth', { cap: st.cap, month, date: fmt.shortDate(nextVisit) }) });
    } else if (st.kind === 'applicable' && s.type === 'percent-off') {
      out.push({ ...base, rank: 3, title: `${s.name}: ${schemes.chipText(s)}`, body: t('tp.scheme.pct', { skus: names, date: fmt.shortDate(s.validTo) }) });
    } else if (st.kind === 'applicable' && s.type === 'free-goods') {
      out.push({ ...base, rank: 4, title: `${s.name}: ${schemes.chipText(s)}`, body: s.validTo ? t('tp.scheme.till', { date: fmt.shortDate(s.validTo) }) : '' });
    }
  }
  return out.sort((a, b) => a.rank - b.rank).slice(0, 2);
}

const eventApplies = (e, o) => {
  const ch = e.appliesTo?.channels ?? [];
  const tags = e.appliesTo?.tags ?? [];
  return (!ch.length || ch.includes(o.channel)) && (!tags.length || tags.some((x) => (o.tags ?? []).includes(x)));
};

function eventPoints(o, cal, { today }, hasClosure) {
  const horizon = fmt.addDays(today, HORIZON_DAYS);
  return (cal.events ?? [])
    .filter((e) => e.from <= horizon && e.to >= today && eventApplies(e, o))
    .map((e) => {
      const m = e.multiplier;
      const hi = Array.isArray(m) ? m[1] : m;
      const lo = Array.isArray(m) ? m[0] : m;
      if (hi == null) return null;
      const up = hi > 1;
      if (!up && hasClosure) return null;   // the closure point already says it
      const pct = up ? (lo !== hi ? `${Math.round((lo - 1) * 100)}–${Math.round((hi - 1) * 100)}%` : `${Math.round((hi - 1) * 100)}%`) : '';
      const when = e.from === e.to ? fmt.shortDate(e.from) : fmt.dateRange(e.from, e.to, today);
      const packs = Array.isArray(e.packs) && e.packs.length ? t('tp.event.packs', { packs: joinNames(e.packs.map(productName)) }) : '';
      return {
        cat: 'event', icon: 'calendar', tone: up ? 'ok' : 'warn',
        title: `${e.name} · ${when}`,
        body: (up ? t('tp.event.up', { pct }) : t('tp.event.down')) + packs,
        source: t('tp.src.calendar'),
        from: e.from,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.from < b.from ? -1 : 1))
    .slice(0, 2);
}

function stockPoints(bought) {
  const report = data.stock();
  if (!report) return [];
  const asOf = fmt.shortDate(report.asOf);
  return report.items
    .filter((it) => it.status !== 'ok' && bought.has(it.sku))
    .map((it) => {
      const p = data.product(it.sku);
      if (!p) return null;
      let body = t('tp.stock.body', { date: asOf });
      if (it.status === 'out') {
        const alt = data.products().find((q) => q.sku !== p.sku && q.flavour === p.flavour && q.category === p.category && data.stockFor(q.sku)?.status === 'ok');
        if (alt) body += t('tp.stock.alt', { alt: alt.name });
      }
      return {
        cat: 'stock', icon: 'box', tone: 'warn',
        title: it.status === 'out' ? t('tp.stock.out', { sku: p.name }) : t('tp.stock.rationed', { sku: p.name, max: it.maxCasesPerOutlet }),
        body,
        source: t('tp.src.stock', { date: asOf }),
      };
    })
    .filter(Boolean);
}

/** For outlets with little history: what similar shops on the route sell this week. */
function peersPoint(o, past, { today }) {
  const recentOrders = past.filter((x) => x.date >= fmt.addDays(today, -RECENT_DAYS)).length;
  if (recentOrders >= 3) return null;
  const coolerKey = o.cooler?.type ?? 'none';
  const groups = data.peers()?.groups ?? [];
  const g = groups.find((x) => x.channel === o.channel && x.tier === o.tier && (x.cooler ?? 'none') === coolerKey)
    ?? groups.find((x) => x.channel === o.channel && x.tier === o.tier);
  if (!g) return null;
  const week = fmt.isoWeek(today);
  const rows = Object.entries(g.weeklyCasesBySku ?? {}).map(([sku, w]) => [sku, w?.[week] ?? 0]).filter((r) => r[1] > 0).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((n, r) => n + r[1], 0);
  if (!total) return null;
  return {
    cat: 'peers', icon: 'store', tone: 'thin',
    title: t('tp.peers.title', { n: total.toFixed(1) }),
    body: t('tp.peers.body', { skus: joinNames(rows.slice(0, 2).map(([sku]) => productName(sku))) }),
    source: t('tp.src.peers', { n: g.outletsInGroup }),
  };
}

function coolerPoint(o) {
  const c = o.cooler;
  if (c?.type !== 'bottler') return null;
  const a = c.lastAudit;
  if (a && (a.tempC > 6 || a.fillPct < 70)) {
    return {
      cat: 'cooler', icon: 'cooler', tone: 'warn',
      title: t('tp.cooler.fixTitle', { fill: a.fillPct, temp: a.tempC, date: fmt.shortDate(a.date) }),
      body: (a.tempC > 6 ? t('tp.cooler.warm') : t('tp.cooler.fill')) + (c.afternoonOutage ? t('tp.cooler.outage') : ''),
      source: t('tp.src.audit', { date: fmt.shortDate(a.date) }),
    };
  }
  const program = schemes.activeSchemes().find((s) => s.type === 'program' && s.requiresBottlerCooler);
  if (!program || !a?.pure) return null;
  return {
    cat: 'cooler', icon: 'cooler', tone: 'ok',
    title: t('tp.cooler.rewardTitle', { amt: schemes.payoutAmount(program) }),
    body: t('tp.cooler.rewardBody'),
    source: t('tp.src.audit', { date: fmt.shortDate(a.date) }),
    href: `#/scheme/${program.id}/${o.id}`,
  };
}

function emptiesPoint(o, bought) {
  const n = o.empties?.cratesHeld;
  const buysGlass = [...bought].some((sku) => data.product(sku)?.returnable);
  if (!n || !buysGlass) return null;
  return {
    cat: 'empties', icon: 'box', tone: 'neutral',
    title: t('tp.empties.title', { n }),
    body: t('tp.empties.body'),
    source: t('tp.src.account'),
  };
}

/** Rep only: money the owner owes, or the cash/credit split. */
function paymentPoint(o) {
  const c = o.credit ?? {};
  if ((c.overdue ?? 0) > 0) {
    return {
      cat: 'payment', icon: 'wallet', tone: 'warn',
      title: t('tp.pay.overdue', { amt: fmt.rupees(c.overdue) }),
      body: t('tp.pay.overdueBody', { left: fmt.rupees(Math.max(0, (c.limit ?? 0) - (c.outstanding ?? 0))), date: c.lastPaymentDate ? fmt.shortDate(c.lastPaymentDate) : t('kv.noneYet') }),
      source: t('tp.src.account'),
    };
  }
  if (c.paymentMode === 'cash-and-credit') {
    return {
      cat: 'payment', icon: 'wallet', tone: 'neutral',
      title: t('tp.pay.cash', { limit: fmt.rupees(c.limit ?? 0) }),
      body: t('tp.pay.cashBody'),
      source: t('tp.src.account'),
    };
  }
  return null;
}
