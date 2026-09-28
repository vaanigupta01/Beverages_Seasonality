// Outlet details tools: call before the visit, add a note (typed or spoken), report a
// retailer issue, see open issues, the other rep's territory, the last order's SKUs and the
// estimated stock on hand. Notes and issues are saved in this browser (feature/store.js).

import * as data from '../data.js';
import * as fmt from '../format.js';
import { t, lang } from '../i18n.js';
import { html, icon, pill, openSheet, toast } from '../ui.js';
import * as store from './store.js';

// Dialling is off in the demo: the dataset has no phone numbers, and a made-up number
// could belong to a real person. With real numbers in outlets[].phone, set this to true.
const CALL_ENABLED = false;

// ---- territory ------------------------------------------------------------------

/** The other rep when this outlet isn't in the signed-in rep's territory, else null. */
export function otherRep(o) {
  const rep = data.repFor(o.id);
  return rep && rep.id !== data.myRepId() ? rep : null;
}

export const territoryPill = (o) => {
  const rep = otherRep(o);
  return rep ? pill(t('f.terr.pill', { name: rep.name }), 'caution', 'flag') : '';
};

/** Asks before booking at another rep's outlet → true to go ahead. */
export async function confirmCrossTerritory(o) {
  const rep = otherRep(o);
  if (!rep) return true;
  const pct = data.field().crossTerritory?.incentiveCreditPct ?? 50;
  const key = await openSheet({
    title: t('f.terr.title'),
    body: html`<p class="sheet-lede">${t('f.terr.body', { name: o.name, rep: rep.name, territory: rep.territory })}</p>
      <div class="warn-box">${icon('alert')}<p>${t('f.terr.incentive', { pct })}</p></div>`,
    actions: [
      { key: 'go', label: t('f.terr.go', { pct }), tone: 'primary' },
      { key: 'back', label: t('f.terr.back'), tone: 'secondary' },
    ],
    dismissKey: 'back',
  });
  return key === 'go';
}

// ---- quick actions (lists and the outlet profile) ---------------------------------------

/**
 * Google Maps directions to the outlet (two-wheeler, as reps ride motorbikes). Uses exact
 * coordinates when the data has outlets[].geo { lat, lng }; otherwise the address.
 */
