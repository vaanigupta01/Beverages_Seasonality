// Today's route on an illustrated map of Pune West. Static and offline: no map API, no tiles.
// The four areas sit where they are in real life (Pashan north, Bavdhan west, Kothrud east,
// Warje south); the stops follow the beat's loop in route order, drawn like a navigation
// app's highlighted route.
// The map is bigger than its window: drag it in any direction.

import * as data from '../data.js';
import { html, raw } from '../ui.js';

const W = 720; const H = 460;               // map canvas (drawing units)
const SCALE = 0.7;                          // shown at 70%, so more of the beat fits the window
const AREAS = {                             // centre and spread of each area on the canvas
  Pashan: { x: 360, y: 90, rx: 150, ry: 55 },
  Bavdhan: { x: 150, y: 250, rx: 95, ry: 110 },
  Kothrud: { x: 450, y: 250, rx: 150, ry: 70 },
  Warje: { x: 380, y: 390, rx: 170, ry: 45 },
};
const DEPOT = { x: 560, y: 330 };           // the distributor's godown, where the day starts

/** Smooth path through points (Catmull-Rom → cubic Bézier). */
function smooth(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i]; const p1 = pts[i]; const p2 = pts[i + 1]; const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x},${p2.y}`;
  }
  return d;
}

// The beat as one clean loop from the godown through Kothrud, Pashan, Bavdhan and Warje and back.
// The map is illustrative (the data has no coordinates), so stops are spaced along this loop in
// route order, the way a planned beat reads on a navigation app.
const LOOP = [DEPOT, { x: 630, y: 240 }, { x: 540, y: 130 }, { x: 410, y: 70 }, { x: 270, y: 105 },
  { x: 150, y: 190 }, { x: 110, y: 310 }, { x: 210, y: 395 }, { x: 370, y: 420 }, { x: 490, y: 385 }];

function loopPoints(n) {
  // Sample the smooth loop densely, then place n stops at equal distances along it.
  const pts = [];
  const ring = [...LOOP, LOOP[0]];
  for (let i = 0; i < ring.length - 1; i += 1) {
    const p0 = ring[i - 1] ?? ring[ring.length - 2]; const p1 = ring[i]; const p2 = ring[i + 1]; const p3 = ring[i + 2] ?? ring[1];
    for (let k = 0; k < 24; k += 1) {
      const t = k / 24; const t2 = t * t; const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      pts.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  const len = [0];
  for (let i = 1; i < pts.length; i += 1) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = len.at(-1);
  return Array.from({ length: n }, (_, i) => {
    const target = ((i + 1) / (n + 1)) * total;
    const j = Math.max(1, len.findIndex((l) => l >= target));
    const a = pts[j - 1]; const b = pts[j];
    const nx = -(b.y - a.y); const ny = b.x - a.x; const nl = Math.hypot(nx, ny) || 1;
    const wob = (i % 2 ? 1 : -1) * 9;       // a small side-to-side step, like shops on either side of a road
    return { x: Math.round(b.x + (nx / nl) * wob), y: Math.round(b.y + (ny / nl) * wob) };
  });
}

/** rows: [{ outlet, saved: [] }] in route order. */
export function routeMap(rows) {
  const spots = loopPoints(rows.length);
  const stops = rows.map((r, i) => ({ ...spots[i], n: data.visits(r.outlet.id)?.routeOrder ?? i + 1, done: r.saved.length > 0 }));
  const nextIdx = stops.findIndex((s) => !s.done);
  const path = smooth([DEPOT, ...stops, DEPOT]);
  const doneUpTo = nextIdx === -1 ? stops.length : nextIdx;
  const donePath = doneUpTo ? smooth([DEPOT, ...stops.slice(0, doneUpTo)]) : '';
  const svg = `<svg class="rmap-svg" viewBox="0 0 ${W} ${H}" width="${Math.round(W * SCALE)}" height="${Math.round(H * SCALE)}" aria-hidden="true">
    <defs>
      <pattern id="rm-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.9" fill="#d9dfe8"/></pattern>
      <filter id="rm-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#0f1c2e" flood-opacity=".25"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="#f4f1ea"/>
    <rect width="${W}" height="${H}" fill="url(#rm-dots)"/>
    <path d="M0,40 C120,70 200,20 320,55 S560,40 720,80 L720,0 L0,0z" fill="#e6efdc"/>
    <ellipse cx="90" cy="120" rx="80" ry="55" fill="#dcead0"/>
    <ellipse cx="640" cy="170" rx="70" ry="40" fill="#dcead0"/>
    <ellipse cx="250" cy="430" rx="90" ry="30" fill="#dcead0"/>
    <path d="M-10,180 C80,160 150,200 230,180 S380,150 470,175 S640,210 730,190" fill="none" stroke="#b9d9f0" stroke-width="16" stroke-linecap="round"/>
    <path d="M-10,180 C80,160 150,200 230,180 S380,150 470,175 S640,210 730,190" fill="none" stroke="#cfe6f7" stroke-width="8" stroke-linecap="round"/>
    <g fill="none" stroke-linecap="round">
      <path d="M40,330 C200,300 330,330 470,300 S650,260 720,250" stroke="#e3dccd" stroke-width="14"/>
      <path d="M40,330 C200,300 330,330 470,300 S650,260 720,250" stroke="#fffdf8" stroke-width="10"/>
      <path d="M300,0 C320,120 280,240 330,460" stroke="#e3dccd" stroke-width="12"/>
      <path d="M300,0 C320,120 280,240 330,460" stroke="#fffdf8" stroke-width="8"/>
      <path d="M600,0 C570,140 610,300 560,460" stroke="#f3d9a4" stroke-width="12"/>
      <path d="M600,0 C570,140 610,300 560,460" stroke="#fff3d3" stroke-width="7"/>
      <path d="M0,250 C120,240 200,270 300,245" stroke="#e8e2d4" stroke-width="7"/>
      <path d="M430,120 C470,200 520,220 600,230" stroke="#e8e2d4" stroke-width="7"/>
      <path d="M120,400 C220,380 300,410 420,395" stroke="#e8e2d4" stroke-width="7"/>
    </g>
    <text x="598" y="20" class="rm-road" transform="rotate(84 598 20)">NH-48</text>
    ${Object.entries(AREAS).map(([name, a]) => `<text x="${a.x}" y="${a.y - a.ry - 8}" class="rm-area" text-anchor="middle">${name.toUpperCase()}</text>`).join('')}
    <path d="${path}" fill="none" stroke="#fff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${path}" fill="none" stroke="#1d5bd8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 0"/>
    ${donePath ? `<path d="${donePath}" fill="none" stroke="#9aa6b8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    <g filter="url(#rm-shadow)"><rect x="${DEPOT.x - 13}" y="${DEPOT.y - 13}" width="26" height="26" rx="7" fill="#0f2a5c"/>
      <path d="M${DEPOT.x - 6},${DEPOT.y + 5}v-7l6-4 6 4v7z" fill="#fff"/></g>
    ${stops.map((s, i) => `<g class="rm-stop${s.done ? ' is-done' : ''}${i === nextIdx ? ' is-next' : ''}" transform="translate(${s.x} ${s.y})">
      ${i === nextIdx ? '<circle r="15" class="rm-pulse"/>' : ''}
      <circle r="9.5" filter="url(#rm-shadow)"/>
      <text y="3.4" text-anchor="middle">${s.done ? '✓' : s.n}</text></g>`).join('')}
  </svg>`;
  return html`<div class="rmap" data-rmap>
    <div class="rmap-canvas" data-rmap-canvas>${raw(svg)}</div>
    <span class="rmap-hint">⤧</span>
  </div>`;
}

