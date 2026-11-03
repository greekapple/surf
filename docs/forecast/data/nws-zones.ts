// T-064: resolves each spot's NWS zones from api.weather.gov/points/{lat},{lon} (public, keyless; generic User-Agent, no personal contact).
// Prints the table that is committed as src/services/nwsZones.ts. Run: node --experimental-strip-types docs/forecast/data/nws-zones.ts
import {evidenceSpots} from '../../../src/ocean/spots.ts';
const UA = 'SWELLO surf app';
const out: Record<string, {forecastZone: string | null; county: string | null; name: string | null; office: string | null}> = {};
for (const s of evidenceSpots) {
  try {
    const r = await fetch(`https://api.weather.gov/points/${s.latitude.toFixed(4)},${s.longitude.toFixed(4)}`, {headers: {'User-Agent': UA, Accept: 'application/geo+json'}, signal: AbortSignal.timeout(30000)});
    if (!r.ok) { out[s.id] = {forecastZone: null, county: null, name: null, office: null}; console.error(s.id, r.status); continue; }
    const j: any = await r.json(), p = j.properties;
    out[s.id] = {forecastZone: String(p.forecastZone ?? '').split('/').pop() || null, county: String(p.county ?? '').split('/').pop() || null, name: null, office: p.gridId ?? null};
  } catch (e) { out[s.id] = {forecastZone: null, county: null, name: null, office: null}; console.error(s.id, String(e).slice(0, 60)); }
  await new Promise((r) => setTimeout(r, 300));
}
console.log(JSON.stringify(out));
