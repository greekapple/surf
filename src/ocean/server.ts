import {evidenceSpots} from './spots.ts';
import {marineURL,weatherURL} from './openMeteo.ts';
import {assignedMopIds} from './mop.ts';
import {extraTideStationIds} from './tideStations.ts';
import {contextBuoys,ndbcBuoyURL} from './buoys.ts';
export function serverProviderPath(url:string):string|null {
 for(const s of evidenceSpots){if(url===marineURL(s))return '/api/provider?key=marine-'+s.id;if(url===weatherURL(s))return '/api/provider?key=weather-'+s.id;}
 if(url==='https://www.ndbc.noaa.gov/data/realtime2/46026.txt')return '/api/provider?key=buoy';
 for(const b of contextBuoys)if(b.provider==='NDBC'&&url===ndbcBuoyURL(b.id))return '/api/provider?key='+b.fetchKey;
 try{const u=new URL(url);if(u.hostname==='thredds.cdip.ucsd.edu'&&u.pathname==='/thredds/ncss/point/cdip/realtime/029p1_rt.nc')return '/api/provider?key=cdip-029';if(u.hostname==='thredds.cdip.ucsd.edu'){const m=u.pathname.match(/^\/thredds\/(ncss\/point|dodsC)\/cdip\/model\/MOP_alongshore\/([A-Z]{2}\d{3})_(nowcast|forecast)\.nc(\.das)?$/);if(m&&assignedMopIds().includes(m[2])){if(m[1]==='ncss/point'&&!m[4])return m[3]==='nowcast'&&m[2]==='SF023'?'/api/provider?key=nearshore-SF023':'/api/provider?key=nearshore-'+m[2]+'-'+m[3];if(m[1]==='dodsC'&&m[4]&&m[3]==='forecast')return '/api/provider?key=nearshore-'+m[2]+'-das'}}if(u.hostname==='api.tidesandcurrents.noaa.gov'&&extraTideStationIds.includes(u.searchParams.get('station')??'')&&u.searchParams.get('product')==='predictions'){return '/api/provider?key='+(u.searchParams.get('interval')==='hilo'?'tide-extrema-':'tides-')+u.searchParams.get('station')}if(u.hostname==='api.tidesandcurrents.noaa.gov'&&u.searchParams.get('station')==='9414290'){const p=u.searchParams.get('product');if(p==='water_level')return '/api/provider?key=level';if(p==='predictions')return '/api/provider?key='+(u.searchParams.get('interval')==='hilo'?'tide-extrema':'tides')}}catch{}
 return null;
}
export interface RetrievalMetadata {retrievedAt:string;issuedAt:string|null;sourceURL:string;cache:string;model:string;warning?:string}
const metadata=new Map<string,RetrievalMetadata>();
export const sourceMetadata=(url:string)=>metadata.get(url);
export function rememberRetrieval(url:string,value:RetrievalMetadata){metadata.set(url,value)}

export function forgetRetrieval(url:string){metadata.delete(url)}

export function staleSource(url:string){return [...metadata.values()].some(m=>m.sourceURL===url&&m.cache==='stale')}
