// Which Season Check rules fire for each persona × cart type (docs/season-check-algo-v2.md §7).
// Carts are built from each outlet's last real order ("usual"); OUT-08 has none, so it uses the
// engine's own suggestion. Prints a Markdown table.
//
//   node test/persona-cart-matrix.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['config', 'outlets', 'products', 'schemes', 'orders', 'history', 'visits', 'distributor_stock', 'calendar', 'peers', 'current_stock', 'field'];
const data = await import(path.join(ROOT, 'js/data.js'));
data.useData(Object.fromEntries(FILES.map((f) => [f, JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `${f}.json`), 'utf8'))])));
const season = await import(path.join(ROOT, 'js/feature/season-engine.js'));
const schemes = await import(path.join(ROOT, 'js/schemes.js'));

const CODE = {
  'suggested-order': 'suggest', 'event-ahead': 'event', 'pace-gap': 'pace', 'missing-regular': 'regular', threshold: 'short',
  'cap-reached': 'cap', distributor: 'stock', cooler: 'cooler', 'no-cooler': 'no-cooler', credit: 'credit', 'larger-than-usual': 'larger',
  'not-eligible': 'not-elig', 'first-order': 'first', 'thin-history': 'thin', 'closing-soon': 'closing', 'school-rules': 'school',
  deload: 'deload', heat: 'heat', 'ordered-today': 'today',
};
const PERSONAS = ['OUT-01', 'OUT-02', 'OUT-03', 'OUT-04', 'OUT-05', 'OUT-06', 'OUT-07', 'OUT-08'];
const today = data.demoDate();

const scale = (lines, f) => Object.fromEntries(Object.entries(lines).map(([k, n]) => [k, Math.floor(n * f)]).filter(([, n]) => n > 0));
const chilled = (sku) => { const p = data.product(sku); return p?.chilled === 'yes' && p?.singleServe; };

function carts(id) {
  const o = data.outlet(id);
  const past = data.pastOrders(id).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const N = season.need(id);
  const usual = past[0]
    ? Object.fromEntries(past[0].lines.filter((l) => l.cases > 0).map((l) => [l.sku, l.cases]))
    : Object.fromEntries(Object.entries(N.skus).filter(([, s]) => s.suggested > 0).map(([k, s]) => [k, s.suggested]));
  // Missing a regular: drop the pack that appears most often in the last 4 orders.
  const hits = {};
  past.slice(0, 4).forEach((x) => x.lines.forEach((l) => { if (l.cases) hits[l.sku] = (hits[l.sku] ?? 0) + 1; }));
  const regular = Object.entries(hits).sort((a, b) => b[1] - a[1])[0]?.[0];
  const missing = { ...usual }; if (regular) delete missing[regular]; else delete missing[Object.keys(missing)[0]];
  // One case short: the first free-goods scheme this outlet can use, one case below its threshold.
  const s = schemes.activeSchemes(today).find((x) => x.type === 'free-goods' && schemes.eligibility(x, o, today, data.pastOrders(id)).eligible);
  const short = { ...usual };
  if (s) {
    const pack = s.skus.find((k) => data.stockFor(k)?.status === 'ok') ?? s.skus[0];
    const others = s.skus.filter((k) => k !== pack).reduce((a, k) => a + (short[k] ?? 0), 0);
    short[pack] = Math.max(0, s.rule.buyCases - 1 - others);
  }
  // Over the cooler: add cold single-serve packs to about twice the window's cooler cap.
  const cap = season.coolerCap(o, N.cover.sellingDays || N.cover.days) || 4;
  const cold = { ...usual }; cold.CL200G = (cold.CL200G ?? 0) + Math.ceil(cap * 2);
  // Over credit: scale the usual order until it is 20% above the credit room.
  const room = Math.max(1, (o.credit?.limit ?? 0) - (o.credit?.outstanding ?? 0));
  const value = schemes.price(usual, o, today, data.pastOrders(id)).net || 1;
  const credit = scale(usual, Math.max(1.2, (room * 1.2) / value));
  // Out at the distributor: add 2 cases of MG600.
  const out = { ...usual, MG600: 2 };
  // A scheme it can't get: water for Water Summer without a company cooler, else 250 ml cola at Bronze/Iron.
  const noCooler = o.cooler?.type !== 'bottler';
  const cant = { ...usual, ...(noCooler ? { WT1000: 8 } : ['Bronze', 'Iron'].includes(o.tier) ? { LL250: 10 } : { WT1000: 8 }) };
  return {
    Empty: {}, Usual: usual, 'Larger ×2': scale(usual, 2), 'Smaller ×½': scale(usual, 0.5), 'Missing a regular': missing,
    'One case short': short, 'Over cooler': cold, 'Over credit': credit, 'Out at distributor': out, "Scheme it can't get": cant,
  };
}

const rows = PERSONAS.map((id) => {
  const c = carts(id);
  return [id, ...Object.values(c).map((lines) => {
    const codes = [...new Set(season.check(id, lines).findings.map((f) => CODE[f.rule] ?? f.rule))];
    return codes.join(' · ') || '—';
  })];
});
const head = ['Outlet', ...Object.keys(carts('OUT-01'))];
console.log(`| ${head.join(' | ')} |`);
console.log(`|${head.map(() => '---').join('|')}|`);
rows.forEach((r) => console.log(`| ${r.join(' | ')} |`));
