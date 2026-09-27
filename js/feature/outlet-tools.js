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

// ---- header actions ----------------------------------------------------------------

export const actionsRow = (o, directionsHref) => html`<div class="tools" role="group" aria-label="${t('f.tools.label')}">
  <button type="button" class="tool" data-tool="call">${icon('phone')}<span>${t('f.tools.call')}</span></button>
  <button type="button" class="tool" data-tool="note">${icon('mic')}<span>${t('f.tools.note')}</span></button>
  <button type="button" class="tool" data-tool="issue">${icon('flag')}<span>${t('f.tools.issue')}</span></button>
  <a class="tool" href="${directionsHref}" target="_blank" rel="noopener noreferrer">${icon('map')}<span>${t('outlet.directions')}</span></a>
</div>`;

export function issuesBadge(o) {
  const n = store.openIssues(o.id).length;
  return n ? html`<button type="button" class="issue-badge" data-tool="issues">${icon('flag')}<span>${t('f.issue.badge', { n })}</span></button>` : '';
}

/** Wires the tool buttons inside `root`. `refresh(part)` redraws 'notes' or 'issues'. */
export function wire(root, o, refresh) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-tool]');
    if (!btn) return;
    const tool = btn.dataset.tool;
    if (tool === 'call') await callSheet(o, refresh);
    if (tool === 'note' && await noteSheet(o)) refresh('notes');
    if (tool === 'issue' && await issueSheet(o)) refresh('issues');
    if (tool === 'issues') { await issuesList(o); refresh('issues'); }
  });
}

// ---- call ------------------------------------------------------------------------

/** When the rep usually checks in here, from the last visits' check-in times. */
function usualTime(o) {
  const times = (data.visits(o.id)?.visits ?? []).filter((v) => v.done && v.checkIn).slice(-6).map((v) => v.checkIn).sort();
  return times.length ? times[Math.floor(times.length / 2)] : null;
}

async function callSheet(o, refresh) {
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

async function noteSheet(o) {
  let via = 'typed';
  let rec = null;
  let box = null;
  const key = await openSheet({
    title: t('f.note.title'),
    body: html`<label class="field"><span class="field-label">${t('f.note.label', { name: o.name })}</span>
        <textarea class="input textarea" rows="4" data-text placeholder="${t('f.note.ph')}"></textarea></label>
      ${Speech
        ? html`<button type="button" class="btn btn-secondary btn-block mic" data-mic aria-pressed="false">${icon('mic')}<span data-mic-label>${t('f.note.speak')}</span></button>`
        : html`<p class="fine">${icon('info')} ${t('f.note.noVoice')}</p>`}`,
    actions: [
      { key: 'save', label: t('f.note.save'), tone: 'primary' },
      { key: 'cancel', label: t('common.cancel'), tone: 'secondary' },
    ],
    dismissKey: 'cancel',
    onOpen(sheet) {
      box = sheet.querySelector('[data-text]');
      box.focus();
      const mic = sheet.querySelector('[data-mic]');
      if (!mic) return;
      mic.addEventListener('click', () => {
        if (rec) { rec.stop(); return; }
        rec = new Speech();
        rec.lang = SPEECH_LANG[lang()] ?? 'en-IN';
        rec.interimResults = true;
        const before = box.value ? `${box.value.trim()} ` : '';
        rec.onresult = (ev) => {
          box.value = before + [...ev.results].map((r) => r[0].transcript).join(' ');
          via = 'voice';
        };
        const done = () => { rec = null; mic.setAttribute('aria-pressed', 'false'); mic.classList.remove('is-on'); mic.querySelector('[data-mic-label]').textContent = t('f.note.speak'); };
        rec.onend = done;
        rec.onerror = (ev) => { done(); toast(ev.error === 'not-allowed' ? t('f.note.micBlocked') : t('f.note.micFail'), 'info'); };
        rec.start();
        mic.setAttribute('aria-pressed', 'true'); mic.classList.add('is-on');
        mic.querySelector('[data-mic-label]').textContent = t('f.note.listening');
      });
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

async function issueSheet(o) {
  let box = null;
  let chosen = null;      // set when the rep taps a category (overrides the guess)
  const key = await openSheet({
    title: t('f.issue.title'),
    body: html`<label class="field"><span class="field-label">${t('f.issue.label', { name: o.name })}</span>
        <textarea class="input textarea" rows="4" data-text placeholder="${t('f.issue.ph')}"></textarea></label>
      <p class="field-label">${t('f.issue.category')}</p>
      <div class="cat-chips" role="group">${CATS.map((c) => html`<button type="button" class="chip" data-cat-pick="${c}" aria-pressed="${c === 'other'}">${t(`f.issue.cat.${c}`)}</button>`)}</div>
      <p class="fine">${t('f.issue.auto')}</p>`,
    actions: [
      { key: 'save', label: t('f.issue.save'), tone: 'primary' },
      { key: 'cancel', label: t('common.cancel'), tone: 'secondary' },
    ],
    dismissKey: 'cancel',
    onOpen(sheet) {
      box = sheet.querySelector('[data-text]');
      const chips = [...sheet.querySelectorAll('[data-cat-pick]')];
      const show = (c) => chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.catPick === c)));
      box.addEventListener('input', () => { if (!chosen) show(classifyIssue(box.value)); });
      chips.forEach((b) => b.addEventListener('click', () => { chosen = b.dataset.catPick; show(chosen); }));
      box.focus();
    },
  });
  const text = box?.value.trim();
  if (key !== 'save' || !text) return false;
  const category = chosen ?? classifyIssue(text);
  store.addIssue(o.id, { text, category, auto: !chosen });
  toast(t('f.issue.saved', { cat: t(`f.issue.cat.${category}`) }));
  return true;
}

async function issuesList(o) {
  const list = store.issuesFor(o.id);
  await openSheet({
    title: t('f.issue.listTitle', { name: o.name }),
    body: html`<ul class="issue-list">${list.map((i) => html`<li class="${i.status === 'open' ? 'is-open' : ''}">
      <p class="issue-meta">${pill(t(`f.issue.cat.${i.category}`), i.status === 'open' ? 'caution' : 'neutral')} <span class="muted">${i.time}${i.status === 'resolved' ? ` · ${t('f.issue.resolved')}` : ''}</span></p>
      <p>${i.text}</p>
      ${i.status === 'open' ? html`<button type="button" class="btn btn-ghost btn-compact" data-resolve="${i.id}">${icon('check')}<span>${t('f.issue.resolve')}</span></button>` : ''}
    </li>`)}</ul>`,
    actions: [{ key: 'close', label: t('common.close'), tone: 'secondary' }],
    dismissKey: 'close',
    onOpen(sheet) {
      sheet.addEventListener('click', (e) => {
        const b = e.target.closest('[data-resolve]');
        if (!b) return;
        store.resolveIssue(o.id, b.dataset.resolve);
        const li = b.closest('li');
        li.classList.remove('is-open');
        b.replaceWith(document.createTextNode(t('f.issue.resolved')));
      });
    },
  });
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
  return html`<details class="card collapse" data-card="onhand">
    <summary class="collapse-head">
      <span class="card-title">${icon('box')}<span>${t('f.soh.title')}</span></span>
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
