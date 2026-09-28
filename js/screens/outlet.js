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

function lastOrderCard(all, v, today, visitedToday) {
  const last = all[0];
  // A demo order today counts as today's visit (visits.json only holds past visits).
  const lastVisit = visitedToday
    ? { date: today, minutes: null }
    : (v?.visits ?? []).filter((x) => x.done && x.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const summary = last ? `${fmt.relative(last.date, today)} · ${fmt.casesText(orders.paidCases(last))}` : t('kv.noOrders');
  return fold('calendar', 'blue', t('card.lastOrder'), summary, html`<dl class="kv">
    ${last
      ? html`<div><dt>${t('kv.lastOrder')}</dt><dd>${fmt.shortDate(last.date)} <span class="muted">· ${fmt.relative(last.date, today)}</span></dd></div>
        <details class="kv-expand"><summary><span class="kv-dt">${t('kv.cases')}</span><span class="kv-dd">${fmt.casesText(orders.paidCases(last))}${orders.freeCases(last) ? ` ${t('kv.plusFree', { n: orders.freeCases(last) })}` : ''}${icon('chevron', 'collapse-chev')}</span></summary>${tools.orderLinesHtml(last)}</details>
        <div><dt>${t('kv.value')}</dt><dd>${fmt.rupees(last.netValue)}</dd></div>`
      : ''}
    <div><dt>${t('kv.lastVisit')}</dt><dd>${lastVisit ? html`${fmt.shortDate(lastVisit.date)} <span class="muted">· ${fmt.relative(lastVisit.date, today)}</span>` : html`<span class="muted">${t('kv.noVisits')}</span>`}</dd></div>
    ${v?.nextVisitAfterToday ? html`<div><dt>${t('kv.nextVisit')}</dt><dd>${fmt.shortDate(v.nextVisitAfterToday)} <span class="muted">· ${fmt.relative(v.nextVisitAfterToday, today)}</span></dd></div>` : ''}
  </dl>`);
}

function paymentCard(o, today) {
  const c = o.credit ?? {};
  const overdue = c.overdue ?? 0;
  const room = Math.max(0, (c.limit ?? 0) - (c.outstanding ?? 0));
  const summary = overdue > 0 ? t('f.pay.due', { amt: fmt.rupees(overdue) }) : t('f.pay.room', { amt: fmt.rupees(room) });
  return fold('wallet', 'green', t('card.payment'), summary, html`<dl class="kv">
    <div><dt>${t('kv.creditLimit')}</dt><dd>${fmt.rupees(c.limit ?? 0)}</dd></div>
    <div><dt>${t('kv.outstanding')}</dt><dd>${fmt.rupees(c.outstanding ?? 0)}</dd></div>
    <div class="${overdue > 0 ? 'is-warn' : ''}"><dt>${t('kv.overdue')}</dt><dd>${overdue > 0 ? html`${icon('alert')}<span>${t('kv.overdueAmt', { amt: fmt.rupees(overdue) })}</span>` : fmt.rupees(0)}</dd></div>
    <div><dt>${t('kv.lastPayment')}</dt><dd>${c.lastPaymentDate ? html`${fmt.shortDate(c.lastPaymentDate)} <span class="muted">· ${fmt.relative(c.lastPaymentDate, today)}</span>` : html`<span class="muted">${t('kv.noneYet')}</span>`}</dd></div>
  </dl>`, { warn: overdue > 0 });
}

const ORDER = { enrolled: 0, applicable: 1, used: 2, not: 3 };

/** Schemes as illustrated cards: the art says what the scheme is about before the words do. */
function schemesCard(o, all, today) {
  const hasCooler = o.cooler?.type === 'bottler';
  const list = schemes.activeSchemes(today)
    .filter((s) => s.type !== 'program' || hasCooler)
    .map((s) => ({ s, st: schemes.statusFor(s, o, today, all) }))
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
  if (!all.length) return fold('history', 'purple', t('card.history'), t('history.empty'), emptyState({ icon: 'box', title: t('history.empty'), body: t('history.emptyBody'), compact: true }));
  const shown = Math.min(3, all.length);
  return fold('history', 'purple', t('card.history'), t('f.hist.sum', { n: all.length }), html`
    ${monthStrip(all, today)}
    <h3 class="sub-title">${t('history.last', { n: shown })}</h3>
    <ul class="mini-list">${all.slice(0, 3).map((x) => html`<li>
      <span>${fmt.shortDate(x.date)}${x.source === 'demo' ? html` ${pill(t('demo.tag'), 'thin')}` : ''}</span>
      <span>${fmt.casesText(orders.paidCases(x))}</span>
      <span class="num">${fmt.rupees(x.netValue)}</span>
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
  let summary;
  let body;
  let warn = false;
  if (c.type === 'bottler') {
    summary = t('cooler.company', { count: c.count, litres: c.litres });
    warn = Boolean(a && (!a.pure || a.tempC > 6)) || Boolean(c.afternoonOutage);
    body = html`<dl class="kv">
      ${a ? html`<div><dt>${t('cooler.lastAudit')}</dt><dd>${fmt.shortDate(a.date)} <span class="muted">· ${fmt.relative(a.date, today)}</span></dd></div>
        <div><dt>${t('cooler.onlyOurs')}</dt><dd>${a.pure ? t('cooler.yes') : html`<span class="text-warn">${icon('alert')}<span>${t('cooler.otherBrands')}</span></span>`}</dd></div>
        <div><dt>${t('cooler.fillTemp')}</dt><dd>${a.fillPct}% · ${a.tempC > 6 ? html`<span class="text-warn">${icon('alert')}<span>${t('cooler.warm', { t: a.tempC })}</span></span>` : `${a.tempC}°C`}</dd></div>`
      : html`<div><dt>${t('cooler.lastAudit')}</dt><dd class="muted">${t('cooler.noAudit')}</dd></div>`}
    </dl>
    ${c.afternoonOutage ? html`<p class="inline-note">${icon('alert')}<span>${t('cooler.outage')}</span></p>` : ''}`;
  } else {
    summary = { 'own-fridge': `${t('cooler.ownFridge')}${c.litres ? ` · ${c.litres} L` : ''}`, 'ice-box': t('cooler.iceBox'), none: t('cooler.none') }[c.type] ?? c.type;
    body = html`<dl class="kv"><div><dt>${t('cooler.label')}</dt><dd>${summary}</dd></div></dl>`;
  }
  if (o.empties?.cratesHeld != null) {
    body = html`${body}<dl class="kv"><div><dt>${t('cooler.crates')}</dt><dd>${fmt.num(o.empties.cratesHeld)}</dd></div></dl>`;
  }
  return html`<details class="card collapse">
    <summary class="collapse-head">
      <span class="card-title"><span class="fold-ico ic-teal">${icon('cooler')}</span><span>${t('card.cooler')}</span></span>
      <span class="collapse-sum ${warn ? 'text-warn' : ''}">${warn ? icon('alert') : ''}<span>${summary}</span></span>
      ${icon('chevron', 'collapse-chev')}
    </summary>
    <div class="collapse-body">${body}</div>
  </details>`;
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
