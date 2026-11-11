import {evidenceSpots} from './spots.ts';
import {marineURL,weatherURL,modelSpreadURL} from './openMeteo.ts';
import {assignedMopIds} from './mop.ts';
import {hourlyTideStationIds, hiloTideStationIds} from './tideStations.ts';
import {SWAN_ENABLED} from './swanFlag.ts';
import {swanCells, swanProviderKey, swanURL} from './swan.ts';
import {contextBuoys,ndbcBuoyURL} from './buoys.ts';
import {shoreStations,shoreFeedKey,ndbcWindURL,nwsObservationURL} from './shoreWind.ts';
/** url -> provider key of every spot's marine, weather and spread request, built once: the old per-call scan of all spots (three URL builds each) cost ~0.4 s of Explore's main thread at 492 spots on a phone (T-091). First spot wins when two spots share a point (Acid Drop and PK's), as the scan did. */
let spotKeyMap:Map<string,string>|null=null;
const spotKeys=()=>{if(!spotKeyMap){spotKeyMap=new Map();const put=(u:string,k:string)=>{if(!spotKeyMap!.has(u))spotKeyMap!.set(u,k)};for(const s of evidenceSpots){put(marineURL(s),'/api/provider?key=marine-'+s.id);put(weatherURL(s),'/api/provider?key=weather-'+s.id);put(modelSpreadURL(s),'/api/provider?key=spread-'+s.id)}}return spotKeyMap};
export function serverProviderPath(url:string):string|null {
 const spotKey=spotKeys().get(url);if(spotKey)return spotKey;
 if(url==='https://www.ndbc.noaa.gov/data/realtime2/46026.txt')return '/api/provider?key=buoy';
 for(const b of contextBuoys)if(b.provider==='NDBC'&&url===ndbcBuoyURL(b.id))return '/api/provider?key='+b.fetchKey;
 for(const st of shoreStations())if(url===(st.kind==='ndbc'?ndbcWindURL(st.id):nwsObservationURL(st.id)))return '/api/provider?key='+shoreFeedKey(st);
 try{const u=new URL(url);if(u.hostname==='thredds.cdip.ucsd.edu'){const rt=u.pathname.match(/^\/thredds\/ncss\/point\/cdip\/realtime\/(029|098|106)p1_rt\.nc$/);if(rt)return '/api/provider?key=cdip-'+rt[1]}if(u.hostname==='thredds.cdip.ucsd.edu'){const m=u.pathname.match(/^\/thredds\/(ncss\/point|dodsC)\/cdip\/model\/MOP_alongshore\/([A-Z]{1,2}\d{3,4})_(nowcast|forecast)\.nc(\.das)?$/);if(m&&assignedMopIds().includes(m[2])){if(m[1]==='ncss/point'&&!m[4])return m[3]==='nowcast'&&m[2]==='SF023'?'/api/provider?key=nearshore-SF023':'/api/provider?key=nearshore-'+m[2]+'-'+m[3];if(m[1]==='dodsC'&&m[4]&&m[3]==='forecast')return '/api/provider?key=nearshore-'+m[2]+'-das'}}if(SWAN_ENABLED&&u.hostname==='pae-paha.pacioos.hawaii.edu'){const q=decodeURIComponent(u.search),cell=swanCells().find(c=>u.pathname===`/erddap/griddap/${c.dataset}_lon180.json`&&q.includes(`[(0)][(${c.lat})][(${c.lon})]`));if(cell)return '/api/provider?key='+swanProviderKey(cell)}if(u.hostname==='api.tidesandcurrents.noaa.gov'&&hiloTideStationIds.includes(u.searchParams.get('station')??'')&&u.searchParams.get('product')==='predictions'&&u.searchParams.get('interval')==='hilo')return '/api/provider?key=tide-extrema-'+u.searchParams.get('station');if(u.hostname==='api.tidesandcurrents.noaa.gov'&&hourlyTideStationIds.includes(u.searchParams.get('station')??'')&&u.searchParams.get('product')==='predictions'){return '/api/provider?key='+(u.searchParams.get('interval')==='hilo'?'tide-extrema-':'tides-')+u.searchParams.get('station')}if(u.hostname==='api.tidesandcurrents.noaa.gov'&&u.searchParams.get('station')==='9414290'){const p=u.searchParams.get('product');if(p==='water_level')return '/api/provider?key=level';if(p==='predictions')return '/api/provider?key='+(u.searchParams.get('interval')==='hilo'?'tide-extrema':'tides')}}catch{}
 return null;
}
export interface RetrievalMetadata {/** When the data was last confirmed current: the later of the provider retrieval and the Worker's 304 revalidation (T-086). */retrievedAt:string;/** The provider retrieval time itself, when a later revalidation moved retrievedAt. */providerRetrievedAt?:string;validatedAt?:string;issuedAt:string|null;sourceURL:string;cache:string;model:string;warning?:string}
const metadata=new Map<string,RetrievalMetadata>();
export const sourceMetadata=(url:string)=>metadata.get(url);
/** T-086: a Worker 304 revalidation keeps the old retrievedAt and moves only validatedAt; data confirmed minutes ago is not 'retrieved hours ago'. Freshness uses the later (an unreadable or future validatedAt is ignored). */
export function effectiveRetrieval(value:RetrievalMetadata,nowMs:number=Date.now()):RetrievalMetadata{const r=Date.parse(value.retrievedAt),v=Date.parse(value.validatedAt??'');return Number.isFinite(r)&&Number.isFinite(v)&&v>r&&v<=nowMs+300000?{...value,providerRetrievedAt:value.retrievedAt,retrievedAt:value.validatedAt!}:value}
const staleUrls=new Set<string>();/* T-091: staleSource() runs once per object while the whole bundle is labelled; a set makes it O(1) instead of a scan of every entry */
export function rememberRetrieval(url:string,value:RetrievalMetadata){const v=effectiveRetrieval(value);metadata.set(url,v);rebuildStale()}
function rebuildStale(){staleUrls.clear();for(const m of metadata.values())if(m.cache==='stale')staleUrls.add(m.sourceURL)}

export function forgetRetrieval(url:string){metadata.delete(url);rebuildStale()}

export function staleSource(url:string){return staleUrls.has(url)}
/** True when any request was answered from a saved copy: the delivery labelling walk over the whole bundle does nothing otherwise (~0.1 s of main thread on a phone at 492 spots, T-091). */
export const anyStaleSource=()=>staleUrls.size>0;
