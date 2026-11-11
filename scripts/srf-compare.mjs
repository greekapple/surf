#!/usr/bin/env node
// srf-compare: joins our archived "shown" forecasts (howright/v2/shown/<UTC date>.json) with the NWS Surf Zone Forecast ranges for the same spot and valid period.
//   node scripts/srf-compare.mjs [--shown <dir-or-file> ...] [--srf <dir> ...] [--out <dir>] [--date YYYY-MM-DD]
// Defaults: shown = ~/Development/swello-data/srf-compare/r2 (R2 copies) and ~/Development/swello-data/r2/howright/v2/shown; srf = ~/Development/swello-data/surf-height/srf/products (local capture)
// and ~/Development/swello-data/srf-compare/r2srf/products (R2 copies, services/surf-capture.mjs). Output (outside the repo): <out>/srf-compare-<date>.csv and .md; the summary is also printed.
// What is compared, exactly:
//  - THEIRS: the zone's "Surf Height" range for one local calendar day (a `.WEDNESDAY...` period, or TODAY / REST OF TODAY), as the NWS wrote it, from services/srf-parse.mjs. A zone split by facing is matched to the spot by the
//    spot's seaward bearing (src/data/coast.ts) to the nearest facing label within 45 degrees; a tie, a mismatch or no bearing excludes the row (never a guess). "N feet or less" has no lower bound and is excluded from the mid-range
//    comparison (counted); "around N feet" is lo = hi = N. Their mid-range is (lo + hi) / 2.
//  - OURS: the app's surf range (src/services/headlineSurf.ts surfBand: lo, hi of the displayed band) re-derived NOW with the current engine from the hours stored in the shown capture (the same convention as the stored rating),
//    UNCALIBRATED (no personal observations) and WITHOUT the CDIP MOP / SWAN / model-spread inputs (none is in the capture), so it is the v1 offshore-to-break chain, not necessarily what a visitor saw. Our mid-range for a day is the mean of
//    (lo + hi) / 2 over the daylight hours of that local day (isDark), and for a day with the SRF issued the same day only the hours from the issue time on. Hours with no surf estimate are not used; fewer than 4 hours excludes the day.
//  - PAIRING: one row per (spot, local date, capture). For each zone and date the SRF product issued closest in time to the capture is used (the gap is a column). Both forecasts were made at about that time; the lead (hours from the capture to local noon of the date) is a column.
//  - Units: feet both sides. Nothing is calibrated, fitted or adjusted; n is printed everywhere. Spots in one zone share their SRF range, so n_zone_days (distinct zone x date x capture) is shown beside n.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseSrf, pickEntry, MAX_FACING_DIFF} from '../services/srf-parse.mjs';
import {isDark} from '../src/services/daylight.ts';
import {timeZoneOf} from '../src/ocean/spotZone.ts';
import {dateInMs} from '../src/ocean/time.ts';
import {DATA, HOUR, DEFAULT_SHOWN, argsOf, files, readJson, r2, median, csvCell, loadShown, ourHours} from './lib/compare-common.mjs';
import {COAST_ROWS, UPGRADED_ROWS} from '../src/data/coast.ts';

const MIN_HOURS = 4, {multi} = argsOf(process.argv.slice(2));
const shownIn = multi('--shown').length ? multi('--shown') : DEFAULT_SHOWN;
const srfIn = multi('--srf').length ? multi('--srf') : [path.join(DATA, 'surf-height', 'srf', 'products'), path.join(DATA, 'srf-compare', 'r2srf', 'products')];
const outDir = multi('--out')[0] ?? path.join(DATA, 'srf-compare', 'out'), today = multi('--date')[0] ?? new Date().toISOString().slice(0, 10);

const map = readJson(new URL('../docs/forecast/data/surf-height-sources.json', import.meta.url).pathname);
const spotsByZone = new Map();
for (const [id, s] of Object.entries(map.spots)) if (s.nws_srf?.zone) { const k = s.nws_srf.zone; if (!spotsByZone.has(k)) spotsByZone.set(k, []); spotsByZone.get(k).push({id, name: s.name, region: s.region, km: s.nws_srf.km, office: s.nws_srf.office}); }
const seaward = new Map([...UPGRADED_ROWS, ...COAST_ROWS].map((r) => [r[0], r[6]]));

