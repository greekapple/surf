#!/usr/bin/env node
// Each app spot's daily forecast in its Obsidian note (vault-forecast-log).
//   node --experimental-strip-types scripts/vault-forecast-log.mjs [--dry-run] [--vault <Spots dir>] [--dir <local R2 copy>] [--days N] [--keep 14] [--now <ISO>] [--show N]
// Reads the newest COMPLETE daily capture (howright/v2/shown/<UTC date>.json, services/how-right-all.mjs) and the scorecard (howright/v2/scorecard.json) from R2 (`wrangler r2 object get`, remote) or a local
// copy of the bucket (--dir). For every APP spot it finds the spot's note under <vault> (frontmatter `spot_id` first, then an unambiguous name or alias; the misses are reported) and writes or replaces ONE managed
// block between `<!-- swello:forecast-log start -->` and `<!-- swello:forecast-log end -->` under a "## Forecast log" heading; nothing outside the block changes (a note with no block gets the heading and block at its end).
// The block: a table of the last 14 capture days (the next 48 h re-rated with the CURRENT engine from the stored marine and wind inputs: the best daylit window and its rating word, the offshore Hs range, the wind, the age of
// the model run), the How-right lines verbatim when the scorecard has numbers (else "collecting: N days"), and a source line. Values come from the capture only; nothing is estimated. Idempotent: the same capture
// gives the same block (a second run changes nothing); older rows are read back from the block itself. Never touches 99-Private or .obsidian, and creates no scheduled job (the launchd plist is in docs/forecast/VAULT-FORECAST-LOG.md).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {evidenceSpots} from '../src/ocean/spots.ts';
import {ratingAt} from '../src/services/coastSnapshot.ts';
import {offshoreLine, ratingLine, collectingText} from '../src/services/howRightAll.ts';
import {timeZoneOf} from '../src/ocean/spotZone.ts';
import {createCoastRatings} from '../services/coast-ratings.mjs';

export const START = '<!-- swello:forecast-log start -->', END = '<!-- swello:forecast-log end -->', HEADING = '## Forecast log', KEEP_DAYS = 14, BUCKET = 'swello-forecast-cache';
const HOUR = 3600000, FT = 1 / 0.3048, BLOCKED = /(^|[\\/])(99-Private|\.obsidian|node_modules|\.git)([\\/]|$)/;
export const DEFAULT_VAULT = path.join(os.homedir(), 'Knowledge/AI-Knowledge/10-Projects/SWELLO/Spots');

/* ---------- notes: id -> note ---------- */
const norm = (n) => String(n).toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
export function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) { const p = path.join(dir, e.name); if (BLOCKED.test(p)) continue; if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.md')) out.push(p); }
  return out;
}
export function frontmatterOf(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text); if (!m) return {id: null, aliases: [], title: null};
  const id = /^spot_id:\s*"?([^"\r\n]+?)"?\s*$/m.exec(m[1])?.[1] ?? null, aliases = [...(/^aliases:\s*\r?\n((?:\s+-\s.*\r?\n?)+)/m.exec(m[1])?.[1] ?? '').matchAll(/^\s+-\s+"?(.*?)"?\s*$/gm)].map((x) => x[1]);
  return {id, aliases, title: /^#\s+(.+?)\s*$/m.exec(text.slice(m[0].length))?.[1] ?? null};
}
/** The map spot id -> note path, the spots with no note, notes that are ambiguous by name, and notes whose spot_id is not an app spot. */
export function mapNotes(vault, spots) {
  const files = walk(vault), byId = new Map(), byName = new Map(), info = new Map(); let stale = 0;
  const ids = new Set(spots.map((s) => s.id));
  for (const f of files) {
    const fm = frontmatterOf(fs.readFileSync(f, 'utf8')); info.set(f, fm);
    if (fm.id) { if (ids.has(fm.id)) { if (!byId.has(fm.id)) byId.set(fm.id, f); } else stale++; }
    else for (const n of [fm.title, ...fm.aliases]) if (n) { const k = norm(n); if (!byName.has(k)) byName.set(k, new Set()); byName.get(k).add(f); }
  }
  const map = new Map(byId), ambiguous = [], missing = [];
  for (const s of spots) {
    if (map.has(s.id)) continue;
    const hit = byName.get(norm(s.name));
    if (hit && hit.size === 1) { const f = [...hit][0]; if (![...map.values()].includes(f)) { map.set(s.id, f); continue; } }
    if (hit && hit.size > 1) ambiguous.push(s.id); else missing.push(s.id);
  }
  return {map, missing, ambiguous, stale, notes: files.length};
}

