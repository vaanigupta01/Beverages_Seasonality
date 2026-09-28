// Landing additions, filled into home.js's slots:
//   landing-hero  clock in/out, rank chip and the summer target, inside the branded header
//   landing-top   alert banners (new schemes, distributor stock changes), sent as push notifications
//   landing-next  the next outlet on the route, and today's small wins
// Everything is computed from the data, the demo orders and what the rep recorded in this browser.

import { app, session } from '../app.js';
import * as data from '../data.js';
import * as schemes from '../schemes.js';
import * as fmt from '../format.js';
import { t, label } from '../i18n.js';
import { html, mount, icon, openSheet, toast } from '../ui.js';
import * as store from './store.js';
import * as metrics from './metrics.js';
import { quickActions } from './outlet-tools.js';

const NEW_SCHEME_DAYS = 30;   // a scheme is "new" for 30 days after it starts
const SOON_DAYS = 7;          // …and announced 7 days before it starts
const MAX_ALERTS = 3;         // never more than three banners at once
const PUSH_KEY = 'gtapp.pushed.v1';   // push notifications go out once per sign-in (sessionStorage)

export function install() {
  app.on('screen:rendered', ({ screen, root }) => {
    if (screen !== 'home') return;
    fillHero(root);
    const alerts = fillAlerts(root);
    fillNext(root);
    pushAlerts(alerts);
  });
}

const hm = (mins) => (mins >= 60 ? t('f.clock.hm', { h: Math.floor(mins / 60), m: mins % 60 }) : t('f.clock.m', { m: mins }));

// ---- header: clock, rank, summer target -------------------------------------------------------

function fillHero(root) {
  const slot = root.querySelector('[data-slot="landing-hero"]');
  if (!slot) return;
  const draw = () => {
    const st = store.clockState();
    const mins = store.dutyMinutes();
    const board = metrics.leaderboard(session.name());
    const pre = metrics.preSeason();
    const gain = metrics.targetToday();
    const mon = metrics.month();
    const clock = st.state === 'in'
      ? html`<button type="button" class="hchip is-on" data-clock="out"><span class="live-dot"></span><span>${t('f.clock.onFor', { dur: hm(mins) })}</span><span class="hchip-act">${t('f.clock.out')}</span></button>`
      : st.state === 'closed'
        ? html`<button type="button" class="hchip is-closed" data-clock="in">${icon('check')}<span>${t('f.clock.dayDone', { dur: hm(mins) })}</span></button>`
        : html`<button type="button" class="hchip is-start" data-clock="in">${icon('clock')}<span>${t('f.clock.in')}</span></button>`;
    mount(slot, html`
      <div class="hero-chips">
        ${clock}
        <a class="hchip is-rank" href="#/leaderboard">${icon('trophy')}<span>${t('f.rank.chip', { rank: board.rank, total: board.total })}</span>${icon('chevron')}</a>
      </div>
      <details class="goal">
        <summary>
          <span class="ring" style="--p:${Math.min(100, pre.pct)}" aria-hidden="true"><span>${pre.pct}%</span></span>
          <span class="goal-main">
            <span class="goal-title">${t('f.target.title')}</span>
            <span class="goal-nums"><strong>${fmt.num(pre.achieved)}</strong> / ${fmt.num(pre.target)} ${t('f.target.cases')}</span>
            <span class="goal-meta">${gain ? html`<span class="goal-gain">${icon('trend')}+${fmt.num(gain)} ${t('f.target.today')}</span>` : ''}<span>${t('f.target.daysLeft', { n: pre.daysLeft })}</span></span>
          </span>
          ${icon('chevron', 'collapse-chev')}
        </summary>
        <div class="goal-body">
          <p class="goal-line">${icon('target')}<span>${pre.remaining ? t('f.target.pace', { n: fmt.num(pre.perDay) }) : t('f.target.done')}</span></p>
          <p class="goal-line">${icon('box')}<span>${t('f.target.counts', { skus: pre.skus.map((s) => shortName(s)).join(', ') })}</span></p>
          <p class="goal-line">${icon('calendar')}<span>${t('f.target.window', { from: fmt.shortDate(pre.from), to: fmt.shortDate(pre.to) })}</span></p>
          <div class="goal-sub"><span>${t('f.target.month')}</span><span class="num"><strong>${fmt.num(mon.achieved)}</strong> / ${fmt.num(mon.target)} · ${mon.pct}%</span></div>
        </div>
      </details>`);
    slot.hidden = false;
  };
  draw();
  slot.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-clock]');
    if (!btn) return;
    if (btn.dataset.clock === 'in') { store.clockIn(); toast(t('f.clock.inToast', { time: store.timeNow() }), 'clock'); }
    else { store.clockOut(); toast(t('f.clock.outToast', { dur: hm(store.dutyMinutes()) }), 'clock'); }
    draw();
  });
}

