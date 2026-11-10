// The West Coast import batches (round 4): which rows of world-spots/us-west.json (and alaska.json) become app spots, and which are left out with the reason.
//   node --experimental-strip-types docs/forecast/data/west-batch.ts ca      -> world-spots/us-west-ca-batch1-ids.json + world-spots/us-west-ca-batch1-drops.json
//   node --experimental-strip-types docs/forecast/data/west-batch.ts orwa    -> batch 2 (Oregon, Washington)
// Rule: appCandidate rows (guide facing, CO-OPS tide within 30 km, wave buoy within 100 km), minus a row that is the SAME break as another candidate row: the same name (case, punctuation, "state/beach/the" and
// "street = st" ignored) within 0.5 km. The row with more facts (sources, then fields) is kept, the later id loses a tie. Rows already in the app were dropped by the catalogue (within 1 km, or the same name within 25 km).
import fs from 'node:fs';
const dir = new URL('./world-spots/', import.meta.url).pathname, which = process.argv[2] ?? 'ca';
const file = JSON.parse(fs.readFileSync(dir + 'us-west.json', 'utf8')), state = which === 'ca' ? 'California' : null;
const rows: any[] = file.spots.filter((s: any) => s.appCandidate && (state ? s.region.startsWith(state + ',') : /^(Oregon|Washington),/.test(s.region)));
const km = (a: any, b: any) => { const r = Math.PI / 180, h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const norm = (n: string) => n.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).map((w) => (w === 'street' ? 'st' : w)).filter((w) => w && !['state', 'beach', 'the', 'st'].includes(w) || w === 'st' && false).join(' ');
const weight = (s: any) => (s.facts?.sources?.length ?? 0) * 100 + Object.values(s.facts ?? {}).filter((v) => v !== null && v !== undefined && v !== '').length;
/** Rows that are the same beach as a spot already in the app but fall outside the catalogue's 1 km rule (checked by name and position against every app spot within 4 km, 2026-11-10; decided by the lead). */
const SAME_BEACH_AS_APP: Record<string, {appId: string; appName: string; km: number}> = {'w-usw-zuma-beach-county-park': {appId: 'cs-zuma', appName: 'Zuma', km: 1.4}, 'w-usw-hermosa-beach': {appId: 'cs-hermosa', appName: 'Hermosa Pier', km: 1.2}};
const drops: {id: string; name: string; keptId: string; keptName: string; km: number; reason: string}[] = [], gone = new Set<string>();
for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
  const a = rows[i], b = rows[j]; if (gone.has(a.id) || gone.has(b.id) || !norm(a.name) || norm(a.name) !== norm(b.name)) continue;
  const d = km(a, b); if (d > 0.5) continue;
  const [keep, lose] = weight(b) > weight(a) ? [b, a] : [a, b]; gone.add(lose.id);
  drops.push({id: lose.id, name: lose.name, keptId: keep.id, keptName: keep.name, km: Math.round(d * 100) / 100, reason: `the same break as "${keep.name}" (${Math.round(d * 100) / 100} km apart, same name once "state", "beach", "the" and street/st are ignored): one row is kept, the one with more guide facts`});
}
if (which === 'ca') for (const s of rows) { const a = SAME_BEACH_AS_APP[s.id]; if (a && !gone.has(s.id)) { gone.add(s.id); drops.push({id: s.id, name: s.name, keptId: a.appId, keptName: a.appName, km: a.km, reason: `the same beach as the app spot "${a.appName}" (${a.km} km apart; the catalogue's rule drops only within 1 km)`}); } }
const ids = rows.filter((s) => !gone.has(s.id)).map((s) => s.id).sort();
const tag = which === 'ca' ? 'us-west-ca-batch1' : 'us-west-orwa-batch2';
fs.writeFileSync(dir + `${tag}-ids.json`, JSON.stringify(ids, null, 1) + '\n'); fs.writeFileSync(dir + `${tag}-drops.json`, JSON.stringify(drops, null, 1) + '\n');
console.log(`${tag}: ${rows.length} appCandidate rows, ${drops.length} dropped as duplicates, ${ids.length} to import`); for (const d of drops) console.log(`  drop ${d.name} (${d.id}) ~ ${d.keptName} ${d.km} km`);
