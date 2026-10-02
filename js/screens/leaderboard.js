// Leaderboard: every rep in the district, ranked by summer target %, the priority this season.
// Compact rows that open to show the other numbers. The rep's own card shows all five at once.
// The rep's own row is computed live (feature/metrics.js); the other reps are demo data.

import { session } from '../app.js';
import * as data from '../data.js';
import * as fmt from '../format.js';
import { t } from '../i18n.js';
import { html, mount, fresh, icon, appBar } from '../ui.js';
import * as metrics from '../feature/metrics.js';

const METRICS = [
  { key: 'productiveCallsPct', icon: 'check', pct: true },
  { key: 'activeOutletsPct', icon: 'store', pct: true },
  { key: 'focusCoveragePct', icon: 'target', pct: true },
  { key: 'monthTargetPct', icon: 'calendar', pct: true },
  { key: 'casesOrdered', icon: 'box', pct: false },
];
const MEDAL = ['#f4c542', '#c9d1dc', '#d9925a'];
const TINTS = ['#e8f0ff', '#e3f5ea', '#fff1dc', '#f0ebfb', '#fde8ee', '#e0f4f7'];

/** A small 'i' next to a metric's name; tapping it shows what the metric means. */
const info = (key) => html`<button type="button" class="tip-i" data-tip="${key}" aria-label="${t('f.lb.defs')}: ${t(`f.lb.short.${key}`)}">i</button>`;

const value = (m, r) => (m.pct ? `${r[m.key]}%` : fmt.num(r[m.key]));
const initials = (name) => String(name).split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export function render(root) {
  const view = fresh(root);
  const { rows, me, total, lb } = metrics.leaderboard(session.name());
  const ahead = rows[rows.indexOf(me) - 1];

  mount(view, html`
    ${appBar({ title: t('f.lb.title'), sub: `${lb.district} · ${fmt.dateRange(lb.period.from, lb.period.to, data.demoDate())}`, back: '#/home' })}
    <div class="page page-lb">
      <section class="lb-me">
        <div class="lb-me-top">
          <span class="lb-me-rank">#${me.rank}<small>/${total}</small></span>
          <div class="lb-me-text">
            <p class="lb-me-name">${t('f.lb.youAre', { name: me.name })}</p>
            <p class="lb-me-gap">${ahead ? t('f.lb.gap', { gap: ahead.preSeasonPct - me.preSeasonPct, name: ahead.name.split(' ')[0] }) : t('f.lb.top')}</p>
          </div>
          <span class="lb-me-pct"><b>${me.preSeasonPct}%</b><small>${t('f.lb.short.preSeasonPct')}${info('preSeasonPct')}</small></span>
        </div>
        <div class="lb-tiles">${METRICS.map((m) => html`<div class="lb-tile">${icon(m.icon)}<b>${value(m, me)}</b><span>${t(`f.lb.short.${m.key}`)}${info(m.key)}</span></div>`)}</div>
      </section>

      <p class="lb-list-head"><span>${t('f.lb.rep')}</span><span>${t('f.lb.short.preSeasonPct')}${info('preSeasonPct')}</span></p>
      <ol class="lb-list">
        ${rows.map((r, i) => html`<li class="${r.isMe ? 'is-me' : ''}">
          <details class="lb-row">
            <summary>
              <span class="lb-pos" style="${i < 3 ? `background:${MEDAL[i]}` : ''}">${r.rank}</span>
              <span class="lb-avatar" style="background:${TINTS[i % TINTS.length]}">${initials(r.name)}</span>
              <span class="lb-main"><span class="lb-name">${r.isMe ? t('f.lb.you', { name: r.name }) : r.name}</span><span class="lb-terr">${r.territory} · ${t('f.lb.outlets', { n: r.outlets })}</span></span>
              <span class="lb-score"><b>${r.preSeasonPct}%</b></span>
            </summary>
            <div class="lb-more">${METRICS.map((m) => html`<span>${icon(m.icon)}<b>${value(m, r)}</b> ${t(`f.lb.short.${m.key}`)}</span>`)}</div>
          </details>
        </li>`)}
      </ol>

    </div>`);

  // One definition bubble at a time, under the 'i' that was tapped; any other tap closes it.
  let bubble = null;
  const close = () => { bubble?.remove(); bubble = null; view.querySelector('.tip-i.is-open')?.classList.remove('is-open'); };
  view.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tip]');
    const wasOpen = btn?.classList.contains('is-open');
    close();
    if (!btn || wasOpen) return;
    e.stopPropagation();
    e.preventDefault();
    btn.classList.add('is-open');
    bubble = document.createElement('div');
    bubble.className = 'tip-bubble';
    bubble.setAttribute('role', 'tooltip');
    bubble.innerHTML = String(html`<b>${t(`f.lb.short.${btn.dataset.tip}`)}</b><span>${t(`f.lb.def.${btn.dataset.tip}`)}</span>`);
    view.append(bubble);
    const r = btn.getBoundingClientRect();
    const host = view.getBoundingClientRect();
    const w = Math.min(280, host.width - 24);
    const left = Math.max(12, Math.min(r.left + r.width / 2 - host.left - w / 2, host.width - w - 12));
    bubble.style.width = `${w}px`;
    bubble.style.left = `${left}px`;
    bubble.style.top = `${r.bottom - host.top + 8}px`;
    bubble.style.setProperty('--arrow', `${r.left + r.width / 2 - host.left - left}px`);
  });
}
