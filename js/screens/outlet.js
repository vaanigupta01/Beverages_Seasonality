// Outlet details: who the outlet is, what it ordered, what it owes, which schemes apply.

import { nav } from '../app.js';
import * as data from '../data.js';
import * as orders from '../orders.js';
import * as schemes from '../schemes.js';
import { cart } from '../cart.js';
import * as fmt from '../format.js';
import { t, label } from '../i18n.js';
import { html, mount, fresh, icon, appBar, pill, tierBadge, personaTag, schemePill, slot, emptyState } from '../ui.js';
import * as tools from '../feature/outlet-tools.js';
import { directionsUrl } from '../feature/outlet-tools.js';
import { schemeArt } from '../feature/scheme-art.js';

export function render(root, { id }) {
  const view = fresh(root);
  const o = data.outlet(id);
  if (!o) return notFound(view, id);

  const today = data.demoDate();
  const v = data.visits(o.id);
  const all = orders.allOrdersFor(o.id);
  const savedToday = orders.demoOrdersOn(o.id, today);
  const inCart = cart.outletId === o.id && !cart.isEmpty();
  const address = o.area && !String(o.address ?? '').includes(o.area) ? `${o.address}, ${o.area}` : o.address;
  const typeLabel = o.shopType && o.shopType !== o.channel ? `${label('ch', o.channel)} · ${label('shop', o.shopType)}` : label('ch', o.channel);
  const closures = (o.closures ?? []).filter((c) => c.to >= today).sort((a, b) => (a.from < b.from ? -1 : 1));

  const bookLabel = inCart ? t('outlet.continue', { cases: fmt.casesText(cart.totalCases()) }) : savedToday.length ? t('outlet.bookAnother') : t('outlet.book');

  mount(view, html`
    ${appBar({
      title: t('outlet.title'), back: nav.hub, heading: false,
      action: html`<span class="bar-acts">
        <button type="button" class="bar-btn" data-tool="note" aria-label="${t('f.tools.note')}">${icon('note')}</button>
        <button type="button" class="bar-btn is-mic" data-tool="mic" aria-label="${t('f.tools.mic')}">${icon('mic')}</button>
      </span>`,
    })}
    <div class="page page-outlet">
      <header class="profile">
        <div class="profile-top">
          <div class="profile-id">
            ${personaTag(o)}
            <h1 class="profile-name">${o.name}</h1>
            <p class="profile-addr">${icon('map')}<span>${address}</span></p>
          </div>
          <div class="profile-acts">
            <button type="button" class="icon-btn is-call" data-tool="call" aria-label="${t('f.tools.call')}">${icon('phone')}</button>
            <button type="button" class="icon-btn is-issue" data-tool="issue" aria-label="${t('f.tools.issue')}">${icon('flag')}</button>
            <a class="icon-btn is-map" href="${directionsUrl(o)}" target="_blank" rel="noopener noreferrer" aria-label="${t('outlet.directionsLabel', { name: o.name })}">${icon('map')}</a>
          </div>
        </div>
        <div class="row-tags">
          ${tierBadge(o, { visits: true })}
          ${v?.todayOnRoute ? pill(t('outlet.stop', { n: v.routeOrder }), 'info', 'route') : ''}
          ${pill(typeLabel, 'neutral')}
          ${tools.territoryPill(o)}
        </div>
        <div class="profile-foot">
          ${o.owner?.name ? html`<p class="profile-owner">${icon('store')}<span>${o.owner.name}</span></p>` : html`<span></span>`}
          <span data-part="issues">${tools.issuesBadge(o)}</span>
        </div>
      </header>

      ${savedToday.length ? html`<p class="strip-ok">${icon('check')}<span>${t('f.outlet.orderedToday', { cases: fmt.casesText(savedToday.reduce((n, x) => n + orders.paidCases(x), 0)), value: fmt.rupees(savedToday.reduce((n, x) => n + x.netValue, 0)) })}</span></p>` : ''}
      ${closures.map((c) => html`<p class="strip-warn">${icon('calendarX')}<span><b>${t('outlet.closed', { range: fmt.dateRange(c.from, c.to, today) })}</b> · ${c.reason}</span></p>`)}

      ${slot('outlet-season')}
      ${tools.stockOnHandCard(o)}
      ${slot('outlet-brief')}
      ${schemesCard(o, all, today)}
      ${lastOrderCard(all, v, today, savedToday.length > 0)}
      ${paymentCard(o, today)}
      ${historyCard(all, today)}
      ${coolerCard(o, today)}
      ${bookingsCard(o, today)}
      <div data-part="notes">${notesCard(o, v, today)}</div>
    </div>
    <div class="bottom-bar">
      <a class="btn btn-primary btn-block" href="#/book/${o.id}">${icon('box')}<span>${bookLabel}</span></a>
    </div>`);

  // Notes and issues redraw in place, so the rep keeps their scroll position.
  tools.wire(view, o, (part) => {
    const el = view.querySelector(`[data-part="${part}"]`);
    if (el) mount(el, part === 'notes' ? notesCard(o, v, today, true) : tools.issuesBadge(o));
  });
}

