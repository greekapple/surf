import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),dist=path.join(root,'dist'),assets={};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.name==='server'||e.name==='.openai')continue;const file=path.join(dir,e.name);if(e.isDirectory())await walk(file);else assets['/'+path.relative(dist,file).split(path.sep).join('/')]={body:(await fs.readFile(file)).toString('base64'),type:types[path.extname(file)]||'application/octet-stream'};}}
await walk(dist);const service=(await fs.readFile('services/forecast-service.mjs','utf8')).replaceAll('export ','');const entry=(await fs.readFile('worker/index.mjs','utf8')).replace(/^import .*\n/m,'').replace('export function','function');await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});await fs.writeFile('dist/server/index.js',service+'\n'+entry+'\nexport default createWorker('+JSON.stringify(assets)+');\n');await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');console.log('Built portable Worker with',Object.keys(assets).length,'embedded assets; React/Vite retained.');

for(const e of await fs.readdir(dist)){if(e!=='server'&&e!=='.openai')await fs.rm(path.join(dist,e),{recursive:true,force:true});}
