#!/usr/bin/env node
// Create the Obsidian note of an app spot that has none (vault-notes-bay), in the style of the existing app-spot notes (Spot-Asilomar.md): frontmatter with spot_id, Coverage, Published facts, Tide, Weather zone,
// Buoys, Sources. Only the repo's SOURCED data is written: the guide facts as their own strings (src/ocean/spotFactsSourced.ts, from docs/forecast/data/guide-facts.json) with their source links, the MOP point and its
// own note, the tide station the app uses, the NWS zone and the buoys the app uses. Nothing is invented or paraphrased into a new claim; a field the guides do not state is not written.
//   node --experimental-strip-types --no-warnings scripts/vault-spot-notes.mjs [--dry-run] [--vault <Spots dir>] id [id ...]
// CREATE-ONLY: a spot that already has a note (by spot_id, or the target file name) is skipped, never overwritten. Never touches 99-Private or .obsidian. Run scripts/vault-forecast-log.mjs afterwards for the forecast block.
import fs from 'node:fs';
import path from 'node:path';
import {evidenceSpot} from '../src/ocean/spots.ts';
import {assignmentFor} from '../src/ocean/mop.ts';
import {guideFactsFor} from '../src/ocean/spotFactsSourced.ts';
import {enablement} from '../src/ocean/spotFactsRules.ts';
import {scannedMopCandidates} from '../src/ocean/mopCandidatesSourced.ts';
import {tideStationFor} from '../src/ocean/tideStations.ts';
import {zoneFor} from '../src/services/nwsZones.ts';
import {buoysNear} from '../src/ocean/buoys.ts';
import {chooseBuoy, windowOf} from '../src/ocean/scoringBuoys.ts';
import {walk, frontmatterOf, DEFAULT_VAULT} from './vault-forecast-log.mjs';

const TODAY = '2026-11-10';
const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
export const noteName = (name) => `Spot-${name.replace(/[’']/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}.md`;
const has = (vault, base) => walk(path.dirname(vault)).some((f) => path.basename(f, '.md') === base);   // a Src-/Region- note anywhere in the project's vault
const link = (vault, base, label) => (has(vault, base) ? `[[${base}${label ? `|${label}` : ''}]]` : label ?? base);
const span = (f) => (f ? `${f.min}–${f.max} ft` : null);

