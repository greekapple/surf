// 4B (round 4): what the onshore-wind rating cap (onshore over 12 mph -> at most 39, the top of "poor") changes, for every spot over the current 7-day forecast.
// Two steps, run on the same saved inputs so before and after differ only by the engine:
//   CACHE=<dir> node --experimental-strip-types docs/forecast/data/onshore-cap-change.ts fetch          (Open-Meteo marine + wind for all spots, saved to <dir>; NOW fixed then)
//   CACHE=<dir> node --experimental-strip-types docs/forecast/data/onshore-cap-change.ts dump <out.tsv>  (rates every saved hour with THIS checkout's engine)
// Run `dump` once in a checkout of the old engine and once here, then `compare <before.tsv> <after.tsv>`, which checks that no hour rises, that every hour
// without onshore wind over 12 mph keeps its score and word (and counts those whose rating object still differs, by SHA-1), and prints the changed hours. Public keyless data; ~0.3 s between requests.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {evidenceSpots} from '../../../src/ocean/spots.ts';
import {marineURL, weatherURL, normalizeOpenMeteo} from '../../../src/ocean/openMeteo.ts';
import {rateOcean} from '../../../src/ratings/adapters.ts';
import {angle} from '../../../src/utils/units.ts';
import {timeZoneOf} from '../../../src/ocean/spotZone.ts';

const [mode, a, b] = process.argv.slice(2), CACHE = process.env.CACHE ?? '';
const file = (u: string) => `${CACHE}/${createHash('sha1').update(u).digest('hex')}.json`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
if (mode === 'fetch') {
  fs.mkdirSync(CACHE, {recursive: true});
  const urls = [...new Set(evidenceSpots.flatMap((s) => [marineURL(s), weatherURL(s)]))]; let n = 0, failed = 0;
  for (const u of urls) {
    if (fs.existsSync(file(u))) continue;
    for (let i = 0; i < 4; i++) {
      try { const r = await fetch(u, {headers: {'User-Agent': 'SWELLO surf forecast prototype'}, signal: AbortSignal.timeout(60000)}); if (r.ok) { fs.writeFileSync(file(u), await r.text()); break; } } catch { /* retry */ }
      await sleep(3000 * (i + 1)); if (i === 3) { failed++; console.warn('FAILED', u); }
    }
    if (++n % 100 === 0) console.log(n, '/', urls.length); await sleep(300);
  }
  if (!fs.existsSync(`${CACHE}/now.txt`)) fs.writeFileSync(`${CACHE}/now.txt`, String(Date.now()));
  console.log('urls', urls.length, 'failed', failed);
} else if (mode === 'dump') {
  const NOW = Number(fs.readFileSync(`${CACHE}/now.txt`, 'utf8')), retrieved = new Date(NOW).toISOString(), rows: string[] = [];
  const read = (u: string) => fs.existsSync(file(u)) ? JSON.parse(fs.readFileSync(file(u), 'utf8')) : null;
  for (const s of evidenceSpots) {
    for (const r of normalizeOpenMeteo(s, read(marineURL(s)), read(weatherURL(s)), retrieved)) {
      const t = Date.parse(r.timestamp); if (t < NOW - 3600000 || t >= NOW + 7 * 86400000) continue;
      const q = rateOcean(s, r, NOW), ws = r.windSpeed.value, wd = r.windDirection.value;
      const rel = s.orientation === null || wd === null ? 'unknown' : angle(wd, s.orientation + 180) < 45 ? 'offshore' : angle(wd, s.orientation) < 45 ? 'onshore' : 'cross-shore';
      rows.push([s.id, s.name, s.region, timeZoneOf(s.id), r.timestamp, q.score ?? '', q.category, ws ?? '', wd ?? '', rel, createHash('sha1').update(JSON.stringify(q)).digest('hex')].join('\t'));
    }
  }
  fs.writeFileSync(a, 'id\tname\tregion\ttz\ttime\tscore\tcategory\twindMph\twindDir\trelation\tsha1\n' + rows.join('\n') + '\n');
  console.log('spots', evidenceSpots.length, 'hours', rows.length);
} else if (mode === 'compare') {
  const load = (p: string) => fs.readFileSync(p, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
  const A = load(a), B = load(b); if (A.length !== B.length) throw new Error(`row counts differ: ${A.length} vs ${B.length}`);
  const band = (c: string) => ['WEAK', 'POOR'].includes(c) ? 'poor' : ['NOT BAD', 'SURFABLE'].includes(c) ? 'fair' : ['EPIC', 'FIRING', 'GOOD', 'SOLID'].includes(c) ? 'good' : c.toLowerCase();
  let rose = 0, otherChanged = 0, otherRecordOnly = 0, strong = 0, strongSame = 0; const changed: string[][] = [];
  for (let i = 0; i < A.length; i++) {
    const x = A[i], y = B[i]; if (x[0] !== y[0] || x[4] !== y[4]) throw new Error(`row ${i} misaligned`);
    const isStrong = x[9] === 'onshore' && Number(x[7]) > 12;
    if (x[5] !== '' && y[5] !== '' && Number(y[5]) > Number(x[5])) rose++;
    if (!isStrong) { if (x.slice(0, 10).join('\t') !== y.slice(0, 10).join('\t')) otherChanged++; else if (x[10] !== y[10]) otherRecordOnly++; continue; }
    strong++; if (x[10] === y[10]) { strongSame++; continue; }
    const local = new Intl.DateTimeFormat('en-US', {timeZone: x[3], weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', timeZoneName: 'short'}).format(new Date(x[4]));
    changed.push([x[1], x[2], local, x[5], x[6], band(x[6]), y[5], y[6], band(y[6]), Number(x[7]).toFixed(1), x[8]]);
  }
  console.log(JSON.stringify({hours: A.length, onshoreOver12: strong, onshoreOver12Unchanged: strongSame, changed: changed.length, rose, otherHoursScoreOrWordChanged: otherChanged, otherHoursSameScoreRecordChanged: otherRecordOnly,
    bandMoves: changed.reduce((m: Record<string, number>, c) => (m[`${c[5]} -> ${c[8]}`] = (m[`${c[5]} -> ${c[8]}`] ?? 0) + 1, m), {}),
    spotsWithChanges: new Set(changed.map((c) => c[0])).size}, null, 1));
  if (b && process.argv[5]) fs.writeFileSync(process.argv[5], '| Spot | Region | Hour (spot time) | Old | New | Wind (mph, from °) |\n|---|---|---|---|---|---|\n' + changed.map((c) => `| ${c[0]} | ${c[1]} | ${c[2]} | ${c[3]} ${c[4]} (${c[5]}) | ${c[6]} ${c[7]} (${c[8]}) | onshore ${c[9]} from ${c[10]}° |`).join('\n') + '\n');
  if (rose || otherChanged) process.exitCode = 1;
}
