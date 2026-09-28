// Backgrounds for scheme cards: a stock photo per theme over a small SVG scene (cola fizz, mango juice,
// water, cooler, new outlet, festival), drawn inline so they work offline, with a dark gradient
// over the text side so white text stays readable. schemeArt(scheme) → an inline style string.

const svg = (body, bg) => `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 150' preserveAspectRatio='xMidYMid slice'>${bg}${body}</svg>`)}")`;

const rect = (a, b) => `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='360' height='150' fill='url(#g)'/>`;

const bubbles = (n, color, seed = 1) => Array.from({ length: n }, (_, i) => {
  const x = (i * 71 * seed + 37) % 360; const y = (i * 43 * seed + 11) % 150; const r = 2 + ((i * 7) % 7);
  return `<circle cx='${x}' cy='${y}' r='${r}' fill='none' stroke='${color}' stroke-width='1.5' opacity='.55'/>`;
}).join('');

const THEMES = {
  cola: svg(`${bubbles(22, '#ffd9d0', 1)}
    <g transform='translate(250 18) rotate(12)'><path d='M22 0h16v14c10 8 14 18 14 30v70c0 7-5 12-12 12H20c-7 0-12-5-12-12V44c0-12 4-22 14-30z' fill='#2b0a0a' opacity='.85'/><rect x='8' y='56' width='44' height='24' rx='3' fill='#ff3b30'/><path d='M14 68c10-6 22 6 32 0' stroke='#fff' stroke-width='3' fill='none'/></g>
    <g opacity='.9'><rect x='300' y='96' width='30' height='30' rx='6' fill='#ffffff' opacity='.35' transform='rotate(18 315 111)'/><rect x='214' y='108' width='24' height='24' rx='5' fill='#ffffff' opacity='.3' transform='rotate(-14 226 120)'/></g>`,
  rect('#b3121f', '#ff5a3c')),
  mango: svg(`<g transform='translate(236 20)'><ellipse cx='50' cy='62' rx='46' ry='40' fill='#ffb400'/><ellipse cx='36' cy='50' rx='18' ry='12' fill='#ffe07a' opacity='.7'/><path d='M50 22c6-14 20-18 30-14-6 10-18 16-30 14z' fill='#2f9e44'/><ellipse cx='98' cy='104' rx='28' ry='24' fill='#ff9500'/><path d='M98 80c4-10 14-12 20-9-4 7-12 11-20 9z' fill='#2f9e44'/></g>
    <g fill='#fff3c4' opacity='.8'><circle cx='214' cy='40' r='5'/><circle cx='200' cy='120' r='7'/><circle cx='340' cy='30' r='4'/><circle cx='228' cy='84' r='3'/></g>
    <path d='M190 150c30-30 60-10 90-30s50-10 80-20v50z' fill='#ff7a00' opacity='.5'/>`,
  rect('#e8590c', '#ffc53d')),
  water: svg(`<g opacity='.9'><path d='M280 20c18 26 30 40 30 56a30 30 0 01-60 0c0-16 12-30 30-56z' fill='#e7f7ff'/><path d='M280 44c8 12 14 20 14 28' stroke='#8fd3ff' stroke-width='4' fill='none' stroke-linecap='round'/><path d='M228 70c8 12 14 19 14 26a14 14 0 01-28 0c0-7 6-14 14-26z' fill='#c9eeff'/><path d='M334 88c7 10 11 16 11 22a11 11 0 01-22 0c0-6 4-12 11-22z' fill='#c9eeff'/></g>
    <path d='M0 124c40-14 80 14 120 0s80 14 120 0 80 14 120 0v26H0z' fill='#ffffff' opacity='.22'/><path d='M0 136c40-12 80 12 120 0s80 12 120 0 80 12 120 0v14H0z' fill='#ffffff' opacity='.28'/>
    <circle cx='340' cy='18' r='22' fill='#fff7c2' opacity='.55'/>`,
  rect('#0b63c9', '#35c3ff')),
  cooler: svg(`<g transform='translate(252 14)'><rect width='70' height='122' rx='10' fill='#e9fbff' opacity='.9'/><rect x='6' y='8' width='58' height='94' rx='6' fill='#8fe3f5' opacity='.6'/><path d='M6 40h58M6 72h58' stroke='#fff' stroke-width='3'/><circle cx='20' cy='24' r='5' fill='#ff5a3c'/><circle cx='36' cy='24' r='5' fill='#ffb400'/><circle cx='20' cy='56' r='5' fill='#35c3ff'/><circle cx='50' cy='56' r='5' fill='#ff5a3c'/></g>
    <g stroke='#ffffff' stroke-width='2.5' stroke-linecap='round' opacity='.7'><path d='M214 30v24M202 42h24M205 33l18 18M223 33l-18 18'/><path d='M346 118v16M338 126h16M340 120l12 12M352 120l-12 12'/></g>`,
  rect('#0a7f8c', '#34d1bf')),
  shop: svg(`<g transform='translate(236 30)'><path d='M0 30L12 0h96l12 30z' fill='#ffffff' opacity='.9'/><path d='M0 30h24v8a12 12 0 01-24 0zM24 30h24v8a12 12 0 01-24 0zM48 30h24v8a12 12 0 01-24 0zM72 30h24v8a12 12 0 01-24 0zM96 30h24v8a12 12 0 01-24 0z' fill='#ffd166'/><rect x='10' y='46' width='100' height='64' fill='#fff' opacity='.85'/><rect x='46' y='70' width='28' height='40' fill='#7048e8' opacity='.7'/></g>
    <g>${Array.from({ length: 16 }, (_, i) => `<rect x='${(i * 53) % 360}' y='${(i * 29) % 150}' width='6' height='10' rx='2' fill='${['#ffd166', '#ff8fab', '#8ce99a', '#74c0fc'][i % 4]}' transform='rotate(${i * 37} ${(i * 53) % 360} ${(i * 29) % 150})' opacity='.85'/>`).join('')}</g>`,
  rect('#5f3dc4', '#b197fc')),
  festival: svg(`<g transform='translate(250 70)'><path d='M0 30c10 20 70 20 80 0z' fill='#ffb400'/><path d='M40 30c-10-12-6-28 0-36 6 8 10 24 0 36z' fill='#ffe066'/><circle cx='40' cy='12' r='16' fill='#ffe066' opacity='.25'/></g>${bubbles(14, '#ffe066', 3)}`,
  rect('#6b1d3a', '#d9480f')),
};

