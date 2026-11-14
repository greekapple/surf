// Home-screen icons from the existing logo mark (the favicon in index.html: ink square, orange wave). No new artwork.
// Run: node scripts/make-icons.mjs  (uses sharp, already in node_modules). Writes public/icons/*.png.
import {mkdir, writeFile} from 'node:fs/promises';
import sharp from 'sharp';
const INK = '#0e1a22', SIGNAL = '#ff5a1f';
const wave = (scale, tx, ty, stroke) => `<g transform="translate(${tx} ${ty}) scale(${scale})"><path d="M5 20c4 0 5-7 10-7s6 7 12 7" fill="none" stroke="${SIGNAL}" stroke-width="${stroke}" stroke-linecap="round"/></g>`;
// the favicon's 32-unit artboard: rounded 7 (the "any" icon); iOS and Android apply their own mask to the others, so those are full-bleed squares
const svg = (size, {rounded, markScale}) => {
  const s = size / 32, m = markScale, off = (32 - 32 * m) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><rect width="32" height="32" ${rounded ? 'rx="7" ' : ''}fill="${INK}"/>${wave(m, off, off + 0.4 * m, 3)}</svg>`;
};
const out = [
  ['icon-192.png', 192, {rounded: true, markScale: 1}],
  ['icon-512.png', 512, {rounded: true, markScale: 1}],
  ['icon-maskable-512.png', 512, {rounded: false, markScale: 0.62}], // mark inside the 80% safe circle
  ['apple-touch-icon.png', 180, {rounded: false, markScale: 0.8}],
];
await mkdir('public/icons', {recursive: true});
for (const [name, size, o] of out) await sharp(Buffer.from(svg(size, o)), {density: 300}).resize(size, size).png().toFile(`public/icons/${name}`);
await writeFile('public/icons/swello-mark.svg', svg(32, {rounded: true, markScale: 1}).replace(/ width="32" height="32"/, '') + '\n');
console.log('icons written:', out.map((x) => x[0]).join(', '));
