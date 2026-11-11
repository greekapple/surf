// Shared by scripts/srf-compare.mjs and scripts/gauge-compare.mjs: where the captures are, and our surf range per captured hour of a spot.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {surfBand} from '../../src/services/headlineSurf.ts';
import {normalizeOpenMeteo} from '../../src/ocean/openMeteo.ts';
import {toLegacy} from '../../src/ocean/bridge.ts';
import {evidenceSpot} from '../../src/ocean/spots.ts';

export const DATA = path.join(os.homedir(), 'Development', 'swello-data'), HOUR = 3600000, M_TO_FT = 3.28084;
export const DEFAULT_SHOWN = [path.join(DATA, 'srf-compare', 'r2'), path.join(DATA, 'r2', 'howright', 'v2', 'shown')];
export const argsOf = (argv) => ({multi: (k) => argv.flatMap((a, i) => (a === k ? [argv[i + 1]] : [])), has: (k) => argv.includes(k)});
export const files = (inputs, re) => inputs.flatMap((p) => (!fs.existsSync(p) ? [] : fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter((f) => re.test(f)).map((f) => path.join(p, f)) : [p]));
export const readJson = (f) => { try { const t = fs.readFileSync(f, 'utf8'); return t ? JSON.parse(t) : null; } catch { return null; } };
export const r2 = (n) => (Number.isFinite(n) ? Math.round(n * 100) / 100 : '');
export const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
export const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const kmBetween = (aLat, aLon, bLat, bLon) => { const r = Math.PI / 180, h = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

/** The shown captures (one per UTC day; the same day found twice is read once). */
export function loadShown(inputs) {
  const captures = new Map();
  for (const f of files(inputs, /\.json$/)) { const c = readJson(f); if (c?.schema === 2 && c.spots && !captures.has(c.date)) captures.set(c.date, c); }
  return captures;
}
const asResponse = (h, units) => ({hourly: h, hourly_units: {time: 'unixtime', ...units}});
const cache = new Map();
/** Our surf range for each captured hour of one spot, re-derived now with the current engine from the stored Open-Meteo hours: Map<ms, {lo, hi, central, mid, offshoreFt}>. Uncalibrated (no personal observations) and without the
 *  CDIP MOP, SWAN and model-spread inputs (none is in the capture), so it is the v1 offshore-to-break chain. offshoreFt is the model's own wave_height (metres) in feet, for reference. */
export function ourHours(captures, capDate, spotId) {
  const key = capDate + '|' + spotId; if (cache.has(key)) return cache.get(key);
  const cap = captures.get(capDate), s = cap?.spots[spotId], out = new Map(); cache.set(key, out);
  const ev = (() => { try { return evidenceSpot(spotId); } catch { return null; } })(); if (!s || !ev) return out;
  let recs; try { recs = normalizeOpenMeteo(ev, asResponse(s.marine, s.marineUnits), asResponse(s.wind, s.windUnits), s.retrievedAt); } catch { return out; }
  const nowMs = Date.parse(s.ratedAt ?? cap.capturedAt), ctx = {spread: null, bundle: null, nowMs, felt: [], observations: []}, wave = new Map(s.marine.time.map((t, i) => [t * 1000, s.marine.wave_height?.[i]]));
  for (const r of recs) {
    let b = null; try { b = surfBand(spotId, toLegacy(r), ctx); } catch { /* no estimate this hour */ }
    if (b && Number.isFinite(b.loFt) && Number.isFinite(b.hiFt)) { const t = Date.parse(r.timestamp), w = wave.get(t); out.set(t, {lo: b.loFt, hi: b.hiFt, central: b.centralFt, mid: (b.loFt + b.hiFt) / 2, offshoreFt: Number.isFinite(w) ? w * M_TO_FT : null}); }
  }
  return out;
}
