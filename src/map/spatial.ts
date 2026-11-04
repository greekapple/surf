import type {MapLayer,MapVariable} from './types.ts';
export interface SpatialCell {lat:number;lon:number;value:number|null;direction:number|null;speed:number|null}
import {mapConfig} from './mapConfig.ts';
import {bracket,blendGrids} from './timeBlend.ts';
import {framesBase,frameAt,loadManifest,loadPackedGrid,packedGroupOf,packedRunFresh} from './packedFrame.ts';
/** A gridded frame (Stage 2a): the native global grid as typed arrays, latitude ascending (row-major lat x lon). `val` is the scalar (wind: the speed), `dir` the "from" bearing in degrees (NaN where none). */
export interface GridData {lat0:number;dlat:number;nlat:number;lon0:number;dlon:number;nlon:number;val:Float32Array;dir:Float32Array|null}
export interface SpatialFrame {/** set ONLY on a frame read back from the first-paint cache (frameStore.ts): when it was stored. validAt, provider and retrievedAt stay its own; a network frame never has this */ cached?:{savedAt:string};/** swell height frames: an exact 0 means "no swell partition: wind sea only" (the model leaves the partition empty there), not a measured calm */ noPartition?:boolean;/** cells is empty for a gridded frame; read `grid` */ grid?:GridData;/** the grid spans the whole globe in longitude (wraps at the date line) */ global?:boolean;cells:SpatialCell[];validAt:string;retrievedAt:string;provider:string;url:string;unit:'m'|'s'|'deg'|'m/s';resolution:number;variable:string;warnings?:string[];delivery?:'direct'|'saved';transport?:'server'|'browser'|'snapshot'}
export const erddap='https://upwell.pfeg.noaa.gov/erddap/griddap/';
export interface SpatialSpec {dataset:string;scalar:string;direction:string|null;unit:SpatialFrame['unit'];wind:boolean;validAt:string}
/** Bounded native 0.5-degree regional subset (California coast, 32–42.5°N, 117–127°W). Never derived from surf-spot points. */
export function spatialSpec(layer:MapLayer,variable:MapVariable,time:string|null,secondary=false):SpatialSpec|null {
 if(!time||!Number.isFinite(Date.parse(time))||layer==='TIDE'||variable==='Breaking-wave estimate'||layer==='SWELL'&&secondary||variable==='Gusts')return null;
 const wind=layer==='WIND';/* Both regional fields are served on a 3-hourly step (GFS natively; WW3 sampled every 3 h to bound payload size). */const validAt=new Date(Math.floor(Date.parse(time)/10800000)*10800000).toISOString();
 return wind?{dataset:'NCEP_Global_Best',scalar:'ugrd10m',direction:'vgrd10m',unit:variable==='Direction'?'deg':'m/s',wind,validAt}:{dataset:'NWW3_Global_Best',scalar:layer==='SWELL'?(variable==='Period'?'sper':variable==='Direction'?'sdir':'shgt'):(variable==='Period'?'Tper':variable==='Direction'?'Tdir':'Thgt'),direction:layer==='SWELL'?'sdir':'Tdir',unit:variable==='Period'?'s':variable==='Direction'?'deg':'m',wind,validAt};
}
export function gridURL(spec:SpatialSpec,field:string){const q=`${field}[(${spec.validAt.replace('.000Z','Z')})]${spec.wind?'':'[(0)]'}[(32):1:(42.5)][(233):1:(243)]`;return erddap+spec.dataset+'.json?'+q.replaceAll('[','%5B').replaceAll(']','%5D');}
interface Table {table?:{columnNames:string[];columnUnits:string[];rows:unknown[][]}}
export function snapshotAt(payload:Table&{snapshot?:{retrievedAt:string;dataset:string;field:string;url:string;delivery:string}},spec:SpatialSpec,field:string){
 const meta=payload.snapshot,table=payload.table;
 if(!meta||meta.delivery!=='saved'||meta.dataset!==spec.dataset||meta.field!==field||!Number.isFinite(Date.parse(meta.retrievedAt))||!meta.url.startsWith(erddap+spec.dataset+'.json?')||!table||table.rows.length>12000)throw new Error('Invalid saved spatial snapshot.');
 const ti=table.columnNames.indexOf('time');if(ti<0)throw new Error('Saved grid timestamp missing.');
 const rows=table.rows.filter(r=>Date.parse(String(r[ti]))===Date.parse(spec.validAt));if(!rows.length)throw new Error('Saved grid has no frame at this layer time; expired snapshots are not shifted.');
 return {data:{table:{...table,rows}},retrievedAt:meta.retrievedAt,url:meta.url,delivery:'saved' as const,transport:'snapshot' as const};
}
/** Reject the provider's nearest-time substitution and inconsistent units or bounds. */
export function normalizeGrid(payload:Table,field:string,spec:SpatialSpec):Map<string,{lat:number;lon:number;value:number|null}> {
 const t=payload.table;if(!t||!Array.isArray(t.rows)||!Array.isArray(t.columnNames)||!Array.isArray(t.columnUnits)||t.rows.length>1200)throw new Error('Invalid or oversized regional grid response.');
 const ix=(n:string)=>t.columnNames.indexOf(n),[ti,la,lo,vi]=['time','latitude','longitude',field].map(ix);
 if([ti,la,lo,vi].some(i=>i<0))throw new Error('Spatial provider returned incomplete columns.');
 const expected=field==='ugrd10m'||field==='vgrd10m'?['m s-1','m/s']:field.includes('dir')?['degrees','degree']:field.includes('per')?['second','seconds','s']:['meters','m'];
 if(!expected.includes(t.columnUnits[vi]))throw new Error('Unexpected spatial forecast units.');
 const out=new Map<string,{lat:number;lon:number;value:number|null}>();
 for(const row of t.rows){if(Date.parse(String(row[ti]))!==Date.parse(spec.validAt))throw new Error('No exact spatial forecast frame at the requested layer time.');const lat=row[la],rawlon=row[lo];if(typeof lat!=='number'||typeof rawlon!=='number'||!Number.isFinite(lat)||!Number.isFinite(rawlon)||lat<32||lat>42.5||rawlon<233||rawlon>243)throw new Error('Spatial coordinates outside requested regional coverage.');const lon=rawlon-360,v=row[vi];let value=typeof v==='number'&&Number.isFinite(v)?v:null;if(value!==null&&(!spec.wind&&value<0||field.includes('dir')&&value>360))value=null;const key=`${lat},${lon}`;if(out.has(key))throw new Error('Duplicate spatial cell.');out.set(key,{lat,lon,value});}
 if(!out.size)throw new Error('No geographic forecast cells supplied.');return out;
}
export function windVector(u:number,v:number){const speed=Math.hypot(u,v);return {speed,direction:speed===0?null:(Math.atan2(-u,-v)*180/Math.PI+360)%360};}
// Shared subscriber-aware cancellation, deduplication, bounded cache and HTTP backoff.
const cache=new Map<string,{expires:number;data:Table;retrievedAt:string}>();
const pending=new Map<string,{promise:Promise<{data:Table;retrievedAt:string}>;controller:AbortController;users:number}>();
const blocked=new Map<string,number>();
export async function fetchGrid(url:string,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<{data:Table;retrievedAt:string}> {
 if(signal.aborted)throw new DOMException('Aborted','AbortError');const old=cache.get(url);if(old&&old.expires>Date.now())return old;
 if((blocked.get(url)??0)>Date.now())throw new Error('Spatial provider rate limited; retry after the cooling period.');
 let item=pending.get(url);
 if(!item){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);const promise=(async()=>{try{const r=await fetcher(url,{signal:controller.signal});if(!r.ok){if(r.status===429){const seconds=Number(r.headers.get('retry-after'));blocked.set(url,Date.now()+(Number.isFinite(seconds)&&seconds>0?seconds:60)*1000);}throw new Error(`Spatial provider HTTP ${r.status}.`);}const data:Table=await r.json();const result={data,retrievedAt:new Date().toISOString()};if(!data.table)throw new Error('Spatial provider did not return a forecast grid.');cache.set(url,{...result,expires:Date.now()+600000});while(cache.size>96)cache.delete(cache.keys().next().value!);return result;}finally{clearTimeout(timer);if(pending.get(url)?.controller===controller)pending.delete(url);}})();item={promise,controller,users:0};pending.set(url,item);}
 item.users++;const current=item;let released=false;
 const release=()=>{if(released)return;released=true;current.users--;if(current.users===0&&pending.get(url)===current){current.controller.abort();pending.delete(url);}};
 return new Promise((resolve,reject)=>{const abort=()=>{release();reject(new DOMException('Aborted','AbortError'));};signal.addEventListener('abort',abort,{once:true});current.promise.then(result=>{if(!signal.aborted)resolve(result)},reject).finally(()=>{signal.removeEventListener('abort',abort);release()});});
}
let directUnavailableUntil=0;
const snapshots=new Map<string,Promise<any>>();
export function retrySpatialConnection(){directUnavailableUntil=0;normalizedFrames.clear();}
/** The forecast service answered that the model has no frame at this valid time (past its horizon or off its step). Final: no browser or snapshot fallback. */
class NoFrameError extends Error{constructor(){super('The model has no frame for this hour (beyond its forecast range or between its time steps).')}}
export async function loadField(spec:SpatialSpec,field:string,signal:AbortSignal,useServer=typeof window!=='undefined'&&import.meta.env?.VITE_FORECAST_SERVICE!=='off'&&(!!import.meta.env?.PROD||import.meta.env?.VITE_FORECAST_SERVICE==='on')){
 const url=gridURL(spec,field);
 try{if(useServer){try{const server=await fetch('/api/grid?'+new URLSearchParams({field,time:spec.validAt}),{signal});if(server.status===404){const miss=await server.json().catch(()=>null);if(miss?.code==='no_frame'||miss?.error==='No exact regional model frame at this valid time')throw new NoFrameError();}if(server.ok){const body=await server.json();if(body.payload?.table&&Number.isFinite(Date.parse(body.retrievedAt)))return {data:body.payload,retrievedAt:body.retrievedAt,url:body.sourceURL,transport:'server' as const,delivery:body.cache==='stale'?'saved' as const:'direct' as const};}}catch(e){if(e instanceof NoFrameError)throw e;if(signal.aborted)throw new DOMException('Aborted','AbortError')}}if(directUnavailableUntil>Date.now())throw new Error('Direct regional connection unavailable in this browser.');const result=await fetchGrid(url,signal);return {...result,url,delivery:'direct' as const,transport:'browser' as const};}
 catch(error){if(signal.aborted||error instanceof NoFrameError)throw error;directUnavailableUntil=Date.now()+60000;const filename=spec.dataset+'-'+field+'.json';let promise=snapshots.get(filename);
 if(!promise){promise=fetch('/spatial/'+filename).then(async r=>{if(!r.ok)throw new Error('No saved regional grid for this variable.');return r.json()});snapshots.set(filename,promise);promise.catch(()=>snapshots.delete(filename));}
 const payload=await promise;if(signal.aborted)throw new DOMException('Aborted','AbortError');return snapshotAt(payload,spec,field);}
}
async function loadSpatialUncached(spec:SpatialSpec,signal:AbortSignal):Promise<SpatialFrame>{
 const fields=[...new Set([spec.scalar,...(spec.direction?[spec.direction]:[])])];const results=await Promise.allSettled(fields.map(async field=>{const result=await loadField(spec,field,signal);return {field,...result,values:normalizeGrid(result.data,field,spec)}}));
 if(results[0].status==='rejected')throw results[0].reason;
 if(spec.wind&&results.some(r=>r.status==='rejected'))throw new Error('Both GFS wind components are required for a valid vector field.');
 const supplied=results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]),scalar=results[0].value,vector=supplied.find(r=>r.field===spec.direction);const cells=[...scalar.values].map(([key,c])=>{const v=vector?.values.get(key)?.value??null;if(spec.wind){const w=c.value===null||v===null?null:windVector(c.value,v);return {lat:c.lat,lon:c.lon,value:spec.unit==='deg'?w?.direction??null:w?.speed??null,direction:w?.direction??null,speed:w?.speed??null};}return {...c,direction:v,speed:null}});
 const saved=supplied.some(r=>r.delivery==='saved'),transport=supplied.some(r=>r.transport==='snapshot')?'snapshot':supplied.some(r=>r.transport==='server')?'server':'browser';
 return {cells,unit:spec.unit,resolution:.5,validAt:spec.validAt,retrievedAt:supplied.map(r=>r.retrievedAt).sort()[0],provider:spec.wind?'NOAA/NCEP GFS via NOAA ERDDAP':'PacIOOS / University of Hawaiʻi WW3 via NOAA ERDDAP',url:scalar.url,variable:spec.scalar,delivery:saved?'saved':'direct',transport,warnings:[...(saved?[transport==='server'?'Provider refresh failed; cached model data retains its original timestamps.':'Direct grid connection unavailable; using genuine dated model snapshots, not a live browser connection.']:[]),...(results.some(r=>r.status==='rejected')?['Regional direction field unavailable; scalar heatmap retained.']:[])]};
}

