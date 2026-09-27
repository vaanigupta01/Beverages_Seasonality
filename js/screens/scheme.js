// Scheme details: #/scheme/SCH-SS26/OUT-01 (the outlet part is optional).
// What the offer is, who can get it, dates, limits, how it's paid, the products it covers,
// and — for an outlet — its status there, uses this month and the orders that used it.

import { nav } from '../app.js';
import * as data from '../data.js';
import * as orders from '../orders.js';
import * as schemes from '../schemes.js';
import * as fmt from '../format.js';
import { t, label, lang } from '../i18n.js';
import { html, mount, fresh, icon, appBar, emptyState } from '../ui.js';

export function render(root, { id, sub }) {
  const view = fresh(root);
  const s = data.schemes().find((x) => x.id === id);
  const o = sub ? data.outlet(sub) : null;
  const back = o ? `#/outlet/${o.id}` : nav.hub;

  if (!s) {
    mount(view, html`${appBar({ title: t('sd.title'), back })}
      <div class="page">${emptyState({ icon: 'tag', title: t('sd.notFound'), body: t('sd.notFoundBody', { id: id ?? '' }), action: html`<a class="btn btn-primary" href="${back}">${t('common.back')}</a>` })}</div>`);
    return;
  }

  const today = data.demoDate();
  const all = o ? orders.allOrdersFor(o.id) : [];
  const st = o ? schemes.statusFor(s, o, today, all) : null;
  const r = s.rule ?? {};
  const month = fmt.monthName(today, true);

  mount(view, html`
    ${appBar({ title: s.name, sub: o?.name ?? t('sd.title'), back })}
    <div class="page">
      <section class="sd-hero ${st ? `st-${st.kind}` : ''}">
        <p class="eyebrow">${t(`sd.type.${s.type}`)}</p>
        <h1 class="display sd-name">${s.name}</h1>
        ${s.type !== 'program' ? html`<p class="sd-chip">${icon('tag')}<span>${schemes.chipText(s)}</span></p>` : ''}
        ${st ? statusBanner(st, o, s, today, month) : ''}
      </section>

      <section class="card">
        <h2 class="card-title">${icon('tag')}<span>${t('sd.offer')}</span></h2>
        <p class="sd-offer">${schemes.offerText(s)}</p>
      </section>

      <section class="card">
        <h2 class="card-title">${icon('info')}<span>${t('sd.details')}</span></h2>
        <dl class="kv sd-kv">
          <div><dt>${t('sd.type')}</dt><dd>${t(`sd.type.${s.type}`)}</dd></div>
          <div><dt>${t('sd.valid')}</dt><dd>${s.validFrom && s.validTo
            ? html`${fmt.dateRange(s.validFrom, s.validTo, today)} <span class="muted">· ${t('sd.daysLeft', { n: Math.max(0, fmt.daysBetween(today, s.validTo)) })}</span>`
            : t('common.ongoing')}</dd></div>
          <div><dt>${t('sd.who')}</dt><dd>${whoCanGet(s)}</dd></div>
          ${s.capUsesPerMonth ? html`<div><dt>${t('sd.limit')}</dt><dd>${t('sd.limitVal', { cap: s.capUsesPerMonth })}</dd></div>` : ''}
          ${o && st?.cap ? html`<div class="${st.used >= st.cap ? 'is-warn' : ''}"><dt>${t('sd.used', { month })}</dt><dd>${t('sd.usedVal', { used: st.used, cap: st.cap })}</dd></div>` : ''}
          ${s.type === 'free-goods' ? html`<div><dt>${t('sd.freeAs')}</dt><dd>${freeAs(r)}</dd></div>` : ''}
          <div><dt>${t('sd.paid')}</dt><dd>${lang() === 'en' && s.payout && s.type !== 'program' ? s.payout : t(`sd.pay.${s.type}`)}</dd></div>
          ${s.extras ? html`<div><dt>${t('sd.also')}</dt><dd>${schemes.extrasText(s)}</dd></div>` : ''}
        </dl>
      </section>

      ${Array.isArray(s.skus) ? productsCard(s) : ''}
      ${o && s.type === 'program' && o.cooler?.type === 'bottler' ? auditCard(o, today) : ''}
      ${o ? historyCard(s, all) : ''}
    </div>
    ${o ? html`<div class="bottom-bar">${st.kind === 'applicable' && s.type !== 'program'
      ? html`<a class="btn btn-primary btn-block" href="#/book/${o.id}">${t('sd.book')}</a>`
      : html`<a class="btn btn-secondary btn-block" href="#/outlet/${o.id}">${t('sd.backOutlet')}</a>`}</div>` : ''}`);
}