/** "Cola 250 ml" from "Cola 250 ml PET". */
const shortName = (sku) => String(data.product(sku)?.name ?? sku).replace(/\s+(PET|Tetra|returnable glass|can)$/i, (m) => (/glass/i.test(m) ? ' glass' : ''));

// ---- alerts ------------------------------------------------------------------------------------

function schemeAlerts(today) {
  return data.schemes()
    .filter((s) => s.type !== 'program' && s.validFrom && s.validTo >= today)
    .filter((s) => fmt.daysBetween(s.validFrom, today) <= NEW_SCHEME_DAYS && fmt.daysBetween(today, s.validFrom) <= SOON_DAYS)
    .map((s) => ({
      id: `scheme:${s.id}`, kind: 'scheme', tone: 'scheme', icon: 'tag', scheme: s,
      tag: s.validFrom > today ? t('f.alert.tagSoon') : t('f.alert.tagNew'),
      title: s.name,
      sub: `${schemes.chipText(s)} · ${s.validFrom > today ? t('f.alert.from', { date: fmt.shortDate(s.validFrom) }) : t('f.alert.till', { date: fmt.shortDate(s.validTo) })}`,
    }));
}

const statusRank = { 'out-of-stock': 0, rationed: 1, 'rationed-against-empties': 1, low: 2, available: 3 };

/** Only real changes since yesterday's sync: a ration raised or cut, a pack going out, low or back. */
function stockAlerts() {
  const before = new Map((data.field().stockYesterday?.items ?? []).map((x) => [x.sku, x]));
  const out = [];
  for (const now of data.stock().items) {
    const st = now.sourceStatus ?? 'available';
    const prev = before.get(now.sku);
    const prevSt = prev?.status ?? 'available';
    const name = data.product(now.sku)?.name ?? now.sku;
    let title = null; let up = false;
    if (st === prevSt && st === 'rationed' && prev.rationPerOutletCases !== now.maxCasesPerOutlet) {
      up = now.maxCasesPerOutlet > prev.rationPerOutletCases;
      title = t(up ? 'f.alert.rationUp' : 'f.alert.rationDown', { name, n: now.maxCasesPerOutlet });
    } else if (st !== prevSt) {
      up = statusRank[st] > statusRank[prevSt];
      title = t(`f.alert.stock.${st}`, { name });
    }
    if (title) out.push({ id: `stock:${now.sku}:${st}:${now.maxCasesPerOutlet ?? ''}`, kind: 'stock', tone: up ? 'up' : 'down', icon: 'box', item: now,
      tag: up ? t('f.alert.tagUp') : t('f.alert.tagDown'), title, sub: now.note });
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
      body: html`<div class="facts">
          <p>${icon('box')}<span><b>${t('f.sch.skus')}</b>${Array.isArray(s.skus) ? schemes.listNames(s.skus) : t('f.sch.allSkus')}</span></p>
          <p>${icon('target')}<span><b>${t('f.sch.threshold')}</b>${threshold}</span></p>
          <p>${icon('tag')}<span><b>${t('f.sch.benefit')}</b>${benefit}</span></p>
          <p>${icon('calendar')}<span><b>${t('f.sch.valid')}</b>${fmt.dateRange(s.validFrom, s.validTo, data.demoDate())}</span></p>
          <p>${icon('store')}<span><b>${t('f.sch.tiers')}</b>${tiers}${s.requiresBottlerCooler ? ` · ${t('f.sch.cooler')}` : ''}</span></p>
        </div>
        <div class="say-box"><p class="say-label">${icon('chat')}<span>${t('f.sch.say')}</span></p>
          <p>${t('f.sch.sayText', { offer: schemes.offerText(s) })}</p></div>`,
      actions: [{ key: 'close', label: t('f.common.ok'), tone: 'primary' }],
      dismissKey: 'close',
    });
  } else {
    const it = a.item;
    await openSheet({
      title: data.product(it.sku)?.name ?? it.sku,
      body: html`<div class="facts">
          <p>${icon('box')}<span><b>${t('f.stock.status')}</b>${t(`f.stock.s.${it.sourceStatus ?? 'available'}`)}</span></p>
          ${it.maxCasesPerOutlet ? html`<p>${icon('store')}<span><b>${t('f.stock.ration')}</b>${t('f.stock.perOutlet', { n: it.maxCasesPerOutlet })}</span></p>` : ''}
          ${it.note ? html`<p>${icon('info')}<span><b>${t('f.stock.note')}</b>${it.note}</span></p>` : ''}
        </div>
        <p class="fine">${t('f.stock.sync', { time: String(data.stock().syncedAt ?? '').slice(11, 16) })}</p>`,
      actions: [{ key: 'close', label: t('f.common.ok'), tone: 'primary' }],
      dismissKey: 'close',
    });
  }
}

