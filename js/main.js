// Boot, hash router, demo bar, language and "Reset demo".
// Routes: #/login · #/home · #/outlets · #/outlet/OUT-01 · #/book/OUT-01 · #/review/OUT-01
//         #/saved/DEMO-01-1 · #/scheme/SCH-SS26/OUT-01 · #/leaderboard

import { app, session, nav, router } from './app.js';
import * as data from './data.js';
import { cart } from './cart.js';
import * as orders from './orders.js';
import * as schemes from './schemes.js';
import * as fmt from './format.js';
import * as i18n from './i18n.js';
import { html, mount, icon, openSheet, closeSheets, toast } from './ui.js';

import * as login from './screens/login.js';
import * as home from './screens/home.js';
import * as outlets from './screens/outlets.js';
import * as outlet from './screens/outlet.js';
import * as book from './screens/book.js';
import * as review from './screens/review.js';
import * as saved from './screens/saved.js';
import * as scheme from './screens/scheme.js';
import * as leaderboard from './screens/leaderboard.js';
import * as talkingPoints from './feature/talking-points.js';
import * as landing from './feature/landing.js';
import * as store from './feature/store.js';

const { t, label } = i18n;
const SCREENS = { login, home, outlets, outlet, book, review, saved, scheme, leaderboard };
const screenEl = document.getElementById('screen');
let cleanup = null;

function parseHash() {
  const [name = '', id = null, sub = null] = router.current().replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return { name, id, sub };
}

function redirect(hash) {
  router.go(hash, { replace: true });
}

function renderRoute() {
  const { name, id, sub } = parseHash();
  const signedIn = Boolean(session.user());
  if (!signedIn && name !== 'login') return redirect('#/login');
  if (signedIn && (name === 'login' || !SCREENS[name])) return redirect('#/home');

  closeSheets();
  if (typeof cleanup === 'function') {
    try { cleanup(); } catch (err) { console.error(err); }
  }
  if (name === 'home' || name === 'outlets') nav.hub = `#/${name}`;

  screenEl.dataset.screen = name;
  cleanup = SCREENS[name].render(screenEl, { id, sub }) ?? null;
  window.scrollTo(0, 0);
  screenEl.focus({ preventScroll: true });
  const outletId = name === 'scheme' ? sub : name === 'saved' ? null : id;
  app.emit('screen:rendered', { screen: name, outletId, root: screenEl });
}

function renderDemoBar() {
  const bar = document.getElementById('demo-bar');
  const cfg = data.config();
  mount(bar, html`
    <p class="demo-bar-text">
      <span class="demo-bar-tag">${t('demo.tag')}</span>
      <span class="demo-bar-date">${fmt.date(cfg.demoDate)}</span>
      <span class="demo-bar-region">· ${label('region', cfg.region.name)}</span>
      ${data.isStub() ? html`<span class="demo-bar-stub" title="data/ still holds the stub dataset">${t('demo.stub')}</span>` : ''}
    </p>
    <button type="button" class="demo-bar-reset" data-reset>${t('demo.reset')}</button>`);
  bar.hidden = false;
  bar.querySelector('[data-reset]').addEventListener('click', confirmReset);
}

async function confirmReset() {
  const n = orders.demoOrders().length;
  const key = await openSheet({
    title: t('demo.resetTitle'),
    body: html`<p>${n ? t('demo.resetBody', { orders: t('n.order', { n }) }) : t('demo.resetBodyNone')}</p>
      <p class="muted">${t('demo.resetNote')}</p>`,
    actions: [
      { key: 'reset', label: t('demo.reset'), tone: 'danger' },
      { key: 'cancel', label: t('common.cancel'), tone: 'secondary' },
    ],
    dismissKey: 'cancel',
  });
  if (key !== 'reset') return;
  orders.resetDemo();
  store.reset();          // clock sessions, notes, issues, seen alerts
  cart.clear();
  session.signOut();
  redirect('#/login');
  toast(t('demo.resetDone'));
}

async function chooseLanguage() {
  const key = await openSheet({
    title: t('common.chooseLanguage'),
    body: '',
    actions: i18n.LANGS.map((l) => ({ key: l.code, label: l.code === i18n.lang() ? `✓ ${l.label}` : l.label, tone: l.code === i18n.lang() ? 'primary' : 'secondary' })),
    dismissKey: null,
  });
  if (key) i18n.setLang(key);
}

function renderFatal(err) {
  mount(screenEl, html`<div class="view"><div class="page fatal">
    <div class="card">
      <p class="fatal-icon">${icon('alert')}</p>
      <h1 class="display">${t(data.SERVED ? 'fatal.served' : 'fatal.local')}</h1>
      ${err ? html`<p><code>${err.message ?? String(err)}</code></p>` : ''}
      <p>${t(data.SERVED ? 'fatal.servedHelp' : 'fatal.localHelp')}</p>
    </div>
  </div></div>`);
}

async function boot() {
  i18n.applyLang();
  // Opened without a server, only the single-file build works: it carries the data inside.
  if (!data.SERVED && !data.hasEmbedded()) return renderFatal();
  try {
    await data.loadData();
  } catch (err) {
    console.error(err);
    return renderFatal(err);
  }
  renderDemoBar();

  // Every cart change is logged, so the subscribe hook can be checked in the console.
  cart.subscribe(({ type, sku, cases, cart: c }) =>
    console.log(`[cart] ${type}${sku ? ` ${sku} → ${cases}` : ''} · ${c.totalCases} cases · ${c.outletId ?? 'no outlet'}`));

  // Language: the app-bar button opens a sheet; the Login screen has a segmented control.
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-lang-open]')) chooseLanguage();
    const pick = e.target.closest('[data-lang]');
    if (pick) i18n.setLang(pick.dataset.lang);
  });
  app.on('lang:changed', () => {
    renderDemoBar();
    renderRoute();
  });

  talkingPoints.install();
  landing.install();

  // Handles for feature code and the console.
  window.gtApp = { app, router, cart, data, orders, schemes, fmt, i18n, talkingPoints };

  router.start(renderRoute);
  if (!location.hash) redirect(session.user() ? '#/home' : '#/login');
  else renderRoute();
}

boot();
