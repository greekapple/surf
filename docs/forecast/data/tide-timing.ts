// Tide station TIMING comparison (the evidence for "is this gauge the open coast?", as in docs/forecast/HAWAII-REST.md 3C).
//   node --experimental-strip-types --no-warnings docs/forecast/data/tide-timing.ts <reference id> <station id> [<station id> ...] [--days 7] [--from 2026-11-10]
// Fetches NOAA CO-OPS predicted high/low (datagetter, MLLW, local standard time, `interval=hilo`) for the window and compares each station with the reference: for every extremum of the station the nearest
// extremum of the SAME type at the reference within 3 h; prints the mean offset (minutes, station minus reference), its standard deviation, the number of pairs and the mean ratio of the daily ranges.
// RANGE RATIO, exactly: for each calendar day (the date on the station's own clock, as the API returns it in lst_ldt, for days with at least 3 extrema at BOTH stations) the daily range = highest minus lowest predicted height of that day; the ratio is
// (station's daily range) / (reference's daily range), skipping days where the reference range is 0.3 m or less, and the printed value is the MEAN of those daily ratios (rounded to 2 places). It is a ratio of height ranges, not of times,
// and it uses UTC days, so a day that straddles a tide cycle differently at the two stations adds noise: another metric (a ratio of the sums of the ranges, or of the high-low differences of paired tides) gives somewhat different numbers
// (a reviewer's version gave Twin Rivers 0.66 against 0.76 here and Charleston 1.08 against 1.03). The classes do not depend on the exact value: they rest on the timing offsets and on the position.
// A harbour, bay or estuary gauge usually shows a lag of tens of minutes and a different range; an open-coast neighbour shows a few minutes. Public, keyless; one request per station.
const args = process.argv.slice(2), opt = (n: string, d: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : d), ids = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const days = Number(opt('--days', '7')), from = new Date(opt('--from', new Date().toISOString().slice(0, 10)) + 'T00:00:00Z'), ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
type Ext = {t: number; v: number; type: string};
export async function hilo(id: string): Promise<Ext[]> {
  const u = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=swello&begin_date=${ymd(from)}&end_date=${ymd(new Date(from.getTime() + (days - 1) * 86400000))}&datum=MLLW&station=${id}&time_zone=lst_ldt&units=english&interval=hilo&format=json`;
  const r = await fetch(u, {signal: AbortSignal.timeout(60000)}); if (!r.ok) throw new Error(`${id}: HTTP ${r.status}`);
  const j: any = await r.json(); return (j.predictions ?? []).map((x: any) => ({t: Date.parse(x.t.replace(' ', 'T') + ':00Z'), v: Number(x.v), type: x.type}));
}
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length, sd = (x: number[]) => Math.sqrt(mean(x.map((v) => (v - mean(x)) ** 2)));
const dailyRange = (e: Ext[]) => { const m = new Map<string, number[]>(); for (const x of e) { const k = new Date(x.t).toISOString().slice(0, 10); (m.get(k) ?? m.set(k, []).get(k)!).push(x.v); } return new Map([...m].filter(([, v]) => v.length >= 3).map(([k, v]) => [k, Math.max(...v) - Math.min(...v)])); };
export function compare(ref: Ext[], st: Ext[]) {
  const off: number[] = []; for (const x of st) { const c = ref.filter((r) => r.type === x.type).map((r) => ({d: Math.abs(r.t - x.t), m: (x.t - r.t) / 60000})).sort((a, b) => a.d - b.d)[0]; if (c && c.d < 3 * 3600000) off.push(c.m); }
  const A = dailyRange(ref), B = dailyRange(st), rr = [...A].filter(([k, v]) => B.has(k) && v > 0.3).map(([k, v]) => B.get(k)! / v);
  return {meanMin: off.length ? Math.round(mean(off)) : null, sdMin: off.length ? Math.round(sd(off)) : null, n: off.length, rangeRatio: rr.length ? Math.round(mean(rr) * 100) / 100 : null};
}
if (process.argv[1]?.endsWith('tide-timing.ts')) {
  const [ref, ...rest] = ids; if (!ref || !rest.length) { console.error('usage: tide-timing.ts <reference id> <station id> ...'); process.exit(2); }
  const r = await hilo(ref); console.log(`window ${from.toISOString().slice(0, 10)} + ${days} days, local standard time; reference ${ref} (${r.length} extrema)`);
  for (const id of rest) { try { const c = compare(r, await hilo(id)); console.log(`${id.padEnd(9)} vs ${ref}: mean ${String(c.meanMin).padStart(5)} min, sd ${String(c.sdMin).padStart(3)}, n ${String(c.n).padStart(3)}, range ratio ${c.rangeRatio}`); } catch (e) { console.log(`${id}: ${String(e).slice(0, 80)}`); } await new Promise((s) => setTimeout(s, 400)); }
}