function statusBanner(st, o, s, today, month) {
  const nextMonth = `${fmt.addMonths(fmt.monthKey(today), 1)}-01`;
  const text = {
    applicable: [t('sd.st.applicable', { outlet: o.name }), t('sd.st.applicableBody'), 'tag'],
    enrolled: [t('sd.st.enrolled', { outlet: o.name }), t('sd.st.enrolledBody'), 'check'],
    used: [t('sd.st.used', { outlet: o.name, month }), t('sd.st.usedBody', { cap: st.cap, date: fmt.shortDate(nextMonth) }), 'alert'],
    not: [t('sd.st.not', { outlet: o.name }), st.reason, 'info'],
  }[st.kind];
  return html`<div class="sd-status sd-status-${st.kind}">
    <span class="sd-status-icon">${icon(text[2])}</span>
    <div>
      <p class="sd-status-title">${text[0]}</p>
      <p class="sd-status-body">${text[1]}</p>
    </div>
  </div>`;
}

function whoCanGet(s) {
  const parts = [];
  if (s.type === 'first-order') parts.push(t('sd.firstDays', { days: s.rule?.withinDaysOfRegistration ?? 90 }));
  else if (Array.isArray(s.eligibleTiers)) parts.push(t('sd.tiers', { tiers: s.eligibleTiers.map((x) => label('tier', x)).join(', ') }));
  if (s.requiresBottlerCooler) parts.push(t('sd.coolerOnly'));
  return parts.length ? parts.join(' · ') : t('sd.allOutlets');
}

function freeAs(r) {
  if (r.freeSku === 'same' || !r.pooled) return t('sd.freeSame');
  if (r.freeSku === 'largest-line' || !r.freeSku) return t('sd.freeLargest');
  return data.product(r.freeSku)?.name ?? r.freeSku;
}

function productsCard(s) {
  const list = s.skus.map((sku) => data.product(sku)).filter(Boolean);
  if (!list.length) return '';
  return html`<section class="card">
    <h2 class="card-title">${icon('box')}<span>${t('sd.products')}</span></h2>
    <ul class="mini-list sd-products">${list.map((p) => html`<li>
      <span>${p.name}</span>
      <span class="num">${t('book.rate', { rate: fmt.rupees(p.ptrPerCase), unit: t(p.caseLabel === 'crate' ? 'unit.crate' : 'unit.case') })}</span>
    </li>`)}</ul>
  </section>`;
}

function auditCard(o, today) {
  const a = o.cooler.lastAudit;
  return html`<section class="card">
    <h2 class="card-title">${icon('cooler')}<span>${t('sd.audit')}</span></h2>
    ${a ? html`<dl class="kv">
      <div><dt>${t('cooler.lastAudit')}</dt><dd>${fmt.shortDate(a.date)} <span class="muted">· ${fmt.relative(a.date, today)}</span></dd></div>
      <div class="${a.pure ? '' : 'is-warn'}"><dt>${t('cooler.onlyOurs')}</dt><dd>${a.pure ? t('cooler.yes') : t('cooler.otherBrands')}</dd></div>
      <div><dt>${t('cooler.fillTemp')}</dt><dd>${a.fillPct}% · ${a.tempC}°C</dd></div>
    </dl>` : html`<p class="muted">${t('cooler.noAudit')}</p>`}
  </section>`;
}

function historyCard(s, all) {
  const used = all.filter((x) => Array.isArray(x.schemeIds) && x.schemeIds.includes(s.id)).slice(0, 5);
  return html`<section class="card">
    <h2 class="card-title">${icon('history')}<span>${t('sd.history')}</span></h2>
    ${used.length ? html`<ul class="mini-list">${used.map((x) => {
      const free = x.lines.filter((l) => schemes.coversSku(s, l.sku)).reduce((n, l) => n + (l.freeCases || 0), 0);
      return html`<li>
        <span>${fmt.shortDate(x.date)}</span>
        <span>${fmt.casesText(orders.paidCases(x))}</span>
        <span class="num">${s.type === 'free-goods' ? `+${t('n.freeCase', { n: free })}` : t('sd.historyApplied')}</span>
      </li>`;
    })}</ul>` : html`<p class="muted">${t('sd.historyEmpty')}</p>`}
  </section>`;
}
