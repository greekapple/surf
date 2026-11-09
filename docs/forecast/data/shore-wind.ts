// Shore wind stations: airport ASOS stations (Iowa Environmental Mesonet archive, public, no key) next to the NDBC/NOS met stations
// the audits already read. Used by wind-point.ts and rating-audit.ts so both read the airports the same way.
//
// Readings: the routine hourly METAR (report_type 3), assigned to the nearest whole hour when it is within 10 minutes of it
// (US ASOS routine reports go out at about :51–:56). Knots → mph. A missing or variable direction is kept only for calm hours
// (below calmMph), where direction is not scored. ASOS anemometers stand about 10 m up, on the airfield, not at the shore.
export const KT_TO_MPH = 1.150779;
const HOUR = 3600000;

export interface AsosStation {id: string; name: string; lat: number; lon: number}
export const ASOS_NETWORK_URL = 'https://mesonet.agron.iastate.edu/geojson/network/CA_ASOS.geojson';
export function parseAsosNetwork(geojson: string): AsosStation[] {
  return JSON.parse(geojson).features.filter((f: any) => f.properties.online !== false)
    .map((f: any) => ({id: String(f.id ?? f.properties.sid), name: f.properties.sname, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0]}));
}

/** start/end: ISO dates or times (UTC). The IEM request takes whole days, so the caller clips to its own window. */
export function asosURL(id: string, start: string, end: string): string {
  const [y1, m1, d1] = start.slice(0, 10).split('-').map(Number), [y2, m2, d2] = end.slice(0, 10).split('-').map(Number);
  const q = new URLSearchParams({station: id, tz: 'Etc/UTC', format: 'onlycomma', latlon: 'no', missing: 'M', trace: 'T', report_type: '3', year1: String(y1), month1: String(m1), day1: String(d1), year2: String(y2), month2: String(m2), day2: String(d2)});
  return `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?${q}&data=drct&data=sknt&data=gust`;
}

export interface AsosObs {mph: number; dir: number; gust: number | null}
export function parseAsos(csv: string, calmMph: number): Map<number, AsosObs> {
  const out = new Map<number, AsosObs>(), lines = csv.trim().split(/\r?\n/);
  if (!/^station,valid,drct,sknt/.test(lines[0] ?? '')) return out;
  for (const l of lines.slice(1)) {
    const [, v, wd, ws, gs] = l.split(','), ms = Date.parse(v.replace(' ', 'T') + ':00Z'); if (!Number.isFinite(ms) || ws === 'M' || ws === undefined) continue;
    const hr = Math.round(ms / HOUR) * HOUR; if (Math.abs(ms - hr) > 10 * 60000) continue;
    const mph = Number(ws) * KT_TO_MPH, dir = wd === 'M' ? NaN : Number(wd); if (!(mph >= 0 && mph <= 70)) continue;
    if (mph >= calmMph && !(dir >= 0 && dir <= 360)) continue;
    const gust = gs && gs !== 'M' && Number.isFinite(Number(gs)) ? Number(gs) * KT_TO_MPH : null;
    out.set(hr, {mph, dir: Number.isFinite(dir) ? dir : 0, gust});
  }
  return out;
}
