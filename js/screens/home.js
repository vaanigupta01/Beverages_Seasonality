// Landing: the rep's day at a glance. A branded header (greeting, clock in/out, rank, summer
// target), the alerts that need attention, today's progress, the next outlet and the route.
// The header extras and alerts are filled by feature/landing.js (slots landing-hero, landing-top).

import { session } from '../app.js';
import * as data from '../data.js';
import * as orders from '../orders.js';
import { cart } from '../cart.js';
import * as fmt from '../format.js';
import { t, label } from '../i18n.js';
import { html, mount, fresh, icon, langButton, pill, tierBadge, slot, emptyState } from '../ui.js';
import { quickActions } from '../feature/outlet-tools.js';
import { routeMap, wireMap } from '../feature/route-map.js';

export function render(root) {
  const view = fresh(root);
  const today = data.demoDate();
  const route = data.route();
  const rows = route.map((o) => ({ outlet: o, saved: orders.demoOrdersOn(o.id, today) }));
  const visited = rows.filter((r) => r.saved.length).length;
  const todays = orders.demoOrders().filter((o) => o.date === today);
  const bookedCases = todays.reduce((n, o) => n + orders.paidCases(o), 0);
  const bookedValue = todays.reduce((n, o) => n + o.netValue, 0);
  const done = route.length > 0 && visited === route.length;
  const firstName = session.name().split(' ')[0];

  mount(view, html`
    <header class="hero-top">
      <div class="hero-bar">
        <p class="hero-date">${icon('calendar')}<span>${fmt.date(today, { weekday: true, year: false })}</span></p>
        <div class="hero-bar-acts">
          <a class="hero-icon" href="#/outlets" aria-label="${t('home.allOutlets')}">${icon('store')}</a>
          ${langButton()}
        </div>
      </div>
      <h1 class="hero-hi">${t('home.hi', { name: firstName })}</h1>
      ${slot('landing-hero', { tag: 'div' })}
    </header>

    <div class="page page-home">
      ${slot('landing-top')}

      <section class="day card ${done ? 'is-done' : ''}" aria-label="${t('home.progress')}">
        <div class="day-head">
          <p class="day-title">${icon('route')}<span>${t('f.home.route', { n: route.length })}</span></p>
          <p class="day-count"><strong>${visited}</strong>/${route.length} ${t('f.home.done')}</p>
        </div>
        <div class="day-track" role="progressbar" aria-valuemin="0" aria-valuemax="${route.length}" aria-valuenow="${visited}">
          <span style="width:${route.length ? Math.round((visited / route.length) * 100) : 0}%"></span>
        </div>
        ${route.length ? routeMap(rows) : ''}
        <dl class="day-stats">
          <div><dt>${icon('note')}${t('home.orders')}</dt><dd>${fmt.num(todays.length)}</dd></div>
          <div><dt>${icon('box')}${t('home.cases')}</dt><dd>${fmt.num(bookedCases)}</dd></div>
          <div><dt>${icon('wallet')}${t('home.value')}</dt><dd>${fmt.rupees(bookedValue)}</dd></div>
        </dl>
      </section>

      ${slot('landing-next')}

      <h2 class="section-title">${t('f.home.stops')}</h2>
      ${route.length
        ? html`<ol class="list route-list">${rows.map(routeRow)}</ol>`
        : emptyState({ icon: 'route', title: t('home.noRoute'), body: t('home.noRouteBody') })}
    </div>`);
  wireMap(view);
}

function routeRow({ outlet, saved }) {
  const stop = data.visits(outlet.id)?.routeOrder;
  const inProgress = cart.outletId === outlet.id && !cart.isEmpty();
  let status = '';
  if (saved.length) {
    const cases = fmt.casesText(saved.reduce((n, o) => n + orders.paidCases(o), 0));
    status = pill(t('f.home.ordered', { cases }), 'ok', 'check');
  } else if (inProgress) {
    status = pill(t('status.inProgress', { cases: fmt.casesText(cart.totalCases()) }), 'caution', 'note');
  }

  return html`<li class="row-wrap">
    <a class="row route-row ${saved.length ? 'is-done' : ''}" href="#/outlet/${outlet.id}">
      <span class="route-stop" aria-hidden="true">${saved.length ? icon('check') : stop}</span>
      <span class="row-main">
        <span class="row-title">${outlet.name}</span>
        <span class="row-meta">${label('area', outlet.area)} · ${label('ch', outlet.channel)}</span>
        <span class="row-tags">${tierBadge(outlet)}${status}
          ${slot('route-badge', { tag: 'span', attrs: { 'data-outlet-id': outlet.id } })}</span>
      </span>
    </a>
    ${quickActions(outlet)}
  </li>`;
}