/** Cache normalized frames as well as HTTP payloads; bounded independently of personal data. */
export function createFrameCache(limit=32,ttl=600000){
 const frames=new Map<string,{frame:SpatialFrame;expires:number}>();let hits=0,misses=0;
 return {clear(){frames.clear();},has(key:string,now=Date.now()){const o=frames.get(key);return !!o&&o.expires>now;},get(key:string,now=Date.now()){const old=frames.get(key);if(old&&old.expires>now){hits++;frames.delete(key);frames.set(key,old);return old.frame;}if(old)frames.delete(key);misses++;return null;},set(key:string,frame:SpatialFrame,now=Date.now()){frames.set(key,{frame,expires:now+ttl});while(frames.size>limit)frames.delete(frames.keys().next().value!);},stats:()=>({frames:frames.size,hits,misses,cells:[...frames.values()].reduce((n,x)=>n+x.frame.cells.length,0)})};
}
const normalizedFrames=createFrameCache(mapConfig.cache.regionalFrames,mapConfig.cache.regionalTtlMs);
export const spatialCacheStats=()=>normalizedFrames.stats();
export async function loadSpatial(spec:SpatialSpec,signal:AbortSignal):Promise<SpatialFrame>{
 if(signal.aborted)throw new DOMException('Aborted','AbortError');const key=JSON.stringify(spec),cached=normalizedFrames.get(key);if(cached)return cached;
 const frame=await loadSpatialUncached(spec,signal);if(signal.aborted)throw new DOMException('Aborted','AbortError');normalizedFrames.set(key,frame);return frame;
}