const captures = loadShown(shownIn);
// SRF products, read once per id
const products = new Map();
for (const f of files(srfIn, /\.json$/)) { const p = readJson(f); if (p?.id && typeof p.productText === 'string' && !products.has(p.id)) products.set(p.id, p); }
const parsed = [...products.values()].map(parseSrf);

const hoursOf = (capDate, spotId) => ourHours(captures, capDate, spotId);
const rows = [], excluded = {};
const skip = (why) => { excluded[why] = (excluded[why] ?? 0) + 1; };

for (const [capDate, cap] of captures) {
  const capMs = Date.parse(cap.capturedAt);
  // the product closest in time to this capture for each (zone, date, part day)
  const best = new Map();
  for (const p of parsed) for (const z of p.zones) for (const per of z.periods) {
    if (per.part !== 'day' || !per.date) continue;
    const gap = Math.abs(Date.parse(p.issuedAt) - capMs);
    for (const u of z.ugc) { const k = `${u}|${per.date}`; if (!best.has(k) || gap < best.get(k).gap) best.set(k, {gap, p, z, per, zone: u}); }
  }
  for (const {p, z, per, zone, gap} of best.values()) {
    for (const sp of spotsByZone.get(zone) ?? []) {
      const shown = cap.spots[sp.id]; if (!shown) continue;
      const base = {date: per.date, spot: sp, zone, office: p.office, product: p, per, capDate, cap, gapH: gap / HOUR};
      // THEIRS: the entry for this spot
      const pick = pickEntry(per.surf, seaward.get(sp.id)); if (pick.reason) { skip(pick.reason); continue; }
      const used = pick.entry, diff = pick.diff;
      // OURS: the daylight hours of that local date (from the issue time on when it is the issue day)
      const tz = timeZoneOf(sp.id), from = per.date === z.issued?.date ? Date.parse(p.issuedAt) : -Infinity;
      const mine = [...hoursOf(capDate, sp.id)].filter(([t]) => dateInMs(tz, t) === per.date && t + HOUR > from && !isDark(sp.id, new Date(t).toISOString())).map(([, v]) => v);
      if (![...hoursOf(capDate, sp.id).keys()].some((t) => dateInMs(tz, t) === per.date)) { skip('the capture holds no hours of that local date (its 48 h do not reach it)'); continue; }
      if (mine.length < MIN_HOURS) { skip(`fewer than ${MIN_HOURS} daylight hours with a surf estimate of ours`); continue; }
      const ourMid = mine.reduce((s, v) => s + v.mid, 0) / mine.length, theirMid = (used.lo + used.hi) / 2;
      rows.push({...base, kind: used.kind, facing: used.facing, facingDiff: diff, lo: used.lo, hi: used.hi, theirMid, hours: mine.length, ourMid, ourLo: Math.min(...mine.map((v) => v.lo)), ourHi: Math.max(...mine.map((v) => v.hi)), diff: ourMid - theirMid,
        leadH: (Date.parse(per.date + 'T12:00:00Z') - capMs) / HOUR, extra: used.then || used.sets ? `${used.then ? 'then: ' + used.then : ''}${used.sets ? ' sets to ' + used.sets : ''}`.trim() : ''});
    }
  }
}

const HEAD = ['local_date', 'spot_id', 'spot_name', 'region', 'office', 'zone', 'zone_km', 'product_id', 'product_issued_utc', 'capture_date', 'capture_utc', 'gap_h', 'lead_h', 'their_facing', 'facing_diff_deg', 'their_kind', 'their_lo_ft', 'their_hi_ft', 'their_mid_ft', 'their_extra', 'our_hours', 'our_mid_ft', 'our_lo_min_ft', 'our_hi_max_ft', 'ours_minus_theirs_ft'];
const q = csvCell;
rows.sort((a, b) => a.date.localeCompare(b.date) || a.spot.id.localeCompare(b.spot.id) || a.capDate.localeCompare(b.capDate));
const csv = [HEAD.join(','), ...rows.map((r) => [r.date, r.spot.id, r.spot.name, r.spot.region, r.office, r.zone, r.spot.km, r.product.id, r.product.issuedAt, r.capDate, r.cap.capturedAt, r2(r.gapH), r2(r.leadH), r.facing ?? '', r2(r.facingDiff), r.kind, r.lo, r.hi, r.theirMid, r.extra, r.hours, r2(r.ourMid), r2(r.ourLo), r2(r.ourHi), r2(r.diff)].map(q).join(','))].join('\n') + '\n';

