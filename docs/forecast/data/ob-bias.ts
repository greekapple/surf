// T-076: is Ocean Beach's breaking estimate biased high? Compares, over the last 7 days, hourly: CDIP MOP SF023 nowcast Hs (10 m), NDBC 46026 (deep water, SF) WVHT/SwH/SwP, CDIP 029 (Point Reyes) Hs,
// and Open-Meteo marine (the app's offshore source) wave_height and primary swell; then runs v1 and v2 on each input. Live free public data; context only (buoys are not at the break).
// Run: node --experimental-strip-types docs/forecast/data/ob-bias.ts
import {normalizeNearshore} from '../../../src/ocean/nearshore.ts';
import {estimateBreaking, estimateBreakingV2} from '../../../src/ocean/breakingEstimate.ts';
import {breakingProfile} from '../../../src/ocean/localCalibration.ts';
import {mopPoint} from '../../../src/ocean/mop.ts';
const FT = 1 / 0.3048, now = Date.now(), start = new Date(now - 7 * 86400000);
const get = async (u: string, text = false) => { const r = await fetch(u, {signal: AbortSignal.timeout(90000)}); if (!r.ok) throw new Error(`${r.status} ${u.slice(0, 80)}`); return text ? r.text() : r.json(); };
const hour = (t: number) => Math.round(t / 3600000) * 3600000;
const med = (a: number[]) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : NaN; }, q = (a: number[], p: number) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };
const mop = new Map<number, {hs: number; tp: number; dp: number}>(), b46 = new Map<number, {wv: number; sw: number; swp: number; swd: string}>(), c029 = new Map<number, {hs: number; tp: number}>(), om = new Map<number, {hs: number; sw: number; swp: number; swd: number}>();
const mopCsv = await get(`https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/model/MOP_alongshore/SF023_nowcast.nc?${new URLSearchParams({var: 'waveHs,waveTp,waveDp,waveFlagPrimary', time_start: start.toISOString(), time_end: new Date(now).toISOString(), accept: 'csv'})}`, true) as string;
for (const r of normalizeNearshore(mopCsv, new Date(now).toISOString(), 'x', 'nowcast')) if (r.qualityFlag === 1 && r.height.value !== null) mop.set(hour(Date.parse(r.timestamp)), {hs: r.height.value, tp: r.period.value ?? NaN, dp: r.direction.value ?? NaN});
for (const l of (await get('https://www.ndbc.noaa.gov/data/realtime2/46026.spec', true) as string).split('\n').slice(2)) { const p = l.trim().split(/\s+/); if (p.length < 12) continue; const t = Date.UTC(+p[0], +p[1] - 1, +p[2], +p[3], +p[4]); if (t < start.getTime() || +p[4] > 20 && +p[4] < 40 && false) continue; const wv = +p[5], sw = +p[6]; if (!Number.isFinite(wv) || p[5] === 'MM') continue; b46.set(hour(t), {wv: wv * FT, sw: sw * FT, swp: +p[7], swd: p[10]}); }
const cdip = await get(`https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/realtime/029p1_rt.nc?${new URLSearchParams({var: 'waveHs,waveTp,waveDp', time_start: start.toISOString(), time_end: new Date(now).toISOString(), accept: 'csv'})}`, true) as string;
for (const l of cdip.split('\n').slice(1)) { const p = l.split(','); const t = Date.parse(p[0]); if (!Number.isFinite(t)) continue; const hs = +p[p.length - 3]; if (Number.isFinite(hs)) c029.set(hour(t), {hs: hs * FT, tp: +p[p.length - 2]}); }
const o = await get(`https://marine-api.open-meteo.com/v1/marine?${new URLSearchParams({latitude: '37.75', longitude: '-122.6', hourly: 'wave_height,swell_wave_height,swell_wave_period,swell_wave_direction', past_days: '7', forecast_days: '1', timezone: 'GMT', timeformat: 'unixtime'})}`);
o.hourly.time.forEach((t: number, i: number) => { if (t * 1000 <= now) om.set(hour(t * 1000), {hs: o.hourly.wave_height[i] * FT, sw: o.hourly.swell_wave_height[i] * FT, swp: o.hourly.swell_wave_period[i], swd: o.hourly.swell_wave_direction[i]}); });
const keys = [...mop.keys()].filter((k) => b46.has(k) && om.has(k)).sort();
const r = (f: (k: number) => number) => keys.map(f);
const profile = breakingProfile('spot-2'), pt = mopPoint('SF023')!;
console.log(`Hours with MOP nowcast, NDBC 46026 and Open-Meteo all present: ${keys.length} (${new Date(keys[0]).toISOString().slice(0, 10)} to ${new Date(keys.at(-1)!).toISOString().slice(0, 10)}); CDIP 029 hours: ${c029.size}`);
const stat = (label: string, a: number[]) => console.log(`| ${label} | ${med(a).toFixed(2)} | ${q(a, 0.1).toFixed(2)} | ${q(a, 0.9).toFixed(2)} |`);
console.log('\n| ratio (hourly) | median | p10 | p90 |\n|---|---|---|---|');
stat('MOP SF023 Hs ÷ NDBC 46026 WVHT (total Hs)', r((k) => mop.get(k)!.hs / b46.get(k)!.wv));
stat('MOP SF023 Hs ÷ CDIP 029 Hs', keys.filter((k) => c029.has(k)).map((k) => mop.get(k)!.hs / c029.get(k)!.hs));
stat('Open-Meteo wave_height ÷ NDBC 46026 WVHT', r((k) => om.get(k)!.hs / b46.get(k)!.wv));
stat('Open-Meteo primary swell ÷ NDBC 46026 SwH', r((k) => om.get(k)!.sw / b46.get(k)!.sw));
stat('NDBC 46026 SwH ÷ WVHT (swell share of total)', r((k) => b46.get(k)!.sw / b46.get(k)!.wv));
stat('Open-Meteo primary swell ÷ Open-Meteo wave_height', r((k) => om.get(k)!.sw / om.get(k)!.hs));
stat('MOP Tp − NDBC SwP (s)', r((k) => mop.get(k)!.tp - b46.get(k)!.swp).map((x) => x + 1)); // shifted +1 only to keep the ratio table format; see note
// v1 and v2 on each input, hour by hour (where the estimators accept the hour)
const v2 = (hs: number, tp: number, dp: number) => { const x = estimateBreakingV2({hsFt: hs, periodS: tp, directionDeg: dp, depthM: pt.depthM, shoreNormalDeg: pt.shoreNormalDeg}, profile); return x.ok ? x : null; };
const v1 = (hs: number, tp: number, dp: number, comb: number) => { const x = estimateBreaking({swellHsFt: hs, periodS: tp, directionDeg: dp, combinedHsFt: comb, secondaryHsFt: null}, profile, 263.49); return x.ok ? x.centralFt : null; };
const rows = keys.map((k) => { const m = mop.get(k)!, b = b46.get(k)!, e = om.get(k)!; const a = v2(m.hs, m.tp, m.dp); return {k, mopHs: m.hs, v2: a?.centralFt ?? NaN, v2Depth: a?.breakDepthM ?? NaN, v1om: v1(e.sw, e.swp, e.swd, e.hs) ?? NaN, v1buoy: NaN}; });
console.log(`\n| central breaking height, ft (median over hours where each is defined) | median | p10 | p90 | n |\n|---|---|---|---|---|`);
const line = (l: string, a: number[]) => { const f = a.filter(Number.isFinite); console.log(`| ${l} | ${med(f).toFixed(1)} | ${q(f, 0.1).toFixed(1)} | ${q(f, 0.9).toFixed(1)} | ${f.length} |`); };
line('MOP Hs at 10 m', rows.map((x) => x.mopHs)); line('v2 central (from MOP)', rows.map((x) => x.v2)); line('v1 central (from Open-Meteo primary swell)', rows.map((x) => x.v1om));
line('v2 central ÷ MOP Hs (shoaling to the break)', rows.map((x) => x.v2 / x.mopHs)); line('v2 breaking depth, m', rows.map((x) => x.v2Depth));
console.log(`\nMOP SF023: depth ${pt.depthM} m, shore normal ${pt.shoreNormalDeg}°.`);
