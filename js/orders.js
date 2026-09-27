// Orders placed in the demo live in localStorage under one key, in the orders.json
// shape with source "demo". "Last order" anywhere = the latest from either source.

import * as data from './data.js';

const KEY = 'gtapp.demo.v1';
let memory = [];        // used when localStorage is blocked (some private windows)
let useMemory = false;

function read() {
  if (useMemory) return memory;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return Array.isArray(parsed?.orders) ? parsed.orders : [];
  } catch {
    return memory;
  }
}

function write(list) {
  memory = list;
  try {
    localStorage.setItem(KEY, JSON.stringify({ orders: list }));
  } catch {
    useMemory = true;
  }
}

const counter = (id) => Number(String(id).split('-').pop()) || 0;

/** Newest first: by date, then demo after history, then demo counter. */
function newestFirst(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.source !== b.source) return a.source === 'demo' ? -1 : 1;
  return counter(b.id) - counter(a.id);
}

export const demoOrders = () => read();
export const demoOrdersFor = (outletId) => read().filter((o) => o.outletId === outletId);
export const demoOrdersOn = (outletId, isoDate) => demoOrdersFor(outletId).filter((o) => o.date === isoDate);
export const orderById = (id) => read().find((o) => o.id === id) ?? null;

/** Every order for an outlet, past and demo, newest first. */
export const allOrdersFor = (outletId) => [...data.pastOrders(outletId), ...demoOrdersFor(outletId)].sort(newestFirst);

export const lastOrder = (outletId) => allOrdersFor(outletId)[0] ?? null;

export const paidCases = (order) => order.lines.reduce((n, l) => n + (l.cases || 0), 0);
export const freeCases = (order) => order.lines.reduce((n, l) => n + (l.freeCases || 0), 0);

/** Saves a demo order and returns it with its id (DEMO-<outlet no>-<counter>). */
export function saveOrder({ outletId, lines, grossValue, discountValue, netValue, schemeIds }) {
  const list = read();
  const no = String(outletId).split('-').pop();
  const n = Math.max(0, ...list.filter((o) => o.outletId === outletId).map((o) => counter(o.id))) + 1;
  const order = {
    id: `DEMO-${no}-${n}`,
    outletId,
    date: data.demoDate(),
    lines,
    grossValue,
    discountValue,
    netValue,
    schemeIds,
    source: 'demo',
  };
  write([...list, order]);
  return order;
}

/** "Reset demo": deletes only the orders placed in the demo. */
export function resetDemo() {
  memory = [];
  try { localStorage.removeItem(KEY); } catch { /* nothing stored */ }
}
