// Landing page: the rep's day — who (the signed-in name), when, today's route and progress.

import { session } from '../app.js';
import * as data from '../data.js';
import * as orders from '../orders.js';
import { cart } from '../cart.js';
import * as fmt from '../format.js';
import { t, label } from '../i18n.js';
import { html, mount, fresh, icon, appBar, pill, tierBadge, slot, emptyState } from '../ui.js';

export function render(root) {
  const view = fresh(root);
  const cfg = data.config();
  const today = data.demoDate();
  const route = data.route();
  const rows = route.map((o) => ({ outlet: o, saved: orders.demoOrdersOn(o.id, today) }));
  const visited = rows.filter((r) => r.saved.length).length;
  const todays = orders.demoOrders().filter((o) => o.date === today);
  const bookedCases = todays.reduce((n, o) => n + orders.paidCases(o), 0);
  const bookedValue = todays.reduce((n, o) => n + o.netValue, 0);
  const done = route.length > 0 && visited === route.length;
  const name = session.name();
  const firstName = name.split(' ')[0];
  const region = label('region', cfg.region.name);
  const shownOf = cfg.rep?.routeOutletsToday > route.length ? cfg.rep.routeOutletsToday : null;

  mount(view, html`
    ${appBar({
      title: t('home.title'),
      action: html`<a class="app-bar-action" href="#/outlets">${icon('store')}<span>${t('home.allOutlets')}</span></a>`,
    })}
    <div class="page">
      <header class="hero">
        <p class="eyebrow">${fmt.date(today, { long: true })}</p>
        <p class="display hero-title">${t('home.hi', { name: firstName })}</p>
        <p class="hero-sub">${[name, label('repRole', cfg.rep?.role), cfg.distributor?.name].filter(Boolean).join(' · ')}</p>
        ${slot('landing-clock', { tag: 'div' })}
      </header>

      <section class="card progress ${done ? 'is-done' : ''}" aria-label="${t('home.progress')}">
        <div class="progress-head">
          <p class="progress-title"><strong>${t('home.today', { outlets: t('n.outlet', { n: route.length }) })}</strong> · ${t('home.visited', { n: visited })}</p>
          ${done ? pill(t('home.routeDone'), 'ok', 'check') : ''}
        </div>
        <div class="progress-track" role="progressbar" aria-label="${t('home.progress')}" aria-valuemin="0" aria-valuemax="${route.length}" aria-valuenow="${visited}">
          ${rows.map((r) => html`<span class="progress-seg ${r.saved.length ? 'is-on' : ''}"></span>`)}
        </div>
        <dl class="stats">
          <div><dt>${t('home.orders')}</dt><dd>${fmt.num(todays.length)}</dd></div>
          <div><dt>${t('home.cases')}</dt><dd>${fmt.num(bookedCases)}</dd></div>
          <div><dt>${t('home.value')}</dt><dd>${fmt.rupees(bookedValue)}</dd></div>
        </dl>
        ${shownOf ? html`<p class="fine">${t('home.shownOf', { shown: route.length, total: shownOf })}</p>` : ''}
      </section>

      ${slot('landing-top')}

      <h2 class="section-title">${icon('route')}<span>${t('home.route', { region })}</span></h2>
      ${route.length
        ? html`<ol class="list route-list">${rows.map(routeRow)}</ol>`
        : emptyState({ icon: 'route', title: t('home.noRoute'), body: t('home.noRouteBody') })}

      <a class="btn btn-secondary page-end" href="#/outlets">${icon('store')}<span>${t('home.seeAll')}</span></a>
    </div>`);
}

function routeRow({ outlet, saved }) {
  const stop = data.visits(outlet.id)?.routeOrder;
  const inProgress = cart.outletId === outlet.id && !cart.isEmpty();
  let status;
  if (saved.length) {
    const cases = fmt.casesText(saved.reduce((n, o) => n + orders.paidCases(o), 0));
    const value = fmt.rupees(saved.reduce((n, o) => n + o.netValue, 0));
    status = pill(saved.length > 1 ? t('status.savedN', { n: saved.length, cases, value }) : t('status.saved', { cases, value }), 'ok', 'check');
  } else if (inProgress) {
    status = pill(t('status.inProgress', { cases: fmt.casesText(cart.totalCases()) }), 'caution', 'note');
  } else {
    status = pill(t('status.toVisit'), 'neutral');
  }

  return html`<li>
    <a class="row route-row ${saved.length ? 'is-done' : ''}" href="#/outlet/${outlet.id}">
      <span class="route-stop" aria-hidden="true">${saved.length ? icon('check') : stop}</span>
      <span class="row-main">
        <span class="row-title">${outlet.name}</span>
        <span class="row-meta">${label('area', outlet.area)} · ${label('ch', outlet.channel)}</span>
        <span class="row-tags">${tierBadge(outlet)}${status}</span>
        ${slot('route-badge', { tag: 'div', attrs: { 'data-outlet-id': outlet.id } })}
      </span>
      ${icon('chevron', 'row-chev')}
    </a>
  </li>`;
}
