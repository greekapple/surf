// Production build for Cloudflare: `vite build` → dist/, then copy it to .cf/public WITHOUT licensed/derived assets
// (the same pattern as tools/review/licence-guard.sh: TurboSquid meshes, the wave atlas, the live wave GLBs, *.fbx; the CC0 surfer.glb is kept).
// Fails if anything licensed is still in the upload folder.
import fs from 'node:fs/promises';
import path from 'node:path';
const SRC = 'dist', OUT = '.cf/public';
const LICENSED = /(turbosquid|^media\/scale3d-live\/(?!surfer\.glb$).*\.(glb|bin)$|^media\/scale3d-atlas\/|\.fbx$)/i;
const SKIP = /^(server\/|\.openai\/)/;
await fs.rm('.cf', {recursive: true, force: true});
let kept = 0, dropped = [];
async function walk(dir) {
  for (const e of await fs.readdir(dir, {withFileTypes: true})) {
    const abs = path.join(dir, e.name), rel = path.relative(SRC, abs).split(path.sep).join('/');
    if (e.isDirectory()) { await walk(abs); continue; }
    if (SKIP.test(rel)) continue;
    if (LICENSED.test(rel)) { dropped.push(rel); continue; }
    const st = await fs.stat(abs); if (st.size > 25 * 1024 * 1024) throw new Error(`${rel} is over Cloudflare's 25 MiB per-file limit`);
    await fs.mkdir(path.join(OUT, path.dirname(rel)), {recursive: true}); await fs.copyFile(abs, path.join(OUT, rel)); kept++;
  }
}
await walk(SRC);
async function check(dir) { for (const e of await fs.readdir(dir, {withFileTypes: true})) { const abs = path.join(dir, e.name), rel = path.relative(OUT, abs).split(path.sep).join('/'); if (e.isDirectory()) await check(abs); else if (LICENSED.test(rel)) throw new Error(`licensed asset in the upload: ${rel}`); } }
await check(OUT);
console.log(`Cloudflare build: ${kept} files in ${OUT}; left out (licensed): ${dropped.length}${dropped.length ? ' (' + dropped.slice(0, 4).join(', ') + (dropped.length > 4 ? ', …' : '') + ')' : ''}`);
