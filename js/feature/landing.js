// Landing additions: clock in/out, scheme and stock alerts, pre-season placement progress
// (the priority target around the season), the rep's leaderboard position and a next step.
// Fills the `landing-clock` and `landing-top` slots. Everything is computed from the data,
// the demo orders and what the rep recorded in this browser.

import { app, session } from '../app.js';
import * as data from '../data.js';
import * as schemes from '../schemes.js';
import * as fmt from '../format.js';
import { t, label } from '../i18n.js';
import { html, mount, icon, openSheet, toast } from '../ui.js';
import * as store from './store.js';
import * as metrics from './metrics.js';

const NEW_SCHEME_DAYS = 30;   // a scheme is "new" for 30 days after it starts
const SOON_DAYS = 7;          // …and announced 7 days before it starts
const MAX_ALERTS = 2;         // never more than two banners at once

export function install() {
  app.on('screen:rendered', ({ screen, root }) => {
    if (screen !== 'home') return;
    fillClock(root);
    fillTop(root);
  });
}

// ---- clock in / out ----------------------------------------------------------

const hm = (mins) => (mins >= 60 ? t('f.clock.hm', { h: Math.floor(mins / 60), m: mins % 60 }) : t('f.clock.m', { m: mins }));

function fillClock(root) {
  const slot = root.querySelector('[data-slot="landing-clock"]');
  if (!slot) return;
  const draw = () => {
    const st = store.clockState();
    const mins = store.dutyMinutes();
    if (st.state === 'in') {
      mount(slot, html`<div class="clock is-in">
        <span class="clock-dot" aria-hidden="true"></span>
        <p class="clock-text"><strong>${t('f.clock.on')}</strong> · ${t('f.clock.since', { time: st.open.inTime, dur: hm(mins) })}</p>
        <button type="button" class="btn btn-secondary btn-compact" data-clock="out">${icon('clock')}<span>${t('f.clock.out')}</span></button>
      </div>`);
    } else if (st.state === 'closed') {
      const first = st.sessions[0]; const last = st.sessions.at(-1);
      mount(slot, html`<div class="clock is-closed">
        ${icon('check')}
        <p class="clock-text">${t('f.clock.closed', { from: first.inTime, to: last.outTime, dur: hm(mins) })}</p>
        <button type="button" class="btn btn-ghost btn-compact" data-clock="in">${t('f.clock.again')}</button>
      </div>`);
    } else {
      mount(slot, html`<div class="clock is-out">
        <p class="clock-text">${t('f.clock.notYet')}</p>
        <button type="button" class="btn btn-success btn-compact" data-clock="in">${icon('clock')}<span>${t('f.clock.in')}</span></button>
      </div>`);
    }
    slot.hidden = false;
  };
  draw();
  slot.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-clock]');
    if (!btn) return;
    if (btn.dataset.clock === 'in') { store.clockIn(); toast(t('f.clock.inToast', { time: store.timeNow() })); }
    else { store.clockOut(); toast(t('f.clock.outToast', { dur: hm(store.dutyMinutes()) }), 'clock'); }
    draw();
  });
}

// ---- alerts ------------------------------------------------------------------

/** Schemes that started in the last 30 days or start within 7. */
function schemeAlerts(today) {
  return data.schemes()
    .filter((s) => s.type !== 'program' && s.validFrom && s.validTo >= today)
    .filter((s) => fmt.daysBetween(s.validFrom, today) <= NEW_SCHEME_DAYS && fmt.daysBetween(today, s.validFrom) <= SOON_DAYS)
    .map((s) => ({
      id: `scheme:${s.id}`, kind: 'scheme', tone: 'info', icon: 'tag', scheme: s,
      title: s.validFrom > today
        ? t('f.alert.schemeSoon', { name: s.name, date: fmt.shortDate(s.validFrom) })
        : t('f.alert.schemeNew', { name: s.name, date: fmt.shortDate(s.validFrom) }),
      sub: schemes.chipText(s),
    }));
}

const statusRank = { 'out-of-stock': 0, rationed: 1, 'rationed-against-empties': 1, low: 2, available: 3 };