/* ---------- the numbers (from the capture only) ---------- */
const word = (c) => (c === 'UNRATED' ? 'Unrated' : c.charAt(0) + c.slice(1).toLowerCase());
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'], compass = (d) => COMPASS[Math.round((((d % 360) + 360) % 360) / 22.5) % 16];
const zoneAbbr = (tz, ms) => new Intl.DateTimeFormat('en-US', {timeZone: tz, timeZoneName: 'short'}).formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName')?.value ?? tz;
const fmtDay = (tz, ms) => new Intl.DateTimeFormat('en-US', {timeZone: tz, weekday: 'short', month: 'short', day: 'numeric'}).format(new Date(ms));
const fmtHour = (tz, ms) => new Intl.DateTimeFormat('en-US', {timeZone: tz, hour: 'numeric'}).format(new Date(ms));
const fmtStamp = (tz, ms) => `${new Intl.DateTimeFormat('en-US', {timeZone: tz, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}).format(new Date(ms))} ${zoneAbbr(tz, ms)}`;
const range = (a, d = 1) => { const v = a.filter((x) => Number.isFinite(x)); return v.length ? [Math.min(...v), Math.max(...v)].map((x) => +x.toFixed(d)) : null; };
/** One capture day's row for one spot: the next 48 h re-rated now, from the capture's own marine and wind hours. */
export function rowFor(spotId, cap, tz = timeZoneOf(spotId)) {
  const c = cap.spots[spotId]; if (!c?.marine?.time?.length) return null;
  const hours = c.marine.time.map((t) => ({t, e: ratingAt(spotId, c, t)})), rated = hours.filter((h) => h.e && h.e[0] !== null), day = rated.filter((h) => h.e[2] === 0);
  let window, bestT = null;
  if (day.length) {
    const best = day.reduce((b, h) => (h.e[0] > b.e[0] ? h : b), day[0]), idx = hours.indexOf(best), same = (h) => h?.e && h.e[0] !== null && h.e[2] === 0 && h.e[1] === best.e[1];
    let a = idx, z = idx; while (same(hours[a - 1])) a--; while (same(hours[z + 1])) z++;
    const t0 = hours[a].t * 1000, t1 = hours[z].t * 1000 + HOUR; bestT = best.t; window = `${fmtDay(tz, t0)} ${fmtHour(tz, t0)}–${fmtHour(tz, t1)} ${zoneAbbr(tz, t0)}: ${word(best.e[1])} (peak ${best.e[0]})`;
  } else window = rated.length ? 'no daylit hour rated (dark hours only)' : 'not rated';
  const hs = c.marine.wave_height, unit = c.marineUnits?.wave_height ?? 'm', m = unit === 'ft' ? 1 / FT : 1, hr = range(hs.map((v) => (v === null ? NaN : v * m)));
  const wspd = c.wind?.wind_speed_10m ?? [], wr = range(wspd.map((v) => (v === null ? NaN : v)), 0), wunit = (c.windUnits?.wind_speed_10m ?? 'mph').replace('mp/h', 'mph');
  const wi = bestT === null ? -1 : (c.wind?.time?.indexOf(bestT) ?? -1), wd = wi >= 0 ? c.wind.wind_direction_10m?.[wi] : null;
  const span = (a, b, u) => (a === b ? `${a} ${u}` : `${a}–${b} ${u}`), ft = hr ? [Math.round(hr[0] * FT), Math.round(hr[1] * FT)] : null;
  const ran = Math.min(Date.parse(c.retrievedAt), Date.parse(c.windRetrievedAt)), ageH = (Date.parse(cap.capturedAt) - ran) / HOUR;
  return {
    date: cap.date, captured: fmtStamp(tz, Date.parse(cap.capturedAt)), window,
    hs: hr ? `${span(hr[0], hr[1], 'm')} (${span(ft[0], ft[1], 'ft')})` : 'no value',
    wind: wr ? `${span(wr[0], wr[1], wunit)}${Number.isFinite(wd) ? `, ${compass(wd)} at the best hour` : ''}` : 'no value',
    age: `${ageH < 1 ? '<1' : Math.round(ageH)} h${c.source === 'cache' ? ' (cached copy)' : ''}`,
  };
}
const rowText = (r) => `| ${r.date} | ${r.captured} | ${r.window} | ${r.hs} | ${r.wind} | ${r.age} |`;
const HEADER = ['| Capture day (UTC) | Captured | Best daylit window, next 48 h (rated now) | Offshore Hs at the model point | Wind at the model point | Model run age |', '|---|---|---|---|---|---|'];
/** Rows already in a block, by date (older days are read back, never recomputed). */
export function existingRows(text) {
  const a = text.indexOf(START), b = text.indexOf(END); if (a < 0 || b < a) return new Map();
  return new Map(text.slice(a, b).split(/\r?\n/).filter((l) => /^\| \d{4}-\d{2}-\d{2} \|/.test(l)).map((l) => [l.slice(2, 12), l]));
}
export function howRightLines(sc) {
  if (!sc) return ['- How right we\'ve been: no scorecard yet.'];
  const o = offshoreLine(sc), r = ratingLine(sc);
  if (sc.status === 'collecting') return [`- How right we've been: ${collectingText(sc.haveDays, sc.needDays)}`];
  if (!o.hasNumber && !(r && r.hasNumber)) return [`- ${o.text}`, ...(r ? [`- ${r.text}`] : [])];
  return [`- ${o.text}`, ...(r ? [`- ${r.text}`] : [])];
}
export function blockFor(spotId, cap, scorecard, prevText = '', keep = KEEP_DAYS, extraRows = new Map()) {
  const rows = new Map([...existingRows(prevText), ...extraRows]); const row = rowFor(spotId, cap); if (row) rows.set(row.date, rowText(row));
  const lines = [...rows.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, keep).map(([, l]) => l);
  const sc = scorecard?.spots?.[spotId] ?? null;
  return [START, ...(lines.length ? [...HEADER, ...lines] : ['No capture row for this spot yet.']), '', ...howRightLines(sc), '',
    `Source: SWELLO daily forecast capture (Open-Meteo marine and wind at the app's model point, fetched by the Worker; capture ${cap.capturedAt}), re-rated with the current rating engine${scorecard ? `; scorecard computed ${scorecard.computedAt}` : ''}. Offshore model values, not surf at the spot. Written by scripts/vault-forecast-log.mjs: edits inside this block are overwritten.`, END].join('\n');
}
/** The note text with the block written or replaced; only the block (and, for a note without one, the heading and block at its end) changes. */
export function applyBlock(text, block) {
  const a = text.indexOf(START), b = text.indexOf(END);
  if (a >= 0 && b > a) return text.slice(0, a) + block + text.slice(b + END.length);
  const h = text.indexOf('\n' + HEADING);
  if (h >= 0) { const eol = text.indexOf('\n', h + 1); const at = eol < 0 ? text.length : eol; return text.slice(0, at) + '\n' + block + text.slice(at); }
  return text.replace(/\s*$/, '') + `\n\n${HEADING}\n\n${block}\n`;
}