/** The county's region fields, copied from the existing notes of the same county (never invented). */
function regionOf(vault, county) {
  for (const f of walk(vault)) { const t = fs.readFileSync(f, 'utf8'), fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(t)?.[1] ?? ''; if (new RegExp(`^county:\\s*"?${county}"?\\s*$`, 'm').test(fm)) { const cr = /^coast_region:\s*(.*)$/m.exec(fm)?.[1], rn = /^region_note:\s*(.*)$/m.exec(fm)?.[1]; if (cr && rn) return {coast: cr.trim(), note: rn.trim()}; } }
  return null;
}
export function noteFor(id, vault = DEFAULT_VAULT) {
  const e = evidenceSpot(id), g = guideFactsFor(id); if (!e || !g) return null;
  const mop = assignmentFor(id), en = enablement(g), reg = regionOf(vault, e.region), cand = scannedMopCandidates.find((x) => x.spotId === id)?.mopIds ?? [];
  const cov = mop ? 'v2' : en.estimate ? 'v1' : 'refused', regionLink = reg?.note.replace(/^"|"$/g, '') ?? e.region, facing = g.facing?.text ?? '';
  const out = [];
  out.push('---', 'type: reference', 'project: SWELLO', 'status: active', `updated: ${TODAY}`, `summary: ${q(`${e.name} (${e.region}): facing ${facing || 'unknown'}; coverage ${cov}.`)}`, `source: "repo src/ocean/spotFactsSourced.ts, src/ocean/mop.ts"`, 'aliases:', `  - ${q(e.name)}`, 'tags:', '  - swello/spot', `  - swello/coverage/${cov}`, 'related:', '  - "[[Spots-Index]]"', 'kind: spot', `spot_id: ${id}`, `county: ${q(e.region)}`,
    `coast_region: ${reg?.coast ?? q(e.region)}`, `region_note: ${reg?.note ?? q(e.region)}`, `coverage: ${cov}`, `mop: ${q(mop?.mopId ?? '')}`, `facing: ${q(facing)}`, 'has_photo: false', `lat: ${e.latitude}`, `lon: ${e.longitude}`, '---');
  out.push(`# ${e.name}`, `${e.region} · id \`${id}\` · map point ${e.latitude}, ${e.longitude.toFixed ? e.longitude.toFixed(3) : e.longitude} (approximate public position, not a surveyed takeoff) · break type ${String(e.breakType).toLowerCase()}. Region: ${regionLink}. Hub: [[Spots-Index]].`, '');
  out.push('## Coverage');
  if (mop) out.push(`**v2** (CDIP MOP ${mop.mopId}). Since [[T-077]] a nearshore refusal shows the labelled offshore height, never v1; v1 only when no usable nearshore record exists.`, `- MOP point ${link(vault, 'Src-CDIP-MOP', mop.mopId)}: ${mop.note}`);
  else if (en.estimate) out.push('**v1** (offshore swell carried to the beach; no CDIP point within the facing tolerance).', ...(cand.length ? [`- Nearest CDIP MOP candidates (not assigned): ${cand.join(', ')}.`] : []));
  else out.push(`**Refused** (labelled offshore height only): ${en.reasons.join('; ')}.`, ...(cand.length ? [`- Nearest CDIP MOP candidates (not assigned): ${cand.join(', ')}.`] : []));
  out.push('', '## Published facts');
  out.push(`- **Facing:** ${g.facing ? `${g.facing.text} (${g.facing.deg}°), basis: ${g.facing.basis}.` : 'no single facing published.'}`);
  if (g.swellWindow) out.push(`- **Swell window:** ${g.swellWindow.text} (${g.swellWindow.fromDeg}°–${g.swellWindow.toDeg}°, from the guide's swell ${g.swellWindow.basis}); clamped to ±60° of the facing in the estimate.`);
  if (g.workable) out.push(`- **Workable swell:** ${g.workable.text}.`);
  if (g.idealSwell) out.push(`- **Ideal swell:** ${g.idealSwell}.`);
  out.push(`- **Period:** ${g.minimumPeriodS ? `minimum ${g.minimumPeriodS} s.` : 'no spot minimum published; the generic 8 s threshold applies (`GENERIC_MIN_PERIOD_S`).'}`);
  if (g.tide || g.windOffshore) out.push(`- ${[g.tide ? `**Best tide:** ${g.tide}.` : '', g.windOffshore ? `**Offshore wind:** ${g.windOffshore}.` : ''].filter(Boolean).join(' ')}`);
  if (g.bottom || g.exposure) out.push(`- ${[g.bottom ? `**Bottom:** ${g.bottom}.` : '', g.exposure ? `**Exposure:** ${g.exposure}.` : ''].filter(Boolean).join(' ')}`);
  if (g.waveType && g.waveType !== 'not stated') out.push(`- **Wave type:** ${g.waveType}.`);
  if (g.sizeFt) out.push(`- **Size range (guide):** ${span(g.sizeFt)}.`);
  if (g.hazards?.length) out.push(`- **Hazards (not complete):** ${g.hazards.join(', ')}.`);
  if (g.season) out.push(`- **Season:** ${g.season}.`);
  if (g.notes) out.push(`- Note: ${g.notes}`);
  // tide, weather zone, buoys: what the app uses for this spot
  const t = tideStationFor(e); out.push('', '## Tide');
  if (t) out.push(`- Spot-page tide: ${link(vault, `Src-CO-OPS-${t.station.id}`, `CO-OPS ${t.station.id} ${t.station.name}`)}, ${t.distanceKm} km (${t.fallback ? `${t.fallbackLabel ?? 'inlet or bay-side station'}, used only because no open-coast station is within 40 km` : 'an open-coast station, picked by the app'}); labelled station tide, not beach tide. ${t.station.url ?? ''}`.trim());
  else out.push('- Spot-page tide: none. No open-coast tide station within 40 km (harbour and bay gauges are not used).');
  const z = zoneFor(id); out.push('', '## Weather zone and buoys', `- NWS alerts zone: ${z ? `${z.zone}${z.approx ? ` (borrowed from ${z.viaSpot}, within 15 km; the beach point is not in a land zone)` : ''}` : 'none (no land zone resolved)'} (${link(vault, 'Src-NWS-Alerts', 'NWS alerts')}).`);
  const bs = buoysNear(e.latitude, e.longitude); if (bs.length) out.push(`- Buoys shown as context: ${bs.map((b) => `${link(vault, `Src-${b.provider}-${b.id.replace(/p1$/, '')}`, `${b.provider} ${b.id}`)} ${b.place}`).join('; ')}.`);
  const pick = chooseBuoy({lat: e.latitude, lon: e.longitude}, windowOf(id)); out.push(`- Reference buoy for the observed-offshore check ("how right we've been"): ${pick.ok ? `${link(vault, `Src-NDBC-${pick.pick.buoy.id}`, `NDBC ${pick.pick.buoy.id}`)} ${pick.pick.buoy.name}, ${Math.round(pick.pick.km)} km` : `none (${pick.reason})`}.`);
  out.push('', '## Sources', ...g.sources.map((s) => `- ${s.title}: ${s.url} (retrieved ${s.retrievedOn})`), '- Repo: `src/ocean/spotFactsSourced.ts` (generated from `docs/forecast/data/guide-facts.json`), `src/ocean/mop.ts`, `src/ocean/tideStations.ts`, `src/services/nwsZones.ts`, `docs/forecast/SPOT-FACTS-REVIEW.md`. See [[Src-Spot-Guides]], [[T-071]], [[T-073]].', '');
  return {file: noteName(e.name), text: out.join('\n')};
}
export function run({vault = DEFAULT_VAULT, ids = [], dryRun = false, log = console.log} = {}) {
  const existing = new Set(walk(vault).map((f) => { const fm = frontmatterOf(fs.readFileSync(f, 'utf8')); return fm.id; }).filter(Boolean)), res = {created: [], skipped: []};
  for (const id of ids) {
    const n = noteFor(id, vault); if (!n) { res.skipped.push([id, 'no spot or no guide facts']); continue; }
    const f = path.join(vault, n.file);
    if (existing.has(id) || fs.existsSync(f)) { res.skipped.push([id, 'already has a note']); continue; }
    if (dryRun) log(`--- would create ${f}\n${n.text}`); else fs.writeFileSync(f, n.text);
    res.created.push(f);
  }
  log(`${dryRun ? 'DRY RUN: ' : ''}${res.created.length} note(s) ${dryRun ? 'would be created' : 'created'}, ${res.skipped.length} skipped${res.skipped.length ? ': ' + res.skipped.map((x) => x.join(' (') + ')').join('; ') : ''}`);
  return res;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const a = process.argv.slice(2), vi = a.indexOf('--vault'), vault = vi >= 0 ? a[vi + 1] : DEFAULT_VAULT, ids = a.filter((x, i) => !x.startsWith('--') && !(vi >= 0 && i === vi + 1));
  run({vault, ids, dryRun: a.includes('--dry-run')});
}
