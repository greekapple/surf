// Snapshot: how much does the cell rule change the live 48 h wind at a few spots? (WIND-POINT.md "Effect on the app".)
// A one-time snapshot of the live forecast; a rerun on another day gives different numbers. Facings: the engine's (evidenceSpots).
// Run: node --experimental-strip-types docs/forecast/data/wind-cell-effect.ts
import fs from 'node:fs';
import {evidenceSpots} from '../../../src/ocean/spots.ts';
const NAMES = ['Ocean Beach', 'Linda Mar', 'Montara', 'Mavericks', 'Humboldt North Jetty'];
const ang = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const rel = (f: number, d: number) => ang(d, f + 180) < 45 ? 'offshore' : ang(d, f) < 45 ? 'onshore' : 'cross-shore';
const out: any[] = [];
for (const s of evidenceSpots.filter((x) => NAMES.includes(x.name))) {
  const h: any = {};
  for (const c of ['land', 'nearest']) {
    const q = new URLSearchParams({latitude: String(s.latitude), longitude: String(s.longitude), hourly: 'wind_speed_10m,wind_direction_10m', wind_speed_unit: 'mph', timezone: 'GMT', forecast_days: '2', cell_selection: c});
    h[c] = (await (await fetch('https://api.open-meteo.com/v1/forecast?' + q)).json()).hourly;
  }
  const k = h.land.time.length, ds = h.land.time.map((_: any, i: number) => h.nearest.wind_speed_10m[i] - h.land.wind_speed_10m[i]);
  const changed = h.land.time.filter((_: any, i: number) => rel(s.orientation!, h.land.wind_direction_10m[i]) !== rel(s.orientation!, h.nearest.wind_direction_10m[i])).length;
  out.push({spot: s.name, facing: s.orientation, hours: k, meanSpeedChangeMph: +(ds.reduce((a: number, b: number) => a + b, 0) / k).toFixed(1), maxSpeedChangeMph: +ds.reduce((a: number, b: number) => Math.abs(b) > Math.abs(a) ? b : a, 0).toFixed(1), shoreRelationChangedHours: changed});
}
const day = new Date().toISOString().slice(0, 10);
fs.writeFileSync(new URL(`./wind-cell-effect-${day}.json`, import.meta.url), JSON.stringify({generated: new Date().toISOString(), firstHour: 'today 00:00 UTC', spots: out}, null, 1));
console.log(JSON.stringify(out, null, 1));
