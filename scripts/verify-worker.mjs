import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import fs from 'node:fs/promises';
const manifest=JSON.parse(await fs.readFile('dist/.openai/hosting.json','utf8'));assert.equal(manifest.r2,'BUCKET');assert.equal(manifest.static,undefined);
const response=await worker.fetch(new Request('https://surf.test/'),{});assert.equal(response.status,200);const html=await response.text();assert.match(html,/<title>SURF/);const script=html.match(/src="([^"]+\.js)"/)[1];const asset=await worker.fetch(new Request('https://surf.test'+script),{});assert.equal(asset.status,200);assert.match(asset.headers.get('content-type'),/javascript/);assert.ok((await asset.text()).length>100000);assert.equal((await worker.fetch(new Request('https://surf.test/missing.jpg'),{})).status,404);const health=await(await worker.fetch(new Request('https://surf.test/api/health'),{})).json();assert.equal(health.version,'0.8');assert.equal(health.persistent,false);console.log('Generated Worker ESM validated: HTML, hashed assets, API, missing assets and R2 manifest.');

assert.equal((await worker.fetch(new Request("https://surf.test/qa-v09.html"),{})).status,404);
