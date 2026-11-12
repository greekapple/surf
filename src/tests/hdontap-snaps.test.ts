import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HDONTAP_ATTRIBUTION, HDONTAP_CAMS, HDONTAP_LOGO, HDONTAP_LOGO_LINK, hasSnapshot, hdontapLink, hdontapPage, ownerWords, snapshotCamsFor, snapshotSrc} from '../ocean/hdontapCams.ts';
import {HDONTAP_LINKS} from '../data/hdontapLinksSourced.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {camsFor, CAMS} from '../data/cams.ts';

const read = (f: string) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const VENICE = 'https://portal.hdontap.com/snapshot/venice_ptz_swellmagnet-SWELLO-REFERRAL?overlay=yes&position=ll&size=640x360&overlay_image=upload_46c1859aba858d1cb3d8ba7e97166bf9.png&padx=7&pady=7';
const host = (u: string) => new URL(u).hostname;

test('hdontap-snaps: the 17 cameras, each on a real spot, pins checked against HDOnTap\'s own camera positions', () => {
  assert.equal(HDONTAP_CAMS.length, 17);
  assert.equal(new Set(HDONTAP_CAMS.map((c) => c.stream)).size, 17, 'one row per camera');
  const src = JSON.parse(read('../../docs/forecast/data/camera-sources.json')), rows: {url?: string; lat?: number; lon?: number}[] = Array.isArray(src) ? src : Object.values(src).find(Array.isArray) as never;
  const km = (a: number, b: number, c: number, d: number) => { const r = Math.PI / 180; return 6371 * Math.hypot((d - b) * r * Math.cos(((a + c) / 2) * r), (c - a) * r); };
  for (const c of HDONTAP_CAMS) {
    const s = evidenceSpots.find((e) => e.id === c.spotId); assert.ok(s, `${c.name}: spot ${c.spotId} exists`);
    const pin = rows.find((r) => JSON.stringify(r).includes(`/${c.stream}/`)); assert.ok(pin && Number.isFinite(pin.lat), `${c.name}: has a pin in camera-sources.json`);
    const d = km(pin!.lat!, pin!.lon!, s!.latitude, s!.longitude);
    assert.ok(Math.abs(d - c.km) <= 0.3, `${c.name}: km ${c.km} vs pin distance ${d.toFixed(2)}`);
    assert.ok(d < 3, `${c.name}: within 3 km of ${c.spotId} (${d.toFixed(2)})`);
  }
});

