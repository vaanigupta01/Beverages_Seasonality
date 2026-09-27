// Shared UI pieces: a safe HTML template tag, icons, and the components every screen uses
// (app bar, badges, pills, empty states, feature slots, bottom sheet, toast).

import { t, label, lang, LANGS } from './i18n.js';

// ---- safe templating ------------------------------------------------------
class Html {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESC[c]);
export const raw = (s) => new Html(String(s));

// Booleans render as nothing (so `${cond && x}` is safe); wrap in String() for attribute values.
function part(v) {
  if (v == null || v === false || v === true) return '';
  if (v instanceof Html) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
}

/** html`<p>${value}</p>` escapes values unless they are html`` or raw(). */
export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += part(v) + strings[i + 1]; });
  return new Html(out);
}

export const mount = (el, tpl) => { el.innerHTML = String(tpl); };

/** Clears the screen container and returns a fresh view element (listeners die with it). */
export function fresh(root) {
  root.replaceChildren();
  const view = document.createElement('div');
  view.className = 'view';
  root.append(view);
  return view;
}

// ---- icons (always paired with a text label on screen) ----------------------
const ICONS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3.8l9.2 16.2H2.8z"/><path d="M12 10v4.5M12 17.3v.2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.2"/>',
  tag: '<path d="M3.5 12.3V4.5h7.8l9.2 9.2-7.8 7.8z"/><circle cx="8" cy="9" r="1.4"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  cooler: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M6 9h12M9 5.6v1.3M9 11.6v4"/>',
  note: '<path d="M6 3.5h8.5L18 7v13.5H6z"/><path d="M9 11h6M9 14.5h6M9 18h3.5"/>',
  store: '<path d="M4.5 9.5L6 4h12l1.5 5.5"/><path d="M4.5 9.5h15v1.6a2.5 2.5 0 01-5 0 2.5 2.5 0 01-5 0 2.5 2.5 0 01-5 0z"/><path d="M6 13v7.5h12V13"/>',
  route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3.5 3.5 0 000-7H9a3.5 3.5 0 010-7h6.8"/>',
  wallet: '<rect x="3.5" y="6" width="17" height="13" rx="2"/><path d="M3.5 10h17M15.5 14.5h2"/>',
  history: '<path d="M4 12a8 8 0 102.3-5.6"/><path d="M4 4v4h4M12 8v4.5l3 2"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 102.2-5.3L4.5 9"/><path d="M4.5 4.5V9H9"/>',
  box: '<path d="M3.5 8L12 3.5 20.5 8v8.5L12 21l-8.5-4.5z"/><path d="M3.5 8L12 12.5 20.5 8M12 12.5V21"/>',
  truck: '<path d="M3 6h11v10H3zM14 9.5h4l3 3.5V16h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  calendarX: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M10 13.5l4 4M14 13.5l-4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
  map: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  chat: '<path d="M4.5 5.5h15v10h-8l-4.5 3.5v-3.5h-2.5z"/><path d="M8.5 9.5h7M8.5 12.5h4.5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.3 3.5 8.5S14.4 18.1 12 20.5C9.6 18.1 8.5 15.2 8.5 12S9.6 5.9 12 3.5z"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5L11 13M17 13.5v5a1 1 0 01-1 1H6a1 1 0 01-1-1v-10a1 1 0 011-1h5"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4.5-2 1.5a11 11 0 005.5 5.5l1.5-2 4.5 1.5v3a2 2 0 01-2 2A16.5 16.5 0 014.5 5.5a2 2 0 012-2z"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  trophy: '<path d="M8 4.5h8v5a4 4 0 01-8 0z"/><path d="M8 6H5a3 3 0 003 3.5M16 6h3a3 3 0 01-3 3.5M12 13.5v3.5M8.5 20.5h7M9.5 17h5v3.5h-5z"/>',
  flag: '<path d="M6 21V4.5M6 5h11l-2 4 2 4H6"/>',
  spark: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  trend: '<path d="M3.5 17l6-6 4 4 7-7.5"/><path d="M15 7.5h5.5V13"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
};

export const icon = (name, cls = '') =>
  raw(`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ''}</svg>`);

// ---- components -----------------------------------------------------------

/** Top bar: optional back link, title (+ subtitle), an optional action, and the language button. */
export function appBar({ title, sub = '', back = null, action = null, heading = true }) {
  const titleTag = heading ? raw('h1') : raw('p');
  return html`<header class="app-bar">
    ${back ? html`<a class="app-bar-back" href="${back}">${icon('back')}<span>${t('common.back')}</span></a>` : ''}
    <div class="app-bar-titles ${back ? '' : 'is-flush'}">
      <${titleTag} class="app-bar-title">${title}</${titleTag}>
      ${sub ? html`<p class="app-bar-sub">${sub}</p>` : ''}
    </div>
    ${action ?? ''}
    ${langButton()}
  </header>`;
}

/** Opens the language sheet (handled in main.js). Shows the current language's short name. */
export function langButton() {
  const current = LANGS.find((l) => l.code === lang());
  return html`<button type="button" class="lang-btn" data-lang-open aria-label="${t('common.language')}: ${current.label}">${icon('globe')}<span>${current.short}</span></button>`;
}

/** English · मराठी · हिंदी as a segmented control (Login). */
export function langSwitch() {
  return html`<div class="lang-seg" role="group" aria-label="${t('common.language')}">
    ${LANGS.map((l) => html`<button type="button" class="lang-seg-btn" data-lang="${l.code}" aria-pressed="${String(l.code === lang())}">${l.label}</button>`)}
  </div>`;
}