/* ---------- the data source ---------- */
export function bucketFrom({dir}) {
  return {get: async (key) => {
    let text;
    if (dir) { const f = path.join(dir, key); if (!fs.existsSync(f)) return null; text = fs.readFileSync(f, 'utf8'); }
    else { const tmp = path.join(os.tmpdir(), `swello-r2-${process.pid}-${key.replace(/\W/g, '_')}`); try { execFileSync('npx', ['wrangler', 'r2', 'object', 'get', `${BUCKET}/${key}`, '--remote', '--file', tmp], {stdio: ['ignore', 'ignore', 'pipe']}); text = fs.readFileSync(tmp, 'utf8'); } catch (e) { if (/does not exist|not found|10007/i.test(String(e.stderr ?? e.message))) return null; throw e; } finally { fs.rmSync(tmp, {force: true}); } }
    return {json: async () => JSON.parse(text)};
  }};
}
export async function loadSources({dir, now = Date.now(), days = 1}) {
  const bucket = bucketFrom({dir}), svc = createCoastRatings({now: () => now}), cur = await svc.newestComplete(bucket); if (!cur) return null;
  const caps = [cur.cap], have = new Set([cur.cap.date]), ids = evidenceSpots.map((s) => s.id);
  for (let d = 1; caps.length < days && d < days + 3; d++) { const day = new Date(Date.parse(cur.cap.date + 'T00:00:00Z') - d * 86400000).toISOString().slice(0, 10), o = await bucket.get(`howright/v2/shown/${day}.json`); if (!o) continue; const c = await o.json(); if (c?.spots && ids.every((id) => c.spots[id]) && !have.has(c.date)) { caps.push(c); have.add(c.date); } }
  const sc = await (await bucket.get('howright/v2/scorecard.json'))?.json?.() ?? null;
  return {caps, scorecard: sc};
}

