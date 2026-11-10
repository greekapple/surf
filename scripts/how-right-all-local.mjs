// Local run of the "how right we've been" capture and score against the LIVE Open-Meteo and NDBC, with a directory as the fake R2 bucket (no Cloudflare, no deploy).
//   node scripts/how-right-all-local.mjs <outDir> [--spots 12 | --all]
// Default: the first N spots that have an eligible buoy plus 3 that have none. --all: EVERY spot of spotPicks() (492), captured and scored exactly as the Worker does (10 locations per Open-Meteo request, 600 ms between requests, singles when a batch fails),
// into <outDir>/howright/v2/... (a directory outside the repo; run it again to fill what is missing, a finished day changes nothing). Re-run after 00:20 UTC for the next UTC day. Every spot is "cold": one marine and one wind fetch per 10 spots, 1 marine fetch per 10 buoys (a few Open-Meteo calls).
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {createHowRightAll, spotPicks, HRA_KEYS} from '../services/how-right-all.mjs';
import {offshoreLine, ratingLine} from '../src/services/howRightAll.ts';

const args = process.argv.slice(2), out = args[0], ALL = args.includes('--all'), n = Number(args[args.indexOf('--spots') + 1]) || 12;
if (!out) { console.error('usage: node scripts/how-right-all-local.mjs <outDir> [--spots 12]'); process.exit(2); }
const path = (k) => join(out, k);
const bucket = {
  get: async (k) => existsSync(path(k)) ? {json: async () => JSON.parse(readFileSync(path(k), 'utf8'))} : null,
  put: async (k, v) => { mkdirSync(dirname(path(k)), {recursive: true}); writeFileSync(path(k), v); },
};
const all = spotPicks(), picks = ALL ? all : [...all.filter((p) => p.choice.ok).slice(0, n), ...all.filter((p) => !p.choice.ok).slice(0, 3)];
const log = []; const fetcher = (u, o) => { log.push(String(u).split('?')[0]); return fetch(u, o); };
const job = createHowRightAll({picks, fetcher, readLatest: async () => null, hotIds: async () => new Set()});
let cap, ticks = 0; do { cap = await job.capture({BUCKET: bucket}); ticks++; console.log(JSON.stringify(cap)); } while (cap.ok && !cap.complete && ticks < 6);
let sc, stages = 0; do { sc = await job.score({BUCKET: bucket}); stages++; console.log(JSON.stringify(sc)); } while (sc.ok && sc.step === 'score-stage' && stages < 8);
const st = JSON.parse(readFileSync(path(HRA_KEYS.status), 'utf8')); console.log(`status: captureSpots ${st.captureSpots}, captureBuoys ${st.captureBuoys}, missingSpots ${st.missingSpots}, missingBuoys ${st.missingBuoys}, excluded ${JSON.stringify(st.excluded ?? [])}`);
const card = JSON.parse(readFileSync(path(HRA_KEYS.card), 'utf8'));
if (!ALL) for (const p of picks) { const s = card.spots[p.id]; console.log(p.id, s.status, '|', offshoreLine(s, 'm').text, '|', ratingLine(s)?.text ?? ''); }
const counts = {}; for (const x of Object.values(card.spots)) counts[x.status] = (counts[x.status] ?? 0) + 1; console.log('card:', JSON.stringify(counts));
console.log('requests:', [...new Set(log)].map((u) => `${log.filter((x) => x === u).length} x ${u.replace(/https:\/\//, '')}`).join('; '));