/** Pill with a tone: info · caution · neutral · ok · thin · warn. Colour is never alone: text (and often an icon) too. */
export const pill = (text, tone = 'neutral', iconName = null) =>
  html`<span class="pill pill-${tone}">${iconName ? icon(iconName) : ''}<span>${text}</span></span>`;

export const tierBadge = (outlet, { visits = false } = {}) =>
  html`<span class="pill pill-tier" data-tier="${outlet.tier}"><span class="tier-gem" aria-hidden="true"></span><span>${label('tier', outlet.tier)}${visits && outlet.visitsPerMonth ? ` · ${t('n.visitsMonth', { n: outlet.visitsPerMonth })}` : ''}</span></span>`;

/** Muted demo aid so the panel can pick outlets on purpose. */
export function personaTag(outlet) {
  const p = outlet.persona;
  if (!p) return '';
  return html`<span class="persona-tag" title="${t('persona.tip')}">${t('persona.tag', { no: String(p.no).padStart(2, '0'), label: String(p.label).replace(/^The /, '') })}</span>`;
}

/**
 * A scheme's status for an outlet, from schemes.statusFor(). Each state looks different:
 * Enrolled = solid green (already receiving it) · Applicable = blue tag (can be used) ·
 * used up this month = grey · not applicable = dashed, with the reason.
 */
export function schemePill(st) {
  switch (st.kind) {
    case 'enrolled': return html`<span class="pill pill-enrolled">${icon('check')}<span>${t('scheme.enrolled')}</span></span>`;
    case 'applicable': return html`<span class="pill pill-applicable">${icon('tag')}<span>${t('scheme.applicable')}</span></span>`;
    case 'used': return html`<span class="pill pill-used"><span>${t('scheme.usedUp', { used: st.used, cap: st.cap })}</span></span>`;
    default: return html`<span class="pill pill-off"><span>${st.reason}</span></span>`;
  }
}

export const emptyState = ({ icon: name = 'box', title, body = '', action = null, compact = false }) =>
  html`<div class="empty ${compact ? 'is-compact' : ''}">
    <span class="empty-icon">${icon(name)}</span>
    <p class="empty-title">${title}</p>
    ${body ? html`<p class="empty-body">${body}</p>` : ''}
    ${action ?? ''}
  </div>`;

/**
 * A place for the feature. Empty and hidden until feature code fills it on 'screen:rendered'.
 * Names: landing-top, route-badge, outlet-brief, booking-live, sku-hint, review-check.
 */
export function slot(name, { tag = 'section', attrs = {} } = {}) {
  const extra = Object.entries(attrs).map(([k, v]) => ` ${esc(k)}="${esc(v)}"`).join('');
  return raw(`<!-- FEATURE SLOT: ${esc(name)} --><${tag} class="slot" data-slot="${esc(name)}"${extra} hidden></${tag}>`);
}

// ---- bottom sheet (in-app confirmations, never browser pop-ups) -------------
let closeActive = null;

/**
 * openSheet({ title, body, actions: [{ key, label, tone }], dismissKey, onOpen(sheetEl) }) → Promise<key>
 * onOpen runs once the sheet is in the page (e.g. to focus a text box or wire a voice button).
 * Backdrop tap and Escape resolve with `dismissKey`. A route change resolves with 'route-change'.
 */
export function openSheet({ title, body, actions, dismissKey = null, onOpen = null }) {
  closeSheets();
  return new Promise((resolve) => {
    const prevFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = String(html`<div class="sheet-backdrop" data-dismiss></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <span class="sheet-handle" aria-hidden="true"></span>
        <h2 class="sheet-title" id="sheet-title">${title}</h2>
        <div class="sheet-body">${body}</div>
        <div class="sheet-actions">${actions.map((a) => html`<button type="button" class="btn btn-block btn-${a.tone ?? 'secondary'}" data-key="${a.key}">${a.label}</button>`)}</div>
      </div>`);

    const buttons = () => [...wrap.querySelectorAll('button')];
    const onKey = (e) => {
      if (e.key === 'Escape') close(dismissKey);
      if (e.key === 'Tab') {
        const list = buttons();
        const i = list.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i + 1) % list.length;
        list[next]?.focus();
        e.preventDefault();
      }
    };
    function close(key) {
      if (closeActive !== close) return;
      closeActive = null;
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('has-sheet');
      wrap.classList.add('is-leaving');
      setTimeout(() => wrap.remove(), 160);
      if (key !== 'route-change') prevFocus?.focus?.({ preventScroll: true });
      resolve(key);
    }
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-key]');
      if (btn) close(btn.dataset.key);
      else if (e.target.closest('[data-dismiss]')) close(dismissKey);
    });

    closeActive = close;
    document.addEventListener('keydown', onKey);
    document.body.append(wrap);
    document.body.classList.add('has-sheet');
    if (onOpen) onOpen(wrap.querySelector('.sheet'));
    else requestAnimationFrame(() => buttons()[0]?.focus());
  });
}

export function closeSheets() {
  closeActive?.('route-change');
}

// ---- toast ----------------------------------------------------------------
let toastTimer = null;

export function toast(message, iconName = 'check') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.innerHTML = String(html`${icon(iconName)}<span>${message}</span>`);
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('is-in'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('is-in');
    toastTimer = setTimeout(() => { el.hidden = true; }, 220);
  }, 3200);
}