/** Coarse worldwide frame from /api/globe (2-degree stride of the native grid): context for the zoomed-out map, under the regional grid. */
const globeFrames=createFrameCache(mapConfig.cache.globeFrames,mapConfig.cache.globeTtlMs);
export const globeCacheStats=()=>globeFrames.stats();
/** Debug overlay (?debug=1): the idle prefetch queue. */
export const prefetchState={queued:0,done:0,failed:0,running:false};
/** The global frame at an HOURLY time: the model steps are 3-hourly, so between two steps this is a linear blend of the two frames (values by weight, directions as vectors; see timeBlend.ts), labelled as such. Exactly on a step it is that step's frame. A missing second step falls back to the first. */
export async function loadGlobeAt(spec:SpatialSpec,time:string|null,signal:AbortSignal):Promise<SpatialFrame>{
 const t=time?Date.parse(time):NaN;if(!Number.isFinite(t))return loadGlobe(spec,signal);
 const {t0,t1,f}=bracket(t);if(f<0.001||Date.parse(spec.validAt)!==t0)return loadGlobe(spec,signal);
 const key='blend'+JSON.stringify(spec)+t,hit=globeFrames.get(key);if(hit)return hit;
 const [a,b]=await Promise.all([loadGlobe(spec,signal),loadGlobe({...spec,validAt:new Date(t1).toISOString()},signal).catch(()=>null)]);
 if(!b||!a.grid||!b.grid||a.grid.nlat!==b.grid.nlat||a.grid.nlon!==b.grid.nlon)return a;
 const hh=(ms:number)=>new Date(ms).toISOString().slice(11,16)+'Z';
 const frame:SpatialFrame={...a,grid:blendGrids(a.grid,b.grid,f),validAt:new Date(t).toISOString(),provider:`${a.provider} · hour interpolated between the model steps at ${hh(t0)} and ${hh(t1)}`};
 globeFrames.set(key,frame);return frame;
}
export const globeCached=(spec:SpatialSpec,time:string|null)=>{const t=time?Date.parse(time):NaN;if(!Number.isFinite(t))return false;const {t0,t1,f}=bracket(t);return f<0.001?globeFrames.has('globe'+JSON.stringify(spec)):globeFrames.has('globe'+JSON.stringify(spec))&&globeFrames.has('globe'+JSON.stringify({...spec,validAt:new Date(t1).toISOString()}))&&Date.parse(spec.validAt)===t0;};
export async function loadGlobe(spec:SpatialSpec,signal:AbortSignal):Promise<SpatialFrame>{
 const key='globe'+JSON.stringify(spec),hit=globeFrames.get(key);if(hit)return hit;
 const packed=await loadPackedGlobe(spec,signal).catch(()=>null);if(packed){globeFrames.set(key,packed);return packed;} // GFS-Wave 0.25° from the pipeline when a frames base URL is configured and has this exact hour; otherwise the 0.5° service below
 const fields=[...new Set([spec.scalar,...(spec.direction?[spec.direction]:[])])];
 const got=await Promise.all(fields.map(async field=>{const r=await fetch('/api/ocean?'+new URLSearchParams({field,time:spec.validAt}),{signal});const body=await r.json();if(!r.ok)throw new Error(body.error??'Global grid unavailable.');return {field,noPartition:!!body.noPartition,...decodeOceanGrid(body)};}));
 const scalar=got[0],vec=got.find(g=>g.field===spec.direction);if(vec&&(vec.nlat!==scalar.nlat||vec.nlon!==scalar.nlon))throw new Error('Global grid shapes differ.');
 const n=scalar.nlat*scalar.nlon,val=new Float32Array(n),dir=spec.direction?new Float32Array(n):null;
 for(let k=0;k<n;k++){
  if(spec.wind){const u=scalar.values[k],v=vec!.values[k];if(Number.isNaN(u)||Number.isNaN(v)){val[k]=NaN;dir![k]=NaN;continue;}const w=windVector(u,v);val[k]=spec.unit==='deg'?(w.direction??NaN):w.speed;dir![k]=w.direction??NaN;}
  else{val[k]=scalar.values[k];if(dir)dir[k]=vec?vec.values[k]:NaN;}
 }
 const frame:SpatialFrame={noPartition:scalar.noPartition,cells:[],grid:{lat0:scalar.lat0,dlat:scalar.dlat,nlat:scalar.nlat,lon0:scalar.lon0,dlon:scalar.dlon,nlon:scalar.nlon,val,dir},global:true,unit:spec.unit,resolution:scalar.dlat,validAt:spec.validAt,retrievedAt:scalar.retrievedAt,provider:spec.wind?`NOAA/NCEP GFS global (${scalar.dlat}° native) via NOAA ERDDAP`:`WW3 global (${scalar.dlat}° native) via NOAA ERDDAP`,url:scalar.url,variable:spec.scalar,delivery:'direct',transport:'server'};
 if(signal.aborted)throw new DOMException('Aborted','AbortError');globeFrames.set(key,frame);return frame;
}
/** Decodes one /api/ocean payload (packed Int16, scaled, NaN = -32768) into Float32 values. */
export function decodeOceanGrid(b:{lat0:number;dlat:number;nlat:number;lon0:number;dlon:number;nlon:number;scale:number;q:string;retrievedAt:string;url:string}){
 const bin=atob(b.q),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
 const q=new Int16Array(bytes.buffer,0,Math.floor(bytes.length/2)),values=new Float32Array(q.length);
 if(q.length!==b.nlat*b.nlon)throw new Error('Global grid size mismatch.');
 for(let i=0;i<q.length;i++)values[i]=q[i]===-32768?NaN:q[i]/b.scale;
 return {lat0:b.lat0,dlat:b.dlat,nlat:b.nlat,lon0:b.lon0,dlon:b.dlon,nlon:b.nlon,values,retrievedAt:b.retrievedAt,url:b.url};
}

