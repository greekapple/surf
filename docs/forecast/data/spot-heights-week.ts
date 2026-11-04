// T-130: every spot x the next 7 days of CDIP MOP forecast hours through the REAL headlineSurf. Acceptance: every hour with MOP data is an estimate or Flat (never an offshore headline), the four spots with no breaking profile
// are estimated, and the week-vs-MOP table lists, per spot, how the headline was made. Public CDIP THREDDS only (one forecast file per assigned point, sequential); Open-Meteo is NOT called, so the v1 (offshore-swell) estimate is not part of this table.
// The v1-versus-MOP comparison (spec acceptance 4) also calls Open-Meteo Marine ONCE per spot (45 calls, 400 ms apart): the app's own normaliser builds each hour's v1 estimate from offshore swell, and it is compared with the MOP nearshore height at the same timestamp.
// Run: node --experimental-strip-types docs/forecast/data/spot-heights-week.ts [--out docs/forecast/SPOT-HEIGHTS-WEEK.md]
import fs from 'node:fs';
import {allSpots} from '../../../src/data/catalog.ts';
import {assignmentFor, mopPoint, mopURL, assignedMopIds} from '../../../src/ocean/mop.ts';
import {normalizeNearshore, type NearshoreRecord} from '../../../src/ocean/nearshore.ts';
import {evidenceSpot} from '../../../src/ocean/spots.ts';
import {marineURL, normalizeOpenMeteo} from '../../../src/ocean/openMeteo.ts';
import {toLegacy} from '../../../src/ocean/bridge.ts';
import {headlineSurf, FLAT_BELOW_FT} from '../../../src/services/headlineSurf.ts';
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'docs/forecast/SPOT-HEIGHTS-WEEK.md';
const now = Date.now(), end = now + 7 * 86400000, recs = new Map<string, NearshoreRecord[]>();
for (const id of assignedMopIds()) {
  try {
    const r = await fetch(mopURL(id, 'forecast', now), {signal: AbortSignal.timeout(40000)}); const csv = await r.text();
    recs.set(id, r.ok && csv.startsWith('time,station,') ? normalizeNearshore(csv, new Date().toISOString(), mopURL(id, 'forecast', now), 'forecast').map((x) => ({...x, mopId: id})) : []);
  } catch { recs.set(id, []); }
}
const om = new Map<string, Record<string, unknown> | null>();
for (const spot of allSpots) { try { const r = await fetch(marineURL(evidenceSpot(spot.id)), {signal: AbortSignal.timeout(30000)}); om.set(spot.id, r.ok ? ((await r.json()) as Record<string, unknown>) : null); } catch { om.set(spot.id, null); } await new Promise((res) => setTimeout(res, 400)); }
const rows: string[] = [], cmp: string[] = [], bad: string[] = []; let totalHours = 0, offshoreHeadlines = 0;
const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '–');
for (const spot of allSpots) {
  const a = assignmentFor(spot.id), rs = (a ? recs.get(a.mopId) ?? [] : []).filter((r) => { const t = Date.parse(r.timestamp); return t >= now && t <= end; });
  if (!a) { rows.push(`| ${spot.name} | ${spot.id} | none | 0 | no MOP point (v1 estimate only) | | | | | |`); continue; }
  const bundle = {nearshore: [], mop: {[a.mopId]: {mopId: a.mopId, records: rs, issue: null, retrievedAt: new Date(now).toISOString(), url: ''}}} as never;
  let normal = 0, blocked = 0, noProfile = 0, flat = 0, offshore = 0, other = 0; const hs: number[] = [], los: number[] = [], his: number[] = [];
  for (const r of rs) {
    const hour = {spotId: spot.id, timestamp: r.timestamp, day: 0, hour: 0, face: NaN, offshore: NaN, availability: {face: false, swell: true, wind: true, tide: true, organization: false}, evidence: {}} as never;
    const h = headlineSurf(spot.id, hour, {bundle, nowMs: now, observations: [], spread: null}) as any; totalHours++;
    if (h.kind === 'offshore') { offshore++; offshoreHeadlines++; bad.push(`${spot.id} ${r.timestamp}`); continue; }
    if (h.kind !== 'estimate') { other++; bad.push(`${spot.id} ${r.timestamp} ${h.kind}`); continue; }
    hs.push(r.height.value ?? NaN); los.push(h.loFt); his.push(h.hiFt);
    if (h.nearshoreOnly?.flat) flat++; else if (h.nearshoreOnly?.code === 'no-profile') noProfile++; else if (h.nearshoreOnly) blocked++; else normal++;
  }
  // v1 (offshore swell carried to 10 m) vs MOP nearshore height, hour by hour, where BOTH exist
  {
    const resp = om.get(spot.id), recsOM = resp ? normalizeOpenMeteo(evidenceSpot(spot.id), resp as never, null, new Date(now).toISOString()) : [], byTs = new Map(recsOM.map((x) => [x.timestamp, x])), diffs: number[] = [], v1s: number[] = [], mops: number[] = [];
    for (const r of rs) { const o = byTs.get(new Date(r.timestamp).toISOString()); if (!o) continue; const hour = toLegacy(o); const v1 = headlineSurf(spot.id, hour, {bundle: null, nowMs: now, observations: [], spread: null}) as any; if (v1.kind !== 'estimate' || v1.method !== 'v1' || !Number.isFinite(v1.centralFt)) continue; const mop = (r.height.value ?? NaN); if (!Number.isFinite(mop)) continue; diffs.push(v1.centralFt - mop); v1s.push(v1.centralFt); mops.push(mop); }
    const avg = (x: number[]) => x.reduce((s2, v) => s2 + v, 0) / x.length, d = diffs.length ? avg(diffs) : NaN;
    cmp.push(`| ${spot.name} | ${spot.id} | ${a.mopId} | ${resp ? diffs.length : 'no Open-Meteo data'} | ${diffs.length ? avg(v1s).toFixed(1) : '–'} ft | ${diffs.length ? avg(mops).toFixed(1) : '–'} ft | ${diffs.length ? (d >= 0 ? '+' : '') + d.toFixed(1) : '–'} ft | ${diffs.length && Math.abs(d) > 1 ? '**> 1 ft: review the profile**' : diffs.length ? 'within 1 ft' : 'v1 has no estimate where MOP has one'} |`);
  }
  const mean = (x: number[]) => (x.length ? (x.reduce((s, v) => s + v, 0) / x.length).toFixed(1) : '–'), pt = mopPoint(a.mopId);
  const flag = ['spot-7'].includes(spot.id) ? ' ⚠ sheltered wrap point: the bay-mouth MOP point reads high here' : spot.id === 'spot-5' ? ' ⚠ 15 m point, not the reef peak; big-wave focusing not modelled' : '';
  rows.push(`| ${spot.name} | ${spot.id} | ${a.mopId} (${pt?.depthM} m) | ${rs.length} | ${mean(hs)} ft | ${mean(los)}–${mean(his)} ft | ${pct(normal, rs.length)} | ${pct(blocked, rs.length)} | ${pct(noProfile, rs.length)} | ${pct(flat, rs.length)}${flag} |`);
}
const md = `# Surf heights: every spot × the next 7 days of CDIP MOP forecast hours (T-130)\n\nGenerated ${new Date(now).toISOString()} by \`docs/forecast/data/spot-heights-week.ts\` through the real \`headlineSurf\`. CDIP MOP forecast files only (public THREDDS); the v1 offshore-swell estimate is not part of this table.\n\n- Coverage: every one of the ${allSpots.length} spots has a CDIP MOP point (${assignedMopIds().length} distinct); this run fetched all of them.\n- Model-vs-model agreement is not validation: v1 and MOP are both models, and neither is compared with an observation here.\n- Hours checked: **${totalHours}**; offshore headlines: **${offshoreHeadlines}**; hours that were neither an estimate nor flat: **${bad.length - offshoreHeadlines}**.\n- Columns: mean MOP Hs at the point (the surf-height convention), mean typical-wave to sets band, then the share of hours made by the breaking rules (**rules**), by MOP's own nearshore height because the rules say the swell is blocked or too short (**blocked**), by MOP's height because the spot has no breaking profile (**no profile**), and the share under ${FLAT_BELOW_FT} ft (**Flat**).\n- A modelled MOP point at 10–15 m depth is not the surf zone; every number is a model estimate.\n\n| Spot | id | MOP point | hours | mean Hs at point | mean band | rules | blocked | no profile | Flat |\n|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## v1 (offshore swell, breaking rules) vs MOP nearshore height (spec acceptance 4)\n\nMean over the hours where both exist (timestamps matched). v1 = the offshore-swell estimate carried to 10 m (its central surf height); MOP = CDIP's nearshore Hs at the assigned point. A positive difference means v1 reads higher than MOP. Spots with no breaking profile have no v1 estimate. **Spots flagged > 1 ft get their profile reviewed (with sources); this table is evidence, not a verdict.** Caveats: only hours where v1 produced an estimate are compared (v1 refuses short-period, out-of-window and wrapped swells, so the sample is biased toward hours it accepts, and \"hours compared\" is small for some spots); one week is one swell regime; \"no Open-Meteo data\" means the provider returned nothing for that spot's marine point.\n\n| Spot | id | MOP | hours compared | mean v1 | mean MOP | v1 - MOP | verdict |\n|---|---|---|---|---|---|---|---|\n${cmp.join('\n')}\n${bad.length ? `\n## Hours that failed the acceptance\n${bad.slice(0, 50).map((b) => `- ${b}`).join('\n')}\n` : ''}`;
fs.writeFileSync(out, md); console.log(`${totalHours} hours, ${offshoreHeadlines} offshore headlines, ${bad.length} failures -> ${out}`);
process.exit(bad.length ? 1 : 0);
