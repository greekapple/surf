import type {Forecast,UserProfile} from '../models/index.ts';
import type {SpotEvidence,Measurement} from '../ocean/types.ts';
import type {ForecastPoint,MapLayer,MapReading,MapVariable} from './types.ts';
import {height,wind,compass} from '../utils/units.ts';
export const mapVariables:Record<MapLayer,MapVariable[]>={SWELL:['Height','Period','Direction'],WIND:['Speed','Direction','Gusts'],WAVES:['Offshore Hs','Period','Direction','Breaking-wave estimate'],TIDE:['Station height','High/low predictions']};
/** NOAA station metadata checked 2026-10-20; source is retained with the map data. */
export const tideStation={id:'9414290',name:'San Francisco',latitude:37.806305,longitude:-122.46589,url:'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/9414290.json'};
export function exactFrame(records:Forecast[],time:string|null,spotIds:string[]){return time?records.filter(f=>f.timestamp===time&&spotIds.includes(f.spotId)):[];}
export function modelLocation(location:string):{latitude:number;longitude:number}|null {const m=/^Returned grid (-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)$/.exec(location);if(!m)return null;const latitude=+m[1],longitude=+m[2];return Math.abs(latitude)<=90&&Math.abs(longitude)<=180?{latitude,longitude}:null;}
export function layerReading(f:Forecast,layer:MapLayer,variable:MapVariable,secondary=false):MapReading {
 const r=f.evidence,sw=secondary?f.secondary:f.primary,rs=secondary?r?.secondary:r?.primary;
 let value:number|null=null,unit:Measurement['unit']='ft',measurement:Measurement|null=null,direction:number|null=null,period:number|null=null,breaking=false,label='';
 if(layer==='SWELL'){
  direction=r?rs?.direction.value??null:f.availability.swell&&sw?sw.direction:null;period=r?rs?.period.value??null:f.availability.swell&&sw?sw.period:null;
  if(variable==='Period'){unit='s';value=period;measurement=rs?.period??null;label='Swell period';}
  else if(variable==='Direction'){unit='deg';value=direction;measurement=rs?.direction??null;label='Swell direction from';}
  else{value=r?rs?.height.value??null:f.availability.swell&&sw?sw.height:null;measurement=rs?.height??null;label='Swell height';}
 }else if(layer==='WIND'){
  direction=r?r.windDirection.value:f.availability.wind?f.wind.direction:null;
  if(variable==='Direction'){unit='deg';value=direction;measurement=r?.windDirection??null;label='Wind direction from';}
  else {unit='mph';measurement=(variable==='Gusts'?r?.gusts:r?.windSpeed)??null;value=r?measurement?.value??null:f.availability.wind?(variable==='Gusts'?f.wind.gusts??null:f.wind.speed):null;label=variable==='Gusts'?'Wind gusts':'Wind speed';}
 }else if(layer==='WAVES'){
  if(variable==='Period'||variable==='Direction')return {value:null,unit:variable==='Period'?'s':'deg',label:variable==='Period'?'Combined peak wave period (regional grid only)':'Combined peak wave direction (regional grid only)',direction:null,period:null,measurement:null,breaking:false};
  breaking=variable==='Breaking-wave estimate';measurement=(breaking?r?.face:r?.offshore)??null;value=r?measurement?.value??null:breaking?(f.availability.face?f.face:null):Number.isFinite(f.offshore)?f.offshore:null;label=breaking?'Breaking-wave estimate':'Offshore significant wave height';
 }else{measurement=r?.tide??null;value=r?r.tide.value:null;label='NOAA station tide · MLLW';}
 return {value:value!==null&&Number.isFinite(value)?value:null,unit,label,direction,period,measurement,breaking};
}
export function formatMapReading(r:MapReading,p:UserProfile){if(r.value===null)return 'Unavailable';return r.unit==='ft'?height(r.value,p,r.breaking):r.unit==='mph'?wind(r.value,p):r.unit==='deg'?`${compass(r.value)} · ${Math.round(r.value)}°`:`${r.value.toFixed(1)} s`;}
export function buildMapPoints(spots:SpotEvidence[],frame:Forecast[],layer:MapLayer,variable:MapVariable,secondary=false):ForecastPoint[]{
 if(layer==='TIDE'){
  const f=frame.find(f=>f.evidence?.tide.value!==null&&f.evidence?.tide.value!==undefined);
  if(!f)return [];
  return [{id:'tide-'+tideStation.id,spotId:null,name:`NOAA ${tideStation.name} ${tideStation.id}`,latitude:tideStation.latitude,longitude:tideStation.longitude,locationLabel:'Regional station, not a surf-break tide measurement',reading:layerReading(f,layer,variable),demonstration:false}];
 }
 return spots.flatMap(s=>{const f=frame.find(f=>f.spotId===s.id);if(!f)return [];const reading=layerReading(f,layer,variable,secondary);if(reading.value===null)return [];
 const loc=reading.measurement?modelLocation(reading.measurement.source.location):null;
 const reference=layer==='WIND'||reading.breaking?{latitude:s.latitude,longitude:s.longitude}:{latitude:s.marineLatitude,longitude:s.marineLongitude};
 return [{id:layer+'-'+s.id,spotId:s.id,name:s.name,...(loc??reference),locationLabel:loc?'Provider-returned model grid point':f.evidence?'Requested query reference; returned grid location unavailable':'Illustrative point at a documented query reference — demonstration only',reading,demonstration:!f.evidence}];});
}
export function nextFrameIndex(times:string[],selected:string,step=1){const index=times.indexOf(selected),next=index+step;return index<0||next<0||next>=times.length?null:next;}
