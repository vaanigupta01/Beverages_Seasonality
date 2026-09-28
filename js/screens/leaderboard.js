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
          <span class="lb-me-pct"><b>${me.preSeasonPct}%</b><small>${t('f.lb.short.preSeasonPct')}</small></span>
        </div>
        <div class="lb-tiles">${METRICS.map((m) => html`<div class="lb-tile">${icon(m.icon)}<b>${value(m, me)}</b><span>${t(`f.lb.short.${m.key}`)}</span></div>`)}</div>
      </section>

      <p class="lb-list-head"><span>${t('f.lb.rep')}</span><span>${t('f.lb.short.preSeasonPct')}</span></p>
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

      <details class="card lb-defs">
        <summary class="collapse-head"><span class="card-title">${icon('info')}<span>${t('f.lb.defs')}</span></span>${icon('chevron', 'collapse-chev')}</summary>
        <div class="collapse-body">
          ${['preSeasonPct', ...METRICS.map((m) => m.key)].map((k) => html`<details class="def"><summary>${t(`f.lb.short.${k}`)}${icon('chevron', 'collapse-chev')}</summary><p>${t(`f.lb.def.${k}`)}</p></details>`)}
        </div>
      </details>
    </div>`);
}