function notFound(view, id) {
  mount(view, html`
    ${appBar({ title: t('outlet.title'), back: nav.hub })}
    <div class="page">${emptyState({
      icon: 'store',
      title: t('outlet.notFound'),
      body: t('outlet.notFoundBody', { id: id ?? '' }),
      action: html`<a class="btn btn-primary" href="#/outlets">${t('outlet.openList')}</a>`,
    })}</div>`);
}

/** A card that opens on tap: icon, title and a one-line summary when closed. */
const fold = (iconName, tone, title, summary, body, { open = false, cls = '', warn = false } = {}) =>
  html`<details class="card collapse fold ${cls}" ${open ? 'open' : ''}>
    <summary class="collapse-head">
      <span class="card-title"><span class="fold-ico ic-${tone}">${icon(iconName)}</span><span>${title}</span></span>
      <span class="collapse-sum ${warn ? 'text-warn' : ''}">${warn ? icon('alert') : ''}<span>${summary}</span></span>
      ${icon('chevron', 'collapse-chev')}
    </summary>
    <div class="collapse-body">${body}</div>
  </details>`;

/** Small icon tiles for a fold's facts: label on top, the value large, an optional note. */
const tiles = (items) => html`<div class="tiles">${items.filter(Boolean).map((i) => html`<div class="tile ${i.tone ? `is-${i.tone}` : ''}">
  <span class="tile-l">${icon(i.icon)}${i.label}</span><b class="tile-v">${i.value}</b>${i.sub ? html`<span class="tile-s">${i.sub}</span>` : ''}
</div>`)}</div>`;

