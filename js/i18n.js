// Languages: English, Marathi (मराठी) and Hindi (हिंदी).
// All interface text comes from js/strings.js through t(). Data text (outlet, product and
// scheme names, visit notes, event names) stays as written in the data files; common data
// values (tiers, channels, categories, areas) are translated with label().
// Numbers stay in Western digits in every language, as reps and retailers read them fastest.

import { app } from './app.js';
import { STRINGS } from './strings.js';

export const LANGS = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'mr', label: 'मराठी', short: 'मरा' },
  { code: 'hi', label: 'हिंदी', short: 'हिं' },
];

const KEY = 'gtapp.lang.v1';   // per-viewer preference; Reset demo keeps it
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
let current = 'en';
try {
  const saved = localStorage.getItem(KEY);
  if (LANGS.some((l) => l.code === saved)) current = saved;
} catch { /* default: English */ }

export const lang = () => current;

/** Sets <html lang>, which also switches the Devanagari typography in the CSS. */
export function applyLang() {
  document.documentElement.lang = current;
}

export function setLang(code) {
  if (!LANGS.some((l) => l.code === code) || code === current) return;
  current = code;
  try { localStorage.setItem(KEY, code); } catch { /* this visit only */ }
  applyLang();
  app.emit('lang:changed', code);
}

const has = (code, key) => Object.prototype.hasOwnProperty.call(STRINGS[code] ?? {}, key);

/**
 * t('n.case', { n: 3 }) → "3 cases" / "3 पेट्या" / "3 पेटी".
 * An entry may be { one, other }; `n` picks the form and, when it is a number, is shown
 * with Indian grouping. Missing keys fall back to English, then to the key itself.
 */
export function t(key, vars = {}) {
  let entry = has(current, key) ? STRINGS[current][key] : STRINGS.en[key];
  if (entry == null) return key;
  if (typeof entry === 'object') entry = vars.n === 1 ? entry.one : entry.other;
  return entry.replace(/\{(\w+)\}/g, (m, k) => {
    const v = vars[k];
    if (v == null) return '';
    return k === 'n' && typeof v === 'number' ? inr.format(v) : String(v);
  });
}

/** A data value in the current language when the dictionary knows it (e.g. label('tier', 'Gold')), else as written. */
export function label(kind, value) {
  if (value == null || value === '') return '';
  const key = `${kind}.${value}`;
  return has(current, key) ? STRINGS[current][key] : String(value);
}

/** Keys that English has and a language lacks, for checking translations from the console. */
export const missing = (code) => Object.keys(STRINGS.en).filter((k) => !has(code, k));
