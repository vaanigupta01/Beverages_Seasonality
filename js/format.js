// Formatting helpers. Date maths works on 'YYYY-MM-DD' strings in UTC, and
// "today" is always config.demoDate — never the device clock.
// Day and month names follow the current language; numbers stay in Western digits.

import { lang, t } from './i18n.js';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** 123456 → "1,23,456" (Indian grouping). */
export const num = (n) => inr.format(Math.round(Number(n) || 0));

/** 123456 → "₹1,23,456"; negatives get a real minus sign. */
export const rupees = (n) => (n < 0 ? '−₹' : '₹') + num(Math.abs(n));

/** English-only plural, kept for feature code; screens use t('n.case', { n }) etc. */
export const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

/** "3 cases" / "3 पेट्या" / "3 पेटी". */
export const casesText = (n) => t('n.case', { n });
/** Cases or crates, by the product's case label. */
export const unitsText = (n, caseLabel) => t(caseLabel === 'crate' ? 'n.crate' : 'n.case', { n });

const NAMES = {
  en: {
    day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    dayLong: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    mon: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    monLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monTiny: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
  },
  mr: {
    day: ['रवि', 'सोम', 'मंगळ', 'बुध', 'गुरु', 'शुक्र', 'शनि'],
    dayLong: ['रविवार', 'सोमवार', 'मंगळवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
    mon: ['जाने', 'फेब्रु', 'मार्च', 'एप्रि', 'मे', 'जून', 'जुलै', 'ऑग', 'सप्टें', 'ऑक्टो', 'नोव्हें', 'डिसें'],
    monLong: ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून', 'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'],
    monTiny: ['जा', 'फे', 'मा', 'ए', 'मे', 'जू', 'जु', 'ऑ', 'स', 'ऑ', 'नो', 'डि'],
  },
  hi: {
    day: ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'],
    dayLong: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
    mon: ['जन', 'फ़र', 'मार्च', 'अप्रै', 'मई', 'जून', 'जुला', 'अग', 'सित', 'अक्टू', 'नव', 'दिस'],
    monLong: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
    monTiny: ['ज', 'फ़', 'मा', 'अ', 'म', 'जू', 'जु', 'अ', 'सि', 'अ', 'न', 'दि'],
  },
};
const names = () => NAMES[lang()] ?? NAMES.en;

export function parseISO(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export const toISO = (dt) => dt.toISOString().slice(0, 10);

export function addDays(iso, n) {
  const dt = parseISO(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return toISO(dt);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export const daysBetween = (from, to) => Math.round((parseISO(to) - parseISO(from)) / 86400000);

export const monthKey = (iso) => String(iso).slice(0, 7);

export function addMonths(key, n) {
  let [y, m] = key.split('-').map(Number);
  m += n;
  while (m < 1) { m += 12; y -= 1; }
  while (m > 12) { m -= 12; y += 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export const monthName = (key, long = false) => (long ? names().monLong : names().mon)[Number(String(key).slice(5, 7)) - 1];
/** One or two letters for chart axes. */
export const monthTiny = (key) => names().monTiny[Number(String(key).slice(5, 7)) - 1];

/** "Tue 28 Apr 2026" by default; options drop the weekday or year, or spell names out. */
export function date(iso, { weekday = true, year = true, long = false } = {}) {
  if (!iso) return '';
  const dt = parseISO(iso);
  const n = names();
  const parts = [];
  if (weekday) parts.push((long ? n.dayLong : n.day)[dt.getUTCDay()]);
  parts.push(String(dt.getUTCDate()), (long ? n.monLong : n.mon)[dt.getUTCMonth()]);
  if (year) parts.push(String(dt.getUTCFullYear()));
  return parts.join(' ');
}

/** "Tue 21 Apr" */
export const shortDate = (iso) => date(iso, { year: false });

/** "1 May – 14 Jun" (years shown only when they differ from `today`'s). */
export function dateRange(from, to, today) {
  const y = String(today).slice(0, 4);
  const opts = (iso) => ({ weekday: false, year: String(iso).slice(0, 4) !== y });
  return `${date(from, opts(from))} – ${date(to, opts(to))}`;
}

/** Relative to the demo date: "today", "yesterday", "7 days ago", "in 3 days". */
export function relative(iso, today) {
  const d = daysBetween(iso, today);
  if (d === 0) return t('common.today');
  if (d === 1) return t('common.yesterday');
  if (d === -1) return t('common.tomorrow');
  return d > 0 ? t('common.daysAgo', { n: d }) : t('common.inDays', { n: -d });
}

/** ISO week label, e.g. "2026-W18". */
export function isoWeek(iso) {
  const dt = parseISO(iso);
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