// Stock photos (Unsplash, free licence, no brand marks), loaded online. Each sits above its
// illustration, so the card still looks right if the photo can't load (e.g. offline).
const PHOTO_IDS = {
  cola: 'uCtJy7YavP8',      // glass of fizzy soda with ice
  mango: 'jKADJEdhk1U',     // tall glass of mango juice
  water: '7xTp5vlbbSY',     // glass of water in blue light
  cooler: 'SvhXD3kPSTY',    // drinks in a shop fridge
  shop: 'bAKYjjvAQIE',      // a kirana shop in Kamshet, Maharashtra
};
const photo = (theme) => (PHOTO_IDS[theme] ? `url("https://unsplash.com/photos/${PHOTO_IDS[theme]}/download?w=720"), ` : '');

/** Which picture fits the scheme: by its packs first, then by its type. */
function themeOf(s) {
  const skus = Array.isArray(s.skus) ? s.skus.join(' ') : '';
  if (s.type === 'program') return 'cooler';
  if (s.type === 'first-order') return 'shop';
  if (/^(MG|MF|GV|AP)|\b(MG|MF|GV|AP)/.test(skus)) return 'mango';
  if (/\bWT/.test(` ${skus}`)) return 'water';
  if (/diwali/i.test(s.name)) return 'festival';
  return 'cola';
}

export function schemeArt(s) {
  const theme = themeOf(s);
  return `background-image: linear-gradient(90deg, rgba(8, 14, 30, 0.84) 0%, rgba(8, 14, 30, 0.5) 55%, rgba(8, 14, 30, 0.1) 100%), ${photo(theme)}${THEMES[theme]};`;
}