/** Drag the map inside its window; starts centred on the next stop. */
export function wireMap(root) {
  const box = root.querySelector('[data-rmap]');
  const canvas = root.querySelector('[data-rmap-canvas]');
  if (!box || !canvas) return;
  const vw = () => box.clientWidth; const vh = () => box.clientHeight;
  const clampX = (x) => Math.min(0, Math.max(vw() - W * SCALE, x));
  const clampY = (y) => Math.min(0, Math.max(vh() - H * SCALE, y));
  const next = canvas.querySelector('.is-next') ?? canvas.querySelector('.rm-stop');
  let x = 0; let y = 0;
  if (next) {
    const m = /translate\(([\d.]+) ([\d.]+)\)/.exec(next.getAttribute('transform') ?? '');
    if (m) { x = clampX(vw() / 2 - Number(m[1]) * SCALE); y = clampY(vh() / 2 - Number(m[2]) * SCALE); }
  }
  const put = () => { canvas.style.transform = `translate(${x}px, ${y}px)`; };
  put();
  let start = null;
  box.addEventListener('pointerdown', (e) => { start = { px: e.clientX, py: e.clientY, x, y }; box.setPointerCapture(e.pointerId); box.classList.add('is-drag'); });
  box.addEventListener('pointermove', (e) => {
    if (!start) return;
    x = clampX(start.x + e.clientX - start.px); y = clampY(start.y + e.clientY - start.py); put();
  });
  const end = () => { start = null; box.classList.remove('is-drag'); };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
}
