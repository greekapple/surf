import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {LIVE_CAMS, liveCamsFor} from '../data/liveCamsSourced.ts';
import {ageWords, postedLabel, stillState, streamErrorWords, streamLiveness, kmWords, distanceWords, checkedWords, offlineWords, STILL_OFFLINE_MS, STILL_REFRESH_MS} from '../features/forecast/liveCamLogic.ts';
import {createCamMeta, CAM_UA, META_TTL_MS, META_MISS_MS} from '../../services/cam-meta.mjs';
import {evidenceSpots} from '../ocean/spots.ts';

const SOURCES = JSON.parse(fs.readFileSync(new URL('../../docs/forecast/data/camera-sources.json', import.meta.url), 'utf8')).rows as any[], row = (id: string) => SOURCES.find((r) => r.id === id);

test('the committed camera data is exactly what the generator builds from camera-sources.json', () => {
  const built = execFileSync('node', ['scripts/build-live-cams.mjs'], {cwd: new URL('../../', import.meta.url).pathname}).toString();
  assert.equal(fs.readFileSync(new URL('../data/liveCamsSourced.ts', import.meta.url), 'utf8'), built + (built.endsWith('\n') ? '' : '\n'));
});
test('only spots with a usable-now camera row have a camera: Cowell\'s, Steamer Lane (partial), Sharp Park (four streams, west first), Linda Mar; nobody else', () => {
  assert.deepEqual([...new Set(LIVE_CAMS.filter((c) => c.enabled && c.kind !== 'hdontap').map((c) => c.spotId))].sort(), ['cs-sharp-park', 'spot-3', 'spot-6', 'spot-7'], 'only enabled cameras count (HDOnTap embeds are enabled but drawn only when the Worker allows them)');
  for (const s of evidenceSpots) if (!['cs-sharp-park', 'spot-3', 'spot-6', 'spot-7'].includes(s.id)) assert.equal(liveCamsFor(s.id).filter((c) => c.kind !== 'hdontap').length, 0, s.id + ' has no camera row');
  for (const id of ['spot-2', 'cs-kellys-cove', 'cs-sloat', 'cs-rockaway', 'spot-1', 'spot-0', 'spot-4', 'spot-5', 'cs-half-moon-bay', 'cs-princeton-jetty', 'spot-8', 'cs-capitola', 'cs-natural-bridges', 'cs-rodeo-beach']) assert.deepEqual(liveCamsFor(id), [], id);
  assert.deepEqual(liveCamsFor('cs-sharp-park').map((c) => c.rowId), ['chamberlin-sharp-park-west', 'chamberlin-pacifica-pier-north', 'chamberlin-pacifica-pier-closeup', 'chamberlin-mori-point-south']);
  assert.deepEqual(liveCamsFor('spot-3').map((c) => c.rowId), ['linda-mar-beach-cam-youtube']); assert.deepEqual(liveCamsFor('spot-7').map((c) => c.rowId), ['usgs-coastcam-santa-cruz-dream-inn']); assert.deepEqual(liveCamsFor('spot-6').map((c) => c.rowId), ['usgs-coastcam-santa-cruz-dream-inn']);
});
test('every camera comes from a row that is usable now (display permission, live on its check date, not an excluded host) and carries the row\'s own distance, URLs and refresh note', () => {
  for (const c of LIVE_CAMS.filter((c) => c.kind !== 'hdontap')) {   // the HDOnTap embeds are a different case: unknown terms, switched off (hdontap-cams.test.ts)
    const r = row(c.rowId); assert.ok(r, c.rowId); assert.ok(['display-only', 'display+analysis'].includes(r.permissionClass)); assert.equal(r.embedAllowed.value, 'yes'); assert.equal(r.uptime.status, 'live'); assert.doesNotMatch(`${r.host} ${r.owner}`, /surfline|swell ?magnet|magicseaweed/i);
    assert.equal(c.km, r.nearestSpots.find((n: any) => n.id === c.spotId).km, 'the distance is the row\'s'); assert.equal(c.pageUrl, r.pageUrl); assert.equal(c.refresh, r.refresh); assert.equal(c.checked, r.uptime.checked); assert.equal(c.licence, r.licence);
    if (c.kind === 'youtube') { assert.equal(r.embedUrl, `https://www.youtube.com/embed/${c.videoId}`); assert.equal(r.analysisAllowed.value, 'no', 'YouTube rows are display-only: no analysis'); } else assert.equal(c.stillUrl, r.embedUrl);
  }
});
test('the selector names each view in short words, the west view first', () => { assert.deepEqual(liveCamsFor('cs-sharp-park').map((c) => c.tab), ['West', 'Pier, north', 'Pier, close-up', 'Mori Point, south']); assert.ok(liveCamsFor('spot-7').every((c) => !c.tab)); });
test('credits and notes: USGS as its own row says, the channels with a link, Steamer Lane labelled as a partial view, the Linda Mar operator not named, descriptions of the camera (not of one morning)', () => {
  const cow = liveCamsFor('spot-7')[0], lane = liveCamsFor('spot-6')[0], west = liveCamsFor('cs-sharp-park')[0], close = liveCamsFor('cs-sharp-park')[2], lm = liveCamsFor('spot-3')[0];
  assert.equal(cow.credit, 'U.S. Geological Survey, Pacific Coastal and Marine Science Center (public domain)'); assert.equal(cow.credit, row('usgs-coastcam-santa-cruz-dream-inn').attribution); assert.equal(lane.credit, cow.credit);
  assert.equal(lane.view, 'Partial view: West Cliff point; the Lane is mostly out of frame (the Cowells camera)'); assert.doesNotMatch(lane.view, /km|away/, 'the distance is not repeated in the view note'); assert.doesNotMatch(cow.view, /partial/i);
  assert.equal(west.view, 'Sharp Park beach break, looking west'); assert.equal(west.credit, 'Chamberlin Nature (pacificaview.net), live cam via YouTube'); assert.equal(west.channelUrl, 'https://www.youtube.com/channel/UC029bcZGqxOsRkvWrZLhgKQ'); assert.match(west.pageUrl, /^https:\/\/www\.youtube\.com\/watch\?v=lmec_rcEIL4$/);
  assert.equal(lm.view, 'The whole Linda Mar crescent from an elevated hillside, distant (the beach, not a close view of the lineup)'); assert.equal(lm.credit, 'Linda Mar Beach Cam, live cam via YouTube'); assert.equal(lm.creditPublished, 'Live cam: Linda Mar Beach Cam via YouTube'); assert.match(lm.operatorNote!, /^Operator not named/); assert.doesNotMatch(lm.operatorNote!, /anonymous/); assert.equal(lm.channelUrl, 'https://www.youtube.com/channel/UCfE8Al-UWpwUFwa78mrYPVQ');
  for (const c of LIVE_CAMS) assert.doesNotMatch(c.view, /sets and whitewater|9:\d\d|this morning|today|2026-11/i, c.id + ': the note describes the camera, not one morning');
  assert.equal(close.ownerDescribed, true); assert.ok(LIVE_CAMS.filter((c) => c.ownerDescribed).length === 1); assert.ok(cow.offlineNote && /daylight only/.test(cow.offlineNote));
  const lmRow = row('linda-mar-beach-cam-youtube'); assert.equal(lmRow.recheck.date, '2026-11-10'); assert.match(lmRow.recheck.method, /oEmbed.*HTTP 200.*author_name "Linda Mar Beach Cam"/); assert.match(lmRow.recheck.result, /operator is still not named/);
});
test('distances are said as the row knows them: about when the position is approximate, a place and no number when it is unknown', () => {
  const cow = liveCamsFor('spot-7')[0], west = liveCamsFor('cs-sharp-park')[0], lm = liveCamsFor('spot-3')[0];
  assert.equal(distanceWords(cow), 'about 100 m from this spot'); assert.equal(distanceWords(liveCamsFor('spot-6')[0]), 'about 1.3 km from this spot'); assert.equal(distanceWords(west), 'about 400 m from this spot');
  assert.equal(lm.kmUnknown, true); assert.equal(distanceWords(lm), 'on the hillside above the beach (exact position unknown)'); assert.doesNotMatch(distanceWords(lm), /\d/); assert.equal(distanceWords({km: 2, kmApprox: false}), '2 km from this spot');
  for (const c of LIVE_CAMS) assert.equal(!!c.kmApprox || !!c.kmUnknown, true, c.id + ': every position in the list is approximate');
});
test('still rules: live up to 2 h old, Offline after (the frame is not shown), unknown when the time cannot be read; age and time words are in the spot\'s zone', () => {
  const NOW = Date.parse('2026-11-10T18:00:00Z'), at = (min: number) => new Date(NOW - min * 60000).toISOString();
  assert.equal(STILL_OFFLINE_MS, 7200000); assert.equal(STILL_REFRESH_MS, 1800000);
  assert.deepEqual(stillState(at(17), NOW), {state: 'live', postedMs: NOW - 17 * 60000, ageMs: 17 * 60000}); assert.equal(stillState(at(120), NOW).state, 'live', 'exactly 2 h is still live'); assert.equal(stillState(at(121), NOW).state, 'offline');
  assert.equal(stillState(null, NOW).state, 'unknown'); assert.equal(stillState('garbage', NOW).state, 'unknown'); assert.equal(stillState(new Date(NOW + 3600000).toISOString(), NOW).state, 'unknown', 'a time in the future is not trusted');
  assert.equal(ageWords(20000), 'under a minute'); assert.equal(ageWords(17 * 60000), '17 min'); assert.equal(ageWords(80 * 60000), '1 h 20 min'); assert.equal(ageWords(5 * 3600000), '5 h'); assert.equal(ageWords(60 * 3600000), '3 d');
  assert.equal(postedLabel(Date.parse('2026-11-10T17:43:04Z'), 'America/Los_Angeles', NOW), '9:43 AM PST'); assert.match(postedLabel(Date.parse('2026-11-09T17:43:04Z'), 'America/Los_Angeles', NOW), /^Mon, Nov 9, 9:43 AM PST$/, 'another day says the day');
  assert.equal(kmWords(0.1), '100 m'); assert.equal(kmWords(1.3), '1.3 km');
});
test('the pre-tap date is in the app\'s words, and a frame posted near or after sunset says dusk, not a fault', () => {
  assert.equal(checkedWords('2026-11-10'), 'Nov 10, 2026'); assert.equal(checkedWords('2026-01-05'), 'Jan 5, 2026'); assert.equal(checkedWords('garbage'), 'garbage');
  const base = {zone: 'America/Los_Angeles', spotId: 'spot-7', offlineNote: 'USGS collects images in daylight only; an old frame means the camera system may be offline (USGS page).'};
  const dusk = offlineWords({...base, postedMs: Date.parse('2026-11-11T00:50:00Z'), ageMs: 14 * 3600000, nowMs: Date.parse('2026-11-11T14:50:00Z')}), noon = offlineWords({...base, postedMs: Date.parse('2026-11-10T20:00:00Z'), ageMs: 3 * 3600000, nowMs: Date.parse('2026-11-10T23:00:00Z')});
  assert.match(dusk, /^No frame since dusk; USGS collects in daylight only\. The newest was posted Tue, Nov 10, 4:50 PM PST, 14 h ago, so it is not shown\.$/); assert.match(noon, /^The newest frame was posted 12:00 PM PST, 3 h ago, so it is not shown\. USGS collects images in daylight only; an old frame means the camera system may be offline/); assert.doesNotMatch(noon, /dusk/);
});
test('stream rules: the player\'s own words only (error codes, isLive), never a guess', () => {
  assert.match(streamErrorWords(150), /no longer allows this stream to be embedded/); assert.match(streamErrorWords(101), /no longer allows/); assert.equal(streamErrorWords(153), 'The YouTube player could not verify this site (a SWELLO setup problem, not the camera).'); assert.doesNotMatch(streamErrorWords(153), /owner/); assert.match(streamErrorWords(100), /cannot find/); assert.match(streamErrorWords(5), /error \(5\)/);
  assert.equal(streamLiveness({isLive: true}), 'live'); assert.equal(streamLiveness({isLive: false}), 'not-live'); assert.equal(streamLiveness({}), 'unknown'); assert.equal(streamLiveness(undefined), 'unknown'); assert.equal(streamLiveness({isLive: 'yes'}), 'unknown');
});
test('/api/cam-meta: one HEAD request to the owner\'s own fixed URL with the project User-Agent, only the time is returned, an unknown id is a 404, no arbitrary URL, cached 5 minutes (60 s after a miss)', async () => {
  const calls: {url: string; method: string; ua: string}[] = []; let clock = 1000, lm: string | null = 'Tue, 10 Nov 2026 17:43:04 GMT', status = 200;
  const f = (async (u: string, o: {method: string; headers: Record<string, string>}) => { calls.push({url: String(u), method: o.method, ua: o.headers['User-Agent']}); return new Response(null, {status, headers: lm ? {'Last-Modified': lm} : {}}); }) as unknown as typeof fetch;
  const svc = createCamMeta({fetcher: f, now: () => clock}), get = async (id: string) => { const r = await svc.respond(new URL('http://x/api/cam-meta?id=' + encodeURIComponent(id))); return {status: r.status, body: await r.json(), cc: r.headers.get('Cache-Control')}; };
  const a = await get('usgs-dream-inn-c2'); assert.equal(a.status, 200); assert.equal(a.body.lastModified, '2026-11-10T17:43:04.000Z'); assert.deepEqual(Object.keys(a.body).sort(), ['checkedAt', 'id', 'lastModified']); assert.match(a.cc!, /max-age=300/);
  assert.deepEqual(calls, [{url: 'https://cmgp-coastcam.s3-us-west-2.amazonaws.com/cameras/dreaminn/latest/c2_snap.jpg', method: 'HEAD', ua: CAM_UA}]); assert.equal(CAM_UA, 'SWELLO surf forecast prototype');
  clock += META_TTL_MS - 1; await get('usgs-dream-inn-c2'); assert.equal(calls.length, 1, 'held for 5 minutes'); clock += 2; await get('usgs-dream-inn-c2'); assert.equal(calls.length, 2);
  const bad = await get('https://evil.example/x.jpg'); assert.equal(bad.status, 404); assert.equal((await get('')).status, 404); assert.equal(calls.length, 2, 'an unknown id makes no request');
  lm = null; status = 503; clock += META_TTL_MS + 1; const miss = await get('usgs-dream-inn-c2'); assert.equal(miss.body.lastModified, null); assert.equal(miss.body.status, 503); const n = calls.length; clock += META_MISS_MS - 1; await get('usgs-dream-inn-c2'); assert.equal(calls.length, n, 'a miss is remembered 60 s'); clock += 2; await get('usgs-dream-inn-c2'); assert.equal(calls.length, n + 1);
  const down = createCamMeta({fetcher: (async () => { throw new Error('offline'); }) as unknown as typeof fetch}); const r = await down.respond(new URL('http://x/api/cam-meta?id=usgs-dream-inn-c2')); assert.equal((await r.json()).lastModified, null);
});
test('display only, and out of Home and the map: the panel loads nothing from YouTube before a click (no iframe, no thumbnail host, the API script only inside the click), stores no frame, and is used on the spot page only', () => {
  const src = fs.readFileSync(new URL('../features/forecast/LiveCam.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /ytimg\.com|i\.ytimg|youtube-nocookie|autoplay=1&|localStorage|indexedDB|canvas|toDataURL|createImageBitmap|getImageData/); assert.equal((src.match(/<iframe/g) ?? []).length, 1, 'the only iframe is HDOnTap\'s player, created on a tap (switched off for now)'); assert.ok(src.indexOf('<iframe') > src.indexOf('function HdontapCam'), 'no iframe in the YouTube or still components'); assert.match(src, /https:\/\/www\.youtube\.com\/iframe_api/);
  assert.ok(src.indexOf('loadYouTubeApi()') > src.indexOf('const load = () =>'), 'the API is requested only from the click handler'); assert.match(src, /onClick=\{load\}/);
  for (const f of ['../features/home/Welcome.tsx', '../features/explore/ExploreView.tsx', '../features/explore/Callout.tsx']) assert.doesNotMatch(fs.readFileSync(new URL(f, import.meta.url), 'utf8'), /LiveCam|liveCamsSourced/, f);
  assert.match(fs.readFileSync(new URL('../features/forecast/ForecastView.tsx', import.meta.url), 'utf8'), /<LiveCamPanel spotId=\{spot\.id\}/);
  // wording and upkeep of the panel
  assert.doesNotMatch(src, /Live stream|live video|Last seen live by SWELLO|display only|re-rated now/); assert.match(src, /Video stream · /); assert.match(src, /video stream \(live status shown after you tap\)/); assert.match(src, /Live when we last checked it by hand \(\{checkedWords\(cam\.checked\)\}\)\. Tap to load YouTube's player; it shows whether the stream is live now\./); assert.match(src, /<h2 id="lc-h">Camera<\/h2>/);
  assert.match(src, /setInterval\(\(\) => setNow\(Date\.now\(\)\), 60000\)/, 'the age is re-read every minute'); assert.match(src, /addEventListener\('visibilitychange', onVisible\)/); assert.match(src, /removeEventListener\('visibilitychange'/); assert.match(src, /src=\{`\$\{cam\.stillUrl\}\?t=\$\{encodeURIComponent\(meta!\.lastModified!\)\}`\}/, 'the picture\'s address carries the returned time');
  assert.match(src, /Frame posted \{postedLabel\(st\.postedMs, zone, now\)\} \(\{ageWords\(st\.ageMs\)\} ago\); the time stamped on the picture is when USGS took it, usually 10–30 min earlier · new frame every 30 min in daylight\./); assert.match(src, /pauseVideo/); assert.match(src, /lc-dim/); assert.match(src, /view described by the owner, not checked by SWELLO/);
  assert.match(fs.readFileSync(new URL('../data/cams.ts', import.meta.url), 'utf8'), /amended 2026-11-10[\s\S]*Analysing a camera's frames[\s\S]*written permission or public domain/); assert.doesNotMatch(fs.readFileSync(new URL('../data/cams.ts', import.meta.url), 'utf8'), /never embeds, frames or analyses/); assert.match(fs.readFileSync(new URL('../../PRODUCT.md', import.meta.url), 'utf8'), /## Camera rule \(amended 2026-11-10[\s\S]*AI analysis[\s\S]*written permission or public domain/);
});
