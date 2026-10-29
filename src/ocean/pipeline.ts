import {nearshoreURL,normalizeNearshore} from './nearshore.ts';
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
 const [spotData,tides,level,buoy,extrema,nearshore]=await Promise.all([
 Promise.all(evidenceSpots.map(async spot=>{const [marine,weather]=await Promise.all([get('marine-'+spot.id,'Open-Meteo Marine · '+spot.name,marineURL(spot)),get('weather-'+spot.id,'Open-Meteo Weather · '+spot.name,weatherURL(spot))]);return normalizeOpenMeteo(spot,marine,weather,new Date().toISOString())})),
 get('tides','NOAA CO-OPS tide predictions',tideRequest),get('level','NOAA CO-OPS water-level observation',levelRequest),get('buoy','NOAA NDBC buoy observations',proxyURL||buoyURL,!proxyURL),get('tide-extrema','NOAA CO-OPS high/low predictions',extremaRequest),get('nearshore-SF023','CDIP Ocean Beach nearshore nowcast',nearshoreRequest,true)]);
 const loadedAt=new Date().toISOString();
 const proxyValid=proxyURL&&buoy?.station==='46026'&&typeof buoy.text==='string'&&Number.isFinite(Date.parse(buoy.retrievedAt))&&Date.parse(buoy.retrievedAt)<=Date.now()+300000;
 let observation:ObservationSet|null=proxyURL?(proxyValid?normalizeBuoy(buoy.text,buoy.retrievedAt):null):buoy?normalizeBuoy(buoy,sourceMetadata(buoyURL)?.retrievedAt??loadedAt):null;
 if(!observation){const status=statuses.find(s=>s.id==='buoy');if(status?.state==='connected'){status.state='unavailable';status.message='Response contains no valid recent station observations.';onStatus?.(status)}}
 if(!observation){try{const snapshot=await request('/observations/ndbc-46026.json');if(snapshot?.station==='46026'&&snapshot.delivery==='saved'&&snapshot.values&&Object.values(snapshot.values).every((v:any)=>v?.source?.provider==='NOAA NDBC 46026'&&v?.source?.delivery==='saved'&&Number.isFinite(v.value)&&Number.isFinite(Date.parse(v.source.validAt)))){observation=snapshot;const status=statuses.find(s=>s.id==='buoy');if(status){status.state='partial';status.message+=' Showing a separately labeled saved observation; it is not a live browser connection.';onStatus?.(status)}}}catch{/* No hidden demo fallback. */}}
 const bundle:OceanBundle={nearshore:nearshore?normalizeNearshore(nearshore,sourceMetadata(nearshoreRequest)?.retrievedAt??loadedAt,sourceMetadata(nearshoreRequest)?.sourceURL??nearshoreRequest):[],extrema:normalizeTideExtrema(extrema,sourceMetadata(extremaRequest)?.retrievedAt??loadedAt,sourceMetadata(extremaRequest)?.sourceURL??extremaRequest),records:(()=>{const tideMap=normalizeTides(tides,sourceMetadata(tideRequest)?.retrievedAt??loadedAt,sourceMetadata(tideRequest)?.sourceURL??tideRequest);const near=(id:string)=>{const e=evidenceSpots.find(x=>x.id===id);return !!e&&nearSanFrancisco(e.latitude,e.longitude)};const all=spotData.flat();/* The SF station is only a fair reference near the Bay; other coasts get no tide rather than a borrowed one. */return [...attachTides(all.filter(r=>near(r.spotId)),tideMap),...all.filter(r=>!near(r.spotId))]})(),statuses,buoy:observation,waterLevel:normalizeWaterLevel(level,sourceMetadata(levelRequest)?.retrievedAt??loadedAt,sourceMetadata(levelRequest)?.sourceURL??levelRequest),loadedAt};
 // Text/station adapters also retain server stale delivery, not just JSON point forecasts.
 const label=(value:unknown):void=>{if(!value||typeof value!=='object')return;const x=value as Record<string,any>;if(x.source?.url&&staleSource(x.source.url))x.source.delivery='saved';for(const [key,child] of Object.entries(x))if(key!=='source')label(child)};label(bundle);
 if(bundle.buoy&&Object.values(bundle.buoy.values).some(m=>m.source.delivery==='saved'))bundle.buoy.delivery='saved';
 return bundle;})();
 try{return await bundlePromise}catch(error){bundlePromise=null;expiry=0;throw error}
}
