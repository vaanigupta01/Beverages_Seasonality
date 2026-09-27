// Order review: lines, totals and the scheme estimate; edit or submit.
//
// Schemes are informational (fa-data schemes.json → assumption): thresholds and benefits are
// settled later by the distributor, never applied at booking. So the order is booked and
// submitted at its full value, and scheme benefits are shown as an estimate beside it.

import { app, router } from '../app.js';
import * as data from '../data.js';
import * as orders from '../orders.js';
import * as schemes from '../schemes.js';
import { cart } from '../cart.js';
import * as fmt from '../format.js';
import { t, label } from '../i18n.js';
import { html, mount, fresh, icon, appBar, pill, tierBadge, slot, emptyState, toast } from '../ui.js';

export function render(root, { id }) {
  const o = data.outlet(id);
  let unsubscribe = null;

  const draw = () => {
    const view = fresh(root);
    if (!o) {
      mount(view, html`${appBar({ title: t('review.title'), back: '#/outlets' })}
        <div class="page">${emptyState({ icon: 'store', title: t('outlet.notFound'), body: t('outlet.notFoundBody', { id: id ?? '' }), action: html`<a class="btn btn-primary" href="#/outlets">${t('outlet.openList')}</a>` })}</div>`);
      return;
    }
    if (cart.outletId !== o.id || cart.isEmpty()) {
      mount(view, html`${appBar({ title: t('review.title'), sub: o.name, back: `#/outlet/${o.id}` })}
        <div class="page">${emptyState({ icon: 'box', title: t('review.nothing'), body: t('review.nothingBody', { name: o.name }), action: html`<a class="btn btn-primary" href="#/book/${o.id}">${t('review.goBook')}</a>` })}</div>`);
      return;
    }
    drawReview(view, o);
  };

  function drawReview(view, o) {
    const today = data.demoDate();
    const cfg = data.config();
    const pastAndDemo = orders.allOrdersFor(o.id);
    const p = schemes.price(cart.lines(), o, today, pastAndDemo);
    const delivery = fmt.addDays(today, cfg.distributor?.deliveryLeadDays ?? 1);
    const notes = schemeNotes(p);

    mount(view, html`
      ${appBar({ title: t('review.title'), sub: o.name, back: `#/book/${o.id}` })}
      <div class="page">
        <section class="card review-head">
          <p class="review-outlet">${o.name}</p>
          <p class="muted">${label('area', o.area)} · ${label('ch', o.channel)}</p>
          <div class="row-tags">${tierBadge(o)}${pill(t('review.delivery', { date: fmt.shortDate(delivery), rel: fmt.relative(delivery, today) }), 'info', 'truck')}</div>
        </section>

        <section class="card">
          <h2 class="card-title">${icon('box')}<span>${t('n.line', { n: p.lines.filter((l) => l.cases).length })}</span></h2>
          <ul class="lines">${p.lines.map((l) => html`<li class="line">
            ${l.cases ? html`<div class="line-main">
              <p class="line-name">${l.product.name}</p>
              <p class="line-qty">${t('review.qtyRate', { qty: fmt.unitsText(l.cases, l.product.caseLabel), rate: fmt.rupees(l.rate) })}</p>
            </div>
            <p class="line-value num">${fmt.rupees(l.gross)}</p>` : ''}
            ${l.freeCases ? html`<p class="line-free">${icon('check')}<span>${t('review.free', { n: l.freeCases, name: l.product.name })}</span></p>` : ''}
          </li>`)}</ul>
          <a class="btn btn-ghost btn-block" href="#/book/${o.id}">${t('review.edit')}</a>
        </section>

        ${notes.length ? html`<section class="card">
          <h2 class="card-title">${icon('tag')}<span>${t('review.schemes')}</span></h2>
          <ul class="scheme-notes">${notes}</ul>
        </section>` : ''}

        <section class="card">
          <h2 class="card-title">${icon('wallet')}<span>${t('review.totals')}</span></h2>
          <dl class="kv totals">
            <div class="kv-total"><dt>${t('review.booked')}</dt><dd>${fmt.rupees(p.gross)}</dd></div>
            <div><dt>${t('review.totalCases')}</dt><dd>${fmt.num(p.paidCases)}</dd></div>
          </dl>
          ${p.discount || p.freeCases ? html`<div class="est-box">
            <p class="est-title">${icon('tag')}<span>${t('review.estTitle')}</span></p>
            <dl class="kv">
              ${p.freeCases ? html`<div><dt>${t('review.estFree')}</dt><dd>${t('n.freeCase', { n: p.freeCases })}</dd></div>` : ''}
              ${p.discount ? html`<div><dt>${t('review.estOff')}</dt><dd>${fmt.rupees(p.discount)}</dd></div>` : ''}
            </dl>
            <p class="fine">${t('review.estNote')}</p>
          </div>` : ''}
        </section>

        ${slot('review-check')}
      </div>
      <div class="bottom-bar bottom-bar-split">
        <a class="btn btn-secondary" href="#/book/${o.id}">${t('review.editShort')}</a>
        <button type="button" class="btn btn-primary" data-submit>${t('review.submit', { net: fmt.rupees(p.gross) })}</button>
      </div>`);

    let busy = false;
    view.querySelector('[data-submit]').addEventListener('click', (e) => {
      if (busy) return;          // a double tap saves once
      busy = true;
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = t('review.saving');
      unsubscribe?.();
      unsubscribe = null;
      const final = schemes.price(cart.lines(), o, today, orders.allOrdersFor(o.id));
      const saved = orders.saveOrder({
        outletId: o.id,
        lines: final.lines.map((l) => ({ sku: l.sku, cases: l.cases, freeCases: l.freeCases })),
        grossValue: final.gross,
        discountValue: 0,
        netValue: final.gross,          // booked value; schemes are settled later
        schemeIds: final.schemeIds,
        schemeEstimate: { discount: final.discount, freeCases: final.freeCases, settledBy: 'distributor' },
      });
      cart.clear();
      toast(t('review.toast', { name: o.name }));
      router.go(`#/saved/${saved.id}`, { replace: true });
    });
  }

  draw();
  // If anything (e.g. the feature) edits the cart while review is open, redraw and let slots refill.
  unsubscribe = cart.subscribe(() => {
    draw();
    app.emit('screen:rendered', { screen: 'review', outletId: id, root });
  });
  return () => unsubscribe?.();
}

