// T-078: per-wave-model skill against buoys over the past 14 days. Open-Meteo Marine multi-model ANALYSIS hours (past_days) at a marine point near each buoy vs the buoy's total Hs:
// NDBC 46026 (San Francisco, deep water), NDBC 46012 (Half Moon Bay), CDIP 029 / NDBC 46214 (Point Reyes). Context for weighting and pruning models and for the measured part of the range; live free public data.
// Analysis hours are not forecasts: forecast error grows with lead time, so this is a LOWER bound on forecast uncertainty. Run: node --experimental-strip-types docs/forecast/data/model-skill.ts
const FT = 1 / 0.3048, now = Date.now(), start = now - 14 * 86400000;
const MODELS = ['meteofrance_wave', 'ncep_gfswave016', 'gwam', 'ecmwf_wam025', 'ewam'];
const get = async (u: string, text = false) => { const r = await fetch(u, {signal: AbortSignal.timeout(90000)}); if (!r.ok) throw new Error(`${r.status} ${u.slice(0, 90)}`); return text ? r.text() : r.json(); };
const hour = (t: number) => Math.round(t / 3600000) * 3600000;
const buoys: {id: string; lat: number; lon: number; url: string; col: number}[] = [
  {id: 'NDBC 46026', lat: 37.75, lon: -122.84, url: 'https://www.ndbc.noaa.gov/data/realtime2/46026.txt', col: 8},
  {id: 'NDBC 46012', lat: 37.36, lon: -122.88, url: 'https://www.ndbc.noaa.gov/data/realtime2/46012.txt', col: 8},
  {id: 'NDBC 46214 (Point Reyes)', lat: 37.94, lon: -123.47, url: 'https://www.ndbc.noaa.gov/data/realtime2/46214.txt', col: 8},
];
const q = (a: number[], p: number) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
console.log('| buoy | model | hours | median ratio (model ÷ buoy) | p10 | p90 | half-width ln(p90/p10)/2 | rel. RMSE |\n|---|---|---|---|---|---|---|---|');
for (const b of buoys) {
  const obs = new Map<number, number>();
  for (const l of (await get(b.url, true) as string).split('\n').slice(2)) { const p = l.trim().split(/\s+/); if (p.length < 9) continue; const t = Date.UTC(+p[0], +p[1] - 1, +p[2], +p[3], +p[4]); const wv = +p[8]; if (t >= start && Number.isFinite(wv) && p[8] !== 'MM' && wv > 0) obs.set(hour(t), wv); } // WVHT m
  for (const m of MODELS) {
    let j: any; try { j = await get(`https://marine-api.open-meteo.com/v1/marine?${new URLSearchParams({latitude: String(b.lat), longitude: String(b.lon), hourly: 'wave_height', models: m, past_days: '14', forecast_days: '1', timezone: 'GMT', timeformat: 'unixtime'})}`); } catch { console.log(`| ${b.id} | ${m} | – | no data | | | | |`); continue; }
    const rs: number[] = []; let se = 0, n = 0;
    (j.hourly?.time ?? []).forEach((t: number, i: number) => { const v = j.hourly.wave_height[i], o = obs.get(hour(t * 1000)); if (typeof v === 'number' && v > 0 && o) { rs.push(v / o); se += ((v - o) / o) ** 2; n++; } });
    if (n < 24) { console.log(`| ${b.id} | ${m} | ${n} | too few | | | | |`); continue; }
    console.log(`| ${b.id} | ${m} | ${n} | ${q(rs, 0.5).toFixed(2)} | ${q(rs, 0.1).toFixed(2)} | ${q(rs, 0.9).toFixed(2)} | ${(Math.log(q(rs, 0.9) / q(rs, 0.1)) / 2).toFixed(3)} | ${Math.sqrt(se / n).toFixed(2)} |`);
  }
}
