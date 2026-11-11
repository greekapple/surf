// US West batch 2 (round 4): Oregon, Washington (world-spots/us-west.json) and Sitka (world-spots/alaska.json). Which rows become app spots, which are left out and why.
//   node --experimental-strip-types docs/forecast/data/west-batch2.ts   -> world-spots/us-west-orwa-batch2-ids.json, world-spots/alaska-batch2-ids.json, world-spots/west-batch2-drops.json
// Rule (the same as batch 1, docs/forecast/data/west-batch.ts on branch west-ca): appCandidate rows (guide facing, CO-OPS tide within 30 km, live wave buoy within 100 km), minus a row that is the SAME break as another candidate:
// the same name (case, punctuation, "state/beach/the" and street = st ignored) within 0.5 km; the row with more guide facts is kept. Rows already in the app were dropped by the catalogue.
import fs from 'node:fs';
const dir = new URL('./world-spots/', import.meta.url).pathname;
const km = (a: any, b: any) => { const r = Math.PI / 180, h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const norm = (n: string) => n.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).map((w) => (w === 'street' ? 'st' : w)).filter((w) => w && !['state', 'beach', 'the', 'st'].includes(w)).join(' ');
const weight = (s: any) => (s.facts?.sources?.length ?? 0) * 100 + Object.values(s.facts ?? {}).filter((v) => v !== null && v !== undefined && v !== '').length;
/** Rows that are the same beach as a spot already in the app but fall outside the catalogue's 1 km rule (checked by name and position against every app spot within 4 km, 2026-11-10). */
const SAME_BEACH_AS_APP: Record<string, {appId: string; appName: string; km: number}> = {'w-usw-coos-bay-bastendorff-beach': {appId: 'cs-bastendorff', appName: 'Bastendorff Beach', km: 1.1}};
const drops: any[] = [];
function pick(rows: any[]) {
  const gone = new Set<string>();
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i], b = rows[j]; if (gone.has(a.id) || gone.has(b.id) || !norm(a.name) || norm(a.name) !== norm(b.name)) continue;
    const d = km(a, b); if (d > 0.5) continue;
    const [keep, lose] = weight(b) > weight(a) ? [b, a] : [a, b]; gone.add(lose.id);
    drops.push({id: lose.id, name: lose.name, keptId: keep.id, keptName: keep.name, km: Math.round(d * 100) / 100, reason: `the same break as "${keep.name}" (${Math.round(d * 100) / 100} km apart, same name once "state", "beach", "the" and street/st are ignored): one row is kept, the one with more guide facts`});
  }
  for (const s of rows) { const a = SAME_BEACH_AS_APP[s.id]; if (a && !gone.has(s.id)) { gone.add(s.id); drops.push({id: s.id, name: s.name, keptId: a.appId, keptName: a.appName, km: a.km, reason: `the same beach as the app spot "${a.appName}" (${a.km} km apart; the catalogue's rule drops only within 1 km)`}); } }
  return rows.filter((s) => !gone.has(s.id)).map((s) => s.id).sort();
}
const west = JSON.parse(fs.readFileSync(dir + 'us-west.json', 'utf8')).spots.filter((s: any) => s.appCandidate && /^(Oregon|Washington),/.test(s.region)), ak = JSON.parse(fs.readFileSync(dir + 'alaska.json', 'utf8')).spots.filter((s: any) => s.appCandidate);
const orwa = pick(west), alaska = pick(ak);
fs.writeFileSync(dir + 'us-west-orwa-batch2-ids.json', JSON.stringify(orwa, null, 1) + '\n'); fs.writeFileSync(dir + 'alaska-batch2-ids.json', JSON.stringify(alaska, null, 1) + '\n'); fs.writeFileSync(dir + 'west-batch2-drops.json', JSON.stringify(drops, null, 1) + '\n');
console.log(`Oregon + Washington: ${west.length} appCandidate rows, ${orwa.length} to import; Sitka: ${ak.length} rows, ${alaska.length} to import; ${drops.length} dropped as duplicates`); for (const d of drops) console.log(`  drop ${d.name} (${d.id}) ~ ${d.keptName} ${d.km} km`);