const currentAlerts = () => [...schemeAlerts(data.demoDate()), ...stockAlerts()].filter((a) => !store.seen(a.id)).slice(0, MAX_ALERTS);

function fillAlerts(root) {
  const slot = root.querySelector('[data-slot="landing-top"]');
  if (!slot) return [];
  const alerts = currentAlerts();
  const canAsk = 'Notification' in window && Notification.permission === 'default';
  if (!alerts.length) { slot.hidden = true; return alerts; }
  mount(slot, html`<div class="alerts">
    <div class="alerts-head"><p>${icon('bell')}<span>${t('f.alert.head', { n: alerts.length })}</span></p>
      ${canAsk ? html`<button type="button" class="alerts-allow" data-allow>${t('f.alert.allow')}</button>` : ''}</div>
    ${alerts.map((a, i) => html`<button type="button" class="alert tone-${a.tone}" data-alert="${i}">
      <span class="alert-icon">${icon(a.icon)}</span>
      <span class="alert-text"><span class="alert-tag">${a.tag}</span><span class="alert-title">${a.title}</span>${a.sub ? html`<span class="alert-sub">${a.sub}</span>` : ''}</span>
      <span class="alert-go">${t('f.alert.view')}</span>
    </button>`)}</div>`);
  slot.hidden = false;
  slot.querySelectorAll('[data-alert]').forEach((btn) => btn.addEventListener('click', async () => {
    await openAlert(alerts[Number(btn.dataset.alert)]);
    btn.remove();
    if (!slot.querySelector('[data-alert]')) slot.hidden = true;
  }));
  slot.querySelector('[data-allow]')?.addEventListener('click', async (e) => {
    e.currentTarget.remove();
    const res = await Notification.requestPermission().catch(() => 'denied');
    if (res === 'granted') systemNotify(alerts);
  });
  return alerts;
}

// ---- push notifications --------------------------------------------------------------------------

function systemNotify(alerts) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  alerts.forEach((a) => {
    try { new Notification(`${a.tag} · ${a.title}`, { body: a.sub ?? '', tag: a.id }); } catch { /* some browsers need a service worker */ }
  });
}

/** Once per sign-in: phone-style notifications drop in from the top, one after another, and the
 *  same alerts go to the phone's notification tray when the rep has allowed it. */
function pushAlerts(alerts) {
  let pushed = false;
  try { pushed = sessionStorage.getItem(PUSH_KEY) === '1'; sessionStorage.setItem(PUSH_KEY, '1'); } catch { /* show anyway */ }
  if (pushed || !alerts.length) return;
  systemNotify(alerts);
  alerts.forEach((a, i) => setTimeout(() => showPush(a), 600 + i * 4200));
}

function showPush(a) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `push tone-${a.tone}`;
  el.innerHTML = String(html`<span class="push-app">GT</span><span class="push-text"><span class="push-top"><b>${a.tag}</b><span>${t('f.alert.now')}</span></span><span class="push-title">${a.title}</span>${a.sub ? html`<span class="push-sub">${a.sub}</span>` : ''}</span>`);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  const close = () => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 300); };
  const timer = setTimeout(close, 3800);
  el.addEventListener('click', () => { clearTimeout(timer); close(); if (!store.seen(a.id)) openAlert(a); });
}

// ---- next outlet and today's wins ------------------------------------------------------------------

function fillNext(root) {
  const slot = root.querySelector('[data-slot="landing-next"]');
  if (!slot) return;
  const day = metrics.today();
  const wins = metrics.milestones();
  const fresh = wins.filter((w) => !store.seen(`ms:${w.id}`));
  fresh.forEach((w) => store.markSeen(`ms:${w.id}`));
  const latest = wins.at(-1);
  const n = day.next;
  mount(slot, html`
    ${latest ? html`<p class="win ${fresh.length ? 'is-new' : ''}">${icon(latest.icon)}<span>${t(latest.key, latest.vars ?? {})}</span>${wins.length > 1 ? html`<span class="win-count">+${wins.length - 1}</span>` : ''}</p>` : ''}
    ${n ? html`<section class="next">
      <p class="next-label">${t('f.next.label', { stop: data.visits(n.id)?.routeOrder ?? '' })}</p>
      <div class="next-row">
        <a class="next-main" href="#/outlet/${n.id}"><span class="next-name">${n.name}</span><span class="next-meta">${label('area', n.area)} · ${label('ch', n.channel)}</span></a>
        ${quickActions(n)}
      </div>
      <a class="btn next-go" href="#/outlet/${n.id}">${t('f.next.open')}${icon('chevron')}</a>
    </section>` : html`<p class="win is-new">${icon('check')}<span>${t('f.next.allDone')}</span></p>`}`);
  slot.hidden = false;
}
