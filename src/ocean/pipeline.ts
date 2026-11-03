import {nearshoreURL,normalizeNearshore} from './nearshore.ts';
import {assignedMopIds,mopURL,mopDasURL,parseMopDas} from './mop.ts';
import {extraTideStationIds} from './tideStations.ts';
import {contextBuoys,ndbcBuoyURL,cdipBuoyURL,normalizeCdipBuoy} from './buoys.ts';
import {sourceMetadata,staleSource} from './server.ts';
import {evidenceSpots} from './spots.ts';
import {nearSanFrancisco} from '../data/coast.ts';
import {request,ProviderError} from './request.ts';
import {marineURL,weatherURL,normalizeOpenMeteo} from './openMeteo.ts';
import {buoyURL,tideURL,normalizeTides,attachTides,normalizeBuoy,normalizeWaterLevel,tideExtremaURL,normalizeTideExtrema} from './noaa.ts';
import type {OceanBundle,ConnectionStatus,ObservationSet} from './types.ts';
let bundlePromise:Promise<OceanBundle>|null=null;let expiry=0;
export async function loadOcean(onStatus?:(s:ConnectionStatus)=>void):Promise<OceanBundle>{
 if(bundlePromise&&expiry>Date.now())return bundlePromise;
 expiry=Date.now()+600000;
 bundlePromise=(async()=>{const statuses:ConnectionStatus[]=[];
 const get=async(id:string,provider:string,url:string,text=false)=>{try{const payload=await request(url,text?'text':'json');if((id.startsWith('marine-')||id.startsWith('weather-'))&&!Array.isArray(payload?.hourly?.time))throw new ProviderError('Response contains no usable hourly records.');const meta=sourceMetadata(url);const status:ConnectionStatus={id,provider,state:meta?.cache==='stale'?'partial':'connected',message:meta?`Server ingestion: ${meta.cache}; provider retrieved ${meta.retrievedAt}. ${meta.warning??''}`:'Direct provider response received; measurement availability is checked separately.',checkedAt:new Date().toISOString(),url};statuses.push(status);onStatus?.(status);return payload}catch(e){const error=e as ProviderError;const status:ConnectionStatus={id,provider,state:'unavailable',message:error.message,checkedAt:new Date().toISOString(),url,retryAfter:error.retryAfter??undefined};statuses.push(status);onStatus?.(status);return null}};
 const start=new Date();start.setUTCDate(start.getUTCDate()-1);
 const tideRequest=tideURL('predictions',start),levelRequest=tideURL('water_level'),extremaRequest=tideExtremaURL(start);
 const proxyURL=import.meta.env.VITE_NOAA_PROXY_URL?.trim();
 const nearshoreRequest=nearshoreURL();
 const extraStations=extraTideStationIds.map(id=>({id,tideReq:tideURL('predictions',start,id),hiloReq:tideExtremaURL(start,id)}));
 const [spotData,tides,level,buoy,extrema,nearshore,stationRaw,ctxRaw,mopRaw]=await Promise.all([
 Promise.all(evidenceSpots.map(async spot=>{const [marine,weather]=await Promise.all([get('marine-'+spot.id,'Open-Meteo Marine · '+spot.name,marineURL(spot)),get('weather-'+spot.id,'Open-Meteo Weather · '+spot.name,weatherURL(spot))]);return normalizeOpenMeteo(spot,marine,weather,new Date().toISOString())})),
 get('tides','NOAA CO-OPS tide predictions',tideRequest),get('level','NOAA CO-OPS water-level observation',levelRequest),get('buoy','NOAA NDBC buoy observations',proxyURL||buoyURL,!proxyURL),get('tide-extrema','NOAA CO-OPS high/low predictions',extremaRequest),get('nearshore-SF023','CDIP Ocean Beach nearshore nowcast',nearshoreRequest,true),
 Promise.all(extraStations.map(async s=>{const [h,x]=await Promise.all([get('tides-'+s.id,'NOAA CO-OPS tide predictions '+s.id,s.tideReq),get('tide-extrema-'+s.id,'NOAA CO-OPS high/low predictions '+s.id,s.hiloReq)]);return {s,h,x}})),
 Promise.all(contextBuoys.map(async b=>{const url=b.provider==='NDBC'?ndbcBuoyURL(b.id):cdipBuoyURL(b.id);return {b,url,raw:await get(b.fetchKey,`${b.provider} ${b.label} buoy`,url,true)}})),
 Promise.all(assignedMopIds().map(async id=>{const fu=mopURL(id,'forecast'),du=mopDasURL(id);const [fc,das]=await Promise.all([get('nearshore-'+id+'-forecast','CDIP MOP '+id+' forecast',fu,true),get('nearshore-'+id+'-das','CDIP MOP '+id+' file attributes',du,true)]);return {id,fu,du,fc,das}}))]);
 const loadedAt=new Date().toISOString();
 const proxyValid=proxyURL&&buoy?.station==='46026'&&typeof buoy.text==='string'&&Number.isFinite(Date.parse(buoy.retrievedAt))&&Date.parse(buoy.retrievedAt)<=Date.now()+300000;
 let observation:ObservationSet|null=proxyURL?(proxyValid?normalizeBuoy(buoy.text,buoy.retrievedAt):null):buoy?normalizeBuoy(buoy,sourceMetadata(buoyURL)?.retrievedAt??loadedAt):null;
 if(!observation){const status=statuses.find(s=>s.id==='buoy');if(status?.state==='connected'){status.state='unavailable';status.message='Response contains no valid recent station observations.';onStatus?.(status)}}
 if(!observation){try{const snapshot=await request('/observations/ndbc-46026.json');if(snapshot?.station==='46026'&&snapshot.delivery==='saved'&&snapshot.values&&Object.values(snapshot.values).every((v:any)=>v?.source?.provider==='NOAA NDBC 46026'&&v?.source?.delivery==='saved'&&Number.isFinite(v.value)&&Number.isFinite(Date.parse(v.source.validAt)))){observation=snapshot;const status=statuses.find(s=>s.id==='buoy');if(status){status.state='partial';status.message+=' Showing a separately labeled saved observation; it is not a live browser connection.';onStatus?.(status)}}}catch{/* No hidden demo fallback. */}}
 const bundle:OceanBundle={buoys:ctxRaw.flatMap(({b,url,raw})=>{if(typeof raw!=='string')return [];const m=sourceMetadata(url),at=m?.retrievedAt??loadedAt;const set=b.provider==='NDBC'?normalizeBuoy(raw,at,m?.cache==='stale'?'saved':'direct',b.id):normalizeCdipBuoy(raw,at,m?.sourceURL??url,b);return set?[set]:[]}),stationTides:Object.fromEntries(stationRaw.map(({s,h,x})=>{const hm=sourceMetadata(s.tideReq),xm=sourceMetadata(s.hiloReq);return [s.id,{stationId:s.id,hourly:[...normalizeTides(h,hm?.retrievedAt??loadedAt,hm?.sourceURL??s.tideReq)].map(([timestamp,height])=>({timestamp,height})),extrema:normalizeTideExtrema(x,xm?.retrievedAt??loadedAt,xm?.sourceURL??s.hiloReq)}]})),mop:Object.fromEntries(mopRaw.map(({id,fu,du,fc,das})=>{const m=sourceMetadata(fu),text=typeof das==='string'?das:das?.text;return [id,{mopId:id,records:fc?normalizeNearshore(fc,m?.retrievedAt??loadedAt,m?.sourceURL??fu,'forecast'):[],issue:text?parseMopDas(text):null,retrievedAt:m?.retrievedAt??loadedAt,url:m?.sourceURL??fu,...(m?.cache==='stale'?{delivery:'saved' as const}:{}),...(sourceMetadata(du)?.cache==='stale'?{issueDelivery:'saved' as const,issueRetrievedAt:sourceMetadata(du)?.retrievedAt}:{})}]})),nearshore:nearshore?normalizeNearshore(nearshore,sourceMetadata(nearshoreRequest)?.retrievedAt??loadedAt,sourceMetadata(nearshoreRequest)?.sourceURL??nearshoreRequest):[],extrema:normalizeTideExtrema(extrema,sourceMetadata(extremaRequest)?.retrievedAt??loadedAt,sourceMetadata(extremaRequest)?.sourceURL??extremaRequest),records:(()=>{const tideMap=normalizeTides(tides,sourceMetadata(tideRequest)?.retrievedAt??loadedAt,sourceMetadata(tideRequest)?.sourceURL??tideRequest);const near=(id:string)=>{const e=evidenceSpots.find(x=>x.id===id);return !!e&&nearSanFrancisco(e.latitude,e.longitude)};const all=spotData.flat();/* The SF station is only a fair reference near the Bay; other coasts get no tide rather than a borrowed one. */return [...attachTides(all.filter(r=>near(r.spotId)),tideMap),...all.filter(r=>!near(r.spotId))]})(),statuses,buoy:observation,waterLevel:normalizeWaterLevel(level,sourceMetadata(levelRequest)?.retrievedAt??loadedAt,sourceMetadata(levelRequest)?.sourceURL??levelRequest),loadedAt};
 // Text/station adapters also retain server stale delivery, not just JSON point forecasts.
 const label=(value:unknown):void=>{if(!value||typeof value!=='object')return;const x=value as Record<string,any>;if(x.source?.url&&staleSource(x.source.url))x.source.delivery='saved';for(const [key,child] of Object.entries(x))if(key!=='source')label(child)};label(bundle);
 if(bundle.buoy&&Object.values(bundle.buoy.values).some(m=>m.source.delivery==='saved'))bundle.buoy.delivery='saved';
 return bundle;})();
 try{return await bundlePromise}catch(error){bundlePromise=null;expiry=0;throw error}
}
