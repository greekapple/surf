import {evidenceSpots} from './spots.ts';
import {marineURL,weatherURL} from './openMeteo.ts';
export function serverProviderPath(url:string):string|null {
 for(const s of evidenceSpots){if(url===marineURL(s))return '/api/provider?key=marine-'+s.id;if(url===weatherURL(s))return '/api/provider?key=weather-'+s.id;}
 if(url==='https://www.ndbc.noaa.gov/data/realtime2/46026.txt')return '/api/provider?key=buoy';
 try{const u=new URL(url);if(u.hostname==='thredds.cdip.ucsd.edu'&&u.pathname==='/thredds/ncss/point/cdip/model/MOP_alongshore/SF023_nowcast.nc')return '/api/provider?key=nearshore-SF023';if(u.hostname==='api.tidesandcurrents.noaa.gov'&&u.searchParams.get('station')==='9414290'){const p=u.searchParams.get('product');if(p==='water_level')return '/api/provider?key=level';if(p==='predictions')return '/api/provider?key='+(u.searchParams.get('interval')==='hilo'?'tide-extrema':'tides')}}catch{}
 return null;
}
export interface RetrievalMetadata {retrievedAt:string;issuedAt:string|null;sourceURL:string;cache:string;model:string;warning?:string}
const metadata=new Map<string,RetrievalMetadata>();
export const sourceMetadata=(url:string)=>metadata.get(url);
export function rememberRetrieval(url:string,value:RetrievalMetadata){metadata.set(url,value)}

export function forgetRetrieval(url:string){metadata.delete(url)}

export function staleSource(url:string){return [...metadata.values()].some(m=>m.sourceURL===url&&m.cache==='stale')}
