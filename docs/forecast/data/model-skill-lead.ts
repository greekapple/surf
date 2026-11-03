// T-078: forecast skill by lead time. Open-Meteo Marine "previous day N" fields (the value a model forecast N days earlier for each hour) vs the buoy's total Hs, past 14 days,
// at NDBC 46026 and 46214 (open ocean). Run: node --experimental-strip-types docs/forecast/data/model-skill-lead.ts
const FT = 1 / 0.3048, start = Date.now() - 14 * 86400000, DAYS = [0, 1, 2, 3, 4, 5, 6, 7];
const get = async (u: string, text = false) => { const r = await fetch(u, {signal: AbortSignal.timeout(90000)}); if (!r.ok) throw new Error(`${r.status}`); return text ? r.text() : r.json(); };
const hour = (t: number) => Math.round(t / 3600000) * 3600000, q = (a: number[], p: number) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const buoys = [{id: '46026', lat: 37.75, lon: -122.84}, {id: '46214', lat: 37.94, lon: -123.47}], MODELS = ['meteofrance_wave', 'ecmwf_wam025', 'ncep_gfswave016'];
const res: Record<string, number[][]> = {}; // model -> day -> ratios (pooled over buoys)
for (const b of buoys) {
  const obs = new Map<number, number>();
  for (const l of (await get(`https://www.ndbc.noaa.gov/data/realtime2/${b.id}.txt`, true) as string).split('\n').slice(2)) { const p = l.trim().split(/\s+/); if (p.length < 9) continue; const t = Date.UTC(+p[0], +p[1] - 1, +p[2], +p[3], +p[4]), wv = +p[8]; if (t >= start && Number.isFinite(wv) && p[8] !== 'MM' && wv > 0) obs.set(hour(t), wv); }
  for (const m of MODELS) {
    const fields = DAYS.map((d) => d === 0 ? 'wave_height' : `wave_height_previous_day${d}`);
    let j: any; try { j = await get(`https://marine-api.open-meteo.com/v1/marine?${new URLSearchParams({latitude: String(b.lat), longitude: String(b.lon), hourly: fields.join(','), models: m, past_days: '14', forecast_days: '1', timezone: 'GMT', timeformat: 'unixtime'})}`); } catch { continue; }
    DAYS.forEach((d, di) => { const arr = j.hourly?.[fields[di]] ?? []; (res[m] ??= DAYS.map(() => []))[di].push(...(j.hourly?.time ?? []).flatMap((t: number, i: number) => { const v = arr[i], o = obs.get(hour(t * 1000)); return typeof v === 'number' && v > 0 && o ? [v / o] : []; })); });
  }
}
console.log('| model | lead (days) | n | median ratio | half-width ln(p90/p10)/2 |\n|---|---|---|---|---|');
const pooled: Record<number, number[]> = {};
for (const m of MODELS) DAYS.forEach((d, di) => { const r = res[m]?.[di] ?? []; if (r.length < 30) return; const med = q(r, 0.5), hw = Math.log(q(r, 0.9) / q(r, 0.1)) / 2; console.log(`| ${m} | ${d} | ${r.length} | ${med.toFixed(2)} | ${hw.toFixed(3)} |`); (pooled[d] ??= []).push(...r.map((x) => x / med)); });
console.log('\nPooled over the three models after removing each model\'s own median bias:\n\n| lead (days) | half-width |\n|---|---|');
for (const d of DAYS) if (pooled[d]?.length) console.log(`| ${d} | ${(Math.log(q(pooled[d], 0.9) / q(pooled[d], 0.1)) / 2).toFixed(3)} |`);
