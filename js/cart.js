// The cart: one state object for one outlet, and a way to subscribe to every change.
//
//   const off = cart.subscribe(({ type, sku, cases, cart }) => …);
//   type: 'start' (new order for an outlet) · 'add' (+) · 'remove' (−) · 'set' (typed quantity) · 'clear'
//   sku/cases: the line that changed and its new quantity (null for start/clear)
//   cart: a snapshot { outletId, lines: { SKU: cases }, totalCases }

export const MAX_CASES = 999;

const state = { outletId: null, lines: {} };
const listeners = new Set();

const clamp = (n) => Math.max(0, Math.min(MAX_CASES, Math.floor(Number(n) || 0)));
const total = () => Object.values(state.lines).reduce((a, b) => a + b, 0);

function snapshot() {
  return { outletId: state.outletId, lines: { ...state.lines }, totalCases: total() };
}

function emit(type, sku = null) {
  const event = { type, sku, cases: sku ? (state.lines[sku] ?? 0) : null, cart: snapshot() };
  listeners.forEach((fn) => {
    try { fn(event); } catch (err) { console.error('[cart] listener failed', err); }
  });
}

function write(sku, n, type) {
  const next = clamp(n);
  if (next === (state.lines[sku] ?? 0)) return;
  if (next === 0) delete state.lines[sku];
  else state.lines[sku] = next;
  emit(type, sku);
}

export const cart = {
  get outletId() { return state.outletId; },
  get: (sku) => state.lines[sku] ?? 0,
  lines: () => ({ ...state.lines }),
  totalCases: total,
  isEmpty: () => total() === 0,
  snapshot,

  /** Start a fresh order for an outlet (drops any lines). */
  start(outletId) {
    state.outletId = outletId;
    state.lines = {};
    emit('start');
  },
  add(sku, n = 1) { write(sku, (state.lines[sku] ?? 0) + n, 'add'); },
  remove(sku, n = 1) { write(sku, (state.lines[sku] ?? 0) - n, 'remove'); },
  /** Typed quantity: whole numbers 0–999. */
  set(sku, n) { write(sku, n, 'set'); },
  clear() {
    state.outletId = null;
    state.lines = {};
    emit('clear');
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
