// What the rep needs to know about one SKU when ordering it: distributor availability
// (morning sync; reliable for in/out, not for quantity), an alternative when it is out,
// shelf life, and adoption evidence for the newer packs.

import * as data from '../data.js';
import * as orders from '../orders.js';
import * as fmt from '../format.js';
import { t } from '../i18n.js';
import { html, icon } from '../ui.js';

const ADOPTION_WEEKS = 8;   // "nearby retailers increased orders": last 8 weeks vs the same 8 weeks last year

/** → { kind: 'available'|'limited'|'out', status, ration, note } from the morning sync. */
export function stockStatus(sku) {
  const it = data.stockFor(sku);
  const status = it?.sourceStatus ?? (it?.status === 'out' ? 'out-of-stock' : it?.status === 'rationed' ? 'rationed' : 'available');
  const kind = status === 'out-of-stock' ? 'out' : status === 'available' ? 'available' : 'limited';
  return { kind, status, ration: it?.status === 'rationed' ? it.maxCasesPerOutlet : null, note: it?.note ?? '' };
}

export const isOrderable = (sku) => stockStatus(sku).kind !== 'out';

/** Closest available SKU of the same flavour and category (nearest pack size), else null. */
export function alternativeFor(sku) {
  const p = data.product(sku);
  if (!p) return null;
  return data.products()
    .filter((q) => q.sku !== sku && q.flavour === p.flavour && q.category === p.category && isOrderable(q.sku))
    .sort((a, b) => Math.abs(a.pack.ml - p.pack.ml) - Math.abs(b.pack.ml - p.pack.ml))[0] ?? null;
}

export function statusTag(sku) {
  const s = stockStatus(sku);
  const text = s.kind === 'out' ? t('f.stock.s.out-of-stock')
    : s.ration ? t('f.sku.ration', { n: s.ration })
    : s.kind === 'limited' ? t(`f.stock.s.${s.status}`) : t('f.stock.s.available');
  return html`<span class="stock-tag is-${s.kind}"><span class="stock-dot" aria-hidden="true"></span>${text}</span>`;
}

/** Newer-SKU evidence: nearby retailers (same area) ordering it more than last year, plus the
 *  demo offtake figure from field.json (labelled as demo evidence). */
export function newSkuEvidence(sku, outlet) {
  const entry = data.field().newSkus?.find((x) => x.sku === sku);
  if (!entry) return null;
  const today = data.demoDate();
  const from = fmt.addDays(today, -7 * ADOPTION_WEEKS);
  const lyFrom = fmt.addDays(from, -364); const lyTo = fmt.addDays(today, -364);
  const casesAt = (id, a, b) => orders.allOrdersFor(id).filter((x) => x.date >= a && x.date < b)
    .reduce((n, x) => n + x.lines.filter((l) => l.sku === sku).reduce((m, l) => m + l.cases, 0), 0);
  const nearby = data.outlets().filter((o) => o.area === outlet.area && o.id !== outlet.id);
  const buyers = nearby.filter((o) => casesAt(o.id, from, today) > 0);
  const grew = buyers.filter((o) => casesAt(o.id, from, today) > casesAt(o.id, lyFrom, lyTo));
  const cases = buyers.reduce((n, o) => n + casesAt(o.id, from, today), 0);
  return { entry, area: outlet.area, buyers: buyers.length, grew: grew.length, cases, weeks: ADOPTION_WEEKS };
}

export const isNewer = (sku) => Boolean(data.field().newSkus?.some((x) => x.sku === sku));

/** The expandable detail under a SKU row. `extra` is filled by the order assistant. */
export function detailHtml(p, outlet) {
  const s = stockStatus(p.sku);
  const ev = newSkuEvidence(p.sku, outlet);
  const alt = s.kind === 'out' ? alternativeFor(p.sku) : null;
  return html`<div class="sku-detail" data-detail hidden>
    <dl class="sku-facts">
      <div><dt>${t('f.sku.shelf')}</dt><dd>${t('f.sku.shelfDays', { n: p.shelfLifeDays })}</dd></div>
      ${p.focus ? html`<div><dt>${t('f.sku.focus')}</dt><dd>${t('f.sku.focusYes')}</dd></div>` : ''}
    </dl>
    ${s.note ? html`<p class="sku-note">${icon('truck')}<span>${s.note}</span></p>` : ''}
    ${alt ? html`<p class="alt-line">${icon('info')}<span>${t('f.sku.alt', { name: alt.name })}</span></p>` : ''}
    ${ev ? html`<div class="evidence">
      <p class="evidence-title">${icon('trend')}<span>${t('f.sku.evTitle')}</span></p>
      <ul>
        ${ev.buyers ? html`<li><b>${ev.buyers}</b> ${t('f.sku.evBuyers', { area: ev.area, weeks: ev.weeks, cases: fmt.num(ev.cases) })}</li>` : ''}
        ${ev.grew ? html`<li><b>${ev.grew}</b> ${t('f.sku.evGrew')}</li>` : ''}
        <li><b>${fmt.num(ev.entry.offtake.units)}+</b> ${t('f.sku.evOfftake', { unit: ev.entry.offtake.unitLabel, region: ev.entry.offtake.region, weeks: ev.entry.offtake.weeks })} <span class="demo-flag">${t('f.sku.demoEv')}</span></li>
      </ul>
    </div>` : ''}
    <div data-assist-detail></div>
  </div>`;
}
