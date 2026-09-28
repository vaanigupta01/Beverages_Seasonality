// Outlet list: search plus filter chips (All · Today's route · by channel).

import * as data from '../data.js';
import * as orders from '../orders.js';
import { t, label } from '../i18n.js';
import { quickActions } from '../feature/outlet-tools.js';
import { html, mount, fresh, icon, appBar, pill, tierBadge, personaTag, emptyState } from '../ui.js';

// Kept while the app is open, so coming back restores the list as the rep left it.
let query = '';
let filter = 'all';

export function render(root) {
  const view = fresh(root);
  const today = data.demoDate();
  const all = data.outlets();
  const onRoute = new Set(data.route().map((o) => o.id));
  const channels = [...new Set(all.map((o) => o.channel))];
  const filters = [
    { key: 'all', label: t('outlets.all'), test: () => true },
    { key: 'route', label: t('outlets.route'), test: (o) => onRoute.has(o.id) },
    ...channels.map((ch) => ({ key: `ch:${ch}`, label: label('ch', ch), test: (o) => o.channel === ch })),
  ];
  if (!filters.some((f) => f.key === filter)) filter = 'all';

  mount(view, html`
    ${appBar({ title: t('outlets.title'), back: '#/home' })}
    <div class="toolbar">
      <div class="search">
        ${icon('search')}
        <input class="search-input" type="search" data-q value="${query}" placeholder="${t('outlets.search')}" aria-label="${t('outlets.searchLabel')}" autocomplete="off" enterkeyhint="search">
        <button type="button" class="search-clear" data-clear ${query ? '' : 'hidden'}>${t('common.clear')}</button>
      </div>
      <div class="chips" role="group" aria-label="${t('outlets.filters')}">
        ${filters.map((f) => html`<button type="button" class="chip" data-filter="${f.key}" aria-pressed="${String(f.key === filter)}">${f.label}<span class="chip-count">${all.filter(f.test).length}</span></button>`)}
      </div>
    </div>
    <div class="page">
      <p class="list-count" data-count aria-live="polite"></p>
      <ul class="list outlet-list">${all.map((o) => row(o, onRoute.has(o.id), today))}</ul>
      <div data-empty></div>
    </div>`);

  const input = view.querySelector('[data-q]');
  const clearBtn = view.querySelector('[data-clear]');
  const items = [...view.querySelectorAll('[data-outlet]')];
  const count = view.querySelector('[data-count]');
  const empty = view.querySelector('[data-empty]');

  function apply() {
    query = input.value;
    clearBtn.hidden = !query;
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const test = filters.find((f) => f.key === filter).test;
    let shown = 0;
    items.forEach((li) => {
      const o = data.outlet(li.dataset.outlet);
      const hit = test(o) && tokens.every((tk) => li.dataset.search.includes(tk));
      li.hidden = !hit;
      if (hit) shown += 1;
    });
    const total = t('n.outlet', { n: all.length });
    count.textContent = shown === all.length ? total : t('outlets.count', { shown, total });
    count.hidden = shown === 0;
    if (shown) {
      empty.replaceChildren();
    } else if (query.trim()) {
      mount(empty, emptyState({
        icon: 'search',
        title: t('outlets.noMatch', { q: query.trim() }),
        body: filter === 'all' ? t('outlets.noMatchAll') : t('outlets.noMatchFilter'),
        action: html`<button type="button" class="btn btn-secondary" data-clear>${t('outlets.clearSearch')}</button>`,
      }));
    } else {
      mount(empty, emptyState({
        icon: 'store',
        title: t('outlets.noneInFilter'),
        action: html`<button type="button" class="btn btn-secondary" data-filter="all">${t('outlets.showAll')}</button>`,
      }));
    }
  }

  input.addEventListener('input', apply);
  view.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (chip) {
      filter = chip.dataset.filter;
      view.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === filter)));
      apply();
      return;
    }
    if (e.target.closest('[data-clear]')) {
      input.value = '';
      apply();
      input.focus();
    }
  });
  apply();
}

// A colour per channel for the shop's monogram tile, so the list scans by type at a glance.
const CHANNEL_TINT = {
  'Traditional Kirana': ['#fff1dc', '#a35a00'], Convenience: ['#e6f0ff', '#1d4fb0'], 'Eating & Drinking (seating)': ['#fde8ee', '#b0275a'],
  'Eating & Drinking (standing)': ['#fdeede', '#b4431a'], 'Paan/Cigarette shop': ['#e7f6ec', '#11663c'], Education: ['#efe9fd', '#5a2fbf'],
  'At-work': ['#e5f4f6', '#0a6d7a'], 'Entertainment & Leisure': ['#fff4cf', '#8a6500'], 'Modern Trade (small format)': ['#eceff4', '#3d4b60'], Wholesale: ['#f1e8e2', '#6b3d1f'],
};
const monogram = (o) => {
  const [bg, fg] = CHANNEL_TINT[o.channel] ?? ['#eef2f7', '#3d4b60'];
  const letters = o.name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('');
  return html`<span class="mono-tile" style="background:${bg};color:${fg}" aria-hidden="true">${letters}</span>`;
};

function row(o, onRoute, today) {
  const saved = orders.demoOrdersOn(o.id, today);
  // Searchable in English and in the current language.
  const search = [o.name, o.area, label('area', o.area), o.address, o.channel, label('ch', o.channel), o.shopType,
    label('shop', o.shopType), o.tier, label('tier', o.tier), o.id, o.persona?.label].filter(Boolean).join(' ').toLowerCase();
  const type = o.shopType && o.shopType !== o.channel ? ` · ${label('shop', o.shopType)}` : '';
  return html`<li class="row-wrap" data-outlet="${o.id}" data-search="${search}">
    <a class="row outlet-row" href="#/outlet/${o.id}">
      ${monogram(o)}
      <span class="row-main">
        <span class="row-title">${o.name}</span>
        <span class="row-meta">${label('area', o.area)} · ${label('ch', o.channel)}${type}</span>
        <span class="row-tags">
          ${tierBadge(o, { visits: 'short' })}
          ${saved.length ? pill(saved.length > 1 ? t('status.savedShortN', { n: saved.length }) : t('status.savedShort'), 'ok', 'check') : ''}
          ${onRoute ? '' : pill(t('outlets.notOnRoute'), 'neutral')}
        </span>
        ${personaTag(o)}
      </span>
    </a>
    ${quickActions(o)}
  </li>`;
}