/** Plain lines about each scheme that touches the cart. No "add N more" nudges here. */
function schemeNotes(p) {
  return p.schemes.map((x) => {
    const s = x.scheme;
    if (!x.eligible) {
      if (s.type === 'first-order') return '';
      return html`<li class="scheme-note is-off">${icon('info')}<span>${t('rn.off', { name: s.name, reason: x.reason })}</span></li>`;
    }
    if (x.kind === 'free') {
      if (x.granted > 0) {
        const sku = data.product(x.freeSku)?.name ?? x.freeSku;
        const text = t('rn.free', { name: s.name, free: t('n.freeCase', { n: x.granted }), sku })
          + (x.cap ? t('rn.cap', { used: x.usedAfter, cap: x.cap }) : '') + (x.capHit ? t('rn.capReached') : '');
        return html`<li class="scheme-note is-on">${icon('check')}<span>${text}</span></li>`;
      }
      if (x.cap && x.usedBefore >= x.cap) {
        return html`<li class="scheme-note is-warn">${icon('alert')}<span>${t('rn.capFull', { name: s.name, used: x.usedBefore, cap: x.cap })}</span></li>`;
      }
      return '';
    }
    if (x.amount > 0) {
      const key = s.type === 'first-order' ? 'rn.pctFirst' : 'rn.pct';
      return html`<li class="scheme-note is-on">${icon('check')}<span>${t(key, { name: s.name, pct: s.rule.percent, amt: fmt.rupees(-x.amount) })}</span></li>`;
    }
    return '';
  }).filter(Boolean);
}
