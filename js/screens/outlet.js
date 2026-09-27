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

/**
 * Google Maps directions to the outlet (two-wheeler, as reps ride motorbikes). Uses exact
 * coordinates when the data has outlets[].geo { lat, lng }; otherwise the address.
 */
export function directionsUrl(o) {
  const region = data.config().region ?? {};
  const address = o.area && !String(o.address ?? '').includes(o.area) ? `${o.address}, ${o.area}` : o.address;
  const destination = o.geo?.lat != null && o.geo?.lng != null
    ? `${o.geo.lat},${o.geo.lng}`
    : [address, region.city, region.state].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=two-wheeler`;
}

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
    ${appBar({ title: t('outlet.title'), back: nav.hub, heading: false })}
    <div class="page">
      <header class="outlet-head">
        ${personaTag(o)}
        <div class="outlet-title"><h1 class="display outlet-name">${o.name}</h1><span data-part="issues">${tools.issuesBadge(o)}</span></div>
        <p class="outlet-addr">${address}${o.locationContext ? html` <span class="muted">· ${o.locationContext}</span>` : ''}</p>
        <div class="row-tags">
          ${tierBadge(o, { visits: true })}
          ${pill(typeLabel, 'neutral')}
          ${v?.todayOnRoute ? pill(t('outlet.stop', { n: v.routeOrder }), 'info', 'route') : pill(t('outlets.notOnRoute'), 'neutral')}
          ${tools.territoryPill(o)}
        </div>
        ${o.owner?.name ? html`<p class="outlet-owner">${o.owner.role ? label('role', o.owner.role) : t('outlet.owner')}: ${o.owner.name}</p>` : ''}
        ${tools.actionsRow(o, directionsUrl(o))}
      </header>

      ${slot('outlet-season')}
      ${slot('outlet-brief')}

      ${savedToday.length ? html`<section class="callout callout-ok">
        ${icon('check')}
        <div>
          <p class="callout-title">${savedToday.length > 1 ? t('outlet.savedTodayN', { n: savedToday.length }) : t('outlet.savedToday')}</p>
          ${savedToday.map((s) => html`<p>${fmt.casesText(orders.paidCases(s))}${orders.freeCases(s) ? ` ${t('kv.plusFree', { n: orders.freeCases(s) })}` : ''} · ${fmt.rupees(s.netValue)} <span class="mono muted">${s.id}</span></p>`)}
        </div>
      </section>` : ''}

      ${closures.map((c) => html`<section class="callout callout-caution">
        ${icon('calendarX')}
        <div>
          <p class="callout-title">${t('outlet.closed', { range: fmt.dateRange(c.from, c.to, today) })} · ${c.from > today ? t('outlet.closedStarts', { rel: fmt.relative(c.from, today) }) : t('outlet.closedNow')}</p>
          <p>${c.reason}</p>
        </div>
      </section>`)}

      ${lastOrderCard(all, v, today, savedToday.length > 0)}
      ${tools.stockOnHandCard(o)}
      ${paymentCard(o, today)}
      ${schemesCard(o, all, today)}
      ${historyCard(all, today)}
      ${coolerCard(o, today)}
      ${bookingsCard(o, today)}
      <div data-part="notes">${notesCard(o, v, today)}</div>
    </div>
    <div class="bottom-bar">
      <a class="btn btn-primary btn-block" href="#/book/${o.id}">${bookLabel}</a>
    </div>`);

  // Notes and issues redraw in place, so the rep keeps their scroll position.
  tools.wire(view, o, (part) => {
    const el = view.querySelector(`[data-part="${part}"]`);
    if (el) mount(el, part === 'notes' ? notesCard(o, v, today) : tools.issuesBadge(o));
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

const card = (iconName, title, body, cls = '') =>
  html`<section class="card ${cls}"><h2 class="card-title">${icon(iconName)}<span>${title}</span></h2>${body}</section>`;

function lastOrderCard(all, v, today, visitedToday) {
  const last = all[0];
  // A demo order today counts as today's visit (visits.json only holds past visits).
  const lastVisit = visitedToday
    ? { date: today, minutes: null }
    : (v?.visits ?? []).filter((x) => x.done && x.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return card('calendar', t('card.lastOrder'), html`<dl class="kv">
    ${last
      ? html`<div><dt>${t('kv.lastOrder')}</dt><dd>${fmt.shortDate(last.date)} <span class="muted">· ${fmt.relative(last.date, today)}</span></dd></div>
        <details class="kv-expand"><summary><span class="kv-dt">${t('kv.cases')}</span><span class="kv-dd">${fmt.casesText(orders.paidCases(last))}${orders.freeCases(last) ? ` ${t('kv.plusFree', { n: orders.freeCases(last) })}` : ''}${icon('chevron', 'collapse-chev')}</span></summary>${tools.orderLinesHtml(last)}</details>
        <div><dt>${t('kv.value')}</dt><dd>${fmt.rupees(last.netValue)}</dd></div>`
      : html`<div><dt>${t('kv.lastOrder')}</dt><dd class="muted">${t('kv.noOrders')}</dd></div>`}
    <div><dt>${t('kv.lastVisit')}</dt><dd>${lastVisit ? html`${fmt.shortDate(lastVisit.date)} <span class="muted">· ${fmt.relative(lastVisit.date, today)}${lastVisit.minutes ? ` · ${t('kv.minutes', { n: lastVisit.minutes })}` : ''}</span>` : html`<span class="muted">${t('kv.noVisits')}</span>`}</dd></div>
    ${v?.nextVisitAfterToday ? html`<div><dt>${t('kv.nextVisit')}</dt><dd>${fmt.shortDate(v.nextVisitAfterToday)} <span class="muted">· ${fmt.relative(v.nextVisitAfterToday, today)}</span></dd></div>` : ''}
  </dl>`);
}

function paymentCard(o, today) {
  const c = o.credit ?? {};
  const overdue = c.overdue ?? 0;
  return card('wallet', t('card.payment'), html`<dl class="kv">
    <div><dt>${t('kv.creditLimit')}</dt><dd>${fmt.rupees(c.limit ?? 0)}</dd></div>
    <div><dt>${t('kv.outstanding')}</dt><dd>${fmt.rupees(c.outstanding ?? 0)}</dd></div>
    <div class="${overdue > 0 ? 'is-warn' : ''}"><dt>${t('kv.overdue')}</dt><dd>${overdue > 0 ? html`${icon('alert')}<span>${t('kv.overdueAmt', { amt: fmt.rupees(overdue) })}</span>` : fmt.rupees(0)}</dd></div>
    <div><dt>${t('kv.lastPayment')}</dt><dd>${c.lastPaymentDate ? html`${fmt.shortDate(c.lastPaymentDate)} <span class="muted">· ${fmt.relative(c.lastPaymentDate, today)}</span>` : html`<span class="muted">${t('kv.noneYet')}</span>`}</dd></div>
  </dl>`);
}

const ORDER = { enrolled: 0, applicable: 1, used: 2, not: 3 };

function schemesCard(o, all, today) {
  const hasCooler = o.cooler?.type === 'bottler';
  const list = schemes.activeSchemes(today)
    .filter((s) => s.type !== 'program' || hasCooler)
    .map((s) => ({ s, st: schemes.statusFor(s, o, today, all) }))
    .sort((a, b) => ORDER[a.st.kind] - ORDER[b.st.kind]);
  if (!list.length) return card('tag', t('card.schemes'), emptyState({ icon: 'tag', title: t('scheme.none'), compact: true }));

  const month = fmt.monthName(today, true);
  return card('tag', t('card.schemes'), html`<ul class="scheme-list">${list.map(({ s, st }) => html`<li>
      <a class="scheme-row st-${st.kind}" href="#/scheme/${s.id}/${o.id}">
        <span class="scheme-row-main">
          <span class="scheme-head">
            <span class="scheme-name">${s.name}</span>
            ${schemePill(st)}
          </span>
          <span class="scheme-offer">${schemes.offerText(s)}</span>
          <span class="scheme-meta">${s.validTo ? t('common.till', { date: fmt.shortDate(s.validTo) }) : t('common.ongoing')}${st.cap && st.kind !== 'not' ? html` · <span class="${st.used >= st.cap ? 'text-warn' : ''}">${t('scheme.usesTaken', { used: st.used, cap: st.cap, month })}</span>` : ''}</span>
        </span>
        ${icon('chevron', 'row-chev')}
      </a>
    </li>`)}</ul>
    <p class="fine scheme-legend">${t('scheme.legend')}</p>`);
}

function historyCard(all, today) {
  if (!all.length) {
    return card('history', t('card.history'), emptyState({ icon: 'box', title: t('history.empty'), body: t('history.emptyBody'), compact: true }));
  }
  const oldest = all.at(-1);
  const shown = Math.min(3, all.length);
  return card('history', t('card.history'), html`
    ${monthStrip(all, today)}
    <h3 class="sub-title">${t('history.last', { n: shown })}</h3>
    <ul class="mini-list">${all.slice(0, 3).map((x) => html`<li>
      <span>${fmt.shortDate(x.date)}${x.source === 'demo' ? html` ${pill(t('demo.tag'), 'thin')}` : ''}</span>
      <span>${fmt.casesText(orders.paidCases(x))}</span>
      <span class="num">${fmt.rupees(x.netValue)}</span>
    </li>`)}</ul>
    <p class="fine">${t('history.since', { orders: t('n.order', { n: all.length }), date: fmt.date(oldest.date, { weekday: false }) })}</p>`);
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
      <span class="card-title">${icon('cooler')}<span>${t('card.cooler')}</span></span>
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
  return card('calendar', t('card.bookings'), html`
    <ul class="mini-list">${upcoming.slice(0, 3).map((b) => html`<li>
      <span>${fmt.shortDate(b.date)}</span>
      <span>${b.event}</span>
      <span class="num">${b.expectedCases != null ? `~${fmt.casesText(b.expectedCases)}` : ''}</span>
    </li>`)}</ul>
    <p class="fine">${upcoming.length > 3 ? `${t('bookings.next', { n: upcoming.length, date: fmt.shortDate(upcoming.at(-1).date), cases: fmt.casesText(total) })} ` : ''}${t('bookings.note')}</p>`);
}

function notesCard(o, v, today) {
  const notes = tools.notesList(o, v, today);
  return html`<section class="card"><div class="card-head"><h2 class="card-title">${icon('note')}<span>${t('card.notes')}</span></h2>
    <button type="button" class="btn btn-ghost btn-compact" data-tool="note">${icon('plus')}<span>${t('f.tools.addNote')}</span></button></div>
    ${notes.length ? tools.notesHtml(notes) : emptyState({ icon: 'note', title: t('notes.empty'), compact: true })}</section>`;
}
