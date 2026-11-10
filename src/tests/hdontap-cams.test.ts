import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {LIVE_CAMS, liveCamsFor, disabledLiveCamsFor} from '../data/liveCamsSourced.ts';
import {HDONTAP_LINKS, hdontapLinksFor} from '../data/hdontapLinksSourced.ts';

const ROOT = new URL('../../', import.meta.url).pathname, read = (f: string) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const ROWS = JSON.parse(read('../../docs/forecast/data/camera-sources.json')).rows as any[], row = (id: string) => ROWS.find((r) => r.id === id);
const HD = LIVE_CAMS.filter((c) => c.kind === 'hdontap'), REASON = "HDOnTap's player only allows sites it approves (frame-ancestors); waiting for HDOnTap's answer";

test('the generated camera data equals the generator output, for both the panel data and the HDOnTap links', () => {
  const run = (...a: string[]) => execFileSync('node', ['scripts/build-live-cams.mjs', ...a], {cwd: ROOT}).toString();
  assert.equal(read('../data/liveCamsSourced.ts'), run()); assert.equal(read('../data/hdontapLinksSourced.ts'), run('--links'));
});
test('every HDOnTap embed is wired but SWITCHED OFF with the reason, and a disabled camera renders nothing: no HDOnTap camera is returned for any spot the panel draws', () => {
  assert.equal(HD.length, 16); assert.ok(HD.every((c) => c.enabled === false && c.disabledReason === REASON), 'all disabled with the exact reason');
  for (const c of HD) { assert.deepEqual(liveCamsFor(c.spotId).filter((x) => x.kind === 'hdontap'), [], c.spotId + ': the panel gets no HDOnTap camera'); assert.ok(disabledLiveCamsFor(c.spotId).some((x) => x.id === c.id)); }
  assert.equal(liveCamsFor('cs-hermosa').length, 0); assert.equal(liveCamsFor('cs-el-porto').length, 0, 'a spot whose only cameras are disabled has no panel');
  for (const c of LIVE_CAMS.filter((c) => c.kind !== 'hdontap')) assert.equal(c.enabled, true, c.id + ': the other cameras stay on'); assert.ok(liveCamsFor('spot-7').length === 1 && liveCamsFor('cs-sharp-park').length === 4);
  const gen = read('../../scripts/build-live-cams.mjs'); assert.match(gen, /export const HDONTAP_ENABLED = new Set\(\[\]\)/, 'nothing is enabled in the script'); assert.match(gen, /export const DISABLED = \{/);
});
test('each embed uses only HDOnTap\'s own player page (portal.hdontap.com/s/embed with its stream id), never a raw stream, and carries the host and owner credit and the small print', () => {
  for (const c of HD) {
    assert.match(c.embedUrl!, /^https:\/\/portal\.hdontap\.com\/s\/embed\/\?stream=[A-Za-z0-9_.-]+-HDOT&ratio=16:9$/, c.id); assert.equal(c.embedUrl, `https://portal.hdontap.com/s/embed/?stream=${c.embedId}&ratio=16:9`); assert.doesNotMatch(JSON.stringify(c), /m3u8|live\.hdontap|playlist|storage\.hdontap/i, c.id);
    assert.match(c.credit, /^HDOnTap \/ .+/); assert.equal(c.operatorNote, "Embedded with credit; HDOnTap's terms don't address third-party embedding. Removed on request."); assert.equal(c.kmApprox, true); assert.match(c.view, /^The camera list says it shows (the break or the beach|only part of the break or the beach)$/);
    const r = row(c.rowId); assert.equal(r.hostTermsRef, 'hdontap'); assert.ok(c.km <= 5 && c.km === r.nearestSpots[0].km); assert.equal(c.pageUrl, r.pageUrl);
  }
  assert.ok(!HD.some((c) => c.rowId === 'hdontap-carmel-tickle-pink'), 'Carmel is 5.9 km from the nearest app spot: not a candidate');
});
test('the panel creates HDOnTap\'s iframe only after a tap and only from the camera\'s embed URL; nothing in it can reach the raw stream', () => {
  const src = read('../features/forecast/LiveCam.tsx'), hd = src.slice(src.indexOf('function HdontapCam'), src.indexOf('/** The panel:'));
  assert.match(hd, /const \[open, setOpen\] = useState\(false\)/); assert.match(hd, /\{open && <div className="lc-player"><iframe src=\{cam\.embedUrl\}/); assert.equal((hd.match(/<iframe/g) ?? []).length, 1); assert.match(hd, /onClick=\{\(\) => setOpen\(true\)\}/); assert.match(hd, /Video stream · HDOnTap \//); assert.match(hd, /Nothing is loaded from HDOnTap before you tap/);
  assert.doesNotMatch(src, /m3u8|live\.hdontap|playlist|storage\.hdontap|hls\.js/i); assert.match(src, /cam\.kind === 'hdontap' \? <HdontapCam/); assert.match(src, /const cams = liveCamsFor\(spotId\)/, 'the panel draws enabled cameras only');
});
test('HDOnTap cam links: the 24 candidates, each an <a> to its own page in a new tab, labelled with the owner, the view note, about N km, and down/stale where the row says; nothing embedded; Swell Magnet is link-only', () => {
  assert.equal(HDONTAP_LINKS.length, 24); const ids = new Set(HDONTAP_LINKS.map((l) => l.id)); assert.equal(ids.size, 24); assert.ok(!ids.has('hdontap-carmel-tickle-pink'));
  for (const l of HDONTAP_LINKS) { const r = row(l.id); assert.equal(l.url, r.pageUrl); assert.ok(!/portal\.hdontap\.com|m3u8/.test(l.url), 'the stream page, not the player'); assert.ok(l.km <= 5 && l.km === r.nearestSpots[0].km && l.spotId === r.nearestSpots[0].id); assert.ok(['yes', 'partial'].includes(r.viewsSurf)); assert.match(l.label, / via HDOnTap$|^HDOnTap \(its own camera\)$/); }
  assert.deepEqual(HDONTAP_LINKS.filter((l) => l.status).map((l) => [l.id, l.status]).sort(), [['hammerland-north-manhattan', 'down'], ['hdontap-huntington-pier', 'down'], ['hi-hanalei-bay-resort-hdontap', 'stale']]);
  assert.equal(HDONTAP_LINKS.filter((l) => l.label === 'Swell Magnet via HDOnTap').length, 11); assert.ok(HDONTAP_LINKS.filter((l) => /^swellmagnet-/.test(l.id)).every((l) => l.label === 'Swell Magnet via HDOnTap'));
  assert.equal(hdontapLinksFor('cs-hermosa').length, 4); assert.equal(hdontapLinksFor('spot-3').length, 0); assert.equal(HDONTAP_LINKS.filter((l) => l.embedId).length, 16);
  const c = read('../features/forecast/HdontapLinks.tsx'); assert.match(c, /<a className="btn sp-hd-a" href=\{l\.url\} target="_blank" rel="noopener noreferrer"/); assert.match(c, />HDOnTap cam ↗<\/a>/); assert.equal((c.match(/l\.url/g) ?? []).length, 1); assert.doesNotMatch(c, /<iframe|<img|<video|<source|src=|fetch\(|new Image/i); assert.match(c, /about \$\{l\.km\} km from this spot/); assert.match(c, /listed as \$\{l\.status\} on/);
  assert.match(read('../features/forecast/ForecastView.tsx'), /<HdontapLinks spotId=\{spot\.id\} \/>/);
  for (const f of ['../features/explore/ExploreView.tsx', '../features/explore/Callout.tsx', '../features/home/Welcome.tsx']) assert.doesNotMatch(read(f), /hdontapLinks|HdontapLinks|portal\.hdontap/i, f);
});
test('the camera rule text says the second amendment and the kill switch is documented with the email line', () => {
  assert.match(read('../data/cams.ts'), /SECOND AMENDMENT \(2026-11-10[\s\S]*UNKNOWN terms[\s\S]*kill switch[\s\S]*stays link-only/); assert.match(read('../../PRODUCT.md'), /\*\*Second amendment \(2026-11-10[\s\S]*UNKNOWN terms[\s\S]*per-camera kill switch[\s\S]*stays link-only/);
  const doc = read('../../docs/forecast/LIVE-CAM-PANEL.md'); assert.match(doc, /## The kill switch \(one line per camera\)[\s\S]*DISABLED[\s\S]*HDONTAP_ENABLED/); assert.match(doc, /Ask HDOnTap to add swello\.surf-prototype\.workers\.dev to the allowed sites \(frame-ancestors\) for these streams:/);
  for (const c of HD) assert.ok(doc.includes('`' + c.embedId + '`'), c.embedId + ' is in the email list');
});

test('the spot page draws, in this order: our Camera panel, the HDOnTap links, then the Surfline link (all three merged)', () => {
  const fv = read('../features/forecast/ForecastView.tsx'), a = fv.indexOf('<LiveCamPanel'), b = fv.indexOf('<HdontapLinks'), c = fv.indexOf('<SurflineLink');
  assert.ok(a > 0 && b > a && c > b, `${a} < ${b} < ${c}`); assert.match(fv, /import \{HdontapLinks\} from '\.\/HdontapLinks';/); assert.match(fv, /import \{SurflineLink\} from '\.\/SurflineLink';/);
  const css = read('../features/forecast/forecast.css'); assert.match(css, /\.sp-surfline-a/); assert.match(css, /\.sp-hd-a/); assert.match(css, /\.sp-live-cam/); assert.doesNotMatch(css + fv, /<<<<<<<|>>>>>>>/);
});