/** The layer a surfer most likely opens next (waves → swell → wind → waves), for the idle prefetch. */
const NEXT_LAYER:Record<string,{layer:MapLayer;variable:MapVariable}>={WAVES:{layer:'SWELL',variable:'Height'},SWELL:{layer:'WIND',variable:'Speed'},WIND:{layer:'WAVES',variable:'Offshore Hs'}};
/** Map-seamless Stage 1: once the visible frames have settled, fetch the neighbouring hours (config: +3 h, +6 h, -3 h) and the same hour of the next likely layer into the frame caches, one at a time, on idle. Skipped when the browser asks to save data
 *  or the connection is slow. Returns a canceller (a new view cancels the old run). Never throws. */
export function schedulePrefetch(layer:MapLayer,variable:MapVariable,time:string,times:string[]=[]):()=>void{
 const cfg=mapConfig.prefetch,conn=(typeof navigator!=='undefined'?(navigator as unknown as {connection?:{saveData?:boolean;effectiveType?:string}}).connection:undefined);
 if(conn?.saveData||(conn?.effectiveType&&(cfg.skipEffectiveTypes as readonly string[]).includes(conn.effectiveType)))return()=>{};
 const ctl=new AbortController();let cancelled=false;
 const step=10800000,known=new Set(times.map(t=>Math.floor(Date.parse(t)/step)));
 const run=async()=>{
  const t0=Date.parse(time);if(!Number.isFinite(t0))return;const specs:SpatialSpec[]=[];
  for(const h of [...cfg.hoursAhead,...cfg.hoursBack.map(x=>-x)]){const t=t0+h*3600000;if(known.size&&!known.has(Math.floor(t/step)))continue;const sp=spatialSpec(layer,variable,new Date(t).toISOString(),false);if(sp)specs.push(sp);}
  const next=cfg.nextLayer?NEXT_LAYER[layer==='WAVES'&&variable==='Period'?'WAVES':layer]:undefined;if(next){const sp=spatialSpec(next.layer,next.variable,time,false);if(sp)specs.push(sp);}
  prefetchState.queued+=specs.length;prefetchState.running=true;
  for(const sp of specs){if(cancelled){prefetchState.queued-=specs.length-specs.indexOf(sp);break;}const r=await Promise.allSettled([loadSpatial(sp,ctl.signal),loadGlobe(sp,ctl.signal)]);prefetchState.queued--;if(r.some(x=>x.status==='rejected'))prefetchState.failed++;else prefetchState.done++;}
  prefetchState.running=prefetchState.queued>0;
 };
 const idle=(typeof window!=='undefined'?(window as unknown as {requestIdleCallback?:(cb:()=>void,o?:{timeout:number})=>number}).requestIdleCallback:undefined),id=idle?idle(()=>{void run().catch(()=>{});},{timeout:cfg.idleTimeoutMs}):setTimeout(()=>{void run().catch(()=>{});},cfg.idleTimeoutMs) as unknown as number;
 return()=>{cancelled=true;ctl.abort();if(!idle)clearTimeout(id);};
}

/** Stage 2b: the packed GFS-Wave 0.25° frame for this spec, or null (not configured, no such hour, not a packed layer). Direction layers are not packed. */
async function loadPackedGlobe(spec:SpatialSpec,signal:AbortSignal):Promise<SpatialFrame|null>{
 const base=framesBase(),group=packedGroupOf(spec.scalar);if(!base||!group||spec.unit==='deg')return null;
 const man=await loadManifest(base,signal);if(!packedRunFresh(man)||!frameAt(man,spec.validAt))return null;
 const got=await loadPackedGrid(base,man,group,spec.validAt,signal);if(!got)return null;
 return {noPartition:group==='swell'&&!!man.groups.swell?.noPartitionIsZero,cells:[],grid:got.grid,global:true,unit:spec.unit,resolution:got.grid.dlat,validAt:spec.validAt,retrievedAt:man.generatedAt,provider:`NOAA GFS-Wave ${got.grid.dlat}° global (run ${got.run.slice(0,13).replace('T',' ')}Z)${group==='swell'||group==='swellper'?', primary swell partition':''}`,url:got.url,variable:spec.scalar,delivery:'direct',transport:'server'};
}
