// Local data-path microbenchmark, not a browser frame-rate or physical-device test.
import fs from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {normalizeGrid,snapshotAt,spatialSpec,createFrameCache} from '../src/map/spatial.ts';
const payload=JSON.parse(await fs.readFile('public/spatial/NWW3_Global_Best-Thgt.json','utf8'));
const ti=payload.table.columnNames.indexOf('time'),validAt=payload.table.rows[0][ti];
const spec=spatialSpec('WAVES','Offshore Hs',validAt),sample=snapshotAt(payload,spec,'Thgt');
const timings=[];let cells;
for(let i=0;i<1000;i++){const start=performance.now();cells=normalizeGrid(sample.data,'Thgt',spec);timings.push(performance.now()-start);}
timings.sort((a,b)=>a-b);
const cache=createFrameCache(),frame={cells:[...cells.values()],validAt,retrievedAt:sample.retrievedAt};
for(let i=0;i<100;i++)cache.set(String(i),frame);
for(let i=68;i<100;i++)cache.get(String(i));
console.log(JSON.stringify({scope:'Local Node native-cell normalization and bounded-cache microbenchmark; not browser rendering',node:process.version,iterations:1000,nativeCells:cells.size,validAt,medianMs:timings[500],p95Ms:timings[950],cache:cache.stats(),uniqueFrameJSONBytes:Buffer.byteLength(JSON.stringify(frame)),browserDrawAndSwitchTiming:'Not measured: browser transport timed out',browserCanvasAllocation:'Instrumented in DOM data-spatial-canvas-bytes; not captured; excludes basemap/JS/driver memory',physicalDeviceMemoryAndFPS:'Not measured'},null,2));
