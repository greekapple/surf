// Local run of the NDBC archive against live NDBC with a directory as the fake R2 bucket (no Cloudflare, no deploy).
//   node scripts/archive-ndbc-local.mjs <outDir> [--buoys 46026,51201]
// Writes to <outDir>/<R2 key>. Prints the report and the size of what was kept.
import {mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {createNdbcArchive} from '../services/ndbc-archive.mjs';

const args = process.argv.slice(2), out = args[0];
if (!out) { console.error('usage: node scripts/archive-ndbc-local.mjs <outDir> [--buoys 46026,51201]'); process.exit(2); }
const opt = (n) => { const i = args.indexOf(n); return i > 0 ? args[i + 1] : null; };
const buoys = opt('--buoys')?.split(',');
const path = (k) => join(out, k);
const bucket = {
  get: async (k) => existsSync(path(k)) ? {json: async () => JSON.parse(readFileSync(path(k), 'utf8'))} : null,
  put: async (k, v) => { mkdirSync(dirname(path(k)), {recursive: true}); writeFileSync(path(k), v); },
};
const archive = createNdbcArchive({buoys: buoys ?? undefined});
const rep = await archive.run({BUCKET: bucket});
console.log(JSON.stringify(rep));
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(out);
console.log(`${files.length} objects, ${(files.reduce((a, f) => a + statSync(f).size, 0) / 1024).toFixed(0)} KB`);
