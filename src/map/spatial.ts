import type {MapLayer,MapVariable} from './types.ts';
export interface SpatialCell {lat:number;lon:number;value:number|null;direction:number|null;speed:number|null}
export interface SpatialFrame {cells:SpatialCell[];validAt:string;retrievedAt:string;provider:string;url:string;unit:'m'|'s'|'deg'|'m/s';resolution:number;variable:string;warnings?:string[];delivery?:'direct'|'saved';transport?:'server'|'browser'|'snapshot'}
export const erddap='https://upwell.pfeg.noaa.gov/erddap/griddap/';
export interface SpatialSpec {dataset:string;scalar:string;direction:string|null;unit:SpatialFrame['unit'];wind:boolean;validAt:string}
/** Bounded native 0.5-degree regional subset. Never derived from surf-spot points. */
export function spatialSpec(layer:MapLayer,variable:MapVariable,time:string|null,secondary=false):SpatialSpec|null {
 if(!time||!Number.isFinite(Date.parse(time))||layer==='TIDE'||variable==='Breaking-wave estimate'||layer==='SWELL'&&secondary||variable==='Gusts')return null;
 const wind=layer==='WIND';const validAt=new Date(wind?Math.floor(Date.parse(time)/10800000)*10800000:Date.parse(time)).toISOString();
 return wind?{dataset:'NCEP_Global_Best',scalar:'ugrd10m',direction:'vgrd10m',unit:variable==='Direction'?'deg':'m/s',wind,validAt}:{dataset:'NWW3_Global_Best',scalar:layer==='SWELL'?(variable==='Period'?'sper':variable==='Direction'?'sdir':'shgt'):(variable==='Period'?'Tper':variable==='Direction'?'Tdir':'Thgt'),direction:layer==='SWELL'?'sdir':'Tdir',unit:variable==='Period'?'s':variable==='Direction'?'deg':'m',wind,validAt};
}
export function gridURL(spec:SpatialSpec,field:string){const q=`${field}[(${spec.validAt.replace('.000Z','Z')})]${spec.wind?'':'[(0)]'}[(36):1:(40)][(234):1:(238)]`;return erddap+spec.dataset+'.json?'+q.replaceAll('[','%5B').replaceAll(']','%5D');}
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
 const t=payload.table;if(!t||!Array.isArray(t.rows)||!Array.isArray(t.columnNames)||!Array.isArray(t.columnUnits)||t.rows.length>200)throw new Error('Invalid or oversized regional grid response.');
 const ix=(n:string)=>t.columnNames.indexOf(n),[ti,la,lo,vi]=['time','latitude','longitude',field].map(ix);
 if([ti,la,lo,vi].some(i=>i<0))throw new Error('Spatial provider returned incomplete columns.');
 const expected=field==='ugrd10m'||field==='vgrd10m'?['m s-1','m/s']:field.includes('dir')?['degrees','degree']:field.includes('per')?['second','seconds','s']:['meters','m'];
 if(!expected.includes(t.columnUnits[vi]))throw new Error('Unexpected spatial forecast units.');
 const out=new Map<string,{lat:number;lon:number;value:number|null}>();
 for(const row of t.rows){if(Date.parse(String(row[ti]))!==Date.parse(spec.validAt))throw new Error('No exact spatial forecast frame at the requested layer time.');const lat=row[la],rawlon=row[lo];if(typeof lat!=='number'||typeof rawlon!=='number'||!Number.isFinite(lat)||!Number.isFinite(rawlon)||lat<36||lat>40||rawlon<234||rawlon>238)throw new Error('Spatial coordinates outside requested regional coverage.');const lon=rawlon-360,v=row[vi];let value=typeof v==='number'&&Number.isFinite(v)?v:null;if(value!==null&&(!spec.wind&&value<0||field.includes('dir')&&value>360))value=null;const key=`${lat},${lon}`;if(out.has(key))throw new Error('Duplicate spatial cell.');out.set(key,{lat,lon,value});}
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
 return {clear(){frames.clear();},get(key:string,now=Date.now()){const old=frames.get(key);if(old&&old.expires>now){hits++;frames.delete(key);frames.set(key,old);return old.frame;}if(old)frames.delete(key);misses++;return null;},set(key:string,frame:SpatialFrame,now=Date.now()){frames.set(key,{frame,expires:now+ttl});while(frames.size>limit)frames.delete(frames.keys().next().value!);},stats:()=>({frames:frames.size,hits,misses,cells:[...frames.values()].reduce((n,x)=>n+x.frame.cells.length,0)})};
}
const normalizedFrames=createFrameCache();
export const spatialCacheStats=()=>normalizedFrames.stats();
export async function loadSpatial(spec:SpatialSpec,signal:AbortSignal):Promise<SpatialFrame>{
 if(signal.aborted)throw new DOMException('Aborted','AbortError');const key=JSON.stringify(spec),cached=normalizedFrames.get(key);if(cached)return cached;
 const frame=await loadSpatialUncached(spec,signal);if(signal.aborted)throw new DOMException('Aborted','AbortError');normalizedFrames.set(key,frame);return frame;
}