function lastOrderCard(all, v, today, visitedToday) {
  const last = all[0];
  // A demo order today counts as today's visit (visits.json only holds past visits).
  const lastVisit = visitedToday
    ? { date: today, minutes: null }
    : (v?.visits ?? []).filter((x) => x.done && x.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const summary = last ? `${fmt.relative(last.date, today)} · ${fmt.casesText(orders.paidCases(last))}` : t('kv.noOrders');
  return fold('calendar', 'blue', t('card.lastOrder'), summary, html`
    ${tiles([
      last && { icon: 'box', label: t('kv.lastOrder'), value: fmt.shortDate(last.date), sub: fmt.relative(last.date, today) },
      last && { icon: 'wallet', label: t('kv.value'), value: fmt.rupees(last.netValue), sub: fmt.casesText(orders.paidCases(last)) },
      { icon: 'check', label: t('kv.lastVisit'), value: lastVisit ? fmt.shortDate(lastVisit.date) : '—', sub: lastVisit ? fmt.relative(lastVisit.date, today) : t('kv.noVisits') },
      v?.nextVisitAfterToday && { icon: 'calendar', label: t('kv.nextVisit'), value: fmt.shortDate(v.nextVisitAfterToday), sub: fmt.relative(v.nextVisitAfterToday, today), tone: 'blue' },
    ])}
    ${last ? html`<p class="fold-sub">${t('f.fold.lastLines')}</p>${tools.orderLinesHtml(last)}` : ''}`);
}

function paymentCard(o, today) {
  const c = o.credit ?? {};
  const overdue = c.overdue ?? 0;
  const limit = c.limit ?? 0;
  const used = c.outstanding ?? 0;
  const room = Math.max(0, limit - used);
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const summary = overdue > 0 ? t('f.pay.due', { amt: fmt.rupees(overdue) }) : t('f.pay.room', { amt: fmt.rupees(room) });
  return fold('wallet', 'green', t('card.payment'), summary, html`
    <div class="credit-bar"><div class="credit-top"><span>${t('f.fold.creditUsed', { used: fmt.rupees(used), limit: fmt.rupees(limit) })}</span><b>${t('f.pay.room', { amt: fmt.rupees(room) })}</b></div>
      <div class="credit-track"><span style="width:${pct}%" class="${overdue > 0 ? 'is-due' : ''}"></span></div></div>
    ${tiles([
      { icon: 'alert', label: t('kv.overdue'), value: fmt.rupees(overdue), tone: overdue > 0 ? 'warn' : '' },
      { icon: 'calendar', label: t('kv.lastPayment'), value: c.lastPaymentDate ? fmt.shortDate(c.lastPaymentDate) : '—', sub: c.lastPaymentDate ? fmt.relative(c.lastPaymentDate, today) : t('kv.noneYet') },
      c.paymentMode === 'cash-and-credit' && { icon: 'wallet', label: t('f.fold.pays'), value: t('f.fold.cashAbove'), sub: t('f.fold.cashAboveSub', { amt: fmt.rupees(limit) }) },
    ])}`, { warn: overdue > 0 });
}

const ORDER = { enrolled: 0, applicable: 1, used: 2, not: 3 };

/** Schemes as illustrated cards: the art says what the scheme is about before the words do. */
function schemesCard(o, all, today) {
  const hasCooler = o.cooler?.type === 'bottler';
  const list = schemes.activeSchemes(today)
    .filter((s) => s.type !== 'program' || hasCooler)
    .map((s) => ({ s, st: schemes.statusFor(s, o, today, all) }))
    .filter(({ st }) => st.kind !== 'not')          // schemes this shop can't get aren't shown at all
    .sort((a, b) => ORDER[a.st.kind] - ORDER[b.st.kind]);
  if (!list.length) return '';
  const month = fmt.monthName(today, true);
  const usable = list.filter((x) => x.st.kind === 'applicable' || x.st.kind === 'enrolled').length;
  return html`<section class="sch-block">
    <h2 class="section-title">${t('f.sch.head', { n: usable })}</h2>
    <div class="sch-scroll">${list.map(({ s, st }) => html`<a class="sch-card st-${st.kind}" href="#/scheme/${s.id}/${o.id}" style="${schemeArt(s)}">
      <span class="sch-top">${schemePill(st)}</span>
      <span class="sch-name">${s.name}</span>
      <span class="sch-offer">${s.type === 'program' ? t('f.sch.program', { amt: schemes.payoutAmount(s) }) : schemes.chipText(s)}</span>
      <span class="sch-meta">${st.cap && st.kind !== 'not' ? t('f.sch.left', { left: Math.max(0, st.cap - st.used), cap: st.cap, month }) : st.kind === 'not' ? st.reason : s.validTo ? t('common.till', { date: fmt.shortDate(s.validTo) }) : ''}</span>
    </a>`)}</div>
  </section>`;
}

function historyCard(all, today) {
  if (!all.length) return fold('history', 'purple', t('card.history'), t('history.empty'), html`<p class="muted">${t('history.emptyBody')}</p>`);
  return fold('history', 'purple', t('card.history'), t('f.hist.sum', { n: all.length }), html`
    ${monthStrip(all, today)}
    <p class="fold-sub">${t('f.fold.recent')}</p>
    <ul class="recent">${all.slice(0, 3).map((x) => html`<li>
      <span class="recent-d">${fmt.shortDate(x.date)}${x.source === 'demo' ? html` <em>${t('f.fold.today')}</em>` : ''}</span>
      <span>${fmt.casesText(orders.paidCases(x))}</span>
      <b class="num">${fmt.rupees(x.netValue)}</b>
    </li>`)}</ul>`);
}

function monthStrip(all, today) {
  const end = fmt.monthKey(today);
  const months = Array.from({ length: 13 }, (_, i) => fmt.addMonths(end, i - 12));
  const totals = new Map(months.map((m) => [m, 0]));
  all.forEach((x) => {
    const k = fmt.monthKey(x.date);
    if (totals.has(k)) totals.set(k, totals.get(k) + orders.paidCases(x));
  });
  const max = Math.max(1, ...totals.values());
  const aria = `${t('history.stripAria')} ${months.map((m) => `${fmt.monthName(m)} ${m.slice(0, 4)}: ${totals.get(m)}`).join('; ')}`;
  const first = months[0];
  return html`<figure class="strip" role="img" aria-label="${aria}">
    <div class="strip-bars">${months.map((m) => {
      const val = totals.get(m);
      return html`<span class="strip-col ${m === end ? 'is-current' : ''} ${val ? '' : 'is-zero'}">
        <span class="strip-val">${val ? fmt.num(val) : ''}</span>
        <span class="strip-bar" style="height:${val ? Math.max(3, Math.round((val / max) * 52)) : 2}px"></span>
      </span>`;
    })}</div>
    <div class="strip-labels" aria-hidden="true">${months.map((m) => html`<span class="${m === end ? 'is-current' : ''}">${fmt.monthTiny(m)}</span>`)}</div>
    <figcaption class="fine">${t('history.strip', {
      from: `${fmt.monthName(first)} ${first.slice(0, 4)}`,
      to: `${fmt.monthName(end)} ${end.slice(0, 4)}`,
      month: fmt.monthName(end),
      date: fmt.date(today, { weekday: false, year: false }),
    })}</figcaption>
  </figure>`;
}

/** Collapsed by default; the summary row still shows what cooler it is and flags a bad audit. */
function coolerCard(o, today) {
  const c = o.cooler ?? { type: 'none' };
  const a = c.lastAudit;
  const kind = c.type === 'bottler' ? t('cooler.company', { count: c.count, litres: c.litres })
    : ({ 'own-fridge': `${t('cooler.ownFridge')}${c.litres ? ` · ${c.litres} L` : ''}`, 'ice-box': t('cooler.iceBox'), none: t('cooler.none') }[c.type] ?? c.type);
  const warn = Boolean(a && (!a.pure || a.tempC > 6)) || Boolean(c.afternoonOutage);
  return fold('cooler', 'teal', t('card.cooler'), kind, html`
    ${tiles([
      { icon: 'cooler', label: t('cooler.label'), value: c.type === 'bottler' ? `${c.count} × ${c.litres} L` : kind, sub: c.type === 'bottler' ? t('f.fold.company') : '' },
      c.slots ? { icon: 'box', label: t('f.fold.fits'), value: t('f.fold.fitsVal', { n: c.slots }), sub: t('f.fold.fitsSub') } : null,
      o.empties?.cratesHeld != null ? { icon: 'box', label: t('cooler.crates'), value: fmt.num(o.empties.cratesHeld) } : null,
      a ? { icon: 'check', label: t('cooler.lastAudit'), value: fmt.shortDate(a.date), sub: a.pure ? t('cooler.yes') : t('cooler.otherBrands'), tone: a.pure ? '' : 'warn' } : null,
    ])}
    ${c.afternoonOutage ? html`<p class="strip-warn fold-warn">${icon('alert')}<span>${t('f.fold.outage')}</span></p>` : ''}`, { warn });
}

function bookingsCard(o, today) {
  const upcoming = (o.bookings ?? []).filter((b) => b.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!upcoming.length) return '';
  const total = upcoming.reduce((n, b) => n + (b.expectedCases ?? 0), 0);
  return fold('calendar', 'pink', t('card.bookings'), t('f.book.sum', { n: upcoming.length, cases: fmt.casesText(total) }), html`
    <ul class="mini-list">${upcoming.map((b) => html`<li>
      <span>${fmt.shortDate(b.date)}</span>
      <span>${b.event}</span>
      <span class="num">${b.expectedCases != null ? `~${fmt.casesText(b.expectedCases)}` : ''}</span>
    </li>`)}</ul>`);
}

function notesCard(o, v, today, open = false) {
  const notes = tools.notesList(o, v, today);
  return fold('note', 'amber', t('card.notes'), notes.length ? t('f.notes.sum', { n: notes.length }) : t('notes.empty'),
    notes.length ? tools.notesHtml(notes) : html`<p class="muted">${t('f.notes.empty')}</p>`, { open: open || notes.some((n) => n.fresh) });
}