export function directionsUrl(o) {
  const region = data.config().region ?? {};
  const address = o.area && !String(o.address ?? '').includes(o.area) ? `${o.address}, ${o.area}` : o.address;
  const destination = o.geo?.lat != null && o.geo?.lng != null
    ? `${o.geo.lat},${o.geo.lng}`
    : [address, region.city, region.state].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=two-wheeler`;
}

/** Round Call and Directions buttons for an outlet card. */
export const quickActions = (o) => html`<div class="row-acts">
  <button type="button" class="icon-btn is-call" data-call="${o.id}" aria-label="${t('f.tools.callName', { name: o.name })}">${icon('phone')}</button>
  <a class="icon-btn is-map" href="${directionsUrl(o)}" target="_blank" rel="noopener noreferrer" aria-label="${t('outlet.directionsLabel', { name: o.name })}">${icon('map')}</a>
</div>`;

/** One listener for every [data-call] button in the app. */
export function install() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-call]');
    if (!btn) return;
    e.preventDefault();
    const o = data.outlet(btn.dataset.call);
    if (o) callSheet(o, () => document.dispatchEvent(new CustomEvent('gt:notes', { detail: o.id })));
  });
}

// ---- header actions ----------------------------------------------------------------

const catsOf = (i) => i.categories ?? (i.category ? [i.category] : ['other']);

/** Open-issues capsule for the profile strip: count + the main category; opens the list. */
export function issuesBadge(o) {
  const open = store.openIssues(o.id);
  if (!open.length) return '';
  const cat = catsOf(open[0])[0];
  return html`<button type="button" class="issue-cap" data-tool="issues">
    <span class="issue-cap-n">${open.length}</span>
    <span>${t(`f.issue.cat.${cat}`)}</span>${icon('chevron')}
  </button>`;
}

/** Wires the tool buttons inside `root`. `refresh(part)` redraws 'notes' or 'issues'. */
export function wire(root, o, refresh) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-tool]');
    if (!btn) return;
    const tool = btn.dataset.tool;
    if (tool === 'call') await callSheet(o, refresh);
    if (tool === 'note' && await noteSheet(o)) refresh('notes');
    if (tool === 'mic' && await noteSheet(o, { listen: true })) refresh('notes');
    if (tool === 'issue' && await issueSheet(o)) refresh('issues');
    if (tool === 'issues') { await issuesList(o); refresh('issues'); }
  });
  // A call logged from a list card elsewhere refreshes the notes if this outlet is open.
  document.addEventListener('gt:notes', (e) => { if (e.detail === o.id) refresh('notes'); });
}

// ---- call ------------------------------------------------------------------------

/** When the rep usually checks in here, from the last visits' check-in times. */
function usualTime(o) {
  const times = (data.visits(o.id)?.visits ?? []).filter((v) => v.done && v.checkIn).slice(-6).map((v) => v.checkIn).sort();
  return times.length ? times[Math.floor(times.length / 2)] : null;
}

export async function callSheet(o, refresh) {
  const v = data.visits(o.id);
  const usual = usualTime(o);
  const owner = o.owner?.name ?? t('f.call.owner');
  const key = await openSheet({
    title: t('f.call.title', { name: o.name }),
    body: html`<p class="call-num">${icon('phone')}<span>${CALL_ENABLED && o.phone ? o.phone : t('f.call.demoNumber')}</span></p>
      <ul class="prep">
        <li>${icon('store')}<span>${t('f.call.ask', { owner })}</span></li>
        ${usual ? html`<li>${icon('clock')}<span>${t('f.call.usual', { time: usual })}</span></li>` : ''}
        ${v?.nextVisitAfterToday ? html`<li>${icon('calendar')}<span>${t('f.call.next', { date: fmt.shortDate(v.nextVisitAfterToday) })}</span></li>` : ''}
      </ul>
      <p class="fine">${t('f.call.log')}</p>`,
    actions: [
      { key: 'dial', label: CALL_ENABLED && o.phone ? t('f.call.dial') : t('f.call.dialDemo'), tone: 'success' },
      { key: 'present', label: t('f.call.present'), tone: 'secondary' },
      { key: 'closed', label: t('f.call.closed'), tone: 'secondary' },
      { key: 'later', label: t('f.call.later'), tone: 'secondary' },
    ],
    dismissKey: null,
  });
  if (key === 'dial') {
    if (CALL_ENABLED && o.phone) location.href = `tel:${o.phone.replace(/\s/g, '')}`;
    else toast(t('f.call.noNumber'), 'info');
  } else if (key && key !== 'route-change') {
    store.addNote(o.id, t(`f.call.note.${key}`), 'call');
    toast(t('f.note.saved'));
    refresh('notes');
  }
}

// ---- notes (typed or spoken) ----------------------------------------------------------

const Speech = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const SPEECH_LANG = { en: 'en-IN', mr: 'mr-IN', hi: 'hi-IN' };

async function noteSheet(o, { listen = false } = {}) {
  let via = listen ? 'voice' : 'typed';
  let rec = null;
  let box = null;
  const key = await openSheet({
    title: listen ? t('f.note.titleVoice') : t('f.note.title'),
    body: html`<textarea class="input textarea" rows="3" data-text aria-label="${t('f.note.title')}" placeholder="${t('f.note.ph')}"></textarea>
      ${Speech
        ? html`<button type="button" class="mic-btn" data-mic aria-pressed="false">${icon('mic')}<span data-mic-label>${t('f.note.speak')}</span></button>`
        : html`<p class="fine">${t('f.note.noVoice')}</p>`}`,
    actions: [
      { key: 'save', label: t('f.note.save'), tone: 'primary' },
      { key: 'cancel', label: t('common.cancel'), tone: 'secondary' },
    ],
    dismissKey: 'cancel',
    onOpen(sheet) {
      box = sheet.querySelector('[data-text]');
      const mic = sheet.querySelector('[data-mic]');
      const label = () => mic.querySelector('[data-mic-label]');
      const stop = () => { rec = null; mic.setAttribute('aria-pressed', 'false'); mic.classList.remove('is-on'); label().textContent = t('f.note.speak'); };
      const start = () => {
        rec = new Speech();
        rec.lang = SPEECH_LANG[lang()] ?? 'en-IN';
        rec.interimResults = true;
        const before = box.value ? `${box.value.trim()} ` : '';
        rec.onresult = (ev) => { box.value = before + [...ev.results].map((r) => r[0].transcript).join(' '); via = 'voice'; };
        rec.onend = stop;
        rec.onerror = (ev) => { stop(); toast(ev.error === 'not-allowed' ? t('f.note.micBlocked') : t('f.note.micFail'), 'info'); };
        try { rec.start(); } catch { stop(); return; }
        mic.setAttribute('aria-pressed', 'true'); mic.classList.add('is-on');
        label().textContent = t('f.note.listening');
      };
      if (mic) mic.addEventListener('click', () => (rec ? rec.stop() : start()));
      // The Mic button in the header starts listening straight away; Note opens the keyboard.
      if (listen && mic) start();
      else box.focus();
    },
  });
  rec?.stop();
  const text = box?.value.trim();
  if (key !== 'save' || !text) return false;
  store.addNote(o.id, text, via);
  toast(t('f.note.saved'));
  return true;
}

/** Notes recorded today (this browser) first, then the rep's notes from past visits. */
export function notesList(o, v, today) {
  const mine = store.notesFor(o.id).map((n) => ({ date: today, time: n.time, text: n.text, via: n.via, fresh: true }));
  const past = (v?.visits ?? []).filter((x) => x.note && x.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3)
    .map((x) => ({ date: x.date, text: x.note }));
  return [...mine, ...past];
}

export const notesHtml = (list) => html`<ul class="notes">${list.map((n) => html`<li class="${n.fresh ? 'is-fresh' : ''}">
  <p class="note-date">${fmt.shortDate(n.date)}${n.time ? ` · ${n.time}` : ''}${n.via === 'voice' ? html` · ${icon('mic')} ${t('f.note.voice')}` : ''}${n.via === 'call' ? html` · ${icon('phone')} ${t('f.note.call')}` : ''}</p>
  <p>${n.text}</p></li>`)}</ul>`;

// ---- issues ------------------------------------------------------------------------

/** Deterministic keyword classifier: the category with the most keyword hits, else "other".
 *  Keywords include common Hinglish / Marathi spellings reps type. */
export const ISSUE_CATEGORIES = {
  scheme: ['scheme', 'claim', 'free case', 'free cases', 'settle', 'settlement', 'credit note', 'offer', 'not received', 'incentive', 'shelf strip', 'purity', 'payout', 'scheme ka'],
  quality: ['quality', 'taste', 'flat', 'no gas', 'gas', 'fizz', 'expired', 'expiry', 'expire', 'smell', 'fungus', 'dirty', 'cloudy', 'bad', 'kharab', 'kharaab', 'kharab maal', 'kachra'],
  delay: ['late', 'delay', 'delayed', 'not delivered', 'no delivery', 'pending', 'did not come', "didn't come", 'not come', 'next day', 'waiting', 'nahi aaya', 'nahi aya', 'aala nahi', 'ushir', 'der'],
  missing: ['missing', 'short', 'less', 'damaged', 'damage', 'broken', 'crushed', 'leak', 'leaking', 'torn', 'dent', 'kam', 'toota', 'phuta', 'futla'],
  billing: ['bill', 'billing', 'invoice', 'price', 'rate', 'overcharged', 'charged', 'mrp', 'gst', 'amount', 'extra money', 'margin', 'paisa', 'paise', 'jyada', 'jast'],
};

/** Every category whose words appear in the text (at least "other"). */
export function classifyAll(text) {
  const s = ` ${String(text).toLowerCase().replace(/[^a-z0-9\u0900-\u097f' ]+/g, ' ')} `;
  const hits = Object.entries(ISSUE_CATEGORIES).filter(([, words]) => words.some((w) => s.includes(` ${w} `) || (w.includes(' ') && s.includes(w)))).map(([c]) => c);
  return hits.length ? hits : ['other'];
}

export function classifyIssue(text) {
  const s = ` ${String(text).toLowerCase().replace(/[^a-z0-9ऀ-ॿ' ]+/g, ' ')} `;
  let best = 'other'; let top = 0;
  for (const [cat, words] of Object.entries(ISSUE_CATEGORIES)) {
    const hits = words.reduce((n, w) => n + (s.includes(` ${w} `) || (w.includes(' ') && s.includes(w)) ? 1 : 0), 0);
    if (hits > top) { best = cat; top = hits; }
  }
  return best;
}

const CATS = [...Object.keys(ISSUE_CATEGORIES), 'other'];

const CAT_ICON = { scheme: 'tag', quality: 'alert', delay: 'truck', missing: 'box', billing: 'wallet', other: 'info' };

async function issueSheet(o) {
  let box = null;
  let picked = new Set();        // categories the rep tapped (several allowed)
  let touched = false;           // once the rep taps, the auto-guess stops changing the choice
  const key = await openSheet({
    title: t('f.issue.title'),
    body: html`<textarea class="input textarea" rows="3" data-text aria-label="${t('f.issue.title')}" placeholder="${t('f.issue.ph')}"></textarea>
      <p class="field-label">${t('f.issue.category')}</p>
      <div class="cat-chips" role="group">${CATS.map((c) => html`<button type="button" class="chip cat-chip" data-cat-pick="${c}" aria-pressed="false">${icon(CAT_ICON[c])}<span>${t(`f.issue.cat.${c}`)}</span></button>`)}</div>`,
    actions: [
      { key: 'save', label: t('f.issue.save'), tone: 'primary' },
      { key: 'cancel', label: t('common.cancel'), tone: 'secondary' },
    ],
    dismissKey: 'cancel',
    onOpen(sheet) {
      box = sheet.querySelector('[data-text]');
      const chips = [...sheet.querySelectorAll('[data-cat-pick]')];
      const show = () => chips.forEach((b) => b.setAttribute('aria-pressed', String(picked.has(b.dataset.catPick))));
      box.addEventListener('input', () => { if (!touched) { picked = new Set(classifyAll(box.value)); show(); } });
      chips.forEach((b) => b.addEventListener('click', () => {
        touched = true;
        const c = b.dataset.catPick;
        if (picked.has(c)) picked.delete(c); else picked.add(c);
        show();
      }));
      box.focus();
    },
  });
  const text = box?.value.trim();
  if (key !== 'save' || !text) return false;
  const categories = picked.size ? [...picked] : classifyAll(text);
  store.addIssue(o.id, { text, categories, auto: !touched });
  toast(t('f.issue.saved', { cat: categories.map((c) => t(`f.issue.cat.${c}`)).join(', ') }));
  return true;
}

async function issuesList(o) {
  const list = store.issuesFor(o.id);
  await openSheet({
    title: t('f.issue.listTitle'),
    body: html`<ul class="issue-list">${list.map((i) => html`<li class="${i.status === 'open' ? 'is-open' : ''}">
      <div class="issue-cats">${catsOf(i).map((c) => html`<span class="issue-cat">${icon(CAT_ICON[c])}${t(`f.issue.cat.${c}`)}</span>`)}</div>
      <p class="issue-text">${i.text}</p>
      <p class="issue-meta">${i.date ? fmt.shortDate(i.date) : t('f.issue.today', { time: i.time })}${i.status === 'resolved' ? html` · <span class="ok-text">${icon('check')}${t('f.issue.resolved')}</span>` : ''}
        ${i.status === 'open' ? html`<button type="button" class="link-btn" data-resolve="${i.id}">${t('f.issue.resolve')}</button>` : ''}</p>
    </li>`)}</ul>`,
    actions: [{ key: 'add', label: t('f.issue.add'), tone: 'secondary' }, { key: 'close', label: t('common.close'), tone: 'primary' }],
    dismissKey: 'close',
    onOpen(sheet) {
      sheet.addEventListener('click', (e) => {
        const b = e.target.closest('[data-resolve]');
        if (!b) return;
        store.resolveIssue(o.id, b.dataset.resolve);
        b.closest('li').classList.remove('is-open');
        b.replaceWith(document.createTextNode(`· ${t('f.issue.resolved')}`));
      });
    },
  }).then((k) => (k === 'add' ? issueSheet(o) : null));
}

// ---- last order SKUs and stock on hand ---------------------------------------------------

/** The last order's lines: SKU, quantity, pack and value at today's rate. */
export function orderLinesHtml(order) {
  const rows = order.lines.filter((l) => l.cases || l.freeCases).map((l) => {
    const p = data.product(l.sku);
    return { name: p?.name ?? l.sku, pack: p ? `${p.unitsPerCase} × ${p.pack.ml >= 1000 ? `${p.pack.ml / 1000} L` : `${p.pack.ml} ml`}` : '', cases: l.cases, free: l.freeCases, value: p ? l.cases * p.ptrPerCase : null, label: p?.caseLabel };
  });
  return html`<ul class="order-lines">${rows.map((r) => html`<li>
    <span class="ol-name">${r.name}<span class="ol-pack">${r.pack}</span></span>
    <span class="ol-qty num">${fmt.unitsText(r.cases, r.label)}${r.free ? html` <span class="muted">+${r.free}</span>` : ''}</span>
    <span class="ol-val num">${r.value != null ? fmt.rupees(r.value) : ''}</span>
  </li>`)}</ul>`;
}

const CONF = { high: 'ok', medium: 'info', low: 'caution' };

export function stockOnHandCard(o) {
  const rows = data.onHand(o.id).slice().sort((a, b) => (b.repCountedCases ?? b.estimatedCasesOnHand) - (a.repCountedCases ?? a.estimatedCasesOnHand));
  const total = rows.reduce((n, r) => n + (r.repCountedCases ?? r.estimatedCasesOnHand), 0);
  const counted = rows.filter((r) => r.repCountedCases != null).length;
  return html`<details class="card collapse fold" data-card="onhand">
    <summary class="collapse-head">
      <span class="card-title"><span class="fold-ico ic-teal">${icon('box')}</span><span>${t('f.soh.title')}</span></span>
      <span class="collapse-sum">${rows.length ? t('f.soh.sum', { n: fmt.num(Math.round(total)) }) : t('f.soh.none')}</span>
      ${icon('chevron', 'collapse-chev')}
    </summary>
    <div class="collapse-body">
      ${rows.length ? html`<ul class="soh">${rows.map((r) => {
        const p = data.product(r.sku);
        const val = r.repCountedCases ?? r.estimatedCasesOnHand;
        return html`<li>
          <span class="soh-name">${p?.name ?? r.sku}<span class="soh-meta">${t('f.soh.delivered', { n: r.lastDeliveredCases, date: fmt.shortDate(r.lastDeliveredOn) })}</span></span>
          <span class="soh-val"><span class="num">~${fmt.num(Math.round(val * 10) / 10)}</span>${r.repCountedCases != null ? pill(t('f.soh.counted'), 'ok') : pill(t(`f.soh.conf.${r.confidence}`), CONF[r.confidence] ?? 'neutral')}</span>
        </li>`;
      })}</ul>` : ''}
      <p class="fine">${t('f.soh.method', { counted })}</p>
    </div>
  </details>`;
}