/* ---------- run ---------- */
export async function run({vault = DEFAULT_VAULT, dir = null, dryRun = false, days = 1, keep = KEEP_DAYS, now = Date.now(), show = 2, log = console.log, spots = evidenceSpots} = {}) {
  const src = await loadSources({dir, now, days}); if (!src) { log('no complete capture found: nothing written'); return {changed: [], missing: [], unchanged: 0, wrote: false}; }
  const {map, missing, ambiguous, stale, notes} = mapNotes(vault, spots), changed = [], other = [];
  let unchanged = 0, shown = 0;
  for (const s of spots) {
    const f = map.get(s.id); if (!f) continue;
    const text = fs.readFileSync(f, 'utf8'), extra = new Map();
    for (const cap of src.caps.slice(1)) { const r = rowFor(s.id, cap); if (r) extra.set(r.date, rowText(r)); }
    const next = applyBlock(text, blockFor(s.id, src.caps[0], src.scorecard, text, keep, extra));
    if (next === text) { unchanged++; continue; }
    changed.push(f);
    if (dryRun) { if (shown++ < show) log(`--- would change ${f}\n${next.slice(next.indexOf(START), next.indexOf(END) + END.length)}\n`); } else fs.writeFileSync(f, next);
  }
  log(`${dryRun ? 'DRY RUN: ' : ''}capture ${src.caps[0].date} (${src.caps[0].capturedAt}), scorecard ${src.scorecard ? src.scorecard.computedAt : 'none'}; ${notes} notes read, ${map.size} of ${spots.length} app spots have a note; ${changed.length} note(s) ${dryRun ? 'would change' : 'changed'}, ${unchanged} unchanged; ${missing.length} app spots have no note, ${ambiguous.length} ambiguous by name, ${stale} notes name a spot that is not in the app`);
  return {changed, missing, ambiguous, stale, unchanged, mapped: map.size, wrote: !dryRun};
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const a = process.argv.slice(2), opt = (n, d) => (a.includes(n) ? a[a.indexOf(n) + 1] : d);
  const res = await run({vault: opt('--vault', DEFAULT_VAULT), dir: opt('--dir', null), dryRun: a.includes('--dry-run'), days: Number(opt('--days', 1)), keep: Number(opt('--keep', KEEP_DAYS)), now: opt('--now', null) ? Date.parse(opt('--now')) : Date.now(), show: Number(opt('--show', 2))});
  if (a.includes('--list-missing')) console.log(res.missing.join('\n'));
}
