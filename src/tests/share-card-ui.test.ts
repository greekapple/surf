import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SHARE_INK} from '../ui/shareImage.ts';

test('the share button: PNG drawn ahead, files shared where canShare allows, else text + url, else the text and link copied; wired on the Go window (Home, the spot page call) and the spot page header', () => {
  const src = (f: string) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const sw = src('features/forecast/ShareWindow.tsx');
  assert.match(sw, /navigator\.canShare\(withFile\)/); assert.match(sw, /files: \[f\], title: card\.title, text: card\.text, url: card\.url/); assert.match(sw, /navigator\.share\(\{title: card\.title, text: card\.text, url: card\.url\}\)/);
  assert.match(sw, /clipboard\.writeText\(shareTextWithLink\(card\)\)/); assert.match(sw, /AbortError/); assert.match(sw, /role="status"/);
  assert.match(src('features/forecast/ForecastView.tsx'), /share=\{shareCardFor\(/); assert.match(src('features/forecast/ForecastView.tsx'), /<ShareWindow card=\{nowCard\} className="sp-share" \/>/); assert.match(src('features/forecast/ForecastView.tsx'), /\{fallbackNow: true\}/);
  assert.match(src('features/home/HomeView.tsx'), /<ShareWindow card=\{planOf\(/);
});
test('the image uses the light-theme tokens', () => {
  const css = fs.readFileSync(new URL('../ui/tokens.css', import.meta.url), 'utf8'), light = css.slice(css.indexOf('/* Light palette'), css.indexOf('--ch-ink'));
  const tok = (n: string) => new RegExp(`--${n}: (#[0-9a-f]{6});`).exec(light)?.[1];
  assert.deepEqual([SHARE_INK.bg, SHARE_INK.s1, SHARE_INK.line, SHARE_INK.text, SHARE_INK.muted, SHARE_INK.hsHi, SHARE_INK.good, SHARE_INK.goodInk, SHARE_INK.fair, SHARE_INK.fairInk, SHARE_INK.poor, SHARE_INK.none],
    ['bg', 's1', 'line', 'text', 'muted', 'hs-hi', 'good', 'good-ink', 'fair', 'fair-ink', 'poor', 'none'].map(tok));
});
