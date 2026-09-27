// Order booking: find SKUs (search + category), set quantities, see schemes, running total.
// The screen renders once; cart changes update only the affected row and the footer, so
// feature code in the slots isn't wiped on every tap.
// Tapping an applicable scheme chip adds that scheme's quantity of the product (e.g. +10).

import { app, router } from '../app.js';
import * as data from '../data.js';
import * as orders from '../orders.js';
import * as schemes from '../schemes.js';
import { cart, MAX_CASES } from '../cart.js';
import * as fmt from '../format.js';
import { t, label, lang } from '../i18n.js';
import { html, mount, fresh, icon, appBar, slot, emptyState, openSheet, toast } from '../ui.js';
import * as sku from '../feature/sku-info.js';
import { otherRep, confirmCrossTerritory } from '../feature/outlet-tools.js';

// Outlets where the rep already confirmed a cross-territory order this session.
const crossOk = new Set();

const lcFirst = (s) => (lang() === 'en' ? s.charAt(0).toLowerCase() + s.slice(1) : s);

export function render(root, { id }) {
  const o = data.outlet(id);
  if (!o) {
    const view = fresh(root);
    mount(view, html`${appBar({ title: t('book.title'), back: '#/outlets' })}
      <div class="page">${emptyState({ icon: 'store', title: t('outlet.notFound'), body: t('outlet.notFoundBody', { id: id ?? '' }), action: html`<a class="btn btn-primary" href="#/outlets">${t('outlet.openList')}</a>` })}</div>`);
    return null;
  }

  let inner = null;
  const cleanup = () => inner?.();

  if (!cart.isEmpty() && cart.outletId && cart.outletId !== o.id) {
    askSwitch(root, o, () => {
      cart.start(o.id);
      inner = renderBooking(root, o);
      app.emit('screen:rendered', { screen: 'book', outletId: o.id, root });
    });
    return cleanup;
  }
  // Another rep's outlet: warn about the incentive split and ask before booking.
  if (otherRep(o) && !crossOk.has(o.id) && cart.outletId !== o.id) {
    fresh(root);
    confirmCrossTerritory(o).then((go) => {
      if (!go) return router.go(`#/outlet/${o.id}`, { replace: true });
      crossOk.add(o.id);
      cart.start(o.id);
      inner = renderBooking(root, o);
      app.emit('screen:rendered', { screen: 'book', outletId: o.id, root });
    });
    return cleanup;
  }
  if (cart.outletId !== o.id) cart.start(o.id);
  inner = renderBooking(root, o);
  return cleanup;
}

/** Another outlet's order isn't submitted: keep editing it, or discard it and start here. */
function askSwitch(root, o, startHere) {
  const other = data.outlet(cart.outletId);
  const view = fresh(root);
  const otherName = other?.name ?? cart.outletId;
  const p = other ? schemes.price(cart.lines(), other, data.demoDate(), orders.allOrdersFor(other.id)) : null;
  const cases = fmt.casesText(cart.totalCases());

  mount(view, html`${appBar({ title: t('book.title'), sub: o.name, back: `#/outlet/${o.id}` })}
    <div class="page">${emptyState({
      icon: 'note',
      title: t('book.openTitle'),
      body: t('book.openBody', { name: otherName, cases }),
      action: html`<button type="button" class="btn btn-primary" data-ask>${t('book.choose')}</button>`,
    })}</div>`);

  const ask = async () => {
    const key = await openSheet({
      title: t('book.unsavedTitle'),
      body: html`<p>${t('book.unsavedBody', { name: otherName, cases, value: p ? fmt.rupees(p.gross) : '' })}</p>
        <p>${t('book.unsavedQ', { name: o.name })}</p>`,
      actions: [
        { key: 'keep', label: t('book.keep', { name: otherName }), tone: 'primary' },
        { key: 'discard', label: t('book.discard'), tone: 'danger-quiet' },
      ],
      dismissKey: 'dismiss',
    });
    if (key === 'keep') router.go(`#/book/${cart.outletId}`);
    if (key === 'discard') startHere();
  };
  view.querySelector('[data-ask]').addEventListener('click', ask);
  ask();
}

