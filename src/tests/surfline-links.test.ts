import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {CAMS, camsFor, camFor, surflineFor} from '../data/cams.ts';

const SL = CAMS.filter((c) => c.provider === 'surfline'), SRC = new URL('../', import.meta.url).pathname;
const files = (dir: string): string[] => fs.readdirSync(dir, {withFileTypes: true}).flatMap((e) => (e.isDirectory() ? (e.name === 'tests' || e.name === 'node_modules' ? [] : files(path.join(dir, e.name))) : [path.join(dir, e.name)]));
const read = (f: string) => fs.readFileSync(f, 'utf8');

test('Surfline links: exactly the Bay Area spots where Surfline lists a cam, each with the cam name and a Surfline spot-page URL (link only, nothing opened)', () => {
  assert.deepEqual(SL.map((c) => c.spotId).sort(), ['cs-capitola', 'cs-half-moon-bay', 'cs-sharp-park', 'spot-1', 'spot-2', 'spot-3', 'spot-5', 'spot-6', 'spot-7', 'spot-8']);
  for (const c of SL) { assert.match(c.url, /^https:\/\/www\.surfline\.com\/surf-report\/[a-z0-9-]+\/[0-9a-f]{24}$/, c.spotId); assert.ok(c.camName && c.camName.length > 2, c.spotId); assert.equal(c.owner, 'Surfline'); assert.equal(c.verified, '2026-11-10'); assert.match(c.how, /NOT opened/); assert.match(c.how, /Link only/); assert.equal(c.operator, undefined); }
  assert.equal(new Set(SL.map((c) => c.url)).size, SL.length, 'one page per spot');
  assert.equal(surflineFor('spot-7')!.camName, 'Cowells'); assert.equal(surflineFor('spot-6')!.camName, 'Steamer Lane'); assert.equal(surflineFor('spot-2')!.camName, 'Ocean Beach Overview'); assert.equal(surflineFor('spot-5')!.camName, "Maverick's");
  for (const id of ['cs-natural-bridges', 'cs-princeton-jetty', 'cs-rockaway', 'spot-0', 'spot-4', 'cs-kellys-cove', 'cs-sloat', 'cs-rodeo-beach', 'cs-pescadero']) assert.equal(surflineFor(id), null, id + ': Surfline lists no cam (or none we could match): no link');
});
test('the map and the Callout are unchanged: camsFor and camFor leave Surfline out; the Port District link of Pleasure Point stays', () => {
  for (const c of SL) assert.ok(!camsFor(c.spotId).some((x) => x.provider === 'surfline'), c.spotId); assert.deepEqual(camsFor('spot-7'), []); assert.equal(camFor('spot-7'), null);
  assert.deepEqual(camsFor('spot-8').map((c) => c.owner), ['Santa Cruz Port District']); assert.equal(camsFor('cs-morro-rock').length, 1);
  for (const f of ['features/explore/ExploreView.tsx', 'features/explore/Callout.tsx', 'features/home/Welcome.tsx']) assert.doesNotMatch(read(path.join(SRC, f)), /surflineFor|SurflineLink/, f);
});
test('link only: every Surfline entry is shown as an <a href target=_blank rel="noopener noreferrer">; no Surfline URL is ever in an iframe, img, video, srcSet, fetch or any src', () => {
  const link = read(path.join(SRC, 'features/forecast/SurflineLink.tsx'));
  assert.match(link, /<a [^>]*href=\{c\.url\}[^>]*target="_blank"[^>]*rel="noopener noreferrer"/); assert.equal((link.match(/c\.url/g) ?? []).length, 1, 'the URL is used once: as the href'); assert.match(link, />Surfline cam ↗<\/a>/);
  assert.match(link, /may need a Surfline subscription/); assert.match(link, /Surfline's, not ours/); assert.doesNotMatch(link, /<iframe|<img|<video|<source|<embed|<object|srcSet|src=|fetch\(|new Image|background(-image)?:/i);
  for (const f of files(SRC)) {
    const t = read(f); if (!/\.(tsx?|css)$/.test(f)) continue;
    assert.doesNotMatch(t, /(src|srcSet|poster|data|action)=\{?[`'"][^`'"]*surfline/i, f + ': a Surfline URL in a src-like attribute'); assert.doesNotMatch(t, /url\([^)]*surfline/i, f + ': a Surfline URL in CSS');
    if (!/data\/cams\.ts$/.test(f) && /\.tsx$/.test(f)) { assert.doesNotMatch(t, /<(iframe|img|video|source|embed)\b[^>]*(surfline|surflineFor|\.url)/i, f); }
    if (/\.tsx?$/.test(f) && !/data\/cams\.ts$/.test(f)) assert.doesNotMatch(t, /fetch\([^)]*surfline|new Image\(\)[^;]*surfline/i, f);
  }
  const using = files(SRC).filter((f) => /\.tsx?$/.test(f) && /surflineFor/.test(read(f))).map((f) => path.relative(SRC, f)).sort(); assert.deepEqual(using, ['data/cams.ts', 'features/forecast/SurflineLink.tsx']);
  assert.match(read(path.join(SRC, 'features/forecast/ForecastView.tsx')), /<SurflineLink spotId=\{spot\.id\} \/>/);
  const fv = read(path.join(SRC, 'features/forecast/ForecastView.tsx')); assert.ok(fv.indexOf('<LiveCamPanel') < fv.indexOf('<SurflineLink'), 'under the Camera panel');
});
