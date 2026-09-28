// Scheme details: #/scheme/SCH-SS26/OUT-01 (the outlet part is optional).
// What the offer is, who can get it, dates, limits, how it's paid, the products it covers,
// and — for an outlet — its status there, uses this month and the orders that used it.

import { nav } from '../app.js';
import * as data from '../data.js';
import * as orders from '../orders.js';
import * as schemes from '../schemes.js';
import * as fmt from '../format.js';
import { t, label, lang } from '../i18n.js';
import { schemeArt } from '../feature/scheme-art.js';
import { html, mount, fresh, icon, appBar, emptyState, tiles } from '../ui.js';

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
      <section class="sd-art" style="${schemeArt(s)}">
        <p class="sd-type">${t(`sd.type.${s.type}`)}</p>
        <h1 class="sd-art-name">${s.name}</h1>
        <p class="sd-art-offer">${s.type === 'program' ? t('f.sch.program', { amt: schemes.payoutAmount(s) }) : schemes.chipText(s)}</p>
      </section>
      ${st ? html`<div class="sd-status-wrap">${statusBanner(st, o, s, today, month)}</div>` : ''}

      <details class="card collapse fold" open>
        <summary class="collapse-head"><span class="card-title"><span class="fold-ico ic-amber">${icon('chat')}</span><span>${t('sd.offer')}</span></span>${icon('chevron', 'collapse-chev')}</summary>
        <div class="collapse-body">${offerBody(s)}</div>
      </details>

      <details class="card collapse fold">
        <summary class="collapse-head"><span class="card-title"><span class="fold-ico ic-blue">${icon('info')}</span><span>${t('sd.details')}</span></span>
          <span class="collapse-sum">${s.validTo ? t('common.till', { date: fmt.shortDate(s.validTo) }) : t('common.ongoing')}</span>${icon('chevron', 'collapse-chev')}</summary>
        <div class="collapse-body">
          ${tiles([
            { icon: 'calendar', label: t('sd.valid'), value: s.validTo ? t('common.till', { date: fmt.shortDate(s.validTo) }) : t('common.ongoing'), sub: s.validTo ? t('sd.daysLeft', { n: Math.max(0, fmt.daysBetween(today, s.validTo)) }) : '', tone: 'blue' },
            { icon: 'store', label: t('sd.who'), value: whoShort(s) },
            s.capUsesPerMonth ? { icon: 'box', label: t('sd.limit'), value: t('n.freeCase', { n: s.capUsesPerMonth }), sub: t('sd.perShop') } : null,
            o && st?.cap ? { icon: 'check', label: t('sd.used', { month }), value: t('sd.usedVal', { used: st.used, cap: st.cap }), tone: st.used >= st.cap ? 'warn' : '' } : null,
          ])}
          <ul class="sd-notes">
            ${s.type === 'free-goods' ? html`<li>${icon('tag')}<span><b>${t('sd.freeAs')}:</b> ${freeAs(r)}</span></li>` : ''}
            <li>${icon('wallet')}<span><b>${t('sd.paid')}:</b> ${lang() === 'en' && s.payout && s.type !== 'program' ? s.payout : t(`sd.pay.${s.type}`)}</span></li>
            ${s.extras ? html`<li>${icon('plus')}<span><b>${t('sd.also')}:</b> ${schemes.extrasText(s)}</span></li>` : ''}
          </ul>
        </div>
      </details>

      ${o && s.type === 'program' && o.cooler?.type === 'bottler' ? auditCard(o, today) : ''}
      ${o ? historyCard(s, all) : ''}
    </div>
    ${o ? html`<div class="bottom-bar">${st.kind === 'applicable' && s.type !== 'program'
      ? html`<a class="btn btn-primary btn-block" href="#/book/${o.id}" data-focus-scheme="${s.id}" data-focus-outlet="${o.id}">${t('sd.book')}</a>`
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

/** Who can get it, short enough for a tile: "Diamond, Gold, Silver" or "All shops". */
function whoShort(s) {
  if (s.type === 'first-order') return t('sd.firstShort', { days: s.rule?.withinDaysOfRegistration ?? 90 });
  const tiers = Array.isArray(s.eligibleTiers) ? s.eligibleTiers.map((x) => label('tier', x)).join(', ') : t('sd.allOutlets');
  return s.requiresBottlerCooler ? `${tiers} · ${t('sd.coolerShort')}` : tiers;
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

/** The offer in one short line, then its packs as pills with their rate (no long sentence). */
function offerBody(s) {
  const r = s.rule ?? {};
  const list = Array.isArray(s.skus) ? s.skus.map((sku) => data.product(sku)).filter(Boolean) : [];
  const line = s.type === 'free-goods' ? t('sd.offerFree', { buy: r.buyCases, free: r.freeCases })
    : s.type === 'percent-off' ? t('sd.offerPct', { min: r.minCases, pct: r.percent })
    : schemes.offerText(s);
  if (!list.length) return html`<p class="sd-offer">${line}</p>`;
  const unit = (p) => t(p.caseLabel === 'crate' ? 'unit.crate' : 'unit.case');
  return html`<p class="sd-offer">${line}</p>
    <p class="tp-packs-l">${list.length > 1 ? (r.pooled ? t('tp.f.anyMix') : t('tp.f.together')) : t('tp.f.pack')}</p>
    <ul class="sd-packs">${list.map((p) => html`<li><span>${p.name}</span><b class="num">${fmt.rupees(p.ptrPerCase)}/${unit(p)}</b></li>`)}</ul>`;
}

function auditCard(o, today) {
  const a = o.cooler.lastAudit;
  return html`<section class="card">
    <h2 class="card-title">${icon('cooler')}<span>${t('sd.audit')}</span></h2>
    ${a ? tiles([
      { icon: 'calendar', label: t('cooler.lastAudit'), value: fmt.shortDate(a.date), sub: fmt.relative(a.date, today) },
      { icon: 'check', label: t('cooler.onlyOurs'), value: a.pure ? t('cooler.yes') : t('cooler.otherBrands'), tone: a.pure ? '' : 'warn' },
      { icon: 'cooler', label: t('cooler.fillTemp'), value: `${a.fillPct}% · ${a.tempC}°C` },
    ]) : html`<p class="muted">${t('cooler.noAudit')}</p>`}
  </section>`;
}

function historyCard(s, all) {
  const used = all.filter((x) => Array.isArray(x.schemeIds) && x.schemeIds.includes(s.id));
  const freeOf = (x) => x.lines.filter((l) => schemes.coversSku(s, l.sku)).reduce((n, l) => n + (l.freeCases || 0), 0);
  const free = used.reduce((n, x) => n + freeOf(x), 0);
  return html`<section class="card">
    <h2 class="card-title">${icon('history')}<span>${t('sd.history')}</span></h2>
    ${used.length ? html`${tiles([
      { icon: 'check', label: t('sd.timesUsed'), value: fmt.num(used.length), tone: 'blue' },
      s.type === 'free-goods' ? { icon: 'box', label: t('sd.freeGot'), value: t('n.freeCase', { n: free }) } : { icon: 'calendar', label: t('sd.lastUsed'), value: fmt.shortDate(used[0].date) },
    ])}
    <ul class="recent sd-recent">${used.slice(0, 4).map((x) => html`<li>
      <span class="recent-d">${fmt.shortDate(x.date)}</span>
      <span>${fmt.casesText(orders.paidCases(x))}</span>
      <b class="num">${s.type === 'free-goods' ? `+${t('n.freeCase', { n: freeOf(x) })}` : t('sd.historyApplied')}</b>
    </li>`)}</ul>` : html`<p class="muted">${t('sd.historyEmpty')}</p>`}
  </section>`;
}