function stat(rs) {
  const d = rs.map((r) => r.diff), zd = new Set(rs.map((r) => `${r.zone}|${r.date}|${r.capDate}`));
  return {n: rs.length, spots: new Set(rs.map((r) => r.spot.id)).size, zoneDays: zd.size, bias: d.length ? d.reduce((s, x) => s + x, 0) / d.length : null, mae: d.length ? d.reduce((s, x) => s + Math.abs(x), 0) / d.length : null, med: median(d), ours: rs.length ? rs.reduce((s, r) => s + r.ourMid, 0) / rs.length : null, theirs: rs.length ? rs.reduce((s, r) => s + r.theirMid, 0) / rs.length : null};
}
const fmt = (s) => `| ${s.n} | ${s.spots} | ${s.zoneDays} | ${r2(s.theirs)} | ${r2(s.ours)} | ${s.bias >= 0 ? '+' : ''}${r2(s.bias)} | ${r2(s.mae)} | ${s.med >= 0 ? '+' : ''}${r2(s.med)} |`;
const group = (key) => { const m = new Map(); for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return [...m].sort((a, b) => b[1].length - a[1].length); };
const table = (title, g) => `### ${title}\n| | n (spot-days) | spots | zone-days | their mid (ft) | our mid (ft) | ours - theirs, mean (ft) | mean abs miss (ft) | median diff (ft) |\n|---|---|---|---|---|---|---|---|---|\n${g.map(([k, rs]) => `| ${k} ${fmt(stat(rs))}`).join('\n')}\n`;
const total = stat(rows), regions = group((r) => r.spot.region), zones = group((r) => `${r.zone} ${r.product.zones.find((z) => z.ugc.includes(r.zone))?.name ?? ''}`);
const lead = (r) => (r.leadH < 12 ? '0-12 h' : r.leadH < 36 ? '12-36 h' : '36 h or more');
const md = `# NWS Surf Zone Forecast vs our shown surf range (generated ${today})

Generated by \`scripts/srf-compare.mjs\`. **Plumbing and first numbers, not a calibration or a verdict.** Method and every exclusion rule are in the script header; in short: their range is the zone's "Surf Height" for one local day (facing matched by the spot's seaward bearing within ${MAX_FACING_DIFF} degrees, else excluded); ours is the app's surf range re-derived now from the stored Open-Meteo hours with the current v1 engine (uncalibrated; no MOP, SWAN or model-spread input, so it may differ from what a visitor saw) as the mean of (lo + hi) / 2 over that day's daylight hours (at least ${MIN_HOURS}); both in feet. "Ours - theirs" above zero means we are higher than the NWS.

**Inputs:** ${captures.size} shown capture(s) (${[...captures.keys()].join(', ') || 'none'}), ${products.size} SRF products from ${new Set(parsed.map((p) => p.office)).size} offices (${[...new Set(parsed.map((p) => p.office))].sort().join(' ')}), issued ${[...products.values()].map((p) => p.issuanceTime).sort()[0]?.slice(0, 10) ?? '-'} to ${[...products.values()].map((p) => p.issuanceTime).sort().at(-1)?.slice(0, 10) ?? '-'}.

## Overall
| | n (spot-days) | spots | zone-days | their mid (ft) | our mid (ft) | ours - theirs, mean (ft) | mean abs miss (ft) | median diff (ft) |
|---|---|---|---|---|---|---|---|---|
| all ${fmt(total)}

**n is small and the rows are not independent:** every spot in a zone is compared with the same SRF range, so the ${total.zoneDays} zone-days are the real number of independent comparisons, and ${captures.size} capture day(s) of ours cover only a few local dates.

${table('By region', regions)}
${table('By lead (capture to local noon of the day)', group(lead))}
${table('By zone', zones)}
## Excluded (not compared)
${Object.entries(excluded).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${v} x ${k}`).join('\n') || '- none'}
(A count is one spot x zone period; the same period can be excluded for many spots of a zone.)
`;
fs.mkdirSync(outDir, {recursive: true});
fs.writeFileSync(path.join(outDir, `srf-compare-${today}.csv`), csv); fs.writeFileSync(path.join(outDir, `srf-compare-${today}.md`), md);
console.log(md); console.error(`wrote ${path.join(outDir, `srf-compare-${today}.csv`)} (${rows.length} rows)`);
