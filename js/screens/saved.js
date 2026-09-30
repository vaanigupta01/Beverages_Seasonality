// After submit: the saved order, then back to the route or the outlet list.

import * as data from '../data.js';
import * as orders from '../orders.js';
import * as fmt from '../format.js';
import { t } from '../i18n.js';
import { html, mount, fresh, icon, appBar, emptyState, slot } from '../ui.js';

export function render(root, { id }) {
  const view = fresh(root);
  const order = orders.orderById(id);

  if (!order) {
    mount(view, html`${appBar({ title: t('saved.order') })}
      <div class="page">${emptyState({
        icon: 'box',
        title: t('saved.gone'),
        body: t('saved.goneBody'),
        action: html`<a class="btn btn-primary" href="#/home">${t('saved.backRoute')}</a>`,
      })}</div>`);
    return;
  }

  const o = data.outlet(order.outletId);
  const today = data.demoDate();
  const delivery = fmt.addDays(order.date, data.config().distributor?.deliveryLeadDays ?? 1);
  const paid = orders.paidCases(order);
  const free = orders.freeCases(order);

  mount(view, html`
    ${appBar({ title: t('saved.title'), heading: false })}
    <div class="page saved">
      <div class="saved-hero">
        <span class="saved-icon">${icon('check')}</span>
        <h1 class="display">${t('saved.title')}</h1>
        <p class="saved-outlet">${o?.name ?? order.outletId}</p>
      </div>
      ${slot('saved-outlook')}
      <details class="card collapse fold">
        <summary class="collapse-head"><span class="card-title"><span class="fold-ico ic-green">${icon('note')}</span><span>${t('f.saved.order', { cases: fmt.casesText(paid), value: fmt.rupees(order.netValue) })}</span></span>${icon('chevron', 'collapse-chev')}</summary>
        <div class="collapse-body"><dl class="kv receipt">
          <div class="rc-id"><dt>${t('saved.order')}</dt><dd>${order.id}</dd></div>
          <div><dt>${t('saved.cases')}</dt><dd>${fmt.casesText(paid)}${free ? ` ${t('kv.plusFree', { n: free })}` : ''}</dd></div>
          <div><dt>${t('saved.lines')}</dt><dd>${fmt.num(order.lines.filter((l) => l.cases).length)}</dd></div>
          <div class="kv-total"><dt>${t('review.booked')}</dt><dd>${fmt.rupees(order.netValue)}</dd></div>
          ${order.schemeEstimate?.discount ? html`<div class="rc-save"><dt>${t('review.estOff')}</dt><dd>− ${fmt.rupees(order.schemeEstimate.discount)}</dd></div>` : ''}
          <div class="rc-deliv"><dt>${icon('truck')}${t('saved.delivery')}</dt><dd>${fmt.shortDate(delivery)} · ${fmt.relative(delivery, today)}</dd></div>
        </dl></div>
      </details>
      <div class="stack">
        <a class="btn btn-primary btn-block" href="#/home">${icon('route')}<span>${t('saved.backRoute')}</span></a>
        <a class="btn btn-secondary btn-block" href="#/outlets">${icon('store')}<span>${t('saved.list')}</span></a>
        ${o ? html`<a class="btn btn-ghost btn-block" href="#/outlet/${o.id}">${t('saved.view', { name: o.name })}</a>` : ''}
      </div>
    </div>`);
}