function renderBooking(root, o) {
  const view = fresh(root);
  const today = data.demoDate();
  const pastAndDemo = orders.allOrdersFor(o.id);
  const products = data.products();
  const orderLevel = schemes.activeSchemes(today)
    .filter((s) => s.type === 'first-order')
    .filter((s) => schemes.eligibility(s, o, today, pastAndDemo).eligible);

  mount(view, html`
    ${appBar({ title: t('book.title'), sub: o.name, back: `#/outlet/${o.id}` })}
    <div class="toolbar">
      <div class="search">
        ${icon('search')}
        <input class="search-input" type="search" data-q placeholder="${t('book.search')}" aria-label="${t('book.search')}" autocomplete="off" enterkeyhint="search">
        <button type="button" class="search-clear" data-clear hidden>${t('common.clear')}</button>
      </div>
      <div class="chips" role="group" aria-label="${t('book.category')}">
        <button type="button" class="chip" data-cat="" aria-pressed="true">${t('book.all')}</button>
        ${data.categories().map((c) => html`<button type="button" class="chip" data-cat="${c}" aria-pressed="false">${label('cat', c)}</button>`)}
      </div>
    </div>

    ${slot('booking-season')}
    ${slot('booking-live')}

    <div class="page page-book">
      ${orderLevel.map((s) => html`<p class="inline-note inline-note-info">${icon('tag')}<span>${t('book.firstOrder', { name: s.name, offer: schemes.chipText(s) })}</span></p>`)}
      <ul class="sku-list">${products.map((p) => skuRow(p, o, today, pastAndDemo))}</ul>
      <div data-empty></div>
    </div>

    <footer class="cart-bar">
      <div class="cart-sum" aria-live="polite">
        <p class="cart-main"><strong data-cases></strong><span class="cart-sep" aria-hidden="true">·</span><span data-value></span></p>
        <p class="cart-extra" data-extra></p>
      </div>
      <button type="button" class="btn btn-primary" data-review>${t('book.review')}${icon('chevron')}</button>
    </footer>`);

  const rows = new Map([...view.querySelectorAll('.sku')].map((li) => [li.dataset.sku, li]));
  const q = view.querySelector('[data-q]');
  const clearBtn = view.querySelector('[data-clear]');
  const empty = view.querySelector('[data-empty]');
  const footer = {
    cases: view.querySelector('[data-cases]'),
    value: view.querySelector('[data-value]'),
    extra: view.querySelector('[data-extra]'),
    review: view.querySelector('[data-review]'),
  };
  let category = '';
  const lastValid = new WeakMap();   // quantity field → its last accepted text
  const afterSeparator = new WeakSet();   // quantity fields where a non-digit ("." "," "-") was just refused
  const hintTimers = new WeakMap();

  function showHint(li, text) {
    const hint = li.querySelector('[data-qty-hint]');
    hint.textContent = text;
    hint.hidden = false;
    clearTimeout(hintTimers.get(hint));
    hintTimers.set(hint, setTimeout(() => { hint.hidden = true; }, 2500));
  }

  function syncRow(sku_) {
    const li = rows.get(sku_);
    if (!li) return;
    const n = cart.get(sku_);
    const input = li.querySelector('.qty');
    if (document.activeElement !== input) input.value = String(n);
    li.classList.toggle('has-qty', n > 0);
    li.querySelector('[data-step="-1"]').disabled = n <= 0;
    const out = !sku.isOrderable(sku_);
    li.querySelector('[data-step="1"]').disabled = n >= MAX_CASES || out;
    li.querySelectorAll('[data-quick]').forEach((b) => { b.disabled = n >= MAX_CASES || out; });
    const ration = sku.stockStatus(sku_).ration;
    if (ration && n > ration) showHint(li, t('f.sku.overRation', { n: ration }));
  }

  function syncFooter() {
    const p = schemes.price(cart.lines(), o, today, pastAndDemo);
    footer.cases.textContent = fmt.casesText(p.paidCases);
    footer.value.textContent = fmt.rupees(p.gross);   // booked value; schemes are settled later
    const extras = [];
    if (p.freeCases) extras.push(t('book.estFree', { free: t('n.freeCase', { n: p.freeCases }) }));
    if (p.discount) extras.push(t('book.estOff', { amt: fmt.rupees(p.discount) }));
    footer.extra.textContent = extras.length ? extras.join(' · ') : p.paidCases ? t('book.noScheme') : t('book.cartEmpty');
    footer.extra.classList.toggle('is-quiet', !extras.length);
    footer.review.disabled = p.paidCases === 0;
  }

  function applyFilter() {
    clearBtn.hidden = !q.value;
    const tokens = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    rows.forEach((li) => {
      // A category chip, or a feature tag on the row (e.g. "suggested" from the order assistant).
      const inCat = !category || li.dataset.category === category || (li.dataset.tags ?? '').split(' ').includes(category);
      const hit = inCat && tokens.every((tk) => li.dataset.search.includes(tk));
      li.hidden = !hit;
      if (hit) shown += 1;
    });
    if (shown) return empty.replaceChildren();
    const cat = label('cat', category);
    mount(empty, q.value.trim()
      ? emptyState({ icon: 'search', title: t('book.noMatch', { q: q.value.trim() }), body: category ? t('book.noMatchIn', { cat }) : t('book.noMatchBody'), action: html`<button type="button" class="btn btn-secondary" data-clear>${t('outlets.clearSearch')}</button>` })
      : emptyState({ icon: 'box', title: t('book.noneIn', { cat }) }));
  }

  const unsubscribe = cart.subscribe((e) => {
    if (e.sku) syncRow(e.sku);
    else rows.forEach((_, sku) => syncRow(sku));
    syncFooter();
  });
  rows.forEach((_, sku) => syncRow(sku));
  syncFooter();

  view.addEventListener('click', (e) => {
    const step = e.target.closest('[data-step]');
    if (step) {
      const sku = step.closest('.sku').dataset.sku;
      if (step.dataset.step === '1') cart.add(sku);
      else cart.remove(sku);
      return;
    }
    // A scheme chip adds the scheme's quantity of this product (buy 10 → +10, 5+ cases → +5).
    const quick = e.target.closest('[data-quick]');
    if (quick) {
      const li = quick.closest('.sku');
      const p = data.product(li.dataset.sku);
      const s = schemes.activeSchemes(today).find((x) => x.id === quick.dataset.scheme);
      const n = Math.min(Number(quick.dataset.quick), MAX_CASES - cart.get(p.sku));
      if (n > 0) {
        cart.add(p.sku, n);
        toast(t('book.added', { cases: fmt.unitsText(n, p.caseLabel), name: p.name, scheme: s?.name ?? '' }), 'plus');
      }
      return;
    }
    const more = e.target.closest('[data-more]');
    if (more) {
      const detail = more.closest('.sku').querySelector('[data-detail]');
      detail.hidden = !detail.hidden;
      more.setAttribute('aria-expanded', String(!detail.hidden));
      return;
    }
    const chip = e.target.closest('.chip[data-cat]');
    if (chip) {
      category = chip.dataset.cat;
      view.querySelectorAll('.chip[data-cat]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      applyFilter();
      return;
    }
    if (e.target.closest('[data-clear]')) {
      q.value = '';
      applyFilter();
      q.focus();
      return;
    }
    if (e.target.closest('[data-review]') && !cart.isEmpty()) router.go(`#/review/${o.id}`);
  });

  view.addEventListener('input', (e) => {
    if (e.target === q) return applyFilter();
    if (e.target.matches('.qty')) {
      // Whole cases 0–999 only. Anything else ("12.5", "1,200", "-5", a 4th digit) is refused:
      // the field keeps its last valid value and a small hint says why.
      const input = e.target;
      const li = input.closest('.sku');
      const value = input.value;
      const prev = lastValid.get(input) ?? String(cart.get(li.dataset.sku));
      // Digits typed right after a refused character belong to it (the ".5" of "12.5", the "5"
      // of "-5"): ignore them too, until the rep deletes or taps the field again.
      if (afterSeparator.has(input) && value.startsWith(prev) && /^\d+$/.test(value.slice(prev.length))) {
        input.value = prev;
        showHint(li, t('book.hintWhole'));
        return;
      }
      if (Number(value) > 0 && !sku.isOrderable(li.dataset.sku)) {
        input.value = '0';
        showHint(li, t('f.sku.outHint'));
        return;
      }
      if (/^\d*$/.test(value) && (value === '' || Number(value) <= MAX_CASES)) {
        const clean = value === '' ? '' : String(Number(value));   // "045" → "45"
        if (clean !== value) input.value = clean;
        afterSeparator.delete(input);
        lastValid.set(input, clean);
        cart.set(li.dataset.sku, clean === '' ? 0 : Number(clean));
        return;
      }
      input.value = prev;
      const tooBig = /^\d+$/.test(value);
      if (!tooBig) afterSeparator.add(input);
      showHint(li, tooBig ? t('book.hintMax', { max: MAX_CASES }) : t('book.hintWhole'));
    }
  });
  view.addEventListener('focusin', (e) => {
    if (!e.target.matches('.qty')) return;
    lastValid.set(e.target, e.target.value);
    afterSeparator.delete(e.target);
    e.target.select();
  });
  view.addEventListener('focusout', (e) => {
    if (!e.target.matches('.qty')) return;
    afterSeparator.delete(e.target);
    e.target.value = String(cart.get(e.target.closest('.sku').dataset.sku));
  });
  view.addEventListener('keydown', (e) => { if (e.target.matches('.qty') && e.key === 'Enter') e.target.blur(); });

  return unsubscribe;
}

