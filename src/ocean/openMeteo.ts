import type {Measurement,SourceInfo,OceanSwell,OceanRecord,SpotEvidence} from './types.ts';
export const marineFields=['wave_height','swell_wave_height','swell_wave_direction','swell_wave_period','secondary_swell_wave_height','secondary_swell_wave_direction','secondary_swell_wave_period','sea_surface_temperature'];
export function marineURL(s:SpotEvidence){return `https://marine-api.open-meteo.com/v1/marine?${new URLSearchParams({latitude:String(s.marineLatitude),longitude:String(s.marineLongitude),hourly:marineFields.join(','),timezone:'GMT',timeformat:'unixtime',forecast_days:'7'})}`}
export function weatherURL(s:SpotEvidence){return `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({latitude:String(s.latitude),longitude:String(s.longitude),hourly:'wind_speed_10m,wind_direction_10m,wind_gusts_10m',wind_speed_unit:'mph',timezone:'GMT',timeformat:'unixtime',forecast_days:'7'})}`}
export function measure(value:unknown,unit:Measurement['unit'],source:SourceInfo,expectedNative:string[],reason='Provider did not supply this measurement.'):Measurement{
 const n=typeof value==='number'&&Number.isFinite(value)?value:null;
 if(n===null||(unit==='ft'&&n<0)||(unit==='mph'&&n<0)||(unit==='s'&&n<=0)||(unit==='deg'&&(n<0||n>360)))return {value:null,unit,source,reason};
 if(!expectedNative.includes(source.nativeUnit))return {value:null,unit,source,reason:`Unsupported provider unit: ${source.nativeUnit||'unspecified'}.`};
 const result=unit==='ft'&&source.nativeUnit==='m'?n/.3048:unit==='F'&&source.nativeUnit==='°C'?n*9/5+32:n;
 return {value:result,unit,source};
}
export const absent=(unit:Measurement['unit'],source:SourceInfo,reason:string):Measurement=>({value:null,unit,source,reason});
interface OpenMeteoResponse {__retrievedAt?:string;__issuedAt?:string|null;__sourceURL?:string;__cache?:string;latitude?:number;longitude?:number;hourly?:Record<string,unknown[]>;hourly_units?:Record<string,string>}
export function normalizeOpenMeteo(s:SpotEvidence,marine:OpenMeteoResponse|null,weather:OpenMeteoResponse|null,retrievedAt:string):OceanRecord[]{
 const epoch=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?new Date(v*1000).toISOString():null;
 const mt=marine?.hourly?.time??[],wt=weather?.hourly?.time??[];
 const marineIndex=new Map(mt.map((t,i)=>[epoch(t),i])),weatherIndex=new Map(wt.map((t,i)=>[epoch(t),i]));
 const times=[...new Set([...marineIndex.keys(),...weatherIndex.keys()].filter((v):v is string=>!!v))].sort();
 return times.map(timestamp=>{
 const base:SourceInfo={provider:'Open-Meteo Marine',kind:'forecast',validAt:timestamp,retrievedAt,issuedAt:null,updatedAt:null,url:marineURL(s),nativeUnit:'',location:`Returned grid ${marine?.latitude??'unknown'}, ${marine?.longitude??'unknown'}`,delivery:'direct',notes:'Model issue/update times not supplied by this endpoint. Retrieval time is not model issue time.'};
 const get=(key:string,unit:Measurement['unit'],expected:string[],weatherVariable=false)=>{const response=weatherVariable?weather:marine,index=weatherVariable?weatherIndex.get(timestamp):marineIndex.get(timestamp);const source={...base,provider:weatherVariable?'Open-Meteo Weather':'Open-Meteo Marine',location:`Returned grid ${response?.latitude??'unknown'}, ${response?.longitude??'unknown'}`,retrievedAt:response?.__retrievedAt??retrievedAt,issuedAt:response?.__issuedAt??null,url:response?.__sourceURL??(weatherVariable?weatherURL(s):marineURL(s)),notes:base.notes+(response?.__retrievedAt?' Server ingestion retrieval; '+(response.__cache??'cached')+'.':''),nativeUnit:response?.hourly_units?.[key]??''};return measure(index===undefined?null:response?.hourly?.[key]?.[index],unit,source,expected)};
 const swell=(prefix:string):OceanSwell=>({height:get(prefix+'_wave_height','ft',['m']),direction:get(prefix+'_wave_direction','deg',['°']),period:get(prefix+'_wave_period','s',['s'])});
 const secondary=swell('secondary_swell');
 return {spotId:s.id,timestamp,mode:'retrieved',offshore:get('wave_height','ft',['m']),primary:swell('swell'),secondary:[secondary.height,secondary.direction,secondary.period].some(m=>m.value!==null)?secondary:null,windSpeed:get('wind_speed_10m','mph',['mp/h','mph'],true),windDirection:get('wind_direction_10m','deg',['°'],true),gusts:get('wind_gusts_10m','mph',['mp/h','mph'],true),temperature:get('sea_surface_temperature','F',['°C']),face:absent('ft',base,'No calibrated spot-specific offshore-to-breaking-wave method is available.'),organization:absent('index',base,'No observed or calibrated local wave-shape/organization estimate is available.'),character:null,tide:absent('ft',{...base,provider:'NOAA CO-OPS',url:'https://api.tidesandcurrents.noaa.gov/api/prod/',location:'San Francisco station 9414290 (regional reference)',nativeUnit:'ft'},'No matching station prediction at this exact timestamp.'),tideTrend:'Unknown'};
 });
}
