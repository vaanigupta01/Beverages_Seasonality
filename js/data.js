// Loads the demo data and exposes read-only selectors. The files follow the data contract in PROGRESS.md.
//
// Where the data comes from:
// - Served over http(s) (the hosted site): data/<name>.json next to the page. The data files are the
//   source, so editing one and reloading changes the screen. Relative paths keep a GitHub Pages
//   subfolder working.
// - Opened without a server (gt-app.html double-clicked, or a preview snapshot): the copy embedded
//   in the page by scripts/build_single.py, as <script type="application/json" id="data-<name>">.

const FILES = ['config', 'outlets', 'products', 'schemes', 'orders', 'history', 'visits', 'distributor_stock', 'calendar', 'peers', 'current_stock', 'field'];
export const SERVED = typeof location !== 'undefined' && (location.protocol === 'http:' || location.protocol === 'https:');

const db = {};
const idx = { outlets: new Map(), products: new Map(), orders: new Map(), stock: new Map(), onHand: new Map() };

export class DataError extends Error {
  constructor(file, detail) {
    super(`${file}: ${detail}`);
    this.file = file;
    this.detail = detail;
  }
}

async function fetchFile(name) {
  const file = `data/${name}.json`;
  let res;
  try {
    res = await fetch(file, { cache: 'no-cache' });
  } catch (err) {
    throw new DataError(file, `could not be fetched (${err.message})`);
  }
  if (!res.ok) throw new DataError(file, `HTTP ${res.status}. Is the data/ folder next to the page?`);
  try {
    return await res.json();
  } catch (err) {
    throw new DataError(file, `is not valid JSON (${err.message})`);
  }
}

function readEmbedded(name) {
  const el = document.getElementById(`data-${name}`);
  if (!el) throw new DataError(`data/${name}.json`, 'is not embedded in this page. Rebuild gt-app.html, or open the hosted link.');
  try {
    return JSON.parse(el.textContent);
  } catch (err) {
    throw new DataError(`data-${name} (embedded in the page)`, `is not valid JSON (${err.message})`);
  }
}

/** True when the page carries an embedded copy of the data (the single-file build). */
export const hasEmbedded = () => Boolean(document.getElementById('data-config'));

function need(file, cond, what) {
  if (!cond) throw new DataError(`data/${file}.json`, `missing or wrong: ${what}`);
}

function validate() {
  const { config, outlets, products, schemes, orders, history, visits, distributor_stock: stock } = db;
  need('config', /^\d{4}-\d{2}-\d{2}$/.test(config?.demoDate ?? ''), 'demoDate (YYYY-MM-DD)');
  need('config', config.region?.name && config.rep?.name, 'region.name, rep.name');
  need('outlets', Array.isArray(outlets?.outlets) && outlets.outlets.length, 'outlets[]');
  outlets.outlets.forEach((o, i) => need('outlets', o.id && o.name && o.tier, `outlets[${i}].id / name / tier`));
  need('products', Array.isArray(products?.products) && products.products.length, 'products[]');
  products.products.forEach((p, i) => need('products', p.sku && p.name && Number.isFinite(p.ptrPerCase), `products[${i}].sku / name / ptrPerCase`));
  need('schemes', Array.isArray(schemes?.schemes), 'schemes[]');
  need('orders', Array.isArray(orders?.orders), 'orders[]');
  need('history', Array.isArray(history?.weeks) && history.outlets, 'weeks[], outlets');
  need('visits', visits?.outlets && typeof visits.outlets === 'object', 'outlets');
  need('distributor_stock', Array.isArray(stock?.items), 'items[]');
  need('peers', Array.isArray(db.peers?.groups), 'groups[]');
  need('current_stock', Array.isArray(db.current_stock?.rows), 'rows[]');
  need('field', db.field?.targets?.preSeason && Array.isArray(db.field?.reps), 'targets.preSeason, reps[]');
}

function buildIndexes() {
  db.outlets.outlets.forEach((o) => idx.outlets.set(o.id, o));
  db.products.products.forEach((p) => idx.products.set(p.sku, p));
  db.distributor_stock.items.forEach((s) => idx.stock.set(s.sku, s));
  db.orders.orders.forEach((o) => {
    if (!idx.orders.has(o.outletId)) idx.orders.set(o.outletId, []);
    idx.orders.get(o.outletId).push(o);
  });
  db.current_stock.rows.forEach((r) => {
    if (!idx.onHand.has(r.outletId)) idx.onHand.set(r.outletId, []);
    idx.onHand.get(r.outletId).push(r);
  });
}

export async function loadData() {
  const read = SERVED ? fetchFile : readEmbedded;
  const loaded = await Promise.all(FILES.map(async (n) => [n, await read(n)]));
  loaded.forEach(([n, v]) => { db[n] = v; });
  validate();
  buildIndexes();
  console.info(`[data] ${FILES.length} files loaded from ${SERVED ? 'data/*.json' : 'the copy embedded in this page'}`);
}

/** Tests and scripts (Node): load the files directly, { config: {…}, outlets: {…}, … }. */
export function useData(files) {
  Object.assign(db, files);
  validate();
  buildIndexes();
}

// ---- selectors (the feature reuses these) ---------------------------------

export const config = () => db.config;
export const demoDate = () => db.config.demoDate;

export const outlets = () => db.outlets.outlets;
export const outlet = (id) => idx.outlets.get(id) ?? null;

export const products = () => db.products.products;
export const product = (sku) => idx.products.get(sku) ?? null;
export const categories = () => db.products.categories ?? [...new Set(products().map((p) => p.category))];

export const schemes = () => db.schemes.schemes;

/** Past orders from orders.json only. For past + demo orders use orders.allOrdersFor(). */
export const pastOrders = (outletId) => idx.orders.get(outletId) ?? [];

/** { SKU: [weekly cases …] } aligned with historyWeeks(); SKUs never bought are absent. */
export const history = (outletId) => db.history.outlets?.[outletId] ?? {};
export const historyWeeks = () => ({ weeks: db.history.weeks, weekStarts: db.history.weekStarts ?? [] });

export const visits = (outletId) => db.visits.outlets?.[outletId] ?? null;

/** Today's route, in route order. */
export const route = () => outlets()
  .filter((o) => visits(o.id)?.todayOnRoute)
  .sort((a, b) => (visits(a.id).routeOrder ?? 99) - (visits(b.id).routeOrder ?? 99));

export const stock = () => db.distributor_stock;
export const stockFor = (sku) => idx.stock.get(sku) ?? null;
export const calendar = () => db.calendar;
export const peers = () => db.peers;

/** Estimated cases on hand today, per SKU: [{ sku, estimatedCasesOnHand, confidence, repCountedCases? … }]. */
export const onHand = (outletId) => idx.onHand.get(outletId) ?? [];

/** Demo additions (synthetic, labelled on screen): reps, targets, leaderboard, newer SKUs, yesterday's stock. */
export const field = () => db.field;
export const myRepId = () => 'REP-01';
export const repFor = (outletId) => db.field.reps.find((r) => r.id === (outlet(outletId)?.repId ?? 'REP-01')) ?? null;

/** True while data/ still holds the stub (any file's meta.note starts with "STUB"). */
export const isStub = () => Object.values(db).some((f) => String(f?.meta?.note ?? '').startsWith('STUB'));