/** Only real changes since yesterday's sync: a ration raised or cut, a SKU going out, low or back. */
function stockAlerts() {
  const f = data.field();
  const before = new Map((f.stockYesterday?.items ?? []).map((x) => [x.sku, x]));
  const out = [];
  for (const now of data.stock().items) {
    const st = now.sourceStatus ?? 'available';
    const prev = before.get(now.sku);
    const prevSt = prev?.status ?? 'available';
    const name = data.product(now.sku)?.name ?? now.sku;
    let title = null; let tone = 'warn';
    if (st === prevSt && st === 'rationed' && prev.rationPerOutletCases !== now.maxCasesPerOutlet) {
      const up = now.maxCasesPerOutlet > prev.rationPerOutletCases;
      title = t(up ? 'f.alert.rationUp' : 'f.alert.rationDown', { name, n: now.maxCasesPerOutlet });
      tone = up ? 'ok' : 'warn';
    } else if (st !== prevSt) {
      const better = statusRank[st] > statusRank[prevSt];
      title = t(`f.alert.stock.${st}`, { name });
      tone = better ? 'ok' : 'warn';
    }
    if (title) out.push({ id: `stock:${now.sku}:${st}:${now.maxCasesPerOutlet ?? ''}`, kind: 'stock', tone, icon: 'box', item: now, title, sub: now.note });
  }
  return out;
}

async function openAlert(a) {
  store.markSeen(a.id);
  if (a.kind === 'scheme') {
    const s = a.scheme;
    const r = s.rule ?? {};
    const threshold = s.type === 'free-goods' ? t('f.sch.thrFree', { n: r.buyCases, pooled: r.pooled && s.skus.length > 1 ? t('f.sch.pooled') : '' })
      : s.type === 'percent-off' ? t('f.sch.thrPct', { n: r.minCases }) : t('f.sch.thrFirst', { days: r.withinDaysOfRegistration });
    const benefit = s.type === 'free-goods' ? t('f.sch.benFree', { n: r.freeCases }) : t('f.sch.benPct', { pct: r.percent });
    const tiers = Array.isArray(s.eligibleTiers) ? s.eligibleTiers.map((x) => label('tier', x)).join(', ') : t('f.sch.allTiers');
    await openSheet({
      title: s.name,
      body: html`<p class="sheet-lede">${schemes.offerText(s)}</p>
        <dl class="kv sheet-kv">
          <div><dt>${t('f.sch.skus')}</dt><dd>${Array.isArray(s.skus) ? schemes.listNames(s.skus) : t('f.sch.allSkus')}</dd></div>
          <div><dt>${t('f.sch.threshold')}</dt><dd>${threshold}</dd></div>
          <div><dt>${t('f.sch.benefit')}</dt><dd>${benefit}</dd></div>
          <div><dt>${t('f.sch.valid')}</dt><dd>${fmt.dateRange(s.validFrom, s.validTo, data.demoDate())}</dd></div>
          <div><dt>${t('f.sch.tiers')}</dt><dd>${tiers}${s.requiresBottlerCooler ? ` · ${t('f.sch.cooler')}` : ''}</dd></div>
        </dl>
        <div class="say-box"><p class="say-label">${icon('chat')}<span>${t('f.sch.say')}</span></p>
          <p>${t('f.sch.sayText', { offer: schemes.offerText(s) })}</p></div>
        <p class="fine">${icon('info')} ${t('f.sch.informational', { who: s.payout ?? t('f.sch.distributor') })}</p>`,
      actions: [{ key: 'close', label: t('common.close'), tone: 'secondary' }],
      dismissKey: 'close',
    });
  } else {
    const it = a.item;
    const p = data.product(it.sku);
    await openSheet({
      title: p?.name ?? it.sku,
      body: html`<p class="sheet-lede">${a.title}</p>
        <dl class="kv sheet-kv">
          <div><dt>${t('f.stock.status')}</dt><dd>${t(`f.stock.s.${it.sourceStatus ?? 'available'}`)}</dd></div>
          ${it.maxCasesPerOutlet ? html`<div><dt>${t('f.stock.ration')}</dt><dd>${t('f.stock.perOutlet', { n: it.maxCasesPerOutlet })}</dd></div>` : ''}
          ${it.note ? html`<div><dt>${t('f.stock.note')}</dt><dd>${it.note}</dd></div>` : ''}
        </dl>
        <p class="fine">${t('f.stock.sync', { time: String(data.stock().syncedAt ?? '').slice(11, 16) })}</p>`,
      actions: [{ key: 'close', label: t('common.close'), tone: 'secondary' }],
      dismissKey: 'close',
    });
  }
}

