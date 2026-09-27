// Season Check engine: results on the demo date for the 8 persona outlets, plus the rules
// the algorithm doc promises. Runs in Node on the real data files, no browser needed.
//
//   node test/season-engine.test.mjs              the results table and the checks
//   node test/season-engine.test.mjs --verbose    also every check() message per outlet
//   node test/season-engine.test.mjs --heatwave   the 43 °C what-if next to the forecast

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['config', 'outlets', 'products', 'schemes', 'orders', 'history', 'visits', 'distributor_stock', 'calendar', 'peers', 'current_stock', 'field'];
const verbose = process.argv.includes('--verbose');
const heatwave = process.argv.includes('--heatwave');

const data = await import(path.join(ROOT, 'js/data.js'));
data.useData(Object.fromEntries(FILES.map((f) => [f, JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `${f}.json`), 'utf8'))])));
const season = await import(path.join(ROOT, 'js/feature/season-engine.js'));

const PERSONAS = ['OUT-01', 'OUT-02', 'OUT-03', 'OUT-04', 'OUT-05', 'OUT-06', 'OUT-07', 'OUT-08'];
const WHAT_IF = { forecastMaxC: 43 };
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) failed += 1; };

// ---- the table ----------------------------------------------------------------------------
console.log(`\nSeason Check on ${data.demoDate()}\n`);
const head = ['Outlet', 'Mode', 'Covers to', 'Days', 'Expected', 'Suggest', 'On hand', 'Realisable', 'Leak', 'Gates'];
if (heatwave) head.splice(5, 0, '43°C');
const rows = PERSONAS.map((id) => {
  const N = season.need(id);
  const r = [id, N.mode, N.cover.until, `${N.cover.sellingDays}/${N.cover.days}`, N.totals.expected, N.totals.suggested, N.totals.onHand, N.totals.realisable, N.totals.leaked,
    N.gates.map((g) => g.rule + (g.sku ? `:${g.sku}` : '')).join(' ') || '—'];
  if (heatwave) r.splice(5, 0, season.need(id, { whatIf: WHAT_IF }).totals.expected);
  return r;
});
const widths = head.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i]).length)));
const line = (r) => r.map((c, i) => String(c).padEnd(widths[i])).join('  ');
console.log(line(head));
console.log(widths.map((w) => '-'.repeat(w)).join('  '));
rows.forEach((r) => console.log(line(r)));

// ---- the rules ------------------------------------------------------------------------------
console.log('\nChecks');
const N = Object.fromEntries(PERSONAS.map((id) => [id, season.need(id)]));
ok(N['OUT-05'].mode === 'closing' && N['OUT-06'].mode === 'bookings' && N['OUT-07'].mode === 'silent', 'modes: school closing, banquet hall bookings, wholesaler silent');
ok(N['OUT-04'].mode === 'peers' && N['OUT-08'].mode === 'peers' && N['OUT-08'].newOutlet, 'thin history uses peers; OUT-08 is a new outlet (starts at 80%)');
ok(N['OUT-07'].display === false, 'wholesaler: computed but never shown');
ok(N['OUT-06'].totals.suggested === 29, 'banquet hall: the 8 bookings before the next delivery need 29 cases');
ok(N['OUT-05'].totals.realisable <= 1, 'school: order little or nothing before the closure');

const ration = data.stockFor('CL250')?.maxCasesPerOutlet;
ok(PERSONAS.every((id) => (N[id].skus.CL250?.realisable ?? 0) <= ration + 0), `no suggestion above the CL250 ration (${ration})`);
ok(PERSONAS.every((id) => !(N[id].skus.MG600?.realisable > 0)), 'nothing suggested of MG600 (out at the distributor)');
ok(!Object.keys(N['OUT-05'].skus).some((sku) => ['Sparkling', 'Energy'].includes(data.product(sku)?.category)), 'school rule: no sparkling or energy packs suggested at OUT-05');
ok(PERSONAS.every((id) => N[id].totals.realisable + N[id].totals.onHand <= N[id].totals.suggested + N[id].totals.swapped + 1), 'realisable + on hand never exceeds the suggestion (plus swaps)');

const c1 = season.check('OUT-03', { CL250: 9 });
ok(c1.findings.some((f) => f.rule === 'distributor' && f.level === 'block' && f.action?.set), 'cart above the ration → a blocking finding with a swap action');
const c2 = season.check('OUT-01', {});
ok(c2.findings.some((f) => f.rule === 'suggested-order'), 'empty cart → a suggested order');
const big = Object.fromEntries(Object.entries(N['OUT-01'].skus).map(([s, x]) => [s, (x.suggested || 1) * 3]));
ok(season.check('OUT-01', big).findings.some((f) => f.rule === 'larger-than-usual' && f.audience === 'rep'), 'triple-size cart → "larger than usual", for the rep only');
ok(season.check('OUT-05', { CL250: 3 }).findings.some((f) => f.rule === 'school-rules'), 'sparkling in a school cart → school rule');
ok(season.check('OUT-07', { CL250: 9, OR1250: 5 }).findings.every((f) => ['distributor', 'credit'].includes(f.rule)), 'wholesaler: only stock and credit findings');

const hot = Object.fromEntries(['OUT-01', 'OUT-03'].map((id) => [id, season.need(id, { whatIf: WHAT_IF })]));
ok(hot['OUT-01'].totals.expected > N['OUT-01'].totals.expected && hot['OUT-03'].totals.expected > N['OUT-03'].totals.expected, '43°C what-if raises expected demand');
ok(hot['OUT-01'].weather.heatWave !== 'none', '43°C what-if flags heat-wave conditions');
const d = season.diagnostics();
ok(Math.abs(d.weightedMeanSlopePct - 3.78) < 0.2, `volume-weighted mean heat slope ≈ 3.78%/°C (got ${d.weightedMeanSlopePct})`);

if (verbose) {
  PERSONAS.forEach((id) => {
    const c = season.check(id, {});
    console.log(`\n${id} (${c.need.mode})`);
    c.need.explain.forEach((x) => console.log(`   · ${x}`));
    c.findings.forEach((f) => console.log(`   [${f.level}${f.audience === 'rep' ? ', rep' : ''}] ${f.text}`));
  });
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