function skuRow(p, o, today, pastAndDemo) {
  const unit = t(p.caseLabel === 'crate' ? 'unit.crate' : 'unit.case');
  const size = p.pack?.ml >= 1000 ? `${p.pack.ml / 1000} L` : `${p.pack?.ml} ml`;
  const pack = `${p.unitsPerCase} ${t(`pack.${p.pack?.type}`) === `pack.${p.pack?.type}` ? t('pack.units') : t(`pack.${p.pack?.type}`)} × ${size}${p.returnable ? ` · ${t('book.returnable')}` : ''}`;
  const search = [p.name, p.sku, p.category, label('cat', p.category), p.flavour, p.pack?.type, `${p.pack?.ml}`].filter(Boolean).join(' ').toLowerCase();
  const chips = schemes.schemesForSku(p.sku, today).map((s) => {
    const st = schemes.statusFor(s, o, today, pastAndDemo);
    if (st.kind === 'not') return html`<span class="scheme-chip is-off">${s.name} · ${lcFirst(st.reason)}</span>`;
    if (st.kind === 'used') {
      return html`<span class="scheme-chip is-used">${icon('tag')}${t('book.capUsed', { chip: schemes.chipText(s), cap: st.cap, month: fmt.monthName(today) })}</span>`;
    }
    const n = schemes.quickAdd(s);
    return html`<button type="button" class="scheme-chip is-add" data-quick="${n}" data-scheme="${s.id}" aria-label="${t('book.chipAdd', { n, unit, name: p.name, scheme: s.name })}">${icon('tag')}<span>${schemes.chipText(s)}</span><span class="chip-plus" aria-hidden="true">+${n}</span></button>`;
  });

  return html`<li class="sku ${sku.isOrderable(p.sku) ? '' : 'is-out'}" data-sku="${p.sku}" data-category="${p.category}" data-search="${search}">
    <div class="sku-text">
      <p class="sku-name">${p.name}</p>
      <p class="sku-pack">${pack}</p>
      <p class="sku-rate"><strong>${t('book.rate', { rate: fmt.rupees(p.ptrPerCase), unit })}</strong>${p.returnable ? t('book.deposit') : ''} · ${t('book.mrp', { mrp: fmt.rupees(p.mrpPerUnit) })}</p>
      <p class="sku-status">${sku.statusTag(p.sku)}${sku.isNewer(p.sku) ? html`<span class="new-tag">${t('f.sku.newer')}</span>` : ''}<button type="button" class="sku-more" data-more aria-expanded="false">${t('f.sku.details')}</button></p>
    </div>
    <div class="stepper">
      <button type="button" class="step" data-step="-1" aria-label="${t('book.fewer', { unit, name: p.name })}">−</button>
      <input class="qty" type="text" inputmode="numeric" pattern="[0-9]*" value="0" aria-label="${t('book.qty', { unit, name: p.name })}" autocomplete="off">
      <button type="button" class="step" data-step="1" aria-label="${t('book.more', { unit, name: p.name })}">+</button>
    </div>
    <p class="qty-hint" data-qty-hint role="status" hidden></p>
    ${chips.length ? html`<div class="sku-chips">${chips}</div>` : ''}
    ${sku.detailHtml(p, o)}
    ${slot('sku-hint', { tag: 'div', attrs: { 'data-sku': p.sku } })}
  </li>`;
}