test('hdontap-snaps: only Venice has a snapshot so far, exactly as HDOnTap sent it; a camera without one shows nothing', () => {
  const withSnap = HDONTAP_CAMS.filter((c) => c.snapshotUrl !== null);
  assert.deepEqual(withSnap.map((c) => c.stream), ['322247']);
  assert.equal(withSnap[0].snapshotUrl, VENICE);
  assert.deepEqual(snapshotCamsFor('cs-venice-breakwater').map((c) => c.stream), ['322247'], 'Venice Wide View (no snapshot yet) is not offered');
  for (const id of ['cs-hermosa', 'cs-malibu', 'cs-el-porto', 'cs-huntington', 'cs-scripps', 'ocean-beach', 'spot-8']) assert.deepEqual(snapshotCamsFor(id), [], `${id}: no snapshot, no block`);
  // the component renders nothing without a snapshot camera, and the switcher only with two or more (the rules in the component's own source)
  const tsx = read('../features/forecast/HdontapSnaps.tsx');
  assert.match(tsx, /if \(!cams\.length\) return null;/);
  assert.match(tsx, /\{cams\.length > 1 && <div className="seg lc-tabs" role="tablist"/);
  assert.equal((tsx.match(/role="tablist"/g) ?? []).length, 1, 'one switcher, and only behind cams.length > 1');
  assert.doesNotMatch(tsx, /coming soon|placeholder/i, 'no placeholder tile');
  assert.doesNotMatch(tsx, /console\./, 'a failed image logs nothing');
});

test('hdontap-snaps: every link is hdontap.com, and the attribution and logo link are word for word', () => {
  assert.equal(HDONTAP_ATTRIBUTION, 'Live Streaming Cams Provided by HDOnTap.com');
  assert.equal(HDONTAP_LOGO_LINK, 'https://hdontap.com/?utm_source=swello&utm_medium=referral&utm_campaign=logo+swello');
  assert.equal(HDONTAP_LOGO.alt, 'HDOnTap');
  for (const f of [HDONTAP_LOGO.light, HDONTAP_LOGO.dark]) assert.ok(fs.existsSync(new URL(`../../public${f}`, import.meta.url)), `${f} is in public/`);
  assert.match(read('../features/forecast/HdontapSnaps.tsx'), /href=\{HDONTAP_LOGO_LINK\}/, 'the logo links to the UTM URL');
  for (const c of HDONTAP_CAMS) {
    assert.equal(hdontapPage(c), `https://hdontap.com/stream/${c.stream}/${c.slug}/`);
    assert.equal(host(hdontapLink(c)), 'hdontap.com', `${c.name}: links to hdontap.com`);
    if (c.linkUrl) assert.equal(host(c.linkUrl), 'hdontap.com');
  }
  assert.equal(host(HDONTAP_LOGO_LINK), 'hdontap.com');
});

test('hdontap-snaps: nothing is proxied: the image comes from HDOnTap\'s host as given, plus only a per-minute cache-bust', () => {
  for (const c of HDONTAP_CAMS.filter((x) => x.snapshotUrl)) assert.equal(host(c.snapshotUrl!), 'portal.hdontap.com', `${c.name}: HDOnTap's own host`);
  const t = Date.UTC(2026, 10, 12, 18, 0, 5);
  assert.equal(snapshotSrc(VENICE, t), `${VENICE}&t=${Math.floor(t / 60000)}`, 'their URL unchanged, one parameter added');
  assert.equal(snapshotSrc(VENICE, t + 50000), snapshotSrc(VENICE, t), 'the same minute asks for the same picture (never faster than a minute)');
  assert.notEqual(snapshotSrc(VENICE, t + 60000), snapshotSrc(VENICE, t), 'the next minute asks again');
  // the snapshot URL lives in the registry only: no worker route, no other source file, nothing that fetches or stores it server-side
  const worker = read('../../worker/index.mjs') + read('../../worker/cloudflare.mjs');
  assert.doesNotMatch(worker, /hdontap\.com\/snapshot|portal\.hdontap\.com/i, 'the Worker never touches HDOnTap snapshots');
  const tsx = read('../features/forecast/HdontapSnaps.tsx');
  assert.doesNotMatch(tsx, /fetch\(|\/api\//, 'the block fetches nothing itself; the browser loads the <img> from HDOnTap');
  assert.match(tsx, /src=\{snapshotSrc\(cam\.snapshotUrl!, now\)\}/);
  assert.match(tsx, /href=\{hdontapLink\(cam\)\}/, 'each snapshot is a link to its own camera page');
  assert.match(tsx, /SNAPSHOT_REFRESH_MS\)/, 'refreshes on the one-minute interval');
});

test('hdontap-snaps: a camera with a snapshot replaces its older HDOnTap link or embed; the rest stay as today', () => {
  assert.equal(hasSnapshot('https://hdontap.com/stream/322247/venice-beach-live-surf-cam/about', 'cs-venice-breakwater'), true, 'any URL form of the stream');
  assert.equal(hasSnapshot('https://hdontap.com/stream/322247/venice-beach-live-surf-cam/about', 'cs-blacks'), false, 'only on the spot the snapshot shows on: another spot keeps its link');
  assert.equal(hasSnapshot('https://hdontap.com/stream/956353/venice-beach-wide-view-live-webcam/about', 'cs-venice-breakwater'), false);
  assert.equal(hasSnapshot('https://mbnep.org/baycam', 'cs-morro-rock'), false);
  assert.deepEqual(camsFor('cs-hermosa'), CAMS.filter((c) => c.spotId === 'cs-hermosa'), 'Hermosa (no snapshot yet) keeps its camera link');
  assert.match(read('../features/forecast/HdontapLinks.tsx'), /!hasSnapshot\(l\.url, spotId\)/);
  assert.match(read('../features/forecast/LiveCam.tsx'), /\.filter\(\(c\) => !hasSnapshot\(c\.pageUrl, spotId\)\)/);
  assert.match(read('../data/cams.ts'), /!hasSnapshot\(c\.url, spotId\)/);
});

test('hdontap-snaps: on the spot page the block sits below the conditions grid (never on a phone\'s first screen); never Surfline', () => {
  const fv = read('../features/forecast/ForecastView.tsx');
  assert.ok(fv.indexOf('<HdontapSnaps') > fv.indexOf('<ConditionsGrid'), 'below the grid');
  assert.doesNotMatch(read('../ocean/hdontapCams.ts') + read('../features/forecast/HdontapSnaps.tsx'), /surfline/i);
});

test('hdontap-snaps (data-honesty review): who runs each camera, neighboring beaches, partial views and a down stream carry over from the camera list', () => {
  for (const c of HDONTAP_CAMS) {
    const row = HDONTAP_LINKS.find((l) => l.url.includes(`/stream/${c.stream}/`)); assert.ok(row, `${c.name}: in the camera list`);
    assert.equal(c.owner, row!.owner === 'Owner not named' ? null : row!.owner, `${c.name}: owner`);
    assert.equal(!!c.partial, row!.partial, `${c.name}: partial view`);
    assert.equal(c.status?.word, row!.status === 'down' ? 'down' : undefined, `${c.name}: down status`);
    if (c.km >= 2) assert.ok(c.neighbour, `${c.name}: ${c.km} km away is said to be a neighboring beach or harbor`);
  }
  assert.equal(ownerWords(HDONTAP_CAMS.find((c) => c.stream === '322247')!), 'Swell Magnet camera via HDOnTap');
  assert.equal(ownerWords(HDONTAP_CAMS.find((c) => c.stream === '255678')!), 'camera streamed on HDOnTap (owner not named)');
  // a camera the list reports down is not shown even once its snapshot arrives (cleared after a re-check)
  const hb = HDONTAP_CAMS.find((c) => c.stream === '255678')!;
  assert.equal(hb.status?.word, 'down');
  const tsx = read('../features/forecast/HdontapSnaps.tsx');
  assert.match(tsx, /ownerWords\(cam\)/); assert.match(tsx, /distanceWords\(/); assert.match(tsx, /only part of the break/);
  assert.match(tsx, /Loaded by your browser .*the picture may be a minute or more older/, 'the time shown is the load time, and says so');
  assert.match(read('../ocean/hdontapCams.ts'), /c\.snapshotUrl !== null && !c\.status/);
});
