import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const file = (f: string) => new URL('../../' + f, import.meta.url);
const read = (f: string) => fs.readFileSync(file(f), 'utf8');
const png = (f: string) => { const b = fs.readFileSync(file(f)); assert.equal(b.subarray(1, 4).toString(), 'PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('the web app manifest is valid JSON with the installable fields, and every icon it names exists at its size', () => {
  const m = JSON.parse(read('public/manifest.webmanifest'));
  for (const k of ['name', 'short_name', 'start_url', 'display', 'theme_color', 'background_color', 'icons']) assert.ok(m[k], `manifest.${k}`);
  assert.equal(m.name, 'SWELLO'); assert.equal(m.display, 'standalone'); assert.equal(m.start_url, '/');
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/i); assert.match(m.background_color, /^#[0-9a-f]{6}$/i);
  assert.ok(m.icons.some((i: {purpose: string}) => i.purpose === 'maskable'), 'a maskable icon');
  for (const i of m.icons) { const [w, h] = png('public' + i.src); assert.equal(`${w}x${h}`, i.sizes, i.src); }
  assert.ok(m.icons.some((i: {sizes: string}) => i.sizes === '192x192') && m.icons.some((i: {sizes: string}) => i.sizes === '512x512'));
});
test('the manifest colours are the app tokens', () => {
  const m = JSON.parse(read('public/manifest.webmanifest')), css = read('src/ui/tokens.css');
  assert.ok(css.includes(`--bg: ${m.background_color}`), 'background_color is the light --bg'); assert.match(read('src/ui/theme.ts'), new RegExp(`light: '${m.theme_color}'`));
});
test('the apple-touch-icon is 180 x 180 and index.html links the manifest, the icon and the standalone metas, with viewport-fit=cover', () => {
  assert.deepEqual(png('public/icons/apple-touch-icon.png'), [180, 180]);
  const h = read('index.html');
  assert.match(h, /rel="manifest" href="\/manifest\.webmanifest"/); assert.match(h, /rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png"/);
  assert.match(h, /apple-mobile-web-app-capable" content="yes"/); assert.match(h, /apple-mobile-web-app-status-bar-style/); assert.match(h, /viewport-fit=cover/);
});
test('no service worker, push or analytics came with the install work', () => {
  assert.ok(!fs.existsSync(file('public/sw.js')) && !fs.existsSync(file('public/service-worker.js')));
  assert.ok(!/serviceWorker/.test(read('src/main.tsx')));
});
test('the floating Share is the header Share component (one share function), shown on phones only', () => {
  const fv = read('src/features/forecast/ForecastView.tsx'), sw = read('src/features/forecast/ShareWindow.tsx');
  assert.match(fv, /<ShareWindow card=\{nowCard\} className="sp-share" \/>/); assert.match(fv, /\{narrow && <ShareWindow card=\{nowCard\} fab \/>\}/);
  assert.equal((sw.match(/navigator\.share\(/g) ?? []).length, 2, 'the same two share calls as before, none added for the button'); assert.equal((sw.match(/const share = async/g) ?? []).length, 1);
  assert.match(sw, /className="share-fab" onClick=\{share\}/);
});
test('the tab bar floats above the safe area and the page, footer and map reserve its space', () => {
  const css = read('src/ui/app.css'), bar = /^  \.tabbar \{[^}]*\}/m.exec(css)![0];
  assert.match(bar, /bottom: calc\(env\(safe-area-inset-bottom\) \+ 10px\)/); assert.match(bar, /left: 12px; right: 12px/); assert.match(bar, /border-radius: 30px/);
  assert.match(css, /backdrop-filter: blur\(22px\)/); assert.match(css, /@supports \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)/); assert.match(bar, /background: var\(--tab-bg\)/, 'a solid background before @supports');
  assert.match(css, /\.page \{ padding-bottom: calc\(var\(--tab-h\) \+ env\(safe-area-inset-bottom\)/); assert.match(css, /\.foot \{ padding-bottom: calc\(var\(--tab-h\) \+ env\(safe-area-inset-bottom\)/);
  assert.match(read('src/features/explore/explore.css'), /\.xmap \{ height: calc\(100dvh - var\(--nav-h\) - var\(--tab-h\) - env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /display-mode: standalone[\s\S]*env\(safe-area-inset-top\)/);
  const tok = read('src/ui/tokens.css'); assert.ok((tok.match(/--tab-glass:/g) ?? []).length === 2 && (tok.match(/--tab-bg:/g) ?? []).length === 2, 'light and dark tab tokens');
});
test('the tab bar hides on scroll down but never on the map, with the keyboard up, or while focus is in it', () => {
  const ps = read('src/ui/phoneShell.ts');
  assert.match(ps, /area === 'explore'/); assert.match(ps, /keyboardUp\(\)/); assert.match(ps, /closest\('\.tabbar'\)/); assert.match(ps, /visualViewport/); assert.match(ps, /passive: true/);
  assert.match(read('src/app/Nav.tsx'), /useTabBarAutoHide\(area\)/);
});
test('reduced motion: the bar, its items, the title and the floating Share stop animating', () => {
  const css = read('src/ui/app.css'), m = /@media \(prefers-reduced-motion: reduce\) \{[^}]*\.tabbar[^}]*\}/.exec(css);
  assert.ok(m, 'a reduced-motion block for the tab bar'); assert.match(m![0], /transition: none/); assert.match(m![0], /\.share-fab-w/);
});