// ---- landing-top ---------------------------------------------------------------

function fillTop(root) {
  const slot = root.querySelector('[data-slot="landing-top"]');
  if (!slot) return;
  const today = data.demoDate();
  const alerts = [...stockAlerts(), ...schemeAlerts(today)].filter((a) => !store.seen(a.id)).slice(0, MAX_ALERTS);
  const pre = metrics.preSeason();
  const mon = metrics.month();
  const day = metrics.today();
  const board = metrics.leaderboard(session.name());
  const milestone = Math.floor(pre.pct / 10) * 10;

  mount(slot, html`
    ${alerts.length ? html`<div class="alerts">${alerts.map((a, i) => html`<button type="button" class="alert tone-${a.tone}" data-alert="${i}">
      <span class="alert-icon">${icon(a.icon)}</span>
      <span class="alert-text"><span class="alert-title">${a.title}</span>${a.sub ? html`<span class="alert-sub">${a.sub}</span>` : ''}</span>
      ${icon('chevron', 'alert-chev')}
    </button>`)}</div>` : ''}

    <section class="card target" aria-labelledby="target-title">
      <div class="target-head">
        <div>
          <p class="eyebrow">${t('f.target.eyebrow')}</p>
          <h2 class="target-title" id="target-title">${pre.label}</h2>
        </div>
        <p class="target-pct"><span class="num">${pre.pct}%</span></p>
      </div>
      <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, pre.pct)}" aria-label="${pre.label}">
        <span class="meter-fill" style="width:${Math.min(100, pre.pct)}%"></span>
      </div>
      <dl class="target-stats">
        <div><dt>${t('f.target.achieved')}</dt><dd>${fmt.num(pre.achieved)}</dd></div>
        <div><dt>${t('f.target.target')}</dt><dd>${fmt.num(pre.target)}</dd></div>
        <div><dt>${t('f.target.remaining')}</dt><dd>${fmt.num(pre.remaining)}</dd></div>
        <div><dt>${t('f.target.daysLeft')}</dt><dd>${fmt.num(pre.daysLeft)}</dd></div>
      </dl>
      <p class="target-note">${pre.remaining
        ? t('f.target.pace', { n: fmt.num(pre.perDay), date: fmt.shortDate(pre.to) })
        : t('f.target.done')}</p>
      <p class="fine">${t('f.target.measure', { measure: pre.measure, skus: pre.skus.map((s) => data.product(s)?.name ?? s).join(', '), basis: pre.basis })}</p>
      <div class="target-secondary">
        <span>${mon.label}</span><span class="num">${fmt.num(mon.achieved)} / ${fmt.num(mon.target)} · ${mon.pct}%</span>
      </div>
      <a class="rank-row" href="#/leaderboard">
        <span class="rank-badge">${icon('trophy')}<span>#${board.rank}</span></span>
        <span class="rank-text">${t('f.rank.line', { rank: board.rank, total: board.total, district: board.lb.district })}</span>
        ${icon('chevron', 'row-chev')}
      </a>
    </section>

    <section class="assist" aria-label="${t('f.assist.label')}">
      <span class="assist-mark">${icon('spark')}</span>
      <div class="assist-text">
        ${day.visited ? html`<p><strong>${t('f.assist.progress', { n: day.visited, total: day.routeCount, focus: day.withFocus })}</strong>${milestone >= 50 && pre.pct < 100 ? ` ${t('f.assist.milestone', { pct: milestone })}` : ''}</p>` : ''}
        ${day.next
          ? html`<p>${t('f.assist.next', { name: day.next.name, stop: data.visits(day.next.id)?.routeOrder ?? '' })}</p>
            <a class="assist-link" href="#/outlet/${day.next.id}">${t('f.assist.open')} ${icon('chevron')}</a>`
          : html`<p>${t('f.assist.allDone')}</p>`}
      </div>
    </section>`);
  slot.hidden = false;

  slot.querySelectorAll('[data-alert]').forEach((btn) => btn.addEventListener('click', async () => {
    await openAlert(alerts[Number(btn.dataset.alert)]);
    btn.remove();
  }));
}

