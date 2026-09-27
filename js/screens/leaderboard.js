// Rep leaderboard: where the rep stands in the district this pre-season, on several
// execution metrics rather than raw cases (portfolios differ). Ranked by pre-season
// placement %, the priority target; no composite score is claimed.
// The rep's own row is computed live (feature/metrics.js); the other reps are synthetic.

import { session } from '../app.js';
import * as data from '../data.js';
import * as fmt from '../format.js';
import { t } from '../i18n.js';
import { html, mount, fresh, icon, appBar } from '../ui.js';
import * as metrics from '../feature/metrics.js';

const COLUMNS = [
  { key: 'productiveCallsPct', pct: true },
  { key: 'activeOutletsPct', pct: true },
  { key: 'focusCoveragePct', pct: true },
  { key: 'monthTargetPct', pct: true },
  { key: 'casesOrdered', pct: false },
];
const NEARBY = 2;   // reps shown above and below the signed-in rep

export function render(root) {
  const view = fresh(root);
  const { rows, me, total, lb } = metrics.leaderboard(session.name());
  const i = rows.indexOf(me);
  const shown = rows.filter((r, k) => k < 3 || Math.abs(k - i) <= NEARBY);
  const ahead = rows[i - 1];
  const gap = ahead ? ahead.preSeasonPct - me.preSeasonPct : 0;
  const best = Object.fromEntries(COLUMNS.map((c) => [c.key, Math.max(...rows.map((r) => r[c.key]))]));

  mount(view, html`
    ${appBar({ title: t('f.lb.title'), sub: `${lb.district} · ${fmt.dateRange(lb.period.from, lb.period.to, data.demoDate())}`, back: '#/home' })}
    <div class="page">
      <section class="card lb-hero">
        <p class="eyebrow">${t('f.lb.yourPlace')}</p>
        <p class="lb-rank"><span class="num">#${me.rank}</span> <span class="muted">${t('f.lb.of', { n: total })}</span></p>
        <p class="lb-lede">${ahead ? t('f.lb.gap', { gap, name: ahead.name }) : t('f.lb.top')}</p>
      </section>

      <h2 class="section-title">${icon('trophy')}<span>${t('f.lb.ranked')}</span></h2>
      <ol class="list lb-list">
        ${shown.map((r, k) => html`${k > 0 && r.rank - shown[k - 1].rank > 1 ? html`<li class="lb-gap" aria-hidden="true">···</li>` : ''}
        <li class="lb-row ${r.isMe ? 'is-me' : ''}">
          <span class="lb-pos">${r.rank}</span>
          <span class="lb-main">
            <span class="lb-name">${r.isMe ? t('f.lb.you', { name: r.name }) : r.name}</span>
            <span class="lb-terr">${r.territory} · ${t('f.lb.outlets', { n: r.outlets })}</span>
            <span class="lb-metrics">${COLUMNS.map((c) => html`<span class="${r[c.key] === best[c.key] ? 'is-best' : ''}">${t(`f.lb.short.${c.key}`)} <b>${c.pct ? `${r[c.key]}%` : fmt.num(r[c.key])}</b></span>`)}</span>
          </span>
          <span class="lb-score"><span class="num">${r.preSeasonPct}%</span><span class="lb-score-l">${t('f.lb.short.preSeasonPct')}</span></span>
        </li>`)}
      </ol>

      <section class="card">
        <h2 class="card-title">${icon('info')}<span>${t('f.lb.defs')}</span></h2>
        <dl class="defs">
          ${['preSeasonPct', ...COLUMNS.map((c) => c.key)].map((k) => html`<div><dt>${t(`f.lb.short.${k}`)}</dt><dd>${lb.definitions[k]}</dd></div>`)}
        </dl>
        <p class="fine">${t('f.lb.note')}</p>
      </section>
    </div>`);
}
